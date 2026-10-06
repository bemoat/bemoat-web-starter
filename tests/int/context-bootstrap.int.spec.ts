import { describe, expect, it } from 'vitest'

import { getCommandContract } from '../../scripts/cli/command-contract.ts'
import { parseContextInvocation, renderContextHelp } from '../../scripts/context/cli.ts'
import { resolveContextBootstrapRoots, verifyContextBootstrap } from '../../scripts/context/bootstrap-worktree.ts'
import type { ContextCommandResult } from '../../scripts/context/runtime.ts'
import type { ActivePullRequestEvidence, NormalizedContextEvidence } from '../../scripts/context/model.ts'
import { parseRoleEvidence } from '../../scripts/context/issue-parser.ts'
import { routeContext } from '../../scripts/context/router.ts'
import { renderHandoffComment, type HandoffRecord } from '../../scripts/handoff/schema.ts'

const repo = 'boat1994/bemoat-web-starter'
const protectedHead = '378b2aa90ecad6d76f4ddae5958077fdad58d045'
const targetHead = 'd58f07c2a340049c10f304d855d39fc10ef97dd8'

function response(stdout = '', status = 0): ContextCommandResult {
  return { status, stdout, stderr: status === 0 ? '' : 'failed', error: null }
}

function bootstrapEvidence(): NormalizedContextEvidence {
  return {
    repository: { owner: 'boat1994', name: 'bemoat-web-starter', nameWithOwner: repo, url: `https://github.com/${repo}` },
    protectedBase: { branch: 'main', sha: protectedHead, source: 'live GitHub ref', url: `https://github.com/${repo}/tree/main` },
    policy: { path: 'docs/mission-control/mission-control-guide.md', policyId: 'bemoat-mission-control', version: '1.4.0', sourceSha: 'ad392ec782b63042261d51cd98939318b22c053d', url: `https://github.com/${repo}/blob/main/docs/mission-control/mission-control-guide.md` },
    issue: { number: '568', title: 'stale no-PR Context bootstrap', state: 'OPEN', url: `https://github.com/${repo}/issues/568`, objective: null, scope: null, acceptanceCriteria: [], dependencies: [], taskSize: 'core', missionControlMode: 'required', workflowProfile: 'STANDARD' },
    localGit: { branch: 'fix/568-stale-base-sync-conflict-continuation', head: targetHead, upstream: 'origin/fix/568-stale-base-sync-conflict-continuation', originRepository: repo, clean: true, detached: false, pushed: true, durable: true, reasons: [] },
    activePr: null,
    currentHeadVerification: null,
    durableContext: { latestHandoff: null, handoffs: [], historicalResults: [], blockerResolutions: [], invalidBlockerResolutions: [] },
    evidenceErrors: [],
  }
}

function bootstrapRunner(overrides: Record<string, string> = {}) {
  const values: Record<string, string> = {
    '/protected': protectedHead,
    '/target': targetHead,
    branchSource: 'main',
    branchTarget: 'fix/568-stale-base-sync-conflict-continuation',
    sourceStatus: '',
    targetStatus: '',
    sourceOrigin: 'https://github.com/boat1994/bemoat-web-starter.git',
    targetOrigin: 'https://github.com/boat1994/bemoat-web-starter.git',
    upstreamOrigin: 'https://github.com/boat1994/bemoat-web-starter.git',
    upstream: 'origin/fix/568-stale-base-sync-conflict-continuation',
    remote: `${targetHead}\trefs/heads/fix/568-stale-base-sync-conflict-continuation\n`,
    worktrees: 'worktree /protected\nHEAD 378b2aa90ecad6d76f4ddae5958077fdad58d045\nbranch refs/heads/main\n\nworktree /target\nHEAD d58f07c2a340049c10f304d855d39fc10ef97dd8\nbranch refs/heads/fix/568-stale-base-sync-conflict-continuation\n',
    ...overrides,
  }
  const calls: string[] = []
  const run = (command: string, args: readonly string[], options?: { cwd?: string; env?: NodeJS.ProcessEnv }): ContextCommandResult => {
    const cwd = options?.cwd ?? '/protected'
    calls.push(`${command} ${args.join(' ')} @ ${cwd}`)
    if (args[0] === 'rev-parse' && args[1] === '--show-toplevel') return response(cwd)
    if (args[0] === 'rev-parse' && args[1] === 'HEAD') return response(cwd === '/protected' ? values['/protected'] : values['/target'])
    if (args[0] === 'branch') return response(cwd === '/protected' ? values.branchSource : values.branchTarget)
    if (args[0] === 'status') return response(cwd === '/protected' ? values.sourceStatus : values.targetStatus)
    if (args[0] === 'remote' && args[1] === 'get-url') {
      if (cwd === '/protected') return response(values.sourceOrigin)
      return response(args[2] === 'origin' ? values.targetOrigin : values.upstreamOrigin)
    }
    if (args[0] === 'rev-parse' && args.includes('@{upstream}')) return response(values.upstream)
    if (args[0] === 'ls-remote') return response(values.remote)
    if (args[0] === 'worktree' && args[1] === 'list') return response(values.worktrees)
    return response('', 1)
  }
  return { run, calls }
}

function detachedSourceWorktrees(targetBranch = 'refs/heads/fix/568-stale-base-sync-conflict-continuation') {
  const targetEntry = targetBranch === 'detached'
    ? `worktree /target\nHEAD ${targetHead}\ndetached\n`
    : `worktree /target\nHEAD ${targetHead}\nbranch ${targetBranch}\n`
  return `worktree /protected\nHEAD ${protectedHead}\ndetached\n\n${targetEntry}`
}

function detachedSourceRunner(overrides: Record<string, string> = {}) {
  return bootstrapRunner({
    branchSource: '',
    worktrees: detachedSourceWorktrees(),
    ...overrides,
  })
}

describe('protected-main read-only Context bootstrap characterization', () => {
  // Authority: Issue #569 Goal, Scope, and Acceptance Criteria require one
  // registered read-only Context path from exact current protected main against
  // one explicit existing target, with no command or target mutation.
  it('registers one optional explicit target worktree on bemoat:context', () => {
    const contract = getCommandContract('bemoat:context')
    if (!contract) throw new Error('bemoat:context contract missing')

    expect(contract.optional_flags).toContainEqual(expect.objectContaining({
      name: 'target_worktree',
      syntax: '--target-worktree <absolute-path>',
      value_type: 'path',
      required: false,
    }))
    expect(contract.writes).toEqual([])
  })

  it('documents target attached-worktree and upstream reads consistently in JSON help and registry', () => {
    const contract = getCommandContract('bemoat:context')
    if (!contract) throw new Error('bemoat:context contract missing')
    const help = JSON.parse(renderContextHelp('json')) as { reads: string[]; writes: string[] }
    const mentionsTargetRead = (reads: string[]) => reads.some((read) =>
      /target upstream remote URL/i.test(read) && /attached worktree list/i.test(read),
    )

    expect(mentionsTargetRead(help.reads)).toBe(true)
    expect(mentionsTargetRead(contract.reads)).toBe(true)
    expect(help.writes).toEqual([])
    expect(contract.writes).toEqual([])
  })

  // Authority: Issue #569 Goal/Scope and the registered sync-base precedent
  // (Issue #430) define the explicit absolute path syntax. The queried Issue is
  // still caller supplied and parsed by the canonical Context command.
  it('parses a single absolute target while preserving the requested Issue and JSON format', () => {
    expect(parseContextInvocation([
      '568', '--target-worktree', '/worktrees/fix-568-stale-base', '--json',
    ])).toMatchObject({
      mode: 'run',
      format: 'json',
      issueNumber: '568',
      targetWorktree: '/worktrees/fix-568-stale-base',
    })
  })

  // Authority: Issue #569 requires an explicitly canonicalized existing target;
  // same-worktree Context remains the default when the option is omitted.
  it('canonicalizes a target path and keeps omission in same-worktree mode', () => {
    expect(resolveContextBootstrapRoots({
      sourceCwd: '/protected-link',
      targetWorktree: '/target-link',
      entrypointPath: '/protected-link/scripts/agent-context.ts',
      realpath: (path) => path === '/protected-link' ? '/protected' : path === '/protected-link/scripts/agent-context.ts' ? '/protected/scripts/agent-context.ts' : '/target',
      stat: () => ({ isDirectory: () => true }),
    })).toEqual({ sourceCwd: '/protected', targetCwd: '/target', bootstrap: true })
    expect(resolveContextBootstrapRoots({
      sourceCwd: '/protected-link', targetWorktree: null,
      realpath: () => '/protected', stat: () => ({ isDirectory: () => true }),
    })).toEqual({ sourceCwd: '/protected', targetCwd: '/protected', bootstrap: false })
  })

  it('rejects a target path that resolves to the command source worktree', () => {
    expect(() => resolveContextBootstrapRoots({
      sourceCwd: '/protected', targetWorktree: '/target-link', entrypointPath: '/protected/scripts/agent-context.ts',
      realpath: (path) => path === '/target-link' ? '/protected' : path, stat: () => ({ isDirectory: () => true }),
    })).toThrow('must be distinct')
  })

  // Authority: Issue #569 requires independent binding to the exact current
  // protected-main command source. A clean process.cwd checkout alone cannot
  // authorize an entrypoint loaded from another checkout.
  it('requires the explicit bootstrap entrypoint to resolve inside the protected source root', () => {
    const rootsOptions = {
      sourceCwd: '/protected',
      targetWorktree: '/target',
      entrypointPath: '/stale/scripts/agent-context.ts',
      realpath: (path: string) => path,
      stat: () => ({ isDirectory: () => true }),
    }

    expect(() => resolveContextBootstrapRoots(
      rootsOptions as unknown as Parameters<typeof resolveContextBootstrapRoots>[0],
    )).toThrow(/entrypoint.*protected source/i)

    expect(resolveContextBootstrapRoots({
      ...rootsOptions,
      entrypointPath: '/protected/scripts/agent-context.ts',
    } as unknown as Parameters<typeof resolveContextBootstrapRoots>[0])).toEqual({
      sourceCwd: '/protected', targetCwd: '/target', bootstrap: true,
    })

    expect(() => resolveContextBootstrapRoots({
      sourceCwd: '/protected',
      targetWorktree: '/target',
      realpath: (path) => path,
      stat: () => ({ isDirectory: () => true }),
    })).toThrow(/entrypoint.*required/i)

    expect(resolveContextBootstrapRoots({
      sourceCwd: '/protected',
      targetWorktree: null,
      realpath: (path) => path,
      stat: () => ({ isDirectory: () => true }),
    })).toEqual({ sourceCwd: '/protected', targetCwd: '/protected', bootstrap: false })
  })

  // Authority: Issue #569 Must Not Break requires ambiguity and malformed target
  // input to fail closed; no alternate target selection is authorized.
  it.each([
    [['568', '--target-worktree', 'relative-target', '--json'], 'absolute'],
    [['568', '--target-worktree', '/one', '--target-worktree', '/two', '--json'], 'only once'],
  ])('rejects unsafe target arguments %j', (argv, message) => {
    expect(() => parseContextInvocation(argv)).toThrow(message)
  })

  // Authority: Issue #569 Goal, Scope, and Acceptance Criteria require the
  // protected-main source and explicit existing target to be independently
  // bound to the same repository, with clean, durable target identity.
  it('accepts the exact #568 source and attached target identity without any write command', () => {
    const roots = resolveContextBootstrapRoots({ sourceCwd: '/protected', targetWorktree: '/target', entrypointPath: '/protected/scripts/agent-context.ts', realpath: (path) => path, stat: () => ({ isDirectory: () => true }) })
    const { run, calls } = bootstrapRunner()

    expect(verifyContextBootstrap({ roots, evidence: bootstrapEvidence(), run })).toEqual([])
    expect(run('git', ['rev-parse', 'HEAD'], { cwd: roots.targetCwd }).stdout).toBe(targetHead)
    expect(calls.every((call) => !/\b(checkout|reset|merge|commit|push|fetch|worktree add|worktree remove)\b/.test(call))).toBe(true)
    expect(calls.some((call) => call.includes('worktree list --porcelain @ /protected'))).toBe(true)
    expect(calls.some((call) => call.includes('ls-remote --heads origin fix/568-stale-base-sync-conflict-continuation @ /target'))).toBe(true)
  })

  // Authority: Issue #571's Founder-approved Option A selects the detached
  // source case. The protected-main stale-branch bootstrap design's
  // Source-command identity section requires exact live-base SHA, clean state,
  // and canonical repository identity, and explicitly permits a detached
  // source because it is not the mutation target. The target still must pass
  // the independent attached, exact-identity, and durability checks below.
  it('accepts a clean canonical detached source at the exact live protected SHA with a valid attached target', () => {
    const roots = resolveContextBootstrapRoots({ sourceCwd: '/protected', targetWorktree: '/target', entrypointPath: '/protected/scripts/agent-context.ts', realpath: (path) => path, stat: () => ({ isDirectory: () => true }) })
    const { run, calls } = detachedSourceRunner()

    expect(verifyContextBootstrap({ roots, evidence: bootstrapEvidence(), run })).toEqual([])
    expect(calls.some((call) => call.includes('worktree list --porcelain @ /protected'))).toBe(true)
    expect(calls.every((call) => !/\b(checkout|reset|merge|commit|push|fetch|worktree add|worktree remove)\b/.test(call))).toBe(true)
  })

  // Authority: Issue #571 execution handoff §9 and the recorded live Issue
  // #582 reproduction bind this production-shaped fixture to canonical
  // repository bemoat/bemoat-web-starter, detached source main@933cc28, and
  // the durable attached target fix/582-repository-transfer-identity@8889e18.
  // The fixture exercises verification only and does not mutate Issue #582.
  it('accepts the verified #582 target from a detached exact-live-main source without Git mutation', () => {
    const issueBranch = 'fix/582-repository-transfer-identity'
    const protectedSha = '933cc285923174279c9dedee1c4074ea860f89c1'
    const issueHead = '8889e1898d5d20833143bc568f325175ee46956b'
    const issueRepo = 'bemoat/bemoat-web-starter'
    const evidence = bootstrapEvidence()
    evidence.repository = {
      owner: 'bemoat',
      name: 'bemoat-web-starter',
      nameWithOwner: issueRepo,
      url: `https://github.com/${issueRepo}`,
    }
    evidence.protectedBase = {
      ...evidence.protectedBase,
      sha: protectedSha,
      url: `https://github.com/${issueRepo}/tree/main`,
    }
    evidence.issue = {
      ...evidence.issue,
      number: '582',
      title: 'Repository transfer identity',
      url: `https://github.com/${issueRepo}/issues/582`,
    }
    evidence.localGit = {
      ...evidence.localGit,
      branch: issueBranch,
      head: issueHead,
      upstream: `origin/${issueBranch}`,
      originRepository: issueRepo,
    }
    const roots = resolveContextBootstrapRoots({ sourceCwd: '/protected', targetWorktree: '/target', entrypointPath: '/protected/scripts/agent-context.ts', realpath: (path) => path, stat: () => ({ isDirectory: () => true }) })
    const { run, calls } = bootstrapRunner({
      '/protected': protectedSha,
      '/target': issueHead,
      branchSource: '',
      branchTarget: issueBranch,
      sourceOrigin: `https://github.com/${issueRepo}.git`,
      targetOrigin: `https://github.com/${issueRepo}.git`,
      upstreamOrigin: `https://github.com/${issueRepo}.git`,
      upstream: `origin/${issueBranch}`,
      remote: `${issueHead}\trefs/heads/${issueBranch}\n`,
      worktrees: `worktree /protected\nHEAD ${protectedSha}\ndetached\n\nworktree /target\nHEAD ${issueHead}\nbranch refs/heads/${issueBranch}\n`,
    })
    const targetHeadBefore = run('git', ['rev-parse', 'HEAD'], { cwd: roots.targetCwd }).stdout

    expect(verifyContextBootstrap({ roots, evidence, run })).toEqual([])
    expect(targetHeadBefore).toBe(issueHead)
    expect(run('git', ['rev-parse', 'HEAD'], { cwd: roots.targetCwd }).stdout).toBe(targetHeadBefore)
    expect(calls.some((call) => call.includes('worktree list --porcelain @ /protected'))).toBe(true)
    expect(calls.some((call) => call.includes(`ls-remote --heads origin ${issueBranch} @ /target`))).toBe(true)
    expect(calls.every((call) => !/\b(checkout|reset|merge|commit|push|fetch|worktree add|worktree remove)\b/.test(call))).toBe(true)
  })

  // Authority: the same source-command identity contract keeps the live base
  // SHA, clean source, and canonical origin as required proof even after
  // Founder approval of detached exact-SHA sources.
  it.each([
    ['wrong detached source SHA', { '/protected': 'f'.repeat(40) }, 'source HEAD does not match the live protected base'],
    ['dirty detached source', { sourceStatus: ' M scripts/agent-context.ts\n' }, 'source is not clean'],
    ['noncanonical detached source origin', { sourceOrigin: 'https://github.com/other/repository.git' }, 'source is not the canonical target repository'],
  ])('fails closed for %s', (_story, overrides, expectedReason) => {
    const roots = resolveContextBootstrapRoots({ sourceCwd: '/protected', targetWorktree: '/target', entrypointPath: '/protected/scripts/agent-context.ts', realpath: (path) => path, stat: () => ({ isDirectory: () => true }) })
    const { run } = detachedSourceRunner(overrides)

    expect(verifyContextBootstrap({ roots, evidence: bootstrapEvidence(), run }).join('\n')).toContain(expectedReason)
  })

  // Authority: Issue #571 Option A changes source attachment eligibility only.
  // The existing explicit-target contract still requires an attached target
  // whose live repository/head/durability evidence matches Context.
  it.each([
    ['wrong target HEAD', { '/target': 'f'.repeat(40) }, 'target HEAD differs from independently collected Context evidence'],
    ['wrong target branch and Issue', {
      branchTarget: 'fix/999-unrelated',
      upstream: 'origin/fix/999-unrelated',
      remote: `${targetHead}\trefs/heads/fix/999-unrelated\n`,
    }, 'target branch is not a numbered topic branch bound to Issue 568'],
    ['dirty target', { targetStatus: ' M docs/agent-loop/README.md\n' }, 'target worktree is dirty or unavailable'],
    ['wrong target repository', { targetOrigin: 'https://github.com/other/repository.git' }, 'target origin does not match the canonical repository'],
    ['wrong target upstream', { upstream: 'origin/fix/999-unrelated' }, 'target upstream is missing or does not match its branch'],
    ['unpushed target', { remote: `${'f'.repeat(40)}\trefs/heads/fix/568-stale-base-sync-conflict-continuation\n` }, 'target HEAD is not proven pushed'],
    ['detached target', { branchTarget: '', worktrees: detachedSourceWorktrees('detached') }, 'target branch differs from independently collected Context evidence or is detached'],
    ['unattached target', { worktrees: 'worktree /protected\nHEAD 378b2aa90ecad6d76f4ddae5958077fdad58d045\ndetached\n' }, 'target is not an attached worktree of the protected-main command source'],
  ])('keeps a detached source fail-closed when the target has %s', (_story, overrides, expectedReason) => {
    const roots = resolveContextBootstrapRoots({ sourceCwd: '/protected', targetWorktree: '/target', entrypointPath: '/protected/scripts/agent-context.ts', realpath: (path) => path, stat: () => ({ isDirectory: () => true }) })
    const { run } = detachedSourceRunner(overrides)
    const reasons = verifyContextBootstrap({ roots, evidence: bootstrapEvidence(), run })

    expect(reasons.join('\n')).toContain(expectedReason)
    expect(reasons.some((reason) => /^EVIDENCE_CONFLICT: protected-main command source/i.test(reason))).toBe(false)
  })

  // Authority: exact #568 source STOP comment 5994221307 and Founder resolutions
  // 5994979861 / 5994983272 bind this Issue, branch, and head; protected-main
  // v1.4.0 no-PR BLOCKER_RESOLUTION semantics uniquely recompute IMPLEMENT once
  // both current-head blockers are resolved and durable no-PR work is valid.
  it('recomputes the exact #568 no-PR STOP as IMPLEMENT from both named Founder resolutions', () => {
    const sourceUrl = `https://github.com/${repo}/issues/568#issuecomment-5994221307`
    const record: HandoffRecord = {
      schema_version: 3,
      record_type: 'HANDOFF',
      objective_mode: 'implementation',
      repository: repo,
      issue_number: '568',
      objective: 'Record independent review blockers on the pushed Issue #568 candidate and stop before PR creation or further mutation.',
      permitted_scope: ['Record the exact candidate head, completed validation evidence, and independently reviewed blockers for Issue #568.'],
      prohibited_scope: ['No additional file edits or recovery design in this bounded recovery.', 'No mutation or messaging on Issue #554 or PR #555.', 'No direct/manual Git conflict resolution.', 'No PR creation, merge, or autonomous merge.'],
      executing_agent: 'Codex',
      provider: 'OpenAI',
      branch: 'fix/568-stale-base-sync-conflict-continuation',
      exact_head: targetHead,
      protected_base: { branch: 'main', sha: '6a7a6a6c9349ce16a594f757bff2e03236072585' },
      pr: null,
      verified_evidence: [
        { kind: 'stop-blocker', value: 'conflict-only-continuation-route-contradiction', url: null },
        { kind: 'stop-blocker', value: 'protected-baseline-fixture-head-mismatch', url: null },
      ],
      route: 'STOP',
      next_action: { route: 'STOP', description: 'Resolve the independently reviewed contract contradiction and exact-baseline fixture mismatch through an authorized bounded correction before PR creation; then reconstruct fresh Context.' },
      stop_conditions: ['Do not open a PR or merge while either review blocker remains.', 'Do not touch Issue #554 or PR #555, resolve its conflict, or grant it authority from this record.', 'Preserve sync-base fail-closed behavior and no autonomous merge.'],
      local_durability: { required: true, durable: true, reason: null },
    }
    const stop: NormalizedContextEvidence['durableContext']['latestHandoff'] = {
      id: '5994221307', body: renderHandoffComment(record), createdAt: '2026-10-05T00:00:00Z', url: sourceUrl,
    }
    const blockers = ['conflict-only-continuation-route-contradiction', 'protected-baseline-fixture-head-mismatch']
    const resolutions = blockers.map((blockerId, index) => {
      const id = index === 0 ? '5994979861' : '5994983272'
      return {
        id,
        body: `## BLOCKER_RESOLUTION\n\n\`\`\`json\n${JSON.stringify({
          schema_version: 2,
          record_type: 'BLOCKER_RESOLUTION',
          repository: repo,
          issue_number: '568',
          pr_number: null,
          branch: 'fix/568-stale-base-sync-conflict-continuation',
          exact_head: targetHead,
          protected_base: { branch: 'main', sha: protectedHead },
          policy: { path: 'docs/mission-control/mission-control-guide.md', policy_id: 'bemoat-mission-control', version: '1.4.0', source_sha: 'ad392ec782b63042261d51cd98939318b22c053d' },
          source_stop_handoff: { comment_id: '5994221307', url: sourceUrl },
          blocker_id: blockerId,
          authority: { role: 'FOUNDER', login: 'boat1994' },
        }, null, 2)}\n\`\`\`\n`,
        createdAt: '2026-10-05T00:00:00Z',
        url: `https://github.com/${repo}/issues/568#issuecomment-${id}`,
        authorLogin: 'boat1994',
        authorAssociation: 'OWNER',
      }
    })

    const parsedStop = parseRoleEvidence([stop])
    const evidenceBase = {
      ...bootstrapEvidence(),
      policy: { ...bootstrapEvidence().policy, trustedFounderLogin: 'boat1994' },
    }
    const stopOnlyEvidence = {
      ...evidenceBase,
      durableContext: {
        latestHandoff: parsedStop.latestHandoff,
        handoffs: parsedStop.handoffs,
        historicalResults: parsedStop.historicalResults,
        blockerResolutions: parsedStop.blockerResolutions,
        invalidBlockerResolutions: parsedStop.invalidBlockerResolutions,
      },
    }
    expect(routeContext(stopOnlyEvidence).route).toBe('STOP')

    const parsed = parseRoleEvidence([stop, ...resolutions])
    expect(parsed.blockerResolutions.map(({ id }) => String(id))).toEqual(['5994979861', '5994983272'])
    expect(parsed.invalidBlockerResolutions).toEqual([])
    const evidence = {
      ...evidenceBase,
      durableContext: {
        latestHandoff: parsed.latestHandoff,
        handoffs: parsed.handoffs,
        historicalResults: parsed.historicalResults,
        blockerResolutions: parsed.blockerResolutions,
        invalidBlockerResolutions: parsed.invalidBlockerResolutions,
      },
    }
    const roots = resolveContextBootstrapRoots({ sourceCwd: '/protected', targetWorktree: '/target', entrypointPath: '/protected/scripts/agent-context.ts', realpath: (path) => path, stat: () => ({ isDirectory: () => true }) })
    const { run, calls } = bootstrapRunner()
    const headBefore = run('git', ['rev-parse', 'HEAD'], { cwd: roots.targetCwd }).stdout
    expect(verifyContextBootstrap({ roots, evidence, run })).toEqual([])
    expect(routeContext(evidence)).toMatchObject({
      route: 'IMPLEMENT',
      nextAction: { type: 'COMMAND', command: null },
    })
    expect(run('git', ['rev-parse', 'HEAD'], { cwd: roots.targetCwd }).stdout).toBe(headBefore)
    expect(headBefore).toBe(targetHead)
    expect(calls.every((call) => !/\b(checkout|reset|merge|commit|push|fetch|worktree add|worktree remove)\b/.test(call))).toBe(true)
  })

  it.each([
    ['wrong source head', { '/protected': 'f'.repeat(40) }, 'source HEAD'],
    ['wrong source branch', { branchSource: 'fix/568-stale-base-sync-conflict-continuation' }, 'protected branch'],
    ['dirty source', { sourceStatus: ' M scripts/agent-context.ts\n' }, 'source is not clean'],
    ['wrong source repository', { sourceOrigin: 'https://github.com/other/repository.git' }, 'source is not the canonical target repository'],
    ['detached target', { branchTarget: '' }, 'detached'],
    ['dirty target', { targetStatus: ' M docs/agent-loop/README.md\n' }, 'dirty'],
    ['wrong target repository', { targetOrigin: 'https://github.com/other/repository.git' }, 'target origin'],
    ['unpushed target', { remote: `${'f'.repeat(40)}\trefs/heads/fix/568-stale-base-sync-conflict-continuation\n` }, 'not proven pushed'],
    ['unattached target', { worktrees: 'worktree /protected\nHEAD 378b2aa90ecad6d76f4ddae5958077fdad58d045\nbranch refs/heads/main\n' }, 'not an attached worktree'],
    ['suffix-matched wrong remote ref', { remote: `${targetHead}\trefs/heads/other/fix/568-stale-base-sync-conflict-continuation\n` }, 'not proven pushed'],
  ])('fails closed for %s', (_story, overrides, expectedReason) => {
    const roots = resolveContextBootstrapRoots({ sourceCwd: '/protected', targetWorktree: '/target', entrypointPath: '/protected/scripts/agent-context.ts', realpath: (path) => path, stat: () => ({ isDirectory: () => true }) })
    const { run } = bootstrapRunner(overrides)

    expect(verifyContextBootstrap({ roots, evidence: bootstrapEvidence(), run }).join('\n')).toContain(expectedReason)
  })

  // Authority: Issue #569 acceptance criteria require the target's canonical
  // origin/upstream identity and live pushed durability; a pushed branch on a
  // remote belonging to another repository cannot establish that identity.
  it('rejects a pushed upstream branch whose remote URL belongs to another repository', () => {
    const roots = resolveContextBootstrapRoots({ sourceCwd: '/protected', targetWorktree: '/target', entrypointPath: '/protected/scripts/agent-context.ts', realpath: (path) => path, stat: () => ({ isDirectory: () => true }) })
    const { run } = bootstrapRunner({
      upstream: 'mirror/fix/568-stale-base-sync-conflict-continuation',
      upstreamOrigin: 'https://github.com/other/repository.git',
    })
    const evidence = bootstrapEvidence()
    evidence.localGit.upstream = 'mirror/fix/568-stale-base-sync-conflict-continuation'

    expect(verifyContextBootstrap({ roots, evidence, run })).toContainEqual(expect.stringMatching(/EVIDENCE_CONFLICT:.*upstream.*canonical repository/i))
  })

  // Authority: Issue #569 binds an explicit target to the queried Issue;
  // Context Story Matrix Issue #525 preserves unnumbered routing only as legacy
  // behavior, not as evidence that an explicit Issue target belongs to #568.
  it('rejects an unnumbered explicit target for #568 while preserving same-worktree routing', () => {
    const branch = 'feature/unrelated'
    const evidence = bootstrapEvidence()
    evidence.localGit = {
      ...evidence.localGit,
      branch,
      upstream: `origin/${branch}`,
    }
    const roots = resolveContextBootstrapRoots({ sourceCwd: '/protected', targetWorktree: '/target', entrypointPath: '/protected/scripts/agent-context.ts', realpath: (path) => path, stat: () => ({ isDirectory: () => true }) })
    const { run } = bootstrapRunner({
      branchTarget: branch,
      upstream: `origin/${branch}`,
      remote: `${targetHead}\trefs/heads/${branch}\n`,
    })
    const bootstrapReasons = verifyContextBootstrap({ roots, evidence, run })

    expect(bootstrapReasons).toContainEqual(expect.stringMatching(/EVIDENCE_CONFLICT:.*target.*Issue 568/i))
    expect(routeContext({ ...evidence, evidenceErrors: bootstrapReasons }).route).toBe('STOP')

    const sameWorktreeRoots = resolveContextBootstrapRoots({ sourceCwd: '/protected', targetWorktree: null, realpath: (path) => path, stat: () => ({ isDirectory: () => true }) })
    expect(sameWorktreeRoots).toEqual({ sourceCwd: '/protected', targetCwd: '/protected', bootstrap: false })
    expect(routeContext(evidence).route).toBe('IMPLEMENT')
  })

  // Authority: Issue #569 Scope requires no-PR/active-PR identity checks as
  // applicable, and binds the explicit target to its exact branch and head.
  it('accepts an active PR identity that exactly matches the explicit target branch and head', () => {
    const roots = resolveContextBootstrapRoots({ sourceCwd: '/protected', targetWorktree: '/target', entrypointPath: '/protected/scripts/agent-context.ts', realpath: (path) => path, stat: () => ({ isDirectory: () => true }) })
    const prBase: ActivePullRequestEvidence = {
      number: '568',
      state: 'OPEN',
      draft: true,
      url: `https://github.com/${repo}/pull/568`,
      baseBranch: 'main',
      baseSha: protectedHead,
      headBranch: bootstrapEvidence().localGit.branch,
      headSha: targetHead,
      merged: false,
      mergeCommitSha: null,
    }
    const exactEvidence = { ...bootstrapEvidence(), activePr: prBase }
    const { run } = bootstrapRunner()

    expect(verifyContextBootstrap({ roots, evidence: exactEvidence, run })).toEqual([])

  })

  it.each([
    ['branch', { headBranch: 'fix/568-different-target' }],
    ['head', { headSha: 'f'.repeat(40) }],
  ])('rejects an active PR with a mismatched target %s', (_label, mismatch) => {
    const roots = resolveContextBootstrapRoots({ sourceCwd: '/protected', targetWorktree: '/target', entrypointPath: '/protected/scripts/agent-context.ts', realpath: (path) => path, stat: () => ({ isDirectory: () => true }) })
    const activePr: ActivePullRequestEvidence = {
        number: '568',
        state: 'OPEN',
        draft: true,
        url: `https://github.com/${repo}/pull/568`,
        baseBranch: 'main',
        baseSha: protectedHead,
        headBranch: bootstrapEvidence().localGit.branch,
        headSha: targetHead,
        merged: false,
        mergeCommitSha: null,
        ...mismatch,
    }
    const evidence = { ...bootstrapEvidence(), activePr }
    const { run } = bootstrapRunner()

    expect(verifyContextBootstrap({ roots, evidence, run })).toContainEqual(
      expect.stringMatching(/EVIDENCE_CONFLICT:.*active PR.*target.*branch.*head/i),
    )
  })

  // Authority: Issue #569 requires exact Issue/repository/branch/head binding;
  // Context Story Matrix Issue #525 explicitly routes a numbered foreign Issue
  // branch to STOP/EVIDENCE_CONFLICT.
  it.each([
    ['wrong evidence head', (evidence: NormalizedContextEvidence) => ({ ...evidence, localGit: { ...evidence.localGit, head: 'f'.repeat(40) } }), 'target HEAD differs'],
    ['wrong evidence branch', (evidence: NormalizedContextEvidence) => ({ ...evidence, localGit: { ...evidence.localGit, branch: 'fix/569-other-issue' } }), 'target branch differs'],
    ['wrong evidence repository', (evidence: NormalizedContextEvidence) => ({ ...evidence, localGit: { ...evidence.localGit, originRepository: 'other/repository' } }), 'target origin'],
    ['changed protected base', (evidence: NormalizedContextEvidence) => ({ ...evidence, protectedBase: { ...evidence.protectedBase, sha: 'f'.repeat(40) } }), 'source HEAD'],
  ])('rejects %s against independently read Git facts', (_story, alterEvidence, reason) => {
    const roots = resolveContextBootstrapRoots({ sourceCwd: '/protected', targetWorktree: '/target', entrypointPath: '/protected/scripts/agent-context.ts', realpath: (path) => path, stat: () => ({ isDirectory: () => true }) })
    const { run } = bootstrapRunner()

    expect(verifyContextBootstrap({ roots, evidence: alterEvidence(bootstrapEvidence()), run }).join('\n')).toContain(reason)
  })

  it('routes an explicitly numbered target branch for another Issue to STOP with EVIDENCE_CONFLICT', () => {
    const evidence = bootstrapEvidence()
    evidence.issue = { ...evidence.issue, number: '569', url: `https://github.com/${repo}/issues/569` }

    expect(routeContext(evidence)).toMatchObject({
      route: 'STOP',
      reasons: expect.arrayContaining([expect.stringMatching(/EVIDENCE_CONFLICT:.*branch.*Issue/i)]),
    })
  })
})
