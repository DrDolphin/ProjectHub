import type { ChatMessage, ChatResponse, CreateProjectRequest, ProjectTemplate } from '@shared/types'
import { getSettings } from './config'

const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions'

const SYSTEM_PROMPT = `You are an AI assistant embedded in ProjectHub, an Electron desktop app for managing local development projects. Your job is to help the user create a new project through natural conversation.

When the user describes what they want, gather these details and produce a structured project creation action:

Fields you can set:
- **name** (required): The project folder name. Use lowercase, hyphens for spaces (e.g., "my-cool-app").
- **parent** (optional): A grouping subfolder under the projects root. If the user says "put it in the server folder" or similar, set this.
- **template** (required): One of these values:
  - "empty" — just an empty folder
  - "node" — Node.js with package.json + index.js
  - "vite-react" — Vite + React + TypeScript scaffold
  - "nextjs" — Next.js app-ready scripts
  - "python" — Python with pyproject.toml
  - "static" — Static HTML with index.html
- **openAfter** (optional, default true): Open in VS Code after creating?

Templates guide:
- For React apps → "vite-react"
- For Next.js or "next" → "nextjs"  
- For Node.js backends, APIs, CLIs, scripts → "node"
- For Python projects → "python"
- For plain websites without frameworks → "static"
- When unsure or no framework mentioned → "empty"

When you have enough information to create the project, output a JSON action block wrapped in \`\`\`project-action and \`\`\` markers:

\`\`\`project-action
{
  "name": "the-project-name",
  "template": "vite-react",
  "parent": "optional-grouping-folder",
  "openAfter": true
}
\`\`\`

Rules:
1. Be conversational and helpful. Ask clarifying questions if needed.
2. Only output the project-action JSON block when you are confident the user wants to create a project AND you have the necessary details.
3. If the user hasn't specified a tech stack, ask before assuming.
4. If a field is not specified by the user, omit it from the JSON (or use defaults).
5. Keep responses concise and focused on the task.
6. You can suggest template choices if the user seems unsure.
7. Never make up a name — if the user hasn't given one, ask for it.`

export async function deepseekChat(messages: ChatMessage[]): Promise<ChatResponse> {
  const settings = getSettings()
  const apiKey = settings.deepseekApiKey

  if (!apiKey) {
    throw new Error('DeepSeek API key is not configured. Please add it in Settings.')
  }

  const fullMessages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...messages
  ]

  const response = await fetch(DEEPSEEK_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: fullMessages,
      temperature: 0.7,
      max_tokens: 1024
    })
  })

  if (!response.ok) {
    const errBody = await response.text().catch(() => 'Unknown error')
    throw new Error(`DeepSeek API error ${response.status}: ${errBody}`)
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>
  }

  const content = data.choices?.[0]?.message?.content ?? ''
  if (!content) {
    throw new Error('DeepSeek API returned an empty response.')
  }

  // Try to extract a project-action JSON block
  const actionMatch = content.match(/```project-action\s*\n([\s\S]*?)```/)
  let projectAction: CreateProjectRequest | null = null

  if (actionMatch) {
    try {
      const parsed = JSON.parse(actionMatch[1]!.trim())
      if (parsed && typeof parsed.name === 'string' && parsed.name.trim()) {
        // Normalize and validate
        const validTemplates: ProjectTemplate[] = ['empty', 'node', 'vite-react', 'nextjs', 'python', 'static']
        const template: ProjectTemplate = validTemplates.includes(parsed.template)
          ? parsed.template
          : 'empty'

        projectAction = {
          name: parsed.name.trim(),
          parent: typeof parsed.parent === 'string' && parsed.parent.trim()
            ? parsed.parent.trim()
            : undefined,
          template,
          openAfter: parsed.openAfter !== false // default true
        }
      }
    } catch {
      // Ignore parse errors — the content is still valid as a chat response
    }
  }

  return { content, projectAction }
}
