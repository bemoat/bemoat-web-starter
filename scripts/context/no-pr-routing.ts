import type { ContextDecision, NormalizedContextEvidence } from './model.ts'
import { parseHandoffBody, renderHandoffComment } from '../handoff/schema.ts'
import { extractHandoffPayload, isExactIssueCommentUrl } from './runtime.ts'

type NoPrDecision = Omit<ContextDecision, 'evidenceUrls'>

function hasApplicableNoPrStop(evidence: NormalizedContextEvidence): boolean {
  const head = evidence.localGit.head
  if (!head) return false
  const candidates = evidence.durableContext.handoffs ??
    (evidence.durableContext.latestHandoff ? [evidence.durableContext.latestHandoff] : [])

  return candidates.some((source) => {
    const payload = extractHandoffPayload(source.body)
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false
    const identity = payload as Record<string, unknown>
    if (identity.schema_version !== 3 || identity.route !== 'STOP' || identity.pr !== null ||
        identity.repository !== evidence.repository.nameWithOwner || identity.issue_number !== evidence.issue.number ||
        identity.branch !== evidence.localGit.branch || identity.exact_head !== head ||
        !identity.protected_base || typeof identity.protected_base !== 'object' || Array.isArray(identity.protected_base)) {
      return false
    }
    const protectedBase = identity.protected_base as Record<string, unknown>
    if (protectedBase.branch !== evidence.protectedBase.branch || protectedBase.sha !== evidence.protectedBase.sha) return false

    try {
      const record = parseHandoffBody(JSON.stringify(identity))
      return record.schema_version === 3 && record.route === 'STOP' && record.pr === null &&
        record.local_durability.durable && renderHandoffComment(record) === source.body &&
        isExactIssueCommentUrl(source.url, source, evidence)
    } catch {
      return false
    }
  })
}

export function routeNoPrContext(evidence: NormalizedContextEvidence): NoPrDecision {
  if (hasApplicableNoPrStop(evidence)) {
    return {
      route: 'STOP',
      reasons: [`Current-head schema-v3 HANDOFF STOP remains unresolved at ${evidence.localGit.head}.`],
      nextAction: {
        type: 'STOP',
        command: null,
        description: 'Resolve the current-head HANDOFF STOP before continuing.',
      },
    }
  }

  if (evidence.issue.state.toUpperCase() === 'CLOSED') {
    return {
      route: 'STOP',
      reasons: ['EVIDENCE_CONFLICT: Issue is closed without a uniquely resolved merged PR'],
      nextAction: {
        type: 'STOP',
        command: null,
        description: 'Resolve the closed Issue and PR evidence before continuing.',
      },
    }
  }

  const branchIssueNumber = evidence.localGit.branch.match(/^[^/]+\/([1-9]\d*)-[^/]+$/)?.[1]
  if (branchIssueNumber && branchIssueNumber !== evidence.issue.number) {
    return {
      route: 'STOP',
      reasons: [`EVIDENCE_CONFLICT: local topic branch ${evidence.localGit.branch} belongs to Issue #${branchIssueNumber}, not queried Issue #${evidence.issue.number}`],
      nextAction: {
        type: 'STOP',
        command: null,
        description: 'Switch to a topic branch owned by the queried Issue before continuing.',
      },
    }
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
