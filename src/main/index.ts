import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import * as crypto from 'crypto'
import { spawn } from 'child_process'
import chokidar, { FSWatcher } from 'chokidar'
import type { SummarizeRequest, SummarizeResult, AgentChatRequest, AgentChatResponse, AgentSession, AgentSessionHistory, AgentMessage } from '@shared/types'
import * as os from 'os'
import * as readline from 'readline'
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
    const fullPrompt = `If "Agent Memory.md" exists in the current directory, read it first to understand the user's context and preferences.
Read the PDF at "${pdfPath}". Then create a markdown file at "${outputPath}" with the following:

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

ipcMain.handle('agent:chat', async (_event, request: AgentChatRequest): Promise<AgentChatResponse> => {
  const { message, workingDir, sessionId: existingSessionId } = request

  // Cancel any existing agent process
  cancelAgent()

  // Use existing session ID or generate a new one
  const sessionId = existingSessionId ?? crypto.randomUUID()

  const systemPrompt = `You are a helpful assistant that answers questions about the files in this directory.
When you need information, use your tools to list directories and read files.
Prefer reading .md files over .pdf files when both exist for the same topic.
If "Agent Memory.md" exists in the current directory, read it first to understand the user's context and preferences.
Be concise but thorough in your answers. Do not generate files - only answer verbally.`

  const args = [
    '--print',
    '--dangerously-skip-permissions',
    '--allowed-tools', 'Read',
    '--model', 'sonnet',
    '--setting-sources', 'user',
  ]

  // For new sessions, use --session-id; for existing sessions, use --resume
  if (existingSessionId) {
    args.push('--resume', sessionId)
  } else {
    args.push('--session-id', sessionId)
    args.push('--system-prompt', systemPrompt)
  }

  args.push(message)

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

  return { sessionId }
})

ipcMain.handle('agent:cancel', async (): Promise<void> => {
  cancelAgent()
})

// Encode project path the same way Claude CLI does
function encodeProjectPath(projectPath: string): string {
  // On Windows: C:\Users\... -> C--Users-...
  // Replace :\ with -- and remaining slashes with -
  return projectPath
    .replace(/:\\/g, '--')
    .replace(/[\\/]/g, '-')
}

function getSessionsDir(workingDir: string): string {
  const claudeDir = path.join(os.homedir(), '.claude', 'projects')
  const encodedPath = encodeProjectPath(workingDir)
  return path.join(claudeDir, encodedPath)
}

const MESSAGE_PREVIEW_LENGTH = 100

interface ContentBlock {
  type: string
  text?: string
}

interface SessionJsonLine {
  type?: string
  message?: {
    role?: string
    content?: string | ContentBlock[]
  }
  timestamp?: string
  sessionId?: string
}

function extractTextFromContent(content: string | ContentBlock[] | undefined): string | undefined {
  if (typeof content === 'string') {
    return content
  }
  if (Array.isArray(content)) {
    const textBlock = content.find((block) => block.type === 'text')
    return textBlock?.text
  }
  return undefined
}

async function parseSessionMetadata(filePath: string): Promise<{ timestamp: string; firstMessage: string } | null> {
  return new Promise((resolve) => {
    const stream = fs.createReadStream(filePath, { encoding: 'utf-8' })
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity })

    let timestamp: string | null = null
    let firstMessage: string | null = null

    rl.on('line', (line) => {
      if (firstMessage) return // Already found what we need

      try {
        const data: SessionJsonLine = JSON.parse(line)

        // Get timestamp from first line
        if (!timestamp && data.timestamp) {
          timestamp = data.timestamp
        }

        // Get first user message
        if (data.type === 'user' && data.message?.role === 'user') {
          const text = extractTextFromContent(data.message.content)
          if (text) {
            firstMessage = text.slice(0, MESSAGE_PREVIEW_LENGTH)
            rl.close()
            stream.close()
          }
        }
      } catch {
        // Skip malformed lines
      }
    })

    rl.on('close', () => {
      if (timestamp && firstMessage) {
        resolve({ timestamp, firstMessage })
      } else {
        resolve(null)
      }
    })

    rl.on('error', () => resolve(null))
    stream.on('error', () => resolve(null))
  })
}

ipcMain.handle('agent:getSessions', async (_event, workingDir: string): Promise<AgentSession[]> => {
  try {
    const sessionsDir = getSessionsDir(workingDir)
    const files = await fs.promises.readdir(sessionsDir)
    const jsonlFiles = files.filter((f) => f.endsWith('.jsonl') && !f.startsWith('agent-'))

    const sessions: AgentSession[] = []

    for (const file of jsonlFiles) {
      const sessionId = file.replace('.jsonl', '')
      const filePath = path.join(sessionsDir, file)
      const metadata = await parseSessionMetadata(filePath)

      if (metadata) {
        sessions.push({
          sessionId,
          timestamp: metadata.timestamp,
          firstMessage: metadata.firstMessage,
        })
      }
    }

    // Sort by timestamp descending (newest first)
    sessions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    return sessions
  } catch (error) {
    console.error('Error getting sessions:', error)
    return []
  }
})

ipcMain.handle('agent:loadSession', async (_event, workingDir: string, sessionId: string): Promise<AgentSessionHistory> => {
  try {
    const sessionsDir = getSessionsDir(workingDir)
    const filePath = path.join(sessionsDir, `${sessionId}.jsonl`)

    const fileContent = await fs.promises.readFile(filePath, 'utf-8')
    const lines = fileContent.split('\n').filter((line) => line.trim())

    const messages: AgentMessage[] = []

    for (const line of lines) {
      try {
        const entry: SessionJsonLine = JSON.parse(line)

        if (entry.type === 'user' && entry.message?.role === 'user') {
          const text = extractTextFromContent(entry.message.content)
          if (text) {
            messages.push({ role: 'user', content: text })
          }
        } else if (entry.type === 'assistant' && entry.message?.role === 'assistant') {
          const text = extractTextFromContent(entry.message.content)
          if (text) {
            messages.push({ role: 'assistant', content: text })
          }
        }
      } catch {
        // Skip malformed lines
      }
    }

    return { messages }
  } catch (error) {
    console.error('Error loading session:', error)
    return { messages: [] }
  }
})
