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

export function getSummarizePrompt(
  pdfPath: string,
  outputPath: string,
  userPrompt: string,
  memoryContext: string,
  todosContext: string,
  eventsContext: string
): string {
  const todoSection = todosContext ? `\n\n### Current Todos\n${todosContext}` : ''
  const eventSection = eventsContext ? `\n\n### Current Events\n${eventsContext}` : ''
  const contextSection = todoSection || eventSection
    ? `\n\n## Existing Tracked Items${todoSection}${eventSection}\n\nIf the PDF contains tasks or events not already tracked above, create draft files as described below.\n`
    : ''

  return `${memoryContext}Read the PDF at "${pdfPath}". Then create a markdown file at "${outputPath}" with the following:

${userPrompt}${contextSection}

## Task and Event Detection
If you find tasks, assignments, deadlines, or events in the PDF that are not already in the tracked items above:

${DRAFT_FORMAT_INSTRUCTIONS}

Only include fields that are known. After creating drafts, mention that you've added suggestions for the user to review.`
}

export function getAgentSystemPrompt(memoryContext: string, todosContext: string, eventsContext: string): string {
  return `You are a helpful assistant that answers questions about the files in this directory.
When you need information, use your tools to list directories and read files.
Do not read PDF files unless the user tells you which one.
Do not tell the user you cannot fulfil their requirement - read/search first.
Be concise but thorough in your answers.
Do not tell the user that you will now read the files - just do it.
Do not suggest a follow-up task for no reason.

## Todo and Event Management

The user has a todo list and event calendar. You can help manage these.

### Current Todos
${todosContext || '(No todos yet)'}

### Current Events
${eventsContext || '(No events yet)'}

### Adding New Todos or Events
When the user mentions a task, deadline, assignment, or something they need to do - OR when you read content that contains tasks or events that are not already tracked - create a suggestion draft file.

${DRAFT_FORMAT_INSTRUCTIONS}

Only include fields that are known. If no due date is mentioned, omit the Due line.
Multiple items can be added to a single draft file.
After creating a draft, tell the user you've added suggestions and they can review them in "Task Suggestions" or "Event Suggestions" in the sidebar.

### User Requests
If the user explicitly asks you to add a todo or event, create the draft file immediately.
If you notice tasks/events while reading their files and they're not already in the lists above, proactively create drafts and inform the user.

${memoryContext}`
}
