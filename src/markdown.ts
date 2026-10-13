export type Inline =
  | { type: 'text'; text: string }
  | { type: 'strong'; children: Inline[] }
  | { type: 'em'; children: Inline[] }
  | { type: 'code'; text: string }
  | { type: 'link'; href: string; children: Inline[] }

export type ListItem = {
  kind: 'bullet' | 'ordered' | 'todo'
  key?: string
  children: Inline[]
}

export type Block =
  | { type: 'heading'; level: 1 | 2 | 3; children: Inline[] }
  | { type: 'paragraph'; children: Inline[] }
  | { type: 'list'; ordered: boolean; items: ListItem[] }
  | { type: 'code'; lang: string; text: string }
  | { type: 'table'; headers: Inline[][]; rows: Inline[][][] }
  | { type: 'readiness'; id: number; title: Inline[]; lines: Inline[][] }

export type Task = {
  id: string
  title: Inline[]
  hours: number
  optional: boolean
  check: Inline[] | null
  body: Block[]
}

export type Section = {
  id: string
  title: Inline[]
  preface: Block[]
  tasks: Task[]
}

export type Plan = {
  title: Inline[]
  intro: Block[]
  sections: Section[]
}

const TASK_HEADING = /^(.+?) · (\d+(?:\.\d+)?) hours?(?: · Optional)?$/

export function slug(text: string): string {
  const base = text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return base || 'section'
}

export function checkboxKey(label: string): string {
  const plain = label
    .replace(/[`*_]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
  return `check:${plain}`
}

export function parseInline(input: string): Inline[] {
  const out: Inline[] = []
  let i = 0

  const pushText = (text: string) => {
    if (!text) return
    const last = out[out.length - 1]
    if (last?.type === 'text') last.text += text
    else out.push({ type: 'text', text })
  }

  while (i < input.length) {
    if (input.startsWith('**', i)) {
      const end = input.indexOf('**', i + 2)
      if (end !== -1) {
        out.push({ type: 'strong', children: parseInline(input.slice(i + 2, end)) })
        i = end + 2
        continue
      }
    }

    if (input[i] === '*' && input[i + 1] !== '*') {
      const end = input.indexOf('*', i + 1)
      if (end !== -1 && end > i + 1) {
        out.push({ type: 'em', children: parseInline(input.slice(i + 1, end)) })
        i = end + 1
        continue
      }
    }

    if (input[i] === '`') {
      const end = input.indexOf('`', i + 1)
      if (end !== -1) {
        out.push({ type: 'code', text: input.slice(i + 1, end) })
        i = end + 1
        continue
      }
    }

    if (input[i] === '[') {
      const close = input.indexOf(']', i + 1)
      if (close !== -1 && input[close + 1] === '(') {
        const hrefEnd = input.indexOf(')', close + 2)
        if (hrefEnd !== -1) {
          out.push({
            type: 'link',
            href: input.slice(close + 2, hrefEnd),
            children: parseInline(input.slice(i + 1, close)),
          })
          i = hrefEnd + 1
          continue
        }
      }
    }

    pushText(input[i] ?? '')
    i += 1
  }

  return out
}

function splitRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '')
  return trimmed.split('|').map((cell) => cell.trim())
}

function isSeparator(line: string): boolean {
  return /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(line.trim())
}

export function parseMarkdown(source: string): Block[] {
  const lines = source.replace(/\r\n/g, '\n').split('\n')
  const blocks: Block[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i] ?? ''

    if (line.trim() === '') {
      i += 1
      continue
    }

    if (line.startsWith('```')) {
      const lang = line.slice(3).trim()
      const body: string[] = []
      i += 1
      while (i < lines.length && !(lines[i] ?? '').startsWith('```')) {
        body.push(lines[i] ?? '')
        i += 1
      }
      i += 1
      blocks.push({ type: 'code', lang, text: body.join('\n') })
      continue
    }

    if (line.trim().startsWith('|')) {
      const headers = splitRow(line)
      i += 1
      if (i < lines.length && isSeparator(lines[i] ?? '')) i += 1
      const rows: Inline[][][] = []
      while (i < lines.length && (lines[i] ?? '').trim().startsWith('|')) {
        rows.push(splitRow(lines[i] ?? '').map((cell) => parseInline(cell)))
        i += 1
      }
      blocks.push({ type: 'table', headers: headers.map((cell) => parseInline(cell)), rows })
      continue
    }

    const heading = /^(#{1,3}) (.*)$/.exec(line)
    if (heading) {
      const level = heading[1]!.length as 1 | 2 | 3
      const text = heading[2] ?? ''

      const readiness = level === 3 ? /^(\d+)\. (.*)$/.exec(text) : null
      if (readiness) {
        const id = Number(readiness[1])
        const title = parseInline(readiness[2] ?? '')
        const body: Inline[][] = []
        let j = i + 1
        let found = false
        while (j < lines.length) {
          const next = lines[j] ?? ''
          if (next.trim() === '') {
            j += 1
            continue
          }
          if (next.startsWith('#')) break
          if (next.startsWith('From memory')) {
            found = true
            j += 1
            break
          }
          body.push(parseInline(next))
          j += 1
        }
        if (found) {
          blocks.push({ type: 'readiness', id, title, lines: body })
          i = j
          continue
        }
      }

      blocks.push({ type: 'heading', level, children: parseInline(text) })
      i += 1
      continue
    }

    if (/^(\s*)([-*]|\d+\.) /.test(line)) {
      const items: ListItem[] = []
      let ordered = false
      while (i < lines.length && /^(\s*)([-*]|\d+\.) /.test(lines[i] ?? '')) {
        const current = (lines[i] ?? '').trim()
        const todo = /^- \[([ xX])\] (.*)$/.exec(current)
        const bullet = /^- (.*)$/.exec(current)
        const numbered = /^\d+\. (.*)$/.exec(current)
        if (todo) {
          const label = todo[2] ?? ''
          items.push({ kind: 'todo', key: checkboxKey(label), children: parseInline(label) })
        } else if (numbered) {
          ordered = true
          items.push({ kind: 'ordered', children: parseInline(numbered[1] ?? '') })
        } else if (bullet) {
          items.push({ kind: 'bullet', children: parseInline(bullet[1] ?? '') })
        }
        i += 1
      }
      blocks.push({ type: 'list', ordered, items })
      continue
    }

    blocks.push({ type: 'paragraph', children: parseInline(line) })
    i += 1
  }

  return blocks
}

export function inlineText(nodes: Inline[]): string {
  return nodes
    .map((node) => {
      if (node.type === 'text' || node.type === 'code') return node.text
      if (node.type === 'link') return inlineText(node.children)
      return inlineText(node.children)
    })
    .join('')
}

function checkPrompt(block: Block): Inline[] | null {
  if (block.type !== 'paragraph' || block.children.length === 0) return null
  const [first, ...rest] = block.children
  if (first?.type !== 'strong' || inlineText(first.children).trim() !== 'Check.') return null
  const prompt = rest.map((node) => ({ ...node }))
  const leading = prompt[0]
  if (leading?.type === 'text') leading.text = leading.text.replace(/^\s+/, '')
  return prompt
}

function uniqueSlug(text: string, used: Set<string>): string {
  const base = slug(text)
  let id = base
  let n = 2
  while (used.has(id)) {
    id = `${base}-${n}`
    n += 1
  }
  used.add(id)
  return id
}

type OpenTask = {
  id: string
  title: Inline[]
  hours: number
  optional: boolean
  body: Block[]
}

export function parsePlan(source: string): Plan {
  const blocks = parseMarkdown(source)
  const plan: Plan = { title: [], intro: [], sections: [] }
  const sectionIds = new Set<string>()
  const taskIds = new Set<string>()
  let section: Section | null = null
  let task: OpenTask | null = null

  const closeTask = () => {
    if (!task || !section) {
      task = null
      return
    }
    let check: Inline[] | null = null
    const body: Block[] = []
    for (const block of task.body) {
      const prompt = checkPrompt(block)
      if (prompt) {
        if (!check) check = prompt
        continue
      }
      body.push(block)
    }
    section.tasks.push({
      id: task.id,
      title: task.title,
      hours: task.hours,
      optional: task.optional,
      check,
      body,
    })
    task = null
  }

  for (const block of blocks) {
    if (block.type === 'heading' && block.level === 1 && plan.title.length === 0) {
      plan.title = block.children
      continue
    }

    if (block.type === 'heading' && block.level === 2) {
      closeTask()
      section = {
        id: uniqueSlug(inlineText(block.children), sectionIds),
        title: block.children,
        preface: [],
        tasks: [],
      }
      plan.sections.push(section)
      continue
    }

    if (block.type === 'heading' && block.level === 3) {
      const match = TASK_HEADING.exec(inlineText(block.children))
      if (match && section) {
        closeTask()
        const titleText = match[1] ?? ''
        task = {
          id: uniqueSlug(titleText, taskIds),
          title: parseInline(titleText),
          hours: Number(match[2]),
          optional: inlineText(block.children).endsWith('· Optional'),
          body: [],
        }
        continue
      }
    }

    if (task) task.body.push(block)
    else if (section) section.preface.push(block)
    else if (block.type !== 'heading' || block.level !== 1) plan.intro.push(block)
  }

  closeTask()
  return plan
}
