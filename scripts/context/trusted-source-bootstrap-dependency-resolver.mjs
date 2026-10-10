import { lstatSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { isBuiltin, registerHooks } from 'node:module'
import { isAbsolute, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const resolverRelativePath = 'scripts/context/trusted-source-bootstrap-dependency-resolver.mjs'

function fail(message) {
  throw new Error(`Bemoat read-only D dependency resolver: ${message}`)
}

function configuredRoot(name) {
  const value = process.env[name]
  if (typeof value !== 'string' || !isAbsolute(value)) fail(`${name} must be an absolute path.`)
  const canonical = realpathSync(value)
  if (canonical !== resolve(value) || !statSync(canonical).isDirectory()) fail(`${name} is not a canonical existing directory.`)
  return canonical
}

function isWithin(root, candidate) {
  const pathFromRoot = relative(root, candidate)
  return pathFromRoot === '' || (pathFromRoot !== '..' && !pathFromRoot.startsWith(`..${sep}`) && !isAbsolute(pathFromRoot))
}

function overlaps(first, second) {
  return isWithin(first, second) || isWithin(second, first)
}

function assertNoOverlap(first, second, label) {
  if (overlaps(first, second)) fail(`${label} must be distinct and non-overlapping.`)
}

const sourceRoot = configuredRoot('BEMOAT_TRUSTED_SOURCE_ROOT')
const targetRoot = configuredRoot('BEMOAT_TRUSTED_SOURCE_TARGET_ROOT')
const destinationRoot = configuredRoot('BEMOAT_TRUSTED_SOURCE_DESTINATION_ROOT')
const processRoot = realpathSync(process.cwd())
if (processRoot !== destinationRoot) fail('the subprocess cwd does not equal exact D.')
assertNoOverlap(sourceRoot, destinationRoot, 'source and D roots')
assertNoOverlap(sourceRoot, targetRoot, 'source and original B roots')
assertNoOverlap(destinationRoot, targetRoot, 'D and original B roots')

const sourceScriptsRoot = realpathSync(resolve(sourceRoot, 'scripts'))
const destinationScriptsRoot = realpathSync(resolve(destinationRoot, 'scripts'))
if (!isWithin(sourceRoot, sourceScriptsRoot) || !isWithin(destinationRoot, destinationScriptsRoot)) {
  fail('scripts directories must remain within their respective canonical roots.')
}

const sourcePackagePath = resolve(sourceRoot, 'package.json')
const destinationPackagePath = resolve(destinationRoot, 'package.json')
const sourceLockPath = resolve(sourceRoot, 'pnpm-lock.yaml')
const destinationLockPath = resolve(destinationRoot, 'pnpm-lock.yaml')
if (!readFileSync(sourcePackagePath).equals(readFileSync(destinationPackagePath)) ||
    !readFileSync(sourceLockPath).equals(readFileSync(destinationLockPath))) {
  fail('D package.json and pnpm-lock.yaml must match the verified source byte-for-byte.')
}

const dependencyPath = resolve(sourceRoot, 'node_modules')
try {
  lstatSync(dependencyPath)
} catch {
  fail('the verified source dependency directory is unavailable.')
}
const sourceDependencyRoot = realpathSync(dependencyPath)
if (!statSync(sourceDependencyRoot).isDirectory() || !isWithin(sourceRoot, sourceDependencyRoot)) {
  fail('the verified source dependency directory must remain inside the canonical source root.')
}
assertNoOverlap(sourceDependencyRoot, destinationRoot, 'source dependencies and D')
assertNoOverlap(sourceDependencyRoot, targetRoot, 'source dependencies and original B')
try {
  lstatSync(resolve(destinationRoot, 'node_modules'))
  fail('D must not contain node_modules.')
} catch (error) {
  if (error instanceof Error && !('code' in error && error.code === 'ENOENT')) throw error
}

const expectedResolverPath = resolve(sourceRoot, resolverRelativePath)
const actualResolverPath = realpathSync(fileURLToPath(import.meta.url))
if (actualResolverPath !== expectedResolverPath || !isWithin(sourceRoot, actualResolverPath)) {
  fail('the resolver must be loaded from the exact verified source root.')
}

const sourcePackage = JSON.parse(readFileSync(sourcePackagePath, 'utf8'))
const declaredPackages = new Set()
for (const section of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
  const values = sourcePackage[section] ?? {}
  if (!values || typeof values !== 'object' || Array.isArray(values)) fail(`source package.json has an invalid ${section} declaration.`)
  for (const [name, version] of Object.entries(values)) {
    if (!name || typeof version !== 'string' || !version.trim()) fail(`source package.json has an invalid ${section} entry.`)
    declaredPackages.add(name)
  }
}

if (typeof registerHooks !== 'function') fail('this Node runtime does not support synchronous module resolution hooks.')

function packageName(specifier) {
  if (specifier.startsWith('@')) {
    const parts = specifier.split('/')
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : specifier
  }
  return specifier.split('/')[0] ?? specifier
}

function shouldUseDefaultResolution(specifier) {
  return isBuiltin(specifier) || specifier.startsWith('node:') || specifier.startsWith('#') ||
    specifier.startsWith('.') || specifier.startsWith('/') || /^[A-Za-z][A-Za-z\d+.-]*:/.test(specifier)
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    const parentURL = context.parentURL
    if (!parentURL || !parentURL.startsWith('file:') || shouldUseDefaultResolution(specifier)) {
      return nextResolve(specifier, context)
    }

    let importerPath
    try {
      importerPath = resolve(fileURLToPath(parentURL))
    } catch {
      return nextResolve(specifier, context)
    }
    const importerIsLexicallyInD = isWithin(resolve(destinationRoot, 'scripts'), importerPath)
    let importer
    try {
      importer = realpathSync(importerPath)
    } catch {
      if (importerIsLexicallyInD) fail('a D script importer is unavailable.')
      return nextResolve(specifier, context)
    }
    const importerIsCanonicallyInD = isWithin(destinationScriptsRoot, importer)
    if (importerIsLexicallyInD && !importerIsCanonicallyInD) fail('a D script importer resolves outside D/scripts.')
    if (!importerIsLexicallyInD || !importerIsCanonicallyInD) return nextResolve(specifier, context)

    const name = packageName(specifier)
    if (!declaredPackages.has(name)) fail(`D script imports undeclared bare package "${specifier}".`)

    const relativeImporter = relative(destinationScriptsRoot, importer)
    const sourceImporterPath = resolve(sourceScriptsRoot, relativeImporter)
    let sourceImporter
    try {
      sourceImporter = realpathSync(sourceImporterPath)
    } catch {
      fail(`the source counterpart for D importer "${relativeImporter}" is unavailable.`)
    }
    if (!isWithin(sourceScriptsRoot, sourceImporter)) fail('the mapped source importer escaped source/scripts.')

    let resolution
    try {
      resolution = nextResolve(specifier, { ...context, parentURL: pathToFileURL(sourceImporter).href })
    } catch (error) {
      fail(`declared package "${specifier}" is unavailable from source dependencies: ${error instanceof Error ? error.message : String(error)}`)
    }
    if (!resolution.url.startsWith('file:')) fail(`declared package "${specifier}" did not resolve to a source file.`)
    let resolvedPath
    try {
      resolvedPath = realpathSync(fileURLToPath(resolution.url))
    } catch {
      fail(`declared package "${specifier}" resolved to an unavailable source file.`)
    }
    if (!isWithin(sourceDependencyRoot, resolvedPath)) fail(`declared package "${specifier}" resolved outside verified source dependencies.`)
    return resolution
  },
})
