import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, Edit2 } from 'lucide-react'
import { MARKERDOWN_DIR } from '@shared/types'
import type { TodoItem } from '@shared/types'
import { NewTodoModal } from './NewTodoModal'
import { formatDateForDisplay } from '../utils/dateUtils'
import { InlineEditInput } from './InlineEditInput'
import { useInlineEdit } from '../hooks/useInlineEdit'

type FilterMode = 'all' | 'incomplete' | 'completed'

interface TodoPanelProps {
  workingDir: string | null
  style?: React.CSSProperties
}

// Parse todos from markdown format
function parseTodos(content: string): TodoItem[] {
  const todos: TodoItem[] = []
  const lines = content.split('\n')
  let currentTodo: Partial<TodoItem> | null = null

  for (const line of lines) {
    // Match todo line: - [ ] or - [x]
    const todoMatch = line.match(/^- \[([ x])\] (.+)$/)
    if (todoMatch) {
      // Save previous todo if exists
      if (currentTodo && currentTodo.id && currentTodo.text) {
        todos.push(currentTodo as TodoItem)
      }
      currentTodo = {
        id: crypto.randomUUID(),
        text: todoMatch[2],
        completed: todoMatch[1] === 'x',
        createdAt: new Date().toISOString(),
      }
      continue
    }

    // Match metadata lines (indented with 2 spaces)
    if (currentTodo) {
      const dueMatch = line.match(/^\s+Due: (.+)$/)
      if (dueMatch) {
        currentTodo.dueDate = dueMatch[1]
        continue
      }

      const notesMatch = line.match(/^\s+Notes: (.+)$/)
      if (notesMatch) {
        currentTodo.notes = notesMatch[1]
        continue
      }
    }
  }

  // Don't forget the last todo
  if (currentTodo && currentTodo.id && currentTodo.text) {
    todos.push(currentTodo as TodoItem)
  }

  return todos
}

// Serialize todos to markdown format
function serializeTodos(todos: TodoItem[]): string {
  return todos.map((todo) => {
    const checkbox = todo.completed ? '[x]' : '[ ]'
    let result = `- ${checkbox} ${todo.text}`
    if (todo.dueDate) {
      result += `\n  Due: ${todo.dueDate}`
    }
    if (todo.notes) {
      result += `\n  Notes: ${todo.notes}`
    }
    return result
  }).join('\n\n') + '\n'
}

// Sort todos: incomplete by due date (soonest first), then completed at bottom
function sortTodos(todos: TodoItem[]): TodoItem[] {
  return [...todos].sort((a, b) => {
    // Completed items go to bottom
    if (a.completed !== b.completed) {
      return a.completed ? 1 : -1
    }
    // Sort by due date (items without due date go after those with)
    if (a.dueDate && b.dueDate) {
      return a.dueDate.localeCompare(b.dueDate)
    }
    if (a.dueDate) return -1
    if (b.dueDate) return 1
    return 0
  })
}

export function TodoPanel({ workingDir, style }: TodoPanelProps) {
  const [todos, setTodos] = useState<TodoItem[]>([])
  const [filter, setFilter] = useState<FilterMode>('all')
  const [showNewModal, setShowNewModal] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  // Load todos from file
  const loadTodos = useCallback(async () => {
    if (!workingDir) return

    const filePath = `${workingDir}/${MARKERDOWN_DIR}/todos.md`
    const content = await window.electronAPI.readFile(filePath)
    if (content) {
      setTodos(parseTodos(content))
    } else {
      setTodos([])
    }
  }, [workingDir])

  // Save todos to file
  const saveTodos = useCallback(async (newTodos: TodoItem[]) => {
    if (!workingDir) return

    const dirPath = `${workingDir}/${MARKERDOWN_DIR}`
    const filePath = `${dirPath}/todos.md`

    // Ensure directory exists
    await window.electronAPI.mkdir(dirPath)
    await window.electronAPI.writeFile(filePath, serializeTodos(newTodos))
  }, [workingDir])

  // Load on mount and when workingDir changes
  useEffect(() => {
    loadTodos()
  }, [loadTodos])

  // Watch for file changes
  useEffect(() => {
    if (!workingDir) return

    // Normalize to forward slashes for comparison (works on all platforms)
    const watchPath = `${workingDir}/${MARKERDOWN_DIR}/todos.md`.replace(/\\/g, '/')

    const unsubscribe = window.electronAPI.onFileChange((event) => {
      const changedPath = event.path.replace(/\\/g, '/')
      if (changedPath === watchPath) {
        loadTodos()
      }
    })

    return unsubscribe
  }, [workingDir, loadTodos])

  const handleToggleComplete = async (id: string) => {
    const newTodos = todos.map((t) =>
      t.id === id ? { ...t, completed: !t.completed } : t
    )
    setTodos(newTodos)
    await saveTodos(newTodos)
  }

  const handleDelete = async (id: string) => {
    const newTodos = todos.filter((t) => t.id !== id)
    setTodos(newTodos)
    await saveTodos(newTodos)
    setDeleteConfirmId(null)
  }

  const handleAddTodo = async (todo: Omit<TodoItem, 'id' | 'createdAt'>) => {
    const newTodo: TodoItem = {
      ...todo,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    }
    const newTodos = [...todos, newTodo]
    setTodos(newTodos)
    await saveTodos(newTodos)
    setShowNewModal(false)
  }

  // Inline edit state
  const handleEditSave = useCallback(async (id: string, newText: string) => {
    const newTodos = todos.map((t) =>
      t.id === id ? { ...t, text: newText } : t
    )
    setTodos(newTodos)
    await saveTodos(newTodos)
  }, [todos, saveTodos])

  const { editingId, editText, setEditText, startEdit, saveEdit, cancelEdit } = useInlineEdit(handleEditSave)

  // Filter todos
  const filteredTodos = todos.filter((todo) => {
    if (filter === 'incomplete') return !todo.completed
    if (filter === 'completed') return todo.completed
    return true
  })

  const sortedTodos = sortTodos(filteredTodos)

  if (!workingDir) {
    return (
      <div className="todo-panel" style={style}>
        <div className="todo-empty">Open a folder to use todos</div>
      </div>
    )
  }

  return (
    <div className="todo-panel" style={style}>
      <div className="todo-header">
        <span className="todo-title">Todos</span>
        <button
          className="todo-add-btn"
          onClick={() => setShowNewModal(true)}
          title="New Todo"
        >
          <Plus size={16} />
        </button>
      </div>

      <div className="todo-filters">
        <button
          className={`todo-filter-btn ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All
        </button>
        <button
          className={`todo-filter-btn ${filter === 'incomplete' ? 'active' : ''}`}
          onClick={() => setFilter('incomplete')}
        >
          Incomplete
        </button>
        <button
          className={`todo-filter-btn ${filter === 'completed' ? 'active' : ''}`}
          onClick={() => setFilter('completed')}
        >
          Completed
        </button>
      </div>

      <div className="todo-list">
        {sortedTodos.length === 0 ? (
          <div className="todo-empty">
            {filter === 'all' ? 'No todos yet' : `No ${filter} todos`}
          </div>
        ) : (
          sortedTodos.map((todo) => {
            const isEditing = editingId === todo.id

            return (
              <div
                key={todo.id}
                className={`todo-item ${todo.completed ? 'completed' : ''}`}
              >
                <div className="todo-item-main">
                  <input
                    type="checkbox"
                    checked={todo.completed}
                    onChange={() => handleToggleComplete(todo.id)}
                    className="todo-checkbox"
                  />
                  {isEditing ? (
                    <InlineEditInput
                      value={editText}
                      onChange={setEditText}
                      onSave={saveEdit}
                      onCancel={cancelEdit}
                      placeholder="Todo text"
                      className="todo-edit-input"
                    />
                  ) : (
                    <>
                      <span className="todo-text">{todo.text}</span>
                      {todo.dueDate && (
                        <span className="todo-due">{formatDateForDisplay(todo.dueDate)}</span>
                      )}
                      <button
                        type="button"
                        className="todo-edit-btn"
                        onClick={() => startEdit(todo.id, todo.text)}
                        title="Edit"
                      >
                        <Edit2 size={14} />
                      </button>
                      {deleteConfirmId === todo.id ? (
                        <div className="todo-delete-confirm">
                          <button type="button" onClick={() => handleDelete(todo.id)}>Yes</button>
                          <button type="button" onClick={() => setDeleteConfirmId(null)}>No</button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="todo-delete-btn"
                          onClick={() => setDeleteConfirmId(todo.id)}
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </>
                  )}
                </div>
                {!isEditing && todo.notes && (
                  <div className="todo-notes">{todo.notes}</div>
                )}
              </div>
            )
          })
        )}
      </div>

      <NewTodoModal
        isOpen={showNewModal}
        onClose={() => setShowNewModal(false)}
        onSubmit={handleAddTodo}
      />
    </div>
  )
}
