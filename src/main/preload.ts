import { contextBridge, ipcRenderer } from 'electron'

export interface FileEntry {
  name: string
  isDirectory: boolean
  path: string
}

contextBridge.exposeInMainWorld('electronAPI', {
  openFolder: (): Promise<string | null> => ipcRenderer.invoke('dialog:openFolder'),
  readDirectory: (dirPath: string): Promise<FileEntry[]> =>
    ipcRenderer.invoke('fs:readDirectory', dirPath),
  readFile: (filePath: string): Promise<string | null> =>
    ipcRenderer.invoke('fs:readFile', filePath),
  exists: (filePath: string): Promise<boolean> => ipcRenderer.invoke('fs:exists', filePath),
  getLastFolder: (): Promise<string | null> => ipcRenderer.invoke('settings:getLastFolder'),
  setLastFolder: (folderPath: string | null): Promise<void> =>
    ipcRenderer.invoke('settings:setLastFolder', folderPath),
})
