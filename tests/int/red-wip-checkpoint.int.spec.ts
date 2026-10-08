import { readFileSync } from 'node:fs'
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
    test_name: testName,
    expected_message: expectedMessage,
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
})
