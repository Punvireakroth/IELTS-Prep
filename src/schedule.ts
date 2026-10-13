export const PLAN_ANCHOR = 'plan:anchor'
export const PLAN_HOURS = 'plan:hours'
export const PLAN_TARGET = 'plan:target'
export const PLAN_ANCHOR_DONE = 'plan:anchorDone'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export type ScheduleTask = {
  id: string
  hours: number
  optional: boolean
}

export type TaskTiming = {
  due: string | null
  overdue: boolean
}

export type Schedule = {
  byId: Record<string, TaskTiming>
  anchor: string | null
  requiredHours: number
  doneHours: number
  remainingHours: number
  behindHours: number
  overdueCount: number
  projectedFinish: string | null
  usingPlanPace: boolean
  hoursPerWeekToHitTarget: number | null
  targetPassed: boolean
}

export function parseISODate(iso: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim())
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null
  return date
}

export function formatISODate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function todayISO(now = new Date()): string {
  return formatISODate(new Date(now.getFullYear(), now.getMonth(), now.getDate()))
}

export function formatPretty(iso: string): string {
  const date = parseISODate(iso)
  if (!date) return iso
  return `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`
}

export function formatHours(hours: number): string {
  const rounded = Math.round(hours * 10) / 10
  if (Number.isInteger(rounded)) return String(rounded)
  return rounded.toFixed(1)
}

export function parseHoursPerWeek(raw: string | undefined): number {
  if (!raw?.trim()) return 12
  const value = Number(raw)
  if (!Number.isFinite(value) || value <= 0) return 12
  return Math.min(value, 80)
}

export function parseAnchorDone(raw: string | undefined): string[] {
  if (!raw?.trim()) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is string => typeof item === 'string')
  } catch {
    return []
  }
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  next.setDate(next.getDate() + days)
  return next
}

function daysBetween(later: Date, earlier: Date): number {
  return Math.round((later.getTime() - earlier.getTime()) / 86400000)
}

export function dueText(due: string | null, today: string, overdue: boolean): string | null {
  if (!due) return null
  if (overdue) return `Overdue · ${formatPretty(due)}`
  if (due === today) return 'Due today'
  return `Due ${formatPretty(due)}`
}

export function computeSchedule(options: {
  tasks: ScheduleTask[]
  done: ReadonlySet<string>
  anchor: string | null
  hoursPerWeek: number
  target: string | null
  anchorDone: readonly string[]
  today: string
}): Schedule {
  const hoursPerWeek = options.hoursPerWeek > 0 ? options.hoursPerWeek : 6
  const today = parseISODate(options.today)
  const todayText = today ? formatISODate(today) : options.today
  const anchor = options.anchor ? parseISODate(options.anchor) : null
  const anchorText = anchor ? formatISODate(anchor) : null
  const finishedAtAnchor = new Set(options.anchorDone)
  const byId: Record<string, TaskTiming> = {}

  let cumulative = 0
  let requiredHours = 0
  let doneHours = 0
  let dueHours = 0
  let doneScheduled = 0
  let doneSinceAnchor = 0
  let overdueCount = 0

  for (const task of options.tasks) {
    if (task.optional) {
      byId[task.id] = { due: null, overdue: false }
      continue
    }

    requiredHours += task.hours
    const checked = options.done.has(task.id)
    if (checked) doneHours += task.hours

    if (finishedAtAnchor.has(task.id)) {
      byId[task.id] = { due: null, overdue: false }
      continue
    }

    cumulative += task.hours
    if (checked) doneSinceAnchor += task.hours

    if (!anchor || !today) {
      byId[task.id] = { due: null, overdue: false }
      continue
    }

    const offset = Math.ceil((7 * cumulative) / hoursPerWeek - 1e-6)
    const due = formatISODate(addDays(anchor, offset))
    const overdue = !checked && due < todayText
    if (overdue) overdueCount += 1
    if (due <= todayText) dueHours += task.hours
    if (checked) doneScheduled += task.hours
    byId[task.id] = { due, overdue }
  }

  const remainingHours = Math.max(0, requiredHours - doneHours)
  let projectedFinish: string | null = null
  let usingPlanPace = true

  if (anchor && today && remainingHours > 0) {
    const elapsed = daysBetween(today, anchor)
    let pace = hoursPerWeek
    if (elapsed >= 7) {
      const actual = doneSinceAnchor / (elapsed / 7)
      usingPlanPace = false
      if (actual > 0) pace = actual
      else pace = 0
    }
    if (pace > 0) {
      const origin = elapsed < 0 ? anchor : today
      const ahead = Math.ceil((remainingHours / pace) * 7 - 1e-6)
      projectedFinish = formatISODate(addDays(origin, ahead))
    }
  }

  const target = options.target ? parseISODate(options.target) : null
  let hoursPerWeekToHitTarget: number | null = null
  let targetPassed = false
  if (target && today && remainingHours > 0) {
    const daysUntil = daysBetween(target, today)
    if (daysUntil < 0) {
      targetPassed = true
    } else if (daysUntil > 0 && (!projectedFinish || projectedFinish > formatISODate(target))) {
      hoursPerWeekToHitTarget = remainingHours / (daysUntil / 7)
    }
  }

  return {
    byId,
    anchor: anchorText,
    requiredHours,
    doneHours,
    remainingHours,
    behindHours: anchor && today ? dueHours - doneScheduled : 0,
    overdueCount,
    projectedFinish: remainingHours > 0 ? projectedFinish : null,
    usingPlanPace,
    hoursPerWeekToHitTarget,
    targetPassed,
  }
}
