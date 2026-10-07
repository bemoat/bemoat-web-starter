import {
  parseBlockerResolutionRecord,
  parseNoPrBlockerResolutionRecord,
} from './blocker-resolution.ts'

export type BlockerResolutionValidation =
  | { status: 'PASS'; recordSchemaVersion: 1 | 2 }
  | { status: 'FAIL'; recordSchemaVersion: null }

/** Validate syntax only. A passing record is not authority or Context evidence. */
export function validateBlockerResolutionBody(body: string): BlockerResolutionValidation {
  if (parseBlockerResolutionRecord(body)) {
    return { status: 'PASS', recordSchemaVersion: 1 }
  }
  if (parseNoPrBlockerResolutionRecord(body)) {
    return { status: 'PASS', recordSchemaVersion: 2 }
  }
  return { status: 'FAIL', recordSchemaVersion: null }
}
