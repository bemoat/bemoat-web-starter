import { execFileSync } from 'node:child_process'

const output = execFileSync('git', [], { encoding: 'utf8' })

export const capturedOutput = Buffer.isBuffer(output)
  ? output.toString('utf8')
  : String(output)
