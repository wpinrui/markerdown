import { useState } from 'react'

interface UseInlineEditReturn {
  editingId: string | null
  editText: string
  setEditText: (text: string) => void
  startEdit: (id: string, initialText: string) => void
  saveEdit: () => Promise<void>
  cancelEdit: () => void
}

export function useInlineEdit(
  onSave: (id: string, newText: string) => Promise<void>
): UseInlineEditReturn {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')

  const startEdit = (id: string, initialText: string) => {
    setEditingId(id)
    setEditText(initialText)
  }

  const saveEdit = async () => {
    if (!editingId || !editText.trim()) return

    await onSave(editingId, editText.trim())
    setEditingId(null)
    setEditText('')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditText('')
  }

  return {
    editingId,
    editText,
    setEditText,
    startEdit,
    saveEdit,
    cancelEdit,
  }
}
