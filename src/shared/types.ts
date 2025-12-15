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

export interface ElectronAPI {
  openFolder: () => Promise<string | null>
  readDirectory: (dirPath: string) => Promise<FileEntry[]>
  readFile: (filePath: string) => Promise<string | null>
  exists: (filePath: string) => Promise<boolean>
  getLastFolder: () => Promise<string | null>
  setLastFolder: (folderPath: string | null) => Promise<void>
  watchFolder: (folderPath: string) => Promise<void>
  unwatchFolder: () => Promise<void>
  onFileChange: (callback: (event: FileChangeEvent) => void) => () => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
