import fs from 'fs/promises'
import path from 'path'
import { execFile } from 'child_process'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const desktopRoot = path.resolve(__dirname, '..')
const repoRoot = path.resolve(desktopRoot, '..')
const assetsRoot = path.join(desktopRoot, 'assets')
const stagingRoot = path.join(desktopRoot, '.stage', '.icons')
const sourceIconPath = path.join(repoRoot, 'client', 'public', 'android-chrome-512x512.png')
const outputPngPath = path.join(assetsRoot, 'icon.png')
const outputIcoPath = path.join(assetsRoot, 'icon.ico')

const icoSizes = [16, 24, 32, 48, 64, 128, 256]

const runCommand = async (command, args) => {
  await new Promise((resolve, reject) => {
    execFile(command, args, (error, stdout, stderr) => {
      if (error) {
        const details = [stdout, stderr].filter(Boolean).join('\n').trim()
        reject(new Error(details || `${command} exited with code ${error.code ?? 'unknown'}.`))
        return
      }

      resolve(undefined)
    })
  })
}

const ensureDirectory = async (targetPath) => {
  await fs.mkdir(targetPath, { recursive: true })
}

const hasSips = process.platform === 'darwin'

const resizePng = async (sourcePath, targetPath, size) => {
  await ensureDirectory(path.dirname(targetPath))
  if (hasSips) {
    await runCommand('sips', ['-z', String(size), String(size), sourcePath, '--out', targetPath])
  } else {
    await runCommand('magick', [
      sourcePath,
      '-resize',
      `${size}x${size}!`,
      targetPath,
    ])
  }
}

const buildIco = async () => {
  const icoSourceRoot = path.join(stagingRoot, 'ico')
  const imageEntries = []

  await fs.rm(icoSourceRoot, { force: true, recursive: true })
  await ensureDirectory(icoSourceRoot)

  for (const size of icoSizes) {
    const outputPath = path.join(icoSourceRoot, `icon-${size}.png`)
    await resizePng(sourceIconPath, outputPath, size)
    imageEntries.push({
      buffer: await fs.readFile(outputPath),
      size,
    })
  }

  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(imageEntries.length, 4)

  const directory = Buffer.alloc(imageEntries.length * 16)
  let offset = header.length + directory.length

  imageEntries.forEach(({ buffer, size }, index) => {
    const cursor = index * 16
    const dimension = size >= 256 ? 0 : size
    directory.writeUInt8(dimension, cursor)
    directory.writeUInt8(dimension, cursor + 1)
    directory.writeUInt8(0, cursor + 2)
    directory.writeUInt8(0, cursor + 3)
    directory.writeUInt16LE(1, cursor + 4)
    directory.writeUInt16LE(32, cursor + 6)
    directory.writeUInt32LE(buffer.length, cursor + 8)
    directory.writeUInt32LE(offset, cursor + 12)
    offset += buffer.length
  })

  await fs.writeFile(
    outputIcoPath,
    Buffer.concat([header, directory, ...imageEntries.map(({ buffer }) => buffer)]),
  )
}

await ensureDirectory(assetsRoot)
await ensureDirectory(stagingRoot)
await fs.access(sourceIconPath)
await fs.copyFile(sourceIconPath, outputPngPath)
await buildIco()
