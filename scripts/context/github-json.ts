import type { ContextCommandRunner } from './runtime.ts'

interface JsonResult<T> { value: T | null; error: string | null }

export function readGithubJson<T>(run: ContextCommandRunner, command: string, args: readonly string[], options: { cwd?: string; env?: NodeJS.ProcessEnv }): JsonResult<T> {
  const result = run(command, args, options)
  if (result.status !== 0 || result.error) return { value: null, error: result.error?.message || result.stderr.trim() || result.stdout.trim() || `${command} returned no evidence` }
  const text = result.stdout.trim()
  if (!text) return { value: null, error: `${command} returned no evidence` }
  try { return { value: JSON.parse(text) as T, error: null } }
  catch (error) { return { value: null, error: `${command} returned invalid JSON: ${error instanceof Error ? error.message : String(error)}` } }
}
