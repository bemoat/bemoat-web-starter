import { mkdtempSync, readFileSync, rmSync, writeFileSync, symlinkSync, cpSync, chmodSync, mkdirSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { getCommandContract } from '../../scripts/cli/command-contract.ts'
import { runCliBoundaryCase } from '../helpers/cli-boundary-harness'
import {
  parseRedWipApproval,
  validateRedWipCandidate,
  validateRedWipPush,
  validateRedWipReadback,
  type RedWipApproval,
  type RedWipEvidence,
} from '../../scripts/context/red-wip-checkpoint.ts'

const sha = '1'.repeat(40)
const issueNumber = '617'
const repository = 'bemoat/bemoat-web-starter'
const branch = 'fix/617-red-test-wip-recovery'
const testPath = 'tests/int/example.int.spec.ts'
const testName = 'approved expected regression'
const expectedMessage = 'expected recovery to preserve the failing assertion'

function approval(): RedWipApproval {
  return {
    schema_version: 1,
    issue_number: issueNumber,
    repository,
    branch,
    protected_base_sha: sha,
    test_path: testPath,
    expected_failures: [{ test_name: testName, expected_message: expectedMessage }],
  }
}

function evidence(overrides: Partial<RedWipEvidence> = {}): RedWipEvidence {
  return {
    explicitOptIn: true,
    issueNumber,
    repository,
    branch,
    upstream: `origin/${branch}`,
    localHead: sha,
    upstreamHead: sha,
    liveTopicHead: sha,
    protectedBaseSha: sha,
    liveProtectedBaseSha: sha,
    protectedBaseIsAncestor: true,
    stagedPaths: [],
    unstagedPaths: [testPath],
    untrackedPaths: [],
    failures: [{ name: testName, file: testPath, message: expectedMessage }],
    totalFailed: 1,
    totalPassed: 42,
    ...overrides,
  }
}

// Oracle authority: Issue #617's acceptance criteria require task-owned authorized RED
// preservation with truthful WIP status and fail-closed behavior for wrong identity,
// stale/divergent, unrelated, forbidden, or ambiguous states. The human-approved
// implementation task narrows this to an explicit registered utility and independent
// pre-push revalidation; Context routing and ordinary green checkpoints remain unchanged.
describe('authorized RED WIP checkpoint boundary', () => {
  it('adds an independent pre-push verifier for a labeled RED WIP commit', () => {
    const hook = readFileSync('.githooks/pre-push', 'utf8')

    expect(hook).toContain('bemoat:checkpoint:red-wip')
    expect(hook).toMatch(/WIP RED/)
    expect(hook).toContain('bemoat:test:int')
  })

  it('registers machine-readable mutation-free help for explicit discovery', () => {
    const contract = getCommandContract('bemoat:checkpoint:red-wip')
    expect(contract).toMatchObject({
      command: 'bemoat:checkpoint:red-wip',
      tier: 'A',
      help_meaningful: true,
      safe_help_invocation: 'pnpm run bemoat:checkpoint:red-wip -- --help --json',
    })
    const result = runCliBoundaryCase({
      entrypoint: 'scripts/agent-red-wip-checkpoint.ts',
      argv: ['--help', '--json'],
      env: {
        BEMOAT_FACADE_COMMAND: 'bemoat:checkpoint:red-wip',
        BEMOAT_FACADE_ENTRYPOINT: 'scripts/agent-red-wip-checkpoint.ts',
        npm_lifecycle_event: 'bemoat:checkpoint:red-wip',
      },
    })
    expect(result.status).toBe(0)
    expect(result.filesystem_unchanged).toBe(true)
    expect(JSON.parse(result.stdout)).toMatchObject({ command: 'bemoat:checkpoint:red-wip', mode: 'help' })
  })

  it('accepts only the authorized, exact intentionally red oracle as WIP', () => {
    expect(validateRedWipCandidate(approval(), evidence())).toEqual([])
  })

  it('requires exact equality with the Issue-approved finite assertion set', () => {
    const expected = Array.from({ length: 7 }, (_, index) => ({
      test_name: `approved story ${index + 1}`,
      expected_message: `expected outcome ${index + 1}`,
    }))
    const approved = { ...approval(), expected_failures: expected } as RedWipApproval
    const failures = expected.map((item) => ({ name: item.test_name, file: testPath, message: item.expected_message }))
    expect(validateRedWipCandidate(approved, evidence({ failures, totalFailed: 7 }))).toEqual([])
    expect(validateRedWipCandidate(approved, evidence({ failures: failures.slice(0, 6), totalFailed: 6 }))).not.toEqual([])
    expect(validateRedWipCandidate(approved, evidence({ failures: [...failures, { name: 'extra', file: testPath, message: 'unexpected' }], totalFailed: 8 }))).not.toEqual([])
    expect(validateRedWipCandidate(approved, evidence({ failures: [...failures.slice(0, 6), failures[0]!], totalFailed: 7 }))).not.toEqual([])
  })

  it('rejects ambiguous or inferred approval sets', () => {
    const body = `<!-- BEMOAT_RED_WIP_APPROVAL\n${JSON.stringify(approval())}\n-->`
    expect(parseRedWipApproval(body, issueNumber)).toEqual(approval())
    expect(() => parseRedWipApproval(`<!-- BEMOAT_RED_WIP_APPROVAL\n${JSON.stringify({ ...approval(), expected_failures: [] })}\n-->`, issueNumber)).toThrow(/shape/i)
    expect(() => parseRedWipApproval(`<!-- BEMOAT_RED_WIP_APPROVAL\n${JSON.stringify({ ...approval(), expected_failures: [approval().expected_failures[0], approval().expected_failures[0]] })}\n-->`, issueNumber)).toThrow(/duplicate/i)
  })

  it.each([
    ['unexpected extra failure', { totalFailed: 2 }],
    ['wrong assertion', { failures: [{ name: 'different test', file: testPath, message: expectedMessage }] }],
    ['wrong Issue', { issueNumber: '618' }],
    ['wrong branch', { branch: 'fix/618-other' }],
    ['stale remote head', { liveTopicHead: '2'.repeat(40) }],
    ['stale protected base', { liveProtectedBaseSha: '3'.repeat(40) }],
    ['unrelated staged content', { stagedPaths: ['README.md'] }],
    ['unrelated unstaged content', { unstagedPaths: [testPath, 'README.md'] }],
    ['untracked content', { untrackedPaths: ['.env'] }],
    ['missing explicit opt-in', { explicitOptIn: false }],
  ])('stops for %s', (_label, overrides) => {
    expect(validateRedWipCandidate(approval(), evidence(overrides as Partial<RedWipEvidence>)).length).toBeGreaterThan(0)
  })

  it('requires exactly one Issue-authorized approval block with the same Issue identity', () => {
    const body = `<!-- BEMOAT_RED_WIP_APPROVAL\n${JSON.stringify(approval())}\n-->`
    expect(parseRedWipApproval(body, issueNumber)).toEqual(approval())
    expect(() => parseRedWipApproval(body, '618')).toThrow(/wrong identity/)
    expect(() => parseRedWipApproval(`${body}\n${body}`, issueNumber)).toThrow(/exactly one/)
    expect(() => parseRedWipApproval(`${body}\n<!-- BEMOAT_RED_WIP_APPROVAL malformed`, issueNumber)).toThrow(/exactly one/)
    expect(() => parseRedWipApproval(`<!-- BEMOAT_RED_WIP_APPROVAL\n${JSON.stringify({ ...approval(), test_path: '.env' })}\n-->`, issueNumber)).toThrow(/path/)
  })

  it('allows the hook exception only for one newly pushed exact WIP RED commit', () => {
    const valid = {
      approval: approval(), issueNumber, repository, branch,
      localSha: '4'.repeat(40), remoteSha: '5'.repeat(40), parentSha: '5'.repeat(40),
      localRef: `refs/heads/${branch}`, remoteRef: `refs/heads/${branch}`,
      commitSubject: `WIP RED #${issueNumber}: ${testName}`,
      changedPaths: [testPath], pushedCommitCount: 1,
    }
    expect(validateRedWipPush(valid)).toEqual([])
    expect(validateRedWipPush({ ...valid, pushedCommitCount: 2 })).not.toEqual([])
    expect(validateRedWipPush({ ...valid, remoteSha: '6'.repeat(40) })).not.toEqual([])
    expect(validateRedWipPush({ ...valid, changedPaths: [testPath, 'README.md'] })).not.toEqual([])
    expect(validateRedWipPush({ ...valid, remoteRef: 'refs/heads/other' })).not.toEqual([])
  })

  it('keeps ordinary green pushes on the standard full integration gate', () => {
    const hook = readFileSync('.githooks/pre-push', 'utf8')
    expect(hook).toContain('pnpm run bemoat:test:int')
  })

  it('requires exact live remote SHA readback after the WIP push', () => {
    expect(validateRedWipReadback(sha, sha)).toEqual([])
    expect(validateRedWipReadback(sha, '9'.repeat(40))).not.toEqual([])
  })

  it('runs the registered command and pre-push hook against a disposable bare remote', () => {
    const root = mkdtempSync(join(tmpdir(), 'red-wip-command-fixture-'))
    const repo = join(root, 'repo')
    const bare = join(root, 'remote.git')
    const bin = join(root, 'bin')
    const fixtureApproval = {
      ...approval(),
      expected_failures: [
        { test_name: 'approved story one', expected_message: 'approved outcome one' },
        { test_name: 'approved story two', expected_message: 'approved outcome two' },
      ],
    }
    const failures = fixtureApproval.expected_failures.map((item) => ({ name: item.test_name, file: testPath, message: item.expected_message }))
    const env = {
      ...process.env,
      PATH: `${bin}:${process.env.PATH}`,
      FIXTURE_ISSUE: issueNumber,
      FIXTURE_APPROVAL: `<!-- BEMOAT_RED_WIP_APPROVAL\n${JSON.stringify(fixtureApproval)}\n-->`,
      FIXTURE_REPORT: JSON.stringify({ numFailedTests: failures.length, numPassedTests: 10, testResults: [{ name: testPath, assertionResults: failures.map((item) => ({ status: 'failed', fullName: item.name, failureMessages: [item.message] })) }] }),
      FIXTURE_ISSUE_DATA: JSON.stringify({ number: Number(issueNumber), state: 'OPEN', body: `<!-- BEMOAT_RED_WIP_APPROVAL\n${JSON.stringify(fixtureApproval)}\n-->` }),
      FIXTURE_CONTEXT_COUNT: join(root, 'context-count'),
    }
    const git = (args: string[], cwd = repo) => {
      const result = spawnSync('git', args, { cwd, env, encoding: 'utf8' })
      if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`)
      return result.stdout.trim()
    }
    try {
      cpSync(process.cwd(), repo, { recursive: true, filter: (path) => !/(^|\/)(\.git|node_modules|\.next|coverage)(\/|$)/.test(path) })
      mkdirSync(bin)
      symlinkSync(join(process.cwd(), 'node_modules'), join(repo, 'node_modules'), 'dir')
      chmodSync(join(repo, '.githooks/pre-push'), 0o755)
      chmodSync(join(repo, '.githooks/pre-commit'), 0o755)
      writeFileSync(join(bin, 'pnpm'), `#!/usr/bin/env node
const fs = require('node:fs')
const { spawnSync } = require('node:child_process')
const args = process.argv.slice(2)
if (args[0] === 'run') args.shift()
const command = args.shift()
if (command === 'bemoat:guard:safety') process.exit(0)
if (command === 'bemoat:test:int') {
  const reportArg = args.find((arg) => arg.startsWith('--outputFile='))
  if (reportArg) { fs.writeFileSync(reportArg.slice('--outputFile='.length), process.env.FIXTURE_REPORT); process.exit(1) }
  process.exit(0)
}
if (command === 'bemoat:context') {
  let count = 0
  try { count = Number(fs.readFileSync(process.env.FIXTURE_CONTEXT_COUNT, 'utf8')) } catch {}
  count += 1
  fs.writeFileSync(process.env.FIXTURE_CONTEXT_COUNT, String(count))
  process.stdout.write(count === 1 ? '{"route":"STOP","next_action":{"type":"COMMAND","command":"bemoat:checkpoint:red-wip"}}\\n' : '{"route":"STOP","next_action":{"type":"STOP","command":null}}\\n')
  process.exit(0)
}
if (command === 'bemoat:checkpoint:red-wip') {
  if (args[0] === '--') args.shift()
  const result = spawnSync('node', ['scripts/agent-red-wip-checkpoint.ts', ...args], { stdio: 'inherit', env: { ...process.env, BEMOAT_FACADE_COMMAND: command, BEMOAT_FACADE_ENTRYPOINT: 'scripts/agent-red-wip-checkpoint.ts', npm_lifecycle_event: command } })
  process.exit(result.status ?? 1)
}
process.stderr.write('unexpected pnpm invocation: ' + command + '\\n')
process.exit(97)
`)
      writeFileSync(join(bin, 'gh'), `#!/usr/bin/env node\nprocess.stdout.write(process.env.FIXTURE_ISSUE_DATA + '\\n')\n`)
      chmodSync(join(bin, 'pnpm'), 0o755)
      chmodSync(join(bin, 'gh'), 0o755)
      spawnSync('git', ['init', '--bare', bare], { cwd: root, env, stdio: 'ignore' })
      git(['init', '-b', 'main'])
      git(['config', 'user.email', 'fixture@example.invalid'])
      git(['config', 'user.name', 'Fixture'])
      git(['remote', 'add', 'origin', 'https://github.com/bemoat/bemoat-web-starter.git'])
      git(['config', `url.file://${bare}.insteadOf`, 'https://github.com/bemoat/bemoat-web-starter.git'])
      git(['config', 'core.hooksPath', '.githooks'])
      writeFileSync(join(repo, testPath), 'fixture baseline\n')
      git(['add', '-A'])
      git(['-c', 'core.hooksPath=/dev/null', 'commit', '-m', 'fixture base'])
      const base = git(['rev-parse', 'HEAD'])
      git(['-c', 'core.hooksPath=/dev/null', 'push', '-u', 'origin', 'main'])
      git(['checkout', '-b', branch])
      git(['push', '-u', 'origin', branch])
      fixtureApproval.protected_base_sha = base
      env.FIXTURE_APPROVAL = `<!-- BEMOAT_RED_WIP_APPROVAL\n${JSON.stringify(fixtureApproval)}\n-->`
      env.FIXTURE_ISSUE_DATA = JSON.stringify({ number: Number(issueNumber), state: 'OPEN', body: env.FIXTURE_APPROVAL })
      writeFileSync(join(repo, testPath), 'fixture intentionally red change\n')
      const runCandidate = () => spawnSync('node', ['scripts/agent-red-wip-checkpoint.ts', issueNumber, '--json'], {
        cwd: repo, env: { ...env, BEMOAT_FACADE_COMMAND: 'bemoat:checkpoint:red-wip', BEMOAT_FACADE_ENTRYPOINT: 'scripts/agent-red-wip-checkpoint.ts', npm_lifecycle_event: 'bemoat:checkpoint:red-wip' }, encoding: 'utf8',
      })
      git(['config', 'remote.origin.url', 'https://github.com/example/not-the-approved-repo.git'])
      const wrongOrigin = runCandidate()
      expect(wrongOrigin.status).not.toBe(0)
      expect(JSON.parse(wrongOrigin.stdout)).toMatchObject({ outcome: 'STOP', mutation_performed: false })
      git(['config', 'remote.origin.url', 'https://github.com/bemoat/bemoat-web-starter.git'])
      writeFileSync(join(repo, 'fixture-secret.txt'), 'fixture secret path must be rejected\n')
      const untrackedSecret = runCandidate()
      expect(untrackedSecret.status).not.toBe(0)
      expect(JSON.parse(untrackedSecret.stdout)).toMatchObject({ outcome: 'STOP', mutation_performed: false })
      unlinkSync(join(repo, 'fixture-secret.txt'))
      unlinkSync(env.FIXTURE_CONTEXT_COUNT)
      env.FIXTURE_REPORT = JSON.stringify({ numFailedTests: 3, numPassedTests: 10, testResults: [{ name: testPath, assertionResults: [...failures, { name: 'unexpected assertion', file: testPath, message: 'unapproved result' }].map((item) => ({ status: 'failed', fullName: item.name, failureMessages: [item.message] })) }] })
      const extraFailure = runCandidate()
      expect(extraFailure.status).not.toBe(0)
      expect(JSON.parse(extraFailure.stdout)).toMatchObject({ outcome: 'STOP', mutation_performed: false })
      unlinkSync(env.FIXTURE_CONTEXT_COUNT)
      env.FIXTURE_REPORT = JSON.stringify({ numFailedTests: failures.length, numPassedTests: 10, testResults: [{ name: testPath, assertionResults: failures.map((item) => ({ status: 'failed', fullName: item.name, failureMessages: [item.message] })) }] })
      const result = runCandidate()
      expect(result.status, `${result.stderr || result.stdout}\n${git(['status', '--porcelain=v1', '--untracked-files=all'])}`).toBe(0)
      expect(JSON.parse(result.stdout)).toMatchObject({
        outcome: 'SUCCESS', mutation_performed: true,
        details: { checkpoint_status: 'WIP RED INCOMPLETE', objective_complete: false, actual_context_route: 'STOP' },
      })
      const pushed = spawnSync('git', ['ls-remote', 'origin', `refs/heads/${branch}`], { cwd: repo, env, encoding: 'utf8' }).stdout.trim().split(/\s+/)[0]
      expect(pushed).toBe(git(['rev-parse', 'HEAD']))
      writeFileSync(join(repo, 'README.md'), `${readFileSync(join(repo, 'README.md'), 'utf8')}\nfixture ordinary green push\n`)
      git(['add', 'README.md'])
      git(['commit', '-m', 'fixture ordinary green checkpoint'])
      const greenPush = spawnSync('git', ['push', 'origin', branch], { cwd: repo, env, encoding: 'utf8' })
      expect(greenPush.status, greenPush.stderr || greenPush.stdout).toBe(0)
      expect(greenPush.stderr + greenPush.stdout).toContain('running integration tests')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  }, 30_000)
})
