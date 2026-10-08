import { parseRedWipApproval, RED_WIP_APPROVAL_MARKER, type RedWipApproval } from './red-wip-checkpoint.ts'

export function readRedWipIssueApproval(body: string, issueNumber: string): RedWipApproval | null {
  if (!body.includes(RED_WIP_APPROVAL_MARKER)) return null
  try { return parseRedWipApproval(body, issueNumber) } catch { return null }
}
