import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { createSyntheticEvidenceRunner } from '../../scripts/test-harness/synthetic-evidence.ts'
import type { SyntheticCommandResult } from '../../scripts/test-harness/synthetic-evidence.ts'

function fixtureRoot() {
  const root = mkdtempSync(join(tmpdir(), 'bemoat-648-adapter-test-'))
  const fixturePath = join(root, 'fixture.json')
  writeFileSync(join(root, '.owner-marker'), `verify-harness-flow:${root.split('/').at(-1)}:evidence-root\n`)
  writeFileSync(fixturePath, JSON.stringify({
    schema_version: 1,
    fixture_type: 'BEMOAT_TEST_GITHUB_EVIDENCE',
    owner_marker: `verify-harness-flow:${root.split('/').at(-1)}`,
    repository: 'synthetic/fixture-648',
    active_profile: 'stage-a',
    comments: [],
    next_comment_id: 1,
    profiles: {
      'stage-a': {
        issue: {
          number: '648',
          title: 'Synthetic Issue',
          state: 'OPEN',
          url: 'https://github.com/synthetic/fixture-648/issues/648',
          body: 'Task size: core\nMission Control mode: required\nWorkflow profile: STANDARD',
        },
        responses: {
          '["api","repos/synthetic/fixture-648/git/ref/heads/main"]': {
            object: { sha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
          },
        },
      },
    },
  }, null, 2))
  return { root, fixturePath }
}

function fixtureEnv(root: string, fixturePath: string): NodeJS.ProcessEnv {
  return {
    NODE_ENV: 'test',
    PAYLOAD_SECRET: 'test-only-secret',
    BEMOAT_TEST_EVIDENCE_ENABLE: '1',
    BEMOAT_TEST_EVIDENCE_ROOT: root,
    BEMOAT_TEST_EVIDENCE_FIXTURE: fixturePath,
  }
}

describe('test-only synthetic evidence command runner', () => {
  it('delegates unchanged when the exact test-only opt-in is absent', () => {
    const nativeCalls: string[] = []
    const nativeResult: SyntheticCommandResult = { status: 0, stdout: 'native-result', stderr: '', error: null }
    const run = createSyntheticEvidenceRunner({
      env: { NODE_ENV: 'test', PAYLOAD_SECRET: 'test-only-secret' },
      runNative: (command, args) => {
        nativeCalls.push(`${command} ${args.join(' ')}`)
        return nativeResult
      },
    })

    expect(run('gh', ['issue', 'view', '648'])).toBe(nativeResult)
    expect(nativeCalls).toEqual(['gh issue view 648'])
  })

  it('rejects fixture activation outside explicit test mode before native commands run', () => {
    const { root, fixturePath } = fixtureRoot()
    const nativeCalls: string[] = []

    try {
      expect(() => createSyntheticEvidenceRunner({
        env: {
          NODE_ENV: 'production',
          PAYLOAD_SECRET: 'test-only-secret',
          BEMOAT_TEST_EVIDENCE_ENABLE: '1',
          BEMOAT_TEST_EVIDENCE_ROOT: root,
          BEMOAT_TEST_EVIDENCE_FIXTURE: fixturePath,
        },
        runNative: (command) => {
          nativeCalls.push(command)
          return { status: 0, stdout: '', stderr: '', error: null }
        },
      })).toThrow(/NODE_ENV=test/i)
      expect(nativeCalls).toEqual([])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('serves exact fixture-backed gh reads and delegates non-gh commands to the native runner', () => {
    const { root, fixturePath } = fixtureRoot()
    const nativeCalls: string[] = []

    try {
      const run = createSyntheticEvidenceRunner({
        env: fixtureEnv(root, fixturePath),
        runNative: (command, args) => {
          nativeCalls.push(`${command} ${args.join(' ')}`)
          return { status: 0, stdout: 'native-result', stderr: '', error: null }
        },
      })

      const github = run('gh', ['api', 'repos/synthetic/fixture-648/git/ref/heads/main'])
      expect(github.status).toBe(0)
      expect(JSON.parse(github.stdout)).toEqual({
        object: { sha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
      })

      const native = run('git', ['status'])
      expect(native.stdout).toBe('native-result')
      expect(nativeCalls).toEqual(['git status'])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('keeps HANDOFF POST and readback state inside the owned fixture', () => {
    const { root, fixturePath } = fixtureRoot()

    try {
      const run = createSyntheticEvidenceRunner({
        env: fixtureEnv(root, fixturePath),
        runNative: () => ({ status: 0, stdout: '', stderr: '', error: null }),
      })
      const body = 'synthetic HANDOFF body'
      const post = run('gh', [
        'api', '--method', 'POST',
        'repos/synthetic/fixture-648/issues/648/comments',
        '--input', '-',
      ], { input: JSON.stringify({ body }) })

      expect(post.status).toBe(0)
      expect(post.mutationPerformed).toBe(true)
      expect(JSON.parse(post.stdout)).toEqual({ id: '1' })

      const list = run('gh', [
        'api', '--paginate', '--slurp',
        'repos/synthetic/fixture-648/issues/648/comments',
      ])
      const comments = JSON.parse(list.stdout)
      expect(comments).toHaveLength(1)
      expect(comments[0]).toHaveLength(1)
      expect(comments[0][0]).toMatchObject({
        id: '1',
        body,
        url: 'https://github.com/synthetic/fixture-648/issues/648#issuecomment-1',
        html_url: 'https://github.com/synthetic/fixture-648/issues/648#issuecomment-1',
      })
      expect(JSON.parse(readFileSync(fixturePath, 'utf8')).comments).toHaveLength(1)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('derives missing comment timestamps from fixture ids and preserves explicit timestamps', () => {
    const { root, fixturePath } = fixtureRoot()

    try {
      const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as Record<string, unknown>
      fixture.comments = [
        {
          id: '42',
          body: 'later fixture comment',
          url: 'https://github.com/synthetic/fixture-648/issues/648#issuecomment-42',
        },
        {
          id: '41',
          body: 'earlier fixture comment',
          url: 'https://github.com/synthetic/fixture-648/issues/648#issuecomment-41',
        },
        {
          id: '43',
          body: 'explicitly timestamped fixture comment',
          url: 'https://github.com/synthetic/fixture-648/issues/648#issuecomment-43',
          createdAt: '2030-01-01T00:00:00Z',
        },
      ]
      writeFileSync(fixturePath, `${JSON.stringify(fixture, null, 2)}\n`)

      const run = createSyntheticEvidenceRunner({
        env: fixtureEnv(root, fixturePath),
        runNative: () => ({ status: 0, stdout: '', stderr: '', error: null }),
      })
      const issue = run('gh', ['issue', 'view', '648', '--repo', 'synthetic/fixture-648'])
      const comments = (JSON.parse(issue.stdout) as { comments: Array<{ id: string; createdAt: string }> }).comments

      expect(comments.map(({ id, createdAt }) => [id, createdAt])).toEqual([
        ['42', '2026-01-01T00:00:00.042Z'],
        ['41', '2026-01-01T00:00:00.041Z'],
        ['43', '2030-01-01T00:00:00Z'],
      ])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('rejects fixtures outside the owned root, symlinked fixtures, and mismatched owner markers', () => {
    const { root, fixturePath } = fixtureRoot()
    const outsideRoot = mkdtempSync(join(tmpdir(), 'bemoat-648-adapter-outside-'))
    const outsideFixture = join(outsideRoot, 'fixture.json')
    writeFileSync(outsideFixture, readFileSync(fixturePath, 'utf8'))
    const linkedPath = join(root, 'linked-fixture.json')
    symlinkSync(outsideFixture, linkedPath)

    try {
      const runNative = (): SyntheticCommandResult => ({ status: 0, stdout: '', stderr: '', error: null })
      expect(() => createSyntheticEvidenceRunner({
        env: fixtureEnv(root, outsideFixture),
        runNative,
      })).toThrow(/owned evidence root/i)
      expect(() => createSyntheticEvidenceRunner({
        env: fixtureEnv(root, linkedPath),
        runNative,
      })).toThrow(/symlink/i)

      writeFileSync(fixturePath, readFileSync(fixturePath, 'utf8').replace(
        `verify-harness-flow:${root.split('/').at(-1)}`,
        'verify-harness-flow:wrong-run',
      ))
      expect(() => createSyntheticEvidenceRunner({
        env: fixtureEnv(root, fixturePath),
        runNative,
      })).toThrow(/owner marker/i)
    } finally {
      rmSync(root, { recursive: true, force: true })
      rmSync(outsideRoot, { recursive: true, force: true })
    }
  })

  it('only serves the canonical Issue #648 comment endpoint', () => {
    const { root, fixturePath } = fixtureRoot()

    try {
      const run = createSyntheticEvidenceRunner({
        env: fixtureEnv(root, fixturePath),
        runNative: () => ({ status: 0, stdout: '', stderr: '', error: null }),
      })
      const read = run('gh', [
        'api', '--paginate', '--slurp',
        'repos/synthetic/fixture-648/issues/649/comments',
      ])
      expect(read.status).toBe(1)
      expect(read.stderr).toMatch(/Issue #648/i)

      const post = run('gh', [
        'api', '--method', 'POST',
        'repos/synthetic/fixture-648/issues/649/comments',
        '--input', '-',
      ], { input: JSON.stringify({ body: 'wrong issue' }) })
      expect(post.status).toBe(1)
      expect(post.mutationPerformed).toBe(false)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
