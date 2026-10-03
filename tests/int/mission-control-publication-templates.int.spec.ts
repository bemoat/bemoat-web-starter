import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { parse as parseYaml } from 'yaml'
import { describe, expect, it } from 'vitest'

import { parseIssueBody } from '../../scripts/context/issue-parser.ts'
import { parseBlockerResolutionRecord } from '../../scripts/context/blocker-resolution.ts'
import { parseProductionMergeReviewVerdict } from '../../scripts/context/merge-review-verdict.ts'
import { hasNativeReviewLineage } from '../../scripts/context/semantic-review-evidence.ts'
import { routeContext } from '../../scripts/context/router.ts'
import type { ActivePullRequestEvidence, NormalizedContextEvidence } from '../../scripts/context/model.ts'

const reviewTemplatePath = resolve('docs/mission-control/review-verdict-template.md')
const blockerTemplatePath = resolve('docs/mission-control/blocker-resolution-template.md')

async function markedExample(path: string, start: string, end: string): Promise<string> {
  const document = await readFile(path, 'utf8')
  const startIndex = document.indexOf(start)
  const endIndex = document.indexOf(end)
  if (startIndex < 0 || endIndex <= startIndex) throw new Error(`Missing marked example: ${start}`)
  return document.slice(startIndex + start.length, endIndex).trimStart().trimEnd()
}

describe('Mission Control publication templates', () => {
  it('feeds the canonical ELIGIBLE example through the production REVIEW_VERDICT parser', async () => {
    const body = await markedExample(
      reviewTemplatePath,
      '<!-- review-verdict:eligible:start -->',
      '<!-- review-verdict:eligible:end -->',
    )

    expect(parseProductionMergeReviewVerdict(body, '9001')).toMatchObject({
      verdict: 'ELIGIBLE FOR FOUNDER REVIEW',
      repository: 'boat1994/bemoat-web-starter',
      issue: '535',
      pr: '9002',
      base: 'main',
      reviewed_head: 'a'.repeat(40),
      supersedes_predecessor: null,
    })
  })

  it('feeds the canonical CORRECTION REQUIRED finding disposition through production review validation', async () => {
    const body = await markedExample(
      reviewTemplatePath,
      '<!-- review-verdict:correction:start -->',
      '<!-- review-verdict:correction:end -->',
    )
    const reviewUrl = 'https://github.com/boat1994/bemoat-web-starter/pull/9002#pullrequestreview-9003'
    const headSha = 'b'.repeat(40)
    const evidence = {
      repository: {
        owner: 'boat1994',
        name: 'bemoat-web-starter',
        nameWithOwner: 'boat1994/bemoat-web-starter',
        url: 'https://github.com/boat1994/bemoat-web-starter',
      },
      issue: { number: '535' },
      currentHeadVerification: {
        reviews: {
          nativeReviews: [{
            id: 9003,
            url: reviewUrl,
            state: 'CHANGES_REQUESTED',
            body,
            commitId: headSha,
          }],
        },
      },
    } as NormalizedContextEvidence
    const activePr = {
      number: '9002',
      baseBranch: 'main',
      headSha,
    } as ActivePullRequestEvidence

    expect(parseProductionMergeReviewVerdict(body, '9003')).toMatchObject({
      verdict: 'CORRECTION REQUIRED',
      issue: '535',
      pr: '9002',
      base: 'main',
      reviewed_head: headSha,
    })
    expect(hasNativeReviewLineage(reviewUrl, evidence, activePr, 'CORRECTION REQUIRED')).toBe(true)
  })

  it('parses canonical supersession and rejects both reproduced malformed identities', async () => {
    const template = await readFile(reviewTemplatePath, 'utf8')
    const supersession = await markedExample(
      reviewTemplatePath,
      '<!-- review-verdict:supersession:start -->',
      '<!-- review-verdict:supersession:end -->',
    )
    expect(parseProductionMergeReviewVerdict(supersession, '9004').supersedes_predecessor).toBe('9003')

    const eligible = await markedExample(
      reviewTemplatePath,
      '<!-- review-verdict:eligible:start -->',
      '<!-- review-verdict:eligible:end -->',
    )
    expect(template).toContain('Task: Issue #535')
    expect(() => parseProductionMergeReviewVerdict(
      eligible.replace('Task: Issue #535', 'Task: Issue #512 bounded loader correction'),
      '9001',
    )).toThrow(/Issue field is malformed/)
    expect(() => parseProductionMergeReviewVerdict(
      eligible.replace('`main` · `', 'main · '),
      '9001',
    )).toThrow(/PR \/ base \/ head field is malformed/)
  })

  it('parses the canonical BLOCKER_RESOLUTION example and rejects malformed identity or authority', async () => {
    const body = await markedExample(
      blockerTemplatePath,
      '<!-- blocker-resolution:example:start -->',
      '<!-- blocker-resolution:example:end -->',
    )
    const parsed = parseBlockerResolutionRecord(`${body}\n`)
    expect(parsed).toMatchObject({
      record_type: 'BLOCKER_RESOLUTION',
      repository: 'owner/repository',
      issue_number: '535',
      pr_number: '9002',
      blocker_id: 'missing-founder-decision',
      authority: { role: 'FOUNDER', login: 'founder-login' },
    })
    expect(parseBlockerResolutionRecord(`${body.replace('"repository": "owner/repository"', '"repository": ""')}\n`)).toBeNull()
    expect(parseBlockerResolutionRecord(`${body.replace('"role": "FOUNDER"', '"role": "REVIEWER"')}\n`)).toBeNull()
  })

  it('requires valid workflow metadata in the Issue Form and parses the rendered fields through Context', async () => {
    const form = parseYaml(await readFile(resolve('.github/ISSUE_TEMPLATE/agent-task.yml'), 'utf8')) as {
      body: Array<{ type: string; id?: string; attributes?: { label?: string; options?: string[] }; validations?: { required?: boolean } }>
    }
    const taskSize = form.body.find((field) => field.id === 'task_size')
    const mode = form.body.find((field) => field.id === 'mission_control_mode')
    expect(taskSize?.validations?.required).toBe(true)
    expect(taskSize?.attributes?.options).toEqual(['small', 'medium', 'core'])
    expect(mode?.validations?.required).toBe(true)
    expect(mode?.attributes?.options).toEqual(['required', 'optional', 'not required', 'unsure'])

    expect(parseIssueBody('### Task size\n\nsmall\n\n### Mission Control mode\n\noptional\n')).toMatchObject({
      taskSize: 'small',
      missionControlMode: 'optional',
      workflowProfile: 'FAST',
    })
    expect(parseIssueBody('Task size: core\nMission Control mode: required\n')).toMatchObject({
      taskSize: 'core',
      missionControlMode: 'required',
      workflowProfile: 'STANDARD',
    })
    expect(parseIssueBody('### Task size\n\nsmall\n\n### Mission Control mode\n\nunsure\n')).toMatchObject({
      workflowProfile: 'STANDARD',
    })
    expect(parseIssueBody('## Goal\n\nNo workflow declarations.\n')).toMatchObject({
      taskSize: null,
      missionControlMode: null,
      workflowProfile: null,
    })

    const missingMetadata = parseIssueBody('## Goal\n\nNo workflow declarations.\n')
    const decision = routeContext({
      repository: {
        owner: 'boat1994',
        name: 'bemoat-web-starter',
        nameWithOwner: 'boat1994/bemoat-web-starter',
        url: 'https://github.com/boat1994/bemoat-web-starter',
      },
      protectedBase: {
        branch: 'main',
        sha: 'c'.repeat(40),
        source: 'live GitHub ref',
        url: 'https://github.com/boat1994/bemoat-web-starter/tree/main',
      },
      policy: {
        path: 'docs/mission-control/mission-control-guide.md',
        policyId: 'bemoat-mission-control',
        version: '1.3.0',
        sourceSha: 'd'.repeat(40),
        trustedFounderLogin: 'boat1994',
        url: 'https://github.com/boat1994/bemoat-web-starter/blob/main/docs/mission-control/mission-control-guide.md',
      },
      issue: {
        number: '535',
        title: 'Missing workflow metadata',
        state: 'OPEN',
        url: 'https://github.com/boat1994/bemoat-web-starter/issues/535',
        objective: missingMetadata.objective,
        scope: missingMetadata.scope,
        acceptanceCriteria: missingMetadata.acceptanceCriteria,
        dependencies: missingMetadata.dependencies,
        taskSize: missingMetadata.taskSize,
        missionControlMode: missingMetadata.missionControlMode,
        workflowProfile: missingMetadata.workflowProfile,
      },
      localGit: {
        branch: 'fix/535-metadata-transport-templates',
        head: 'e'.repeat(40),
        upstream: 'origin/fix/535-metadata-transport-templates',
        originRepository: 'boat1994/bemoat-web-starter',
        clean: true,
        detached: false,
        pushed: true,
        durable: true,
        reasons: [],
      },
      activePr: null,
      currentHeadVerification: null,
      durableContext: { latestHandoff: null, historicalResults: [] },
      evidenceErrors: [],
    })
    expect(decision.route).toBe('STOP')
    expect(decision.reasons).toContain(
      'EVIDENCE_CONFLICT: Issue workflow profile cannot be derived from task size and Mission Control mode',
    )
  })

  it('wires canonical templates into consumed review and blocker instructions and API issue intake', async () => {
    const [reviewInstructions, blockerInstructions, index, intake] = await Promise.all([
      readFile(resolve('docs/agent-loop/role-handoff-contract.md'), 'utf8'),
      readFile(resolve('docs/mission-control/command-reference.md'), 'utf8'),
      readFile(resolve('docs/mission-control/README.md'), 'utf8'),
      readFile(resolve('docs/agent-loop/issue-intake-contract.md'), 'utf8'),
    ])

    expect(reviewInstructions).toContain('../mission-control/review-verdict-template.md')
    expect(blockerInstructions).toContain('blocker-resolution-template.md')
    expect(index).toContain('review-verdict-template.md')
    expect(index).toContain('blocker-resolution-template.md')
    expect(intake).toContain('Task size: small | medium | core')
    expect(intake).toContain('Mission Control mode: required | optional | not required | unsure')
    expect(intake).toContain('API')
  })
})
