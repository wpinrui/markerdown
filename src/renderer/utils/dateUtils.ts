// Date formatting utilities for datetime-local inputs

/**
 * Format a Date for datetime-local input (YYYY-MM-DDTHH:mm)
 */
export function formatDateForInput(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

/**
 * Convert datetime-local value to storage format (YYYY-MM-DD HH:mm)
 */
export function formatDateForStorage(datetimeLocal: string): string {
  if (!datetimeLocal) return ''
  return datetimeLocal.replace('T', ' ')
}
