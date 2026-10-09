import { mkdtempSync, readFileSync, rmSync, writeFileSync, symlinkSync, cpSync, chmodSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { getCommandContract } from '../../scripts/cli/command-contract.ts'
import { runCliBoundaryCase } from '../helpers/cli-boundary-harness'
import {
  parseRedWipApproval,
  validateCanonicalOriginTransport,
  validateRedWipSuiteReport,
  validateRedWipRunnerTaskReport,
  createRedWipMutationState,
  redWipMutationPerformed,
  validateRedWipCandidate,
  validateRedWipPush,
  validateRedWipReadback,
  type RedWipApproval,
  type RedWipEvidence,
  type RedWipSuiteReport,
  type RedWipRunnerTaskReport,
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

  it('forwards an exact test filter through real pnpm and produces consumable reports', () => {
    const root = mkdtempSync(join(tmpdir(), 'red-wip-pnpm-boundary-'))
    const repo = join(root, 'repo')
    const suiteOutput = join(root, 'vitest.json')
    const taskOutput = join(root, 'vitest-task-errors.json')
    const selectedName = 'registers machine-readable mutation-free help for explicit discovery'
    try {
      cpSync(process.cwd(), repo, { recursive: true, filter: (path) => !/(^|\/)(\.git|node_modules|\.next|coverage)(\/|$)/.test(path) })
      symlinkSync(join(process.cwd(), 'node_modules'), join(repo, 'node_modules'), 'dir')
      const result = spawnSync('pnpm', [
        'run', 'bemoat:test:int', '--reporter=json', '--reporter=./scripts/context/red-wip-checkpoint.ts',
        `--outputFile=${suiteOutput}`, `--testNamePattern=${selectedName}`, 'tests/int/red-wip-checkpoint.int.spec.ts',
      ], {
        cwd: repo, encoding: 'utf8', timeout: 60_000,
        env: { ...process.env, BEMOAT_RED_WIP_TASK_REPORT: taskOutput },
      })
      expect(result.status, `${result.stderr || result.stdout}`).toBe(0)
      const suiteReport = JSON.parse(readFileSync(suiteOutput, 'utf8')) as {
        testResults: Array<{ name: string; status: string; assertionResults: Array<{ status: string; fullName: string; failureMessages?: string[] }> }>
        numFailedTests: number; numPassedTests: number; numFailedTestSuites: number; unhandledErrors?: unknown[]
      }
      const taskReport = JSON.parse(readFileSync(taskOutput, 'utf8')) as RedWipRunnerTaskReport
      expect(suiteReport.testResults).toHaveLength(1)
      expect(suiteReport.testResults[0]!.name.replace(/\\/g, '/')).toMatch(/\/tests\/int\/red-wip-checkpoint\.int\.spec\.ts$/)
      expect(suiteReport.numPassedTests).toBe(1)
      expect(suiteReport.numFailedTests).toBe(0)
      const selectedAssertions = suiteReport.testResults[0]!.assertionResults.filter((assertion) => assertion.fullName.includes(selectedName))
      expect(selectedAssertions).toHaveLength(1)
      expect(selectedAssertions[0]!.status).toBe('passed')
      expect(suiteReport.testResults[0]!.assertionResults.filter((assertion) => assertion.status === 'passed')).toHaveLength(1)
      expect(suiteReport.testResults[0]!.assertionResults.every((assertion) =>
        assertion.fullName.includes(selectedName) || ['skipped', 'pending', 'todo'].includes(assertion.status),
      )).toBe(true)
      expect(validateRedWipSuiteReport({ ...approval(), expected_failures: [] }, {
        numFailedTests: suiteReport.numFailedTests,
        numPassedTests: suiteReport.numPassedTests,
        numFailedTestSuites: suiteReport.numFailedTestSuites,
        unhandledErrors: suiteReport.unhandledErrors,
        suites: suiteReport.testResults.map((file) => ({
          file: 'tests/int/red-wip-checkpoint.int.spec.ts', status: file.status,
          assertions: file.assertionResults.map((assertion) => ({ status: assertion.status, name: assertion.fullName, message: (assertion.failureMessages ?? []).join('\n') })),
        })),
      })).toEqual([])
      expect(validateRedWipRunnerTaskReport({ ...approval(), expected_failures: [] }, taskReport)).toEqual([])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  }, 70_000)

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

  it('accepts only the exact canonical fetch and push transport URLs', () => {
    const canonical = 'https://github.com/bemoat/bemoat-web-starter.git'
    expect(validateCanonicalOriginTransport({ configuredFetchUrls: [canonical], configuredPushUrls: [], effectiveFetchUrls: [canonical], effectivePushUrls: [canonical] })).toEqual([])
    expect(validateCanonicalOriginTransport({ configuredFetchUrls: [canonical], configuredPushUrls: [], effectiveFetchUrls: ['file:///tmp/remote.git'], effectivePushUrls: ['file:///tmp/remote.git'] })).not.toEqual([])
    expect(validateCanonicalOriginTransport({ configuredFetchUrls: [canonical], configuredPushUrls: ['file:///tmp/remote.git'], effectiveFetchUrls: [canonical], effectivePushUrls: ['file:///tmp/remote.git'] })).not.toEqual([])
  })

  it('accepts nested describe failures when Vitest suite count exceeds failed file rows', () => {
    const nested = {
      numFailedTests: 1, numPassedTests: 10, numFailedTestSuites: 5,
      suites: [{ file: testPath, status: 'failed', assertions: [{ status: 'failed', name: testName, message: expectedMessage }] }],
    }
    expect(validateRedWipSuiteReport(approval(), nested)).toEqual([])
  })

  it('rejects a nested hook error beside the exact approved assertion failures', () => {
    const suiteReport = {
      numFailedTests: 1, numPassedTests: 10, numFailedTestSuites: 2,
      suites: [{ file: testPath, status: 'failed', assertions: [{ status: 'failed', name: testName, message: expectedMessage }] }],
    }
    const taskReport: RedWipRunnerTaskReport = {
      unhandledErrors: [],
      tasks: [{
        type: 'module', name: testPath, fullName: '', state: 'failed', errors: [],
        children: [{
          type: 'suite', name: 'outer', fullName: '', state: 'failed', errors: [],
          children: [
            { type: 'test', name: testName, fullName: testName, state: 'failed', errors: [expectedMessage], children: [] },
            { type: 'suite', name: 'nested', fullName: '', state: 'failed', errors: ['nested beforeAll hook failed'], children: [] },
          ],
        }],
      }],
    }
    const mutationState = createRedWipMutationState()
    expect(validateRedWipSuiteReport(approval(), suiteReport)).toEqual([])
    expect(validateRedWipRunnerTaskReport(approval(), taskReport)).not.toEqual([])
    expect(redWipMutationPerformed(mutationState)).toBe(false)
  })

  it('rejects suite setup failures beside an otherwise approved RED assertion set', () => {
    const suite: RedWipSuiteReport = {
      numFailedTests: 1, numPassedTests: 10, numFailedTestSuites: 5,
      suites: [
        { file: testPath, status: 'failed', assertions: [{ status: 'failed', name: testName, message: expectedMessage }] },
        { file: 'tests/int/unrelated.int.spec.ts', status: 'failed', assertions: [], error: 'collection failed: missing setup module' },
      ],
    }
    const mutationState = createRedWipMutationState()
    expect(validateRedWipSuiteReport(approval(), suite)).not.toEqual([])
    expect(redWipMutationPerformed(mutationState)).toBe(false)
    expect(validateRedWipSuiteReport(approval(), { ...suite, suites: suite.suites.slice(0, 1), numFailedTestSuites: 5 })).toEqual([])
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
    const realGit = spawnSync('which', ['git'], { encoding: 'utf8' }).stdout.trim()
    const realPnpm = spawnSync('which', ['pnpm'], { encoding: 'utf8' }).stdout.trim()
    const fixtureApproval = {
      ...approval(),
      expected_failures: [
        { test_name: 'approved story one', expected_message: 'approved outcome one' },
        { test_name: 'approved story two', expected_message: 'approved outcome two' },
      ],
    }
    const failures = fixtureApproval.expected_failures.map((item) => ({ name: item.test_name, file: testPath, message: item.expected_message }))
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      PATH: `${bin}:${process.env.PATH}`,
      GIT_CONFIG_GLOBAL: join(root, 'global.gitconfig'),
      FIXTURE_ISSUE_DATA: JSON.stringify({ number: Number(issueNumber), state: 'OPEN', body: `<!-- BEMOAT_RED_WIP_APPROVAL\n${JSON.stringify(fixtureApproval)}\n-->` }),
      FIXTURE_CONTEXT_COUNT: join(root, 'context-count'),
      FIXTURE_LAST_TEST_ARGS: join(root, 'test-args.json'),
      FIXTURE_CAPTURE_SUITE: join(root, 'captured-vitest.json'),
      FIXTURE_CAPTURE_TASK: join(root, 'captured-task.json'),
      FIXTURE_REAL_GIT: realGit,
      FIXTURE_REAL_PNPM: realPnpm,
      FIXTURE_BARE_REMOTE: bare,
      FIXTURE_HOOK: join(repo, '.githooks/pre-push'),
    }
    const git = (args: string[], cwd = repo) => {
      const result = spawnSync(realGit, args, { cwd, env, encoding: 'utf8' })
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
  fs.writeFileSync(process.env.FIXTURE_LAST_TEST_ARGS, JSON.stringify(args))
  if (process.env.FIXTURE_REPORT_MODE === 'real-report') {
    if (args[0] === '--') process.exit(97)
    const result = spawnSync(process.env.FIXTURE_REAL_PNPM, [
      'run', command, ...args,
      '--testNamePattern=approved story one|approved story two|approved supporting pass',
      'tests/int/example.int.spec.ts',
    ], { cwd: process.cwd(), env: process.env, encoding: 'utf8' })
    const outputArg = args.find((arg) => arg.startsWith('--outputFile='))
    if (outputArg && fs.existsSync(outputArg.slice('--outputFile='.length))) fs.copyFileSync(outputArg.slice('--outputFile='.length), process.env.FIXTURE_CAPTURE_SUITE)
    if (fs.existsSync(process.env.BEMOAT_RED_WIP_TASK_REPORT)) fs.copyFileSync(process.env.BEMOAT_RED_WIP_TASK_REPORT, process.env.FIXTURE_CAPTURE_TASK)
    if (result.stdout) process.stdout.write(result.stdout)
    if (result.stderr) process.stderr.write(result.stderr)
    process.exit(result.status ?? 1)
  }
  const reportArg = args.find((arg) => arg.startsWith('--outputFile='))
  if (reportArg) {
    const reportPath = reportArg.slice('--outputFile='.length)
    if (process.env.FIXTURE_REPORT_MODE === 'missing-suite') process.exit(1)
    fs.writeFileSync(reportPath, process.env.FIXTURE_REPORT_MODE === 'malformed-suite' ? '{' : process.env.FIXTURE_REPORT)
    if (process.env.FIXTURE_REPORT_MODE !== 'missing-task') {
      fs.writeFileSync(process.env.BEMOAT_RED_WIP_TASK_REPORT, process.env.FIXTURE_REPORT_MODE === 'malformed-task' ? '{' : process.env.FIXTURE_TASK_REPORT)
    }
    process.exit(1)
  }
  process.exit(0)
}
if (command === 'bemoat:context') {
  let count = 0
  try { count = Number(fs.readFileSync(process.env.FIXTURE_CONTEXT_COUNT, 'utf8')) } catch {}
  count += 1
  fs.writeFileSync(process.env.FIXTURE_CONTEXT_COUNT, String(count))
  process.stdout.write(count < 8 ? '{"route":"STOP","next_action":{"type":"COMMAND","command":"bemoat:checkpoint:red-wip"}}\\n' : '{"route":"STOP","next_action":{"type":"STOP","command":null}}\\n')
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
      writeFileSync(join(bin, 'git'), `#!/usr/bin/env node
const { spawnSync } = require('node:child_process')
const args = process.argv.slice(2)
const real = process.env.FIXTURE_REAL_GIT
const bare = process.env.FIXTURE_BARE_REMOTE
const call = (argv, options = {}) => spawnSync(real, argv, { cwd: process.cwd(), env: process.env, encoding: 'utf8', ...options })
const write = (value) => { if (value.stdout) process.stdout.write(value.stdout); if (value.stderr) process.stderr.write(value.stderr) }
if (args[0] === 'ls-remote' && args[1] === 'origin') {
  const result = call(['ls-remote', bare, ...args.slice(2)]); write(result); process.exit(result.status ?? 1)
}
if (args[0] === 'push' && args[1] === 'origin') {
  const refs = args.slice(2).filter((arg) => !arg.startsWith('-'))
  const spec = refs.find((arg) => arg.includes(':')) || refs[refs.length - 1]
  if (!spec) process.exit(98)
  const [localSpec, remoteSpec] = spec.includes(':') ? spec.split(':', 2) : [spec, 'refs/heads/' + spec]
  const localRef = localSpec.startsWith('refs/') ? localSpec : 'refs/heads/' + localSpec
  const localSha = call(['rev-parse', localRef]).stdout.trim()
  const remoteRef = remoteSpec.startsWith('refs/') ? remoteSpec : 'refs/heads/' + remoteSpec
  const remoteRow = call(['ls-remote', bare, remoteRef]).stdout.trim()
  const remoteSha = remoteRow ? remoteRow.split(/\\s+/)[0] : '0000000000000000000000000000000000000000'
  const hook = spawnSync('sh', [process.env.FIXTURE_HOOK, 'origin', 'https://github.com/bemoat/bemoat-web-starter.git'], {
    cwd: process.cwd(), env: process.env, encoding: 'utf8',
    input: [localRef, localSha, remoteRef, remoteSha].join(' ') + '\\n',
  })
  write(hook)
  if (hook.status !== 0) process.exit(hook.status ?? 1)
  const push = call(['-c', 'core.hooksPath=/dev/null', 'push', bare, ...refs])
  write(push); process.exit(push.status ?? 1)
}
const result = call(args); write(result); process.exit(result.status ?? 1)
`)
      writeFileSync(join(bin, 'gh'), `#!/usr/bin/env node\nprocess.stdout.write(process.env.FIXTURE_ISSUE_DATA + '\\n')\n`)
      chmodSync(join(bin, 'pnpm'), 0o755)
      chmodSync(join(bin, 'git'), 0o755)
      chmodSync(join(bin, 'gh'), 0o755)
      spawnSync(realGit, ['init', '--bare', bare], { cwd: root, env, stdio: 'ignore' })
      git(['init', '-b', 'main'])
      git(['config', 'user.email', 'fixture@example.invalid'])
      git(['config', 'user.name', 'Fixture'])
      writeFileSync(join(repo, testPath), 'fixture baseline\n')
      git(['add', '-A'])
      git(['-c', 'core.hooksPath=/dev/null', 'commit', '-m', 'fixture base'])
      const base = git(['rev-parse', 'HEAD'])
      git(['-c', 'core.hooksPath=/dev/null', 'push', bare, 'main:refs/heads/main'])
      git(['remote', 'add', 'origin', 'https://github.com/bemoat/bemoat-web-starter.git'])
      git(['checkout', '-b', branch])
      git(['-c', 'core.hooksPath=/dev/null', 'push', bare, `${branch}:refs/heads/${branch}`])
      git(['update-ref', `refs/remotes/origin/${branch}`, base])
      git(['config', `branch.${branch}.remote`, 'origin'])
      git(['config', `branch.${branch}.merge`, `refs/heads/${branch}`])
      git(['config', 'core.hooksPath', '.githooks'])
      fixtureApproval.protected_base_sha = base
      env.FIXTURE_ISSUE_DATA = JSON.stringify({
        number: Number(issueNumber), state: 'OPEN',
        body: `<!-- BEMOAT_RED_WIP_APPROVAL\n${JSON.stringify(fixtureApproval)}\n-->`,
      })
      writeFileSync(join(repo, 'README.md'), `${readFileSync(join(repo, 'README.md'), 'utf8')}\nfixture ordinary green push\n`)
      git(['add', 'README.md'])
      git(['commit', '-m', 'fixture ordinary green checkpoint'])
      const greenPush = spawnSync('git', ['push', 'origin', `${branch}:refs/heads/${branch}`], { cwd: repo, env, encoding: 'utf8' })
      expect(greenPush.status, greenPush.stderr || greenPush.stdout).toBe(0)
      expect(greenPush.stderr + greenPush.stdout).toContain('running integration tests')
      const greenHead = git(['rev-parse', 'HEAD'])
      git(['update-ref', `refs/remotes/origin/${branch}`, greenHead])
      writeFileSync(join(repo, testPath), `import { expect, it } from 'vitest'

it('approved story one', () => { throw new Error('approved outcome one') })
it('approved story two', () => { throw new Error('approved outcome two') })
it('approved supporting pass', () => { expect(true).toBe(true) })
`)
      const runCandidate = () => spawnSync('node', ['scripts/agent-red-wip-checkpoint.ts', issueNumber, '--json'], {
        cwd: repo, env: { ...env, BEMOAT_FACADE_COMMAND: 'bemoat:checkpoint:red-wip', BEMOAT_FACADE_ENTRYPOINT: 'scripts/agent-red-wip-checkpoint.ts', npm_lifecycle_event: 'bemoat:checkpoint:red-wip' }, encoding: 'utf8',
      })
      git(['config', '--global', `url.file://${bare}.insteadOf`, 'https://github.com/bemoat/bemoat-web-starter.git'])
      const redirectedOrigin = runCandidate()
      expect(redirectedOrigin.status).not.toBe(0)
      expect(JSON.parse(redirectedOrigin.stdout)).toMatchObject({ outcome: 'STOP', mutation_performed: false })
      expect(JSON.parse(redirectedOrigin.stdout).details.reason).toContain('transport')
      expect(git(['rev-parse', 'HEAD'])).toBe(greenHead)
      const remoteBefore = spawnSync(realGit, ['ls-remote', bare, `refs/heads/${branch}`], { cwd: repo, env, encoding: 'utf8' }).stdout.trim().split(/\s+/)[0]
      expect(remoteBefore).toBe(greenHead)
      git(['config', '--global', '--unset-all', `url.file://${bare}.insteadOf`])

      const approvedReport = JSON.stringify({
        numFailedTests: failures.length, numPassedTests: 10, numFailedTestSuites: 5,
        testResults: [{ name: testPath, status: 'failed', assertionResults: failures.map((item) => ({ status: 'failed', fullName: item.name, failureMessages: [item.message] })) }],
      })
      env.FIXTURE_REPORT = approvedReport
      const taskReport = (includeNestedHookError: boolean) => {
        const childTasks: RedWipRunnerTaskReport['tasks'][number]['children'] = failures.map((item) => ({
          type: 'test', name: item.name, fullName: item.name, state: 'failed', errors: [item.message],
          children: [] as RedWipRunnerTaskReport['tasks'][number]['children'],
        }))
        if (includeNestedHookError) childTasks.push({
          type: 'suite', name: 'nested suite with hook failure', fullName: '', state: 'failed',
          errors: ['nested beforeAll hook failed'], children: [] as RedWipRunnerTaskReport['tasks'][number]['children'],
        })
        return JSON.stringify({
          unhandledErrors: [],
          tasks: [{ type: 'module', name: testPath, fullName: '', state: 'failed', errors: [], children: childTasks }],
        })
      }
      env.FIXTURE_TASK_REPORT = taskReport(true)
      const hookError = runCandidate()
      expect(hookError.status).not.toBe(0)
      expect(JSON.parse(hookError.stdout)).toMatchObject({ outcome: 'STOP', mutation_performed: false })
      expect(JSON.parse(hookError.stdout).details.reason).toContain('module or suite hook')
      expect(git(['rev-parse', 'HEAD'])).toBe(greenHead)

      for (const [mode, reason] of [
        ['missing-suite', 'machine-readable results'],
        ['malformed-suite', 'machine-readable results'],
        ['missing-task', 'full Vitest task error report'],
        ['malformed-task', 'full Vitest task error report'],
      ]) {
        env.FIXTURE_REPORT_MODE = mode
        env.FIXTURE_REPORT = approvedReport
        env.FIXTURE_TASK_REPORT = taskReport(false)
        const missingReport = runCandidate()
        expect(missingReport.status).not.toBe(0)
        expect(JSON.parse(missingReport.stdout)).toMatchObject({ outcome: 'STOP', mutation_performed: false })
        expect(JSON.parse(missingReport.stdout).details.reason).toContain(reason)
        expect(git(['rev-parse', 'HEAD'])).toBe(greenHead)
      }
      delete env.FIXTURE_REPORT_MODE

      const unexpectedSuite = JSON.parse(approvedReport)
      unexpectedSuite.numFailedTests += 1
      unexpectedSuite.testResults[0].assertionResults.push({
        status: 'failed', fullName: 'unexpected assertion failure', failureMessages: ['unexpected failure'],
      })
      const unexpectedTasks = JSON.parse(taskReport(false)) as RedWipRunnerTaskReport
      unexpectedTasks.tasks[0]!.children.push({
        type: 'test', name: 'unexpected assertion failure', fullName: 'unexpected assertion failure', state: 'failed',
        errors: ['unexpected failure'], children: [],
      })
      env.FIXTURE_REPORT = JSON.stringify(unexpectedSuite)
      env.FIXTURE_TASK_REPORT = JSON.stringify(unexpectedTasks)
      const unexpectedFailure = runCandidate()
      expect(unexpectedFailure.status).not.toBe(0)
      expect(JSON.parse(unexpectedFailure.stdout)).toMatchObject({ outcome: 'STOP', mutation_performed: false })
      expect(JSON.parse(unexpectedFailure.stdout).details.reason).toContain('outside the exact Issue-approved assertion set')
      expect(git(['rev-parse', 'HEAD'])).toBe(greenHead)

      env.FIXTURE_REPORT = approvedReport
      env.FIXTURE_TASK_REPORT = taskReport(false)
      env.FIXTURE_REPORT_MODE = 'real-report'
      const result = runCandidate()
      expect(result.status, `${result.stderr || result.stdout}\n${git(['status', '--porcelain=v1', '--untracked-files=all'])}`).toBe(0)
      const realSuiteReport = JSON.parse(readFileSync(env.FIXTURE_CAPTURE_SUITE!, 'utf8'))
      const realTaskReport = JSON.parse(readFileSync(env.FIXTURE_CAPTURE_TASK!, 'utf8')) as RedWipRunnerTaskReport
      expect(realSuiteReport.testResults).toHaveLength(1)
      expect(realSuiteReport.numFailedTests).toBe(2)
      expect(realSuiteReport.numPassedTests).toBe(1)
      expect(realTaskReport.tasks).toHaveLength(1)
      expect(realTaskReport.unhandledErrors).toEqual([])
      expect(JSON.parse(readFileSync(env.FIXTURE_LAST_TEST_ARGS!, 'utf8'))).not.toContain('--')
      expect(JSON.parse(result.stdout)).toMatchObject({
        outcome: 'SUCCESS', mutation_performed: true,
        details: { checkpoint_status: 'WIP RED INCOMPLETE', objective_complete: false, actual_context_route: 'STOP' },
      })
      const pushed = spawnSync(realGit, ['ls-remote', bare, `refs/heads/${branch}`], { cwd: repo, env, encoding: 'utf8' }).stdout.trim().split(/\s+/)[0]
      expect(pushed).toBe(git(['rev-parse', 'HEAD']))
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  }, 30_000)
})
