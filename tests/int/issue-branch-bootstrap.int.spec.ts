import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { readLocalGitEvidence } from '../../scripts/context/evidence.ts'
import type {
  ContextCommandResult,
  ContextCommandRunner,
} from '../../scripts/context/evidence.ts'
import type { NormalizedContextEvidence } from '../../scripts/context/model.ts'
import { routeContext } from '../../scripts/context/router.ts'

const root = process.cwd()
const baseSha = 'a'.repeat(40)
const implementationSha = 'b'.repeat(40)
const nonDurableStories: Array<[
  string,
  Partial<NormalizedContextEvidence['localGit']>,
]> = [
  ['actual unpushed implementation commit', {
    head: implementationSha,
    pushed: false,
    durable: false,
    reasons: ['LOCAL_STATE_NOT_DURABLE: current HEAD is not proven pushed to its live upstream'],
  }],
  ['dirty worktree', {
    clean: false,
    durable: false,
    reasons: ['LOCAL_STATE_NOT_DURABLE: working tree is dirty or has untracked files'],
  }],
  ['detached checkout', {
    branch: '<detached>',
    detached: true,
    durable: false,
    reasons: ['LOCAL_STATE_NOT_DURABLE: repository is detached'],
  }],
]

function response(stdout = ''): ContextCommandResult {
  return { status: 0, stdout, stderr: '', error: null }
}

function contextEvidence({
  protectedBranch,
  localGit = {},
  evidenceErrors = [],
}: {
  protectedBranch: 'main' | 'dev'
  localGit?: Partial<NormalizedContextEvidence['localGit']>
  evidenceErrors?: string[]
}): NormalizedContextEvidence {
  const branch = 'fix/465-durable-branch-bootstrap'
  return {
    repository: {
      owner: 'boat1994',
      name: protectedBranch === 'main' ? 'bemoat-web-starter' : 'child-project',
      nameWithOwner: `boat1994/${protectedBranch === 'main' ? 'bemoat-web-starter' : 'child-project'}`,
      url: `https://github.com/boat1994/${protectedBranch === 'main' ? 'bemoat-web-starter' : 'child-project'}`,
    },
    protectedBase: {
      branch: protectedBranch,
      sha: baseSha,
      source: 'live GitHub ref',
      url: `https://github.com/boat1994/${protectedBranch === 'main' ? 'bemoat-web-starter' : 'child-project'}/tree/${protectedBranch}`,
    },
    policy: {
      path: 'docs/mission-control/mission-control-guide.md',
      policyId: 'bemoat-mission-control',
      version: '1.3.0',
      sourceSha: 'c'.repeat(40),
      url: `https://github.com/boat1994/${protectedBranch === 'main' ? 'bemoat-web-starter' : 'child-project'}/blob/${baseSha}/docs/mission-control/mission-control-guide.md`,
    },
    issue: {
      number: '465',
      title: 'durable issue-branch bootstrap',
      state: 'OPEN',
      url: `https://github.com/boat1994/${protectedBranch === 'main' ? 'bemoat-web-starter' : 'child-project'}/issues/465`,
      objective: 'Make first-time issue-branch bootstrap deterministic.',
      scope: 'Branch bootstrap only.',
      acceptanceCriteria: [],
      dependencies: [],
      taskSize: 'core',
      missionControlMode: 'optional',
      workflowProfile: 'STANDARD',
    },
    localGit: {
      branch,
      head: baseSha,
      upstream: `origin/${branch}`,
      originRepository: `boat1994/${protectedBranch === 'main' ? 'bemoat-web-starter' : 'child-project'}`,
      clean: true,
      detached: false,
      pushed: true,
      durable: true,
      reasons: [],
      ...localGit,
    },
    activePr: null,
    currentHeadVerification: null,
    durableContext: { latestHandoff: null, historicalResults: [] },
    evidenceErrors,
  }
}

describe('Issue #465 durable zero-delta branch bootstrap stories', () => {
  it.each(['main', 'dev'] as const)(
    'routes a clean zero-delta topic branch published from %s to IMPLEMENT',
    (protectedBranch) => {
      expect(routeContext(contextEvidence({ protectedBranch }))).toMatchObject({
        route: 'IMPLEMENT',
        reasons: ['No active PR is present and the local topic branch is durable.'],
      })
    },
  )

  it.each(nonDurableStories)('keeps %s fail-closed', (_story, localGit) => {
    const decision = routeContext(contextEvidence({ protectedBranch: 'main', localGit }))

    expect(decision.route).toBe('STOP')
    expect(decision.reasons.join(' ')).toMatch(/LOCAL_STATE_NOT_DURABLE/)
  })

  it.each([
    'EVIDENCE_CONFLICT: configured repository boat1994/bemoat-web-starter differs from origin boat1994/wrong-repository',
    'EVIDENCE_CONFLICT: active PR base does not match the live protected base',
  ])('keeps identity ambiguity fail-closed: %s', (error) => {
    expect(routeContext(contextEvidence({
      protectedBranch: 'main',
      evidenceErrors: [error],
    })).route).toBe('STOP')
  })

  it.each([
    ['absent remote branch', ''],
    ['conflicting remote branch head', `${implementationSha}\trefs/heads/fix/465-durable-branch-bootstrap\n`],
  ])('does not accept %s as durable readback', (_story, remoteReadback) => {
    const calls: string[] = []
    const run: ContextCommandRunner = (command, args) => {
      const key = `${command} ${args.join(' ')}`
      calls.push(key)
      const values: Record<string, string> = {
        'git branch --show-current': 'fix/465-durable-branch-bootstrap\n',
        'git rev-parse HEAD': `${baseSha}\n`,
        'git status --short': '',
        'git rev-parse --abbrev-ref --symbolic-full-name @{upstream}': 'origin/fix/465-durable-branch-bootstrap\n',
        'git remote get-url origin': 'git@github.com:boat1994/bemoat-web-starter.git\n',
        'git ls-remote --heads origin fix/465-durable-branch-bootstrap': remoteReadback,
      }
      return response(values[key])
    }

    const evidence = readLocalGitEvidence({ cwd: '/repo', run })

    expect(evidence).toMatchObject({ pushed: false, durable: false })
    expect(evidence.reasons.join(' ')).toMatch(/LOCAL_STATE_NOT_DURABLE/)
    expect(calls.some((call) => /\bgit (?:push|switch|checkout|commit|reset|stash)\b/.test(call))).toBe(false)
  })

  it('documents one explicit zero-delta push boundary and exact post-push readback', () => {
    const workflow = readFileSync(resolve(root, 'docs/agent-loop/issue-driven-branch-workflow.md'), 'utf8')
    const agents = readFileSync(resolve(root, 'AGENTS.md'), 'utf8')
    const normalized = workflow.replace(/\s+/g, ' ')

    expect(workflow).toContain('## Durable zero-delta branch bootstrap')
    expect(normalized).toMatch(/No registered `bemoat:\*` command.*native Git mutation boundary/i)
    expect(normalized).toMatch(/remote topic branch must be absent.*do not guess.*overwrite/i)
    expect(workflow).toContain('git switch -c <topic-branch> <exact-base-sha>')
    expect(workflow).toContain('git push -u origin HEAD:refs/heads/<topic-branch>')
    // Authority: #585 requires the local topic and remote topic to be absent
    // before creation, then the exact pushed SHA to be verified. A present
    // matching tracking ref is reused; an absent one is created with a
    // create-only CAS after FETCH_HEAD readback.
    expect(workflow).toContain('git show-ref --verify --quiet refs/remotes/origin/<topic-branch>')
    expect(workflow).toContain('git config --get-all remote.origin.fetch')
    expect(workflow).toContain('git remote set-branches --add origin <topic-branch>')
    expect(workflow).toContain('git fetch --no-tags --no-recurse-submodules --refmap= origin refs/heads/<topic-branch>:')
    expect(workflow).toContain('git update-ref refs/remotes/origin/<topic-branch> <exact-live-topic-sha> 0000000000000000000000000000000000000000')
    expect(workflow).toContain('git rev-parse refs/remotes/origin/<topic-branch>')
    expect(workflow).toContain('git rev-parse FETCH_HEAD')
    expect(normalized).toMatch(/only when the current fetch mapping does not cover this topic.*set-branches/i)
    expect(normalized).toMatch(/tracking ref had to be absent before bootstrap.*After the push, read the exact live topic SHA.*present tracking ref is reused read.only only when it exactly equals the live topic SHA.*absent, create it with create.only compare.and.swap after rechecking absence/i)
    expect(normalized).toMatch(/base line.*match.*local HEAD/i)
    expect(normalized).toMatch(/topic line.*absent/i)
    expect(normalized).toMatch(/local topic branch.*must be absent/i)
    expect(workflow).toContain('git ls-remote --heads origin refs/heads/<base-branch> refs/heads/<topic-branch>')
    expect(normalized).toMatch(/immediately read back.*base.*topic/i)
    expect(normalized).toMatch(/Do not force-push.*read back.*local HEAD.*upstream.*live remote (?:topic )?branch/i)
    expect(normalized).toMatch(/local HEAD.*live remote (?:topic )?branch.*exact protected.*integration.*base SHA/i)
    expect(normalized).toMatch(/failure.*ambiguity.*STOP.*no file edit/i)
    expect(agents).toMatch(/durable zero-delta branch bootstrap/i)
  })

  // Authority: #585's accepted setup sequence plus observed Git behavior in
  // ordinary and single-branch clones require exact FETCH_HEAD verification,
  // reuse of a matching tracking ref, and create-only CAS only when absent.
  it.each([['ordinary', false], ['single-branch', true]] as const)(
    'handles exact pushed tracking-ref readback in a %s clone', (_kind, singleBranch) => {
    const sandbox = mkdtempSync(join(tmpdir(), 'bemoat-585-single-branch-'))
    const bare = join(sandbox, 'origin.git')
    const seed = join(sandbox, 'seed')
    const clone = join(sandbox, 'clone')
    const git = (args: string[], cwd?: string) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: 'pipe' }).trim()
    const topic = 'fix/585-single-branch-bootstrap'

    try {
      git(['init', '--bare', '--initial-branch=main', bare])
      git(['init', '--initial-branch=main', seed])
      git(['config', 'user.name', 'Bootstrap Test'], seed)
      git(['config', 'user.email', 'bootstrap-test@example.invalid'], seed)
      writeFileSync(join(seed, 'README.md'), 'bootstrap fixture\n')
      git(['add', 'README.md'], seed)
      git(['commit', '-m', 'seed main'], seed)
      git(['remote', 'add', 'origin', bare], seed)
      git(['push', '-u', 'origin', 'main'], seed)

      git(singleBranch
        ? ['clone', '--single-branch', '--branch', 'main', bare, clone]
        : ['clone', '--branch', 'main', bare, clone])
      git(['config', 'user.name', 'Bootstrap Test'], clone)
      git(['config', 'user.email', 'bootstrap-test@example.invalid'], clone)
      const trackingRef = `refs/remotes/origin/${topic}`
      // The candidate topic tracking ref must be absent before branch creation.
      expect(() => git(['show-ref', '--verify', '--quiet', trackingRef], clone)).toThrow()
      expect(() => git(['rev-parse', '--verify', trackingRef], clone)).toThrow()
      git(['switch', '-c', topic], clone)
      git(['push', '-u', 'origin', `HEAD:refs/heads/${topic}`], clone)

      // In a default clone, push -u already creates the exact tracking ref.
      // A single-branch clone has no mapping for the topic and leaves it absent.
      if (singleBranch) {
        expect(() => git(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'], clone)).toThrow()
        git(['remote', 'set-branches', '--add', 'origin', topic], clone)
        expect(git(['config', '--get-all', 'remote.origin.fetch'], clone)).toContain(`+refs/heads/${topic}:refs/remotes/origin/${topic}`)
        expect(() => git(['show-ref', '--verify', '--quiet', trackingRef], clone)).toThrow()
      } else {
        expect(git(['config', '--get-all', 'remote.origin.fetch'], clone)).toContain('+refs/heads/*:refs/remotes/origin/*')
        expect(git(['rev-parse', trackingRef], clone)).toBe(git(['rev-parse', 'HEAD'], clone))
      }
      git(['fetch', '--no-tags', '--no-recurse-submodules', '--refmap=', 'origin', `refs/heads/${topic}:`], clone)

      const head = git(['rev-parse', 'HEAD'], clone)
      expect(git(['rev-parse', 'FETCH_HEAD'], clone)).toBe(head)
      if (singleBranch) {
        expect(() => git(['show-ref', '--verify', '--quiet', trackingRef], clone)).toThrow()
        git(['update-ref', trackingRef, head, '0000000000000000000000000000000000000000'], clone)
      } else {
        // FETCH_HEAD-only fetch leaves the exact push-created ref untouched;
        // it is therefore reused read-only and needs no update-ref.
        expect(git(['rev-parse', trackingRef], clone)).toBe(head)
      }
      expect(git(['rev-parse', trackingRef], clone)).toBe(head)
      expect(git(['rev-parse', 'FETCH_HEAD'], clone)).toBe(head)
      expect(git(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'], clone)).toBe(`origin/${topic}`)
    } finally {
      rmSync(sandbox, { recursive: true, force: true })
    }
    },
  )

  // Oracle: Issue #605's positive production-shaped acceptance criterion
  // requires an absent Issue-B branch in the same checkout to start at the
  // exact live protected-main SHA, without carrying Issue-A code or history.
  // This uses real Git refs and a bare remote; it does not infer a Context
  // route or introduce any workflow evidence shape.
  it('starts an absent Issue-B branch at exact live main in the same checkout without Issue-A history', () => {
    const sandbox = mkdtempSync(join(tmpdir(), 'bemoat-605-same-checkout-'))
    const bare = join(sandbox, 'origin.git')
    const seed = join(sandbox, 'seed')
    const checkout = join(sandbox, 'checkout')
    const git = (args: string[], cwd?: string) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: 'pipe' }).trim()
    const issueABranch = 'fix/605-released-source-fixture'
    const issueBBranch = 'fix/606-sequential-target-fixture'

    try {
      git(['init', '--bare', '--initial-branch=main', bare])
      git(['init', '--initial-branch=main', seed])
      git(['config', 'user.name', 'Bootstrap Test'], seed)
      git(['config', 'user.email', 'bootstrap-test@example.invalid'], seed)
      writeFileSync(join(seed, 'base.txt'), 'protected base\n')
      git(['add', 'base.txt'], seed)
      git(['commit', '-m', 'seed protected main'], seed)
      git(['remote', 'add', 'origin', bare], seed)
      git(['push', '-u', 'origin', 'main'], seed)
      const liveMainSha = git(['rev-parse', 'HEAD'], seed)

      git(['clone', '--branch', 'main', bare, checkout])
      git(['config', 'user.name', 'Bootstrap Test'], checkout)
      git(['config', 'user.email', 'bootstrap-test@example.invalid'], checkout)
      git(['switch', '-c', issueABranch], checkout)
      writeFileSync(join(checkout, 'issue-a.txt'), 'Issue A implementation\n')
      git(['add', 'issue-a.txt'], checkout)
      git(['commit', '-m', 'Issue A implementation'], checkout)
      const issueACommit = git(['rev-parse', 'HEAD'], checkout)
      git(['push', '-u', 'origin', issueABranch], checkout)

      // The source is durably parked before the same physical checkout returns
      // to the independently observed protected-base tip. Capture and retain
      // both local and live source refs across the target bootstrap.
      expect(git(['rev-parse', `refs/heads/${issueABranch}`], checkout)).toBe(issueACommit)
      expect(git(['rev-parse', `refs/remotes/origin/${issueABranch}`], checkout)).toBe(issueACommit)
      expect(git(['ls-remote', '--heads', 'origin', `refs/heads/${issueABranch}`], checkout).split('\t')[0]).toBe(issueACommit)
      git(['switch', 'main'], checkout)
      expect(git(['status', '--porcelain=v1'], checkout)).toBe('')
      expect(git(['rev-parse', 'HEAD'], checkout)).toBe(liveMainSha)
      expect(git(['ls-remote', '--heads', 'origin', 'refs/heads/main'], checkout).split('\t')[0]).toBe(liveMainSha)
      expect(() => git(['show-ref', '--verify', '--quiet', `refs/heads/${issueBBranch}`], checkout)).toThrow()
      expect(git(['ls-remote', '--heads', 'origin', `refs/heads/${issueBBranch}`], checkout)).toBe('')

      // Create the new target from the exact observed live-base SHA. Starting
      // from Issue A instead would make the ancestry/file assertions fail.
      git(['switch', '-c', issueBBranch, liveMainSha], checkout)
      expect(git(['rev-parse', 'HEAD'], checkout)).toBe(liveMainSha)
      expect(git(['log', '--format=%H'], checkout).split('\n')).toEqual([liveMainSha])
      expect(() => git(['ls-files', '--error-unmatch', 'issue-a.txt'], checkout)).toThrow()
      expect(git(['status', '--porcelain=v1'], checkout)).toBe('')

      // Publish B normally, then read back every durable identity independently.
      git(['push', '-u', 'origin', issueBBranch], checkout)
      expect(git(['rev-parse', 'HEAD'], checkout)).toBe(liveMainSha)
      expect(git(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'], checkout)).toBe(`origin/${issueBBranch}`)
      expect(git(['rev-parse', `refs/remotes/origin/${issueBBranch}`], checkout)).toBe(liveMainSha)
      expect(git(['ls-remote', '--heads', 'origin', `refs/heads/${issueBBranch}`], checkout).split('\t')[0]).toBe(liveMainSha)
      expect(git(['ls-remote', '--heads', 'origin', 'refs/heads/main'], checkout).split('\t')[0]).toBe(liveMainSha)
      expect(git(['rev-parse', `refs/heads/${issueABranch}`], checkout)).toBe(issueACommit)
      expect(git(['ls-remote', '--heads', 'origin', `refs/heads/${issueABranch}`], checkout).split('\t')[0]).toBe(issueACommit)
      expect(git(['status', '--porcelain=v1'], checkout)).toBe('')
    } finally {
      rmSync(sandbox, { recursive: true, force: true })
    }
  })
})
