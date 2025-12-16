export interface FileEntry {
  name: string
  isDirectory: boolean
  path: string
}

export const MARKDOWN_EXTENSION = '.md'
export const PDF_EXTENSION = '.pdf'

export function isMarkdownFile(name: string): boolean {
  return name.endsWith(MARKDOWN_EXTENSION)
}

export function isPdfFile(name: string): boolean {
  return name.endsWith(PDF_EXTENSION)
}

export interface EntityMember {
  path: string
  variant: string | null // null = default (no suffix)
  type: 'markdown' | 'pdf'
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
  pdfPath: string
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

export interface ElectronAPI {
  openFolder: () => Promise<string | null>
  readDirectory: (dirPath: string) => Promise<FileEntry[]>
  readFile: (filePath: string) => Promise<string | null>
  writeFile: (filePath: string, content: string) => Promise<{ success: boolean; error?: string }>
  readPdfAsDataUrl: (filePath: string) => Promise<string | null>
  exists: (filePath: string) => Promise<boolean>
  getLastFolder: () => Promise<string | null>
  setLastFolder: (folderPath: string | null) => Promise<void>
  watchFolder: (folderPath: string) => Promise<void>
  unwatchFolder: () => Promise<void>
  onFileChange: (callback: (event: FileChangeEvent) => void) => () => void
  summarizePdf: (request: SummarizeRequest) => Promise<SummarizeResult>
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
