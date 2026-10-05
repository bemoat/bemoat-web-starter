import { describe, expect, it } from 'vitest'

import { readNativeReviewAncestryProofs } from '../../scripts/context/native-review-lineage.ts'
import type { ContextCommandRunner } from '../../scripts/context/runtime.ts'
import type { NativeReviewEvidence } from '../../scripts/context/model.ts'

const predecessorHead = '3ae88e8dd78568de963edca6f68f189066d42ab2'
const currentHead = 'c1dfd217f85df66c504464a2f08ded7e372bc94e'

function reviews(): NativeReviewEvidence[] {
  return [
    {
      id: 5409743181,
      url: 'https://github.com/boat1994/bemoat-web-starter/pull/555#pullrequestreview-5409743181',
      state: 'CHANGES_REQUESTED',
      commitId: predecessorHead,
      body: `## REVIEW_VERDICT
Repository: \`boat1994/bemoat-web-starter\`
Task: Issue #554
**PR / base / head:** PR #555 · \`main\` · \`${predecessorHead}\`
**Verdict:** CORRECTION REQUIRED

### Immutable finding disposition
\`\`\`json
{ "schema_version": 1, "mode": "implementation_pr", "reviewed_head": "${predecessorHead}", "findings": [{ "id": "REVIEW-554-001", "canonical_summary": "Apply the requested correction.", "source_thread": "https://github.com/boat1994/bemoat-web-starter/pull/555", "required_evidence": ["The correction is present."] }] }
\`\`\``
    },
    {
      id: 5409895399,
      url: 'https://github.com/boat1994/bemoat-web-starter/pull/555#pullrequestreview-5409895399',
      state: 'COMMENTED',
      commitId: currentHead,
      body: `## REVIEW_VERDICT
**Supersedes:** 5409743181
Repository: \`boat1994/bemoat-web-starter\`
Task: Issue #554
**PR / base / head:** PR #555 · \`main\` · \`${currentHead}\`
**Verdict:** ELIGIBLE FOR FOUNDER REVIEW`
    },
  ]
}

describe('native review ancestry evidence', () => {
  it('reads GitHub compare only for the explicitly named submitted predecessor', () => {
    const calls: string[][] = []
    const run: ContextCommandRunner = (_command, args) => {
      calls.push([...args])
      return {
        status: 0,
        stdout: JSON.stringify({
          status: 'ahead',
          ahead_by: 1,
          behind_by: 0,
          base_commit: { sha: predecessorHead },
          head_commit: { sha: currentHead },
          merge_base_commit: { sha: predecessorHead },
        }),
        stderr: '',
        error: null,
      }
    }

    const proofs = readNativeReviewAncestryProofs({
      reviews: reviews(),
      repository: 'boat1994/bemoat-web-starter',
      issue: '554',
      pr: '555',
      base: 'main',
      currentHead,
      run,
      cwd: '/repo',
      env: process.env,
    })

    expect(calls).toEqual([['api', `repos/boat1994/bemoat-web-starter/compare/${predecessorHead}...${currentHead}`]])
    expect(proofs).toEqual([{
      predecessorReviewId: 5409743181,
      predecessorHeadSha: predecessorHead,
      currentHeadSha: currentHead,
      status: 'ahead',
      mergeBaseSha: predecessorHead,
      aheadBy: 1,
      behindBy: 0,
    }])
  })

  it('binds the requested current head from the complete compare commits when head_commit is null', () => {
    const run: ContextCommandRunner = () => ({
      status: 0,
      stdout: JSON.stringify({
        status: 'ahead',
        ahead_by: 1,
        behind_by: 0,
        base_commit: { sha: predecessorHead },
        head_commit: null,
        merge_base_commit: { sha: predecessorHead },
        commits: [{ sha: currentHead }],
      }),
      stderr: '',
      error: null,
    })

    expect(readNativeReviewAncestryProofs({
      reviews: reviews(),
      repository: 'boat1994/bemoat-web-starter',
      issue: '554',
      pr: '555',
      base: 'main',
      currentHead,
      run,
      cwd: '/repo',
      env: process.env,
    })).toEqual([{
      predecessorReviewId: 5409743181,
      predecessorHeadSha: predecessorHead,
      currentHeadSha: currentHead,
      status: 'ahead',
      mergeBaseSha: predecessorHead,
      aheadBy: 1,
      behindBy: 0,
    }])
  })

  const unavailableCompareCases: Array<[string, ContextCommandRunner]> = [
    ['unavailable response', () => ({ status: 1, stdout: '', stderr: 'unavailable', error: null })],
    ['ambiguous compare endpoints', () => ({
      status: 0,
      stdout: JSON.stringify({ status: 'ahead', ahead_by: 1, behind_by: 0, base_commit: { sha: 'd'.repeat(40) }, head_commit: { sha: currentHead }, merge_base_commit: { sha: predecessorHead } }),
      stderr: '',
      error: null,
    })],
    ['malformed merge-base SHA', () => ({
      status: 0,
      stdout: JSON.stringify({ status: 'ahead', ahead_by: 1, behind_by: 0, base_commit: { sha: predecessorHead }, head_commit: { sha: currentHead }, merge_base_commit: { sha: 'not-a-sha' } }),
      stderr: '',
      error: null,
    })],
    ['non-integer ahead count', () => ({
      status: 0,
      stdout: JSON.stringify({ status: 'ahead', ahead_by: 1.5, behind_by: 0, base_commit: { sha: predecessorHead }, head_commit: { sha: currentHead }, merge_base_commit: { sha: predecessorHead } }),
      stderr: '',
      error: null,
    })],
    ['missing compare result fields', () => ({
      status: 0,
      stdout: JSON.stringify({ status: 'ahead', ahead_by: 1, behind_by: 0, base_commit: { sha: predecessorHead } }),
      stderr: '',
      error: null,
    })],
    ['incomplete compare commits', () => ({
      status: 0,
      stdout: JSON.stringify({ status: 'ahead', ahead_by: 2, behind_by: 0, base_commit: { sha: predecessorHead }, head_commit: null, merge_base_commit: { sha: predecessorHead }, commits: [{ sha: currentHead }] }),
      stderr: '',
      error: null,
    })],
    ['compare commits ending at another head', () => ({
      status: 0,
      stdout: JSON.stringify({ status: 'ahead', ahead_by: 1, behind_by: 0, base_commit: { sha: predecessorHead }, head_commit: null, merge_base_commit: { sha: predecessorHead }, commits: [{ sha: 'd'.repeat(40) }] }),
      stderr: '',
      error: null,
    })],
    ['ambiguous duplicate compare commits', () => ({
      status: 0,
      stdout: JSON.stringify({ status: 'ahead', ahead_by: 2, behind_by: 0, base_commit: { sha: predecessorHead }, head_commit: null, merge_base_commit: { sha: predecessorHead }, commits: [{ sha: currentHead }, { sha: currentHead }] }),
      stderr: '',
      error: null,
    })],
  ]
  it.each(unavailableCompareCases)('returns no ancestry proof for %s', (_label, run) => {
    expect(readNativeReviewAncestryProofs({
      reviews: reviews(),
      repository: 'boat1994/bemoat-web-starter',
      issue: '554',
      pr: '555',
      base: 'main',
      currentHead,
      run,
      cwd: '/repo',
      env: process.env,
    })).toEqual([])
  })
})
