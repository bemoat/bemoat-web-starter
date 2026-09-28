import { spawnSync } from 'node:child_process'

import type { ActivePullRequestEvidence, ContextDecision, NormalizedContextEvidence, RepositoryEvidence, RoleEvidence } from './model.ts'
import { parseHandoffBody, renderHandoffComment, type HandoffRecord } from '../handoff/schema.ts'
import { parseProductionMergeReviewVerdict } from './merge-review-verdict.ts'

export interface ContextCommandResult {
  status: number
  stdout: string
  stderr: string
  error: Error | null
}

export type ContextCommandRunner = (
  command: string,
  args: readonly string[],
  options?: { cwd?: string; env?: NodeJS.ProcessEnv },
) => ContextCommandResult

export const runContextCommand: ContextCommandRunner = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? process.cwd(),
    env: options.env ?? process.env,
    encoding: 'utf8',
  })
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    error: result.error ?? null,
  }
}

export function output(result: ContextCommandResult): string | null {
  if (result.status !== 0 || result.error) return null
  return result.stdout.trim()
}

export function failure(result: ContextCommandResult, fallback: string): string {
  return result.error?.message || result.stderr.trim() || result.stdout.trim() || fallback
}

export function json<T>(
  run: ContextCommandRunner,
  command: string,
  args: readonly string[],
  options?: { cwd?: string; env?: NodeJS.ProcessEnv },
): { value: T | null; error: string | null } {
  const result = run(command, args, options)
  const text = output(result)
  if (text === null || text === '') return { value: null, error: failure(result, `${command} returned no evidence`) }
  try {
    return { value: JSON.parse(text) as T, error: null }
  } catch (error) {
    return { value: null, error: `${command} returned invalid JSON: ${error instanceof Error ? error.message : String(error)}` }
  }
}

export function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}

export function isFullSha(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{40}$/i.test(value.trim())
}

export function isPositiveInteger(value: unknown): value is string | number {
  if (typeof value === 'number') return Number.isSafeInteger(value) && value > 0
  return typeof value === 'string' && /^[1-9]\d*$/.test(value.trim())
}

export function isRepositoryObjectUrl(
  value: unknown,
  repo: string,
  kind: 'issues' | 'pull',
  number: string,
): value is string {
  if (typeof value !== 'string' || value.trim() === '') return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' &&
      url.hostname === 'github.com' &&
      url.pathname === `/${repo}/${kind}/${number}`
  } catch {
    return false
  }
}

export function normalizeOriginRepository(origin: string | null): string | null {
  if (!origin) return null
  if (origin.startsWith('git@github.com:')) return origin.slice('git@github.com:'.length).replace(/\.git$/, '')
  if (origin.startsWith('https://github.com/')) return origin.slice('https://github.com/'.length).replace(/\.git$/, '')
  return null
}

export function repositoryEvidence(repo: string): RepositoryEvidence {
  const [owner, name] = repo.split('/')
  return { owner, name, nameWithOwner: repo, url: `https://github.com/${repo}` }
}

export interface HandoffResolution {
  applicable: HandoffCandidate[]
  malformedCurrent: RoleEvidence[]
  invalidCurrentFix: HandoffCandidate | null
  superseding: HandoffCandidate | null
}
export type HandoffCandidate = { evidence: RoleEvidence; record: HandoffRecord }
function isExactIssueCommentUrl(
  value: string,
  comment: RoleEvidence,
  evidence: NormalizedContextEvidence,
): boolean {
  if (value !== comment.url) return false
  try {
    const url = new URL(value)
    return url.origin === 'https://github.com' &&
      url.pathname === `/${evidence.repository.nameWithOwner}/issues/${evidence.issue.number}` &&
      url.search === '' &&
      url.hash === `#issuecomment-${String(comment.id)}`
  } catch {
    return false
  }
}

function hasCurrentReviewVerdict(
  handoff: HandoffRecord,
  evidence: NormalizedContextEvidence,
  activePr: ActivePullRequestEvidence,
  route: 'FIX' | 'FOUNDER_GATE',
  requiredVerdict: 'CORRECTION REQUIRED' | 'ELIGIBLE FOR FOUNDER REVIEW',
): boolean {
  if (
    handoff.route !== route || handoff.branch !== activePr.headBranch ||
    handoff.protected_base.branch !== activePr.baseBranch ||
    handoff.protected_base.sha.toLowerCase() !== activePr.baseSha.toLowerCase() ||
    handoff.pr === null || handoff.pr.base !== activePr.baseBranch ||
    handoff.pr.head !== activePr.headBranch || handoff.pr.head_sha.toLowerCase() !== activePr.headSha.toLowerCase()
  ) return false

  const references = handoff.verified_evidence.filter(({ kind }) => kind === 'review-verdict')
  if (references.length !== 1) return false
  const reference = references[0]
  if (!reference?.url) return false

  const comments = evidence.durableContext.historicalResults.filter((comment) =>
    comment.url === reference.url && isExactIssueCommentUrl(reference.url!, comment, evidence))
  if (comments.length !== 1) return false
  const comment = comments[0]
  if (!comment || !/^##\s+REVIEW_VERDICT\b/i.test(comment.body)) return false

  try {
    const verdict = parseProductionMergeReviewVerdict(comment.body, comment.id)
    return verdict.verdict === requiredVerdict && verdict.non_superseded === true &&
      verdict.repository === evidence.repository.nameWithOwner.toLowerCase() &&
      String(verdict.issue) === evidence.issue.number && String(verdict.pr) === activePr.number &&
      verdict.base === activePr.baseBranch &&
      verdict.reviewed_head?.toLowerCase() === activePr.headSha.toLowerCase()
  } catch {
    return false
  }
}

export function hasBlockingHandoffReview(
  handoff: HandoffRecord, evidence: NormalizedContextEvidence,
  activePr: ActivePullRequestEvidence,
): boolean {
  return hasCurrentReviewVerdict(handoff, evidence, activePr, 'FIX', 'CORRECTION REQUIRED')
}

function hasEligibleFounderHandoffReview(
  handoff: HandoffRecord, evidence: NormalizedContextEvidence,
  activePr: ActivePullRequestEvidence,
): boolean {
  return hasCurrentReviewVerdict(handoff, evidence, activePr, 'FOUNDER_GATE', 'ELIGIBLE FOR FOUNDER REVIEW')
}

export function currentHandoffConflict(
  resolution: HandoffResolution,
  head: string,
): { reason: string; nextAction: ContextDecision['nextAction'] } | null {
  if (resolution.malformedCurrent.length > 0) {
    return {
      reason: `EVIDENCE_CONFLICT: malformed current-head HANDOFF evidence at ${head}.`,
      nextAction: {
        type: 'STOP',
        command: null,
        description: 'Resolve the malformed current-head HANDOFF evidence before continuing.',
      },
    }
  }
  if (resolution.invalidCurrentFix) {
    return {
      reason: `EVIDENCE_CONFLICT: current-head HANDOFF FIX lacks a valid exact-head review-verdict lineage at ${head}.`,
      nextAction: {
        type: 'STOP',
        command: null,
        description: 'Resolve the current HANDOFF FIX review-verdict lineage before continuing.',
      },
    }
  }
  if (resolution.applicable.length > 1 && !resolution.superseding) {
    return {
      reason: `EVIDENCE_CONFLICT: multiple applicable current-head HANDOFF records at ${head}.`,
      nextAction: {
        type: 'STOP',
        command: null,
        description: 'Resolve competing current-head HANDOFF records before continuing.',
      },
    }
  }
  return null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function extractHandoffPayload(body: string): unknown | null {
  const match = body.match(/```json\s*([\s\S]*?)```/i)
  if (!match) return null
  try {
    return JSON.parse(match[1] ?? '')
  } catch {
    return null
  }
}

function isIdentityString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function compareIdentityValue(
  payload: Record<string, unknown>,
  key: string,
  expected: string,
  valid: (value: unknown) => boolean = isIdentityString,
  normalizeSha = false,
): { recognized: boolean; malformed: boolean; mismatch: boolean } {
  if (!(key in payload)) return { recognized: false, malformed: true, mismatch: false }
  const value = payload[key]
  if (typeof value !== 'string' || !valid(value)) return { recognized: true, malformed: true, mismatch: false }
  const actual = normalizeSha ? value.toLowerCase() : value
  const wanted = normalizeSha ? expected.toLowerCase() : expected
  return { recognized: true, malformed: false, mismatch: actual !== wanted }
}

function handoffIdentityStatus(
  payload: unknown,
  evidence: NormalizedContextEvidence,
  activePr: ActivePullRequestEvidence,
): 'current' | 'stale' | 'unknown' | 'malformed-current' {
  if (!isRecord(payload)) return 'unknown'

  const positiveIntegerString = (value: unknown) => typeof value === 'string' && /^[1-9]\d*$/.test(value)
  const fullShaString = (value: unknown) => typeof value === 'string' && /^[0-9a-f]{40}$/i.test(value)
  const repositoryString = (value: unknown) => isIdentityString(value) && /^[^/\s:]+\/[^/\s:]+$/.test(value)
  const pullRequestUrl = (value: unknown) => isIdentityString(value) && /^https:\/\/github\.com\/[^/?#\s:]+\/[^/?#\s:]+\/pull\/[1-9]\d*$/.test(value)
  let recognized = false
  let matched = false
  let malformed = false
  let mismatch = false
  const compare = (result: { recognized: boolean; malformed: boolean; mismatch: boolean }) => {
    recognized ||= result.recognized
    matched ||= result.recognized && !result.malformed && !result.mismatch
    malformed ||= result.malformed
    mismatch ||= result.mismatch
  }

  compare(compareIdentityValue(payload, 'repository', evidence.repository.nameWithOwner, repositoryString))
  compare(compareIdentityValue(payload, 'issue_number', evidence.issue.number, positiveIntegerString))
  compare(compareIdentityValue(payload, 'branch', activePr.headBranch))
  compare(compareIdentityValue(payload, 'exact_head', activePr.headSha, fullShaString, true))

  if (isRecord(payload.protected_base)) {
    compare(compareIdentityValue(payload.protected_base, 'branch', activePr.baseBranch))
    compare(compareIdentityValue(payload.protected_base, 'sha', activePr.baseSha, fullShaString, true))
  } else {
    recognized ||= 'protected_base' in payload
    malformed = true
  }

  if (isRecord(payload.pr)) {
    compare(compareIdentityValue(payload.pr, 'number', activePr.number, positiveIntegerString))
    compare(compareIdentityValue(payload.pr, 'url', activePr.url, pullRequestUrl))
    compare(compareIdentityValue(payload.pr, 'base', activePr.baseBranch))
    compare(compareIdentityValue(payload.pr, 'head', activePr.headBranch))
    compare(compareIdentityValue(payload.pr, 'head_sha', activePr.headSha, fullShaString, true))
  } else {
    recognized ||= 'pr' in payload
    malformed = true
  }

  if (mismatch) return 'stale'
  if (recognized && matched && malformed) return 'malformed-current'
  if (recognized && matched) return 'current'
  return 'unknown'
}
function resolveSupersedingHandoff(
  applicable: HandoffCandidate[], evidence: NormalizedContextEvidence,
  activePr: ActivePullRequestEvidence,
): HandoffCandidate | null {
  if (applicable.length !== 2 || !applicable.some(({ record }) => record.route === 'REVIEW')) return null
  return applicable.find(({ record }) => record.route === 'FIX'
    ? hasBlockingHandoffReview(record, evidence, activePr)
    : record.route === 'FOUNDER_GATE' && hasEligibleFounderHandoffReview(record, evidence, activePr)) ?? null
}

export function resolveApplicableHandoffs(
  evidence: NormalizedContextEvidence,
  activePr: ActivePullRequestEvidence,
): HandoffResolution {
  const candidates = evidence.durableContext.handoffs ??
    (evidence.durableContext.latestHandoff ? [evidence.durableContext.latestHandoff] : [])
  const applicable: HandoffResolution['applicable'] = []
  const malformedCurrent: RoleEvidence[] = []

  for (const candidate of candidates) {
    const payload = extractHandoffPayload(candidate.body)
    const status = handoffIdentityStatus(payload, evidence, activePr)
    if (status === 'malformed-current') {
      malformedCurrent.push(candidate)
      continue
    }
    if (status !== 'current') continue

    let handoff: HandoffRecord | null = null
    try {
      handoff = parseHandoffBody(isRecord(payload) ? JSON.stringify(payload) : '')
    } catch {
      handoff = null
    }

    if (
      !handoff ||
      handoff.pr === null ||
      !handoff.local_durability.durable ||
      renderHandoffComment(handoff) !== candidate.body
    ) {
      malformedCurrent.push(candidate)
      continue
    }

    applicable.push({ evidence: candidate, record: handoff })
  }

  const invalidCurrentFix = applicable.find(({ record }) =>
    record.route === 'FIX' && !hasBlockingHandoffReview(record, evidence, activePr),
  ) ?? null
  return {
    applicable,
    malformedCurrent,
    invalidCurrentFix,
    superseding: resolveSupersedingHandoff(applicable, evidence, activePr),
  }
}

export interface CurrentHandoffResolution {
  record: HandoffRecord | null
  conflict: ReturnType<typeof currentHandoffConflict>
}

export function resolveCurrentHandoff(
  evidence: NormalizedContextEvidence,
  activePr: ActivePullRequestEvidence,
): CurrentHandoffResolution {
  const resolution = resolveApplicableHandoffs(evidence, activePr)
  const conflict = currentHandoffConflict(resolution, activePr.headSha)
  return {
    record: conflict ? null : resolution.superseding?.record ?? resolution.applicable[0]?.record ?? null,
    conflict,
  }
}

export function parseApplicableHandoff(
  evidence: NormalizedContextEvidence,
  activePr: ActivePullRequestEvidence,
): HandoffRecord | null {
  const resolution = resolveApplicableHandoffs(evidence, activePr)
  return resolution.malformedCurrent.length === 0 && (
    resolution.applicable.length === 1 || resolution.superseding !== null
  )
    ? resolution.superseding?.record ?? resolution.applicable[0]?.record ?? null
    : null
}

export function isCurrentHandoffReviewVerdict(
  handoff: HandoffRecord | null,
  evidence: NormalizedContextEvidence,
  activePr: ActivePullRequestEvidence,
  commentUrl: string | null,
): boolean {
  return handoff !== null && commentUrl !== null && hasBlockingHandoffReview(handoff, evidence, activePr) &&
    handoff.verified_evidence.some(({ kind, url }) => kind === 'review-verdict' && url === commentUrl)
}
