import { spawnSync } from 'node:child_process'

import type { ActivePullRequestEvidence, ContextDecision, NormalizedContextEvidence, RepositoryEvidence, RoleEvidence } from './model.ts'
import { parseHandoffBody, renderHandoffComment, type HandoffRecord } from '../handoff/schema.ts'
import { hasCurrentHandoffReviewVerdict } from './semantic-review-evidence.ts'
import { handoffIdentityStatus } from './handoff-identity-status.ts'

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
  staleCurrentSafetyOverlay: boolean
  invalidCurrentFix: HandoffCandidate | null
  superseding: HandoffCandidate | null
}
export type HandoffCandidate = { evidence: RoleEvidence; record: HandoffRecord }
export function isExactIssueCommentUrl(
  value: string,
  comment: RoleEvidence,
  evidence: NormalizedContextEvidence,
): boolean {
  if (value !== comment.url || !isPositiveInteger(comment.id)) return false
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

export function hasBlockingHandoffReview(
  handoff: HandoffRecord, evidence: NormalizedContextEvidence,
  activePr: ActivePullRequestEvidence,
  allowPublicationEraReviewRecovery = false,
): boolean {
  return hasCurrentHandoffReviewVerdict(handoff, evidence, activePr, 'FIX', 'CORRECTION REQUIRED', allowPublicationEraReviewRecovery)
}

function hasEligibleFounderHandoffReview(
  handoff: HandoffRecord, evidence: NormalizedContextEvidence,
  activePr: ActivePullRequestEvidence,
): boolean {
  return hasCurrentHandoffReviewVerdict(handoff, evidence, activePr, 'FOUNDER_GATE', 'ELIGIBLE FOR FOUNDER REVIEW')
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
  if (resolution.staleCurrentSafetyOverlay && resolution.applicable.length > 0) {
    return {
      reason: `EVIDENCE_CONFLICT: stale or wrong-identity current-head HANDOFF records at ${head}.`,
      nextAction: { type: 'STOP', command: null, description: 'Resolve stale or wrong-identity current-head HANDOFF evidence before continuing.' },
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

export function extractHandoffPayload(body: string): unknown | null {
  const match = body.match(/```json\s*([\s\S]*?)```/i)
  if (!match) return null
  try {
    return JSON.parse(match[1] ?? '')
  } catch {
    return null
  }
}

function resolveSupersedingHandoff(
  applicable: HandoffCandidate[], evidence: NormalizedContextEvidence,
  activePr: ActivePullRequestEvidence,
  allowPublicationEraReviewRecovery = false,
): HandoffCandidate | null {
  if (applicable.length !== 2) return null

  const verifying = applicable.filter(({ record }) => record.route === 'VERIFY')
  const safetyStops = applicable.filter(({ record }) => record.route === 'STOP')
  if (verifying.length === 1 && safetyStops.length === 1) {
    const verify = verifying[0]!
    const safetyStop = safetyStops[0]!
    const explicitStopBlockers = safetyStop.record.verified_evidence.filter(({ kind }) => kind === 'stop-blocker')
    const uniqueNativeComments = String(verify.evidence.id) !== String(safetyStop.evidence.id) && verify.evidence.url !== safetyStop.evidence.url &&
      isExactIssueCommentUrl(verify.evidence.url, verify.evidence, evidence) && isExactIssueCommentUrl(safetyStop.evidence.url, safetyStop.evidence, evidence)
    if (safetyStop.record.schema_version === 3 && explicitStopBlockers.length > 0 && uniqueNativeComments) return safetyStop
  }

  if (!applicable.some(({ record }) => record.route === 'REVIEW' || record.route === 'VERIFY')) return null
  return applicable.find(({ record }) => record.route === 'FIX'
    ? hasBlockingHandoffReview(record, evidence, activePr, allowPublicationEraReviewRecovery)
    : record.route === 'FOUNDER_GATE' && hasEligibleFounderHandoffReview(record, evidence, activePr)) ?? null
}

export function resolveApplicableHandoffs(
  evidence: NormalizedContextEvidence,
  activePr: ActivePullRequestEvidence,
  allowPublicationEraReviewRecovery = false,
): HandoffResolution {
  const candidates = evidence.durableContext.handoffs ??
    (evidence.durableContext.latestHandoff ? [evidence.durableContext.latestHandoff] : [])
  const applicable: HandoffResolution['applicable'] = []
  const malformedCurrent: RoleEvidence[] = []
  let staleCurrentSafetyOverlay = false

  for (const candidate of candidates) {
    const payload = extractHandoffPayload(candidate.body)
    const status = handoffIdentityStatus(payload, evidence, activePr, candidate)
    if (status === 'malformed-current') {
      malformedCurrent.push(candidate)
      continue
    }
    if (status !== 'current') {
      if (status === 'stale' && isRecord(payload) && typeof payload.exact_head === 'string' &&
          payload.exact_head.toLowerCase() === activePr.headSha.toLowerCase() &&
          (payload.route === 'VERIFY' || payload.route === 'STOP')) {
        staleCurrentSafetyOverlay = true
      }
      continue
    }

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
    if (allowPublicationEraReviewRecovery && handoff.route === 'FIX' &&
      !hasBlockingHandoffReview(handoff, evidence, activePr) &&
      !isExactIssueCommentUrl(candidate.url, candidate, evidence)) {
      malformedCurrent.push(candidate)
      continue
    }

    applicable.push({ evidence: candidate, record: handoff })
  }

  const invalidCurrentFix = applicable.find(({ record }) =>
    record.route === 'FIX' && !hasBlockingHandoffReview(record, evidence, activePr, allowPublicationEraReviewRecovery),
  ) ?? null
  return {
    applicable,
    malformedCurrent,
    staleCurrentSafetyOverlay,
    invalidCurrentFix,
    superseding: resolveSupersedingHandoff(applicable, evidence, activePr, allowPublicationEraReviewRecovery),
  }
}
export interface CurrentHandoffResolution {
  record: HandoffRecord | null
  evidence: RoleEvidence | null
  conflict: ReturnType<typeof currentHandoffConflict>
}
export function resolveCurrentHandoff(
  evidence: NormalizedContextEvidence,
  activePr: ActivePullRequestEvidence,
  allowPublicationEraReviewRecovery = false,
): CurrentHandoffResolution {
  const resolution = resolveApplicableHandoffs(evidence, activePr, allowPublicationEraReviewRecovery)
  const conflict = currentHandoffConflict(resolution, activePr.headSha)
  return {
    record: conflict ? null : resolution.superseding?.record ?? resolution.applicable[0]?.record ?? null,
    evidence: conflict ? null : resolution.superseding?.evidence ?? resolution.applicable[0]?.evidence ?? null,
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
  allowPublicationEraReviewRecovery = false,
): boolean {
  return handoff !== null && commentUrl !== null && hasBlockingHandoffReview(handoff, evidence, activePr, allowPublicationEraReviewRecovery) &&
    handoff.verified_evidence.some(({ kind, url }) => kind === 'review-verdict' && url === commentUrl)
}
