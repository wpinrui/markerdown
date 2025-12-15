export interface FileEntry {
  name: string
  isDirectory: boolean
  path: string
}

export const MARKDOWN_EXTENSION = '.md'

export function isMarkdownFile(name: string): boolean {
  return name.endsWith(MARKDOWN_EXTENSION)
}

export interface TreeNode {
  name: string
  path: string
  isDirectory: boolean
  hasSidecar: boolean // true if this .md file has a matching folder
  children?: TreeNode[]
}

export interface ElectronAPI {
  openFolder: () => Promise<string | null>
  readDirectory: (dirPath: string) => Promise<FileEntry[]>
  readFile: (filePath: string) => Promise<string | null>
  exists: (filePath: string) => Promise<boolean>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
