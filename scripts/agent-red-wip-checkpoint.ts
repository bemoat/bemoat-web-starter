#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { lstatSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createHelpEnvelopeV1, formatTextHelp } from './cli/command-help.ts'
import { CliInvocationError, parseCommandInvocation, resolveCommandIdentity } from './cli/command-invocation.ts'
import { classificationExitCode, createResultEnvelopeV1 } from './cli/command-result.ts'
import type { ParsedInvocation } from './cli/command-invocation-schemas.ts'
import {
  parseRedWipApproval,
  validateRedWipCandidate,
  validateRedWipCandidateState,
  validateRedWipPush,
  validateRedWipReadback,
  validateRedWipFailureSet,
  redWipCommitSubject,
  createRedWipMutationState,
  redWipMutationPerformed,
  validateCanonicalOriginTransport,
  validateRedWipSuiteReport,
  type RedWipSuiteReport,
  type RedWipApproval,
  type RedWipEvidence,
} from './context/red-wip-checkpoint.ts'

const COMMAND = 'bemoat:checkpoint:red-wip'
const ENTRYPOINT = 'scripts/agent-red-wip-checkpoint.ts'
type VitestAssertion = { status: string; fullName: string; failureMessages?: string[] }
type VitestFileResult = { name: string; status: string; assertionResults?: VitestAssertion[]; message?: string; failureMessage?: string; errors?: unknown[] }
type VitestJsonReport = { testResults?: VitestFileResult[]; numFailedTests?: number; numPassedTests?: number; numFailedTestSuites?: number; unhandledErrors?: unknown[] }
const mutationState = createRedWipMutationState()
let plannedCommit: { parentSha: string; subject: string } | null = null

function run(command: string, args: string[], options: { allowFailure?: boolean; cwd?: string } = {}) {
  const result = spawnSync(command, args, { cwd: options.cwd, encoding: 'utf8' })
  if (result.error) throw new Error(`${command} ${args.join(' ')} failed to start: ${result.error.message}`)
  if (result.status !== 0 && !options.allowFailure) {
    throw new Error(`${command} ${args.join(' ')} failed: ${(result.stderr || result.stdout || '').trim()}`)
  }
  return { status: result.status ?? 1, stdout: result.stdout ?? '', stderr: result.stderr ?? '' }
}

function git(args: string[], options: { allowFailure?: boolean } = {}) {
  return run('git', args, options).stdout.trim()
}

function liveRef(ref: string): string {
  verifyCanonicalOriginTransport()
  const rows = run('git', ['ls-remote', 'origin', ref]).stdout.trim().split(/\r?\n/).filter(Boolean)
  if (rows.length !== 1 || !rows[0].endsWith(`\t${ref}`)) throw new Error(`live origin ref is missing or ambiguous: ${ref}`)
  return rows[0].split(/\s+/)[0]
}

function issueApproval(issueNumber: string): RedWipApproval {
  let issue: { number?: number; state?: string; body?: string }
  const repository = repositoryIdentity()
  try {
    issue = JSON.parse(run('gh', ['issue', 'view', issueNumber, '--repo', repository, '--json', 'number,state,body']).stdout) as typeof issue
  } catch {
    throw new Error('canonical Issue evidence was unavailable or malformed')
  }
  if (String(issue.number) !== issueNumber || issue.state !== 'OPEN') {
    throw new Error('canonical Issue number or state does not match the task')
  }
  return parseRedWipApproval(issue.body ?? '', issueNumber)
}

function gitStatus() {
  // Keep porcelain's leading status column; git() trims it and would turn the
  // first ordinary unstaged file into a falsely staged path.
  const records = run('git', ['status', '--porcelain=v1', '--untracked-files=all']).stdout.split(/\r?\n/).filter(Boolean)
  const staged: string[] = []
  const unstaged: string[] = []
  const untracked: string[] = []
  for (const record of records) {
    const code = record.slice(0, 2)
    const path = record.slice(3)
    if (code === '??') untracked.push(path)
    else {
      if (code[0] !== ' ') staged.push(path)
      if (code[1] !== ' ') unstaged.push(path)
    }
  }
  return { stagedPaths: staged, unstagedPaths: unstaged, untrackedPaths: untracked }
}

function repositoryIdentity(): string {
  verifyCanonicalOriginTransport()
  return 'bemoat/bemoat-web-starter'
}

function gitConfigValues(key: string): string[] {
  const result = run('git', ['config', '--get-all', key], { allowFailure: true })
  if (result.status !== 0 && result.status !== 1) throw new Error(`could not read Git configuration ${key}`)
  return result.status === 0 ? result.stdout.trim().split(/\r?\n/) : []
}

function effectiveRemoteUrls(push: boolean): string[] {
  const args = ['remote', 'get-url', ...(push ? ['--push'] : []), '--all', 'origin']
  const result = run('git', args, { allowFailure: true })
  if (result.status !== 0) throw new Error('canonical origin effective transport URL is unavailable')
  return result.stdout.trim().split(/\r?\n/).filter(Boolean)
}

function verifyCanonicalOriginTransport(): void {
  const reasons = validateCanonicalOriginTransport({
    configuredFetchUrls: gitConfigValues('remote.origin.url'),
    configuredPushUrls: gitConfigValues('remote.origin.pushurl'),
    effectiveFetchUrls: effectiveRemoteUrls(false),
    effectivePushUrls: effectiveRemoteUrls(true),
  })
  if (reasons.length) throw new Error(reasons.join('; '))
}

function verifyBranchSafety() {
  run('bash', ['scripts/check-branch-safety.sh'])
  run('pnpm', ['run', 'bemoat:guard:safety'])
}

function verifyBaseAncestry(sha: string) {
  const result = run('git', ['merge-base', '--is-ancestor', sha, 'HEAD'], { allowFailure: true })
  if (result.status !== 0) throw new Error('live protected base is not an ancestor of the task branch')
}

function collectCandidate(approval: RedWipApproval, issueNumber: string, explicitOptIn: boolean): RedWipEvidence {
  const approvedPath = resolve(process.cwd(), approval.test_path)
  const approvedPathStat = lstatSync(approvedPath)
  if (!approvedPathStat.isFile() || approvedPathStat.isSymbolicLink()) {
    throw new Error('Issue-approved test path must be a regular file and not a symbolic link')
  }
  const branch = git(['branch', '--show-current'])
  const upstream = git(['rev-parse', '--abbrev-ref', '@{upstream}'])
  const localHead = git(['rev-parse', 'HEAD'])
  const upstreamHead = git(['rev-parse', upstream])
  const liveTopicHead = liveRef(`refs/heads/${branch}`)
  const protectedBaseSha = approval.protected_base_sha
  const liveProtectedBaseSha = liveRef('refs/heads/main')
  const status = gitStatus()
  verifyBaseAncestry(liveProtectedBaseSha)
  const candidateState: RedWipEvidence = {
    explicitOptIn,
    issueNumber,
    repository: repositoryIdentity(),
    branch,
    upstream,
    localHead,
    upstreamHead,
    liveTopicHead,
    protectedBaseSha,
    liveProtectedBaseSha,
    protectedBaseIsAncestor: true,
    ...status,
    failures: [],
    totalFailed: 0,
    totalPassed: 0,
  }
  const stateReasons = validateRedWipCandidateState(approval, candidateState)
  if (stateReasons.length) throw new Error(stateReasons.join('; '))
  const test = runIntegrationSuite(approval)
  return {
    ...candidateState,
    failures: test.failures,
    totalFailed: test.totalFailed,
    totalPassed: test.totalPassed,
  }
}

function runIntegrationSuite(approval: RedWipApproval) {
  const directory = mkdtempSync(join(tmpdir(), 'bemoat-red-wip-'))
  const output = join(directory, 'vitest.json')
  try {
    const result = run('pnpm', ['run', 'bemoat:test:int', '--', '--reporter=json', `--outputFile=${output}`], { allowFailure: true })
    let report: VitestJsonReport
    try { report = JSON.parse(readFileSync(output, 'utf8')) as VitestJsonReport } catch {
      throw new Error(`integration suite did not produce machine-readable results: ${(result.stderr || result.stdout).trim()}`)
    }
    if (!Array.isArray(report.testResults) || !Number.isInteger(report.numFailedTests) || !Number.isInteger(report.numPassedTests) ||
        !Number.isInteger(report.numFailedTestSuites) || (report.unhandledErrors !== undefined && !Array.isArray(report.unhandledErrors))) {
      throw new Error('integration suite returned an incomplete or malformed JSON report')
    }
    const suites = report.testResults.map((file) => {
      if (typeof file.name !== 'string' || typeof file.status !== 'string' || !Array.isArray(file.assertionResults)) {
        throw new Error('integration suite returned an incomplete or malformed suite result')
      }
      return {
        file: relative(process.cwd(), file.name).split('\\').join('/'), status: file.status,
        ...(typeof file.message === 'string' ? { error: file.message } : {}),
        ...(typeof file.failureMessage === 'string' ? { failureMessage: file.failureMessage } : {}),
        ...(file.errors?.length ? { error: JSON.stringify(file.errors) } : {}),
        assertions: file.assertionResults.map((assertion) => {
          if (typeof assertion.status !== 'string' || typeof assertion.fullName !== 'string') throw new Error('integration suite returned a malformed assertion result')
          return { status: assertion.status, name: assertion.fullName, message: (assertion.failureMessages ?? []).join('\n') }
        }),
      }
    })
    const failed = report.numFailedTests
    const passed = report.numPassedTests
    if (result.status !== 0 && failed === 0) throw new Error('integration test process failed without a recognized failed assertion')
    if (result.status === 0 && failed !== 0) throw new Error('integration test result is contradictory')
    const suiteReport: RedWipSuiteReport = {
      numFailedTests: failed, numPassedTests: passed, numFailedTestSuites: report.numFailedTestSuites,
      unhandledErrors: report.unhandledErrors, suites,
    }
    const reasons = validateRedWipSuiteReport(approval, suiteReport)
    if (reasons.length) throw new Error(reasons.join('; '))
    const failures = suites.flatMap((suite) => suite.assertions.filter((assertion) => assertion.status === 'failed')
      .map((assertion) => ({ name: assertion.name, file: suite.file, message: assertion.message })))
    return { failures, totalFailed: failed, totalPassed: passed }
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

function verifyPush(approval: RedWipApproval, issueNumber: string, localSha: string, remoteSha: string, localRef: string, remoteRef: string) {
  const branch = git(['branch', '--show-current'])
  const upstream = git(['rev-parse', '--abbrev-ref', '@{upstream}'])
  const expectedLocal = git(['rev-parse', 'HEAD'])
  const upstreamHead = git(['rev-parse', upstream])
  const actualRemote = liveRef(`refs/heads/${branch}`)
  const parentSha = git(['rev-parse', `${localSha}^`])
  const subject = git(['show', '-s', '--format=%s', localSha])
  const pushedCommitCount = Number(git(['rev-list', '--count', `${remoteSha}..${localSha}`]))
  const changedPaths = git(['diff', '--name-only', `${remoteSha}..${localSha}`]).split('\n').filter(Boolean)
  if (expectedLocal !== localSha || actualRemote !== remoteSha || upstream !== `origin/${branch}` || upstreamHead !== remoteSha) throw new Error('pre-push local, upstream, or live remote SHA changed')
  if (repositoryIdentity() !== approval.repository || gitStatus().stagedPaths.length || gitStatus().unstagedPaths.length || gitStatus().untrackedPaths.length) {
    throw new Error('pre-push worktree is not clean or canonical')
  }
  const liveBase = liveRef('refs/heads/main')
  if (liveBase !== approval.protected_base_sha) throw new Error('Issue approval protected base is stale')
  verifyBaseAncestry(liveBase)
  const reasons = validateRedWipPush({
    approval, issueNumber, repository: repositoryIdentity(), branch, localSha, remoteSha, localRef, remoteRef, parentSha,
    commitSubject: subject, changedPaths, pushedCommitCount,
  })
  if (reasons.length) throw new Error(reasons.join('; '))
  const test = runIntegrationSuite(approval)
  const failureReasons = validateRedWipFailureSet(approval, test.failures, test.totalFailed, test.totalPassed)
  if (failureReasons.length) throw new Error(failureReasons.join('; '))
}

function createCheckpoint(approval: RedWipApproval, issueNumber: string) {
  verifyBranchSafety()
  const evidence = collectCandidate(approval, issueNumber, true)
  const reasons = validateRedWipCandidate(approval, evidence)
  if (reasons.length) throw new Error(reasons.join('; '))
  const subject = redWipCommitSubject(approval)
  run('git', ['add', '--', approval.test_path])
  mutationState.staged = true
  const staged = gitStatus()
  if (staged.stagedPaths.length !== 1 || staged.stagedPaths[0] !== approval.test_path || staged.unstagedPaths.length || staged.untrackedPaths.length) {
    throw new Error('staging did not contain only the Issue-approved test path')
  }
  plannedCommit = { parentSha: git(['rev-parse', 'HEAD']), subject }
  run('git', ['commit', '-m', subject])
  mutationState.commitSha = git(['rev-parse', 'HEAD'])
  const head = git(['rev-parse', 'HEAD'])
  const branch = git(['branch', '--show-current'])
  mutationState.pushAttempted = true
  verifyCanonicalOriginTransport()
  run('git', ['push', 'origin', `refs/heads/${branch}:refs/heads/${branch}`])
  mutationState.pushSucceeded = true
  const readback = liveRef(`refs/heads/${branch}`)
  const readbackReasons = validateRedWipReadback(head, readback)
  if (readbackReasons.length) throw new Error(readbackReasons.join('; '))
  mutationState.readbackSha = readback
  const discovery = run('pnpm', ['run', COMMAND, '--', '--help', '--json'])
  const discoveryPayload = parseJsonLine(discovery.stdout)
  if (discoveryPayload.command !== COMMAND || discoveryPayload.mode !== 'help') throw new Error('post-push registered CLI Discovery did not confirm this command')
  const context = run('pnpm', ['run', 'bemoat:context', '--', issueNumber, '--json'], { allowFailure: true })
  const contextPayload = parseJsonLine(context.stdout)
  if (context.status !== 0 || typeof contextPayload.route !== 'string' || !contextPayload.route) {
    throw new Error(`post-push fresh Context did not return an actual route: ${(context.stderr || context.stdout).trim()}`)
  }
  return { head, discovery: discoveryPayload, context: contextPayload }
}

function parseJsonLine(output: string): Record<string, unknown> {
  const line = output.trim().split(/\r?\n/).reverse().find((row) => row.startsWith('{'))
  if (!line) throw new Error('expected machine-readable JSON output')
  const value: unknown = JSON.parse(line)
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('expected a JSON object result')
  return value as Record<string, unknown>
}

function requireContextCommand(issueNumber: string) {
  const output = run('pnpm', ['run', 'bemoat:context', '--', issueNumber, '--json'], { allowFailure: true })
  const context = parseJsonLine(output.stdout)
  const next = context.next_action as Record<string, unknown> | undefined
  if (output.status !== 0 || next?.type !== 'COMMAND' || next.command !== COMMAND) {
    throw new Error('fresh Context has not authorized this exact durability-only command')
  }
  return context
}

function renderHelp(invocation: Extract<ParsedInvocation, { mode: 'help' }>) {
  if (invocation.format === 'json') process.stdout.write(`${JSON.stringify(createHelpEnvelopeV1(invocation.contract))}\n`)
  else process.stdout.write(formatTextHelp(invocation.contract))
}

function main() {
  let invocation: ParsedInvocation | null = null
  let command = COMMAND
  try {
    command = resolveCommandIdentity({ fallback: COMMAND, env: process.env, entrypoint: ENTRYPOINT })
    invocation = parseCommandInvocation(command, process.argv.slice(2))
    if (invocation.mode === 'help') return renderHelp(invocation)
    if (invocation.mode !== 'run') throw new Error('run invocation required')
    const issueNumber = String(invocation.values.issue_number)
    const approval = issueApproval(issueNumber)
    if (repositoryIdentity() !== approval.repository) throw new Error('canonical origin repository does not match Issue approval')
    if (invocation.values.verify_push === true) {
      const localSha = String(invocation.values.local_sha ?? '')
      const remoteSha = String(invocation.values.remote_sha ?? '')
      const localRef = String(invocation.values.local_ref ?? '')
      const remoteRef = String(invocation.values.remote_ref ?? '')
      if (!localSha || !remoteSha || !localRef || !remoteRef) throw new CliInvocationError('--verify-push', 'local and remote SHA/ref values are required')
      verifyBranchSafety()
      verifyPush(approval, issueNumber, localSha, remoteSha, localRef, remoteRef)
      process.stdout.write(`Verified one authorized WIP RED push for Issue #${issueNumber}.\n`)
      return
    }
    requireContextCommand(issueNumber)
    const checkpoint = createCheckpoint(approval, issueNumber)
    const result = createResultEnvelopeV1({
      command, outcome: 'SUCCESS', classification: 'SUCCESS', mutation_performed: true,
      issue_number: issueNumber, exact_head: checkpoint.head,
      next_action: { type: 'STOP', command: null, reason: `WIP RED remains incomplete. Fresh Context route: ${checkpoint.context.route}.` },
      details: {
        checkpoint_status: 'WIP RED INCOMPLETE', objective_complete: false, objective_edit_authority_granted: false,
        remote_sha_readback: checkpoint.head, actual_context_route: checkpoint.context.route,
        fresh_context: checkpoint.context, cli_discovery: checkpoint.discovery,
      },
    })
    if (invocation.format === 'json') process.stdout.write(`${JSON.stringify(result)}\n`)
    else process.stdout.write(`WIP RED: Issue #${issueNumber} pushed at ${checkpoint.head}; objective remains incomplete.\n`)
  } catch (error) {
    if (!mutationState.staged) {
      try { mutationState.staged = gitStatus().stagedPaths.length > 0 } catch { /* status unavailable */ }
    }
    if (!mutationState.commitSha && plannedCommit) {
      try {
        const head = git(['rev-parse', 'HEAD'])
        const parent = git(['rev-parse', `${head}^`])
        const subject = git(['show', '-s', '--format=%s', head])
        if (parent === plannedCommit.parentSha && subject === plannedCommit.subject) mutationState.commitSha = head
      } catch { /* the commit point remains unproven */ }
    }
    if (mutationState.commitSha) {
      try {
        const branch = git(['branch', '--show-current'])
        const remote = liveRef(`refs/heads/${branch}`)
        mutationState.readbackSha = remote
        if (remote === mutationState.commitSha) {
          mutationState.pushSucceeded = true
        }
      } catch {
        // An unavailable readback leaves the known local mutation state intact.
      }
    }
    const classification = error instanceof CliInvocationError ? error.classification : 'EVIDENCE_CONFLICT'
    const reason = error instanceof Error ? error.message : String(error)
    const result = createResultEnvelopeV1({
      command, outcome: 'STOP', classification, mutation_performed: redWipMutationPerformed(mutationState),
      issue_number: invocation?.mode === 'run' ? String(invocation.values.issue_number) : null,
      next_action: { type: 'STOP', command: null, reason }, details: {
        reason, objective_edit_authority_granted: false,
        checkpoint_status: mutationState.pushSucceeded ? 'WIP RED INCOMPLETE' : mutationState.commitSha ? 'WIP RED LOCAL COMMIT INCOMPLETE' : 'NOT_PUSHED',
        mutation_state: { ...mutationState },
      },
    })
    if (invocation?.format === 'json' || process.argv.includes('--json')) process.stdout.write(`${JSON.stringify(result)}\n`)
    else process.stderr.write(`STOP: ${reason}\n`)
    process.exitCode = classificationExitCode(classification)
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
