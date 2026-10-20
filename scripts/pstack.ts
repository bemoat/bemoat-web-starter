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

import { createHelpEnvelopeV1, formatTextHelp } from './cli/command-help.ts'
import { CliInvocationError, parseCommandInvocation, resolveCommandIdentity, type ParsedInvocation } from './cli/command-invocation.ts'
import { classificationExitCode, createResultEnvelopeV1 } from './cli/command-result.ts'

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

function successDetails(
  operation: string,
  pin: Pin,
  cacheDir: string,
  mutationPerformed: boolean,
  details: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    operation,
    mutation_performed: mutationPerformed,
    cache_dir: cacheDir,
    pin: clonePin(pin),
    pin_identity: identity(pin),
    automatic_routing: false,
    ...details,
  }
}

function renderHelp(invocation: Extract<ParsedInvocation, { mode: 'help' }>): void {
  if (invocation.format === 'json') {
    process.stdout.write(`${JSON.stringify(createHelpEnvelopeV1(invocation.contract))}\n`)
    return
  }
  process.stdout.write(formatTextHelp(invocation.contract))
}

function renderResult({
  operation,
  format,
  classification,
  mutationPerformed,
  pin,
  cacheDir,
  details,
}: {
  operation: string
  format: 'json' | 'text'
  classification: 'SUCCESS' | Classification
  mutationPerformed: boolean
  pin: Pin
  cacheDir: string
  details?: Record<string, unknown>
}): void {
  const successful = classification === 'SUCCESS'
  const envelope = createResultEnvelopeV1({
    command: COMMAND,
    outcome: successful ? 'SUCCESS' : 'STOP',
    classification,
    mutation_performed: mutationPerformed,
    repository: 'bemoat/bemoat-web-starter',
    next_action: {
      type: successful ? 'COMPLETE' : 'STOP',
      command: null,
      reason: successful
        ? 'The exact pinned PStack cache operation completed.'
        : 'The exact pinned PStack cache operation did not complete.',
    },
    details: successDetails(operation, pin, cacheDir, mutationPerformed, details),
  })
  if (format === 'json') process.stdout.write(`${JSON.stringify(envelope)}\n`)
  else process.stdout.write(`${successful ? 'SUCCESS' : 'STOP'}: ${operation} ${cacheDir}\n`)
  process.exitCode = classificationExitCode(classification)
}

function renderError(error: unknown, operation: string | undefined, format: 'json' | 'text', pin?: Pin): void {
  const classification = error instanceof CliInvocationError
    ? error.classification
    : error instanceof PstackError
      ? error.classification
      : 'INTERNAL_ERROR'
  const reason = errorMessage(error)
  const result = createResultEnvelopeV1({
    command: COMMAND,
    outcome: classification === 'INVALID_INVOCATION' ? 'ERROR' : 'STOP',
    classification,
    mutation_performed: false,
    repository: 'bemoat/bemoat-web-starter',
    next_action: { type: 'STOP', command: null, reason },
    details: {
      operation: operation ?? null,
      reason,
      automatic_routing: false,
      ...(pin ? { pin: clonePin(pin), pin_identity: identity(pin) } : {}),
    },
  })
  if (format === 'json') process.stdout.write(`${JSON.stringify(result)}\n`)
  else process.stderr.write(`ERROR: ${classification}: ${reason}\n`)
  process.exitCode = classificationExitCode(classification)
}

function main(): void {
  let invocation: ParsedInvocation | undefined
  let pin: Pin | undefined
  try {
    const command = resolveCommandIdentity({ fallback: COMMAND, env: process.env, entrypoint: 'scripts/pstack.ts' })
    invocation = parseCommandInvocation(command, process.argv.slice(2))
    if (invocation.mode === 'help') return renderHelp(invocation)
    if (invocation.mode !== 'run') throw new Error('run invocation required')

    const root = process.cwd()
    pin = readPin(root)
    const operation = String(invocation.values.operation)
    const cacheDir = resolve(root, String(invocation.values.cache_dir ?? pin.cache_dir))

    if (operation === 'install') {
      const mutationPerformed = installCache(pin, cacheDir)
      renderResult({ operation, format: invocation.format, classification: 'SUCCESS', mutationPerformed, pin, cacheDir })
      return
    }

    validateCache(pin, cacheDir)
    const details = operation === 'discover' ? discover(cacheDir, pin) : {}
    renderResult({ operation, format: invocation.format, classification: 'SUCCESS', mutationPerformed: false, pin, cacheDir, details })
  } catch (error) {
    renderError(
      error,
      invocation?.mode === 'run' ? String(invocation.values.operation) : undefined,
      invocation?.format ?? (process.argv.includes('--json') ? 'json' : 'text'),
      pin,
    )
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
