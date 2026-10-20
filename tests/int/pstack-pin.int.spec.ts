import { execFileSync, spawnSync } from 'node:child_process'
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { assertResultEnvelopeV1 } from '../../scripts/cli/command-result.ts'

const ROOT = process.cwd()
const ENTRYPOINT = resolve(ROOT, 'scripts/pstack.ts')
const PIN_PATH = resolve(ROOT, '.bemoat/pstack-pin.json')
const EXPECTED_PIN = {
  schema_version: 1,
  repository: 'cursor/plugins',
  repository_url: 'https://github.com/cursor/plugins.git',
  subtree: 'pstack',
  commit: '88d47514b82e7c44f00f2b2a72ff6dd12158038c',
  version: '0.15.29',
  tree: '34a0b817e5ea92375bb10f20b15cf750d4e8095a',
  manifest_blobs: {
    'pstack/plugin.json': '2b28f689ca144500269499dd0d4ca5ab01891bf4',
    'pstack/.cursor-plugin/plugin.json': 'fe3321bdc728fe8dbd74c925e9913c4954450ecc',
  },
  cache_dir: '.bemoat/pstack-cache',
  automatic_routing: false,
} as const

type JsonRecord = Record<string, unknown>

let tempRoot: string
let verifiedCache: string

function runPstack(args: string[]) {
  return spawnSync(process.execPath, [ENTRYPOINT, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 120_000,
    env: { ...process.env, NO_COLOR: '1' },
  })
}

function parseJson(stdout: string): JsonRecord {
  const line = [...stdout.trim().split(/\r?\n/)].reverse().find((entry: string) => entry.trim().startsWith('{'))
  if (!line) throw new Error(`expected JSON output, received: ${stdout}`)
  return JSON.parse(line) as JsonRecord
}

function git(root: string, args: string[]): string {
  return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim()
}

beforeAll(() => {
  tempRoot = mkdtempSync(join(tmpdir(), 'bemoat-pstack-pin-'))
  verifiedCache = join(tempRoot, 'verified-cache')
  mkdirSync(verifiedCache)

  const result = runPstack(['install', '--cache-dir', verifiedCache, '--json'])
  if (result.status !== 0) {
    throw new Error(`pstack install setup failed:\n${result.stdout}\n${result.stderr}`)
  }
})

afterAll(() => {
  if (tempRoot) rmSync(tempRoot, { recursive: true, force: true })
})

describe('pinned Cursor pstack consumption', () => {
  it('uses the registered Tier A help and result envelopes', () => {
    const result = runPstack(['--help', '--json'])
    const output = parseJson(result.stdout)

    expect(result.status).toBe(0)
    expect(output).toMatchObject({
      schema_version: 1,
      command: 'bemoat:pstack',
      mode: 'help',
      classification: 'HELP',
      tier: 'A',
    })
  })

  it('records the exact canonical pin identity and keeps the floating homepage out of the pin', () => {
    const pin = JSON.parse(readFileSync(PIN_PATH, 'utf8')) as JsonRecord

    expect(pin).toEqual(EXPECTED_PIN)
    expect(pin).not.toHaveProperty('homepage')
  })

  it('installs the exact pin into an empty task-local cache', () => {
    expect(existsSync(join(verifiedCache, '.git'))).toBe(true)
    expect(git(verifiedCache, ['rev-parse', 'HEAD'])).toBe(EXPECTED_PIN.commit)
    expect(git(verifiedCache, ['rev-parse', 'HEAD:pstack'])).toBe(EXPECTED_PIN.tree)
    expect(JSON.parse(readFileSync(join(verifiedCache, 'pstack/plugin.json'), 'utf8')).version)
      .toBe(EXPECTED_PIN.version)
  }, 120_000)

  it('rejects an existing cache at a mismatched commit without overwriting it', () => {
    const cache = join(tempRoot, 'mismatched-cache')
    mkdirSync(cache)
    git(cache, ['init', '--quiet'])
    writeFileSync(join(cache, 'sentinel.txt'), 'preserve me\n')
    git(cache, ['add', 'sentinel.txt'])
    execFileSync('git', ['-C', cache, '-c', 'user.name=Bemoat Test', '-c', 'user.email=test@example.invalid', 'commit', '--quiet', '-m', 'sentinel'])
    const before = git(cache, ['rev-parse', 'HEAD'])

    const result = runPstack(['install', '--cache-dir', cache, '--json'])
    const output = parseJson(result.stdout)

    expect(result.status).not.toBe(0)
    assertResultEnvelopeV1(output)
    expect(output).toMatchObject({
      command: 'bemoat:pstack',
      mode: 'result',
      classification: 'STATE_CONFLICT',
    })
    expect(output.details).toMatchObject({ operation: 'install', automatic_routing: false })
    expect(git(cache, ['rev-parse', 'HEAD'])).toBe(before)
    expect(readFileSync(join(cache, 'sentinel.txt'), 'utf8')).toBe('preserve me\n')
    expect(existsSync(join(cache, 'pstack'))).toBe(false)
  })

  it('rejects modified or untracked cache drift', () => {
    const cache = join(tempRoot, 'drift-cache')
    cpSync(verifiedCache, cache, { recursive: true })
    writeFileSync(join(cache, 'pstack', 'unexpected.txt'), 'drift\n')

    const result = runPstack(['check', '--cache-dir', cache, '--json'])
    const output = parseJson(result.stdout)

    expect(result.status).not.toBe(0)
    assertResultEnvelopeV1(output)
    expect(output).toMatchObject({
      command: 'bemoat:pstack',
      mode: 'result',
      classification: 'STATE_CONFLICT',
    })
    expect(output.details).toMatchObject({ operation: 'check', automatic_routing: false })
    expect(readFileSync(join(cache, 'pstack', 'unexpected.txt'), 'utf8')).toBe('drift\n')
  })

  it('keeps check and discover read-only and reports routing disabled', () => {
    const cache = join(tempRoot, 'read-only-cache')
    cpSync(verifiedCache, cache, { recursive: true })
    const before = git(cache, ['status', '--porcelain=v1', '--untracked-files=all', '--ignored=matching'])

    const check = runPstack(['check', '--cache-dir', cache, '--json'])
    const discover = runPstack(['discover', '--cache-dir', cache, '--json'])
    const checkOutput = parseJson(check.stdout)
    const discoverOutput = parseJson(discover.stdout)

    expect(check.status).toBe(0)
    expect(discover.status).toBe(0)
    assertResultEnvelopeV1(checkOutput)
    assertResultEnvelopeV1(discoverOutput)
    expect(checkOutput).toMatchObject({
      command: 'bemoat:pstack',
      mode: 'result',
      classification: 'SUCCESS',
      mutation_performed: false,
    })
    expect(checkOutput.details).toMatchObject({
      operation: 'check',
      pin: EXPECTED_PIN,
      automatic_routing: false,
    })
    expect(discoverOutput).toMatchObject({
      command: 'bemoat:pstack',
      mode: 'result',
      classification: 'SUCCESS',
      mutation_performed: false,
    })
    expect(discoverOutput.details).toMatchObject({
      operation: 'discover',
      pin: EXPECTED_PIN,
      automatic_routing: false,
      skills: expect.arrayContaining(['architect', 'tdd']),
      agents: expect.arrayContaining(['comment-sicko.md', 'poteto-agent.md']),
    })
    expect(git(cache, ['status', '--porcelain=v1', '--untracked-files=all', '--ignored=matching'])).toBe(before)
    expect(existsSync(join(ROOT, '.agents', 'pstack'))).toBe(false)
  })
})
