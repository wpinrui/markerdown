import {
  isMarkdownFile,
  isPdfFile,
  getVideoExtension,
  getAudioExtension,
  MARKDOWN_EXTENSION,
  PDF_EXTENSION,
  IMAGES_DIR,
  CLAUDE_DIR,
  MARKERDOWN_DIR,
} from './types'
import type { FileEntry, TreeNode, Entity, EntityMember, EntityMemberType } from './types'

/**
 * Parse entity info from a filename.
 * Returns fullBaseName (without extension) and file type.
 */
function parseFileInfo(
  filename: string
): { fullBaseName: string; type: EntityMemberType } | null {
  if (isPdfFile(filename)) {
    return { fullBaseName: filename.slice(0, -PDF_EXTENSION.length), type: 'pdf' }
  }
  if (isMarkdownFile(filename)) {
    return { fullBaseName: filename.slice(0, -MARKDOWN_EXTENSION.length), type: 'markdown' }
  }
  const videoExt = getVideoExtension(filename)
  if (videoExt) {
    return { fullBaseName: filename.slice(0, -videoExt.length), type: 'video' }
  }
  const audioExt = getAudioExtension(filename)
  if (audioExt) {
    return { fullBaseName: filename.slice(0, -audioExt.length), type: 'audio' }
  }
  return null
}

/**
 * Group files into entities based on naming convention.
 * Files with same base name are grouped (e.g., physics.md, physics.summary.md, physics.pdf).
 */
function groupFilesIntoEntities(
  files: Array<{ name: string; path: string; fullBaseName: string; type: EntityMemberType }>
): Map<string, Entity> {
  const fullBaseNames = new Set(files.map((f) => f.fullBaseName))
  const entityGroups = new Map<string, EntityMember[]>()

  for (const file of files) {
    let entityBase = file.fullBaseName
    let variant: string | null = null

    // Check if this file's fullBaseName has a prefix that matches another file's fullBaseName
    // e.g., physics.summary → prefix physics matches physics.md or physics.pdf
    const parts = file.fullBaseName.split('.')
    for (let i = 1; i < parts.length; i++) {
      const potentialBase = parts.slice(0, i).join('.')
      if (fullBaseNames.has(potentialBase) && potentialBase !== file.fullBaseName) {
        entityBase = potentialBase
        variant = parts.slice(i).join('.')
        break
      }
    }

    if (!entityGroups.has(entityBase)) {
      entityGroups.set(entityBase, [])
    }

    entityGroups.get(entityBase)!.push({
      path: file.path,
      variant,
      type: file.type,
    })
  }

  // Convert to Entity objects, filtering out single-file "entities"
  const entities = new Map<string, Entity>()
  for (const [baseName, members] of entityGroups) {
    if (members.length >= 2) {
      // Sort members: source files (pdf/video/audio) first, then default (null variant), then alphabetical
      const isSourceType = (type: EntityMemberType) => type === 'pdf' || type === 'video' || type === 'audio'
      members.sort((a, b) => {
        if (isSourceType(a.type) && !isSourceType(b.type)) return -1
        if (!isSourceType(a.type) && isSourceType(b.type)) return 1
        if (a.variant === null && b.variant !== null) return -1
        if (a.variant !== null && b.variant === null) return 1
        return (a.variant ?? '').localeCompare(b.variant ?? '')
      })

      const defaultMember = members.find((m) => m.type === 'markdown' && m.variant === null) ?? null

      entities.set(baseName, { baseName, members, defaultMember })
    }
  }

  return entities
}

/**
 * Build a hierarchical tree from a flat list of file entries.
 * Detects sidecar relationships: if X.md exists alongside X/ folder,
 * the folder's contents become children of the markdown file.
 * Groups related files into entities based on naming convention.
 */
export interface BuildFileTreeOptions {
  showClaudeMd?: boolean
}

export async function buildFileTree(
  dirPath: string,
  readDirectory: (path: string) => Promise<FileEntry[]>,
  options?: BuildFileTreeOptions
): Promise<TreeNode[]> {
  const entries = await readDirectory(dirPath)

  // Separate files and directories, filtering out hidden folders and optionally claude.md
  const files = entries.filter((e) => {
    if (e.isDirectory) return false
    if (!options?.showClaudeMd && e.name === 'claude.md') return false
    return true
  })
  const dirs = entries.filter((e) => {
    if (!e.isDirectory) return false
    // Hide internal folders
    if (e.name === MARKERDOWN_DIR || e.name === IMAGES_DIR || e.name === CLAUDE_DIR) return false
    return true
  })

  // Parse entity info for markdown, PDF, video and audio files
  const entityFiles: Array<{
    name: string
    path: string
    fullBaseName: string
    type: EntityMemberType
  }> = []
  const otherFiles: FileEntry[] = []

  for (const file of files) {
    const info = parseFileInfo(file.name)
    if (info) {
      entityFiles.push({ name: file.name, path: file.path, ...info })
    } else {
      otherFiles.push(file)
    }
  }

  // Group files into entities
  const entities = groupFilesIntoEntities(entityFiles)
  const entityMemberPaths = new Set<string>()
  for (const entity of entities.values()) {
    for (const member of entity.members) {
      entityMemberPaths.add(member.path)
    }
  }

  // Build a set of directory names for quick lookup
  const dirNames = new Set(dirs.map((d) => d.name))

  const nodes: TreeNode[] = []
  const processedDirs = new Set<string>()

  // Track which entities have been processed (to avoid duplicates)
  const processedEntities = new Set<string>()

  // Process entity files (create entity nodes or regular nodes)
  for (const file of entityFiles) {
    // Skip files that belong to an entity (they're accessed via entity tabs)
    // Only the entity's base file (fullBaseName === entity baseName) creates a node
    if (entityMemberPaths.has(file.path)) {
      const entity = entities.get(file.fullBaseName)
      if (entity) {
        // Skip if we already created a node for this entity
        if (processedEntities.has(entity.baseName)) {
          continue
        }

        // Only create entity node for the default member (or first member if no default)
        const representativePath = entity.defaultMember?.path ?? entity.members[0].path
        if (file.path !== representativePath) {
          continue
        }

        // This is the entity's representative file - create the entity node
        const hasSidecar = dirNames.has(entity.baseName)

        const node: TreeNode = {
          name: file.name,
          path: representativePath,
          isDirectory: false,
          hasSidecar,
          entity,
        }

        // If there's a sidecar folder, recursively get its contents as children
        if (hasSidecar) {
          const sidecarDir = dirs.find((d) => d.name === entity.baseName)!
          node.children = await buildFileTree(sidecarDir.path, readDirectory, options)
          processedDirs.add(entity.baseName)
        }

        nodes.push(node)
        processedEntities.add(entity.baseName)
      }
      continue
    }

    // Regular file (not part of an entity)
    const baseName = file.fullBaseName
    const hasSidecar = dirNames.has(baseName)

    const node: TreeNode = {
      name: file.name,
      path: file.path,
      isDirectory: false,
      hasSidecar,
    }

    if (hasSidecar) {
      const sidecarDir = dirs.find((d) => d.name === baseName)!
      node.children = await buildFileTree(sidecarDir.path, readDirectory, options)
      processedDirs.add(baseName)
    }

    nodes.push(node)
  }

  // Process directories that weren't sidecars
  for (const dir of dirs) {
    if (processedDirs.has(dir.name)) continue

    const node: TreeNode = {
      name: dir.name,
      path: dir.path,
      isDirectory: true,
      hasSidecar: false,
      children: await buildFileTree(dir.path, readDirectory, options),
    }

    nodes.push(node)
  }

  // Add other files (images, etc.)
  for (const file of otherFiles) {
    nodes.push({
      name: file.name,
      path: file.path,
      isDirectory: false,
      hasSidecar: false,
    })
  }

  // Sort: directories/sidecars/entities first, then files, alphabetically within each group
  return nodes.sort((a, b) => {
    const aIsContainer = a.isDirectory || a.hasSidecar || a.entity
    const bIsContainer = b.isDirectory || b.hasSidecar || b.entity

    if (aIsContainer && !bIsContainer) return -1
    if (!aIsContainer && bIsContainer) return 1
    return a.name.localeCompare(b.name)
  })
}
