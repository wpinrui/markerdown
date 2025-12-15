import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import * as path from 'path'
import * as fs from 'fs'

let mainWindow: BrowserWindow | null = null

const isDev = process.env.NODE_ENV !== 'production'
const settingsPath = path.join(app.getPath('userData'), 'settings.json')

function loadSettings(): { lastFolder?: string } {
  try {
    return JSON.parse(fs.readFileSync(settingsPath, 'utf-8'))
  } catch {
    return {}
  }
}

function saveSettings(settings: { lastFolder?: string }) {
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2))
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow()
  }
})

// IPC Handlers

ipcMain.handle('dialog:openFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory'],
  })
  if (result.canceled) return null
  return result.filePaths[0]
})

ipcMain.handle('fs:readDirectory', async (_event, dirPath: string) => {
  try {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true })
    return entries.map((entry) => ({
      name: entry.name,
      isDirectory: entry.isDirectory(),
      path: path.join(dirPath, entry.name),
    }))
  } catch (error) {
    console.error('Error reading directory:', error)
    return []
  }
})

ipcMain.handle('fs:readFile', async (_event, filePath: string) => {
  try {
    const content = await fs.promises.readFile(filePath, 'utf-8')
    return content
  } catch (error) {
    console.error('Error reading file:', error)
    return null
  }
})

ipcMain.handle('fs:exists', async (_event, filePath: string) => {
  try {
    await fs.promises.access(filePath)
    return true
  } catch {
    return false
  }
})

ipcMain.handle('settings:getLastFolder', () => {
  return loadSettings().lastFolder ?? null
})

ipcMain.handle('settings:setLastFolder', (_event, folderPath: string | null) => {
  const settings = loadSettings()
  settings.lastFolder = folderPath ?? undefined
  saveSettings(settings)
})
