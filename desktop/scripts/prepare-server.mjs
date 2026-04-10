import fs from 'fs/promises'
import path from 'path'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const desktopRoot = path.resolve(__dirname, '..')
const repoRoot = path.resolve(desktopRoot, '..')
const serverRoot = path.join(repoRoot, 'server')
const stageServerRoot = path.join(desktopRoot, '.stage', 'server')
const stageNodeModulesRoot = path.join(stageServerRoot, 'node_modules')
const copiedPackages = new Set()

const ensureParentDirectory = async (targetPath) => {
  await fs.mkdir(path.dirname(targetPath), { recursive: true })
}

const copyDirectory = async (sourcePath, targetPath) => {
  await ensureParentDirectory(targetPath)
  await fs.cp(sourcePath, targetPath, {
    dereference: true,
    recursive: true,
  })
}

const findPackageDirectory = async (resolvedEntryPath) => {
  let currentDir = path.dirname(resolvedEntryPath)

  while (true) {
    const packageJsonPath = path.join(currentDir, 'package.json')

    try {
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'))
      if (typeof packageJson.name === 'string' && packageJson.name.length > 0) {
        return currentDir
      }
    } catch (error) {
      // Ignore missing package.json files while walking upward.
    }

    const parentDir = path.dirname(currentDir)
    if (parentDir === currentDir) {
      throw new Error(`Unable to locate package.json for ${resolvedEntryPath}.`)
    }

    currentDir = parentDir
  }
}

const resolvePackageDirectory = async (packageName, basedir) => {
  try {
    const packageJsonPath = require.resolve(`${packageName}/package.json`, {
      paths: [basedir],
    })

    return path.dirname(packageJsonPath)
  } catch (error) {
    const resolvedEntryPath = require.resolve(packageName, {
      paths: [basedir],
    })

    return findPackageDirectory(resolvedEntryPath)
  }
}

const copyPackageTree = async (packageName, basedir) => {
  const packageDir = await resolvePackageDirectory(packageName, basedir)
  const realPackageDir = await fs.realpath(packageDir)

  if (copiedPackages.has(realPackageDir)) {
    return
  }

  copiedPackages.add(realPackageDir)

  const packageJson = JSON.parse(
    await fs.readFile(path.join(packageDir, 'package.json'), 'utf8'),
  )
  const dependencyNames = new Set([
    ...Object.keys(packageJson.dependencies || {}),
    ...Object.keys(packageJson.optionalDependencies || {}),
  ])

  for (const dependencyName of dependencyNames) {
    try {
      await copyPackageTree(dependencyName, packageDir)
    } catch (error) {
      const shouldIgnore = dependencyName in (packageJson.optionalDependencies || {})

      if (!shouldIgnore) {
        throw error
      }
    }
  }

  const destinationDir = path.join(stageNodeModulesRoot, packageName)

  await copyDirectory(packageDir, destinationDir)
}

const stageRuntimePackage = async () => {
  const serverPackageJson = JSON.parse(
    await fs.readFile(path.join(serverRoot, 'package.json'), 'utf8'),
  )
  const runtimePackageJson = {
    name: 'wealth-tracker-server-runtime',
    private: true,
    main: 'dist/index.js',
    dependencies: serverPackageJson.dependencies,
  }

  await fs.writeFile(
    path.join(stageServerRoot, 'package.json'),
    `${JSON.stringify(runtimePackageJson, null, 2)}\n`,
  )

  await Promise.all([
    copyDirectory(path.join(serverRoot, 'dist'), path.join(stageServerRoot, 'dist')),
    copyDirectory(path.join(serverRoot, 'public'), path.join(stageServerRoot, 'public')),
  ])

  await fs.mkdir(stageNodeModulesRoot, { recursive: true })

  for (const dependencyName of Object.keys(serverPackageJson.dependencies || {})) {
    await copyPackageTree(dependencyName, serverRoot)
  }
}

await fs.rm(stageServerRoot, { force: true, recursive: true })
await fs.mkdir(stageServerRoot, { recursive: true })
await stageRuntimePackage()
