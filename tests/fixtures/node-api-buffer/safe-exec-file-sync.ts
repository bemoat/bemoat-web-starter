import { execFileSync } from 'node:child_process'

const output = execFileSync('git', [], { encoding: 'utf8' })

export const capturedOutput = String(output)
