import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const desktopRoot = path.resolve(__dirname, '..')
const releaseRoot = path.join(desktopRoot, 'release')

const parseArgs = () => {
  return Object.fromEntries(
    process.argv.slice(2).map((argument) => {
      const [rawKey, rawValue] = argument.split('=')
      return [rawKey.replace(/^--/, ''), rawValue ?? 'true']
    }),
  )
}

const getPlatform = (requestedPlatform) => {
  if (requestedPlatform) {
    return requestedPlatform
  }

  if (process.platform === 'darwin') {
    return 'mac'
  }

  if (process.platform === 'win32') {
    return 'win'
  }

  return 'linux'
}

const collectEntries = async (rootPath, currentPath = rootPath) => {
  const directoryEntries = await fs.readdir(currentPath, { withFileTypes: true })
  const entries = []

  for (const directoryEntry of directoryEntries) {
    const absolutePath = path.join(currentPath, directoryEntry.name)
    const relativePath = path.relative(rootPath, absolutePath)

    entries.push({
      absolutePath,
      relativePath,
      type: directoryEntry.isDirectory() ? 'dir' : 'file',
    })

    if (directoryEntry.isDirectory()) {
      entries.push(...(await collectEntries(rootPath, absolutePath)))
    }
  }

  return entries
}

const expectations = {
  dist: {
    linux: [{ type: 'file', test: (entry) => entry.relativePath.endsWith('.AppImage') }],
    mac: [{ type: 'file', test: (entry) => entry.relativePath.endsWith('.dmg') }],
    win: [{ type: 'file', test: (entry) => entry.relativePath.endsWith('.exe') }],
  },
  pack: {
    linux: [{ type: 'dir', test: (entry) => entry.relativePath.startsWith('linux-unpacked') }],
    mac: [{ type: 'dir', test: (entry) => entry.relativePath.endsWith('.app') }],
    win: [{ type: 'dir', test: (entry) => entry.relativePath.startsWith('win-unpacked') }],
  },
}

const { mode = 'dist', platform: requestedPlatform } = parseArgs()
const platform = getPlatform(requestedPlatform)
const releaseEntries = await collectEntries(releaseRoot)
const platformExpectations = expectations[mode]?.[platform]

if (!platformExpectations) {
  throw new Error(`Unsupported verification target: mode=${mode}, platform=${platform}.`)
}

const matchedEntries = platformExpectations.flatMap((expectation) => {
  return releaseEntries.filter((entry) => {
    return entry.type === expectation.type && expectation.test(entry)
  })
})

if (matchedEntries.length === 0) {
  const discoveredEntries =
    releaseEntries.map((entry) => `- ${entry.relativePath} (${entry.type})`).join('\n') || '- <empty>'

  throw new Error(
    `No ${mode} artifacts found for ${platform} in ${releaseRoot}.\nDiscovered:\n${discoveredEntries}`,
  )
}

console.log(`Verified ${mode} artifacts for ${platform}:`)
for (const entry of matchedEntries) {
  console.log(`- ${entry.relativePath}`)
}
