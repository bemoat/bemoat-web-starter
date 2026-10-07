function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/** Existing Context immutable-finding predicate; keep its permissive field semantics. */
export function hasImmutableFindingDisposition(parsed: unknown, expectedHead: string): boolean {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return false
  const record = parsed as { schema_version?: unknown; reviewed_head?: unknown; findings?: unknown }
  if (record.schema_version !== 1 || typeof record.reviewed_head !== 'string' ||
    record.reviewed_head.toLowerCase() !== expectedHead.toLowerCase()) return false
  const findings = record.findings
  if (!Array.isArray(findings) || findings.length === 0) return false
  const findingIds = new Set<string>()
  return findings.every((finding) => {
    if (!finding || typeof finding !== 'object' || Array.isArray(finding)) return false
    const findingRecord = finding as { id?: unknown; canonical_summary?: unknown; source_thread?: unknown; required_evidence?: unknown }
    const id = typeof findingRecord.id === 'string' ? findingRecord.id.trim() : ''
    if (!id || findingIds.has(id)) return false
    findingIds.add(id)
    return typeof findingRecord.canonical_summary === 'string' && findingRecord.canonical_summary.trim() !== '' &&
      typeof findingRecord.source_thread === 'string' && findingRecord.source_thread.trim() !== '' &&
      Array.isArray(findingRecord.required_evidence) && findingRecord.required_evidence.length > 0 &&
      findingRecord.required_evidence.every((item) => typeof item === 'string' && item.trim() !== '')
  })
}

function hasOnlyKeys(record: Record<string, unknown>, keys: readonly string[]): boolean {
  const present = Object.keys(record)
  return present.length === keys.length && present.every((key) => keys.includes(key))
}

/** Candidate-only mode and exact-key restrictions layered over the shared predicate. */
export function hasStrictImmutableFindingDisposition(parsed: unknown, expectedHead: string): boolean {
  if (!hasImmutableFindingDisposition(parsed, expectedHead) || !isRecord(parsed) ||
    parsed.mode !== 'implementation_pr' ||
    !hasOnlyKeys(parsed, ['schema_version', 'mode', 'reviewed_head', 'findings'])) return false
  const findings = parsed.findings
  return Array.isArray(findings) && findings.every((finding) =>
    isRecord(finding) && hasOnlyKeys(finding, ['id', 'canonical_summary', 'source_thread', 'required_evidence']),
  )
}
