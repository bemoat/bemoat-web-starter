import { parseRoleEvidence } from './issue-parser.ts'
import { readGithubEvidence } from './github.ts'
import { readIssueBranchRecoveryCandidates, readLocalGitEvidence } from './local-git.ts'
import { readProtectedPolicy } from './policy.ts'
import { resolveApprovedBase } from './approved-base.ts'
import { repositoryEvidence, runContextCommand } from './runtime.ts'
import type { ContextCommandResult, ContextCommandRunner } from './runtime.ts'
import { normalizeContextEvidence, type NormalizedContextEvidence } from './model.ts'
import { readHistoricalBlockerResolutionProofs } from './blocker-resolution-history.ts'

export { readGithubEvidence, readLocalGitEvidence, readProtectedPolicy, runContextCommand }
export type { ContextCommandResult, ContextCommandRunner }

export function collectContextEvidence({
  cwd = process.cwd(),
  env = process.env,
  issueNumber,
  run = runContextCommand,
}: {
  cwd?: string
  env?: NodeJS.ProcessEnv
  issueNumber: string
  run?: ContextCommandRunner
}): NormalizedContextEvidence {
  const localGit = readLocalGitEvidence({ cwd, run })
  const configuredRepo = env.GH_REPO && /^[^/\s]+\/[^/\s]+$/.test(env.GH_REPO) ? env.GH_REPO : null
  const repo = configuredRepo ?? localGit.originRepository
  const errors: string[] = []
  if (!/^[1-9]\d*$/.test(issueNumber)) errors.push('EVIDENCE_CONFLICT: Issue identity is missing or malformed')
  if (!repo) errors.push('EVIDENCE_CONFLICT: canonical repository identity is unavailable')
  if (configuredRepo && localGit.originRepository && configuredRepo !== localGit.originRepository) {
    errors.push(`EVIDENCE_CONFLICT: configured repository ${configuredRepo} differs from origin ${localGit.originRepository}`)
  }
  const repository = repositoryEvidence(repo ?? 'unknown/unknown')
  const approvedBase = repo
    ? resolveApprovedBase({ repo, run, cwd, env })
    : { branch: null, sha: null, source: 'live GitHub ref' as const, url: '', errors: ['EVIDENCE_CONFLICT: approved-base-unresolved'] }
  const policyResult = repo && approvedBase.branch
    ? readProtectedPolicy({ repo, baseBranch: approvedBase.branch, run, cwd, env })
    : { branch: approvedBase.branch ?? '', sha: null, policy: null, errors: approvedBase.branch ? [] : [...approvedBase.errors] }
  const github = repo && approvedBase.branch
    ? readGithubEvidence({
      cwd,
      env,
      repo,
      issueNumber,
      branch: localGit.branch === '<detached>' ? null : localGit.branch,
      protectedBaseBranch: approvedBase.branch,
      protectedBaseSha: policyResult.sha ?? approvedBase.sha,
      run,
    })
    : {
      repository,
      issue: null,
      comments: [],
      activePrs: [],
      exactHead: null,
      protection: { available: false, source: 'unavailable' as const, requiredChecks: [], requiredApprovals: 0 },
      errors: ['EVIDENCE_CONFLICT: GitHub evidence cannot be read without repository identity'],
    }
  const roleEvidence = parseRoleEvidence(github.comments)
  const activePr = github.activePrs.length === 0 ? null : github.activePrs.length === 1 ? github.activePrs[0] : github.activePrs
  const sourceIssue = localGit.branch.match(/^[^/]+\/([1-9]\d*)-[^/]+$/)?.[1]
  const activePrRecoveryTarget = github.activePrs.length === 1 &&
    !github.activePrs[0]!.merged && github.activePrs[0]!.state.toUpperCase() !== 'MERGED' &&
    sourceIssue && sourceIssue !== issueNumber &&
    (localGit.branch !== github.activePrs[0]!.headBranch || localGit.head?.toLowerCase() !== github.activePrs[0]!.headSha.toLowerCase())
    ? { branch: github.activePrs[0]!.headBranch, head: github.activePrs[0]!.headSha }
    : undefined
  const issueBranchRecoveryCandidates = repo && (github.activePrs.length === 0 || activePrRecoveryTarget)
    ? readIssueBranchRecoveryCandidates({ cwd, run, issueNumber, repository: repo, localGit, preferredTarget: activePrRecoveryTarget })
    : []
  const issue = github.issue ?? {
    number: issueNumber,
    title: '',
    state: '',
    url: `https://github.com/${repo ?? 'unknown/unknown'}/issues/${issueNumber}`,
    objective: null,
    scope: null,
    acceptanceCriteria: [],
    dependencies: [],
    taskSize: null,
    missionControlMode: null,
    workflowProfile: null,
  }
  const policy = policyResult.policy ?? {
    path: 'docs/mission-control/mission-control-guide.md',
    policyId: '',
    version: '',
    sourceSha: '',
    url: approvedBase.branch
      ? `https://github.com/${repo ?? 'unknown/unknown'}/blob/${approvedBase.branch}/docs/mission-control/mission-control-guide.md`
      : `https://github.com/${repo ?? 'unknown/unknown'}/blob/main/docs/mission-control/mission-control-guide.md`,
  }

  const resolvedSha = policyResult.sha ?? approvedBase.sha ?? ''
  const resolvedBranch = approvedBase.branch ?? ''
  const historicalBlockerResolutionProofs = github.activePrs.length === 1 && policyResult.policy && resolvedBranch && resolvedSha
    ? readHistoricalBlockerResolutionProofs({
      repo: repo ?? 'unknown/unknown',
      currentBase: { branch: resolvedBranch, sha: resolvedSha },
      policy: policyResult.policy,
      resolutions: roleEvidence.blockerResolutions,
      contextBinding: {
        issueNumber,
        prNumber: github.activePrs[0]!.number,
        headSha: github.activePrs[0]!.headSha,
      },
      run,
      cwd,
      env,
    })
    : []

  return normalizeContextEvidence({
    repository,
    protectedBase: {
      branch: resolvedBranch,
      sha: resolvedSha,
      source: approvedBase.source,
      url: approvedBase.url || (resolvedBranch ? `https://github.com/${repo ?? 'unknown/unknown'}/tree/${resolvedBranch}` : ''),
    },
    policy,
    issue,
    localGit,
    activePr,
    currentHeadVerification: github.activePrs.length === 1 ? github.exactHead : null,
    ...(issueBranchRecoveryCandidates.length > 0 ? { issueBranchRecoveryCandidates } : {}),
    durableContext: {
      latestHandoff: roleEvidence.latestHandoff,
      handoffs: roleEvidence.handoffs,
      historicalResults: roleEvidence.historicalResults,
      blockerResolutions: roleEvidence.blockerResolutions,
      invalidBlockerResolutions: roleEvidence.invalidBlockerResolutions,
    },
    ...(historicalBlockerResolutionProofs.length > 0 ? { historicalBlockerResolutionProofs } : {}),
    evidenceErrors: [...new Set([
      ...errors,
      ...approvedBase.errors,
      ...policyResult.errors,
      ...github.errors,
      ...roleEvidence.invalid.map((comment) => `EVIDENCE_CONFLICT: malformed role comment ${comment.id}`),
      ...(github.issue || github.errors.some((error) => error.startsWith('EVIDENCE_CONFLICT: Issue identity'))
        ? []
        : ['BLOCKED_EXTERNAL: Issue evidence is unavailable']),
    ])],
  })
}
