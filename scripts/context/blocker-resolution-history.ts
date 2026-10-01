import { createHash } from 'node:crypto'

import { parseBlockerResolutionRecord } from './blocker-resolution.ts'
import type { HistoricalBlockerResolutionProof, PolicyEvidence, RoleEvidence } from './model.ts'
import { parseProtectedPolicyContent } from './policy.ts'
import { json, isFullSha, type ContextCommandRunner } from './runtime.ts'

const GUIDE_PATH = 'docs/mission-control/mission-control-guide.md'
const COMMAND_REFERENCE_PATH = 'docs/mission-control/command-reference.md'

interface GithubContents {
  type?: string
  path?: string
  sha?: string
  content?: string
  encoding?: string
}

function readFileAtSha({ repo, sha, path, run, cwd, env }: {
  repo: string
  sha: string
  path: string
  run: ContextCommandRunner
  cwd?: string
  env?: NodeJS.ProcessEnv
}): { sha: string; content: string } | null {
  const result = json<GithubContents>(run, 'gh', ['api', `repos/${repo}/contents/${path}?ref=${sha}`], { cwd, env })
  const file = result.value
  if (!file || file.type !== 'file' || file.path !== path || !isFullSha(file.sha) ||
      file.encoding !== 'base64' || typeof file.content !== 'string') return null
  const encoded = file.content.replace(/\s/g, '')
  if (!encoded || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) return null
  const bytes = Buffer.from(encoded, 'base64')
  if (bytes.toString('base64') !== encoded) return null
  const content = bytes.toString('utf8')
  if (!Buffer.from(content, 'utf8').equals(bytes)) return null
  return { sha: file.sha.toLowerCase(), content }
}

function isSha(value: string): boolean {
  return /^[0-9a-f]{40}$/.test(value)
}

function samePolicyIdentity(historical: PolicyEvidence, current: PolicyEvidence): boolean {
  return historical.path === current.path && historical.policyId === current.policyId &&
    historical.version === current.version && historical.sourceSha === current.sourceSha &&
    Boolean(historical.trustedFounderLogin) && historical.trustedFounderLogin === current.trustedFounderLogin
}

function acquireOne({ repo, currentBase, policy, resolution, contextBinding, run, cwd, env }: {
  repo: string
  currentBase: { branch: string; sha: string }
  policy: PolicyEvidence
  resolution: RoleEvidence
  contextBinding?: { issueNumber: string; prNumber: string; headSha: string }
  run: ContextCommandRunner
  cwd?: string
  env?: NodeJS.ProcessEnv
}): HistoricalBlockerResolutionProof | null {
  const record = parseBlockerResolutionRecord(resolution.body)
  if (!record || record.repository !== repo || record.protected_base.branch !== currentBase.branch ||
      record.protected_base.sha === currentBase.sha || !isSha(record.protected_base.sha) ||
      !isSha(currentBase.sha) || !isSha(policy.sourceSha) || policy.path !== GUIDE_PATH ||
      !policy.trustedFounderLogin ||
      (contextBinding && (record.issue_number !== contextBinding.issueNumber ||
        record.pr_number !== contextBinding.prNumber || record.exact_head !== contextBinding.headSha))) return null

  const historicalGuide = readFileAtSha({ repo, sha: record.protected_base.sha, path: GUIDE_PATH, run, cwd, env })
  const currentGuide = readFileAtSha({ repo, sha: currentBase.sha, path: GUIDE_PATH, run, cwd, env })
  const historicalCommandReference = readFileAtSha({ repo, sha: record.protected_base.sha, path: COMMAND_REFERENCE_PATH, run, cwd, env })
  const currentCommandReference = readFileAtSha({ repo, sha: currentBase.sha, path: COMMAND_REFERENCE_PATH, run, cwd, env })
  if (!historicalGuide || !currentGuide || !historicalCommandReference || !currentCommandReference ||
      historicalGuide.sha !== record.policy.source_sha || historicalGuide.sha !== policy.sourceSha ||
      currentGuide.sha !== policy.sourceSha) return null

  const historicalPolicy = parseProtectedPolicyContent({
    repo, branch: record.protected_base.sha, sha: historicalGuide.sha, content: historicalGuide.content,
  })
  const exactCurrentPolicy = parseProtectedPolicyContent({
    repo, branch: currentBase.sha, sha: currentGuide.sha, content: currentGuide.content,
  })
  if (!historicalPolicy || !exactCurrentPolicy || !samePolicyIdentity(historicalPolicy, policy) ||
      !samePolicyIdentity(exactCurrentPolicy, policy) ||
      record.policy.path !== historicalPolicy.path || record.policy.policy_id !== historicalPolicy.policyId ||
      record.policy.version !== historicalPolicy.version || record.policy.source_sha !== historicalPolicy.sourceSha) return null

  const compare = json<{
    status?: unknown
    ahead_by?: unknown
    behind_by?: unknown
    base_commit?: { sha?: unknown }
    merge_base_commit?: { sha?: unknown }
  }>(run, 'gh', ['api', `repos/${repo}/compare/${record.protected_base.sha}...${currentBase.sha}`], { cwd, env })
  const facts = compare.value
  if (!facts || facts.status !== 'ahead' || !Number.isSafeInteger(facts.ahead_by) ||
      (facts.ahead_by as number) <= 0 || facts.behind_by !== 0 ||
      facts.base_commit?.sha !== record.protected_base.sha ||
      facts.merge_base_commit?.sha !== record.protected_base.sha) return null

  return {
    resolutionCommentId: String(resolution.id),
    resolutionBodySha256: createHash('sha256').update(resolution.body, 'utf8').digest('hex'),
    repository: repo,
    historicalBase: { branch: record.protected_base.branch, sha: record.protected_base.sha },
    currentBase: { branch: currentBase.branch, sha: currentBase.sha },
    historicalPolicy,
    historicalContractBlobs: {
      missionControlGuideSha: historicalGuide.sha,
      commandReferenceSha: historicalCommandReference.sha,
    },
    currentContractBlobs: {
      missionControlGuideSha: currentGuide.sha,
      commandReferenceSha: currentCommandReference.sha,
    },
    ancestry: {
      status: 'ahead',
      baseSha: record.protected_base.sha,
      currentSha: currentBase.sha,
      mergeBaseSha: record.protected_base.sha,
      aheadBy: facts.ahead_by as number,
      behindBy: 0,
    },
  }
}

/** Acquire per-resolution compatibility facts from exact, read-only GitHub endpoints. */
export function readHistoricalBlockerResolutionProofs({
  repo,
  currentBase,
  policy,
  resolutions,
  contextBinding,
  run,
  cwd = process.cwd(),
  env = process.env,
}: {
  repo: string
  currentBase: { branch: string; sha: string }
  policy: PolicyEvidence
  resolutions: RoleEvidence[]
  contextBinding?: { issueNumber: string; prNumber: string; headSha: string }
  run: ContextCommandRunner
  cwd?: string
  env?: NodeJS.ProcessEnv
}): HistoricalBlockerResolutionProof[] {
  const proofs: HistoricalBlockerResolutionProof[] = []
  for (const resolution of resolutions) {
    try {
      const proof = acquireOne({ repo, currentBase, policy, resolution, contextBinding, run, cwd, env })
      if (proof) proofs.push(proof)
    } catch {
      // Historical evidence is optional per candidate; a failed read grants no proof.
    }
  }
  return proofs
}
