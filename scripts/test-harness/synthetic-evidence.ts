import { existsSync, lstatSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { basename, isAbsolute, join, relative } from 'node:path'

export const SYNTHETIC_EVIDENCE_ENABLE = 'BEMOAT_TEST_EVIDENCE_ENABLE'
export const SYNTHETIC_EVIDENCE_FIXTURE = 'BEMOAT_TEST_EVIDENCE_FIXTURE'
export const SYNTHETIC_EVIDENCE_ROOT = 'BEMOAT_TEST_EVIDENCE_ROOT'
export const SYNTHETIC_ISSUE_NUMBER = '648'

export type SyntheticCommandOptions = {
  cwd?: string
  env?: NodeJS.ProcessEnv
  input?: string
}

export type SyntheticCommandResult = {
  status: number
  stdout: string
  stderr: string
  error: Error | null
  mutationPerformed?: boolean
}

export type SyntheticCommandRunner = (
  command: string,
  args: readonly string[],
  options?: SyntheticCommandOptions,
) => SyntheticCommandResult

type FixtureResponse = {
  status?: number
  value?: unknown
  stdout?: string
  stderr?: string
  error?: string | null
  mutationPerformed?: boolean
}

type FixtureComment = {
  id: string
  body: string
  url: string
  createdAt?: string
  author?: { login: string }
  authorAssociation?: string
}

type FixtureProfile = {
  issue: Record<string, unknown>
  responses: Record<string, unknown>
}

type SyntheticEvidenceFixture = {
  schema_version: 1
  fixture_type: 'BEMOAT_TEST_GITHUB_EVIDENCE'
  owner_marker: string
  repository: string
  active_profile: string
  comments: FixtureComment[]
  next_comment_id: number
  profiles: Record<string, FixtureProfile>
}

export class SyntheticEvidenceConfigurationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SyntheticEvidenceConfigurationError'
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function ownedFixtureRoot(path: string, root: string): string {
  if (!isAbsolute(root)) {
    throw new SyntheticEvidenceConfigurationError(`${SYNTHETIC_EVIDENCE_ROOT} must be an absolute path`)
  }
  if (!existsSync(root) || lstatSync(root).isSymbolicLink()) {
    throw new SyntheticEvidenceConfigurationError('synthetic evidence root is missing or symlinked')
  }
  if (!isAbsolute(path)) {
    throw new SyntheticEvidenceConfigurationError(`${SYNTHETIC_EVIDENCE_FIXTURE} must be an absolute path`)
  }
  if (!existsSync(path)) {
    throw new SyntheticEvidenceConfigurationError(`synthetic evidence fixture does not exist: ${path}`)
  }
  if (lstatSync(path).isSymbolicLink()) {
    throw new SyntheticEvidenceConfigurationError('synthetic evidence fixture must not be a symlink')
  }

  const resolvedRoot = realpathSync(root)
  if (!basename(resolvedRoot).startsWith('bemoat-648-')) {
    throw new SyntheticEvidenceConfigurationError('synthetic evidence root is not a run-owned Issue #648 temporary root')
  }
  const rootOwnerMarker = join(resolvedRoot, '.owner-marker')
  if (!existsSync(rootOwnerMarker) || lstatSync(rootOwnerMarker).isSymbolicLink() ||
      readFileSync(rootOwnerMarker, 'utf8') !== `verify-harness-flow:${basename(resolvedRoot)}:evidence-root\n`) {
    throw new SyntheticEvidenceConfigurationError('synthetic evidence root ownership marker is missing or invalid')
  }
  const resolvedFixture = realpathSync(path)
  const pathRelativeToRoot = relative(resolvedRoot, resolvedFixture)
  if (!pathRelativeToRoot || pathRelativeToRoot.startsWith('..') || isAbsolute(pathRelativeToRoot)) {
    throw new SyntheticEvidenceConfigurationError('synthetic evidence fixture must be under the owned evidence root')
  }
  return resolvedRoot
}

function readFixture(path: string, root: string): SyntheticEvidenceFixture {
  const resolvedRoot = ownedFixtureRoot(path, root)

  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    throw new SyntheticEvidenceConfigurationError(
      `synthetic evidence fixture is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    )
  }

  if (!isRecord(parsed) || parsed.schema_version !== 1 || parsed.fixture_type !== 'BEMOAT_TEST_GITHUB_EVIDENCE' ||
      parsed.owner_marker !== `verify-harness-flow:${basename(resolvedRoot)}` ||
      typeof parsed.repository !== 'string' || !/^[^/\s]+\/[^/\s]+$/.test(parsed.repository) ||
      typeof parsed.active_profile !== 'string' || !isRecord(parsed.profiles) || !Array.isArray(parsed.comments)) {
    throw new SyntheticEvidenceConfigurationError('synthetic evidence fixture failed its schema or owner marker checks')
  }
  const nextCommentId = parsed.next_comment_id
  if (typeof nextCommentId !== 'number' || !Number.isSafeInteger(nextCommentId) || nextCommentId < 1) {
    throw new SyntheticEvidenceConfigurationError('synthetic evidence fixture failed its schema or ownership checks')
  }

  const profiles: Record<string, FixtureProfile> = {}
  for (const [name, value] of Object.entries(parsed.profiles)) {
    if (!isRecord(value) || !isRecord(value.issue) || !isRecord(value.responses)) {
      throw new SyntheticEvidenceConfigurationError(`synthetic evidence profile is malformed: ${name}`)
    }
    profiles[name] = {
      issue: value.issue,
      responses: value.responses,
    }
  }
  if (!profiles[parsed.active_profile]) {
    throw new SyntheticEvidenceConfigurationError(`synthetic evidence profile is missing: ${parsed.active_profile}`)
  }

  const comments: FixtureComment[] = []
  for (const [index, value] of parsed.comments.entries()) {
    if (!isRecord(value) || typeof value.id !== 'string' || typeof value.body !== 'string' || typeof value.url !== 'string') {
      throw new SyntheticEvidenceConfigurationError(`synthetic evidence comment is malformed at index ${index}`)
    }
    comments.push({
      id: value.id,
      body: value.body,
      url: value.url,
      ...(typeof value.createdAt === 'string' ? { createdAt: value.createdAt } : {}),
      ...(isRecord(value.author) && typeof value.author.login === 'string' ? { author: { login: value.author.login } } : {}),
      ...(typeof value.authorAssociation === 'string' ? { authorAssociation: value.authorAssociation } : {}),
    })
  }

  return {
    schema_version: 1,
    fixture_type: 'BEMOAT_TEST_GITHUB_EVIDENCE',
    owner_marker: parsed.owner_marker,
    repository: parsed.repository,
    active_profile: parsed.active_profile,
    comments,
    next_comment_id: nextCommentId,
    profiles,
  }
}

function fixturePathFromEnv(env: NodeJS.ProcessEnv): { path: string; root: string } | null {
  const path = env[SYNTHETIC_EVIDENCE_FIXTURE]
  const enabled = env[SYNTHETIC_EVIDENCE_ENABLE]
  if (!path && !enabled) return null
  if (env.NODE_ENV !== 'test' || enabled !== '1') {
    throw new SyntheticEvidenceConfigurationError(
      `${SYNTHETIC_EVIDENCE_FIXTURE} requires NODE_ENV=test and ${SYNTHETIC_EVIDENCE_ENABLE}=1`,
    )
  }
  const root = env[SYNTHETIC_EVIDENCE_ROOT]
  if (!path || !root) {
    throw new SyntheticEvidenceConfigurationError(`${SYNTHETIC_EVIDENCE_FIXTURE} and ${SYNTHETIC_EVIDENCE_ROOT} are required`)
  }
  const resolvedRoot = ownedFixtureRoot(path, root)
  readFixture(path, resolvedRoot)
  return { path, root: resolvedRoot }
}

function json(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value)
}

function success(value: unknown, mutationPerformed = false): SyntheticCommandResult {
  return {
    status: 0,
    stdout: json(value),
    stderr: '',
    error: null,
    mutationPerformed,
  }
}

function failure(message: string, mutationPerformed = false): SyntheticCommandResult {
  return {
    status: 1,
    stdout: '',
    stderr: message,
    error: null,
    mutationPerformed,
  }
}

function response(value: unknown): SyntheticCommandResult {
  if (!isRecord(value) || !('status' in value || 'stdout' in value || 'stderr' in value || 'error' in value || 'value' in value)) {
    return success(value)
  }
  const fixtureResponse = value as FixtureResponse
  return {
    status: typeof fixtureResponse.status === 'number' ? fixtureResponse.status : 0,
    stdout: typeof fixtureResponse.stdout === 'string'
      ? fixtureResponse.stdout
      : 'value' in fixtureResponse ? json(fixtureResponse.value) : '',
    stderr: typeof fixtureResponse.stderr === 'string' ? fixtureResponse.stderr : '',
    error: typeof fixtureResponse.error === 'string' ? new Error(fixtureResponse.error) : null,
    ...(typeof fixtureResponse.mutationPerformed === 'boolean' ? { mutationPerformed: fixtureResponse.mutationPerformed } : {}),
  }
}

function argumentValue(args: readonly string[], flag: string): string | null {
  const index = args.indexOf(flag)
  return index >= 0 ? args[index + 1] ?? null : null
}

function endpoint(args: readonly string[]): string | null {
  return args.find((value) => value.startsWith('repos/')) ?? null
}

const SYNTHETIC_COMMENT_EPOCH = Date.UTC(2026, 0, 1)

function syntheticCommentCreatedAt(comment: FixtureComment): string {
  const id = Number(comment.id)
  if (!Number.isSafeInteger(id) || id < 0) {
    throw new SyntheticEvidenceConfigurationError(`synthetic evidence comment id is not a safe integer: ${comment.id}`)
  }
  return new Date(SYNTHETIC_COMMENT_EPOCH + id).toISOString()
}

function githubComment(comment: FixtureComment): Record<string, unknown> {
  return {
    id: comment.id,
    body: comment.body,
    url: comment.url,
    html_url: comment.url,
    createdAt: comment.createdAt ?? syntheticCommentCreatedAt(comment),
    author: comment.author ?? { login: 'synthetic-tester' },
    authorAssociation: comment.authorAssociation ?? 'NONE',
  }
}

function issueResponse(fixture: SyntheticEvidenceFixture, profile: FixtureProfile, args: readonly string[]): SyntheticCommandResult {
  const issueNumber = args[2]
  const repo = argumentValue(args, '--repo')
  if (issueNumber !== SYNTHETIC_ISSUE_NUMBER || repo !== fixture.repository || String(profile.issue.number) !== SYNTHETIC_ISSUE_NUMBER) {
    return failure('synthetic evidence fixture Issue #648 identity mismatch')
  }
  return success({
    ...profile.issue,
    comments: fixture.comments.map(githubComment),
  })
}

function commentsResponse(fixture: SyntheticEvidenceFixture, args: readonly string[]): SyntheticCommandResult {
  const target = endpoint(args)
  if (target !== `repos/${fixture.repository}/issues/${SYNTHETIC_ISSUE_NUMBER}/comments`) {
    return failure('synthetic evidence fixture comment endpoint must be Issue #648')
  }
  return success([fixture.comments.map(githubComment)])
}

function postComment(fixturePath: string, evidenceRoot: string, fixture: SyntheticEvidenceFixture, args: readonly string[], input: string | undefined): SyntheticCommandResult {
  const target = endpoint(args)
  if (target !== `repos/${fixture.repository}/issues/${SYNTHETIC_ISSUE_NUMBER}/comments` || !input) {
    return failure('synthetic evidence fixture POST endpoint must be Issue #648')
  }
  let payload: unknown
  try {
    payload = JSON.parse(input)
  } catch {
    return failure('synthetic evidence fixture POST input is not JSON')
  }
  if (!isRecord(payload) || typeof payload.body !== 'string' || payload.body.trim() === '') {
    return failure('synthetic evidence fixture POST body is malformed')
  }
  const id = String(fixture.next_comment_id)
  fixture.next_comment_id += 1
  fixture.comments.push({
    id,
    body: payload.body,
    url: `https://github.com/${fixture.repository}/issues/${SYNTHETIC_ISSUE_NUMBER}#issuecomment-${id}`,
    createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, 0, Number(id))).toISOString(),
  })
  ownedFixtureRoot(fixturePath, evidenceRoot)
  writeFileSync(fixturePath, `${JSON.stringify(fixture, null, 2)}\n`)
  return success({ id }, true)
}

export function createSyntheticEvidenceRunner({
  env = process.env,
  runNative,
}: {
  env?: NodeJS.ProcessEnv
  runNative: SyntheticCommandRunner
}): SyntheticCommandRunner {
  const fixtureConfiguration = fixturePathFromEnv(env)
  if (!fixtureConfiguration) return runNative
  const { path: fixturePath, root: evidenceRoot } = fixtureConfiguration

  return (command, args, options = {}) => {
    if (command !== 'gh') return runNative(command, args, options)
    const fixture = readFixture(fixturePath, evidenceRoot)
    const profile = fixture.profiles[fixture.active_profile]!

    if (args[0] === 'repo' && args[1] === 'view') return success({ nameWithOwner: fixture.repository })
    if (args[0] === 'issue' && args[1] === 'view') return issueResponse(fixture, profile, args)
    if (args[0] === 'api' && args.includes('--method') && args[args.indexOf('--method') + 1] === 'POST') {
      return postComment(fixturePath, evidenceRoot, fixture, args, options.input)
    }
    if (args[0] === 'api' && args.includes('--paginate') && endpoint(args)?.endsWith('/comments')) {
      return commentsResponse(fixture, args)
    }

    const configured = profile.responses[JSON.stringify(args)]
    if (configured === undefined) return failure(`synthetic evidence fixture has no response for gh ${args.join(' ')}`)
    return response(configured)
  }
}
