import path from 'path'

const SERVER_ROOT = path.resolve(__dirname, '..', '..')

export const DEFAULT_SQLITE_DB = path.join(SERVER_ROOT, 'data', 'wealth_tracker.sqlite')

export const DEFAULT_PUBLIC_DIR = path.join(SERVER_ROOT, 'public')

export const DEFAULT_HOST = '0.0.0.0'

export const DEFAULT_PORT = 8888

export const parseBooleanEnv = (value: string | undefined, fallback = false) => {
  if (value === undefined) {
    return fallback
  }

  return value === 'true'
}

export const getSqliteDbPath = () => {
  return process.env.SQLITE_DB_PATH || DEFAULT_SQLITE_DB
}

export const getPublicDir = () => {
  return process.env.PUBLIC_DIR || DEFAULT_PUBLIC_DIR
}
