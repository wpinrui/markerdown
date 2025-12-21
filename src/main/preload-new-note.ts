import { contextBridge, ipcRenderer } from 'electron'
import type { TreeNode } from '../shared/types'

contextBridge.exposeInMainWorld('newNoteAPI', {
  getInitialData: (): Promise<{ treeNodes: TreeNode[]; selectedPath: string | null }> =>
    ipcRenderer.invoke('new-note:getInitialData'),
  submit: (name: string, parentPath: string | null, childrenPaths: string[]): void => {
    ipcRenderer.send('new-note:submit', { name, parentPath, childrenPaths })
  },
  cancel: (): void => {
    ipcRenderer.send('new-note:cancel')
  },
})
