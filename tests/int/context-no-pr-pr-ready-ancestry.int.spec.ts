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

function graphEvidenceRunner({ cwd, baseSha, liveBaseSha, headSha, compareMutation }: {
  cwd: string
  baseSha: string
  liveBaseSha: string
  headSha: string
  compareMutation?: 'diverged' | 'behind' | 'zero-ahead' | 'wrong-base' | 'wrong-merge-base'
}): { run: ContextCommandRunner; compareCalls: string[]; ancestry: Record<string, unknown> } {
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
    if (args[0] === 'pr' && args[1] === 'list') return response('[]')
    if (key === `api repos/${repository}/branches/main/protection`) return response('{}')
    return response('')
  }

  return { run, compareCalls, ancestry }
}

function runAncestryScenario(compareMutation?: Parameters<typeof graphEvidenceRunner>[0]['compareMutation']) {
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

    const { run, compareCalls, ancestry } = graphEvidenceRunner({ cwd, baseSha, liveBaseSha, headSha, compareMutation })
    const evidence = collectContextEvidence({
      cwd,
      issueNumber,
      env: { GH_REPO: repository, NODE_ENV: 'test', PAYLOAD_SECRET: 'test-only-secret' },
      run,
    })
    return { evidence, decision: routeContext(evidence), compareCalls, ancestry, baseSha, liveBaseSha, headSha }
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
