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

export interface TreeNode {
  name: string
  path: string
  isDirectory: boolean
  hasSidecar: boolean // true if this .md file has a matching folder
  children?: TreeNode[]
}

export interface FileChangeEvent {
  event: 'add' | 'addDir' | 'change' | 'unlink' | 'unlinkDir'
  path: string
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
