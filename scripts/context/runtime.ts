import { spawnSync } from 'node:child_process'

import type { ActivePullRequestEvidence, ContextDecision, NormalizedContextEvidence, RepositoryEvidence, RoleEvidence } from './model.ts'
import { parseHandoffBody, renderHandoffComment, type HandoffRecord } from '../handoff/schema.ts'

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
  applicable: Array<{ evidence: RoleEvidence; record: HandoffRecord }>
  malformedCurrent: RoleEvidence[]
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
  if (resolution.applicable.length > 1) {
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

function compareIdentityValue(
  payload: Record<string, unknown>,
  key: string,
  expected: string,
  normalizeSha = false,
): { recognized: boolean; complete: boolean; mismatch: boolean } {
  if (!(key in payload)) return { recognized: false, complete: false, mismatch: false }
  const value = payload[key]
  if (typeof value !== 'string' || !value.trim()) return { recognized: true, complete: false, mismatch: true }
  const left = normalizeSha ? value.toLowerCase() : value
  const right = normalizeSha ? expected.toLowerCase() : expected
  return { recognized: true, complete: true, mismatch: left !== right }
}

function handoffIdentityStatus(
  payload: unknown,
  evidence: NormalizedContextEvidence,
  activePr: ActivePullRequestEvidence,
): 'current' | 'stale' | 'unknown' {
  if (!isRecord(payload)) return 'unknown'

  let recognized = false
  let complete = true
  let mismatch = false
  const compare = (result: { recognized: boolean; complete: boolean; mismatch: boolean }) => {
    recognized ||= result.recognized
    complete &&= result.complete
    mismatch ||= result.mismatch
  }

  compare(compareIdentityValue(payload, 'repository', evidence.repository.nameWithOwner))
  compare(compareIdentityValue(payload, 'issue_number', evidence.issue.number))
  compare(compareIdentityValue(payload, 'branch', activePr.headBranch))
  const head = compareIdentityValue(payload, 'exact_head', activePr.headSha, true)
  if (head.recognized && head.complete && !isFullSha(payload.exact_head)) {
    head.complete = false
    head.mismatch = true
  }
  compare(head)

  const protectedBase = payload.protected_base
  if (!isRecord(protectedBase)) {
    complete = false
  } else {
    const baseBranch = compareIdentityValue(protectedBase, 'branch', activePr.baseBranch)
    const baseSha = compareIdentityValue(protectedBase, 'sha', activePr.baseSha, true)
    if (baseSha.recognized && baseSha.complete && !isFullSha(protectedBase.sha)) {
      baseSha.complete = false
      baseSha.mismatch = true
    }
    compare(baseBranch)
    compare(baseSha)
  }

  const pr = payload.pr
  if (pr === null) {
    recognized = true
    complete = false
  } else if (!isRecord(pr)) {
    recognized = true
    complete = false
    mismatch = true
  } else {
    compare(compareIdentityValue(pr, 'number', activePr.number))
    compare(compareIdentityValue(pr, 'url', activePr.url))
    compare(compareIdentityValue(pr, 'base', activePr.baseBranch))
    compare(compareIdentityValue(pr, 'head', activePr.headBranch))
    const prHead = compareIdentityValue(pr, 'head_sha', activePr.headSha, true)
    if (prHead.recognized && prHead.complete && !isFullSha(pr.head_sha)) {
      prHead.complete = false
      prHead.mismatch = true
    }
    compare(prHead)
  }

  if (mismatch) return 'stale'
  if (recognized && complete) return 'current'
  return 'unknown'
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

  return { applicable, malformedCurrent }
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
  return { record: conflict ? null : resolution.applicable[0]?.record ?? null, conflict }
}

export function parseApplicableHandoff(
  evidence: NormalizedContextEvidence,
  activePr: ActivePullRequestEvidence,
): HandoffRecord | null {
  const resolution = resolveApplicableHandoffs(evidence, activePr)
  return resolution.applicable.length === 1 && resolution.malformedCurrent.length === 0
    ? resolution.applicable[0]?.record ?? null
    : null
}

export function hasBlockingHandoffReview(handoff: HandoffRecord, activePr: ActivePullRequestEvidence): boolean {
  return handoff.route === 'FIX' && handoff.verified_evidence.some(({ kind, value, url }) =>
    kind.trim().toLowerCase() === 'review' &&
    value.trim() !== '' &&
    url === activePr.url,
  )
}
