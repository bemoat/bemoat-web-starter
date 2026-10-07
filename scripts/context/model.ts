export type ContextRoute =
  | 'IMPLEMENT'
  | 'VERIFY'
  | 'FIX'
  | 'REVIEW'
  | 'FOUNDER_GATE'
  | 'COMPLETE'
  | 'STOP'

export type ContextActionType = 'COMMAND' | 'FOUNDER_GATE' | 'COMPLETE' | 'STOP'

export interface RepositoryEvidence {
  owner: string
  name: string
  nameWithOwner: string
  url: string
}

export interface ProtectedBaseEvidence {
  branch: string
  sha: string
  source: string
  url: string
}

export interface PolicyEvidence {
  path: string
  policyId: string
  version: string
  sourceSha: string
  trustedFounderLogin?: string | null
  legacyStopHandoffs?: string[]
  url: string
}

export interface IssueEvidence {
  number: string
  title: string
  state: string
  url: string
  objective: string | null
  scope: string | null
  acceptanceCriteria: string[]
  dependencies: string[]
  taskSize: string | null
  missionControlMode: string | null
  workflowProfile: string | null
}

export interface LocalGitEvidence {
  branch: string
  head: string | null
  upstream: string | null
  originRepository: string | null
  clean: boolean
  detached: boolean
  pushed: boolean
  durable: boolean
  reasons: string[]
}

/** Internal candidate evidence for one exact wrong-Issue branch switch. */
export interface IssueBranchRecoveryCandidateEvidence {
  branch: string
  liveHead: string
  localHead: string | null
  remoteTrackingHead: string | null
  upstream: string | null
  checkedOutElsewhere: boolean
  eligible: boolean
}

export interface ContextBranchRecovery {
  type: 'SWITCH_BRANCH'
  command: 'git'
  args: string[]
  display_command: string
  binding: {
    repository: string
    issue_number: string
    protected_base: { branch: string; sha: string }
    source: {
      branch: string
      head: string
      upstream: string | null
      clean: boolean
      detached: boolean
      pushed: boolean
      durable: boolean
    }
    target: { branch: string; head: string }
    active_pr?: {
      number: string
      url: string
      base_branch: string
      base_sha: string
      head_branch: string
      head: string
    }
  }
}

export interface ActivePullRequestEvidence {
  number: string
  state: string
  draft: boolean
  url: string
  baseBranch: string
  baseSha: string
  headBranch: string
  headSha: string
  merged: boolean
  mergeCommitSha: string | null
}

export interface HeadVerificationEvidence {
  exactHead: string
  checks: {
    status: string
    complete: boolean
    failed: boolean
    pending: boolean
    required: boolean
  }
  reviews: {
    required: boolean
    approved: boolean
    exactHead: boolean
    approvedCount?: number
    exactHeadApprovedCount?: number
    nativeReviews?: NativeReviewEvidence[]
    nativeReviewAncestryProofs?: NativeReviewAncestryProof[]
  }
  protection: ProtectionEvidence
}

export interface ProtectionEvidence {
  available: boolean
  source?: 'legacy' | 'native' | 'legacy+native' | 'unavailable'
  requiredChecks: string[]
  requiredApprovals: number
}

export interface NativeReviewEvidence {
  id: number | null
  url: string | null
  state: string
  body: string
  commitId: string | null
}

export interface NativeReviewAncestryProof {
  predecessorReviewId: number
  predecessorHeadSha: string
  currentHeadSha: string
  status: string
  mergeBaseSha: string
  aheadBy: number
  behindBy: number
}

export interface RoleEvidence {
  id: string | number
  body: string
  createdAt: string
  url: string
  authorLogin?: string | null
  authorAssociation?: string | null
  authorIdentityConflict?: boolean
}

export interface DurableContextEvidence {
  latestHandoff: RoleEvidence | null
  handoffs?: RoleEvidence[]
  historicalResults: RoleEvidence[]
  blockerResolutions?: RoleEvidence[]
  invalidBlockerResolutions?: RoleEvidence[]
  founderDecisions?: RoleEvidence[]
  invalidFounderDecisions?: RoleEvidence[]
}

export interface HistoricalBlockerResolutionProof {
  resolutionCommentId: string
  resolutionBodySha256: string
  repository: string
  historicalBase: { branch: string; sha: string }
  currentBase: { branch: string; sha: string }
  historicalPolicy: PolicyEvidence
  historicalContractBlobs: { missionControlGuideSha: string; commandReferenceSha: string }
  currentContractBlobs: { missionControlGuideSha: string; commandReferenceSha: string }
  ancestry: {
    status: 'ahead'
    baseSha: string
    currentSha: string
    mergeBaseSha: string
    aheadBy: number
    behindBy: number
  }
}

export interface NormalizedContextEvidence {
  repository: RepositoryEvidence
  protectedBase: ProtectedBaseEvidence
  policy: PolicyEvidence
  issue: IssueEvidence
  localGit: LocalGitEvidence
  activePr: ActivePullRequestEvidence | ActivePullRequestEvidence[] | null
  currentHeadVerification: HeadVerificationEvidence | null
  durableContext: DurableContextEvidence
  /** Internal evidence; createContextOutput intentionally omits this field. */
  issueBranchRecoveryCandidates?: IssueBranchRecoveryCandidateEvidence[]
  historicalBlockerResolutionProofs?: HistoricalBlockerResolutionProof[]
  evidenceErrors: string[]
}

export interface ContextDecision {
  route: ContextRoute
  reasons: string[]
  nextAction: {
    type: ContextActionType
    command: string | null
    description: string
  }
  recovery?: ContextBranchRecovery
  evidenceUrls: string[]
}

export function normalizeContextEvidence(
  evidence: NormalizedContextEvidence,
): NormalizedContextEvidence {
  const normalized = structuredClone(evidence)
  normalized.evidenceErrors = [...new Set(normalized.evidenceErrors)].sort()
  normalized.issue.acceptanceCriteria = [...normalized.issue.acceptanceCriteria]
  normalized.issue.dependencies = [...normalized.issue.dependencies]
  normalized.localGit.reasons = [...new Set(normalized.localGit.reasons)].sort()
  if (normalized.durableContext.handoffs) {
    normalized.durableContext.handoffs = [...normalized.durableContext.handoffs]
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt) || String(left.id).localeCompare(String(right.id)))
  }
  normalized.durableContext.historicalResults = [
    ...normalized.durableContext.historicalResults,
  ].sort((left, right) => left.createdAt.localeCompare(right.createdAt))
  return normalized
}
