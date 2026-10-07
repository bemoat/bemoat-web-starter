import type { IssueBranchRecoveryCandidateEvidence, LocalGitEvidence } from './model.ts'
import { normalizeOriginRepository, output, type ContextCommandRunner } from './runtime.ts'

export function readLocalGitEvidence({ cwd, run }: { cwd: string; run: ContextCommandRunner }): LocalGitEvidence {
  const branch = output(run('git', ['branch', '--show-current'], { cwd })) ?? ''
  const head = output(run('git', ['rev-parse', 'HEAD'], { cwd }))
  const statusResult = run('git', ['status', '--short'], { cwd })
  const status = statusResult.status === 0 && !statusResult.error ? statusResult.stdout.trim() : null
  const upstream = output(run('git', ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'], { cwd }))
  const origin = output(run('git', ['remote', 'get-url', 'origin'], { cwd }))
  const upstreamRemote = upstream?.split('/', 1)[0] ?? null
  const liveRemoteResult = branch && upstreamRemote
    ? run('git', ['ls-remote', '--heads', upstreamRemote, branch], { cwd })
    : null
  const liveRemoteLine = liveRemoteResult && liveRemoteResult.status === 0 && !liveRemoteResult.error
    ? liveRemoteResult.stdout.trim().split(/\r?\n/)[0] ?? ''
    : ''
  const liveRemoteHead = /^[0-9a-f]{40}(?:\s|$)/i.test(liveRemoteLine)
    ? liveRemoteLine.split(/\s+/, 1)[0]
    : null
  const clean = status !== null && status === ''
  const detached = branch === ''
  const upstreamBranch = upstream?.replace(/^[^/]+\//, '') ?? null
  const upstreamMatchesBranch = Boolean(branch && upstreamBranch === branch)
  const pushed = Boolean(head && upstream && upstreamMatchesBranch && liveRemoteHead && head === liveRemoteHead)
  const reasons: string[] = []
  if (detached) reasons.push('LOCAL_STATE_NOT_DURABLE: repository is detached')
  if (!clean) reasons.push('LOCAL_STATE_NOT_DURABLE: working tree is dirty or has untracked files')
  if (status === null) reasons.push('EVIDENCE_CONFLICT: git status --short failed; working-tree cleanliness is unavailable')
  if (!upstream) reasons.push('LOCAL_STATE_NOT_DURABLE: current branch has no upstream')
  if (upstream && !upstreamMatchesBranch) reasons.push('LOCAL_STATE_NOT_DURABLE: upstream branch does not match the current branch')
  if (!liveRemoteHead) reasons.push('LOCAL_STATE_NOT_DURABLE: live remote branch identity is unavailable')
  else if (!pushed) reasons.push('LOCAL_STATE_NOT_DURABLE: current HEAD is not proven pushed to its live upstream')
  if (!head) reasons.push('EVIDENCE_CONFLICT: local HEAD is unavailable')
  if (!normalizeOriginRepository(origin)) reasons.push('EVIDENCE_CONFLICT: origin is not the canonical GitHub repository')
  return {
    branch: branch || '<detached>',
    head,
    upstream,
    originRepository: normalizeOriginRepository(origin),
    clean,
    detached,
    pushed,
    durable: reasons.length === 0,
    reasons,
  }
}

function readGitOutput(run: ContextCommandRunner, cwd: string, args: string[]): string | null {
  const result = run('git', args, { cwd })
  if (result.status !== 0 || result.error) return null
  return result.stdout.trim()
}

function readRef(run: ContextCommandRunner, cwd: string, ref: string): { sha: string | null; valid: boolean } {
  const result = run('git', ['rev-parse', '--verify', '--quiet', ref], { cwd })
  if (result.error) return { sha: null, valid: false }
  if (result.status === 1) return { sha: null, valid: true }
  if (result.status !== 0) return { sha: null, valid: false }
  const sha = result.stdout.trim()
  return /^[0-9a-f]{40}$/i.test(sha)
    ? { sha: sha.toLowerCase(), valid: true }
    : { sha: null, valid: false }
}

/**
 * Read only the evidence needed to consider an exact branch switch after a
 * numbered wrong-Issue mismatch. This never changes refs or the worktree.
 */
export function readIssueBranchRecoveryCandidates({
  cwd,
  run,
  issueNumber,
  repository,
  localGit,
  preferredTarget,
}: {
  cwd: string
  run: ContextCommandRunner
  issueNumber: string
  repository: string
  localGit: LocalGitEvidence
  preferredTarget?: { branch: string; head: string }
}): IssueBranchRecoveryCandidateEvidence[] {
  const sourceIssue = localGit.branch.match(/^[^/]+\/([1-9]\d*)-[^/]+$/)?.[1]
  if (
    !/^[1-9]\d*$/.test(issueNumber) ||
    !sourceIssue ||
    sourceIssue === issueNumber ||
    !localGit.clean ||
    localGit.detached ||
    !localGit.pushed ||
    !localGit.durable ||
    !localGit.head ||
    localGit.upstream !== `origin/${localGit.branch}` ||
    localGit.originRepository !== repository
  ) return []

  const remoteResult = run('git', ['ls-remote', '--heads', 'origin'], { cwd })
  if (remoteResult.status !== 0 || remoteResult.error) return []

  const remoteLines = remoteResult.stdout.trim() ? remoteResult.stdout.trim().split(/\r?\n/) : []
  const liveCandidates: Array<{ branch: string; liveHead: string }> = []
  for (const line of remoteLines) {
    const match = line.match(/^([0-9a-f]{40})\s+refs\/heads\/([^\s]+)$/i)
    if (!match) return []
    const branch = match[2]!
    const ownerIssue = branch.match(/^[^/]+\/([1-9]\d*)-[^/]+$/)?.[1]
    const liveHead = match[1]!.toLowerCase()
    if (preferredTarget
      ? branch === preferredTarget.branch && liveHead === preferredTarget.head.toLowerCase()
      : ownerIssue === issueNumber) {
      liveCandidates.push({ branch, liveHead })
    }
  }
  if (liveCandidates.length === 0) return []

  const worktreeOutput = readGitOutput(run, cwd, ['worktree', 'list', '--porcelain'])
  if (worktreeOutput === null) {
    return liveCandidates.map<IssueBranchRecoveryCandidateEvidence>(({ branch, liveHead }) => ({
      branch,
      liveHead,
      localHead: null,
      remoteTrackingHead: null,
      upstream: null,
      checkedOutElsewhere: true,
      eligible: false,
    }))
  }
  const checkedOutBranches = new Set(
    [...worktreeOutput.matchAll(/^branch refs\/heads\/(.+)$/gm)].map((match) => match[1]!),
  )

  return liveCandidates.map<IssueBranchRecoveryCandidateEvidence>(({ branch, liveHead }) => {
    const localRef = readRef(run, cwd, `refs/heads/${branch}`)
    const trackingRef = readRef(run, cwd, `refs/remotes/origin/${branch}`)
    const upstream = localRef.sha
      ? readGitOutput(run, cwd, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', `${branch}@{upstream}`])
      : null
    const checkedOutElsewhere = checkedOutBranches.has(branch)
    const eligible = localRef.valid && trackingRef.valid && !checkedOutElsewhere &&
      trackingRef.sha === liveHead &&
      (localRef.sha === null || (localRef.sha === liveHead && upstream === `origin/${branch}`))
    return {
      branch,
      liveHead,
      localHead: localRef.sha,
      remoteTrackingHead: trackingRef.sha,
      upstream,
      checkedOutElsewhere,
      eligible,
    }
  })
}
