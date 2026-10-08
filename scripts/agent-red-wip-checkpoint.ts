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
  type RedWipApproval,
  type RedWipEvidence,
} from './context/red-wip-checkpoint.ts'

const COMMAND = 'bemoat:checkpoint:red-wip'
const ENTRYPOINT = 'scripts/agent-red-wip-checkpoint.ts'
type VitestAssertion = { status: string; fullName: string; failureMessages?: string[] }
type VitestFileResult = { name: string; assertionResults?: VitestAssertion[] }
type VitestJsonReport = { testResults?: VitestFileResult[]; numFailedTests?: number; numPassedTests?: number }

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
  const rows = run('git', ['ls-remote', 'origin', ref]).stdout.trim().split(/\r?\n/).filter(Boolean)
  if (rows.length !== 1 || !rows[0].endsWith(`\t${ref}`)) throw new Error(`live origin ref is missing or ambiguous: ${ref}`)
  return rows[0].split(/\s+/)[0]
}

function issueApproval(issueNumber: string): RedWipApproval {
  let issue: { number?: number; state?: string; body?: string }
  try {
    issue = JSON.parse(run('gh', ['issue', 'view', issueNumber, '--repo', repositoryIdentity(), '--json', 'number,state,body']).stdout) as typeof issue
  } catch {
    throw new Error('canonical Issue evidence was unavailable or malformed')
  }
  if (String(issue.number) !== issueNumber || issue.state !== 'OPEN') {
    throw new Error('canonical Issue number or state does not match the task')
  }
  return parseRedWipApproval(issue.body ?? '', issueNumber)
}

function gitStatus() {
  const records = git(['status', '--porcelain=v1', '--untracked-files=all']).split('\n').filter(Boolean)
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
  const url = git(['remote', 'get-url', 'origin'])
  const match = url.match(/^(?:https:\/\/github\.com\/|git@github\.com:)([^/]+\/[^/]+?)(?:\.git)?\/?$/i)
  if (!match) throw new Error('origin is not a canonical GitHub repository URL')
  return match[1].toLowerCase()
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
  const test = runIntegrationSuite()
  return {
    ...candidateState,
    failures: test.failures,
    totalFailed: test.totalFailed,
    totalPassed: test.totalPassed,
  }
}

function runIntegrationSuite() {
  const directory = mkdtempSync(join(tmpdir(), 'bemoat-red-wip-'))
  const output = join(directory, 'vitest.json')
  try {
    const result = run('pnpm', ['run', 'bemoat:test:int', '--', '--reporter=json', `--outputFile=${output}`], { allowFailure: true })
    let report: VitestJsonReport
    try { report = JSON.parse(readFileSync(output, 'utf8')) as VitestJsonReport } catch {
      throw new Error(`integration suite did not produce machine-readable results: ${(result.stderr || result.stdout).trim()}`)
    }
    const failures = (report.testResults ?? []).flatMap((file) => (file.assertionResults ?? [])
      .filter((assertion) => assertion.status === 'failed')
      .map((assertion) => ({
        name: assertion.fullName,
        file: relative(process.cwd(), file.name).split('\\').join('/'),
        message: (assertion.failureMessages ?? []).join('\n'),
      })))
    const failed = Number(report.numFailedTests ?? failures.length)
    const passed = Number(report.numPassedTests ?? 0)
    if (result.status !== 0 && failed === 0) throw new Error('integration test process failed without a recognized failed assertion')
    if (result.status === 0 && failed !== 0) throw new Error('integration test result is contradictory')
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
  const test = runIntegrationSuite()
  const evidence: RedWipEvidence = {
    explicitOptIn: true, issueNumber, repository: approval.repository, branch,
    upstream, localHead: remoteSha, upstreamHead,
    liveTopicHead: remoteSha, protectedBaseSha: approval.protected_base_sha,
    liveProtectedBaseSha: liveBase, protectedBaseIsAncestor: true,
    stagedPaths: [], unstagedPaths: [], untrackedPaths: [],
    failures: test.failures, totalFailed: test.totalFailed, totalPassed: test.totalPassed,
  }
  const candidateReasons = validateRedWipCandidate(approval, evidence)
  // The approved test is already committed during the hook, so validate its exact commit diff separately.
  const exactFailure = test.totalFailed === 1 && test.failures.length === 1 &&
    test.failures[0].name === approval.test_name && test.failures[0].file === approval.test_path &&
    test.failures[0].message.includes(approval.expected_message) && test.totalPassed > 0
  const otherReasons = candidateReasons.filter((reason) => !reason.includes('changes are not eligible') && !reason.includes('only the exact Issue-approved test path'))
  if (!exactFailure || otherReasons.length) throw new Error(['integration suite did not match the one approved red assertion', ...otherReasons].join('; '))
}

function createCheckpoint(approval: RedWipApproval, issueNumber: string) {
  verifyBranchSafety()
  const evidence = collectCandidate(approval, issueNumber, true)
  const reasons = validateRedWipCandidate(approval, evidence)
  if (reasons.length) throw new Error(reasons.join('; '))
  const subject = `WIP RED #${issueNumber}: ${approval.test_name}`
  run('git', ['add', '--', approval.test_path])
  const staged = gitStatus()
  if (staged.stagedPaths.length !== 1 || staged.stagedPaths[0] !== approval.test_path || staged.unstagedPaths.length || staged.untrackedPaths.length) {
    throw new Error('staging did not contain only the Issue-approved test path')
  }
  run('git', ['commit', '-m', subject])
  const head = git(['rev-parse', 'HEAD'])
  const branch = git(['branch', '--show-current'])
  run('git', ['push', 'origin', `HEAD:refs/heads/${branch}`])
  const readback = liveRef(`refs/heads/${branch}`)
  const readbackReasons = validateRedWipReadback(head, readback)
  if (readbackReasons.length) throw new Error(readbackReasons.join('; '))
  return head
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
    const head = createCheckpoint(approval, issueNumber)
    const result = createResultEnvelopeV1({
      command, outcome: 'SUCCESS', classification: 'SUCCESS', mutation_performed: true,
      issue_number: issueNumber, exact_head: head,
      next_action: { type: 'COMPLETE', command: null, reason: 'The incomplete WIP RED checkpoint was pushed and exact remote SHA readback succeeded; no objective-edit authority is granted.' },
      details: { checkpoint_status: 'WIP RED', objective_complete: false, objective_edit_authority_granted: false, remote_sha_readback: head },
    })
    if (invocation.format === 'json') process.stdout.write(`${JSON.stringify(result)}\n`)
    else process.stdout.write(`WIP RED: Issue #${issueNumber} pushed at ${head}; objective remains incomplete.\n`)
  } catch (error) {
    const classification = error instanceof CliInvocationError ? error.classification : 'EVIDENCE_CONFLICT'
    const reason = error instanceof Error ? error.message : String(error)
    const result = createResultEnvelopeV1({
      command, outcome: 'STOP', classification, mutation_performed: false,
      issue_number: invocation?.mode === 'run' ? String(invocation.values.issue_number) : null,
      next_action: { type: 'STOP', command: null, reason }, details: { reason, objective_edit_authority_granted: false },
    })
    if (invocation?.format === 'json' || process.argv.includes('--json')) process.stdout.write(`${JSON.stringify(result)}\n`)
    else process.stderr.write(`STOP: ${reason}\n`)
    process.exitCode = classificationExitCode(classification)
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
