import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import { spawn } from 'child_process'
import chokidar, { FSWatcher } from 'chokidar'
import type { SummarizeRequest, SummarizeResult, AgentChatRequest } from '@shared/types'
import type { ChildProcess } from 'child_process'

let mainWindow: BrowserWindow | null = null
let watcher: FSWatcher | null = null
let agentProcess: ChildProcess | null = null

function closeWatcher() {
  if (watcher) {
    watcher.close()
    watcher = null
  }
}

const isDev = process.env.NODE_ENV !== 'production'
const settingsPath = path.join(app.getPath('userData'), 'settings.json')

interface Settings {
  lastFolder?: string
}

function loadSettings(): Settings {
  try {
    return JSON.parse(fs.readFileSync(settingsPath, 'utf-8'))
  } catch {
    return {}
  }
}

function saveSettings(settings: Settings) {
  try {
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2))
  } catch (error) {
    console.error('Failed to save settings:', error)
  }
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
      plugins: true,
    },
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    closeWatcher()
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

ipcMain.handle('fs:readPdfAsDataUrl', async (_event, filePath: string) => {
  try {
    const buffer = await fs.promises.readFile(filePath)
    const base64 = buffer.toString('base64')
    return `data:application/pdf;base64,${base64}`
  } catch (error) {
    console.error('Error reading PDF:', error)
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

ipcMain.handle('fs:watchFolder', (_event, folderPath: string) => {
  closeWatcher()

  watcher = chokidar.watch(folderPath, {
    ignored: /(^|[\/\\])\../, // ignore dotfiles
    persistent: true,
    ignoreInitial: true,
  })

  watcher.on('all', (event, filePath) => {
    mainWindow?.webContents.send('fs:changed', { event, path: filePath })
  })

  watcher.on('error', (error) => {
    console.error('File watcher error:', error)
  })
})

ipcMain.handle('fs:unwatchFolder', () => {
  closeWatcher()
})

ipcMain.handle('claude:summarize', async (_event, request: SummarizeRequest): Promise<SummarizeResult> => {
  const { pdfPath, outputPath, prompt, workingDir } = request

  // Check if output already exists
  try {
    await fs.promises.access(outputPath)
    return { success: false, error: 'Output file already exists' }
  } catch {
    // File doesn't exist, good to proceed
  }

  return new Promise((resolve) => {
    const fullPrompt = `Read the PDF at "${pdfPath}". Then create a markdown file at "${outputPath}" with the following:

${prompt}`

    const args = [
      '--print',
      '--dangerously-skip-permissions',
      '--allowed-tools', 'Read,Write',
      '--model', 'sonnet',
      fullPrompt,
    ]

    const child = spawn('claude', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: workingDir,
    })

    let stderr = ''

    child.stdout.on('data', (data) => {
      console.log(data.toString())
    })

    child.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    child.on('close', async (code) => {
      if (code === 0) {
        resolve({ success: true })
      } else {
        resolve({ success: false, error: stderr || `Process exited with code ${code}` })
      }
    })

    child.on('error', (err) => {
      resolve({ success: false, error: `Failed to spawn Claude CLI: ${err.message}` })
    })
  })
})

function cancelAgent() {
  if (agentProcess) {
    agentProcess.kill()
    agentProcess = null
  }
}

ipcMain.handle('agent:chat', async (_event, request: AgentChatRequest): Promise<void> => {
  const { message, workingDir } = request

  // Cancel any existing agent process
  cancelAgent()

  const systemPrompt = `You are a helpful assistant that answers questions about the files in this directory.
When you need information, use your tools to list directories and read files.
Prefer reading .md files over .pdf files when both exist for the same topic.
Be concise but thorough in your answers.`

  const args = [
    '--print',
    '--dangerously-skip-permissions',
    '--model', 'sonnet',
    '-p', systemPrompt,
    message,
  ]

  agentProcess = spawn('claude', args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: workingDir,
  })

  agentProcess.stdout?.on('data', (data: Buffer) => {
    mainWindow?.webContents.send('agent:chunk', data.toString())
  })

  agentProcess.stderr?.on('data', (data: Buffer) => {
    // Log stderr but don't send to renderer (usually just progress info)
    console.error('Agent stderr:', data.toString())
  })

  agentProcess.on('close', (code) => {
    if (code === 0) {
      mainWindow?.webContents.send('agent:complete')
    } else {
      mainWindow?.webContents.send('agent:complete', `Process exited with code ${code}`)
    }
    agentProcess = null
  })

  agentProcess.on('error', (err) => {
    mainWindow?.webContents.send('agent:complete', `Failed to spawn Claude CLI: ${err.message}`)
    agentProcess = null
  })
})

ipcMain.handle('agent:cancel', async (): Promise<void> => {
  cancelAgent()
})
