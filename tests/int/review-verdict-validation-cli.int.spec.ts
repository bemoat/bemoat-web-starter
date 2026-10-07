import { describe, expect, it } from 'vitest'

import { runCliBoundaryCase } from '../helpers/cli-boundary-harness'
import { getCommandContract } from '../../scripts/cli/command-contract.ts'
import { parseProductionMergeReviewVerdict } from '../../scripts/context/merge-review-verdict.ts'
import { hasBlockingFinding } from '../../scripts/context/semantic-review-evidence.ts'

const COMMAND = 'bemoat:review-verdict:validate'
const ENTRYPOINT = 'scripts/agent-validate-review-verdict.ts'
const head = 'a'.repeat(40)
const baseSha = 'c'.repeat(40)
const finding = {
  id: 'REVIEW-597-001',
  canonical_summary: 'Correct the review verdict identity shape.',
  source_thread: 'https://github.com/boat1994/bemoat-web-starter/pull/9002#discussion_r9004',
  required_evidence: ['The canonical identity fields are present.'],
}

function candidate(verdict = 'ELIGIBLE FOR FOUNDER REVIEW', extras = ''): string {
  const disposition = verdict === 'CORRECTION REQUIRED'
    ? `\n\n### Immutable finding disposition\n\`\`\`json\n${JSON.stringify({ schema_version: 1, mode: 'implementation_pr', reviewed_head: head, findings: [finding] }, null, 2)}\n\`\`\``
    : ''
  return `## REVIEW_VERDICT

${extras}Repository: \`boat1994/bemoat-web-starter\`
Task: Issue #535
**Verdict:** ${verdict}
**PR / base / head:** PR #9002 · \`main\` · \`${head}\`
**Approved base:** \`main@${baseSha}\`${disposition}
`
}

function invoke(body: string) {
  return runCliBoundaryCase({
    entrypoint: ENTRYPOINT,
    argv: ['--body-file', 'candidate.md', '--json'],
    env: {
      BEMOAT_FACADE_COMMAND: COMMAND,
      BEMOAT_FACADE_ENTRYPOINT: ENTRYPOINT,
      npm_lifecycle_event: COMMAND,
    },
    files: { 'candidate.md': body },
  })
}

describe('REVIEW_VERDICT validation public CLI', () => {
  it('accepts a canonical eligible verdict as syntax only', () => {
    const result = invoke(candidate())

    expect(result.error).toBeNull()
    expect(result.status).toBe(0)
    expect(JSON.parse(result.stdout)).toMatchObject({
      command: COMMAND,
      classification: 'SUCCESS',
      mutation_performed: false,
      details: { validation_status: 'PASS' },
    })
    expect(JSON.parse(result.stdout)).not.toHaveProperty('route')
    expect(result.filesystem_unchanged).toBe(true)
    expect(result.poison_invocations).toEqual([])
  })

  it('accepts correction-required verdicts with the immutable finding contract', () => {
    const result = invoke(candidate('CORRECTION REQUIRED'))

    expect(result.error).toBeNull()
    expect(result.status).toBe(0)
    expect(JSON.parse(result.stdout)).toMatchObject({
      mutation_performed: false,
      details: { validation_status: 'PASS' },
    })
    expect(result.filesystem_unchanged).toBe(true)
    expect(result.poison_invocations).toEqual([])
  })

  it('accepts one parser-supported Supersedes field', () => {
    const result = invoke(candidate('ELIGIBLE FOR FOUNDER REVIEW', '**Supersedes:** 9003\n'))

    expect(result.error).toBeNull()
    expect(result.status).toBe(0)
    expect(JSON.parse(result.stdout).details.validation_status).toBe('PASS')
  })

  it.each([
    ['missing the canonical heading', candidate().replace('## REVIEW_VERDICT', '## REVIEW')],
    ['missing the approved base identity', candidate().replace(`**Approved base:** \`main@${baseSha}\`\n`, '')],
    ['using a partial base commit identity', candidate().replace(baseSha, 'main')],
    ['duplicating the task identity', candidate().replace('Task: Issue #535', 'Task: Issue #535\nTask: Issue #535')],
    ['adding a historical alternate task identity', candidate().replace('Task: Issue #535', 'Task: Issue #535\nTask / Issue: #535')],
    ['adding an empty duplicate Repository field', candidate().replace('Repository: `boat1994/bemoat-web-starter`', 'Repository: `boat1994/bemoat-web-starter`\nRepository:')],
    ['adding an empty duplicate Verdict field', candidate().replace('**Verdict:** ELIGIBLE FOR FOUNDER REVIEW', '**Verdict:** ELIGIBLE FOR FOUNDER REVIEW\n**Verdict:**')],
    ['adding a partial alternate Approved base field', candidate().replace('**Approved base:** `main@' + baseSha + '`', '**Approved base:** `main@' + baseSha + '`\nApproved base: main')],
    ['duplicating the Supersedes field', candidate('ELIGIBLE FOR FOUNDER REVIEW', '**Supersedes:** 9003\n**Supersedes:** 9003\n')],
    ['using a list-prefixed malformed Supersedes field', candidate('ELIGIBLE FOR FOUNDER REVIEW', '- **Supersedes:** invalid\n')],
    ['using an indented list-prefixed Supersedes alias', candidate('ELIGIBLE FOR FOUNDER REVIEW', '  + __Supersedes predecessor__: invalid\n')],
    ['duplicating Supersedes with a list-prefixed field', candidate('ELIGIBLE FOR FOUNDER REVIEW', '**Supersedes:** 9003\n- **Supersedes:** 9004\n')],
    ['adding an indented alternate PR field', candidate().replace('Task: Issue #535', 'Task: Issue #535\n  **PR:** PR #9002')],
    ['adding a list-prefixed historical Branch field', candidate().replace('Task: Issue #535', 'Task: Issue #535\n- **Branch:** fix/535-review')],
    ['using an unsupported verdict', candidate('APPROVED')],
    ['omitting immutable findings for a correction', candidate('CORRECTION REQUIRED').replace(/\n\n### Immutable finding disposition[\s\S]*$/, '')],
  ])('returns deterministic FAIL for a body %s without mutation or route creation', (_story, body) => {
    const first = invoke(body)
    const second = invoke(body)

    expect(first.error).toBeNull()
    expect(first.status).toBe(2)
    expect(JSON.parse(first.stdout)).toMatchObject({
      command: COMMAND,
      classification: 'INVALID_INVOCATION',
      mutation_performed: false,
      details: { validation_status: 'FAIL' },
    })
    expect(JSON.parse(first.stdout)).not.toHaveProperty('route')
    expect(second.stdout).toBe(first.stdout)
    expect(first.filesystem_unchanged).toBe(true)
    expect(first.poison_invocations).toEqual([])
  })

  it('keeps ordinary Context parsing tolerant of historical repeated identity fields', () => {
    const historical = `## REVIEW_VERDICT
### Review identity
- Task / Issue: #434

**Task / Issue:** #434
**Repository:** \`boat1994/bemoat-web-starter\`
**PR / base / head:** PR #435 · \`main\` · \`${head}\`
**Verdict:** ELIGIBLE FOR FOUNDER REVIEW`

    expect(parseProductionMergeReviewVerdict(historical, '5426416809').issue).toBe('434')
  })

  it('preserves Context finding compatibility for records without mode and with legacy extra fields', () => {
    const legacyRecord = {
      schema_version: 1,
      reviewed_head: head,
      findings: [finding],
      retained_context_metadata: 'historical record',
    }
    const disposition = `### Immutable finding disposition\n\`\`\`json\n${JSON.stringify(legacyRecord)}\n\`\`\``
    const historicalContextBody = `## REVIEW_VERDICT\n\n${disposition}`
    const strictCandidateBody = candidate('CORRECTION REQUIRED').replace(
      /### Immutable finding disposition[\s\S]*$/, disposition,
    )

    expect(hasBlockingFinding(historicalContextBody, head)).toBe(true)
    expect(invoke(strictCandidateBody).status).toBe(2)
  })

  it('exposes machine-readable safe help for a read-only command contract', () => {
    const result = runCliBoundaryCase({
      entrypoint: ENTRYPOINT,
      argv: ['--help', '--json'],
      env: {
        BEMOAT_FACADE_COMMAND: COMMAND,
        BEMOAT_FACADE_ENTRYPOINT: ENTRYPOINT,
        npm_lifecycle_event: COMMAND,
      },
    })

    expect(result.error).toBeNull()
    expect(result.status).toBe(0)
    expect(JSON.parse(result.stdout)).toMatchObject({
      command: COMMAND,
      mode: 'help',
      classification: 'HELP',
      writes: [],
      required_inputs: [{ name: 'body_file' }],
    })
    expect(getCommandContract(COMMAND)).toMatchObject({
      command: COMMAND,
      entrypoint: ENTRYPOINT,
      writes: [],
      help_meaningful: true,
      safe_help_invocation: `pnpm run ${COMMAND} -- --help --json`,
    })
    expect(result.filesystem_unchanged).toBe(true)
    expect(result.poison_invocations).toEqual([])
  })
})
