import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import * as crypto from 'crypto'
import { spawn } from 'child_process'
import chokidar, { FSWatcher } from 'chokidar'
import type { SummarizeRequest, SummarizeResult, AgentChatRequest, AgentChatResponse, AgentSession, AgentSessionHistory, AgentMessage } from '@shared/types'
import { getSummarizePrompt, CLAUDE_MD_TEMPLATE } from '../shared/prompts'
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
const MARKERDOWN_DIR = '.markerdown'
const TODOS_FILE = 'todos.md'
const EVENTS_FILE = 'events.md'
const CLAUDE_MD_FILE = 'claude.md'
const CLAUDE_MD_PREFIX = 'First read claude.md in this directory for project-specific instructions. DO NOT COMMENT that you will be reading it.'
const IMAGES_DIR = '.images'
const IMAGE_FILENAME_PREFIX = 'image-'
const IMAGE_DATA_URL_PREFIX = /^data:image\/\w+;base64,/
const RANDOM_BYTES_LENGTH = 4 // For unique filename generation
const CLAUDE_MD_RESPOND_MARKER = 'USER_MESSAGE:'

// Strip our internal prefix from user messages for display
function stripMessagePrefix(text: string | undefined): string | undefined {
  if (!text) return text
  // Match our prefix pattern: CLAUDE_MD_PREFIX + optional file context + USER_MESSAGE: + actual message
  const markerIndex = text.indexOf(CLAUDE_MD_RESPOND_MARKER)
  if (markerIndex !== -1) {
    return text.slice(markerIndex + CLAUDE_MD_RESPOND_MARKER.length).trimStart()
  }
  return text
}

async function readMarkerdownFile(workingDir: string, filename: string): Promise<string | null> {
  try {
    const filePath = path.join(workingDir, MARKERDOWN_DIR, filename)
    return await fs.promises.readFile(filePath, 'utf-8')
  } catch {
    return null
  }
}

async function ensureClaudeMd(workingDir: string): Promise<void> {
  const claudeMdPath = path.join(workingDir, CLAUDE_MD_FILE)
  try {
    await fs.promises.access(claudeMdPath)
  } catch {
    // File doesn't exist, create it
    await fs.promises.writeFile(claudeMdPath, CLAUDE_MD_TEMPLATE)
  }
}

interface Settings {
  lastFolder?: string
  showClaudeMd?: boolean
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
    icon: path.join(__dirname, '../../logo.ico'),
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
    cancelAgent()
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

ipcMain.handle('fs:writeFile', async (_event, filePath: string, content: string) => {
  try {
    await fs.promises.writeFile(filePath, content, 'utf-8')
    return { success: true }
  } catch (error) {
    console.error('Error writing file:', error)
    return { success: false, error: String(error) }
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

ipcMain.handle('settings:getShowClaudeMd', () => {
  return loadSettings().showClaudeMd ?? false
})

ipcMain.handle('settings:setShowClaudeMd', (_event, show: boolean) => {
  const settings = loadSettings()
  settings.showClaudeMd = show
  saveSettings(settings)
})

ipcMain.handle('window:setTitle', (_event, title: string) => {
  if (mainWindow) {
    mainWindow.setTitle(title)
  }
})

ipcMain.handle('fs:watchFolder', (_event, folderPath: string) => {
  closeWatcher()

  watcher = chokidar.watch(folderPath, {
    ignored: (filePath: string) => {
      // Allow .markerdown folder, ignore other dotfiles
      if (filePath.includes('.markerdown')) return false
      return /(^|[\/\\])\./.test(filePath)
    },
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

ipcMain.handle('shell:openInExplorer', async (_event, filePath: string) => {
  shell.showItemInFolder(filePath)
})

ipcMain.handle('fs:mkdir', async (_event, dirPath: string) => {
  try {
    await fs.promises.mkdir(dirPath, { recursive: true })
    return { success: true }
  } catch (error) {
    console.error('Error creating directory:', error)
    return { success: false, error: String(error) }
  }
})

ipcMain.handle('fs:move', async (_event, sourcePath: string, destPath: string) => {
  try {
    await fs.promises.rename(sourcePath, destPath)
    return { success: true }
  } catch (error) {
    console.error('Error moving file:', error)
    return { success: false, error: String(error) }
  }
})

ipcMain.handle('fs:delete', async (_event, filePath: string) => {
  try {
    await fs.promises.unlink(filePath)
    return { success: true }
  } catch (error) {
    console.error('Error deleting file:', error)
    return { success: false, error: String(error) }
  }
})

ipcMain.handle('fs:deleteDir', async (_event, dirPath: string) => {
  try {
    await fs.promises.rm(dirPath, { recursive: true })
    return { success: true }
  } catch (error) {
    console.error('Error deleting directory:', error)
    return { success: false, error: String(error) }
  }
})

ipcMain.handle('fs:saveImage', async (_event, markdownFilePath: string, imageData: string, extension: string) => {
  try {
    // Create .images folder next to the markdown file
    const markdownDir = path.dirname(markdownFilePath)
    const imagesDir = path.join(markdownDir, IMAGES_DIR)
    await fs.promises.mkdir(imagesDir, { recursive: true })

    // Generate unique filename based on timestamp and random string
    const timestamp = Date.now()
    const randomStr = crypto.randomBytes(RANDOM_BYTES_LENGTH).toString('hex')
    const filename = `${IMAGE_FILENAME_PREFIX}${timestamp}-${randomStr}${extension}`
    const imagePath = path.join(imagesDir, filename)

    // Convert base64 data URL to buffer and save
    const base64Data = imageData.replace(IMAGE_DATA_URL_PREFIX, '')
    const buffer = Buffer.from(base64Data, 'base64')
    await fs.promises.writeFile(imagePath, buffer)

    // Return relative path for markdown
    const relativePath = `${IMAGES_DIR}/${filename}`
    return { success: true, relativePath }
  } catch (error) {
    console.error('Error saving image:', error)
    return { success: false, error: String(error) }
  }
})

async function getSessionFiles(sessionsDir: string): Promise<Set<string>> {
  try {
    const files = await fs.promises.readdir(sessionsDir)
    return new Set(files.filter((f) => f.endsWith('.jsonl')))
  } catch {
    return new Set()
  }
}

async function cleanupSummarizeSession(sessionsDir: string, beforeFiles: Set<string>, chatSessionIds: Set<string>): Promise<void> {
  try {
    const afterFiles = await getSessionFiles(sessionsDir)
    for (const file of afterFiles) {
      const sessionId = file.replace('.jsonl', '')
      const isChatSession = chatSessionIds.has(sessionId)
      const isAgentFile = file.startsWith('agent-')
      const isNewFile = !beforeFiles.has(file)

      // Only delete new files that aren't chat sessions or agent files
      if (isNewFile && !isChatSession && !isAgentFile) {
        await fs.promises.unlink(path.join(sessionsDir, file))
      }
    }
  } catch {
    // Ignore cleanup errors
  }
}

ipcMain.handle('claude:summarize', async (_event, request: SummarizeRequest): Promise<SummarizeResult> => {
  const { sourcePath, outputPath, prompt, workingDir } = request

  // Check if output already exists
  try {
    await fs.promises.access(outputPath)
    return { success: false, error: 'Output file already exists' }
  } catch {
    // File doesn't exist, good to proceed
  }

  // Ensure claude.md exists for Claude Code integration
  await ensureClaudeMd(workingDir)

  const todosContext = await readMarkerdownFile(workingDir, TODOS_FILE)
  const eventsContext = await readMarkerdownFile(workingDir, EVENTS_FILE)

  // Snapshot existing session files and chat sessions before running Claude CLI
  const sessionsDir = getSessionsDir(workingDir)
  const beforeFiles = await getSessionFiles(sessionsDir)
  const chatSessionIds = await getChatSessionIds(workingDir)

  return new Promise((resolve) => {
    const taskPrompt = getSummarizePrompt(sourcePath, outputPath, prompt, todosContext ?? '', eventsContext ?? '')
    const fullPrompt = `${CLAUDE_MD_PREFIX} ${taskPrompt}`

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
      // Clean up session files created by this summarization
      await cleanupSummarizeSession(sessionsDir, beforeFiles, chatSessionIds)

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
  const { message, workingDir, sessionId: existingSessionId, currentFilePath } = request

  // Cancel any existing agent process
  cancelAgent()

  // Ensure claude.md exists for Claude Code integration
  await ensureClaudeMd(workingDir)

  // Use existing session ID or generate a new one
  const sessionId = existingSessionId ?? crypto.randomUUID()

  const args = [
    '--print',
    '--dangerously-skip-permissions',
    '--allowed-tools', 'Read,Write',
    '--model', 'sonnet',
    '--setting-sources', 'user',
  ]

  // For new sessions, use --session-id; for existing sessions, use --resume
  if (existingSessionId) {
    args.push('--resume', sessionId)
  } else {
    args.push('--session-id', sessionId)
    // Track this as our chat session
    await addChatSessionId(workingDir, sessionId)
  }

  // Prefix message with instruction to read claude.md and context about current file
  const currentFileContext = currentFilePath ? ` The user currently has "${currentFilePath}" open.` : ''
  const prefixedMessage = `${CLAUDE_MD_PREFIX}${currentFileContext} ${CLAUDE_MD_RESPOND_MARKER} ${message}`
  args.push(prefixedMessage)

  agentProcess = spawn('claude', args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: workingDir,
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

// Track our chat session IDs (separate from Claude CLI's session management)
function getChatSessionsMetadataPath(workingDir: string): string {
  const sessionsDir = getSessionsDir(workingDir)
  return path.join(sessionsDir, 'markerdown-chat-sessions.json')
}

async function getChatSessionIds(workingDir: string): Promise<Set<string>> {
  try {
    const metadataPath = getChatSessionsMetadataPath(workingDir)
    const content = await fs.promises.readFile(metadataPath, 'utf-8')
    const parsed: unknown = JSON.parse(content)
    if (!Array.isArray(parsed)) {
      return new Set()
    }
    return new Set(parsed.filter((id): id is string => typeof id === 'string'))
  } catch {
    return new Set()
  }
}

async function addChatSessionId(workingDir: string, sessionId: string): Promise<void> {
  const ids = await getChatSessionIds(workingDir)
  ids.add(sessionId)
  const metadataPath = getChatSessionsMetadataPath(workingDir)
  const sessionsDir = getSessionsDir(workingDir)
  await fs.promises.mkdir(sessionsDir, { recursive: true })
  await fs.promises.writeFile(metadataPath, JSON.stringify([...ids], null, 2))
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
          const rawText = extractTextFromContent(data.message.content)
          const text = stripMessagePrefix(rawText)
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
    const chatSessionIds = await getChatSessionIds(workingDir)

    if (chatSessionIds.size === 0) {
      return []
    }

    const sessions: AgentSession[] = []

    for (const sessionId of chatSessionIds) {
      const filePath = path.join(sessionsDir, `${sessionId}.jsonl`)
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
          const rawText = extractTextFromContent(entry.message.content)
          const text = stripMessagePrefix(rawText)
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
