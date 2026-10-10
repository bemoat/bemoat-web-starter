import { createHash } from 'node:crypto'

import { parseHandoffBody, renderHandoffComment, type HandoffRecord } from '../handoff/schema.ts'
import { resolveContextSyncRoots, type ContextSyncRoots } from './sync-worktree.ts'
import {
  extractHandoffPayload,
  isFullSha,
  normalizeOriginRepository,
  output,
  runContextCommand,
  type ContextCommandRunner,
} from './runtime.ts'

export const COMMITTED_WIP_BINDING = {
  repository: 'bemoat/bemoat-web-starter',
  issueNumber: '627',
  branch: 'fix/627-seamless-multi-objective-continuation',
  baseBranch: 'main',
  baseSha: '0e99786f0b087de46a2518d5874beb999892dd6c',
  handoffCommentId: '6088681412',
  wipHead: '9c057c2a741d361b6138b95ff115bd3e56049fbd',
  wipTree: '717a04a858b4768deddf814822e3467407606f11',
  wipSubject: 'wip(#627): preserve incomplete multi-objective routing candidate',
  wipAuthor: 'Bemoat',
  handoffAuthor: 'bemoat',
  handoffAuthorId: '36528988',
} as const

export const COMMITTED_WIP_PATHS = [
  'docs/agent-loop/role-handoff-contract.md',
  'docs/mission-control/mission-control-guide.md',
  'scripts/context/evidence.ts',
  'scripts/context/github.ts',
  'scripts/context/issue-parser.ts',
  'scripts/context/model.ts',
  'scripts/context/native-review-lineage.ts',
  'scripts/context/no-pr-routing.ts',
  'scripts/context/objective-sequence-routing.ts',
  'scripts/context/pr-issue-ownership.ts',
  'scripts/context/router.ts',
  'scripts/context/setup-base-recovery-routing.ts',
  'scripts/context/setup-recovery.ts',
  'tests/int/context-evidence.int.spec.ts',
  'tests/int/context-no-pr-pr-ready.int.spec.ts',
  'tests/int/context-parser.int.spec.ts',
] as const

export type CommittedWipClassification =
  | 'SUCCESS'
  | 'NO_OP_IDENTICAL_RETRY'
  | 'UNSUPPORTED_PRE_STATE'
  | 'STATE_CONFLICT'
  | 'HEAD_DRIFT'
  | 'BLOCKED_EXTERNAL'
  | 'EVIDENCE_CONFLICT'
  | 'AMBIGUOUS_RESULT'

export interface CommittedWipRecoveryResult {
  classification: CommittedWipClassification
  mutationPerformed: false
  route: 'STOP' | 'IMPLEMENT'
  currentHead: string | null
  reasons: string[]
  nextAction: { type: 'COMMAND' | 'STOP'; command: string | null; description: string }
  details: Record<string, unknown>
}

interface Binding {
  issueNumber: string
  expectedRepository: string
  expectedBranch: string
  expectedBaseBranch: string
  expectedBaseSha: string
  expectedHandoffCommentId: string
  expectedHandoffHead: string
  expectedWipHead: string
  expectedWipTree: string
  targetWorktree: string
}

interface GithubComment {
  id?: number | string
  body?: string
  html_url?: string
  issue_url?: string
  user?: { id?: number | string; login?: string } | null
}

interface Proof {
  roots: ContextSyncRoots
  handoff: HandoffRecord
  handoffDigest: string
  sourceHead: string
  liveProtectedBase: string
  historicalBase: string
  targetHead: string
  tree: string
  remoteHead: string
  changedPaths: string[]
}

function stop(classification: CommittedWipClassification, reason: string, currentHead: string | null = null): CommittedWipRecoveryResult {
  return {
    classification,
    mutationPerformed: false,
    route: 'STOP',
    currentHead,
    reasons: [reason],
    nextAction: { type: 'STOP', command: null, description: 'Stop; preserve the incomplete WIP and resolve the exact evidence conflict before retrying.' },
    details: { objective_edit_authority_granted: false, reentry_performed: false },
  }
}
function exactLiveRef({ cwd, repository, branch, run }: {
  cwd: string
  repository: string
  branch: string
  run: ContextCommandRunner
}): { sha: string | null; reason: string | null } {
  const github = run('gh', ['api', `repos/${repository}/git/ref/heads/${encodeURIComponent(branch)}`], { cwd })
  if (github.status !== 0 || github.error) return { sha: null, reason: 'GitHub ref read is unavailable.' }
  let githubSha: string | null = null
  try {
    const payload = JSON.parse(github.stdout.trim()) as { object?: { sha?: unknown } }
    if (isFullSha(payload.object?.sha)) githubSha = payload.object.sha.toLowerCase()
  } catch {
    return { sha: null, reason: 'GitHub ref returned malformed JSON.' }
  }
  if (!githubSha) return { sha: null, reason: 'GitHub ref did not contain a full commit SHA.' }
  const remote = run('git', ['ls-remote', '--heads', 'origin', `refs/heads/${branch}`], { cwd })
  if (remote.status !== 0 || remote.error) return { sha: null, reason: 'git ls-remote could not read the exact origin ref.' }
  const lines = remote.stdout.trim().split(/\r?\n/).filter(Boolean)
  if (lines.length !== 1) return { sha: null, reason: 'The live origin ref is missing or ambiguous.' }
  const match = lines[0]!.match(/^([0-9a-f]{40})\s+refs\/heads\/([^\s]+)$/i)
  if (!match || match[2] !== branch || match[1]!.toLowerCase() !== githubSha) {
    return { sha: null, reason: 'GitHub and origin refs disagree or identify the wrong branch.' }
  }
  return { sha: githubSha, reason: null }
}
function gitOutput(run: ContextCommandRunner, cwd: string, args: string[]): string | null {
  return output(run('git', args, { cwd }))
}
function verifyRoot({ cwd, expectedRepository, expectedBranch, expectedHead, upstream, run, label }: {
  cwd: string
  expectedRepository: string
  expectedBranch: string
  expectedHead: string
  upstream?: string
  run: ContextCommandRunner
  label: string
}): string | null {
  const root = gitOutput(run, cwd, ['rev-parse', '--show-toplevel'])
  const head = gitOutput(run, cwd, ['rev-parse', 'HEAD'])?.toLowerCase()
  const status = gitOutput(run, cwd, ['status', '--porcelain=v1', '--untracked-files=all'])
  const origin = normalizeOriginRepository(gitOutput(run, cwd, ['remote', 'get-url', 'origin']))
  if (root !== cwd) return `${label} Git root is unavailable or differs from its canonical path.`
  if (status !== '') return `${label} is dirty or its status could not be proven.`
  if (origin !== expectedRepository) return `${label} origin is not the exact canonical repository.`
  if (!head || !isFullSha(head) || head !== expectedHead.toLowerCase()) return `${label} HEAD differs from the exact bound commit.`
  if (label === 'source') {
    const branchResult = run('git', ['symbolic-ref', '--quiet', '--short', 'HEAD'], { cwd })
    if (branchResult.error || (branchResult.status !== 0 && branchResult.status !== 1)) return 'Source branch attachment could not be proven.'
    const branch = output(branchResult)
    if (branch !== null && branch !== expectedBranch) return 'Source is attached to a branch other than the expected protected base.'
  } else {
    const branch = gitOutput(run, cwd, ['symbolic-ref', '--quiet', '--short', 'HEAD'])
    if (branch !== expectedBranch) return 'Target is detached or attached to the wrong topic branch.'
    const actualUpstream = gitOutput(run, cwd, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'])
    if (actualUpstream !== upstream) return 'Target upstream is not exactly origin/expected-branch.'
  }
  return null
}
function isCanonicalHandoff(body: string): HandoffRecord | null {
  if (!body.startsWith('## HANDOFF')) return null
  const payload = extractHandoffPayload(body)
  if (!payload) return null
  try {
    const record = parseHandoffBody(JSON.stringify(payload), { allowLegacyStop: false })
    return renderHandoffComment(record) === body ? record : null
  } catch {
    return null
  }
}
function asComment(value: unknown): GithubComment | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as GithubComment
}
function parseCommentList(stdout: string): GithubComment[] | null {
  try {
    const value: unknown = JSON.parse(stdout)
    if (!Array.isArray(value)) return null
    const flattened = value.flatMap((page) => Array.isArray(page) ? page : [page])
    const comments = flattened.map(asComment)
    return comments.every((comment) => comment !== null) ? comments as GithubComment[] : null
  } catch {
    return null
  }
}
function verifyHandoff({ cwd, binding, run }: { cwd: string; binding: Binding; run: ContextCommandRunner }):
  { handoff: HandoffRecord; digest: string } | { error: string; classification: CommittedWipClassification } {
  const exactResult = run('gh', ['api', `repos/${binding.expectedRepository}/issues/comments/${binding.expectedHandoffCommentId}`], { cwd })
  if (exactResult.status !== 0 || exactResult.error) return { error: 'The exact native HANDOFF comment could not be read.', classification: 'BLOCKED_EXTERNAL' }
  let exactRaw: unknown
  try { exactRaw = JSON.parse(exactResult.stdout.trim()) } catch {
    return { error: 'The exact native HANDOFF response is malformed.', classification: 'EVIDENCE_CONFLICT' }
  }
  const exact = asComment(exactRaw)
  const expectedUrl = `https://github.com/${binding.expectedRepository}/issues/${binding.issueNumber}#issuecomment-${binding.expectedHandoffCommentId}`
  const authorValid = exact?.user && (String(exact.user.id ?? '').trim() !== '' || String(exact.user.login ?? '').trim() !== '')
  if (!exact || String(exact.id) !== binding.expectedHandoffCommentId || exact.html_url !== expectedUrl ||
      exact.issue_url !== `https://api.github.com/repos/${binding.expectedRepository}/issues/${binding.issueNumber}` ||
      !authorValid || exact.user?.login !== COMMITTED_WIP_BINDING.handoffAuthor ||
      String(exact.user?.id ?? '') !== COMMITTED_WIP_BINDING.handoffAuthorId || typeof exact.body !== 'string') {
    return { error: 'Native HANDOFF identity, canonical URL, Issue binding, author identity, or body is invalid.', classification: 'EVIDENCE_CONFLICT' }
  }
  const record = isCanonicalHandoff(exact.body)
  if (!record || record.schema_version !== 2 || record.record_type !== 'HANDOFF' ||
      record.objective_mode !== 'read_only' || record.route !== 'IMPLEMENT' || record.pr !== null ||
      !record.objective.startsWith('Objective 1 —') || record.repository !== binding.expectedRepository ||
      record.issue_number !== binding.issueNumber || record.branch !== binding.expectedBranch ||
      record.exact_head.toLowerCase() !== binding.expectedHandoffHead.toLowerCase() ||
      record.protected_base.branch !== binding.expectedBaseBranch ||
      record.protected_base.sha.toLowerCase() !== binding.expectedBaseSha.toLowerCase() ||
      record.local_durability.durable !== true) {
    return { error: 'Historical HANDOFF is not the exact canonical read-only schema-v2 Objective 1 record bound to A.', classification: 'EVIDENCE_CONFLICT' }
  }
  const listResult = run('gh', ['api', '--paginate', '--slurp', `repos/${binding.expectedRepository}/issues/${binding.issueNumber}/comments`], { cwd })
  if (listResult.status !== 0 || listResult.error) return { error: 'Issue HANDOFF history could not be read to exclude competing records.', classification: 'BLOCKED_EXTERNAL' }
  const comments = parseCommentList(listResult.stdout)
  if (!comments) return { error: 'Issue comment history is malformed or ambiguous.', classification: 'EVIDENCE_CONFLICT' }
  const matching: string[] = []
  for (const comment of comments) {
    if (typeof comment.body !== 'string' || !comment.body.startsWith('## HANDOFF')) continue
    const parsed = isCanonicalHandoff(comment.body)
    if (!parsed) return { error: 'Issue history contains malformed or modified HANDOFF evidence.', classification: 'EVIDENCE_CONFLICT' }
    if (parsed.schema_version === 2 && parsed.objective.startsWith('Objective 1 —') &&
        parsed.repository === binding.expectedRepository && parsed.issue_number === binding.issueNumber &&
        parsed.branch === binding.expectedBranch && parsed.exact_head.toLowerCase() === binding.expectedHandoffHead.toLowerCase()) {
      matching.push(String(comment.id))
    }
  }
  if (matching.length !== 1 || matching[0] !== binding.expectedHandoffCommentId) {
    return { error: 'Historical HANDOFF is missing, duplicated, or competing with another exact Objective 1 record.', classification: 'AMBIGUOUS_RESULT' }
  }
  return { handoff: record, digest: createHash('sha256').update(exact.body).digest('hex') }
}
function readTargetProof({ cwd, binding, run }: { cwd: string; binding: Binding; run: ContextCommandRunner }):
  { proof: { tree: string; changedPaths: string[] } } | { error: string; classification: CommittedWipClassification } {
  const tracking = gitOutput(run, cwd, ['rev-parse', '--verify', '--quiet', `refs/remotes/origin/${binding.expectedBranch}`])?.toLowerCase()
  if (tracking !== binding.expectedWipHead.toLowerCase()) return { error: 'Target upstream tracking ref does not equal exact B.', classification: 'HEAD_DRIFT' }
  const tree = gitOutput(run, cwd, ['rev-parse', `${binding.expectedWipHead}^{tree}`])?.toLowerCase()
  if (!tree || tree !== binding.expectedWipTree.toLowerCase()) return { error: 'Exact WIP commit tree is unavailable or differs from the bound tree.', classification: 'EVIDENCE_CONFLICT' }
  const forward = run('git', ['merge-base', '--is-ancestor', binding.expectedHandoffHead, binding.expectedWipHead], { cwd })
  if (forward.status !== 0 || forward.error) return { error: 'Strict A-to-B ancestry could not be proven.', classification: forward.status === 1 ? 'HEAD_DRIFT' : 'EVIDENCE_CONFLICT' }
  const reverse = run('git', ['merge-base', '--is-ancestor', binding.expectedWipHead, binding.expectedHandoffHead], { cwd })
  if (reverse.error || reverse.status !== 1) return { error: 'Reverse ancestry was not proven to be exactly non-ancestor.', classification: reverse.status === 0 ? 'HEAD_DRIFT' : 'EVIDENCE_CONFLICT' }
  const parent = gitOutput(run, cwd, ['rev-parse', `${binding.expectedWipHead}^`])?.toLowerCase()
  const identity = gitOutput(run, cwd, ['show', '-s', '--format=%an%n%s', binding.expectedWipHead])
  if (parent !== binding.expectedHandoffHead.toLowerCase() || identity !== `${COMMITTED_WIP_BINDING.wipAuthor}\n${COMMITTED_WIP_BINDING.wipSubject}`) return { error: 'Committed WIP parent or author/subject provenance differs from the preserved #627 commit.', classification: 'EVIDENCE_CONFLICT' }
  const diff = run('git', ['diff', '--name-only', '-z', binding.expectedHandoffHead, binding.expectedWipHead], { cwd })
  if (diff.status !== 0 || diff.error) return { error: 'Changed-path provenance could not be read.', classification: 'EVIDENCE_CONFLICT' }
  const changedPaths = diff.stdout.split('\0').filter(Boolean).sort()
  const expectedPaths = [...COMMITTED_WIP_PATHS].sort()
  return changedPaths.length === expectedPaths.length && changedPaths.every((path, index) => path === expectedPaths[index])
    ? { proof: { tree, changedPaths } }
    : { error: 'Committed WIP contains an unowned, unrelated, forbidden, missing, or unexpected changed path.', classification: 'EVIDENCE_CONFLICT' }
}
function prove({ binding, roots, run }: { binding: Binding; roots: ContextSyncRoots; run: ContextCommandRunner }):
  { proof: Proof } | { error: string; classification: CommittedWipClassification } {
  if (binding.issueNumber !== COMMITTED_WIP_BINDING.issueNumber ||
      binding.expectedRepository !== COMMITTED_WIP_BINDING.repository ||
      binding.expectedBranch !== COMMITTED_WIP_BINDING.branch ||
      binding.expectedBaseBranch !== COMMITTED_WIP_BINDING.baseBranch ||
      binding.expectedBaseSha.toLowerCase() !== COMMITTED_WIP_BINDING.baseSha ||
      binding.expectedHandoffCommentId !== COMMITTED_WIP_BINDING.handoffCommentId ||
      binding.expectedHandoffHead.toLowerCase() !== COMMITTED_WIP_BINDING.baseSha ||
      binding.expectedWipHead.toLowerCase() !== COMMITTED_WIP_BINDING.wipHead ||
      binding.expectedWipTree.toLowerCase() !== COMMITTED_WIP_BINDING.wipTree) {
    return { error: 'Caller binding differs from the exact authorized #627 Architecture A evidence.', classification: 'HEAD_DRIFT' }
  }
  if (!roots.sourceCwd || !roots.targetCwd || roots.sourceCwd === roots.targetCwd) {
    return { error: 'Canonical source and target roots are not distinct supported worktrees.', classification: 'UNSUPPORTED_PRE_STATE' }
  }
  const liveSourceBase = exactLiveRef({ cwd: roots.sourceCwd, repository: binding.expectedRepository, branch: binding.expectedBaseBranch, run })
  if (liveSourceBase.reason || !liveSourceBase.sha) {
    return { error: liveSourceBase.reason ?? 'Current protected-main SHA is unavailable.', classification: 'BLOCKED_EXTERNAL' }
  }
  const sourceError = verifyRoot({ cwd: roots.sourceCwd, expectedRepository: binding.expectedRepository, expectedBranch: binding.expectedBaseBranch, expectedHead: liveSourceBase.sha, run, label: 'source' })
  if (sourceError) return { error: sourceError, classification: 'UNSUPPORTED_PRE_STATE' }
  const sourceTracking = gitOutput(run, roots.sourceCwd, ['rev-parse', '--verify', '--quiet', `refs/remotes/origin/${binding.expectedBaseBranch}`])?.toLowerCase()
  if (sourceTracking !== liveSourceBase.sha) return { error: 'Source protected-base tracking ref does not equal current live protected-main SHA D.', classification: 'HEAD_DRIFT' }
  const targetError = verifyRoot({ cwd: roots.targetCwd, expectedRepository: binding.expectedRepository, expectedBranch: binding.expectedBranch, expectedHead: binding.expectedWipHead, upstream: `origin/${binding.expectedBranch}`, run, label: 'target' })
  if (targetError) return { error: targetError, classification: 'UNSUPPORTED_PRE_STATE' }
  const targetGithub = exactLiveRef({ cwd: roots.targetCwd, repository: binding.expectedRepository, branch: binding.expectedBranch, run })
  if (targetGithub.reason || targetGithub.sha !== binding.expectedWipHead.toLowerCase()) {
    return { error: targetGithub.reason ?? 'Live target branch moved from exact B.', classification: 'HEAD_DRIFT' }
  }
  const targetProof = readTargetProof({ cwd: roots.targetCwd, binding, run })
  if ('error' in targetProof) return targetProof
  const handoffResult = verifyHandoff({ cwd: roots.sourceCwd, binding, run })
  if ('error' in handoffResult) return handoffResult
  const sourceAgain = verifyRoot({ cwd: roots.sourceCwd, expectedRepository: binding.expectedRepository, expectedBranch: binding.expectedBaseBranch, expectedHead: liveSourceBase.sha, run, label: 'source' })
  const targetAgain = verifyRoot({ cwd: roots.targetCwd, expectedRepository: binding.expectedRepository, expectedBranch: binding.expectedBranch, expectedHead: binding.expectedWipHead, upstream: `origin/${binding.expectedBranch}`, run, label: 'target' })
  if (sourceAgain) return { error: sourceAgain, classification: 'HEAD_DRIFT' }
  if (targetAgain) return { error: `Final target readback is unavailable or differs from the proven binding: ${targetAgain}`, classification: 'AMBIGUOUS_RESULT' }
  const sourceLiveAgain = exactLiveRef({ cwd: roots.sourceCwd, repository: binding.expectedRepository, branch: binding.expectedBaseBranch, run })
  const targetLiveAgain = exactLiveRef({ cwd: roots.targetCwd, repository: binding.expectedRepository, branch: binding.expectedBranch, run })
  if (sourceLiveAgain.sha !== liveSourceBase.sha || targetLiveAgain.sha !== binding.expectedWipHead.toLowerCase()) {
    return { error: 'Post-readback live source or target refs drifted or became ambiguous.', classification: 'AMBIGUOUS_RESULT' }
  }
  const sourceTrackingAgain = gitOutput(run, roots.sourceCwd, ['rev-parse', '--verify', '--quiet', `refs/remotes/origin/${binding.expectedBaseBranch}`])?.toLowerCase()
  if (sourceTrackingAgain !== liveSourceBase.sha) return { error: 'Post-readback source tracking ref drifted from current protected-main SHA D.', classification: 'AMBIGUOUS_RESULT' }
  const targetProofAgain = readTargetProof({ cwd: roots.targetCwd, binding, run })
  if ('error' in targetProofAgain) {
    return { error: `Final target proof readback is unavailable or invalid: ${targetProofAgain.error}`, classification: 'AMBIGUOUS_RESULT' }
  }
  if (targetProofAgain.proof.tree !== targetProof.proof.tree ||
      targetProofAgain.proof.changedPaths.length !== targetProof.proof.changedPaths.length ||
      targetProofAgain.proof.changedPaths.some((path, index) => path !== targetProof.proof.changedPaths[index])) {
    return { error: 'Final target tree or provenance manifest differs from its original proof.', classification: 'AMBIGUOUS_RESULT' }
  }
  const handoffAgain = verifyHandoff({ cwd: roots.sourceCwd, binding, run })
  if ('error' in handoffAgain || handoffAgain.digest !== handoffResult.digest) {
    return { error: 'Historical HANDOFF changed or could not be proven identical during final readback.', classification: 'AMBIGUOUS_RESULT' }
  }
  return { proof: { roots, handoff: handoffResult.handoff, handoffDigest: handoffResult.digest, sourceHead: liveSourceBase.sha, liveProtectedBase: liveSourceBase.sha, historicalBase: binding.expectedBaseSha.toLowerCase(), targetHead: binding.expectedWipHead.toLowerCase(), tree: targetProof.proof.tree, remoteHead: targetLiveAgain.sha, changedPaths: targetProof.proof.changedPaths } }
}
export function recoverCommittedWip({ binding, sourceCwd, run = runContextCommand }: {
  binding: Binding
  sourceCwd: string
  run?: ContextCommandRunner
}): CommittedWipRecoveryResult {
  let roots: ContextSyncRoots
  try {
    roots = resolveContextSyncRoots({ sourceCwd, targetWorktree: binding.targetWorktree })
  } catch (error) {
    return stop('UNSUPPORTED_PRE_STATE', error instanceof Error ? error.message : String(error))
  }
  const result = prove({ binding, roots, run })
  if ('error' in result) return stop(result.classification, result.error)
  const { proof } = result
  const retryBinding = {
    issue: binding.issueNumber,
    comment: binding.expectedHandoffCommentId,
    handoff_body_sha256: proof.handoffDigest,
    A: proof.historicalBase,
    B: proof.targetHead,
    tree: proof.tree,
    repository: binding.expectedRepository,
    branch: binding.expectedBranch,
    base: binding.expectedBaseBranch,
    source_head_D: proof.liveProtectedBase,
    target_root: proof.roots.targetCwd,
  }
  return {
    classification: 'SUCCESS',
    mutationPerformed: false,
    route: 'STOP',
    currentHead: proof.targetHead,
    reasons: ['Exact Architecture A committed-WIP evidence is proven; the target remains incomplete and unchanged.'],
    nextAction: {
      type: 'COMMAND',
      command: 'bemoat:context',
      description: `Run registered CLI Discovery, then fresh bemoat:context ${binding.issueNumber} --target-worktree ${proof.roots.targetCwd} --json. This proof grants no objective-edit authority.`,
    },
    details: {
      objective_edit_authority_granted: false,
      reentry_performed: false,
      wip_state: 'RED_INCOMPLETE',
      green: false,
      objective_2_complete: false,
      objective_n_plus_1_authorized: false,
      handoff_accepted_as_new: false,
      historical_handoff_comment_id: binding.expectedHandoffCommentId,
      historical_handoff_body_sha256: proof.handoffDigest,
      historical_handoff: {
        comment_id: binding.expectedHandoffCommentId,
        url: `https://github.com/${binding.expectedRepository}/issues/${binding.issueNumber}#issuecomment-${binding.expectedHandoffCommentId}`,
        author: COMMITTED_WIP_BINDING.handoffAuthor,
        objective_mode: proof.handoff.objective_mode,
        route: proof.handoff.route,
        exact_head: proof.handoff.exact_head,
        protected_base: proof.handoff.protected_base,
        body_sha256: proof.handoffDigest,
      },
      immutable_A: proof.historicalBase,
      immutable_B: proof.targetHead,
      live_protected_main_D: proof.liveProtectedBase,
      exact_tree: proof.tree,
      live_remote_head: proof.remoteHead,
      canonical_source_root: proof.roots.sourceCwd,
      canonical_target_root: proof.roots.targetCwd,
      source_identity: { repository: binding.expectedRepository, branch: binding.expectedBaseBranch, head: proof.sourceHead, live_protected_base: proof.liveProtectedBase, historical_A: proof.historicalBase, clean: true },
      target_identity: { repository: binding.expectedRepository, branch: binding.expectedBranch, upstream: `origin/${binding.expectedBranch}`, head: proof.targetHead, tree: proof.tree, live_remote_head: proof.remoteHead, clean: true },
      ancestry: { A_to_B: 'STRICT_ANCESTOR', B_to_A: 'NOT_ANCESTOR' },
      changed_paths: proof.changedPaths,
      retry_binding: retryBinding,
      next_context: `pnpm run bemoat:context ${binding.issueNumber} -- --target-worktree ${proof.roots.targetCwd} --json`,
    },
  }
}
