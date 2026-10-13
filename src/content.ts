import planSource from '../plan.md?raw'
import { legacyCheckKeys } from './legacy-check-keys'
import { parsePlan, type Plan } from './markdown'

function applyLegacyKeys (plan: Plan) {
  let index = 0
  for (const section of plan.sections) {
    for (const task of section.tasks) {
      for (const block of task.body) {
        if (block.type !== 'list') continue
        for (const item of block.items) {
          if (item.kind !== 'todo') continue
          const key = legacyCheckKeys[index]
          if (key) item.key = key
          index += 1
        }
      }
    }
  }
  if (index !== legacyCheckKeys.length) {
    throw new Error(`Check key mismatch: ${index} todos, ${legacyCheckKeys.length} legacy keys`)
  }
}

export const plan = parsePlan(planSource)
applyLegacyKeys(plan)

export function taskKey (id: string): string {
  return `task:${id}`
}

export function checkNoteKey (id: string): string {
  return `task:${id}:check`
}

export const requiredTasks = plan.sections.flatMap((section) => section.tasks.filter((task) => !task.optional))

export const allTasks = plan.sections.flatMap((section) => section.tasks)
