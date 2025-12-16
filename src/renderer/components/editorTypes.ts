/**
 * Shared types for the markdown editor components.
 */

export interface ActiveFormats {
  bold: boolean
  italic: boolean
  strikethrough: boolean
  code: boolean
  link: boolean
  headingLevel: number | null
  bulletList: boolean
  orderedList: boolean
  taskList: boolean
  blockquote: boolean
  codeBlock: boolean
}

export const defaultFormats: ActiveFormats = {
  bold: false,
  italic: false,
  strikethrough: false,
  code: false,
  link: false,
  headingLevel: null,
  bulletList: false,
  orderedList: false,
  taskList: false,
  blockquote: false,
  codeBlock: false,
}
