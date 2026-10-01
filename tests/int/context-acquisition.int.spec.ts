import { describe, expect, it } from 'vitest'

import { collectContextEvidence, readLocalGitEvidence, type ContextCommandResult, type ContextCommandRunner } from '../../scripts/context/evidence.ts'
import { readHistoricalBlockerResolutionProofs } from '../../scripts/context/blocker-resolution-history.ts'
import type { PolicyEvidence, RoleEvidence } from '../../scripts/context/model.ts'

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
