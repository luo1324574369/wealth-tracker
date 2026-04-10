import fs from 'fs/promises'
import http from 'http'
import { ChildProcess, fork } from 'child_process'
import { getRuntimePaths } from './paths'

interface EmbeddedServerState {
  child: ChildProcess
  port: number
  url: string
}

let embeddedServer: EmbeddedServerState | null = null

const getAvailablePort = async () => {
  return await new Promise<number>((resolve, reject) => {
    const server = http.createServer()

    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        reject(new Error('Failed to allocate a desktop server port.'))
        return
      }

      const { port } = address
      server.close((error) => {
        if (error) {
          reject(error)
          return
        }

        resolve(port)
      })
    })
  })
}

const probeServer = async (url: string, child: ChildProcess) => {
  const startedAt = Date.now()
  const timeoutMs = 20000

  while (Date.now() - startedAt < timeoutMs) {
    if (child.exitCode !== null) {
      throw new Error(`Embedded server exited early with code ${child.exitCode}.`)
    }

    const isReady = await new Promise<boolean>((resolve) => {
      const request = http.get(url, (response) => {
        response.resume()
        resolve((response.statusCode || 500) < 500)
      })

      request.on('error', () => resolve(false))
      request.setTimeout(1000, () => {
        request.destroy()
        resolve(false)
      })
    })

    if (isReady) {
      return
    }

    await new Promise((resolve) => setTimeout(resolve, 250))
  }

  throw new Error('Timed out waiting for the embedded server to become ready.')
}

const pipeServerLogs = (child: ChildProcess) => {
  child.stdout?.on('data', (chunk) => {
    process.stdout.write(`[desktop-server] ${chunk}`)
  })

  child.stderr?.on('data', (chunk) => {
    process.stderr.write(`[desktop-server] ${chunk}`)
  })
}

export const startEmbeddedServer = async () => {
  if (embeddedServer) {
    return embeddedServer
  }

  const runtimePaths = getRuntimePaths()

  await Promise.all([
    fs.access(runtimePaths.serverEntryPath),
    fs.access(runtimePaths.publicDir),
    fs.mkdir(runtimePaths.userDataDir, { recursive: true }),
  ])

  const port = await getAvailablePort()
  const url = `http://127.0.0.1:${port}`
  const child = fork(runtimePaths.serverEntryPath, [], {
    env: {
      ...process.env,
      HOST: '127.0.0.1',
      PORT: String(port),
      PUBLIC_DIR: runtimePaths.publicDir,
      SQLITE_DB_PATH: runtimePaths.dbPath,
      ALLOW_PASSWORD: 'true',
      CAN_BE_RESET: 'true',
    },
    stdio: 'pipe',
  })

  pipeServerLogs(child)
  try {
    await probeServer(`${url}/api/heart`, child)
  } catch (error) {
    child.kill('SIGTERM')
    throw error
  }

  embeddedServer = {
    child,
    port,
    url,
  }

  return embeddedServer
}

export const stopEmbeddedServer = async () => {
  if (!embeddedServer) {
    return
  }

  const { child } = embeddedServer

  if (child.exitCode !== null) {
    embeddedServer = null
    return
  }

  await new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      child.kill('SIGKILL')
    }, 5000)

    child.once('exit', () => {
      clearTimeout(timeout)
      resolve()
    })

    child.kill('SIGTERM')
  })

  embeddedServer = null
}
