import { describe, expect, it } from 'vitest'

import { runCliBoundaryCase } from '../helpers/cli-boundary-harness'

const COMMAND = 'bemoat:blocker-resolution:validate'
const ENTRYPOINT = 'scripts/agent-validate-blocker-resolution.ts'

/**
 * Semantic oracle: the canonical BLOCKER_RESOLUTION template specifies the
 * complete `## BLOCKER_RESOLUTION` body, JSON fence, indentation, and final
 * newline. The command reference calls for validating a complete candidate
 * body with the production parser. Issue #590 requires the public validator
 * to reject invalid bodies deterministically without mutation or a Context
 * route. These cases vary only those documented body-format requirements;
 * they do not infer live authority from a syntactically valid record.
 */

const schemaV1: Record<string, unknown> = {
  schema_version: 1,
  record_type: 'BLOCKER_RESOLUTION',
  repository: 'owner/repository',
  issue_number: '410',
  pr_number: '411',
  exact_head: '0123456789abcdef0123456789abcdef01234567',
  protected_base: {
    branch: 'main',
    sha: '89abcdef0123456789abcdef0123456789abcdef',
  },
  policy: {
    path: 'docs/mission-control/mission-control-guide.md',
    policy_id: 'bemoat-mission-control',
    version: '1.3.0',
    source_sha: '1234567890abcdef1234567890abcdef12345678',
  },
  source_stop_handoff: {
    comment_id: '123456789',
    url: 'https://github.com/owner/repository/issues/410#issuecomment-123456789',
  },
  blocker_id: 'architecture-decision',
  authority: {
    role: 'FOUNDER',
    login: 'founder-login',
  },
}

const schemaV2: Record<string, unknown> = {
  schema_version: 2,
  record_type: 'BLOCKER_RESOLUTION',
  repository: 'owner/repository',
  issue_number: '535',
  pr_number: null,
  branch: 'fix/535-no-pr-stop',
  exact_head: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  protected_base: {
    branch: 'main',
    sha: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  },
  policy: {
    path: 'docs/mission-control/mission-control-guide.md',
    policy_id: 'bemoat-mission-control',
    version: '1.4.0',
    source_sha: 'cccccccccccccccccccccccccccccccccccccccc',
  },
  source_stop_handoff: {
    comment_id: '9005',
    url: 'https://github.com/owner/repository/issues/535#issuecomment-9005',
  },
  blocker_id: 'missing-founder-decision',
  authority: {
    role: 'FOUNDER',
    login: 'founder-login',
  },
}

function canonicalBody(record: Record<string, unknown>): string {
  return `## BLOCKER_RESOLUTION\n\n\`\`\`json\n${JSON.stringify(record, null, 2)}\n\`\`\`\n`
}

function invoke(candidate: string) {
  return runCliBoundaryCase({
    entrypoint: ENTRYPOINT,
    argv: ['--body-file', 'candidate.md', '--json'],
    env: {
      BEMOAT_FACADE_COMMAND: COMMAND,
      BEMOAT_FACADE_ENTRYPOINT: ENTRYPOINT,
      npm_lifecycle_event: COMMAND,
    },
    files: { 'candidate.md': candidate },
  })
}

describe('BLOCKER_RESOLUTION validator canonical body boundary', () => {
  it.each([
    ['schema-v1 active-PR', schemaV1],
    ['schema-v2 no-PR', schemaV2],
  ])('accepts the documented complete canonical %s body', (_variant, record) => {
    const result = invoke(canonicalBody(record))

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

  const validV2 = canonicalBody(schemaV2)
  const invalidBodies: Array<[string, string]> = [
    ['missing the required final newline', validV2.slice(0, -1)],
    ['using a non-json fence', validV2.replace('```json\n', '```text\n')],
    [
      'using compact instead of documented pretty-printed JSON serialization',
      validV2.replace(JSON.stringify(schemaV2, null, 2), JSON.stringify(schemaV2)),
    ],
    ['changing the documented indentation', validV2.replace('  "branch":', ' "branch":')],
    ['omitting the documented heading', validV2.replace('## BLOCKER_RESOLUTION\n\n', '')],
    ['adding prose outside the complete body', `${validV2}extra prose\n`],
  ]

  it.each(invalidBodies)(
    'returns a deterministic FAIL for a body %s without mutation or a route',
    (_variation, candidate) => {
      const first = invoke(candidate)
      const second = invoke(candidate)
      const result = JSON.parse(first.stdout)

      expect(first.error).toBeNull()
      expect(first.status).toBe(2)
      expect(first.stderr).toBe('')
      expect(result).toMatchObject({
        command: COMMAND,
        mutation_performed: false,
        details: { validation_status: 'FAIL' },
      })
      expect(result).not.toHaveProperty('route')
      expect(second.stdout).toBe(first.stdout)
      expect(first.filesystem_unchanged).toBe(true)
      expect(first.poison_invocations).toEqual([])
    },
  )
})
