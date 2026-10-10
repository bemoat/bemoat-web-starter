import { lstatSync, realpathSync, statSync } from 'node:fs'
import { basename, dirname, isAbsolute, relative, resolve } from 'node:path'

import { COMMITTED_WIP_BINDING } from './committed-wip-recovery.ts'
import { isFullSha, normalizeOriginRepository, output, type ContextCommandRunner } from './runtime.ts'
import { BASE_BRANCH, REPOSITORY } from './trusted-source-bootstrap-contract.ts'

export interface PullRequest {
  number?: number
  state?: string
  merged_at?: string | null
  merge_commit_sha?: string | null
  title?: string
  body?: string | null
  base?: { ref?: string; repo?: { full_name?: string } | null }
  head?: { ref?: string; sha?: string; repo?: { full_name?: string } | null }
}

export interface SourceIdentity {
  root: string
  branch: string
  head: string
}

interface LiveRef {
  sha: string | null
  reason: string | null
}

interface CompareEvidence {
  status?: string
  ahead_by?: number
  behind_by?: number
  base_commit?: { sha?: string }
  merge_base_commit?: { sha?: string }
}

export interface DestinationIdentity {
  root: string
  head: string
  commonDir: string
}

export function runText(run: ContextCommandRunner, cwd: string, command: string, args: string[]): string | null {
  return output(run(command, args, { cwd }))
}

export function parseJsonLine(stdout: string): Record<string, unknown> | null {
  const line = stdout.trim().split(/\r?\n/).reverse().find((row) => row.startsWith('{'))
  if (!line) return null
  try {
    const value: unknown = JSON.parse(line)
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : null
  } catch {
    return null
  }
}

function exactLiveRef({ cwd, branch, run }: {
  cwd: string
  branch: string
  run: ContextCommandRunner
}): LiveRef {
  const github = run('gh', ['api', `repos/${REPOSITORY}/git/ref/heads/${encodeURIComponent(branch)}`], { cwd })
  if (github.status !== 0 || github.error) return { sha: null, reason: 'GitHub ref read is unavailable.' }
  let githubSha: string | null = null
  try {
    const payload = JSON.parse(github.stdout.trim()) as { object?: { sha?: unknown } }
    if (isFullSha(payload.object?.sha)) githubSha = payload.object.sha.toLowerCase()
  } catch {
    return { sha: null, reason: 'GitHub ref returned malformed JSON.' }
  }
  if (!githubSha) return { sha: null, reason: 'GitHub ref did not contain a full commit SHA.' }

  const remote = run('git', ['ls-remote', '--heads', 'origin', `refs/heads/${branch}`], { cwd })
  if (remote.status !== 0 || remote.error) return { sha: null, reason: 'git ls-remote could not read the exact origin ref.' }
  const rows = remote.stdout.trim().split(/\r?\n/).filter(Boolean)
  if (rows.length !== 1) return { sha: null, reason: 'The live origin ref is missing or ambiguous.' }
  const match = rows[0]!.match(/^([0-9a-f]{40})\s+refs\/heads\/([^\s]+)$/i)
  if (!match || match[2] !== branch || match[1]!.toLowerCase() !== githubSha) {
    return { sha: null, reason: 'GitHub and origin refs disagree or identify the wrong branch.' }
  }
  return { sha: githubSha, reason: null }
}

export function canonicalExistingDirectory(path: string): string | null {
  try {
    const canonical = realpathSync(path)
    if (!statSync(canonical).isDirectory()) return null
    return canonical
  } catch {
    return null
  }
}

export function canonicalDestination(path: string): { canonical: string; exists: boolean; reason: string | null } {
  if (!isAbsolute(path)) return { canonical: '', exists: false, reason: 'Destination must be an explicit absolute path.' }
  const requested = resolve(path)
  try {
    const entry = lstatSync(requested)
    if (entry.isSymbolicLink()) return { canonical: '', exists: true, reason: 'Destination is a symbolic link; preserve it and stop.' }
    if (!entry.isDirectory()) return { canonical: '', exists: true, reason: 'Destination exists but is not a directory; preserve it and stop.' }
    const canonical = realpathSync(requested)
    return { canonical, exists: true, reason: null }
  } catch (error) {
    if (!isMissingPath(error)) return { canonical: '', exists: false, reason: 'Destination state could not be read safely.' }
  }

  try {
    const parent = realpathSync(dirname(requested))
    if (!statSync(parent).isDirectory()) return { canonical: '', exists: false, reason: 'Destination parent must already exist as a directory.' }
    return { canonical: resolve(parent, basename(requested)), exists: false, reason: null }
  } catch {
    return { canonical: '', exists: false, reason: 'Destination parent must already exist and be canonicalizable.' }
  }
}

function isMissingPath(error: unknown): boolean {
  return error !== null && typeof error === 'object' && 'code' in error && (error as { code?: unknown }).code === 'ENOENT'
}

export function pathsOverlap(left: string, right: string): boolean {
  const rel = relative(left, right)
  return rel === '' || (!rel.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) && rel !== '..' && !isAbsolute(rel))
}

export function rootsOverlap(left: string, right: string): boolean {
  return pathsOverlap(left, right) || pathsOverlap(right, left)
}

function gitCommonDir(run: ContextCommandRunner, cwd: string): string | null {
  const value = runText(run, cwd, 'git', ['rev-parse', '--git-common-dir'])
  if (!value) return null
  const absolute = resolve(cwd, value)
  // Git normally reports an existing common directory. Resolve symlinks where
  // possible so a linked-worktree alias cannot look independent; resolve()
  // still gives injected runners and Git implementations with virtual paths a
  // stable absolute comparison key.
  try { return realpathSync(absolute) } catch { return absolute }
}

export function verifyMainOnlyApprovedBase({ cwd, run }: {
  cwd: string
  run: ContextCommandRunner
}): string | null {
  const github = run('gh', ['api', `repos/${REPOSITORY}/git/ref/heads/dev`], { cwd })
  let githubProvesDevAbsent = false
  if (github.status === 0 && !github.error) {
    try {
      const payload = JSON.parse(github.stdout.trim()) as { object?: { sha?: unknown } }
      if (isFullSha(payload.object?.sha)) return 'A live GitHub dev ref exists, so main is not the approved base.'
      return 'GitHub dev ref response is malformed; approved-base absence is not proven.'
    } catch {
      return 'GitHub dev ref response is malformed; approved-base absence is not proven.'
    }
  }
  const githubFailure = `${github.stderr}\n${github.stdout}\n${github.error?.message ?? ''}`
  if (github.status !== 1 || github.error || !/(?:not found|http\s*404|does not exist)/i.test(githubFailure)) {
    return 'GitHub could not prove whether dev exists; approved-base absence is not proven.'
  }
  githubProvesDevAbsent = true

  const origin = run('git', ['ls-remote', '--heads', 'origin', 'refs/heads/dev'], { cwd })
  if (origin.status !== 0 || origin.error) return 'git ls-remote could not prove whether origin/dev exists.'
  const rows = origin.stdout.trim().split(/\r?\n/).filter(Boolean)
  if (rows.length > 0) return 'A live origin dev ref exists or is ambiguous, so main is not the approved base.'
  if (!githubProvesDevAbsent) return 'GitHub and origin do not both prove that dev is absent.'
  return null
}

export function verifySource({ sourceCwd, run, expectedBranch, expectedHead }: {
  sourceCwd: string
  run: ContextCommandRunner
  expectedBranch?: string
  expectedHead?: string
}): { source: SourceIdentity | null; reason: string | null } {
  const root = runText(run, sourceCwd, 'git', ['rev-parse', '--show-toplevel'])
  const head = runText(run, sourceCwd, 'git', ['rev-parse', 'HEAD'])?.toLowerCase() ?? null
  const branch = runText(run, sourceCwd, 'git', ['symbolic-ref', '--quiet', '--short', 'HEAD'])
  const status = runText(run, sourceCwd, 'git', ['status', '--porcelain=v1', '--untracked-files=all'])
  const origin = normalizeOriginRepository(runText(run, sourceCwd, 'git', ['remote', 'get-url', 'origin']))
  if (root !== sourceCwd) return { source: null, reason: 'The #630 command source is not the exact canonical Git root.' }
  if (!branch) return { source: null, reason: 'The #630 command source must be attached to its merged PR branch.' }
  if (status !== '') return { source: null, reason: 'The #630 command source is dirty or its status is unavailable.' }
  if (origin !== REPOSITORY) return { source: null, reason: 'The #630 command source origin is not the canonical repository.' }
  if (!head || !isFullSha(head)) return { source: null, reason: 'The #630 command source HEAD is missing or malformed.' }
  if (expectedBranch && branch !== expectedBranch) return { source: null, reason: 'The #630 source branch changed during bootstrap.' }
  if (expectedHead && head !== expectedHead.toLowerCase()) return { source: null, reason: 'The #630 source HEAD changed during bootstrap.' }
  return { source: { root, branch, head }, reason: null }
}

export function verifyIssue627Target({ targetCwd, sourceCwd, run }: {
  targetCwd: string
  sourceCwd: string
  run: ContextCommandRunner
}): string | null {
  const binding = COMMITTED_WIP_BINDING
  const root = runText(run, targetCwd, 'git', ['rev-parse', '--show-toplevel'])
  const head = runText(run, targetCwd, 'git', ['rev-parse', 'HEAD'])?.toLowerCase()
  const tree = runText(run, targetCwd, 'git', ['rev-parse', 'HEAD^{tree}'])?.toLowerCase()
  const branch = runText(run, targetCwd, 'git', ['symbolic-ref', '--quiet', '--short', 'HEAD'])
  const status = runText(run, targetCwd, 'git', ['status', '--porcelain=v1', '--untracked-files=all'])
  const origin = normalizeOriginRepository(runText(run, targetCwd, 'git', ['remote', 'get-url', 'origin']))
  const upstream = runText(run, targetCwd, 'git', ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'])
  if (root !== targetCwd) return 'The explicit #627 target is not its canonical Git root.'
  if (rootsOverlap(sourceCwd, targetCwd)) return 'The explicit #627 target overlaps the #630 command source.'
  if (status !== '') return 'The explicit #627 target is dirty or its status is unavailable.'
  if (origin !== binding.repository) return 'The explicit #627 target origin is not canonical.'
  if (head !== binding.wipHead || tree !== binding.wipTree) return 'The explicit #627 target differs from the immutable B/tree binding.'
  if (branch !== binding.branch) return 'The explicit #627 target is detached or attached to the wrong branch.'
  if (upstream !== `origin/${binding.branch}`) return 'The explicit #627 target upstream is not exactly origin/the bound branch.'
  const live = exactLiveRef({ cwd: targetCwd, branch: binding.branch, run })
  if (!live.sha || live.sha !== binding.wipHead) return live.reason ?? 'The exact live #627 target ref differs from immutable B.'
  return null
}

export function readPullRequest({ cwd, prNumber, source, run }: {
  cwd: string
  prNumber: string
  source: SourceIdentity
  run: ContextCommandRunner
}): { pr: PullRequest | null; mergeCommit: string | null; reason: string | null } {
  const response = run('gh', ['api', `repos/${REPOSITORY}/pulls/${prNumber}`], { cwd })
  if (response.status !== 0 || response.error) return { pr: null, mergeCommit: null, reason: 'The explicit #630 pull request could not be read from GitHub.' }
  let pr: PullRequest
  try { pr = JSON.parse(response.stdout.trim()) as PullRequest } catch {
    return { pr: null, mergeCommit: null, reason: 'The explicit pull request response is malformed.' }
  }
  const linkedIssue = /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#?630\b|\b(?:part of|refs?)\s+#?630\b/i.test(`${pr.title ?? ''}\n${pr.body ?? ''}`)
  const mergeCommit = typeof pr.merge_commit_sha === 'string' && isFullSha(pr.merge_commit_sha)
    ? pr.merge_commit_sha.toLowerCase()
    : null
  if (String(pr.number) !== prNumber || pr.state !== 'closed' || !pr.merged_at || !mergeCommit ||
      pr.base?.ref !== BASE_BRANCH || pr.base.repo?.full_name !== REPOSITORY ||
      pr.head?.repo?.full_name !== REPOSITORY || pr.head.ref !== source.branch ||
      pr.head.sha?.toLowerCase() !== source.head || !linkedIssue) {
    return { pr, mergeCommit, reason: 'The explicit PR is not the merged #630 PR whose exact current branch and HEAD produced this command invocation.' }
  }
  return { pr, mergeCommit, reason: null }
}

export function verifyMergeOnLiveMain({ cwd, mergeCommit, run }: {
  cwd: string
  mergeCommit: string
  run: ContextCommandRunner
}): { liveMain: string | null; reason: string | null } {
  const live = exactLiveRef({ cwd, branch: BASE_BRANCH, run })
  if (!live.sha) return { liveMain: null, reason: live.reason ?? 'The exact live main ref is unavailable.' }
  const compared = run('gh', ['api', `repos/${REPOSITORY}/compare/${mergeCommit}...${live.sha}`], { cwd })
  if (compared.status !== 0 || compared.error) return { liveMain: null, reason: 'GitHub could not prove the merged correction against exact live main.' }
  let evidence: CompareEvidence
  try { evidence = JSON.parse(compared.stdout.trim()) as CompareEvidence } catch {
    return { liveMain: null, reason: 'GitHub compare evidence for exact live main is malformed.' }
  }
  const ahead = evidence.ahead_by
  const behind = evidence.behind_by
  const validRelation = evidence.status === 'ahead' || evidence.status === 'identical'
  if (!validRelation || !Number.isSafeInteger(ahead) || !Number.isSafeInteger(behind) || behind !== 0 ||
      evidence.base_commit?.sha?.toLowerCase() !== mergeCommit ||
      evidence.merge_base_commit?.sha?.toLowerCase() !== mergeCommit ||
      (evidence.status === 'identical' && ahead !== 0) || (evidence.status === 'ahead' && (ahead ?? 0) < 1)) {
    return { liveMain: null, reason: 'The merged #630 correction is not proven as an ancestor of exact live main.' }
  }
  return { liveMain: live.sha, reason: null }
}

export function validateDestination({ destination, sourceCwd, targetCwd, expectedLiveMain, run }: {
  destination: string
  sourceCwd: string
  targetCwd: string
  expectedLiveMain: string
  run: ContextCommandRunner
}): { identity: DestinationIdentity | null; reason: string | null } {
  const pathState = canonicalDestination(destination)
  if (pathState.reason) return { identity: null, reason: pathState.reason }
  if (rootsOverlap(pathState.canonical, sourceCwd) || rootsOverlap(pathState.canonical, targetCwd)) {
    return { identity: null, reason: 'Destination must be a distinct, non-overlapping root from both #630 and original #627.' }
  }
  if (!pathState.exists) return { identity: null, reason: 'Destination has not been created yet.' }
  const root = runText(run, pathState.canonical, 'git', ['rev-parse', '--show-toplevel'])
  const head = runText(run, pathState.canonical, 'git', ['rev-parse', 'HEAD'])?.toLowerCase()
  const status = runText(run, pathState.canonical, 'git', ['status', '--porcelain=v1', '--untracked-files=all'])
  const branch = runText(run, pathState.canonical, 'git', ['symbolic-ref', '--quiet', '--short', 'HEAD'])
  const origin = normalizeOriginRepository(runText(run, pathState.canonical, 'git', ['remote', 'get-url', 'origin']))
  const upstream = runText(run, pathState.canonical, 'git', ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'])
  const tracking = runText(run, pathState.canonical, 'git', ['rev-parse', '--verify', '--quiet', `refs/remotes/origin/${BASE_BRANCH}`])?.toLowerCase()
  const commonDir = gitCommonDir(run, pathState.canonical)
  if (root !== pathState.canonical) return { identity: null, reason: 'Destination is not one canonical Git root; preserve it and stop.' }
  if (status !== '') return { identity: null, reason: 'Destination is dirty or its status is unavailable; preserve it and stop.' }
  if (origin !== REPOSITORY) return { identity: null, reason: 'Destination origin is not the canonical repository; preserve it and stop.' }
  if (branch !== BASE_BRANCH || upstream !== `origin/${BASE_BRANCH}`) return { identity: null, reason: 'Destination is not an attached main checkout tracking origin/main; preserve it and stop.' }
  if (head !== expectedLiveMain || tracking !== expectedLiveMain) return { identity: null, reason: 'Destination HEAD and local origin/main tracking ref do not equal the exact captured live main SHA; preserve it and stop.' }
  if (!commonDir) return { identity: null, reason: 'Destination Git common directory is unavailable; preserve it and stop.' }
  const sourceCommonDir = gitCommonDir(run, sourceCwd)
  const targetCommonDir = gitCommonDir(run, targetCwd)
  if (!sourceCommonDir || !targetCommonDir) return { identity: null, reason: 'Source or #627 Git common directory is unavailable; preserve destination and stop.' }
  if (commonDir === sourceCommonDir || commonDir === targetCommonDir) {
    return { identity: null, reason: 'Destination is not an independent clone from both the #630 source and original #627 target; preserve it and stop.' }
  }
  const live = exactLiveRef({ cwd: pathState.canonical, branch: BASE_BRANCH, run })
  if (!live.sha || live.sha !== expectedLiveMain) return { identity: null, reason: live.reason ?? 'Destination live main differs from the exact captured SHA.' }
  return { identity: { root, head: head!, commonDir }, reason: null }
}
