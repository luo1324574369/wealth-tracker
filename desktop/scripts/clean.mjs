import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const desktopRoot = path.resolve(__dirname, '..')

await Promise.all([
  fs.rm(path.join(desktopRoot, '.stage'), { force: true, recursive: true }),
  fs.rm(path.join(desktopRoot, 'dist'), { force: true, recursive: true }),
  fs.rm(path.join(desktopRoot, 'release'), { force: true, recursive: true }),
])
