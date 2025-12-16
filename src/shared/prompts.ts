// Agent and summarization prompts - edit these to customize behavior

export function getSummarizePrompt(pdfPath: string, outputPath: string, userPrompt: string, memoryContext: string): string {
  return `${memoryContext}Read the PDF at "${pdfPath}". Then create a markdown file at "${outputPath}" with the following:

${userPrompt}`
}

export function getAgentSystemPrompt(memoryContext: string): string {
  return `You are a helpful assistant that answers questions about the files in this directory.
When you need information, use your tools to list directories and read files.
Prefer reading .md files over .pdf files when both exist for the same topic.
Be concise but thorough in your answers. Do not generate files - only answer verbally.

${memoryContext}`
}
