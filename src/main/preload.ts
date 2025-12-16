import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'
import type { FileEntry, FileChangeEvent, SummarizeRequest, SummarizeResult, AgentChatRequest, AgentChatResponse, AgentSession, AgentSessionHistory } from '@shared/types'

contextBridge.exposeInMainWorld('electronAPI', {
  openFolder: (): Promise<string | null> => ipcRenderer.invoke('dialog:openFolder'),
  readDirectory: (dirPath: string): Promise<FileEntry[]> =>
    ipcRenderer.invoke('fs:readDirectory', dirPath),
  readFile: (filePath: string): Promise<string | null> =>
    ipcRenderer.invoke('fs:readFile', filePath),
  writeFile: (filePath: string, content: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('fs:writeFile', filePath, content),
  readPdfAsDataUrl: (filePath: string): Promise<string | null> =>
    ipcRenderer.invoke('fs:readPdfAsDataUrl', filePath),
  exists: (filePath: string): Promise<boolean> => ipcRenderer.invoke('fs:exists', filePath),
  getLastFolder: (): Promise<string | null> => ipcRenderer.invoke('settings:getLastFolder'),
  setLastFolder: (folderPath: string | null): Promise<void> =>
    ipcRenderer.invoke('settings:setLastFolder', folderPath),
  getShowClaudeMd: (): Promise<boolean> => ipcRenderer.invoke('settings:getShowClaudeMd'),
  setShowClaudeMd: (show: boolean): Promise<void> =>
    ipcRenderer.invoke('settings:setShowClaudeMd', show),
  watchFolder: (folderPath: string): Promise<void> =>
    ipcRenderer.invoke('fs:watchFolder', folderPath),
  unwatchFolder: (): Promise<void> => ipcRenderer.invoke('fs:unwatchFolder'),
  openInExplorer: (folderPath: string): Promise<void> =>
    ipcRenderer.invoke('shell:openInExplorer', folderPath),
  mkdir: (dirPath: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('fs:mkdir', dirPath),
  move: (sourcePath: string, destPath: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('fs:move', sourcePath, destPath),
  deleteFile: (filePath: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('fs:delete', filePath),
  deleteDir: (dirPath: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('fs:deleteDir', dirPath),
  onFileChange: (callback: (event: FileChangeEvent) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, data: FileChangeEvent) => callback(data)
    ipcRenderer.on('fs:changed', listener)
    return () => ipcRenderer.removeListener('fs:changed', listener)
  },
  summarize: (request: SummarizeRequest): Promise<SummarizeResult> =>
    ipcRenderer.invoke('claude:summarize', request),
  agentChat: (request: AgentChatRequest): Promise<AgentChatResponse> =>
    ipcRenderer.invoke('agent:chat', request),
  agentCancel: (): Promise<void> => ipcRenderer.invoke('agent:cancel'),
  onAgentComplete: (callback: (error?: string) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, error?: string) => callback(error)
    ipcRenderer.on('agent:complete', listener)
    return () => ipcRenderer.removeListener('agent:complete', listener)
  },
  getAgentSessions: (workingDir: string): Promise<AgentSession[]> =>
    ipcRenderer.invoke('agent:getSessions', workingDir),
  loadAgentSession: (workingDir: string, sessionId: string): Promise<AgentSessionHistory> =>
    ipcRenderer.invoke('agent:loadSession', workingDir, sessionId),
})
