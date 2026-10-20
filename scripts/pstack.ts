#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
} from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, resolve } from 'node:path'

const COMMAND = 'bemoat:pstack'
const PIN_RELATIVE_PATH = '.bemoat/pstack-pin.json'
const DEFAULT_CACHE_DIR = '.bemoat/pstack-cache'
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
  cache_dir: DEFAULT_CACHE_DIR,
  automatic_routing: false,
} as const

type Pin = typeof EXPECTED_PIN
type Classification = 'INVALID_INVOCATION' | 'STATE_CONFLICT' | 'EVIDENCE_CONFLICT' | 'BLOCKED_EXTERNAL' | 'INTERNAL_ERROR'

class PstackError extends Error {
  readonly classification: Classification

  constructor(classification: Classification, message: string) {
    super(message)
    this.name = 'PstackError'
    this.classification = classification
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function clonePin(pin: Pin): Pin {
  return {
    ...pin,
    manifest_blobs: { ...pin.manifest_blobs },
  }
}

function readPin(root: string): Pin {
  const path = resolve(root, PIN_RELATIVE_PATH)
  let value: unknown
  try {
    value = JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    throw new PstackError('EVIDENCE_CONFLICT', `Cannot read ${PIN_RELATIVE_PATH}: ${errorMessage(error)}`)
  }

  if (!isRecord(value)) {
    throw new PstackError('EVIDENCE_CONFLICT', `${PIN_RELATIVE_PATH} must contain an object`)
  }

  const manifestBlobs = value.manifest_blobs
  const keys = Object.keys(value).sort()
  const expectedKeys = Object.keys(EXPECTED_PIN).sort()
  if (
    JSON.stringify(keys) !== JSON.stringify(expectedKeys) ||
    !isRecord(manifestBlobs) ||
    JSON.stringify(Object.keys(manifestBlobs).sort()) !== JSON.stringify(Object.keys(EXPECTED_PIN.manifest_blobs).sort())
  ) {
    throw new PstackError('EVIDENCE_CONFLICT', `${PIN_RELATIVE_PATH} has an invalid schema`)
  }

  for (const [key, expected] of Object.entries(EXPECTED_PIN)) {
    if (key === 'manifest_blobs') continue
    if (value[key] !== expected) {
      throw new PstackError('EVIDENCE_CONFLICT', `${PIN_RELATIVE_PATH}.${key} does not match the approved pin`)
    }
  }
  for (const [path, expected] of Object.entries(EXPECTED_PIN.manifest_blobs)) {
    if (manifestBlobs[path] !== expected) {
      throw new PstackError('EVIDENCE_CONFLICT', `${PIN_RELATIVE_PATH}.manifest_blobs[${path}] does not match the approved pin`)
    }
  }

  return clonePin(EXPECTED_PIN)
}

function runGit(root: string, args: string[]): string {
  return execFileSync('git', ['-C', root, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}

function cacheStateError(message: string): PstackError {
  return new PstackError('STATE_CONFLICT', message)
}

function validateCache(pin: Pin, cacheDir: string): void {
  if (!existsSync(cacheDir)) throw cacheStateError(`PStack cache does not exist: ${cacheDir}`)
  if (lstatSync(cacheDir).isSymbolicLink() || !lstatSync(cacheDir).isDirectory()) {
    throw cacheStateError(`PStack cache must be a real directory: ${cacheDir}`)
  }

  try {
    if (runGit(cacheDir, ['rev-parse', '--is-inside-work-tree']) !== 'true') {
      throw cacheStateError(`PStack cache is not a Git worktree: ${cacheDir}`)
    }
  } catch (error) {
    if (error instanceof PstackError) throw error
    throw cacheStateError(`PStack cache is not a readable Git worktree: ${errorMessage(error)}`)
  }

  let head: string
  let origin: string
  let status: string
  try {
    head = runGit(cacheDir, ['rev-parse', 'HEAD'])
    origin = runGit(cacheDir, ['config', '--get', 'remote.origin.url'])
    status = runGit(cacheDir, ['status', '--porcelain=v1', '--untracked-files=all', '--ignored=matching'])
  } catch (error) {
    throw cacheStateError(`Cannot inspect PStack cache: ${errorMessage(error)}`)
  }

  if (head !== pin.commit) {
    throw cacheStateError(`PStack cache commit mismatch: expected ${pin.commit}, found ${head}`)
  }
  if (origin !== pin.repository_url) {
    throw cacheStateError(`PStack cache origin mismatch: expected ${pin.repository_url}, found ${origin || '<missing>'}`)
  }
  if (status !== '') {
    throw cacheStateError(`PStack cache has working-tree drift:\n${status}`)
  }

  let subtree: string
  const manifestBlobs: Record<string, string> = {}
  try {
    subtree = runGit(cacheDir, ['rev-parse', `HEAD:${pin.subtree}`])
    for (const path of Object.keys(pin.manifest_blobs)) {
      manifestBlobs[path] = runGit(cacheDir, ['rev-parse', `HEAD:${path}`])
    }
  } catch (error) {
    throw new PstackError('EVIDENCE_CONFLICT', `PStack cache object verification failed: ${errorMessage(error)}`)
  }

  if (subtree !== pin.tree) {
    throw new PstackError('EVIDENCE_CONFLICT', `PStack subtree mismatch: expected ${pin.tree}, found ${subtree}`)
  }
  for (const [path, expected] of Object.entries(pin.manifest_blobs)) {
    if (manifestBlobs[path] !== expected) {
      throw new PstackError('EVIDENCE_CONFLICT', `PStack manifest mismatch for ${path}: expected ${expected}, found ${manifestBlobs[path]}`)
    }
  }

  for (const path of Object.keys(pin.manifest_blobs)) {
    const manifestPath = join(cacheDir, path)
    let manifest: unknown
    try {
      manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
    } catch (error) {
      throw new PstackError('EVIDENCE_CONFLICT', `Cannot read verified PStack manifest ${path}: ${errorMessage(error)}`)
    }
    if (!isRecord(manifest) || manifest.version !== pin.version) {
      throw new PstackError('EVIDENCE_CONFLICT', `PStack manifest ${path} does not declare version ${pin.version}`)
    }
  }

}

function installCache(pin: Pin, cacheDir: string): boolean {
  const existed = existsSync(cacheDir)
  let ownedCache = false

  if (existed) {
    const stat = lstatSync(cacheDir)
    if (stat.isSymbolicLink() || !stat.isDirectory()) {
      throw cacheStateError(`Refusing to use non-directory PStack cache path: ${cacheDir}`)
    }
    if (readdirSync(cacheDir).length > 0) {
      validateCache(pin, cacheDir)
      return false
    }
    ownedCache = true
  } else {
    mkdirSync(cacheDir, { recursive: true })
    ownedCache = true
  }

  try {
    runGit(cacheDir, ['init', '--quiet'])
    runGit(cacheDir, ['remote', 'add', 'origin', pin.repository_url])
    try {
      runGit(cacheDir, ['fetch', '--quiet', '--no-tags', '--depth=1', 'origin', pin.commit])
      runGit(cacheDir, ['checkout', '--quiet', '--detach', pin.commit])
    } catch (error) {
      throw new PstackError('BLOCKED_EXTERNAL', `Unable to fetch pinned Cursor pstack commit: ${errorMessage(error)}`)
    }
    validateCache(pin, cacheDir)
    return true
  } catch (error) {
    if (ownedCache) rmSync(cacheDir, { recursive: true, force: true })
    if (error instanceof PstackError) throw error
    throw new PstackError('INTERNAL_ERROR', errorMessage(error))
  }
}

function discover(cacheDir: string, pin: Pin): { skills: string[]; agents: string[] } {
  const skillsRoot = join(cacheDir, pin.subtree, 'skills')
  const agentsRoot = join(cacheDir, pin.subtree, 'agents')
  const skills = readdirSync(skillsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(skillsRoot, entry.name, 'SKILL.md')))
    .map((entry) => entry.name)
    .sort()
  const agents = readdirSync(agentsRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => entry.name)
    .sort()
  return { skills, agents }
}

function identity(pin: Pin) {
  return {
    repository: pin.repository,
    repository_url: pin.repository_url,
    subtree: pin.subtree,
    commit: pin.commit,
    version: pin.version,
    tree: pin.tree,
    manifest_blobs: { ...pin.manifest_blobs },
  }
}

function successOutput(
  operation: string,
  pin: Pin,
  cacheDir: string,
  mutationPerformed: boolean,
  details: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    schema_version: 1,
    command: COMMAND,
    operation,
    classification: 'SUCCESS',
    mutation_performed: mutationPerformed,
    cache_dir: cacheDir,
    pin: clonePin(pin),
    pin_identity: identity(pin),
    automatic_routing: false,
    ...details,
  }
}

function helpOutput(): Record<string, unknown> {
  return {
    schema_version: 1,
    command: COMMAND,
    mode: 'help',
    classification: 'HELP',
    tier: 'A',
    purpose: 'Manage and inspect the exact Cursor pstack cache without activating routing.',
    usage: [
      'pnpm run bemoat:pstack -- install [--cache-dir <path>]',
      'pnpm run bemoat:pstack -- check [--cache-dir <path>]',
      'pnpm run bemoat:pstack -- discover [--cache-dir <path>]',
    ],
    automatic_routing: false,
    writes: ['task-local cache only during explicit install'],
    reads: [PIN_RELATIVE_PATH, 'the task-local Git cache'],
  }
}

function parseInvocation(argv: string[]): { operation?: string; cacheDir?: string; json: boolean; help: boolean } {
  const tokens = argv.filter((token) => token !== '--')
  const json = tokens.includes('--json')
  const help = tokens.includes('--help') || tokens.includes('-h')
  let operation: string | undefined
  let cacheDir: string | undefined

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]
    if (token === '--json' || token === '--help' || token === '-h') continue
    if (token === '--cache-dir') {
      const value = tokens[index + 1]
      if (!value || value.startsWith('-')) {
        throw new PstackError('INVALID_INVOCATION', '--cache-dir requires a path')
      }
      if (cacheDir !== undefined) {
        throw new PstackError('INVALID_INVOCATION', '--cache-dir may be provided only once')
      }
      cacheDir = value
      index += 1
      continue
    }
    if (token.startsWith('-')) {
      throw new PstackError('INVALID_INVOCATION', `Unknown argument: ${token}`)
    }
    if (operation !== undefined) {
      throw new PstackError('INVALID_INVOCATION', `Unexpected positional argument: ${token}`)
    }
    operation = token
  }

  if (!help && (!operation || !['install', 'check', 'discover'].includes(operation))) {
    throw new PstackError('INVALID_INVOCATION', 'operation must be install, check, or discover')
  }
  return { operation, cacheDir, json, help }
}

function render(value: Record<string, unknown>, json: boolean): void {
  if (json) {
    process.stdout.write(`${JSON.stringify(value)}\n`)
    return
  }
  if (value.classification === 'HELP') {
    const usage = Array.isArray(value.usage) ? value.usage.join('\n') : String(value.usage)
    process.stdout.write(`${usage}\n`)
    return
  }
  process.stdout.write(`${String(value.classification)}: ${String(value.operation)} ${String(value.cache_dir)}\n`)
}

function renderError(error: unknown, operation: string | undefined, json: boolean, pin?: Pin): void {
  const classification = error instanceof PstackError ? error.classification : 'INTERNAL_ERROR'
  const reason = errorMessage(error)
  const output: Record<string, unknown> = {
    schema_version: 1,
    command: COMMAND,
    operation: operation ?? null,
    classification,
    mutation_performed: false,
    automatic_routing: false,
    error: reason,
  }
  if (pin) {
    output.pin = clonePin(pin)
    output.pin_identity = identity(pin)
  }
  if (json) {
    process.stdout.write(`${JSON.stringify(output)}\n`)
  } else {
    process.stderr.write(`${classification}: ${reason}\n`)
  }
  process.exitCode = classification === 'INVALID_INVOCATION' ? 2 : 1
}

function main(): void {
  let invocation: ReturnType<typeof parseInvocation> | undefined
  let pin: Pin | undefined
  try {
    invocation = parseInvocation(process.argv.slice(2))
    if (invocation.help) {
      render(helpOutput(), invocation.json)
      return
    }

    const root = process.cwd()
    pin = readPin(root)
    const cacheDir = resolve(root, invocation.cacheDir ?? pin.cache_dir)

    if (invocation.operation === 'install') {
      const mutationPerformed = installCache(pin, cacheDir)
      render(successOutput('install', pin, cacheDir, mutationPerformed), invocation.json)
      return
    }

    validateCache(pin, cacheDir)
    const details = invocation.operation === 'discover' ? discover(cacheDir, pin) : {}
    render(successOutput(invocation.operation ?? 'check', pin, cacheDir, false, details), invocation.json)
  } catch (error) {
    renderError(error, invocation?.operation, invocation?.json ?? process.argv.includes('--json'), pin)
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
