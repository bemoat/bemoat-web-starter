import type { ContextDecision, NormalizedContextEvidence, RoleEvidence } from './model.ts'
import { resolveStopBlockers } from './blocker-resolution.ts'
import { parseHandoffBody, renderHandoffComment, type HandoffRecord } from '../handoff/schema.ts'
import { extractHandoffPayload, isExactIssueCommentUrl } from './runtime.ts'

type NoPrDecision = Omit<ContextDecision, 'evidenceUrls'>
type ApplicableNoPrHandoff = { source: RoleEvidence; record: HandoffRecord }

function applicableNoPrHandoffs(evidence: NormalizedContextEvidence): ApplicableNoPrHandoff[] {
  const head = evidence.localGit.head
  if (!head) return []
  const candidates = evidence.durableContext.handoffs ??
    (evidence.durableContext.latestHandoff ? [evidence.durableContext.latestHandoff] : [])
  const applicable: ApplicableNoPrHandoff[] = []

  for (const source of candidates) {
    const payload = extractHandoffPayload(source.body)
    try {
      const record = parseHandoffBody(JSON.stringify(payload))
      if (
        (record.route !== 'STOP' || record.schema_version === 3) && record.pr === null &&
        record.repository === evidence.repository.nameWithOwner && record.issue_number === evidence.issue.number &&
        record.branch === evidence.localGit.branch && record.exact_head === head &&
        record.protected_base.branch === evidence.protectedBase.branch &&
        record.local_durability.durable && renderHandoffComment(record) === source.body &&
        isExactIssueCommentUrl(source.url, source, evidence)
      ) {
        applicable.push({ source, record })
      }
    } catch {
      continue
    }
  }

  return applicable
}

function stop(reason: string, description: string): NoPrDecision {
  return {
    route: 'STOP',
    reasons: [reason],
    nextAction: { type: 'STOP', command: null, description },
  }
}

function hasConsistentHistoricalBase(handoffs: ApplicableNoPrHandoff[]): boolean {
  return new Set(handoffs.map(({ record }) => record.protected_base.sha)).size <= 1
}

export function routeNoPrContext(evidence: NormalizedContextEvidence): NoPrDecision {
  const handoffs = applicableNoPrHandoffs(evidence)

  const commentIds = handoffs.map(({ source }) => String(source.id))
  const commentUrls = handoffs.map(({ source }) => source.url)
  if (new Set(commentIds).size !== commentIds.length || new Set(commentUrls).size !== commentUrls.length) {
    return stop(
      `EVIDENCE_CONFLICT: duplicate applicable current-head HANDOFF comment identity at ${evidence.localGit.head}.`,
      'Resolve duplicate current-head HANDOFF identity evidence before continuing.',
    )
  }

  const stops = handoffs.filter(({ record }) => record.route === 'STOP')
  for (const { source, record } of stops) {
    const resolution = resolveStopBlockers({ record, source, evidence, activePr: null })
    if (resolution !== 'resolved') {
      return stop(
        resolution === 'conflict'
          ? `EVIDENCE_CONFLICT: current-head no-PR HANDOFF STOP has malformed, competing, or wrong-identity blocker-resolution evidence at ${evidence.localGit.head}.`
          : `Current-head no-PR schema-v3 HANDOFF STOP remains unresolved at ${evidence.localGit.head}.`,
        'Resolve every current-head HANDOFF STOP blocker through unique exact no-PR Founder evidence before continuing.',
      )
    }
  }

  if (evidence.issue.state.toUpperCase() === 'CLOSED') {
    return stop(
      'EVIDENCE_CONFLICT: Issue is closed without a uniquely resolved merged PR',
      'Resolve the closed Issue and PR evidence before continuing.',
    )
  }

  const branchIssueNumber = evidence.localGit.branch.match(/^[^/]+\/([1-9]\d*)-[^/]+$/)?.[1]
  if (branchIssueNumber && branchIssueNumber !== evidence.issue.number) {
    return stop(
      `EVIDENCE_CONFLICT: local topic branch ${evidence.localGit.branch} belongs to Issue #${branchIssueNumber}, not queried Issue #${evidence.issue.number}`,
      'Switch to a topic branch owned by the queried Issue before continuing.',
    )
  }

  const completes = handoffs.filter(({ record }) => record.route === 'COMPLETE')
  if (completes.length > 1) {
    return stop(
      `EVIDENCE_CONFLICT: multiple applicable current-head COMPLETE HANDOFF records at ${evidence.localGit.head}.`,
      'Resolve competing current-head COMPLETE records before continuing.',
    )
  }

  if (completes.length === 1) {
    const complete = completes[0]!
    if (complete.record.protected_base.sha !== evidence.protectedBase.sha) {
      return stop(
        `EVIDENCE_CONFLICT: no-PR COMPLETE HANDOFF is bound to a stale protected-base SHA at ${evidence.localGit.head}.`,
        'Publish a terminal HANDOFF bound to the current protected base before completing this Issue.',
      )
    }
    const competing = handoffs.filter(({ source }) => String(source.id) !== String(complete.source.id))
    const allowedCompeting = competing.every(({ record }) =>
      (record.route === 'IMPLEMENT' && record.objective_mode === 'read_only') ||
      (record.route === 'STOP' && record.schema_version === 3),
    )
    if (!allowedCompeting) {
      return stop(
        `EVIDENCE_CONFLICT: no-PR COMPLETE competes with current-head HANDOFF evidence that cannot be uniquely reconciled at ${evidence.localGit.head}.`,
        'Resolve competing current-head HANDOFF evidence before terminalizing this Issue.',
      )
    }
    if (!hasConsistentHistoricalBase(competing)) {
      return stop(
        `EVIDENCE_CONFLICT: historical current-head HANDOFFs disagree on their protected-base SHA at ${evidence.localGit.head}.`,
        'Resolve historical protected-base identity conflicts before terminalizing this Issue.',
      )
    }

    return {
      route: 'COMPLETE',
      reasons: [`Current-head no-PR HANDOFF COMPLETE is applicable at ${evidence.localGit.head}.`],
      nextAction: {
        type: 'COMPLETE',
        command: null,
        description: 'No further implementation action is permitted for this bounded objective.',
      },
    }
  }

  const onlyRecomputableHistory = handoffs.every(({ record }) =>
    (record.route === 'IMPLEMENT' && record.objective_mode === 'read_only') ||
    (record.route === 'STOP' && record.schema_version === 3),
  )
  if (!onlyRecomputableHistory || !hasConsistentHistoricalBase(handoffs)) {
    return stop(
      `EVIDENCE_CONFLICT: current-head no-PR HANDOFF evidence cannot be uniquely reconciled at ${evidence.localGit.head}.`,
      'Resolve conflicting current-head no-PR HANDOFF evidence and protected-base identities before continuing.',
    )
  }

  return {
    route: 'IMPLEMENT',
    reasons: ['No active PR is present and the local topic branch is durable.'],
    nextAction: {
      type: 'COMMAND',
      command: null,
      description: 'Implement the bounded Issue objective on the durable topic branch.',
    },
  }
}
