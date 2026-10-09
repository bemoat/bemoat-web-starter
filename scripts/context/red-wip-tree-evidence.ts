import { lstatSync } from 'node:fs'
import { resolve } from 'node:path'
import type { ContextCommandRunner } from './runtime.ts'
import type { NormalizedContextEvidence } from './model.ts'
import type { RedWipApproval } from './red-wip-checkpoint.ts'

export function readRedWipWorkingTreeEvidence(cwd: string, approval: RedWipApproval, run: ContextCommandRunner): NonNullable<NormalizedContextEvidence['redWipWorkingTree']> {
  const unavailable = { available: false, stagedPaths: [] as string[], unstagedPaths: [] as string[], untrackedPaths: [] as string[], protectedBaseAncestor: false, approvedPathRegularFile: false }
  const status = run('git', ['status', '--porcelain=v1', '--untracked-files=all', '-z'], { cwd })
  if (status.status !== 0 || status.error) return unavailable
  const stagedPaths: string[] = [], unstagedPaths: string[] = [], untrackedPaths: string[] = []
  for (const record of status.stdout.split('\0').filter(Boolean)) {
    if (record.length < 4) return unavailable
    const code = record.slice(0, 2), path = record.slice(3)
    if (!path || code.includes('R') || code.includes('C')) return unavailable
    if (code === '??') untrackedPaths.push(path)
    else {
      if (code[0] !== ' ') stagedPaths.push(path)
      if (code[1] !== ' ') unstagedPaths.push(path)
    }
  }
  const ancestry = run('git', ['merge-base', '--is-ancestor', approval.protected_base_sha, 'HEAD'], { cwd })
  let approvedPathRegularFile = false
  try { const stat = lstatSync(resolve(cwd, approval.test_path)); approvedPathRegularFile = stat.isFile() && !stat.isSymbolicLink() } catch { /* absent/unreadable path stays ineligible */ }
  return { available: true, stagedPaths, unstagedPaths, untrackedPaths, protectedBaseAncestor: ancestry.status === 0 && !ancestry.error, approvedPathRegularFile }
}
