import { lstatSync, readFileSync, realpathSync, statSync } from 'node:fs'
import * as nodeModule from 'node:module'
import { isAbsolute, relative, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'

import type { ContextCommandRunner } from './runtime.ts'

export function readOnlyResolverEnvironment(sourceRoot: string, targetRoot: string, destinationRoot: string): {
  environment: NodeJS.ProcessEnv | null
  reason: string | null
} {
  const resolverPath = resolve(sourceRoot, 'scripts', 'context', 'trusted-source-bootstrap-dependency-resolver.ts')
  let canonicalResolverPath: string
  try {
    canonicalResolverPath = realpathSync(resolverPath)
  } catch {
    return { environment: null, reason: 'The verified #630 source does not contain the registered read-only dependency resolver; preserve all roots and stop.' }
  }
  const resolverRelativePath = relative(sourceRoot, canonicalResolverPath)
  if (canonicalResolverPath !== resolverPath || resolverRelativePath === '' || resolverRelativePath === '..' ||
      resolverRelativePath.startsWith(`..${sep}`) || isAbsolute(resolverRelativePath)) {
    return { environment: null, reason: 'The registered read-only dependency resolver is not canonically contained in the verified #630 source; preserve all roots and stop.' }
  }

  const sourceDependenciesPath = resolve(sourceRoot, 'node_modules')
  let canonicalDependenciesPath: string
  try {
    lstatSync(sourceDependenciesPath)
    canonicalDependenciesPath = realpathSync(sourceDependenciesPath)
    if (!statSync(canonicalDependenciesPath).isDirectory()) throw new Error('not a directory')
  } catch {
    return { environment: null, reason: 'The verified #630 source dependency directory is unavailable; preserve all roots and stop.' }
  }
  const dependenciesRelativePath = relative(sourceRoot, canonicalDependenciesPath)
  if (dependenciesRelativePath === '' || dependenciesRelativePath === '..' || dependenciesRelativePath.startsWith(`..${sep}`) ||
      isAbsolute(dependenciesRelativePath)) {
    return { environment: null, reason: 'The verified #630 source dependency directory is not contained in its canonical root; preserve all roots and stop.' }
  }

  if (typeof nodeModule.registerHooks !== 'function') {
    return { environment: null, reason: 'This Node runtime does not support synchronous module resolution hooks; preserve all roots and stop.' }
  }

  const inheritedNodeOptions = process.env.NODE_OPTIONS?.trim() ?? ''
  if (/(?:^|\s)["']?(?:-r|--import|--require|--loader|--experimental-loader)["']?(?=$|=|\s)/.test(inheritedNodeOptions)) {
    return { environment: null, reason: 'A conflicting Node preload or loader is already configured; preserve all roots and stop.' }
  }

  const environment = { ...process.env }
  environment.BEMOAT_TRUSTED_SOURCE_ROOT = sourceRoot
  environment.BEMOAT_TRUSTED_SOURCE_TARGET_ROOT = targetRoot
  environment.BEMOAT_TRUSTED_SOURCE_DESTINATION_ROOT = destinationRoot
  environment.GIT_OPTIONAL_LOCKS = '0'
  environment.NODE_OPTIONS = [inheritedNodeOptions, `--import=${pathToFileURL(resolverPath).href}`].filter(Boolean).join(' ')
  return { environment, reason: null }
}

export function verifySourceRuntimeFilesAgainstLiveMain(sourceRoot: string, liveMain: string, run: ContextCommandRunner): string | null {
  for (const relativePath of ['package.json', 'pnpm-lock.yaml']) {
    let sourceBytes: Buffer
    try {
      sourceBytes = readFileSync(resolve(sourceRoot, relativePath))
    } catch {
      return `The verified #630 source ${relativePath} is unavailable; no destination was created.`
    }
    const liveBlob = run('git', ['show', `${liveMain}:${relativePath}`], { cwd: sourceRoot })
    if (liveBlob.status !== 0 || liveBlob.error) {
      return `The exact-live-main ${relativePath} blob could not be read; no destination was created.`
    }
    if (!sourceBytes.equals(Buffer.from(liveBlob.stdout, 'utf8'))) {
      return `The verified #630 source ${relativePath} differs from exact live main; no destination was created.`
    }
  }
  return null
}
