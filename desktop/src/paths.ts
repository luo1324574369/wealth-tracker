import fs from 'fs/promises'
import path from 'path'
import { app } from 'electron'

const DATABASE_NAME = 'wealth_tracker.sqlite'

const getRepoRoot = () => {
  return path.resolve(__dirname, '..', '..')
}

const getPackagedServerRoot = () => {
  const resourcesPath = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath
  return path.join(resourcesPath || path.dirname(app.getPath('exe')), 'server')
}

const getDevelopmentServerRoot = () => {
  return path.join(getRepoRoot(), 'server')
}

const getServerRoot = () => {
  return app.isPackaged ? getPackagedServerRoot() : getDevelopmentServerRoot()
}

export const getRuntimePaths = () => {
  const userDataDir = app.getPath('userData')
  const logsDir = path.join(userDataDir, 'logs')
  const serverRoot = getServerRoot()

  return {
    dbPath: path.join(userDataDir, DATABASE_NAME),
    logsDir,
    publicDir: path.join(serverRoot, 'public'),
    serverEntryPath: path.join(serverRoot, 'dist', 'index.js'),
    serverRoot,
    userDataDir,
  }
}

export const ensureRuntimePaths = async () => {
  const runtimePaths = getRuntimePaths()

  await Promise.all([
    fs.mkdir(runtimePaths.userDataDir, { recursive: true }),
    fs.mkdir(runtimePaths.logsDir, { recursive: true }),
  ])

  return runtimePaths
}
