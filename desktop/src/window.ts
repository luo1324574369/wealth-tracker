import path from 'path'
import { BrowserWindow, shell } from 'electron'

const isSameOrigin = (targetUrl: string, currentUrl: string) => {
  try {
    const target = new URL(targetUrl)
    const current = new URL(currentUrl)
    return target.origin === current.origin
  } catch (error) {
    return false
  }
}

export const createMainWindow = async (url: string) => {
  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1200,
    minHeight: 760,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
      sandbox: true,
    },
  })

  window.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
    void shell.openExternal(targetUrl)
    return { action: 'deny' }
  })

  window.webContents.on('will-navigate', (event, targetUrl) => {
    if (!isSameOrigin(targetUrl, url)) {
      event.preventDefault()
      void shell.openExternal(targetUrl)
    }
  })

  window.once('ready-to-show', () => {
    window.show()
  })

  await window.loadURL(url)

  return window
}
