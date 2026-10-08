import type { RoleEvidence } from './model.ts'
import { parseIssueDeclarations, deriveWorkflowProfile } from './issue-declarations.ts'
import { parseHandoffBody, renderHandoffComment } from '../handoff/schema.ts'

interface ParsedIssueBody {
  objective: string | null
  scope: string | null
  acceptanceCriteria: string[]
  dependencies: string[]
  taskSize: string | null
  missionControlMode: string | null
  workflowProfile: string | null
}

interface RoleEvidenceResult {
  latestHandoff: RoleEvidence | null
  handoffs: RoleEvidence[]
  historicalResults: RoleEvidence[]
  invalid: RoleEvidence[]
  blockerResolutions: RoleEvidence[]
  invalidBlockerResolutions: RoleEvidence[]
  founderDecisions: RoleEvidence[]
  invalidFounderDecisions: RoleEvidence[]
  founderDecisionRepairs: RoleEvidence[]
  invalidFounderDecisionRepairs: RoleEvidence[]
}

export function isPriorNoPrImplementationHandoff(source: RoleEvidence, payload: unknown, identity: {
  repository: string; issueNumber: string; branch: string; head: string; baseBranch: string
}): boolean {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) || (payload as Record<string, unknown>).pr !== null) return false
  try {
    const record = parseHandoffBody(JSON.stringify(payload))
    const id = String(source.id)
    return record.schema_version === 2 && record.objective_mode === 'implementation' && record.route === 'IMPLEMENT' &&
      record.pr === null && record.local_durability.durable && record.repository === identity.repository &&
      record.issue_number === identity.issueNumber && record.branch === identity.branch &&
      record.exact_head.toLowerCase() === identity.head.toLowerCase() && record.protected_base.branch === identity.baseBranch &&
      renderHandoffComment(record) === source.body && /^[1-9]\d*$/.test(id) &&
      source.url === `https://github.com/${identity.repository}/issues/${identity.issueNumber}#issuecomment-${id}`
  } catch {
    return false
  }
}

export function hasInvalidImplementationHandoffCandidate(
  sources: RoleEvidence[],
  applicable: RoleEvidence[],
  validate: (source: RoleEvidence, payload: Record<string, unknown>) => boolean,
): boolean {
  return sources.some((source) => {
    const match = source.body.match(/```json\s*([\s\S]*?)```/i)
    let payload: unknown = null
    try { payload = match ? JSON.parse(match[1] ?? '') : null } catch { /* malformed HANDOFF stays fail-closed */ }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return /^##\s+HANDOFF\b/im.test(source.body)
    const record = payload as Record<string, unknown>
    if (record.schema_version !== 2 || record.record_type !== 'HANDOFF' || record.route !== 'IMPLEMENT') return false
    const implementationEvidence = Array.isArray(record.verified_evidence) && record.verified_evidence.some((entry) =>
      Boolean(entry) && typeof entry === 'object' && ['focused-tests', 'validation-proof'].includes(String((entry as Record<string, unknown>).kind)))
    if (record.objective_mode === 'read_only') {
      return implementationEvidence && applicable.includes(source) && !validate(source, record)
    }
    return !applicable.includes(source) || !validate(source, record)
  })
}

function sections(body: string): Map<string, string[]> {
  const result = new Map<string, string[]>()
  let current: string | null = null

  for (const line of String(body ?? '').split(/\r?\n/)) {
    const heading = line.match(/^#{2,6}\s+(.+?)\s*#*\s*$/)
    if (heading) {
      current = heading[1].trim().toLowerCase()
      result.set(current, [])
    } else if (current) {
      result.get(current)?.push(line)
    }
  }

  return result
}

function firstParagraph(lines: string[] | undefined): string | null {
  const text = (lines ?? [])
    .join('\n')
    .trim()
    .split(/\n\s*\n/)[0]
    ?.replace(/^~~~[\s\S]*?~~~$/g, '')
    .trim()
  return text || null
}

function listItems(lines: string[] | undefined): string[] {
  return (lines ?? [])
    .map((line) => line.match(/^\s*[-*+]\s+(?:\[[ xX]\]\s*)?(.+?)\s*$/)?.[1])
    .filter((item): item is string => Boolean(item))
}

function matchingSection(map: Map<string, string[]>, pattern: RegExp): string[] | undefined {
  for (const [heading, lines] of map) {
    if (pattern.test(heading)) return lines
  }
  return undefined
}

export function parseIssueBody(body: string): ParsedIssueBody {
  const map = sections(body)
  const decls = parseIssueDeclarations(body)
  const profile = deriveWorkflowProfile(decls)
  return {
    objective: firstParagraph(matchingSection(map, /^(goal|objective)$/)),
    scope: firstParagraph(matchingSection(map, /^scope(?: boundaries)?$/)),
    acceptanceCriteria: listItems(matchingSection(map, /acceptance criteria/)),
    dependencies: listItems(matchingSection(map, /dependenc/)),
    taskSize: decls.taskSize,
    missionControlMode: decls.missionControlMode,
    workflowProfile: profile?.name ?? null,
  }
}

export function parseRoleEvidence(comments: unknown[]): RoleEvidenceResult {
  const handoffs: RoleEvidence[] = []
  const results: RoleEvidence[] = []
  const invalid: RoleEvidence[] = []
  const blockerResolutions: RoleEvidence[] = []
  const invalidBlockerResolutions: RoleEvidence[] = []
  const founderDecisions: RoleEvidence[] = []
  const invalidFounderDecisions: RoleEvidence[] = []
  const founderDecisionRepairs: RoleEvidence[] = []
  const invalidFounderDecisionRepairs: RoleEvidence[] = []

  for (const value of comments) {
    if (!value || typeof value !== 'object') continue
    const comment = value as Partial<RoleEvidence> & Record<string, unknown>
    const author = comment.author && typeof comment.author === 'object'
      ? comment.author as Record<string, unknown>
      : null
    const explicitAuthorLogin = typeof comment.authorLogin === 'string' ? comment.authorLogin : null
    const nestedAuthorLogin = typeof author?.login === 'string' ? author.login : null
    const body = typeof comment.body === 'string' ? comment.body : ''
    const marker = body.match(/^##\s+(HANDOFF|RESULT|REVIEW_VERDICT|BLOCKER_RESOLUTION|FOUNDER_DECISION_REPAIR|FOUNDER_DECISION)\b/i)?.[1]?.toUpperCase()
    if (!marker) continue

    const normalized: RoleEvidence = {
      id: comment.id ?? '',
      body,
      createdAt: typeof comment.createdAt === 'string' ? comment.createdAt : '',
      url: typeof comment.url === 'string' ? comment.url : '',
      ...(marker === 'BLOCKER_RESOLUTION' || marker === 'FOUNDER_DECISION' || marker === 'FOUNDER_DECISION_REPAIR' ? {
        authorLogin: explicitAuthorLogin ?? nestedAuthorLogin,
        authorAssociation: typeof comment.authorAssociation === 'string' ? comment.authorAssociation : null,
        authorIdentityConflict: explicitAuthorLogin !== null && nestedAuthorLogin !== null &&
          explicitAuthorLogin.toLowerCase() !== nestedAuthorLogin.toLowerCase(),
      } : {}),
    }

    if (marker === 'BLOCKER_RESOLUTION') {
      // Resolution authority is checked from native comment author evidence.
      // Its timestamp is deliberately not used for applicability or precedence.
      if (normalized.id === '' || !normalized.url) invalidBlockerResolutions.push(normalized)
      else blockerResolutions.push(normalized)
      continue
    }

    if (marker === 'FOUNDER_DECISION') {
      // Decisions are selected by exact binding and uniqueness, never by time.
      if (normalized.id === '' || !normalized.url) invalidFounderDecisions.push(normalized)
      else founderDecisions.push(normalized)
      continue
    }

    if (marker === 'FOUNDER_DECISION_REPAIR') {
      if (normalized.id === '' || !normalized.url) invalidFounderDecisionRepairs.push(normalized)
      else founderDecisionRepairs.push(normalized)
      continue
    }

    if (!normalized.createdAt || Number.isNaN(Date.parse(normalized.createdAt))) {
      invalid.push(normalized)
      continue
    }

    if (marker === 'HANDOFF') handoffs.push(normalized)
    else results.push(normalized)
  }

  handoffs.sort((left, right) => right.createdAt.localeCompare(left.createdAt))
  results.sort((left, right) => right.createdAt.localeCompare(left.createdAt))

  return {
    latestHandoff: handoffs[0] ?? null,
    handoffs,
    historicalResults: results,
    invalid,
    blockerResolutions,
    invalidBlockerResolutions,
    founderDecisions,
    invalidFounderDecisions,
    founderDecisionRepairs,
    invalidFounderDecisionRepairs,
  }
}
