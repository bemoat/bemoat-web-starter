import type { ContextDecision, NormalizedContextEvidence } from './model.ts'
import { parseHandoffBody, renderHandoffComment, type HandoffRecord } from '../handoff/schema.ts'
import { extractHandoffPayload, isExactIssueCommentUrl } from './runtime.ts'

type NoPrDecision = Omit<ContextDecision, 'evidenceUrls'>

function applicableNoPrHandoffs(evidence: NormalizedContextEvidence): HandoffRecord[] {
  const head = evidence.localGit.head
  if (!head) return []
  const candidates = evidence.durableContext.handoffs ??
    (evidence.durableContext.latestHandoff ? [evidence.durableContext.latestHandoff] : [])
  const applicable: HandoffRecord[] = []

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
        applicable.push(record)
      }
    } catch {
      continue
    }
  }

  return applicable
}

export function routeNoPrContext(evidence: NormalizedContextEvidence): NoPrDecision {
  const handoffs = applicableNoPrHandoffs(evidence)

  if (handoffs.some(({ route }) => route === 'STOP')) {
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

  if (handoffs.some(({ route }) => route === 'COMPLETE')) {
    if (handoffs.length > 1) {
      return {
        route: 'STOP',
        reasons: [`EVIDENCE_CONFLICT: multiple applicable current-head HANDOFF records at ${evidence.localGit.head}.`],
        nextAction: {
          type: 'STOP',
          command: null,
          description: 'Resolve competing current-head HANDOFF records before continuing.',
        },
      }
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
