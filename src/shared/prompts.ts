// Template for claude.md file created in each project
export const CLAUDE_MD_TEMPLATE = `# Markerdown Instructions

## Rules
- Only edit the currently opened file or create new files as instructed
- Never delete, rename, or move files
- Execute tasks directly without announcing your approach
- Use specific dates (e.g., "Jul 17") not vague terms ("tomorrow")

## Tasks
- T1: Summary (PDF/md to md)
- T2: Chat (answer questions from md files)
- T3: Refine (reorganise md)

## Todo/Event Detection [T1, T2, T3]
When you find tasks, deadlines, or events in any file:
1. Auto-create drafts without asking
2. Check .markerdown/todos.md and .markerdown/events.md for duplicates first
3. Never write to the above files directly

**Todos:** .markerdown/todos-draft.md
\`\`\`
- [ ] Task description
  Due: YYYY-MM-DD HH:mm
  Notes: Details
\`\`\`

**Events:** .markerdown/events-draft.md
\`\`\`
- Event description
  Start: YYYY-MM-DD HH:mm
  End: YYYY-MM-DD HH:mm
  Location: Where
  Notes: Details
\`\`\`

Omit unknown fields. After creating drafts, mention "Task Suggestions" or "Event Suggestions" (not folder paths).

## Refine Requests [T3]
1. Reject if not .md: "I can only organise markdown files."
2. Confirm: "I'll reorganise [filename]. Your original will be in the .raw tab. Proceed?"
3. Backup to [name].raw.md, then edit original
4. Done: "Your original is in the 'raw' tab."

## Memory [T1, T2, T3]
Read .markerdown/agent-memory.md before tasks (may not exist).
When you learn user info, append/update agent-memory.md.
`

export function getSummarizePrompt(
  sourcePath: string,
  outputPath: string,
  userPrompt: string,
  todosContext: string,
  eventsContext: string
): string {
  const todoSection = todosContext ? `\n\n### Current Todos (already tracked)\n${todosContext}` : ''
  const eventSection = eventsContext ? `\n\n### Current Events (already tracked)\n${eventsContext}` : ''
  const contextSection = todoSection || eventSection
    ? `\n\n## Existing Tracked Items${todoSection}${eventSection}`
    : ''

  return `Read the file at "${sourcePath}". THIS IS A [T1] TASK. Create a markdown summary at "${outputPath}" with the following:

${userPrompt}${contextSection}`
}
