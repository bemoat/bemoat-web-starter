import { isAbsolute } from 'node:path'

const POSITIVE_INTEGER = /^[1-9]\d*$/

export class ContextInvocationError extends Error {
  readonly classification = 'INVALID_INVOCATION' as const
  readonly exit_code = 2 as const
  constructor(reason: string) {
    super(reason)
    this.name = 'ContextInvocationError'
    this.classification = 'INVALID_INVOCATION'
    this.exit_code = 2
  }
}

export type ContextInvocation =
  | { mode: 'help'; format: 'json' | 'text' }
  | { mode: 'run'; format: 'json' | 'text'; issueNumber: string; targetWorktree?: string }

export function parseContextInvocation(argv: string[]): ContextInvocation {
  const tokens = Array.isArray(argv) ? argv.filter((value) => value !== '--') : []
  const help = tokens.filter((value) => value === '--help' || value === '-h')
  const json = tokens.filter((value) => value === '--json')
  const targetFlagIndexes = tokens.flatMap((value, index) => value === '--target-worktree' ? [index] : [])
  if (help.length > 1) throw new ContextInvocationError('help may be provided only once')
  if (json.length > 1) throw new ContextInvocationError('--json may be provided only once')
  if (targetFlagIndexes.length > 1) throw new ContextInvocationError('--target-worktree may be provided only once')
  if (help.length > 0) return { mode: 'help', format: json.length > 0 ? 'json' : 'text' }

  const targetWorktreeIndex = targetFlagIndexes[0]
  let targetWorktree: string | undefined
  if (targetWorktreeIndex !== undefined) {
    targetWorktree = tokens[targetWorktreeIndex + 1]
    if (!targetWorktree || targetWorktree.startsWith('--')) throw new ContextInvocationError('--target-worktree requires an absolute path')
    if (!isAbsolute(targetWorktree)) throw new ContextInvocationError('--target-worktree requires an absolute path')
  }
  const positional = tokens.filter((value, index) => value !== '--json' &&
    !(targetFlagIndexes.length && (index === targetWorktreeIndex || index === targetWorktreeIndex! + 1)))
  if (tokens.some((value) => value.startsWith('--') && value !== '--json' && value !== '--target-worktree')) {
    throw new ContextInvocationError('unknown option')
  }
  if (positional.length !== 1) throw new ContextInvocationError('one positive Issue number is required')
  if (!POSITIVE_INTEGER.test(positional[0])) throw new ContextInvocationError('Issue number must be a positive integer')
  return { mode: 'run', format: json.length > 0 ? 'json' : 'text', issueNumber: String(BigInt(positional[0])), ...(targetWorktree ? { targetWorktree } : {}) }
}

export function renderContextHelp(format = 'text') {
  if (format === 'json') {
    return JSON.stringify({
      schema_version: 1,
      command: 'bemoat:context',
      mode: 'help',
      classification: 'HELP',
      tier: 'B',
      purpose: 'Reconstruct deterministic bounded task context without mutation.',
      required_inputs: [{ name: 'issue_number', syntax: '<issue-number>', kind: 'positional', value_type: 'positive_integer', required: true, source: 'caller', multiple: false, values: [], description: 'Issue number to reconstruct.' }],
      optional_flags: [
        { name: 'json', syntax: '--json', kind: 'flag', value_type: 'boolean', required: false, source: 'caller', multiple: false, values: [], description: 'Emit deterministic machine-readable context output.' },
        { name: 'target_worktree', syntax: '--target-worktree <absolute-path>', kind: 'option', value_type: 'path', required: false, source: 'caller', multiple: false, values: [], description: 'Evaluate one existing target root independently from this protected-main command source; the distinct canonical roots may be separate clones or worktrees. Omit for same-worktree mode.' },
      ],
      reads: ['local Git source and target roots, refs, status, branch, upstream, origin identity, target upstream remote URL, and target live branch ref', 'GitHub repository, protected base, policy, Issue, comments, PR, checks, reviews, and protection', 'exact historical/current canonical contract snapshots and GitHub commit comparison for eligible no-PR implementation HANDOFFs, blocker resolutions, or consumed no-PR Founder gates that require strict ancestry'],
      writes: [],
      result_classifications: ['SUCCESS', 'BLOCKED_EXTERNAL', 'EVIDENCE_CONFLICT'],
      stop_classifications: ['INVALID_INVOCATION', 'BLOCKED_EXTERNAL', 'EVIDENCE_CONFLICT', 'INTERNAL_ERROR'],
      next_action_rules: [
        { classification: 'SUCCESS', next_action: { type: 'COMPLETE', command: null, reason: 'The context was reconstructed without mutation.' } },
        { classification: 'BLOCKED_EXTERNAL', next_action: { type: 'STOP', command: null, reason: 'Required external evidence is unavailable.' } },
        { classification: 'EVIDENCE_CONFLICT', next_action: { type: 'STOP', command: null, reason: 'Required evidence is contradictory or ambiguous.' } },
      ],
      route_rules: [
        { route: 'PR_READY', next_action: { type: 'OPEN_PR', command: 'gh pr create', description: 'Open exactly one PR from the uniquely verified, already-pushed canonical Issue branch to the approved protected base. No source edits or other Git mutations are authorized.' } },
      ],
    }) + '\n'
  }
  return [
    'HELP: bemoat:context',
    'Usage: pnpm run bemoat:context -- <issue-number> [--target-worktree <absolute-path>] [--json]',
    'Purpose: Reconstruct deterministic bounded task context without mutation.',
    'A uniquely verified no-PR implementation HANDOFF may route PR_READY for exactly one PR creation.',
    'Writes: none',
    'Safe help invocation: pnpm run bemoat:context -- --help --json',
    '',
  ].join('\n')
}
