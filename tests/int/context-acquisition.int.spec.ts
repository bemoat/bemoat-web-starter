import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { collectContextEvidence, readLocalGitEvidence, type ContextCommandResult, type ContextCommandRunner } from '../../scripts/context/evidence.ts'
import { readHistoricalNoPrFounderGateReplayProofs } from '../../scripts/context/founder-gate-history.ts'
import { parseRoleEvidence } from '../../scripts/context/issue-parser.ts'
import type { NormalizedContextEvidence, PolicyEvidence, RoleEvidence } from '../../scripts/context/model.ts'
import { parseProtectedPolicyContent } from '../../scripts/context/policy.ts'
import { readHistoricalBlockerResolutionProofs } from '../../scripts/context/blocker-resolution-history.ts'

const repo = 'example/project'
const branch = 'fix/context'
const head = 'a'.repeat(40)
const cwd = '/canonical/checkout'

function ok(stdout = ''): ContextCommandResult {
  return { status: 0, stdout, stderr: '', error: null }
}

function failed(message = 'not a git repository'): ContextCommandResult {
  return { status: 128, stdout: '', stderr: message, error: null }
}

function localRunner(overrides: Record<string, ContextCommandResult> = {}): ContextCommandRunner {
  const values: Record<string, ContextCommandResult> = {
    'branch --show-current': ok(`${branch}\n`),
    'rev-parse HEAD': ok(`${head}\n`),
    'status --short': ok(),
    'rev-parse --abbrev-ref --symbolic-full-name @{upstream}': ok(`origin/${branch}\n`),
    'remote get-url origin': ok(`https://github.com/${repo}.git\n`),
    [`ls-remote --heads origin ${branch}`]: ok(`${head}\trefs/heads/${branch}\n`),
    ...overrides,
  }
  return (command, args, options) => {
    expect(options?.cwd).toBe(cwd)
    if (command === 'git') return values[args.join(' ')] ?? failed('unexpected Git command')
    return failed('GitHub unavailable')
  }
}

describe('Context evidence acquisition at the process boundary', () => {
  it('acquires the exact #582 consumed-gate replay from native comments and current GitHub compare responses', () => {
    // Oracle: #606 Founder-approved historical replay protocol §§1–7 requires
    // the exact immutable #582 gate, its repaired malformed predecessor, same
    // repository/Issue/branch identity, historical and current policy snapshots,
    // and strict A→B plus protected-base ancestry. This fixture contains the
    // three native #582 comments verbatim and policy snapshots at A and B.
    const fixture = (name: string) => join(process.cwd(), 'tests/fixtures/context/historical-founder-gate-582', name)
    const comments = ['6014391169.json', '6037687449.json', '6039589978.json'].map((name) =>
      JSON.parse(readFileSync(fixture(name), 'utf8')) as RoleEvidence,
    )
    const parsed = parseRoleEvidence(comments)
    expect(parsed.handoffs.map((item) => String(item.id))).toEqual(['6014391169'])
    const historicalHead = '8889e1898d5d20833143bc568f325175ee46956b'
    const historicalBase = '46fe5363697cb24f0db5a6d4338a5540665bb697'
    const currentHead = '963b2e9a91bf3c5b9b1d3e641e42233ba1b4d0f2'
    const currentBase = 'e3f5f7f4408d810dea0993e2b5ae7a1739d1bbc3'
    const historicalPolicySha = '35f3ab438724a79c377a964747cb5bd5d9d040c5'
    const currentPolicySha = 'd587ff2c6ac4a314b193e321613c3299c83b6da5'
    const historicalPolicyContent = readFileSync(fixture('policy-at-A.md'), 'utf8')
    const currentPolicyContent = readFileSync(fixture('policy-at-B.md'), 'utf8')
    const currentPolicy = parseProtectedPolicyContent({
      repo: 'bemoat/bemoat-web-starter', branch: 'main', sha: currentPolicySha, content: currentPolicyContent,
    })!
    const evidence: NormalizedContextEvidence = {
      repository: { owner: 'bemoat', name: 'bemoat-web-starter', nameWithOwner: 'bemoat/bemoat-web-starter', url: 'https://github.com/bemoat/bemoat-web-starter' },
      protectedBase: { branch: 'main', sha: currentBase, source: 'live GitHub ref', url: 'https://github.com/bemoat/bemoat-web-starter/tree/main' },
      policy: currentPolicy,
      issue: { number: '582', title: 'fix(context): preserve durable Mission Control identity across repository transfer', state: 'OPEN', url: 'https://github.com/bemoat/bemoat-web-starter/issues/582', objective: null, scope: null, acceptanceCriteria: [], dependencies: [], taskSize: 'core', missionControlMode: 'required', workflowProfile: 'STANDARD' },
      localGit: { branch: 'fix/582-repository-transfer-identity', head: currentHead, upstream: 'origin/fix/582-repository-transfer-identity', originRepository: 'bemoat/bemoat-web-starter', clean: true, detached: false, pushed: true, durable: true, reasons: [] },
      activePr: null,
      currentHeadVerification: null,
      durableContext: {
        latestHandoff: parsed.latestHandoff,
        handoffs: parsed.handoffs,
        historicalResults: parsed.historicalResults,
        founderDecisions: parsed.founderDecisions,
        invalidFounderDecisions: parsed.invalidFounderDecisions,
        founderDecisionRepairs: parsed.founderDecisionRepairs,
        invalidFounderDecisionRepairs: parsed.invalidFounderDecisionRepairs,
      },
      evidenceErrors: [],
    }
    const compareFacts = new Map([
      [`${historicalBase}...${currentBase}`, { status: 'ahead', ahead_by: 8, behind_by: 0, base_commit: { sha: historicalBase }, merge_base_commit: { sha: historicalBase } }],
      [`${historicalHead}...${historicalBase}`, { status: 'ahead', ahead_by: 27, behind_by: 0, base_commit: { sha: historicalHead }, merge_base_commit: { sha: historicalHead } }],
      [`${historicalHead}...${currentHead}`, { status: 'ahead', ahead_by: 28, behind_by: 0, base_commit: { sha: historicalHead }, merge_base_commit: { sha: historicalHead } }],
    ])
    const calls: string[] = []
    const run: ContextCommandRunner = (_command, args) => {
      const endpoint = args.find((arg) => arg.startsWith('repos/')) ?? ''
      calls.push(endpoint)
      if (endpoint === `repos/bemoat/bemoat-web-starter/contents/docs/mission-control/mission-control-guide.md?ref=${historicalBase}`) {
        return ok(JSON.stringify({ type: 'file', path: 'docs/mission-control/mission-control-guide.md', sha: historicalPolicySha, encoding: 'base64', content: Buffer.from(historicalPolicyContent).toString('base64') }))
      }
      const compare = endpoint.match(/\/compare\/(.+)$/)?.[1]
      if (compare && compareFacts.has(compare)) {
        // GitHub's live compare response has base_commit and merge_base_commit,
        // but no head_commit property. Keep this production response shape exact.
        return ok(JSON.stringify(compareFacts.get(compare)))
      }
      return failed(`unexpected GitHub endpoint ${endpoint}`)
    }

    const proofs = readHistoricalNoPrFounderGateReplayProofs({ evidence, run, cwd: '/repo', env: process.env })

    expect(currentPolicy.allowHistoricalNoPrFounderGateReplay).toBe(true)
    expect(parsed.founderDecisions).toHaveLength(1)
    expect(parsed.founderDecisionRepairs).toHaveLength(1)
    expect(calls).toEqual(expect.arrayContaining([
      `repos/bemoat/bemoat-web-starter/contents/docs/mission-control/mission-control-guide.md?ref=${historicalBase}`,
      ...[...compareFacts.keys()].map((pair) => `repos/bemoat/bemoat-web-starter/compare/${pair}`),
    ]))
    expect(proofs).toHaveLength(1)
    expect(proofs[0]).toMatchObject({
      repository: 'bemoat/bemoat-web-starter', issue_number: '582',
      branch: 'fix/582-repository-transfer-identity', historical_head: historicalHead, current_head: currentHead,
      source_gate: { comment_id: '6014391169' }, source_decision: { comment_id: '6037687449' },
      source_repair: { comment_id: '6039589978' },
    })
  })

  it('acquires a transient historical proof from exact snapshot blobs and verified compare facts', () => {
    const repo = 'boat1994/bemoat-web-starter'
    const historicalSha = '1'.repeat(40)
    const currentSha = '2'.repeat(40)
    const guide = '---\npolicy_id: bemoat-mission-control\nversion: 1.3.0\ncanonical_repository: boat1994/bemoat-web-starter\ntrusted_founder_login: boat1994\n---\n'
    const commandReference = '# Mission Control Commands\n'
    const body = `## BLOCKER_RESOLUTION\n\n\`\`\`json\n${JSON.stringify({
      schema_version: 1,
      record_type: 'BLOCKER_RESOLUTION',
      repository: repo,
      issue_number: '520',
      pr_number: '521',
      exact_head: '3'.repeat(40),
      protected_base: { branch: 'main', sha: historicalSha },
      policy: { path: 'docs/mission-control/mission-control-guide.md', policy_id: 'bemoat-mission-control', version: '1.3.0', source_sha: 'a'.repeat(40) },
      source_stop_handoff: { comment_id: '100', url: 'https://github.com/boat1994/bemoat-web-starter/issues/520#issuecomment-100' },
      blocker_id: 'approved-blocker',
      authority: { role: 'FOUNDER', login: 'boat1994' },
    }, null, 2)}\n\`\`\`\n`
    const resolution: RoleEvidence = { id: '200', body, createdAt: '', url: 'https://github.com/boat1994/bemoat-web-starter/issues/520#issuecomment-200', authorLogin: 'boat1994', authorAssociation: 'OWNER' }
    const policy: PolicyEvidence = {
      path: 'docs/mission-control/mission-control-guide.md', policyId: 'bemoat-mission-control', version: '1.3.0', sourceSha: 'a'.repeat(40),
      trustedFounderLogin: 'boat1994', legacyStopHandoffs: [], url: `https://github.com/${repo}/blob/${currentSha}/docs/mission-control/mission-control-guide.md`,
    }
    const calls: string[] = []
    const run: ContextCommandRunner = (_command, args) => {
      const endpoint = args.find((arg) => arg.startsWith('repos/')) ?? ''
      calls.push(endpoint)
      if (endpoint === `repos/${repo}/contents/docs/mission-control/mission-control-guide.md?ref=${historicalSha}`) return ok(JSON.stringify({ type: 'file', path: 'docs/mission-control/mission-control-guide.md', sha: 'a'.repeat(40), encoding: 'base64', content: Buffer.from(guide).toString('base64') }))
      if (endpoint === `repos/${repo}/contents/docs/mission-control/mission-control-guide.md?ref=${currentSha}`) return ok(JSON.stringify({ type: 'file', path: 'docs/mission-control/mission-control-guide.md', sha: 'a'.repeat(40), encoding: 'base64', content: Buffer.from(guide).toString('base64') }))
      if (endpoint === `repos/${repo}/contents/docs/mission-control/command-reference.md?ref=${historicalSha}`) return ok(JSON.stringify({ type: 'file', path: 'docs/mission-control/command-reference.md', sha: 'b'.repeat(40), encoding: 'base64', content: Buffer.from(commandReference).toString('base64') }))
      if (endpoint === `repos/${repo}/contents/docs/mission-control/command-reference.md?ref=${currentSha}`) return ok(JSON.stringify({ type: 'file', path: 'docs/mission-control/command-reference.md', sha: 'b'.repeat(40), encoding: 'base64', content: Buffer.from(commandReference).toString('base64') }))
      if (endpoint === `repos/${repo}/compare/${historicalSha}...${currentSha}`) return ok(JSON.stringify({
        status: 'ahead', ahead_by: 2, behind_by: 0,
        base_commit: { sha: historicalSha }, merge_base_commit: { sha: historicalSha },
      }))
      return failed(`unexpected GitHub endpoint ${endpoint}`)
    }

    const proofs = readHistoricalBlockerResolutionProofs({
      repo, currentBase: { branch: 'main', sha: currentSha }, policy, resolutions: [resolution], run,
    })

    expect(proofs).toHaveLength(1)
    expect(proofs[0]).toMatchObject({
      resolutionCommentId: '200', repository: repo,
      historicalBase: { branch: 'main', sha: historicalSha }, currentBase: { branch: 'main', sha: currentSha },
      historicalPolicy: { path: policy.path, policyId: policy.policyId, version: policy.version, sourceSha: 'a'.repeat(40), trustedFounderLogin: 'boat1994' },
      historicalContractBlobs: { missionControlGuideSha: 'a'.repeat(40), commandReferenceSha: 'b'.repeat(40) },
      currentContractBlobs: { missionControlGuideSha: 'a'.repeat(40), commandReferenceSha: 'b'.repeat(40) },
      ancestry: { status: 'ahead', baseSha: historicalSha, currentSha, mergeBaseSha: historicalSha, aheadBy: 2, behindBy: 0 },
    })
    expect(proofs[0]?.resolutionBodySha256).toMatch(/^[0-9a-f]{64}$/)
    expect(calls).toEqual(expect.arrayContaining([
      `repos/${repo}/contents/docs/mission-control/mission-control-guide.md?ref=${historicalSha}`,
      `repos/${repo}/contents/docs/mission-control/mission-control-guide.md?ref=${currentSha}`,
      `repos/${repo}/contents/docs/mission-control/command-reference.md?ref=${historicalSha}`,
      `repos/${repo}/contents/docs/mission-control/command-reference.md?ref=${currentSha}`,
      `repos/${repo}/compare/${historicalSha}...${currentSha}`,
    ]))
  })

  it('omits a candidate proof when the exact compare facts are unavailable or malformed', () => {
    const repo = 'boat1994/bemoat-web-starter'
    const oldSha = '1'.repeat(40)
    const currentSha = '2'.repeat(40)
    const body = `## BLOCKER_RESOLUTION\n\n\`\`\`json\n${JSON.stringify({
      schema_version: 1, record_type: 'BLOCKER_RESOLUTION', repository: repo, issue_number: '520', pr_number: '521', exact_head: '3'.repeat(40),
      protected_base: { branch: 'main', sha: oldSha }, policy: { path: 'docs/mission-control/mission-control-guide.md', policy_id: 'id', version: '1', source_sha: 'a'.repeat(40) },
      source_stop_handoff: { comment_id: '100', url: 'https://github.com/boat1994/bemoat-web-starter/issues/520#issuecomment-100' }, blocker_id: 'blocker', authority: { role: 'FOUNDER', login: 'boat1994' },
    }, null, 2)}\n\`\`\`\n`
    const resolution: RoleEvidence = { id: '200', body, createdAt: '', url: 'https://github.com/boat1994/bemoat-web-starter/issues/520#issuecomment-200', authorLogin: 'boat1994', authorAssociation: 'OWNER' }
    const policy: PolicyEvidence = { path: 'docs/mission-control/mission-control-guide.md', policyId: 'id', version: '1', sourceSha: 'a'.repeat(40), trustedFounderLogin: 'boat1994', url: '' }
    const run: ContextCommandRunner = (_command, args) => {
      const endpoint = args.find((arg) => arg.startsWith('repos/')) ?? ''
      if (endpoint.includes('/contents/')) {
        const content = endpoint.includes('mission-control-guide') ? '---\npolicy_id: id\nversion: 1\ncanonical_repository: boat1994/bemoat-web-starter\ntrusted_founder_login: boat1994\n---\n' : '# Commands\n'
        return ok(JSON.stringify({ type: 'file', path: endpoint.includes('guide') ? 'docs/mission-control/mission-control-guide.md' : 'docs/mission-control/command-reference.md', sha: endpoint.includes('guide') ? 'a'.repeat(40) : 'b'.repeat(40), encoding: 'base64', content: Buffer.from(content).toString('base64') }))
      }
      if (endpoint.includes('/compare/')) return ok(JSON.stringify({ status: 'ahead', ahead_by: '2', behind_by: 0, base_commit: { sha: oldSha }, merge_base_commit: { sha: oldSha } }))
      return failed('unexpected')
    }
    expect(readHistoricalBlockerResolutionProofs({ repo, currentBase: { branch: 'main', sha: currentSha }, policy, resolutions: [resolution], run })).toEqual([])
  })

  it('attaches proof facts to normalized Context evidence when its current PR has an old-base resolution', () => {
    const repo = 'boat1994/bemoat-web-starter'
    const historicalSha = '1'.repeat(40)
    const currentSha = '2'.repeat(40)
    const head = '3'.repeat(40)
    const guide = '---\npolicy_id: bemoat-mission-control\nversion: 1.3.0\ncanonical_repository: boat1994/bemoat-web-starter\ntrusted_founder_login: boat1994\n---\n'
    const commandReference = '# Mission Control Commands\n'
    const resolutionBody = `## BLOCKER_RESOLUTION\n\n\`\`\`json\n${JSON.stringify({
      schema_version: 1, record_type: 'BLOCKER_RESOLUTION', repository: repo, issue_number: '520', pr_number: '521', exact_head: head,
      protected_base: { branch: 'main', sha: historicalSha },
      policy: { path: 'docs/mission-control/mission-control-guide.md', policy_id: 'bemoat-mission-control', version: '1.3.0', source_sha: 'a'.repeat(40) },
      source_stop_handoff: { comment_id: '100', url: `https://github.com/${repo}/issues/520#issuecomment-100` },
      blocker_id: 'approved-blocker', authority: { role: 'FOUNDER', login: 'boat1994' },
    }, null, 2)}\n\`\`\`\n`
    const comments = [{
      url: `https://github.com/${repo}/issues/520#issuecomment-200`, body: resolutionBody,
      author: { login: 'boat1994' }, authorAssociation: 'OWNER', createdAt: '',
    }]
    const pr: Record<string, unknown> = {
      number: 521, state: 'OPEN', isDraft: false, url: `https://github.com/${repo}/pull/521`,
      baseRefName: 'main', baseRefOid: historicalSha, headRefName: 'fix/520-history', headRefOid: head,
      mergeCommit: null, statusCheckRollup: [],
    }
    const run: ContextCommandRunner = (command, args) => {
      const key = args.join(' ')
      if (command === 'git') {
        const local: Record<string, string> = {
          'branch --show-current': 'fix/520-history\n', 'rev-parse HEAD': `${head}\n`, 'status --short': '',
          'rev-parse --abbrev-ref --symbolic-full-name @{upstream}': 'origin/fix/520-history\n',
          'remote get-url origin': `https://github.com/${repo}.git\n`,
          'ls-remote --heads origin fix/520-history': `${head}\trefs/heads/fix/520-history\n`,
        }
        return ok(local[key] ?? '')
      }
      if (key.includes('git/ref/heads/dev')) return failed('Not Found')
      if (key.includes('git/ref/heads/main')) return ok(JSON.stringify({ object: { sha: currentSha } }))
      if (key.includes(`contents/docs/mission-control/mission-control-guide.md?ref=${currentSha}`)) return ok(JSON.stringify({
        type: 'file', path: 'docs/mission-control/mission-control-guide.md', sha: 'a'.repeat(40), encoding: 'base64', content: Buffer.from(guide).toString('base64'),
      }))
      if (key.startsWith('issue view 520 ')) return ok(JSON.stringify({
        number: 520, title: 'Historical resolution', state: 'OPEN', url: `https://github.com/${repo}/issues/520`,
        body: '## Goal\n\nExercise proof acquisition.\n', comments,
      }))
      if (key.startsWith('pr list ')) return ok(JSON.stringify([{
        number: 521, url: `https://github.com/${repo}/pull/521`, headRefName: 'fix/520-history', body: '', title: 'History',
        closingIssuesReferences: [{ number: 520, repository: { nameWithOwner: repo } }],
      }]))
      if (key.startsWith('pr view 521 ')) return ok(JSON.stringify(pr))
      if (key.includes('branches/main/protection')) return ok(JSON.stringify({}))
      if (key.includes('/pulls/521/reviews?per_page=100')) return ok(JSON.stringify([[]]))
      if (key.includes(`contents/docs/mission-control/mission-control-guide.md?ref=${historicalSha}`)) return ok(JSON.stringify({
        type: 'file', path: 'docs/mission-control/mission-control-guide.md', sha: 'a'.repeat(40), encoding: 'base64', content: Buffer.from(guide).toString('base64'),
      }))
      if (key.includes(`contents/docs/mission-control/command-reference.md?ref=${historicalSha}`) ||
          key.includes(`contents/docs/mission-control/command-reference.md?ref=${currentSha}`)) return ok(JSON.stringify({
        type: 'file', path: 'docs/mission-control/command-reference.md', sha: 'b'.repeat(40), encoding: 'base64', content: Buffer.from(commandReference).toString('base64'),
      }))
      if (key.includes(`compare/${historicalSha}...${currentSha}`)) return ok(JSON.stringify({
        status: 'ahead', ahead_by: 2, behind_by: 0, base_commit: { sha: historicalSha }, merge_base_commit: { sha: historicalSha },
      }))
      return failed(`unexpected command ${command} ${key}`)
    }

    const evidence = collectContextEvidence({ cwd: '/repo', issueNumber: '520', run, env: { ...process.env, GH_REPO: repo } })
    expect(evidence.historicalBlockerResolutionProofs).toHaveLength(1)
    expect(evidence.historicalBlockerResolutionProofs?.[0]).toMatchObject({
      resolutionCommentId: '200', historicalBase: { branch: 'main', sha: historicalSha },
      currentBase: { branch: 'main', sha: currentSha },
    })
  })

  it('A: retains a valid attached checkout and its independent Git identity', () => {
    expect(readLocalGitEvidence({ cwd, run: localRunner() })).toMatchObject({
      branch, head, upstream: `origin/${branch}`, originRepository: repo,
      clean: true, detached: false, pushed: true, durable: true,
    })
  })

  it('B: fails closed in a non-Git cwd', () => {
    const run = localRunner(Object.fromEntries([
      'branch --show-current', 'rev-parse HEAD', 'status --short',
      'rev-parse --abbrev-ref --symbolic-full-name @{upstream}', 'remote get-url origin',
    ].map((key) => [key, failed()])))
    const result = readLocalGitEvidence({ cwd, run })
    expect(result).toMatchObject({ head: null, detached: true, durable: false })
  })

  it('C: a true detached HEAD is never reported attached', () => {
    const result = readLocalGitEvidence({ cwd, run: localRunner({ 'branch --show-current': ok() }) })
    expect(result).toMatchObject({ branch: '<detached>', head, detached: true, durable: false })
  })

  it('D: a true missing upstream remains non-durable', () => {
    const result = readLocalGitEvidence({ cwd, run: localRunner({
      'rev-parse --abbrev-ref --symbolic-full-name @{upstream}': failed('no upstream'),
    }) })
    expect(result).toMatchObject({ branch, head, upstream: null, durable: false })
  })

  // Authority: the #585 setup-recovery contract requires a provably clean
  // checkout before fetch; a failed status read is unavailable evidence, not
  // proof that the worktree is clean.
  it('fails closed when git status cannot establish worktree cleanliness', () => {
    const result = readLocalGitEvidence({ cwd, run: localRunner({
      'status --short': failed('permission denied'),
    }) })

    expect(result).toMatchObject({ clean: false, durable: false })
    expect(result.reasons.join(' ')).toMatch(/status.*failed.*cleanliness.*unavailable/i)
  })

  it('E: GitHub failure does not erase independently successful local Git identity', () => {
    const evidence = collectContextEvidence({ cwd, issueNumber: '7', run: localRunner(), env: { ...process.env, GH_REPO: undefined } })
    expect(evidence.localGit).toMatchObject({ branch, head, originRepository: repo, durable: true })
    expect(evidence.repository.nameWithOwner).toBe(repo)
    expect(evidence.evidenceErrors.join(' ')).toContain('BLOCKED_EXTERNAL')
  })

  it('F: a contradictory zero-exit result with an EPERM marker remains fail-closed', () => {
    const anomaly = (stdout: string): ContextCommandResult => ({
      status: 0, stdout, stderr: '', error: Object.assign(new Error('spawnSync git EPERM'), { code: 'EPERM' }),
    })
    const result = readLocalGitEvidence({ cwd, run: localRunner({
      'branch --show-current': anomaly(`${branch}\n`),
      'rev-parse HEAD': anomaly(`${head}\n`),
      'remote get-url origin': anomaly(`https://github.com/${repo}.git\n`),
    }) })
    expect(result).toMatchObject({ branch: '<detached>', head: null, originRepository: null, durable: false })
  })

  it('G: one failed Git acquisition does not erase unrelated successful fields', () => {
    const result = readLocalGitEvidence({ cwd, run: localRunner({
      'rev-parse HEAD': failed('HEAD unavailable'),
    }) })
    expect(result).toMatchObject({ branch, head: null, originRepository: repo, durable: false })
  })
})
