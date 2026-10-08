import { describe, expect, it } from 'vitest'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { createContextOutput } from '../../scripts/agent-context.ts'
import {
  collectContextEvidence,
  readGithubEvidence,
  readLocalGitEvidence,
  readProtectedPolicy,
  type ContextCommandResult,
  type ContextCommandRunner,
} from '../../scripts/context/evidence.ts'
import { routeContext } from '../../scripts/context/router.ts'
import { runContextCommand } from '../../scripts/context/runtime.ts'
import { parseProtectedPolicyContent } from '../../scripts/context/policy.ts'

function response(stdout: string): ContextCommandResult {
  return { status: 0, stdout, stderr: '', error: null }
}

function nativeReviewApiResponse(
  args: readonly string[],
  reviewsByPr: Record<string, unknown[]> = {},
): ContextCommandResult | null {
  const endpoint = args.find((arg) => /^repos\/[^/]+\/[^/]+\/pulls\/[1-9]\d*\/reviews\?per_page=100$/.test(arg))
  const number = endpoint?.match(/\/pulls\/([1-9]\d*)\/reviews\?per_page=100$/)?.[1]
  if (!number) return null
  return response(JSON.stringify([reviewsByPr[number] ?? []]))
}

const contextRepo = 'boat1994/bemoat-web-starter'
const contextPolicy = '---\npolicy_id: bemoat-mission-control\nversion: 1.3.0\ncanonical_repository: boat1994/bemoat-web-starter\n---\n\n# Mission Control\n'
const contextIssueBody = '## Goal\n\nCharacterize branch ownership.\n\n## Scope\n\nRead-only characterization.\n\n## Acceptance Criteria\n- Wrong issue branch must not route IMPLEMENT.\n\nTask size: small\nMission Control mode: optional\n'

interface RemoteBranchFixture {
  branch: string
  sha?: string
}

function setupContextRepo(
  branch: string,
  detached = false,
  withUpstream = true,
  remoteTrackingBranches: RemoteBranchFixture[] = [],
  localBranches: Array<RemoteBranchFixture & { upstream?: string | null }> = [],
  sourceUpstreamRemote = 'origin',
) {
  const cwd = mkdtempSync(join(tmpdir(), 'bemoat-context-branch-ownership-'))
  const git = (args: string[]) => {
    const result = runContextCommand('git', args, { cwd })
    if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`)
    return result.stdout.trim()
  }

  git(['init', '-b', 'main'])
  git(['config', 'user.email', 'context-test@example.invalid'])
  git(['config', 'user.name', 'Context test'])
  writeFileSync(join(cwd, 'baseline.txt'), 'baseline\n')
  git(['add', 'baseline.txt'])
  git(['commit', '-m', 'baseline'])
  if (branch !== 'main') git(['switch', '-c', branch])
  git(['remote', 'add', 'origin', `git@github.com:${contextRepo}.git`])
  if (!detached && withUpstream) {
    git(['config', `branch.${branch}.remote`, sourceUpstreamRemote])
    git(['config', `branch.${branch}.merge`, `refs/heads/${branch}`])
    git(['update-ref', `refs/remotes/origin/${branch}`, git(['rev-parse', 'HEAD'])])
    if (sourceUpstreamRemote !== 'origin') {
      git(['remote', 'add', sourceUpstreamRemote, `git@github.com:${contextRepo}.git`])
      git(['update-ref', `refs/remotes/${sourceUpstreamRemote}/${branch}`, git(['rev-parse', 'HEAD'])])
    }
  }
  const sourceHead = git(['rev-parse', 'HEAD'])
  for (const remoteBranch of remoteTrackingBranches) {
    const trackingHead = remoteBranch.sha === 'stale'
      ? git(['commit-tree', git(['rev-parse', 'HEAD^{tree}']), '-p', sourceHead, '-m', `stale ${remoteBranch.branch}`])
      : remoteBranch.sha ?? sourceHead
    git(['update-ref', `refs/remotes/origin/${remoteBranch.branch}`, trackingHead])
  }
  for (const localBranch of localBranches) {
    const localHead = localBranch.sha === 'stale'
      ? git(['commit-tree', git(['rev-parse', 'HEAD^{tree}']), '-p', sourceHead, '-m', `stale local ${localBranch.branch}`])
      : localBranch.sha ?? sourceHead
    git(['update-ref', `refs/heads/${localBranch.branch}`, localHead])
    if (localBranch.upstream !== null) {
      const upstream = localBranch.upstream ?? `origin/${localBranch.branch}`
      const remoteSeparator = upstream.indexOf('/')
      const remote = upstream.slice(0, remoteSeparator)
      const remoteBranch = upstream.slice(remoteSeparator + 1)
      git(['config', `branch.${localBranch.branch}.remote`, remote!])
      git(['config', `branch.${localBranch.branch}.merge`, `refs/heads/${remoteBranch!}`])
    }
  }
  if (detached) git(['checkout', '--detach'])

  return { cwd, head: git(['rev-parse', 'HEAD']) }
}

function contextStoryRunner({
  cwd,
  head,
  branch,
  durable,
  issueNumber,
  activePr,
  prHeadBranch,
  prHeadSha,
  merged,
  remoteBranches = [],
  dirty = false,
  worktreeBranches = [],
}: {
  cwd: string
  head: string
  branch: string
  durable: boolean
  issueNumber: string
  activePr?: boolean
  prHeadBranch?: string
  prHeadSha?: string
  merged?: boolean
  remoteBranches?: RemoteBranchFixture[]
  dirty?: boolean
  worktreeBranches?: string[]
}): ContextCommandRunner {
  return (command, args, options = {}) => {
    const key = args.join(' ')
    if (command === 'git') {
      if (args[0] === 'ls-remote') {
        if (!durable) return response('')
        const refs = [{ branch, sha: head }, ...remoteBranches.map((remoteBranch) => ({
          branch: remoteBranch.branch,
          sha: remoteBranch.sha ?? head,
        }))]
        const requestedBranch = args.length > 3 ? args[args.length - 1] : null
        return response(refs
          .filter((ref) => requestedBranch === null || ref.branch === requestedBranch)
          .map((ref) => `${ref.sha}\trefs/heads/${ref.branch}\n`)
          .join(''))
      }
      if (args[0] === 'worktree' && args[1] === 'list') {
        const current = `worktree ${cwd}\nHEAD ${head}\nbranch refs/heads/${branch}\n`
        const others = worktreeBranches.map((otherBranch, index) =>
          `\nworktree /other/worktree-${index}\nHEAD ${head}\nbranch refs/heads/${otherBranch}\n`,
        ).join('')
        return response(`${current}${others}`)
      }
      if (dirty && key === 'status --short') return response(' M unrelated.txt\n')
      return runContextCommand(command, args, { ...options, cwd })
    }
    if (command !== 'gh') return response('')
    const reviewApiResponse = nativeReviewApiResponse(args)
    if (reviewApiResponse) return reviewApiResponse
    if (key.includes('git/ref/heads/dev')) return { status: 1, stdout: '', stderr: 'Not Found', error: null }
    if (key.includes('git/ref/heads/main')) return response(JSON.stringify({ object: { sha: 'a'.repeat(40) } }))
    if (key.includes('contents/docs/mission-control/mission-control-guide.md')) {
      return response(JSON.stringify({ sha: 'c'.repeat(40), content: Buffer.from(contextPolicy).toString('base64'), encoding: 'base64' }))
    }
    if (args[0] === 'issue' && args[1] === 'view') {
      return response(JSON.stringify({
        number: Number(issueNumber),
        title: 'branch ownership characterization',
        state: merged ? 'CLOSED' : 'OPEN',
        url: `https://github.com/${contextRepo}/issues/${issueNumber}`,
        body: contextIssueBody,
        comments: [],
      }))
    }
    if (args[0] === 'pr' && args[1] === 'list') {
      if (!activePr) return response('[]')
      return response(JSON.stringify([{
        number: 526,
        url: `https://github.com/${contextRepo}/pull/526`,
        headRefName: prHeadBranch ?? branch,
        closingIssuesReferences: [{ number: Number(issueNumber) }],
      }]))
    }
    if (args[0] === 'pr' && args[1] === 'view') {
      const isMerged = Boolean(merged)
      return response(JSON.stringify({
        number: 526,
        state: isMerged ? 'MERGED' : 'OPEN',
        isDraft: false,
        url: `https://github.com/${contextRepo}/pull/526`,
        baseRefName: 'main',
        baseRefOid: 'a'.repeat(40),
        headRefName: prHeadBranch ?? branch,
        headRefOid: prHeadSha ?? head,
        mergeCommit: isMerged ? { oid: 'e'.repeat(40) } : null,
        statusCheckRollup: [],
      }))
    }
    if (key.includes(`/branches/main/protection`)) return response('{}')
    return response('')
  }
}

function routeContextStory(story: {
  issueNumber: string
  branch: string
  durable?: boolean
  detached?: boolean
  withUpstream?: boolean
  activePr?: boolean
  prHeadBranch?: string
  prHeadSha?: string
  merged?: boolean
  remoteBranches?: RemoteBranchFixture[]
  remoteTrackingBranches?: RemoteBranchFixture[]
  localBranches?: Array<RemoteBranchFixture & { upstream?: string | null }>
  sourceUpstreamRemote?: string
  dirty?: boolean
  worktreeBranches?: string[]
}) {
  const { cwd, head } = setupContextRepo(
    story.branch,
    story.detached,
    story.withUpstream,
    story.remoteTrackingBranches,
    story.localBranches,
    story.sourceUpstreamRemote,
  )
  try {
    const evidence = collectContextEvidence({
      cwd,
      issueNumber: story.issueNumber,
      env: { GH_REPO: contextRepo, NODE_ENV: 'test', PAYLOAD_SECRET: 'test-only-secret' },
      run: contextStoryRunner({
        cwd,
        head,
        branch: story.branch,
        durable: story.durable ?? true,
        issueNumber: story.issueNumber,
        activePr: story.activePr,
        prHeadBranch: story.prHeadBranch,
        prHeadSha: story.prHeadSha,
        merged: story.merged,
        remoteBranches: story.remoteBranches,
        dirty: story.dirty,
        worktreeBranches: story.worktreeBranches,
      }),
    })
    return { evidence, decision: routeContext(evidence) }
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
}

describe('bemoat:context neutral evidence adapters', () => {
  // Authority: Issue #594 acceptance requires fresh Context to recognize the
  // exact clean #588 recurrence when target HEAD is strictly behind, but the
  // target tracking ref and both live protected-main authorities equal the
  // exact live SHA. This exercises evidence collection and Context routing,
  // rather than supplying setupBaseRecovery directly.
  it('routes the exact benign #594 tracking-ref-ahead state to registered recovery', () => {
    const targetHead = '46fe5363697cb24f0db5a6d4338a5540665bb697'
    const liveMain = 'e3f5f7f4408d810dea0993e2b5ae7a1739d1bbc3'
    const policySha = 'd587ff2c6ac4a314b193e321613c3299c83b6da5'
    const repository = 'bemoat/bemoat-web-starter'
    const policyContent = '---\npolicy_id: bemoat-mission-control\nversion: 1.7.0\ncanonical_repository: bemoat/bemoat-web-starter\ntrusted_founder_login: bemoat\n---\n\n# Mission Control\n'
    const run: ContextCommandRunner = (command, args) => {
      const key = args.join(' ')
      if (command === 'git') {
        const values: Record<string, string> = {
          'branch --show-current': 'main\n',
          'rev-parse HEAD': `${targetHead}\n`,
          'status --short': '',
          'rev-parse --abbrev-ref --symbolic-full-name @{upstream}': 'origin/main\n',
          'remote get-url origin': `https://github.com/${repository}.git\n`,
          'ls-remote --heads origin main': `${liveMain}\trefs/heads/main\n`,
          'rev-parse --verify --quiet refs/remotes/origin/main': `${liveMain}\n`,
          [`merge-base --is-ancestor HEAD ${liveMain}`]: '',
        }
        return response(values[key] ?? '')
      }
      if (key.includes('git/ref/heads/dev')) return { status: 1, stdout: '', stderr: 'Not Found', error: null }
      if (key.includes('git/ref/heads/main')) return response(JSON.stringify({ object: { sha: liveMain } }))
      if (key.includes('contents/docs/mission-control/mission-control-guide.md')) {
        return response(JSON.stringify({
          sha: policySha,
          content: Buffer.from(policyContent).toString('base64'),
          encoding: 'base64',
        }))
      }
      if (key.includes(`/branches/main/protection`)) return response('{}')
      if (key.startsWith('issue view 594')) {
        return response(JSON.stringify({
          number: 594,
          title: 'fix(context): recover stale protected target after shared tracking-ref advance',
          state: 'OPEN',
          url: `https://github.com/${repository}/issues/594`,
          body: '## Goal\n\nRecover the exact benign stale protected target.\n\n## Scope\n\nExact #588 recurrence only.\n\n## Acceptance Criteria\n- [ ] Recognize the exact tracking-ref-ahead state.\n\nTask size: medium\nMission Control mode: required\n',
          comments: [],
        }))
      }
      if (key.startsWith('pr list')) return response('[]')
      return response('')
    }

    const evidence = collectContextEvidence({
      cwd: '/target', issueNumber: '594',
      env: { GH_REPO: repository, NODE_ENV: 'test', PAYLOAD_SECRET: 'test-only-secret' },
      run,
    })
    const decision = routeContext(evidence)

    expect(evidence).toMatchObject({
      repository: { nameWithOwner: repository },
      policy: { sourceSha: policySha, version: '1.7.0' },
      issue: { number: '594', title: 'fix(context): recover stale protected target after shared tracking-ref advance' },
      localGit: { branch: 'main', head: targetHead, upstream: 'origin/main', clean: true, detached: false },
      protectedBase: { branch: 'main', sha: liveMain },
      setupBaseRecovery: { liveUpstreamHead: liveMain, localUpstreamHead: liveMain, ancestry: 'STRICT_ANCESTOR' },
      evidenceErrors: [],
    })
    expect(decision).toMatchObject({
      route: 'STOP',
      nextAction: { type: 'COMMAND', command: 'bemoat:context:recover-setup' },
    })
  })

  it.each([
    ['dirty', { 'status --short': ' M file\n' }],
    ['detached', { 'branch --show-current': '' }],
    ['unpushed', { 'rev-parse refs/remotes/origin/feature/410-context': `${'c'.repeat(40)}\n` }],
    ['wrong upstream', { 'rev-parse --abbrev-ref --symbolic-full-name @{upstream}': 'origin/main\n' }],
  ])('fails local durability closed for %s work', (_label, overrides) => {
    const run: ContextCommandRunner = (_command, args) => {
      const key = args.join(' ')
      const values: Record<string, string> = {
        'branch --show-current': 'feature/410-context\n',
        'rev-parse HEAD': `${'b'.repeat(40)}\n`,
        'status --short': '',
        'rev-parse --abbrev-ref --symbolic-full-name @{upstream}': 'origin/feature/410-context\n',
        'remote get-url origin': 'git@github.com:boat1994/bemoat-web-starter.git\n',
        'rev-parse refs/remotes/origin/feature/410-context': `${'b'.repeat(40)}\n`,
        ...overrides,
      }
      return response(values[key] ?? '')
    }

    const evidence = readLocalGitEvidence({ cwd: '/repo', run })
    expect(evidence.durable).toBe(false)
    expect(evidence.reasons.join(' ')).toMatch(/LOCAL_STATE_NOT_DURABLE/)
  })

  it.each([
    ['#525 on a #477 branch', '525', 'test/477-commercial-journey-dogfood'],
    ['#495 on a #477 branch', '495', 'test/477-commercial-journey-dogfood'],
    ['historical #216 on a #215 branch', '216', 'test/215-commercial-journey-dogfood'],
    ['single-digit #8 on a #7 branch', '8', 'fix/7-small-neighbor'],
    ['neighboring #526 branch for #525', '525', 'fix/526-neighboring-change'],
  ])('stops no-PR routing for %s', (name, issueNumber, branch) => {
    const { evidence, decision } = routeContextStory({ issueNumber, branch })
    expect(evidence.localGit).toMatchObject({ clean: true, pushed: true, durable: true, detached: false })
    expect(evidence.evidenceErrors, name).toEqual([])
    expect(evidence.activePr, name).toBeNull()
    expect(decision.route, name).toBe('STOP')
    expect(decision.reasons.join('\n'), name).toMatch(/EVIDENCE_CONFLICT:.*branch.*Issue/i)
  })

  it('preserves matching, unnumbered, protected, and local-durability routing boundaries', () => {
    expect(routeContextStory({ issueNumber: '525', branch: 'fix/525-branch-issue-ownership' }).decision.route).toBe('IMPLEMENT')
    expect(routeContextStory({ issueNumber: '8', branch: 'fix/8-small-change' }).decision.route).toBe('IMPLEMENT')
    expect(routeContextStory({ issueNumber: '525', branch: 'test/branch-ownership' }).decision.route).toBe('IMPLEMENT')

    for (const branch of ['main', 'dev']) {
      const { decision } = routeContextStory({ issueNumber: '525', branch })
      expect(decision.route, branch).toBe('STOP')
      expect(decision.reasons.join('\n'), branch).toMatch(/protected or integration branch/)
    }

    const nondurableStories = [
      { issueNumber: '525', branch: 'fix/477-detached', detached: true, durable: false },
      { issueNumber: '525', branch: 'fix/477-local-only', withUpstream: false, durable: false },
      { issueNumber: '525', branch: 'fix/477-unpushed', durable: false },
    ]
    for (const story of nondurableStories) {
      const { decision } = routeContextStory(story)
      expect(decision.route, story.branch).toBe('STOP')
      expect(decision.reasons.join('\n'), story.branch).toMatch(/LOCAL_STATE_NOT_DURABLE/)
    }
  })

  // Oracle: Issue #573 requires one exact recovery for a uniquely safe wrong-Issue
  // workspace, while merged docs/agent-loop/context-story-matrix.md records Issue
  // #525's invariant that an explicitly numbered wrong-Issue branch remains STOP.
  // Merged docs/mission-control/execution-handoff-contract.md §12 permits only a
  // switch to the correctly owned existing Issue branch when live repository
  // evidence identifies exactly one candidate; ambiguous or conflicting evidence
  // remains STOP. The recovery below is uniquely determined by the sole live
  // target branch plus its matching local origin tracking ref. Issue #573 also
  // requires the recovery to retain the exact protected-base binding. The
  // canonical branch bootstrap readback requires upstream `origin/<branch>`;
  // a durable alias is not the repository's canonical workspace identity.
  describe('unique wrong-Issue workspace recovery', () => {
    it('keeps STOP and prescribes the exact switch for the #508 wrong-Issue reproduction', () => {
      const targetBranch = 'feat/508-model-routing-profile-v1'
      const sourceBranch = 'fix/512-preflight-handoff'
      const { evidence, decision } = routeContextStory({
        issueNumber: '508',
        branch: sourceBranch,
        remoteBranches: [{ branch: targetBranch }],
        remoteTrackingBranches: [{ branch: targetBranch }],
      })
      const output = createContextOutput(evidence, decision, '508')

      expect(decision.route).toBe('STOP')
      expect(decision.nextAction.type).toBe('STOP')
      expect(decision.nextAction.command).toBeNull()
      expect(output).toMatchObject({
        route: 'STOP',
        recovery: {
          type: 'SWITCH_BRANCH',
          command: 'git',
          args: ['switch', '--track', `origin/${targetBranch}`],
          display_command: `git switch --track 'origin/${targetBranch}'`,
          binding: {
            repository: contextRepo,
            issue_number: '508',
            protected_base: {
              branch: evidence.protectedBase.branch,
              sha: evidence.protectedBase.sha,
            },
            source: {
              branch: sourceBranch,
              head: evidence.localGit.head,
              upstream: `origin/${sourceBranch}`,
              clean: true,
              detached: false,
              pushed: true,
              durable: true,
            },
            target: { branch: targetBranch, head: evidence.localGit.head },
          },
        },
      })
      expect(output.next_action.type).toBe('STOP')
      expect(output.next_action.reason).toContain(`git switch --track 'origin/${targetBranch}'`)
      expect(output.next_action.reason).toMatch(/immediately rerun.*CLI Discovery.*Context/i)
      expect(output.next_action.reason).toMatch(/No Founder.*return/i)
    })

    it('uses the exact local Issue branch when its head and origin upstream match live evidence', () => {
      const targetBranch = 'feat/508-local-target'
      const { evidence, decision } = routeContextStory({
        issueNumber: '508',
        branch: 'fix/512-preflight-handoff',
        remoteBranches: [{ branch: targetBranch }],
        remoteTrackingBranches: [{ branch: targetBranch }],
        localBranches: [{ branch: targetBranch }],
      })
      const output = createContextOutput(evidence, decision, '508')

      expect(decision.route).toBe('STOP')
      expect('recovery' in output ? output.recovery : undefined).toMatchObject({
        type: 'SWITCH_BRANCH',
        args: ['switch', '--', targetBranch],
        display_command: `git switch -- '${targetBranch}'`,
        binding: { target: { branch: targetBranch, head: evidence.localGit.head } },
      })
      expect(output.next_action.type).toBe('STOP')
    })

    // Oracle: Issue #573 says wrong-Issue workspace acquisition precedes
    // objective work even in a resumed session. The active-PR contract still
    // requires the local target to match the exact PR branch/head; a unique
    // durable PR head is canonical GitHub evidence for the queried Issue's
    // existing workspace. Issue #410 keeps exact PR head identity authoritative.
    it('recovers to the exact active PR branch before any PR-gated objective action', () => {
      const targetBranch = 'fix/508-active-pr-target'
      const { evidence, decision } = routeContextStory({
        issueNumber: '508',
        branch: 'fix/512-preflight-handoff',
        activePr: true,
        prHeadBranch: targetBranch,
        remoteBranches: [{ branch: targetBranch }],
        remoteTrackingBranches: [{ branch: targetBranch }],
      })
      const output = createContextOutput(evidence, decision, '508')
      const activePr = Array.isArray(evidence.activePr) ? null : evidence.activePr

      expect(decision.route).toBe('STOP')
      expect(decision.nextAction.type).toBe('STOP')
      expect('recovery' in output ? output.recovery : undefined).toMatchObject({
        type: 'SWITCH_BRANCH',
        args: ['switch', '--track', `origin/${targetBranch}`],
        binding: {
          issue_number: '508',
          target: { branch: targetBranch, head: activePr?.headSha },
          active_pr: {
            number: '526',
            url: `https://github.com/${contextRepo}/pull/526`,
            base_branch: 'main',
            base_sha: 'a'.repeat(40),
            head_branch: targetBranch,
            head: activePr?.headSha,
          },
        },
      })
      expect(output.next_action.reason).toContain(`git switch --track 'origin/${targetBranch}'`)
    })

    it('stays STOP when an active PR target is not uniquely present at its live head', () => {
      const { evidence, decision } = routeContextStory({
        issueNumber: '508',
        branch: 'fix/512-preflight-handoff',
        activePr: true,
        prHeadBranch: 'fix/508-unavailable-pr-target',
      })
      const output = createContextOutput(evidence, decision, '508')

      expect(decision.route).toBe('STOP')
      expect(decision.nextAction.type).toBe('STOP')
      expect(output).not.toHaveProperty('recovery')
    })

    it('stays STOP when the active PR branch has stale local origin tracking evidence', () => {
      const targetBranch = 'fix/508-stale-pr-target'
      const { evidence, decision } = routeContextStory({
        issueNumber: '508',
        branch: 'fix/512-preflight-handoff',
        activePr: true,
        prHeadBranch: targetBranch,
        remoteBranches: [{ branch: targetBranch }],
        remoteTrackingBranches: [{ branch: targetBranch, sha: 'stale' }],
      })
      const output = createContextOutput(evidence, decision, '508')

      expect(decision.route).toBe('STOP')
      expect(output).not.toHaveProperty('recovery')
    })

    it.each([
      ['multiple live target branches', {
        remoteBranches: [
          { branch: 'fix/573-first-candidate' },
          { branch: 'feature/573-second-candidate' },
        ],
        remoteTrackingBranches: [
          { branch: 'fix/573-first-candidate' },
          { branch: 'feature/573-second-candidate' },
        ],
      }],
      ['stale local tracking head', {
        remoteBranches: [{ branch: 'fix/573-stale-candidate' }],
        remoteTrackingBranches: [{ branch: 'fix/573-stale-candidate', sha: 'stale' }],
      }],
      ['stale local target branch head', {
        remoteBranches: [{ branch: 'fix/573-stale-local-candidate' }],
        remoteTrackingBranches: [{ branch: 'fix/573-stale-local-candidate' }],
        localBranches: [{ branch: 'fix/573-stale-local-candidate', sha: 'stale' }],
      }],
      ['local target branch with wrong upstream', {
        remoteBranches: [{ branch: 'fix/573-wrong-upstream-candidate' }],
        remoteTrackingBranches: [{ branch: 'fix/573-wrong-upstream-candidate' }],
        localBranches: [{ branch: 'fix/573-wrong-upstream-candidate', upstream: 'origin/main' }],
      }],
      ['dirty source worktree', {
        remoteBranches: [{ branch: 'fix/573-dirty-source-candidate' }],
        remoteTrackingBranches: [{ branch: 'fix/573-dirty-source-candidate' }],
        dirty: true,
      }],
      ['non-durable source branch', {
        remoteBranches: [{ branch: 'fix/573-nondurable-source-candidate' }],
        remoteTrackingBranches: [{ branch: 'fix/573-nondurable-source-candidate' }],
        durable: false,
      }],
      ['target branch checked out in another worktree', {
        remoteBranches: [{ branch: 'fix/573-occupied-candidate' }],
        remoteTrackingBranches: [{ branch: 'fix/573-occupied-candidate' }],
        worktreeBranches: ['fix/573-occupied-candidate'],
      }],
    ])('does not prescribe recovery for %s', (_story, overrides) => {
      const { evidence, decision } = routeContextStory({
        issueNumber: '573',
        branch: 'fix/512-preflight-handoff',
        ...overrides,
      })
      const output = createContextOutput(evidence, decision, '573')

      expect(decision.route).toBe('STOP')
      expect(output).not.toHaveProperty('recovery')
    })

    it('does not recover from a clean durable source branch tracking another remote', () => {
      const { evidence, decision } = routeContextStory({
        issueNumber: '573',
        branch: 'fix/512-preflight-handoff',
        sourceUpstreamRemote: 'fork',
        remoteBranches: [{ branch: 'fix/573-noncanonical-upstream-candidate' }],
        remoteTrackingBranches: [{ branch: 'fix/573-noncanonical-upstream-candidate' }],
      })
      const output = createContextOutput(evidence, decision, '573')

      expect(evidence.localGit).toMatchObject({
        clean: true,
        pushed: true,
        durable: true,
        upstream: 'fork/fix/512-preflight-handoff',
      })
      expect(decision.route).toBe('STOP')
      expect(output).not.toHaveProperty('recovery')
    })

    it('does not manufacture a transfer step for a same-Issue branch', () => {
      const { evidence, decision } = routeContextStory({ issueNumber: '573', branch: 'fix/573-same-issue' })
      const output = createContextOutput(evidence, decision, '573')

      expect(decision.route).toBe('IMPLEMENT')
      expect(output).not.toHaveProperty('recovery')
      expect(output.next_action.reason).not.toMatch(/switch.*branch/i)
      expect(output.next_action.reason).toContain('Implement the bounded Issue objective')
    })
  })

  it('keeps PR-owned branch and merged terminal routing ahead of no-PR branch ownership', () => {
    const active = routeContextStory({
      issueNumber: '525',
      branch: 'test/477-pr-owned-by-525',
      activePr: true,
    })
    expect(active.evidence.activePr).toMatchObject({ number: '526', headBranch: 'test/477-pr-owned-by-525' })
    expect(active.evidence.evidenceErrors).toEqual([])
    expect(active.decision.route).toBe('FOUNDER_GATE')
    expect(active.decision.reasons.join('\n')).not.toMatch(/branch.*Issue/i)

    const merged = routeContextStory({
      issueNumber: '525',
      branch: 'test/477-terminal-pr-owned-by-525',
      activePr: true,
      merged: true,
      detached: true,
    })
    expect(merged.evidence.evidenceErrors, JSON.stringify(merged.evidence)).toEqual([])
    expect(merged.decision.route, JSON.stringify({ activePr: merged.evidence.activePr, reasons: merged.decision.reasons })).toBe('COMPLETE')
    expect(merged.decision.reasons.join('\n')).not.toMatch(/branch.*Issue/i)
  })

  it('assembles normalized context evidence from read-only adapters', () => {
    const run: ContextCommandRunner = (_command, args) => {
      const key = args.join(' ')
      const local: Record<string, string> = {
        'branch --show-current': 'feature/410-context\n',
        'rev-parse HEAD': `${'b'.repeat(40)}\n`,
        'status --short': '',
        'rev-parse --abbrev-ref --symbolic-full-name @{upstream}': 'origin/feature/410-context\n',
        'remote get-url origin': 'git@github.com:boat1994/bemoat-web-starter.git\n',
        'rev-parse refs/remotes/origin/feature/410-context': `${'b'.repeat(40)}\n`,
        'ls-remote --heads origin feature/410-context': `${'b'.repeat(40)}\trefs/heads/feature/410-context\n`,
      }
      if (_command === 'git') return response(local[key] ?? '')
      if (key.includes('git/ref/heads/dev')) return { status: 1, stdout: '', stderr: 'Not Found', error: null }
      if (key.includes('git/ref/heads/main')) return response(JSON.stringify({ object: { sha: 'a'.repeat(40) } }))
      if (key.includes('contents/docs/mission-control/mission-control-guide.md')) {
        return response(JSON.stringify({
          sha: 'c'.repeat(40),
          content: Buffer.from('---\npolicy_id: bemoat-mission-control\nversion: 1.3.0\n---\n').toString('base64'),
          encoding: 'base64',
        }))
      }
      if (key.startsWith('issue view 410')) {
        return response(JSON.stringify({ number: 410, title: 'context', state: 'OPEN', url: 'https://github.com/boat1994/bemoat-web-starter/issues/410', body: '## Goal\n\nImplement context.\n', comments: [] }))
      }
      if (key.startsWith('pr list')) return response('[]')
      if (key.includes('branches/main/protection')) return response(JSON.stringify({}))
      return response('')
    }

    expect(collectContextEvidence({ cwd: '/repo', issueNumber: '410', run })).toMatchObject({
      repository: { nameWithOwner: 'boat1994/bemoat-web-starter' },
      protectedBase: { branch: 'main', sha: 'a'.repeat(40) },
      policy: { sourceSha: 'c'.repeat(40), version: '1.3.0' },
      issue: { number: '410', objective: 'Implement context.' },
      activePr: null,
      evidenceErrors: [],
    })
  })

  it('normalizes local branch, HEAD, upstream, origin, cleanliness, and push durability', () => {
    const run: ContextCommandRunner = (_command, args) => {
      const key = args.join(' ')
      const values: Record<string, string> = {
        'branch --show-current': 'feature/410-context\n',
        'rev-parse HEAD': `${'b'.repeat(40)}\n`,
        'status --short': '',
        'rev-parse --abbrev-ref --symbolic-full-name @{upstream}': 'origin/feature/410-context\n',
        'remote get-url origin': 'git@github.com:boat1994/bemoat-web-starter.git\n',
        'rev-parse refs/remotes/origin/feature/410-context': `${'b'.repeat(40)}\n`,
        'ls-remote --heads origin feature/410-context': `${'b'.repeat(40)}\trefs/heads/feature/410-context\n`,
      }
      return response(values[key] ?? '')
    }

    expect(readLocalGitEvidence({ cwd: '/repo', run })).toEqual({
      branch: 'feature/410-context',
      head: 'b'.repeat(40),
      upstream: 'origin/feature/410-context',
      originRepository: 'boat1994/bemoat-web-starter',
      clean: true,
      detached: false,
      pushed: true,
      durable: true,
      reasons: [],
    })
  })

  it('reads protected-base SHA and policy identity from live GitHub content', () => {
    const historicalStop = `513:5913355141:${'a'.repeat(40)}:${'b'.repeat(64)}`
    const policy = `---\npolicy_id: bemoat-mission-control\nversion: 1.3.0\ncanonical_repository: boat1994/bemoat-web-starter\ntrusted_founder_login: boat1994\nlegacy_stop_handoffs: ${historicalStop}\n---\n\n# Guide\n`
    const run: ContextCommandRunner = (_command, args) => {
      const key = args.join(' ')
      if (key.includes('git/ref/heads/main')) {
        return response(JSON.stringify({ object: { sha: 'a'.repeat(40) } }))
      }
      if (key.includes('contents/docs/mission-control/mission-control-guide.md')) {
        return response(JSON.stringify({
          sha: 'c'.repeat(40),
          content: Buffer.from(policy).toString('base64'),
          encoding: 'base64',
        }))
      }
      return response('')
    }

    expect(readProtectedPolicy({
      repo: 'boat1994/bemoat-web-starter',
      baseBranch: 'main',
      run,
    })).toEqual({
      branch: 'main',
      sha: 'a'.repeat(40),
      policy: {
        path: 'docs/mission-control/mission-control-guide.md',
        policyId: 'bemoat-mission-control',
        version: '1.3.0',
        trustedFounderLogin: 'boat1994',
        legacyStopHandoffs: [historicalStop],
        allowHistoricalNoPrFounderGateReplay: false,
        sourceSha: 'c'.repeat(40),
        url: 'https://github.com/boat1994/bemoat-web-starter/blob/' + 'a'.repeat(40) + '/docs/mission-control/mission-control-guide.md',
      },
      errors: [],
    })
  })

  it('rejects ambiguous trusted Founder identity in protected policy', () => {
    const run: ContextCommandRunner = (_command, args) => {
      const key = args.join(' ')
      if (key.includes('git/ref/heads/main')) return response(JSON.stringify({ object: { sha: 'a'.repeat(40) } }))
      if (key.includes('contents/docs/mission-control/mission-control-guide.md')) return response(JSON.stringify({
        sha: 'c'.repeat(40),
        content: Buffer.from('---\npolicy_id: bemoat-mission-control\nversion: 1.4.0\ntrusted_founder_login: boat1994\ntrusted_founder_login: another-owner\n---\n').toString('base64'),
        encoding: 'base64',
      }))
      return response('')
    }
    expect(readProtectedPolicy({ repo: 'boat1994/bemoat-web-starter', baseBranch: 'main', run }).policy?.trustedFounderLogin).toBeNull()
  })

  it('does not copy the starter Founder identity into a child repository', () => {
    const run: ContextCommandRunner = (_command, args) => {
      const key = args.join(' ')
      if (key.includes('git/ref/heads/main')) return response(JSON.stringify({ object: { sha: 'a'.repeat(40) } }))
      if (key.includes('contents/docs/mission-control/mission-control-guide.md')) return response(JSON.stringify({
        sha: 'c'.repeat(40),
        content: Buffer.from('---\npolicy_id: bemoat-mission-control\nversion: 1.3.0\ncanonical_repository: boat1994/bemoat-web-starter\ntrusted_founder_login: boat1994\n---\n').toString('base64'),
        encoding: 'base64',
      }))
      return response('')
    }
    expect(readProtectedPolicy({ repo: 'boat1994/child-project', baseBranch: 'main', run }).policy?.trustedFounderLogin).toBeNull()
  })

  it('resolves the current starter Founder identity only for the canonical live repository', () => {
    const content = readFileSync(join(process.cwd(), 'docs/mission-control/mission-control-guide.md'), 'utf8')
    const args = { branch: 'main', sha: 'a'.repeat(40), content }

    expect(parseProtectedPolicyContent({ repo: 'bemoat/bemoat-web-starter', ...args })).toMatchObject({
      policyId: 'bemoat-mission-control',
      version: '1.7.0',
      trustedFounderLogin: 'bemoat',
    })
    expect(parseProtectedPolicyContent({ repo: 'bemoat/child-project', ...args })?.trustedFounderLogin).toBeNull()
  })

  it('binds the Issue, one active PR, and exact-head verification', () => {
    const head = 'b'.repeat(40)
    const run: ContextCommandRunner = (_command, args) => {
      const key = args.join(' ')
      const reviewApiResponse = nativeReviewApiResponse(args, {
        '411': [{
          id: 5020446813,
          html_url: 'https://github.com/boat1994/bemoat-web-starter/pull/411#pullrequestreview-5020446813',
          state: 'COMMENTED',
          commit_id: head,
          body: `## REVIEW_VERDICT\n**Repository:** \`boat1994/bemoat-web-starter\`\n**Task / Issue:** #410\n**PR / base / head:** PR #411 · \`main\` · \`${head}\`\n**Verdict:** ELIGIBLE FOR FOUNDER REVIEW`,
          user: { login: 'reviewer' },
        }],
      })
      if (reviewApiResponse) return reviewApiResponse
      if (key.startsWith('issue view 410')) {
        return response(JSON.stringify({
          number: 410,
          title: 'context protocol',
          state: 'OPEN',
          url: 'https://github.com/boat1994/bemoat-web-starter/issues/410',
          body: '# body',
          comments: [],
        }))
      }
      if (key.startsWith('pr list')) {
        return response(JSON.stringify([{
          number: 411,
          url: 'https://github.com/boat1994/bemoat-web-starter/pull/411',
          headRefName: 'feature/410-context',
          closingIssuesReferences: [{ number: 410 }],
        }]))
      }
      if (key.startsWith('pr view 411')) {
        return response(JSON.stringify({
          number: 411,
          state: 'OPEN',
          isDraft: false,
          url: 'https://github.com/boat1994/bemoat-web-starter/pull/411',
          baseRefName: 'main',
          baseRefOid: 'a'.repeat(40),
          headRefName: 'feature/410-context',
          headRefOid: head,
          mergeCommit: null,
          reviews: [{
            id: 5020446813,
            state: 'COMMENTED',
            commitId: head,
            body: `## REVIEW_VERDICT\n**Repository:** \`boat1994/bemoat-web-starter\`\n**Task / Issue:** #410\n**PR / base / head:** PR #411 · \`main\` · \`${head}\`\n**Verdict:** ELIGIBLE FOR FOUNDER REVIEW`,
          }],
          statusCheckRollup: [{ name: 'CI', state: 'SUCCESS', conclusion: 'SUCCESS' }],
        }))
      }
      if (key.includes('branches/main/protection')) {
        return response(JSON.stringify({
          required_status_checks: { contexts: ['CI'] },
          required_pull_request_reviews: { required_approving_review_count: 1 },
        }))
      }
      return response('')
    }

    expect(readGithubEvidence({
      cwd: '/repo',
      repo: 'boat1994/bemoat-web-starter',
      issueNumber: '410',
      branch: 'feature/410-context',
      protectedBaseBranch: 'main',
      run,
    })).toMatchObject({
      issue: { number: '410', state: 'OPEN' },
      activePrs: [{ number: '411', headSha: head }],
      exactHead: {
        exactHead: head,
        checks: { complete: true, failed: false },
        reviews: {
          approved: false,
          exactHead: false,
          nativeReviews: [{
            id: 5020446813,
            url: 'https://github.com/boat1994/bemoat-web-starter/pull/411#pullrequestreview-5020446813',
            state: 'COMMENTED',
            commitId: head,
            body: expect.stringContaining('ELIGIBLE FOR FOUNDER REVIEW'),
          }],
        },
      },
      errors: [],
    })
  })

  it('retains merged PR commit evidence without comparing historical base to current protected main', () => {
    const head = 'b'.repeat(40)
    const mergeCommit = 'd'.repeat(40)
    const run: ContextCommandRunner = (_command, args) => {
      const key = args.join(' ')
      const reviewApiResponse = nativeReviewApiResponse(args)
      if (reviewApiResponse) return reviewApiResponse
      if (key.startsWith('issue view 421')) {
        return response(JSON.stringify({
          number: 421,
          title: 'semantic review routing',
          state: 'CLOSED',
          url: 'https://github.com/boat1994/bemoat-web-starter/issues/421',
          body: '# body',
          comments: [],
        }))
      }
      if (key.startsWith('pr list')) {
        return response(JSON.stringify([{
          number: 422,
          url: 'https://github.com/boat1994/bemoat-web-starter/pull/422',
          headRefName: 'fix/421-standard-semantic-review',
          closingIssuesReferences: [{ number: 421 }],
        }]))
      }
      if (key.startsWith('pr view 422')) {
        return response(JSON.stringify({
          number: 422,
          state: 'MERGED',
          isDraft: false,
          url: 'https://github.com/boat1994/bemoat-web-starter/pull/422',
          baseRefName: 'main',
          baseRefOid: 'a'.repeat(40),
          headRefName: 'fix/421-standard-semantic-review',
          headRefOid: head,
          mergeCommit: { oid: mergeCommit },
          reviews: [],
          statusCheckRollup: [],
        }))
      }
      if (key.includes('branches/main/protection')) return response(JSON.stringify({}))
      return response('')
    }

    expect(readGithubEvidence({
      cwd: '/repo',
      repo: 'boat1994/bemoat-web-starter',
      issueNumber: '421',
      branch: 'fix/421-standard-semantic-review',
      protectedBaseBranch: 'main',
      protectedBaseSha: 'c'.repeat(40),
      run,
    })).toMatchObject({
      activePrs: [{
        number: '422',
        baseSha: 'a'.repeat(40),
        mergeCommitSha: mergeCommit,
        merged: true,
      }],
      errors: [],
    })
  })

  it('fails closed when an OPEN PR carries a valid merge commit', () => {
    const head = 'b'.repeat(40)
    const mergeCommit = 'd'.repeat(40)
    const run: ContextCommandRunner = (_command, args) => {
      const key = args.join(' ')
      if (key.startsWith('issue view 421')) {
        return response(JSON.stringify({
          number: 421,
          title: 'semantic review routing',
          state: 'OPEN',
          url: 'https://github.com/boat1994/bemoat-web-starter/issues/421',
          body: '# body',
          comments: [],
        }))
      }
      if (key.startsWith('pr list')) {
        return response(JSON.stringify([{
          number: 422,
          url: 'https://github.com/boat1994/bemoat-web-starter/pull/422',
          headRefName: 'fix/421-standard-semantic-review',
          closingIssuesReferences: [{ number: 421 }],
        }]))
      }
      if (key.startsWith('pr view 422')) {
        return response(JSON.stringify({
          number: 422,
          state: 'OPEN',
          isDraft: false,
          url: 'https://github.com/boat1994/bemoat-web-starter/pull/422',
          baseRefName: 'main',
          baseRefOid: 'a'.repeat(40),
          headRefName: 'fix/421-standard-semantic-review',
          headRefOid: head,
          mergeCommit: { oid: mergeCommit },
          reviews: [],
          statusCheckRollup: [],
        }))
      }
      if (key.includes('branches/main/protection')) return response(JSON.stringify({}))
      return response('')
    }

    const evidence = readGithubEvidence({
      cwd: '/repo',
      repo: 'boat1994/bemoat-web-starter',
      issueNumber: '421',
      branch: 'fix/421-standard-semantic-review',
      protectedBaseBranch: 'main',
      run,
    })

    expect(evidence.activePrs).toEqual([])
    expect(evidence.errors).toContain('EVIDENCE_CONFLICT: PR #422 state and merge commit evidence disagree')
  })

  it('excludes closed-unmerged PRs from candidates', () => {
    const head = 'b'.repeat(40)
    const run: ContextCommandRunner = (_command, args) => {
      const key = args.join(' ')
      if (key.startsWith('issue view 410')) {
        return response(JSON.stringify({
          number: 410, title: 'context protocol', state: 'OPEN', url: 'https://github.com/boat1994/bemoat-web-starter/issues/410', body: '# body', comments: [],
        }))
      }
      if (key.startsWith('pr list')) {
        return response(JSON.stringify([
          { number: 411, url: 'https://github.com/boat1994/bemoat-web-starter/pull/411', headRefName: 'feature/410-context-merged', closingIssuesReferences: [{ number: 410 }] }, // Historical merged
          { number: 412, url: 'https://github.com/boat1994/bemoat-web-starter/pull/412', headRefName: 'feature/410-context-closed', closingIssuesReferences: [{ number: 410 }] }, // Closed unmerged
          { number: 413, url: 'https://github.com/boat1994/bemoat-web-starter/pull/413', headRefName: 'feature/410-context', closingIssuesReferences: [{ number: 410 }] }, // Active open
        ]))
      }
      if (key.startsWith('pr view 411')) {
        return response(JSON.stringify({
          number: 411, state: 'MERGED', isDraft: false, url: 'https://github.com/boat1994/bemoat-web-starter/pull/411',
          baseRefName: 'main', baseRefOid: 'a'.repeat(40), headRefName: 'feature/410-context-merged', headRefOid: 'oldsha',
          mergeCommit: { oid: 'd'.repeat(40) }, reviews: [], statusCheckRollup: []
        }))
      }
      if (key.startsWith('pr view 412')) {
        return response(JSON.stringify({
          number: 412, state: 'CLOSED', isDraft: false, url: 'https://github.com/boat1994/bemoat-web-starter/pull/412',
          baseRefName: 'main', baseRefOid: 'a'.repeat(40), headRefName: 'feature/410-context-closed', headRefOid: 'closedsha',
          mergeCommit: null, reviews: [], statusCheckRollup: []
        }))
      }
      if (key.startsWith('pr view 413')) {
        return response(JSON.stringify({
          number: 413, state: 'OPEN', isDraft: false, url: 'https://github.com/boat1994/bemoat-web-starter/pull/413',
          baseRefName: 'main', baseRefOid: 'a'.repeat(40), headRefName: 'feature/410-context', headRefOid: head,
          mergeCommit: null, reviews: [], statusCheckRollup: []
        }))
      }
      if (key.includes('branches/main/protection')) {
        return response(JSON.stringify({}))
      }
      return response('')
    }

    const evidence = readGithubEvidence({
      cwd: '/repo', repo: 'boat1994/bemoat-web-starter', issueNumber: '410', branch: 'feature/410-context', protectedBaseBranch: 'main', run,
    })
    
    // It should exclude the closed PR 412, but include merged PR 411 and open PR 413 in activePrs list from API
    // Since 411 is merged, unmergedPrs will just be 413.
    // The activePrs property from evidence should only contain unmerged if there's any, which is [413].
    expect(evidence.activePrs.length).toBe(1)
    expect(evidence.activePrs[0].number).toBe('413')
  })

  it('does not expose multiple historical merged PRs as active candidates for an OPEN Issue', () => {
    const run: ContextCommandRunner = (_command, args) => {
      const key = args.join(' ')
      if (key.startsWith('issue view 434')) {
        return response(JSON.stringify({ number: 434, title: 'ignore historical merged PRs', state: 'OPEN', url: 'https://github.com/boat1994/bemoat-web-starter/issues/434', body: '# body', comments: [{ id: 1001, body: '## HANDOFF PR #431', createdAt: '2026-09-01T00:00:00Z', url: 'https://github.com/boat1994/bemoat-web-starter/issues/434#issuecomment-1001', author: { login: 'boat1994' }, authorAssociation: 'OWNER' }, { id: 1002, body: '## REVIEW_VERDICT PR #432', createdAt: '2026-09-01T01:00:00Z', url: 'https://github.com/boat1994/bemoat-web-starter/issues/434#issuecomment-1002' }] }))
      }
      if (key.startsWith('pr list')) return response(JSON.stringify([1, 2].map((number) => ({ number: 430 + number, url: `https://github.com/boat1994/bemoat-web-starter/pull/${430 + number}`, headRefName: `fix/434-history-${number}`, closingIssuesReferences: [{ number: 434 }] }))))
      const match = key.match(/^pr view (43[1-2])/)
      if (match) {
        const number = match[1]
        return response(JSON.stringify({ number: Number(number), state: 'MERGED', isDraft: false, url: `https://github.com/boat1994/bemoat-web-starter/pull/${number}`, baseRefName: 'main', baseRefOid: 'a'.repeat(40), headRefName: `fix/434-history-${Number(number) - 430}`, headRefOid: 'b'.repeat(40), mergeCommit: { oid: 'd'.repeat(40) }, reviews: [], statusCheckRollup: [] }))
      }
      if (key.includes('branches/main/protection')) return response(JSON.stringify({}))
      return response('')
    }

    const evidence = readGithubEvidence({
      cwd: '/repo',
      repo: 'boat1994/bemoat-web-starter',
      issueNumber: '434',
      branch: 'fix/434-ignore-historical-merged-prs',
      protectedBaseBranch: 'main',
      protectedBaseSha: 'c'.repeat(40),
      run,
    })
    expect(evidence.activePrs).toEqual([])
    expect(evidence.comments).toMatchObject([
      { id: '1001', body: expect.stringContaining('HANDOFF'), authorLogin: 'boat1994', authorAssociation: 'OWNER' },
      { id: '1002', body: expect.stringContaining('REVIEW_VERDICT') },
    ])
    expect(evidence.errors).toEqual([])
  })

  it('does not expose one historical merged PR as active for an OPEN Issue', () => {
    const run: ContextCommandRunner = (_command, args) => {
      const key = args.join(' ')
      if (key.startsWith('issue view 434')) return response(JSON.stringify({ number: 434, title: 'ignore historical merged PRs', state: 'OPEN', url: 'https://github.com/boat1994/bemoat-web-starter/issues/434', body: '# body', comments: [] }))
      if (key.startsWith('pr list')) return response(JSON.stringify([{ number: 431, url: 'https://github.com/boat1994/bemoat-web-starter/pull/431', headRefName: 'fix/434-history', closingIssuesReferences: [{ number: 434 }] }]))
      if (key.startsWith('pr view 431')) return response(JSON.stringify({ number: 431, state: 'MERGED', isDraft: false, url: 'https://github.com/boat1994/bemoat-web-starter/pull/431', baseRefName: 'main', baseRefOid: 'a'.repeat(40), headRefName: 'fix/434-history', headRefOid: 'b'.repeat(40), mergeCommit: { oid: 'd'.repeat(40) }, reviews: [], statusCheckRollup: [] }))
      if (key.includes('branches/main/protection')) return response(JSON.stringify({}))
      return response('')
    }

    expect(readGithubEvidence({ cwd: '/repo', repo: 'boat1994/bemoat-web-starter', issueNumber: '434', branch: 'fix/434-ignore-historical-merged-prs', protectedBaseBranch: 'main', run }).activePrs).toEqual([])
  })

  it('selects the sole unmerged PR when historical merged PRs are also present', () => {
    const head = 'b'.repeat(40)
    const run: ContextCommandRunner = (_command, args) => {
      const key = args.join(' ')
      const reviewApiResponse = nativeReviewApiResponse(args)
      if (reviewApiResponse) return reviewApiResponse
      if (key.startsWith('issue view 434')) return response(JSON.stringify({ number: 434, title: 'ignore historical merged PRs', state: 'OPEN', url: 'https://github.com/boat1994/bemoat-web-starter/issues/434', body: '# body', comments: [] }))
      if (key.startsWith('pr list')) return response(JSON.stringify([
        { number: 431, url: 'https://github.com/boat1994/bemoat-web-starter/pull/431', headRefName: 'fix/434-history-1', closingIssuesReferences: [{ number: 434 }] },
        { number: 432, url: 'https://github.com/boat1994/bemoat-web-starter/pull/432', headRefName: 'fix/434-history-2', closingIssuesReferences: [{ number: 434 }] },
        { number: 435, url: 'https://github.com/boat1994/bemoat-web-starter/pull/435', headRefName: 'fix/434-current', closingIssuesReferences: [{ number: 434 }] },
      ]))
      if (key.startsWith('pr view 431') || key.startsWith('pr view 432')) {
        const number = key.includes('431') ? 431 : 432
        return response(JSON.stringify({ number, state: 'MERGED', isDraft: false, url: `https://github.com/boat1994/bemoat-web-starter/pull/${number}`, baseRefName: 'main', baseRefOid: 'a'.repeat(40), headRefName: `fix/434-history-${number - 430}`, headRefOid: 'c'.repeat(40), mergeCommit: { oid: 'd'.repeat(40) }, reviews: [], statusCheckRollup: [] }))
      }
      if (key.startsWith('pr view 435')) return response(JSON.stringify({ number: 435, state: 'OPEN', isDraft: false, url: 'https://github.com/boat1994/bemoat-web-starter/pull/435', baseRefName: 'main', baseRefOid: 'a'.repeat(40), headRefName: 'fix/434-current', headRefOid: head, mergeCommit: null, reviews: [], statusCheckRollup: [] }))
      if (key.includes('branches/main/protection')) return response(JSON.stringify({}))
      return response('')
    }

    expect(readGithubEvidence({ cwd: '/repo', repo: 'boat1994/bemoat-web-starter', issueNumber: '434', branch: 'fix/434-ignore-historical-merged-prs', protectedBaseBranch: 'main', run })).toMatchObject({ activePrs: [{ number: '435', headSha: head }], errors: [] })
  })

  it('keeps genuinely competing OPEN PRs as active candidates', () => {
    const run: ContextCommandRunner = (_command, args) => {
      const key = args.join(' ')
      const reviewApiResponse = nativeReviewApiResponse(args)
      if (reviewApiResponse) return reviewApiResponse
      if (key.startsWith('issue view 434')) return response(JSON.stringify({ number: 434, title: 'competing open PRs', state: 'OPEN', url: 'https://github.com/boat1994/bemoat-web-starter/issues/434', body: '# body', comments: [] }))
      if (key.startsWith('pr list')) return response(JSON.stringify([435, 436].map((number) => ({ number, url: 'https://github.com/boat1994/bemoat-web-starter/pull/' + number, headRefName: 'fix/434-open-' + number, closingIssuesReferences: [{ number: 434 }] }))))
      const match = key.match(/^pr view (43[5-6])/)
      if (match) {
        const number = Number(match[1])
        const head = number === 435 ? 'b'.repeat(40) : 'c'.repeat(40)
        return response(JSON.stringify({ number, state: 'OPEN', isDraft: false, url: 'https://github.com/boat1994/bemoat-web-starter/pull/' + number, baseRefName: 'main', baseRefOid: 'a'.repeat(40), headRefName: 'fix/434-open-' + number, headRefOid: head, mergeCommit: null, reviews: [], statusCheckRollup: [] }))
      }
      if (key.includes('branches/main/protection')) return response(JSON.stringify({}))
      return response('')
    }

    const evidence = readGithubEvidence({
      cwd: '/repo',
      repo: 'boat1994/bemoat-web-starter',
      issueNumber: '434',
      branch: 'fix/434-current',
      protectedBaseBranch: 'main',
      run,
    })
    expect(evidence.activePrs.map((pr) => pr.number)).toEqual(['435', '436'])
    expect(evidence.errors).toEqual([])
  })

  it('excludes closed-unmerged history for a CLOSED Issue', () => {
    const run: ContextCommandRunner = (_command, args) => {
      const key = args.join(' ')
      if (key.startsWith('issue view 434')) return response(JSON.stringify({ number: 434, title: 'closed history', state: 'CLOSED', url: 'https://github.com/boat1994/bemoat-web-starter/issues/434', body: '# body', comments: [] }))
      if (key.startsWith('pr list')) return response(JSON.stringify([{ number: 437, url: 'https://github.com/boat1994/bemoat-web-starter/pull/437', headRefName: 'fix/434-closed', closingIssuesReferences: [{ number: 434 }] }]))
      if (key.startsWith('pr view 437')) return response(JSON.stringify({ number: 437, state: 'CLOSED', isDraft: false, url: 'https://github.com/boat1994/bemoat-web-starter/pull/437', baseRefName: 'main', baseRefOid: 'a'.repeat(40), headRefName: 'fix/434-closed', headRefOid: 'e'.repeat(40), mergeCommit: null, reviews: [], statusCheckRollup: [] }))
      if (key.includes('branches/main/protection')) return response(JSON.stringify({}))
      return response('')
    }

    const evidence = readGithubEvidence({
      cwd: '/repo',
      repo: 'boat1994/bemoat-web-starter',
      issueNumber: '434',
      branch: 'fix/434-current',
      protectedBaseBranch: 'main',
      run,
    })
    expect(evidence.activePrs).toEqual([])
    expect(evidence.exactHead).toBeNull()
    expect(evidence.errors).toEqual([])
  })
})

describe('native pull request review identity acquisition', () => {
  const repo = 'boat1994/bemoat-web-starter'
  const issueNumber = '410'
  const prNumber = '411'
  const head = 'b'.repeat(40)
  const databaseId = 5355572368
  const nodeId = 'PRR_kwDOS4T8888AAAABPzeMkA'
  const reviewUrl = `https://github.com/${repo}/pull/${prNumber}#pullrequestreview-${databaseId}`
  const reviewBody = '## REVIEW_VERDICT\n**Verdict:** CORRECTION REQUIRED'

  function readEvidence(restReviewPages: unknown[]) {
    const graphqlReview: Record<string, unknown> = {
      id: nodeId,
      databaseId: null,
      url: null,
      state: 'COMMENTED',
      commit: { oid: head },
      body: reviewBody,
      author: { login: 'boat1994' },
    }
    const run: ContextCommandRunner = (_command, args) => {
      const key = args.join(' ')
      if (_command === 'gh' && key.startsWith('issue view')) {
        return response(JSON.stringify({ number: 410, title: 'context', state: 'OPEN', url: `https://github.com/${repo}/issues/${issueNumber}`, body: '# body', comments: [] }))
      }
      if (_command === 'gh' && key.startsWith('pr list')) {
        return response(JSON.stringify([{ number: 411, url: `https://github.com/${repo}/pull/${prNumber}`, headRefName: 'fix/410-context-review', closingIssuesReferences: [{ number: 410 }] }]))
      }
      if (_command === 'gh' && key.startsWith('pr view 411')) {
        return response(JSON.stringify({
          number: 411,
          state: 'OPEN',
          isDraft: false,
          url: `https://github.com/${repo}/pull/${prNumber}`,
          baseRefName: 'main',
          baseRefOid: 'a'.repeat(40),
          headRefName: 'fix/410-context-review',
          headRefOid: head,
          mergeCommit: null,
          reviews: [graphqlReview],
          statusCheckRollup: [{ name: 'CI', state: 'SUCCESS', conclusion: 'SUCCESS' }],
        }))
      }
      if (_command === 'gh' && args[0] === 'api' && args.some((arg) => arg.includes(`/pulls/${prNumber}/reviews`))) {
        return response(JSON.stringify(restReviewPages))
      }
      if (_command === 'gh' && key.includes('branches/main/protection')) {
        return response(JSON.stringify({ required_status_checks: { contexts: ['CI'] } }))
      }
      return response('')
    }

    return readGithubEvidence({
      cwd: '/repo',
      repo,
      issueNumber,
      branch: 'fix/410-context-review',
      protectedBaseBranch: 'main',
      run,
    })
  }

  it('normalizes the GraphQL review through the native database ID and canonical REST URL', () => {
    const restReview = {
      id: databaseId,
      node_id: nodeId,
      html_url: reviewUrl,
      state: 'COMMENTED',
      commit_id: head,
      body: reviewBody,
      user: { login: 'boat1994' },
    }
    const evidence = readEvidence([[restReview]])

    expect(evidence.exactHead?.reviews.nativeReviews).toEqual([{
      id: databaseId,
      url: reviewUrl,
      state: 'COMMENTED',
      body: reviewBody,
      commitId: head,
    }])
    expect(evidence.errors).toEqual([])
  })

  it('does not treat an opaque GraphQL node ID as a canonical native review identity', () => {
    const evidence = readEvidence([[]])

    expect(evidence.exactHead?.reviews.nativeReviews).toEqual([])
    expect(evidence.exactHead?.reviews.nativeReviews).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: nodeId }),
    ]))
  })

  it('fails closed when a native review lacks a numeric database identity', () => {
    const evidence = readEvidence([[
      {
        id: null,
        node_id: nodeId,
        html_url: reviewUrl,
        state: 'COMMENTED',
        commit_id: head,
        body: reviewBody,
        user: { login: 'boat1994' },
      },
    ]])

    expect(evidence.errors.join(' ')).toMatch(/EVIDENCE_CONFLICT|BLOCKED_EXTERNAL/)
  })
})
