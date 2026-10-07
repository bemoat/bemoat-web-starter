import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { runCliBoundaryCase } from '../helpers/cli-boundary-harness'

const command = 'bemoat:founder-decision-repair:validate'
const entrypoint = 'scripts/agent-validate-founder-decision-repair.ts'
const record: Record<string, unknown> & { source_founder_decision: Record<string, unknown> } = {
  schema_version: 1,
  record_type: 'FOUNDER_DECISION_REPAIR',
  repository: 'bemoat/bemoat-web-starter',
  issue_number: '582',
  pr_number: null,
  branch: 'fix/582-repository-transfer-identity',
  exact_head: '8889e1898d5d20833143bc568f325175ee46956b',
  protected_base: { branch: 'main', sha: '5722b6b8bc6782d1edfea67b7648687700e42659' },
  policy: {
    path: 'docs/mission-control/mission-control-guide.md',
    policy_id: 'bemoat-mission-control',
    version: '1.5.0',
    source_sha: '3d7b2403b081d7b744c8b2bfecb25adae29632ce',
  },
  source_founder_gate: {
    comment_id: '6014391169',
    url: 'https://github.com/bemoat/bemoat-web-starter/issues/582#issuecomment-6014391169',
  },
  decision: 'PROCEED',
  authority: { role: 'FOUNDER', login: 'bemoat' },
  source_founder_decision: {
    comment_id: '6037687449',
    url: 'https://github.com/bemoat/bemoat-web-starter/issues/582#issuecomment-6037687449',
    body_sha256: 'a'.repeat(64),
  },
}
function body(value: unknown) {
  return '## FOUNDER_DECISION_REPAIR\n\n```json\n' + JSON.stringify(value, null, 2) + '\n```\n'
}
function invoke(candidate: string, argv = ['--body-file', 'candidate.md', '--json']) {
  return runCliBoundaryCase({
    entrypoint, argv,
    env: { npm_lifecycle_event: command },
    files: { 'candidate.md': candidate },
  })
}

// #602 requires a supported deterministic validation path for new strict
// authority-bearing evidence. PASS is syntax only and must perform no writes,
// network/Git calls, publication, live-authority checks, or route selection.
describe('FOUNDER_DECISION_REPAIR public syntax validation', () => {
  it('accepts the complete strict body without authority or mutation', () => {
    const result = invoke(body(record))
    expect(result.status).toBe(0)
    expect(JSON.parse(result.stdout)).toMatchObject({
      command, classification: 'SUCCESS', mutation_performed: false,
      details: { validation_status: 'PASS', authority_verified: false, context_route_created: false },
    })
    expect(result.filesystem_unchanged).toBe(true)
    expect(result.poison_invocations).toEqual([])
  })

  it.each([
    ['prose', '## FOUNDER_DECISION_REPAIR\n\nProceed.'],
    ['noncanonical envelope', body(record).replaceAll('\n', '\\n')],
    ['extra key', body({ ...record, mutable_history: true })],
    ['missing predecessor', body({ ...record, source_founder_decision: undefined })],
    ['unsupported version', body({ ...record, schema_version: 2 })],
    ['wrong digest shape', body({ ...record, source_founder_decision: { ...record.source_founder_decision, body_sha256: 'a' } })],
    ['wrong predecessor identity shape', body({ ...record, source_founder_decision: { ...record.source_founder_decision, comment_id: '' } })],
    ['non-null PR', body({ ...record, pr_number: '1' })],
  ])('rejects %s deterministically', (_story, candidate) => {
    const result = invoke(candidate)
    expect(result.status).toBe(2)
    expect(JSON.parse(result.stdout)).toMatchObject({
      command, classification: 'INVALID_INVOCATION', mutation_performed: false,
      details: { validation_status: 'FAIL' },
    })
    expect(invoke(candidate).stdout).toBe(result.stdout)
    expect(result.filesystem_unchanged).toBe(true)
    expect(result.poison_invocations).toEqual([])
  })

  it('provides safe machine-readable discovery', () => {
    const result = invoke('', ['--help', '--json'])
    expect(result.status).toBe(0)
    expect(JSON.parse(result.stdout)).toMatchObject({
      command, mode: 'help', classification: 'HELP', writes: [],
      required_inputs: [{ name: 'body_file' }],
    })
    expect(result.filesystem_unchanged).toBe(true)
    expect(result.poison_invocations).toEqual([])
  })

  it('validates the complete copyable repair template through the public boundary', () => {
    const document = readFileSync('docs/mission-control/founder-decision-repair-template.md', 'utf8')
    const example = document.match(/````text\n([\s\S]*?)\n````/)?.[1]
    expect(example).toBeDefined()
    const result = invoke(example! + '\n')
    expect(result.status).toBe(0)
    expect(JSON.parse(result.stdout).details.validation_status).toBe('PASS')
    expect(result.filesystem_unchanged).toBe(true)
    expect(result.poison_invocations).toEqual([])
  })
})
