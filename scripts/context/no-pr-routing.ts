import type { ContextDecision, NormalizedContextEvidence } from './model.ts'

type NoPrDecision = Omit<ContextDecision, 'evidenceUrls'>

export function routeNoPrContext(evidence: NormalizedContextEvidence): NoPrDecision {
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
