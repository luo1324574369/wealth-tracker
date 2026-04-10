import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'

app.name = 'WealthTracker'

import { ensureRuntimePaths } from './paths'
import { startEmbeddedServer, stopEmbeddedServer } from './server'
import { createMainWindow } from './window'

let mainWindow: InstanceType<typeof BrowserWindow> | null = null
let isQuitting = false
let isStoppingServer = false

const focusMainWindow = () => {
  if (!mainWindow) {
    return
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore()
  }

  mainWindow.focus()
}

const bootstrap = async () => {
  await ensureRuntimePaths()
  const server = await startEmbeddedServer()
  mainWindow = await createMainWindow(server.url)

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

const shutdown = async () => {
  if (isStoppingServer) {
    return
  }

  isStoppingServer = true
  await stopEmbeddedServer()
}

const registerIpcHandlers = () => {
  ipcMain.handle('desktop:openExternal', async (_, url: string) => {
    await shell.openExternal(url)
  })
}

const showFatalError = (error: unknown) => {
  console.error(error)
  const message = error instanceof Error ? error.message : 'Unknown error'
  dialog.showErrorBox('Wealth Tracker', message)
}

const gotSingleInstanceLock = app.requestSingleInstanceLock()

if (!gotSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    focusMainWindow()
  })

  app
    .whenReady()
    .then(async () => {
      registerIpcHandlers()
      await bootstrap()
    })
    .catch((error) => {
      showFatalError(error)
      app.quit()
    })

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      try {
        await bootstrap()
      } catch (error) {
        showFatalError(error)
      }
    }
  })

  app.on('before-quit', () => {
    isQuitting = true
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })

  app.on('will-quit', (event) => {
    if (isStoppingServer) {
      return
    }

    event.preventDefault()
    void shutdown()
      .catch(showFatalError)
      .finally(() => {
        if (!isQuitting) {
          app.quit()
          return
        }

        app.exit(0)
      })
  })
}
