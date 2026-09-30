import { describe, expect, it } from 'vitest'

import { collectContextEvidence, readLocalGitEvidence, type ContextCommandResult, type ContextCommandRunner } from '../../scripts/context/evidence.ts'

const repo = 'example/project'
const branch = 'fix/context'
const head = 'a'.repeat(40)
const cwd = '/canonical/checkout'

function ok(stdout = ''): ContextCommandResult {
  return { status: 0, stdout, stderr: '', error: null }
}

function failed(message = 'not a git repository'): ContextCommandResult {
  return { status: 128, stdout: '', stderr: message, error: null }
}

function localRunner(overrides: Record<string, ContextCommandResult> = {}): ContextCommandRunner {
  const values: Record<string, ContextCommandResult> = {
    'branch --show-current': ok(`${branch}\n`),
    'rev-parse HEAD': ok(`${head}\n`),
    'status --short': ok(),
    'rev-parse --abbrev-ref --symbolic-full-name @{upstream}': ok(`origin/${branch}\n`),
    'remote get-url origin': ok(`https://github.com/${repo}.git\n`),
    [`ls-remote --heads origin ${branch}`]: ok(`${head}\trefs/heads/${branch}\n`),
    ...overrides,
  }
  return (command, args, options) => {
    expect(options?.cwd).toBe(cwd)
    if (command === 'git') return values[args.join(' ')] ?? failed('unexpected Git command')
    return failed('GitHub unavailable')
  }
}

describe('Context evidence acquisition at the process boundary', () => {
  it('A: retains a valid attached checkout and its independent Git identity', () => {
    expect(readLocalGitEvidence({ cwd, run: localRunner() })).toMatchObject({
      branch, head, upstream: `origin/${branch}`, originRepository: repo,
      clean: true, detached: false, pushed: true, durable: true,
    })
  })

  it('B: fails closed in a non-Git cwd', () => {
    const run = localRunner(Object.fromEntries([
      'branch --show-current', 'rev-parse HEAD', 'status --short',
      'rev-parse --abbrev-ref --symbolic-full-name @{upstream}', 'remote get-url origin',
    ].map((key) => [key, failed()])))
    const result = readLocalGitEvidence({ cwd, run })
    expect(result).toMatchObject({ head: null, detached: true, durable: false })
  })

  it('C: a true detached HEAD is never reported attached', () => {
    const result = readLocalGitEvidence({ cwd, run: localRunner({ 'branch --show-current': ok() }) })
    expect(result).toMatchObject({ branch: '<detached>', head, detached: true, durable: false })
  })

  it('D: a true missing upstream remains non-durable', () => {
    const result = readLocalGitEvidence({ cwd, run: localRunner({
      'rev-parse --abbrev-ref --symbolic-full-name @{upstream}': failed('no upstream'),
    }) })
    expect(result).toMatchObject({ branch, head, upstream: null, durable: false })
  })

  it('E: GitHub failure does not erase independently successful local Git identity', () => {
    const evidence = collectContextEvidence({ cwd, issueNumber: '7', run: localRunner(), env: { ...process.env, GH_REPO: undefined } })
    expect(evidence.localGit).toMatchObject({ branch, head, originRepository: repo, durable: true })
    expect(evidence.repository.nameWithOwner).toBe(repo)
    expect(evidence.evidenceErrors.join(' ')).toContain('BLOCKED_EXTERNAL')
  })

  it('F: a contradictory zero-exit result with an EPERM marker remains fail-closed', () => {
    const anomaly = (stdout: string): ContextCommandResult => ({
      status: 0, stdout, stderr: '', error: Object.assign(new Error('spawnSync git EPERM'), { code: 'EPERM' }),
    })
    const result = readLocalGitEvidence({ cwd, run: localRunner({
      'branch --show-current': anomaly(`${branch}\n`),
      'rev-parse HEAD': anomaly(`${head}\n`),
      'remote get-url origin': anomaly(`https://github.com/${repo}.git\n`),
    }) })
    expect(result).toMatchObject({ branch: '<detached>', head: null, originRepository: null, durable: false })
  })

  it('G: one failed Git acquisition does not erase unrelated successful fields', () => {
    const result = readLocalGitEvidence({ cwd, run: localRunner({
      'rev-parse HEAD': failed('HEAD unavailable'),
    }) })
    expect(result).toMatchObject({ branch, head: null, originRepository: repo, durable: false })
  })
})
