import { describe, expect, it } from 'vitest'

import { runCliBoundaryCase } from '../helpers/cli-boundary-harness'
import { getCommandContract } from '../../scripts/cli/command-contract.ts'

const COMMAND = 'bemoat:blocker-resolution:validate'
const ENTRYPOINT = 'scripts/agent-validate-blocker-resolution.ts'

/**
 * Semantic oracle: Issue #590 acceptance criteria require a supported,
 * read-only public validator for exact BLOCKER_RESOLUTION bodies, PASS for
 * valid schema-v1/schema-v2, deterministic rejection of malformed or
 * schema-invalid bodies, and no publication, authority, or Context route.
 * `docs/mission-control/command-reference.md` defines the distinct strict
 * schemas; `blocker-resolution-template.md` says its examples establish
 * syntax only, not live resolution authority. These tests exercise the public
 * CLI boundary and deliberately do not import the internal production parser.
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

function body(record: Record<string, unknown>): string {
  return `## BLOCKER_RESOLUTION\n\n\`\`\`json\n${JSON.stringify(record, null, 2)}\n\`\`\`\n`
}

function bodyFromJson(json: string): string {
  return `## BLOCKER_RESOLUTION\n\n\`\`\`json\n${json}\n\`\`\`\n`
}

function validate(candidateBody: string) {
  return runCliBoundaryCase({
    entrypoint: ENTRYPOINT,
    argv: ['--body-file', 'candidate.md', '--json'],
    env: {
      BEMOAT_FACADE_COMMAND: COMMAND,
      BEMOAT_FACADE_ENTRYPOINT: ENTRYPOINT,
      npm_lifecycle_event: COMMAND,
    },
    files: { 'candidate.md': candidateBody },
  })
}

describe('BLOCKER_RESOLUTION validation public CLI', () => {
  it('accepts a valid schema-v1 active-PR body without producing a Context route', () => {
    const result = validate(body(schemaV1))

    expect(result.error).toBeNull()
    expect(result.status).toBe(0)
    expect(result.stderr).toBe('')
    expect(JSON.parse(result.stdout)).toMatchObject({
      schema_version: 1,
      command: COMMAND,
      mode: 'result',
      outcome: 'SUCCESS',
      classification: 'SUCCESS',
      mutation_performed: false,
      details: { validation_status: 'PASS', record_schema_version: 1 },
    })
    expect(JSON.parse(result.stdout)).not.toHaveProperty('route')
    expect(result.filesystem_unchanged).toBe(true)
    expect(result.poison_invocations).toEqual([])
  })

  it('accepts a valid schema-v2 no-PR body without treating it as resolution evidence', () => {
    const result = validate(body(schemaV2))

    expect(result.error).toBeNull()
    expect(result.status).toBe(0)
    expect(result.stderr).toBe('')
    expect(JSON.parse(result.stdout)).toMatchObject({
      command: COMMAND,
      mode: 'result',
      classification: 'SUCCESS',
      mutation_performed: false,
      details: { validation_status: 'PASS', record_schema_version: 2 },
    })
    expect(JSON.parse(result.stdout)).not.toHaveProperty('route')
    expect(result.filesystem_unchanged).toBe(true)
    expect(result.poison_invocations).toEqual([])
  })

  it.each([
    ['malformed JSON', bodyFromJson('{"schema_version":2,}')],
    ['wrong record type', body({ ...schemaV2, record_type: 'FOUNDER_DECISION' })],
    ['unsupported schema version', body({ ...schemaV2, schema_version: 3 })],
    ['missing required field', body(Object.fromEntries(Object.entries(schemaV2).filter(([key]) => key !== 'authority')))],
    ['extra unsupported field', body({ ...schemaV2, unsupported: true })],
  ])('deterministically rejects %s without mutation or route creation', (_story, candidateBody) => {
    const first = validate(candidateBody)
    const second = validate(candidateBody)

    expect(first.error).toBeNull()
    expect(first.status).toBe(2)
    expect(first.stderr).toBe('')
    expect(JSON.parse(first.stdout)).toMatchObject({
      command: COMMAND,
      mode: 'result',
      outcome: 'ERROR',
      classification: 'INVALID_INVOCATION',
      mutation_performed: false,
      details: { validation_status: 'FAIL' },
    })
    expect(JSON.parse(first.stdout)).not.toHaveProperty('route')
    expect(second.stdout).toBe(first.stdout)
    expect(first.filesystem_unchanged).toBe(true)
    expect(first.poison_invocations).toEqual([])
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
    expect(result.filesystem_unchanged).toBe(true)
    expect(result.poison_invocations).toEqual([])

    expect(getCommandContract(COMMAND)).toMatchObject({
      command: COMMAND,
      entrypoint: ENTRYPOINT,
      writes: [],
      help_meaningful: true,
      safe_help_invocation: `pnpm run ${COMMAND} -- --help --json`,
    })
  })
})
