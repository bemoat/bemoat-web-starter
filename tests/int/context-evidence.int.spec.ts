import { describe, expect, it } from 'vitest'

import {
  collectContextEvidence,
  readGithubEvidence,
  readLocalGitEvidence,
  readProtectedPolicy,
  type ContextCommandResult,
  type ContextCommandRunner,
} from '../../scripts/context/evidence.ts'

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

describe('bemoat:context neutral evidence adapters', () => {
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
    const policy = '---\npolicy_id: bemoat-mission-control\nversion: 1.3.0\n---\n\n# Guide\n'
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
        sourceSha: 'c'.repeat(40),
        url: 'https://github.com/boat1994/bemoat-web-starter/blob/' + 'a'.repeat(40) + '/docs/mission-control/mission-control-guide.md',
      },
      errors: [],
    })
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
