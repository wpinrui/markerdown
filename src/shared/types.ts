export interface FileEntry {
  name: string
  isDirectory: boolean
  path: string
}

export const MARKDOWN_EXTENSION = '.md'
export const PDF_EXTENSION = '.pdf'
export const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov', '.avi', '.mkv']
export const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.ogg', '.m4a', '.flac']

export type EntityMemberType = 'markdown' | 'pdf' | 'video' | 'audio'

const MIME_TYPES: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.avi': 'video/x-msvideo',
  '.mkv': 'video/x-matroska',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.flac': 'audio/flac',
}

export function isMarkdownFile(name: string): boolean {
  return name.endsWith(MARKDOWN_EXTENSION)
}

export function isPdfFile(name: string): boolean {
  return name.endsWith(PDF_EXTENSION)
}

export function getVideoExtension(name: string): string | null {
  const lower = name.toLowerCase()
  return VIDEO_EXTENSIONS.find(ext => lower.endsWith(ext)) ?? null
}

export function getAudioExtension(name: string): string | null {
  const lower = name.toLowerCase()
  return AUDIO_EXTENSIONS.find(ext => lower.endsWith(ext)) ?? null
}

export function isVideoFile(name: string): boolean {
  return getVideoExtension(name) !== null
}

export function isAudioFile(name: string): boolean {
  return getAudioExtension(name) !== null
}

export function isMediaFile(name: string): boolean {
  return isVideoFile(name) || isAudioFile(name)
}

export function getMediaMimeType(name: string): string {
  const ext = name.toLowerCase().match(/\.[^.]+$/)?.[0] || ''
  return MIME_TYPES[ext] || 'application/octet-stream'
}

export interface EntityMember {
  path: string
  variant: string | null // null = default (no suffix)
  type: EntityMemberType
}

export interface Entity {
  baseName: string
  members: EntityMember[]
  defaultMember: EntityMember | null
}

export interface TreeNode {
  name: string
  path: string
  isDirectory: boolean
  hasSidecar: boolean // true if this .md file has a matching folder
  entity?: Entity // if this node represents an entity (grouped files)
  children?: TreeNode[]
  isSuggestion?: 'todos' | 'events' // if this is a suggestion draft file
}

export type FileChangeEventType = 'add' | 'addDir' | 'change' | 'unlink' | 'unlinkDir'

export interface FileChangeEvent {
  event: FileChangeEventType
  path: string
}

export function isStructureChange(eventType: FileChangeEventType): boolean {
  return eventType === 'add' || eventType === 'addDir' || eventType === 'unlink' || eventType === 'unlinkDir'
}

export interface SummarizeRequest {
  sourcePath: string
  outputPath: string
  prompt: string
  workingDir: string
}

export interface SummarizeResult {
  success: boolean
  error?: string
}

export interface AgentMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface AgentChatRequest {
  message: string
  workingDir: string
  sessionId?: string // If provided, resumes this session; if not, starts new session
  currentFilePath?: string // Currently opened file in the viewer
}

export interface AgentChatResponse {
  sessionId: string // The session ID for this conversation (new or resumed)
}

export interface AgentSession {
  sessionId: string
  timestamp: string // ISO-8601
  firstMessage: string // Preview of first user message
}

export interface AgentSessionHistory {
  messages: AgentMessage[]
}

export type EditMode = 'view' | 'visual' | 'code'

// Todo and Event types
export interface TodoItem {
  id: string
  text: string
  completed: boolean
  dueDate?: string  // YYYY-MM-DD or YYYY-MM-DD HH:mm
  notes?: string
  createdAt: string
}

export interface EventItem {
  id: string
  text: string
  startDate: string  // YYYY-MM-DD HH:mm
  endDate?: string   // YYYY-MM-DD HH:mm
  location?: string
  notes?: string
  createdAt: string
}

export interface ElectronAPI {
  openFolder: () => Promise<string | null>
  readDirectory: (dirPath: string) => Promise<FileEntry[]>
  readFile: (filePath: string) => Promise<string | null>
  writeFile: (filePath: string, content: string) => Promise<{ success: boolean; error?: string }>
  readPdfAsDataUrl: (filePath: string) => Promise<string | null>
  exists: (filePath: string) => Promise<boolean>
  getLastFolder: () => Promise<string | null>
  setLastFolder: (folderPath: string | null) => Promise<void>
  getShowClaudeMd: () => Promise<boolean>
  setShowClaudeMd: (show: boolean) => Promise<void>
  setWindowTitle: (title: string) => Promise<void>
  watchFolder: (folderPath: string) => Promise<void>
  unwatchFolder: () => Promise<void>
  openInExplorer: (folderPath: string) => Promise<void>
  mkdir: (dirPath: string) => Promise<{ success: boolean; error?: string }>
  move: (sourcePath: string, destPath: string) => Promise<{ success: boolean; error?: string }>
  deleteFile: (filePath: string) => Promise<{ success: boolean; error?: string }>
  deleteDir: (dirPath: string) => Promise<{ success: boolean; error?: string }>
  readOrder: (dirPath: string) => Promise<string[] | null>
  writeOrder: (dirPath: string, order: string[]) => Promise<{ success: boolean; error?: string }>
  saveImage: (markdownFilePath: string, imageData: string, extension: string) => Promise<{ success: boolean; relativePath?: string; error?: string }>
  onFileChange: (callback: (event: FileChangeEvent) => void) => () => void
  summarize: (request: SummarizeRequest) => Promise<SummarizeResult>
  agentChat: (request: AgentChatRequest) => Promise<AgentChatResponse>
  agentCancel: () => Promise<void>
  onAgentComplete: (callback: (error?: string) => void) => () => void
  getAgentSessions: (workingDir: string) => Promise<AgentSession[]>
  loadAgentSession: (workingDir: string, sessionId: string) => Promise<AgentSessionHistory>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
