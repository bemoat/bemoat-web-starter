import { describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { collectContextEvidence, type ContextCommandResult, type ContextCommandRunner } from '../../scripts/context/evidence.ts'
import { routeContext } from '../../scripts/context/router.ts'
import { runContextCommand } from '../../scripts/context/runtime.ts'
import { renderHandoffComment, type HandoffRecord } from '../../scripts/handoff/schema.ts'

const repository = 'boat1994/bemoat-web-starter'
const issueNumber = '618'
const branch = 'fix/618-same-issue-clean-acquisition'
const issueUrl = `https://github.com/${repository}/issues/${issueNumber}`
const policy = '---\npolicy_id: bemoat-mission-control\nversion: 1.7.0\ncanonical_repository: boat1994/bemoat-web-starter\ntrusted_founder_login: bemoat\n---\n\n# Stateless coordination policy\n'
const issueBody = '## Goal\n\nResolve the durable no-PR HANDOFF transition.\n\n## Scope\n\nPR creation only.\n\n## Acceptance Criteria\n- [ ] Context authorizes PR creation only.\n\nTask size: small/medium\nMission Control mode: required\n'

function response(stdout: string, status = 0, stderr = ''): ContextCommandResult {
  return { status, stdout, stderr, error: null }
}

function git(cwd: string, ...args: string[]): string {
  const result = runContextCommand('git', args, { cwd })
  if (result.status !== 0 || result.error) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`)
  }
  return result.stdout.trim()
}

function makeRecord(baseSha: string, headSha: string): HandoffRecord {
  return {
    schema_version: 2,
    record_type: 'HANDOFF',
    objective_mode: 'implementation',
    repository,
    issue_number: issueNumber,
    objective: 'Proceed from the durable implementation checkpoint to PR creation.',
    permitted_scope: ['Open exactly one PR from the verified branch.'],
    prohibited_scope: ['Do not edit source, stage, commit, push, merge, or publish another HANDOFF.'],
    executing_agent: 'Issue #618 implementation worker',
    provider: 'OpenAI Codex',
    branch,
    exact_head: headSha,
    protected_base: { branch: 'main', sha: baseSha },
    pr: null,
    verified_evidence: [{
      kind: 'validation-proof',
      value: JSON.stringify({ status: 'PASS', tier: 'code', command: 'pnpm run bemoat:check', exact_head: headSha }),
      url: null,
    }],
    route: 'IMPLEMENT',
    next_action: { route: 'IMPLEMENT', description: 'Continue the bounded implementation objective.' },
    stop_conditions: ['Stop on identity, ancestry, validation, or durability ambiguity.'],
    local_durability: { required: true, durable: true, reason: null },
  }
}

function graphEvidenceRunner({ cwd, baseSha, liveBaseSha, headSha, compareMutation, activePr = false, unlinkedPr = false, branchLookupError = false }: {
  cwd: string
  baseSha: string
  liveBaseSha: string
  headSha: string
  compareMutation?: 'diverged' | 'behind' | 'zero-ahead' | 'wrong-base' | 'wrong-merge-base'
  activePr?: boolean
  unlinkedPr?: boolean
  branchLookupError?: boolean
}): { run: ContextCommandRunner; compareCalls: string[]; ancestry: Record<string, unknown>; unlinkedPrCalls: string[]; issueSearchCalls: string[]; branchLookupCalls: string[] } {
  const mergeBase = git(cwd, 'merge-base', baseSha, liveBaseSha)
  const aheadBy = Number(git(cwd, 'rev-list', '--count', `${baseSha}..${liveBaseSha}`))
  const behindBy = Number(git(cwd, 'rev-list', '--count', `${liveBaseSha}..${baseSha}`))
  const ancestry = {
    status: aheadBy > 0 && behindBy === 0 ? 'ahead' : 'diverged',
    ahead_by: aheadBy,
    behind_by: behindBy,
    base_commit: { sha: baseSha },
    merge_base_commit: { sha: mergeBase },
  }
  if (compareMutation === 'diverged') ancestry.status = 'diverged'
  if (compareMutation === 'behind') ancestry.behind_by = 1
  if (compareMutation === 'zero-ahead') ancestry.ahead_by = 0
  if (compareMutation === 'wrong-base') ancestry.base_commit.sha = headSha
  if (compareMutation === 'wrong-merge-base') ancestry.merge_base_commit.sha = headSha
  const compareCalls: string[] = []
  const unlinkedPrCalls: string[] = []
  const issueSearchCalls: string[] = []
  const branchLookupCalls: string[] = []
  const commentId = 6061118688
  const comment = {
    url: `${issueUrl}#issuecomment-${commentId}`,
    body: renderHandoffComment(makeRecord(baseSha, headSha)),
    createdAt: '2026-10-06T12:00:00Z',
    author: { login: 'codex' },
    authorAssociation: 'NONE',
  }

  const run: ContextCommandRunner = (command, args, options = {}) => {
    const key = args.join(' ')
    if (command === 'git') {
      if (args[0] === 'ls-remote') {
        return response(`${headSha}\trefs/heads/${branch}\n${liveBaseSha}\trefs/heads/main\n`)
      }
      return runContextCommand(command, args, { ...options, cwd })
    }
    if (command !== 'gh') return response('')

    const compare = args.find((arg) => arg === `repos/${repository}/compare/${baseSha}...${liveBaseSha}`)
    if (compare) {
      compareCalls.push(compare)
      return response(JSON.stringify(ancestry))
    }
    if (key === `api repos/${repository}/git/ref/heads/dev`) {
      return response('Not Found', 1, 'Not Found')
    }
    if (key === `api repos/${repository}/git/ref/heads/main`) {
      return response(JSON.stringify({ object: { sha: liveBaseSha } }))
    }
    if (key.startsWith(`api repos/${repository}/contents/docs/mission-control/mission-control-guide.md?ref=`)) {
      return response(JSON.stringify({
        sha: git(cwd, 'rev-parse', `${liveBaseSha}:docs/mission-control/mission-control-guide.md`),
        content: Buffer.from(policy).toString('base64'),
        encoding: 'base64',
      }))
    }
    if (key.startsWith(`issue view ${issueNumber} `)) {
      return response(JSON.stringify({
        number: Number(issueNumber),
        title: 'fix(context): reconcile durable no-PR implementation HANDOFF before PR',
        state: 'OPEN',
        url: issueUrl,
        body: issueBody,
        comments: [comment],
      }))
    }
    if (args[0] === 'pr' && args[1] === 'list') {
      if (args.includes('--search')) issueSearchCalls.push(key)
      if (args.includes('--head')) {
        branchLookupCalls.push(key)
        if (branchLookupError) return response('', 1, 'GitHub branch PR lookup unavailable')
      }
      if (unlinkedPr) {
        if (args.includes('--search')) return response('[]')
        const activeBranchPr = {
          number: 621,
          url: `https://github.com/${repository}/pull/621`,
          headRefName: branch,
          title: 'Unrelated improvement',
          body: 'Changes for the current topic branch.',
          closingIssuesReferences: [] as unknown[],
        }
        if (args.includes('--head')) return response(JSON.stringify([activeBranchPr]))
        const limitIndex = args.indexOf('--limit')
        const limit = limitIndex >= 0 ? Number(args[limitIndex + 1]) : 100
        const firstHundred = Array.from({ length: 100 }, (_, index) => ({
          number: 700 + index,
          url: `https://github.com/${repository}/pull/${700 + index}`,
          headRefName: `fix/${700 + index}-unrelated`,
          title: 'Unrelated improvement',
          body: 'No Issue link.',
          closingIssuesReferences: [] as unknown[],
        }))
        if (limit > 100) return response(JSON.stringify([...firstHundred, activeBranchPr]))
        unlinkedPrCalls.push(key)
        return response(JSON.stringify(firstHundred))
      }
      return response(activePr ? JSON.stringify([{
        number: 620,
        url: `https://github.com/${repository}/pull/620`,
        headRefName: branch,
        title: 'Issue 618 implementation',
        body: 'Closes #618',
        closingIssuesReferences: [{ number: Number(issueNumber) }],
      }]) : '[]')
    }
    if (args[0] === 'pr' && args[1] === 'view') return response(JSON.stringify({
      number: 620,
      state: 'OPEN',
      isDraft: false,
      url: `https://github.com/${repository}/pull/620`,
      baseRefName: 'main',
      baseRefOid: liveBaseSha,
      headRefName: branch,
      headRefOid: headSha,
      mergeCommit: null,
      statusCheckRollup: [],
    }))
    if (key === `api --paginate --slurp repos/${repository}/pulls/620/reviews?per_page=100`) return response('[[]]')
    if (key === `api repos/${repository}/branches/main/protection`) return response('{}')
    return response('')
  }

  return { run, compareCalls, ancestry, unlinkedPrCalls, issueSearchCalls, branchLookupCalls }
}

function runAncestryScenario(compareMutation?: Parameters<typeof graphEvidenceRunner>[0]['compareMutation'], activePr = false, unlinkedPr = false, branchLookupError = false) {
  const cwd = mkdtempSync(join(tmpdir(), 'bemoat-618-pr-ready-ancestry-'))
  try {
    git(cwd, 'init', '-b', 'main')
    git(cwd, 'config', 'user.email', 'context-test@example.invalid')
    git(cwd, 'config', 'user.name', 'Context test')
    mkdirSync(join(cwd, 'docs/mission-control'), { recursive: true })
    writeFileSync(join(cwd, 'docs/mission-control/mission-control-guide.md'), policy)
    git(cwd, 'add', 'docs/mission-control/mission-control-guide.md')
    git(cwd, 'commit', '-m', 'protected baseline')
    const baseSha = git(cwd, 'rev-parse', 'HEAD')

    git(cwd, 'switch', '-c', branch)
    writeFileSync(join(cwd, 'implementation.ts'), 'export const complete = true\n')
    git(cwd, 'add', 'implementation.ts')
    git(cwd, 'commit', '-m', 'Issue 618 implementation')
    const headSha = git(cwd, 'rev-parse', 'HEAD')
    git(cwd, 'switch', 'main')
    writeFileSync(join(cwd, 'main-advance.txt'), 'compatible descendant\n')
    git(cwd, 'add', 'main-advance.txt')
    git(cwd, 'commit', '-m', 'advance protected main')
    const liveBaseSha = git(cwd, 'rev-parse', 'HEAD')
    git(cwd, 'switch', branch)
    git(cwd, 'remote', 'add', 'origin', `https://github.com/${repository}.git`)
    git(cwd, 'config', `branch.${branch}.remote`, 'origin')
    git(cwd, 'config', `branch.${branch}.merge`, `refs/heads/${branch}`)
    git(cwd, 'update-ref', `refs/remotes/origin/${branch}`, headSha)

    const { run, compareCalls, ancestry, unlinkedPrCalls, issueSearchCalls, branchLookupCalls } = graphEvidenceRunner({ cwd, baseSha, liveBaseSha, headSha, compareMutation, activePr, unlinkedPr, branchLookupError })
    const evidence = collectContextEvidence({
      cwd,
      issueNumber,
      env: { GH_REPO: repository, NODE_ENV: 'test', PAYLOAD_SECRET: 'test-only-secret' },
      run,
    })
    return {
      evidence,
      decision: routeContext(evidence),
      compareCalls,
      ancestry,
      baseSha,
      liveBaseSha,
      headSha,
      unlinkedPrSeen: unlinkedPrCalls.length > 0,
      issueSearchCalls,
      branchLookupCalls,
    }
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
}

describe('Context PR_READY after protected main advances', () => {
  // Authority: the Founder protocol permits PR_READY after main advances only
  // when the immutable HANDOFF base is a strict ancestor of live approved main.
  // This story builds real commits and feeds the native GitHub compare response
  // from their actual merge-base/ahead/behind relationship through public
  // collectContextEvidence, then routes that collected evidence.
  it('accepts the exact durable #618 HANDOFF when main advanced by a compatible descendant commit', () => {
    const { evidence, decision, compareCalls, ancestry, baseSha, liveBaseSha, headSha } = runAncestryScenario()

    expect(ancestry).toMatchObject({ status: 'ahead', ahead_by: 1, behind_by: 0, base_commit: { sha: baseSha }, merge_base_commit: { sha: baseSha } })
    expect(evidence).toMatchObject({
      localGit: { branch, head: headSha, clean: true, pushed: true, durable: true },
      protectedBase: { branch: 'main', sha: liveBaseSha },
      durableContext: { handoffs: [expect.objectContaining({ id: String(6061118688) })] },
      evidenceErrors: [],
    })
    expect(decision).toMatchObject({
      route: 'PR_READY',
      nextAction: {
        type: 'OPEN_PR',
        command: 'gh pr create',
        description: 'Open exactly one PR from the uniquely verified, already-pushed canonical Issue branch to the approved protected base. No source edits or other Git mutations are authorized.',
      },
    })
    expect(compareCalls).toEqual([`repos/${repository}/compare/${baseSha}...${liveBaseSha}`])
  })

  it('routes fresh active-PR evidence through ordinary REVIEW while retaining the historical null-PR HANDOFF', () => {
    // Founder lifecycle authority: after PR creation, fresh Context must detect
    // the active PR and resume ordinary VERIFY / REVIEW / FOUNDER_GATE routing.
    // The immutable pre-PR HANDOFF remains pr:null and records the prior base.
    const { evidence, decision, compareCalls, baseSha, liveBaseSha, headSha } = runAncestryScenario(undefined, true)

    expect(evidence).toMatchObject({
      activePr: {
        number: '620',
        baseBranch: 'main',
        baseSha: liveBaseSha,
        headBranch: branch,
        headSha,
      },
      protectedBase: { branch: 'main', sha: liveBaseSha },
      currentHeadVerification: { exactHead: headSha },
      evidenceErrors: [],
    })
    const historicalHandoff = evidence.durableContext.handoffs?.[0]
    expect(historicalHandoff).toBeDefined()
    expect(historicalHandoff?.body).toContain('"pr": null')
    expect(historicalHandoff?.body).toContain(`"sha": "${baseSha}"`)
    expect(decision).toMatchObject({ route: 'REVIEW', nextAction: { type: 'COMMAND' } })
    expect(compareCalls).toEqual([])
  })

  it('does not return PR_READY when an unlinked same-branch PR is beyond the first 100 entries', () => {
    // Founder eligibility requires that no active PR is already associated
    // with the verified branch. Issue linkage is not required for that branch
    // association. The issue search succeeds with no result; the unfiltered
    // query returns its first 100 entries while the same-branch PR is entry 101.
    // A branch-specific query or pagination can detect it; assert only the
    // exclusion uniquely required by PR_READY, not a guessed fallback route.
    const { evidence, decision, unlinkedPrSeen } = runAncestryScenario(undefined, false, true)

    expect(unlinkedPrSeen).toBe(true)
    expect(evidence.activePr).toBeNull()
    expect(decision.route).not.toBe('PR_READY')
  })

  it('returns STOP when Issue PR search succeeds but the exact-branch PR lookup fails', () => {
    // Founder eligibility requires reliable active-PR absence for the exact
    // branch. A successful Issue search does not substitute for an unavailable
    // branch lookup, so Context must fail closed.
    const { evidence, decision, issueSearchCalls, branchLookupCalls } = runAncestryScenario(undefined, false, false, true)

    expect(issueSearchCalls.length).toBeGreaterThan(0)
    expect(branchLookupCalls.length).toBeGreaterThan(0)
    expect(evidence.evidenceErrors.join('\n')).toContain('active PR lookup for branch')
    expect(decision).toMatchObject({ route: 'STOP', nextAction: { type: 'STOP' } })
  })

  it.each([
    ['diverged comparison', 'diverged'],
    ['behind comparison', 'behind'],
    ['comparison with no strict advancement', 'zero-ahead'],
    ['wrong comparison base', 'wrong-base'],
    ['wrong merge base', 'wrong-merge-base'],
  ] as const)('returns STOP for %s native ancestry evidence', (_label, mutation) => {
    const { decision, compareCalls, baseSha, liveBaseSha } = runAncestryScenario(mutation)

    expect(compareCalls).toEqual([`repos/${repository}/compare/${baseSha}...${liveBaseSha}`])
    expect(decision).toMatchObject({ route: 'STOP', nextAction: { type: 'STOP' } })
  })
})
