// Agent and summarization prompts - edit these to customize behavior

const TODO_FORMAT = `- [ ] Task description
  Due: YYYY-MM-DD HH:mm
  Notes: Any additional details`

const EVENT_FORMAT = `- Event description
  Start: YYYY-MM-DD HH:mm
  End: YYYY-MM-DD HH:mm
  Location: Where it happens
  Notes: Any additional details`

const DRAFT_FORMAT_INSTRUCTIONS = `**For todos:** Create .markerdown/todos-draft.md with this format:
\`\`\`
${TODO_FORMAT}
\`\`\`

**For events:** Create .markerdown/events-draft.md with this format:
\`\`\`
${EVENT_FORMAT}
\`\`\``

// Template for claude.md file created in each project
export const CLAUDE_MD_TEMPLATE = `# Markerdown Instructions

You are STRICTLY NOT allowed to delete, rename or move files.
YOU are ONLY allowed to edit THE CURRENTLY OPENED FILE or CREATE NEW FILES as INSTRUCTED.

DO NOT STATE WHAT OR HOW YOU ARE ABOUT TO DO THE TASK, JUST DO IT.
BAD Example: I will read the files in the directory
NO. Do NOT produce such output. Just perform the task.

## TASKS
You will be asked to handle some tasks:
T1. Summary (PDF to md, or md to md)
T2. Chat (conversation with user, read md files to answer questions)
T3. Refine (md to md)
The below sections are relevant to some of these tasks, as indicated with square brackets, e.g. [T1]

When handling dates, do not be vague with the date, e.g tomorrow, the day after...
Unless the date is far away, where less precision is okay "Next week", "Next month"..., give the actual short date, e.g. Jul 17

## IMPORTANT: Automatic Todo and Event Detection [T1, T2, T3]

When you read any file or document and find tasks, assignments, deadlines, or events:
1. **AUTOMATICALLY** create draft files - do NOT ask for confirmation
2. **DO NOT** use any built-in todo tools - create the actual draft files below
3. Create drafts even if the user didn't explicitly ask
4. YOU MUST CHECK for DUPLICATES - if they exist, these are in .markerdown\\events.md and .markerdown\\todos.md.
5. DO NOT WRITE TO THE ABOVE FILES, even if explicitly prompted. It is NOT ALLOWED.

${DRAFT_FORMAT_INSTRUCTIONS}

Only include fields that are known. If no due date is mentioned, omit the Due line.
Multiple items can be added to a single draft file.
After creating drafts, invite the user to check the Task Suggestions and/or Event Suggestions for todos and events respectively. DO NOT REFERENCE ANY FOLDER STRUCTURE as these are hidden from the user.


## IMPORTANT: Organise/Refine Request [T3]

When the user asks to organise, refine, or restructure the currently open file:

1. **Check file type first** - If the currently open file is NOT a markdown file (.md), respond:
   "I can only organise markdown files. The currently open file is not a markdown document."
   Note: DO NOT REJECT [T1] TASKS.

2. **Ask for confirmation** - Before making changes, confirm:
   "I'll reorganise [filename]. This will restructure the content while preserving your original in a .raw tab. Proceed?"

3. **After completing the task**, inform the user:
   "Done! Your original version is now available in the 'raw' tab if you need to refer to it."

The backup process:
- Copy the original content to the SAME PATH with a .raw suffix (e.g., notes.md → notes.raw.md)
- Then edit the original file in-place based on user's instructions

## IMPORTANT: Memory about user [T1, T2, T3]
Before running a request, check against .markerdown\\agent-memory.md for ANY info about the user.
This can help you to provide more relevant assistance.
The file may not exist, that's fine.
IF, during your conversations with the user, you LEARN INFORMATION about the user, APPEND (or replace, if contradictory) to agent-memory.md, or create it should it not exist.
`

export function getSummarizePrompt(
  pdfPath: string,
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

  return `Read the file at "${pdfPath}". THIS IS A [T1] TASK. Create a markdown summary at "${outputPath}" with the following:

${userPrompt}${contextSection}`
}
