import { useMemo, useState, type FormEvent, type MouseEvent } from 'react'
import { allTasks, checkNoteKey, plan, requiredTasks, taskKey } from './content'
import { ErrorLog } from './ErrorLog'
import { Blocks, Inlines } from './MarkdownView'
import { inlineText, type Section, type Task } from './markdown'
import { useProgress } from './progress'
import { ScoreTracker } from './ScoreTracker'
import {
  PLAN_ANCHOR,
  PLAN_ANCHOR_DONE,
  PLAN_HOURS,
  PLAN_TARGET,
  computeSchedule,
  dueText,
  formatHours,
  formatPretty,
  parseAnchorDone,
  parseHoursPerWeek,
  todayISO,
  type Schedule,
  type TaskTiming,
} from './schedule'
import { MIGRATION_PATH } from './supabase'

export function App() {
  const { checks, notes, toggleCheck, setNote } = useProgress()
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [settingsOpen, setSettingsOpen] = useState(false)
  const today = todayISO()

  const done = useMemo(() => {
    const ids = new Set<string>()
    for (const task of allTasks) {
      if (checks[taskKey(task.id)]) ids.add(task.id)
    }
    return ids
  }, [checks])

  const schedule = useMemo(
    () =>
      computeSchedule({
        tasks: allTasks,
        done,
        anchor: notes[PLAN_ANCHOR] || null,
        hoursPerWeek: parseHoursPerWeek(notes[PLAN_HOURS]),
        target: notes[PLAN_TARGET] || null,
        anchorDone: parseAnchorDone(notes[PLAN_ANCHOR_DONE]),
        today,
      }),
    [done, notes, today],
  )

  const phases = plan.sections.filter((section) => section.tasks.length > 0)
  const selfTest = plan.sections.find((section) => section.id === 'self-test')
  const references = plan.sections.filter((section) => section.tasks.length === 0 && section.id !== 'self-test')

  function resetDeadlines() {
    const finished = requiredTasks.filter((task) => done.has(task.id)).map((task) => task.id)
    setNote(PLAN_ANCHOR, today)
    setNote(PLAN_ANCHOR_DONE, JSON.stringify(finished))
  }

  return (
    <div className="shell">
      <header className={settingsOpen ? 'bar open' : 'bar'}>
        <div className="bar-inner">
          <div className="bar-top">
            <strong className="brand">IELTS prep</strong>
            <button
              type="button"
              className="settings-toggle"
              aria-label={settingsOpen ? 'Hide settings' : 'Show settings'}
              aria-expanded={settingsOpen}
              aria-controls="settings-panel"
              onClick={() => setSettingsOpen((current) => !current)}
            >
              <SettingsIcon />
            </button>
          </div>
          {settingsOpen && (
            <div id="settings-panel" className="settings-panel">
              <p className="status-line">{statusMessage(schedule, notes[PLAN_TARGET] || null, today, Boolean(notes[PLAN_HOURS]?.trim()))}</p>
              <div className="settings">
                <label>
                  Start date
                  <input
                    type="date"
                    value={notes[PLAN_ANCHOR] ?? ''}
                    onChange={(event) => setNote(PLAN_ANCHOR, event.target.value)}
                  />
                </label>
                <label>
                  Hours per week
                  <input
                    type="number"
                    min={0.5}
                    max={80}
                    step={0.5}
                    placeholder="12"
                    value={notes[PLAN_HOURS] ?? ''}
                    onChange={(event) => setNote(PLAN_HOURS, event.target.value)}
                  />
                </label>
                <label>
                  Target date
                  <input
                    type="date"
                    value={notes[PLAN_TARGET] ?? ''}
                    onChange={(event) => setNote(PLAN_TARGET, event.target.value)}
                  />
                </label>
                {notes[PLAN_TARGET] && (
                  <button type="button" onClick={() => setNote(PLAN_TARGET, '')}>
                    Clear target
                  </button>
                )}
                <button type="button" className="primary" onClick={resetDeadlines}>
                  Reset deadlines from today
                </button>
              </div>
              {parseAnchorDone(notes[PLAN_ANCHOR_DONE]).length > 0 && (
                <p className="hint">
                  Finished tasks are left out of these deadlines. The rest are scheduled from the start date.
                </p>
              )}
              <Account />
            </div>
          )}
        </div>
      </header>
      <main className="content">
        <article className="page">
          <h1>
            <Inlines nodes={plan.title} />
          </h1>
          <Blocks blocks={plan.intro} />
          <nav className="jumps" aria-label="Sections">
            {phases.map((section) => (
              <a key={section.id} href={`#${section.id}`} onClick={(event) => jump(event, section.id)}>
                {inlineText(section.title)}
              </a>
            ))}
            {references.map((section) => (
              <a key={section.id} href={`#${section.id}`} onClick={(event) => jump(event, section.id)}>
                {inlineText(section.title)}
              </a>
            ))}
          </nav>
          {phases.map((section) => (
            <Phase
              key={section.id}
              section={section}
              schedule={schedule}
              today={today}
              done={done}
              open={open}
              notes={notes}
              onToggleOpen={(id) => setOpen((current) => ({ ...current, [id]: !current[id] }))}
              onToggleCheck={(id) => toggleCheck(taskKey(id))}
              onNote={setNote}
            />
          ))}
          {selfTest && <Reference section={selfTest} notes={notes} />}
          {references.map((section) => (
            <Reference key={section.id} section={section} notes={notes} />
          ))}
        </article>
      </main>
    </div>
  )
}

function jump(event: MouseEvent<HTMLAnchorElement>, id: string) {
  if (!document.getElementById(id)) return
  event.preventDefault()
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function statusMessage(schedule: Schedule, target: string | null, today: string, hoursSet: boolean): string {
  const parts = [`${formatHours(schedule.doneHours)} of ${formatHours(schedule.requiredHours)} hours done.`]
  if (!schedule.anchor) {
    parts.push('Set a start date to see due dates.')
    if (!hoursSet) parts.push('Hours per week stay at 12 until you set them.')
    return parts.join(' ')
  }
  if (schedule.remainingHours <= 0) {
    parts.push('Required work is done.')
    return parts.join(' ')
  }
  if (schedule.behindHours > 0.25) parts.push(`${formatHours(schedule.behindHours)} hours behind.`)
  else if (schedule.behindHours < -0.25) parts.push(`${formatHours(-schedule.behindHours)} hours ahead.`)
  else parts.push('On pace.')
  if (schedule.overdueCount === 1) parts.push('1 required task is overdue.')
  else if (schedule.overdueCount > 1) parts.push(`${schedule.overdueCount} required tasks are overdue.`)
  if (schedule.projectedFinish) {
    parts.push(`Projected finish ${formatPretty(schedule.projectedFinish)}.`)
    if (schedule.usingPlanPace && schedule.anchor <= today) {
      parts.push('Until a week has passed, this uses your hours per week.')
    }
  } else {
    parts.push('No required tasks finished since the start date, so there is no finish projection.')
  }
  if (schedule.targetPassed) parts.push('The target date has passed.')
  else if (target === today) parts.push('The target date is today, and required work is still open.')
  else if (schedule.hoursPerWeekToHitTarget !== null && target) {
    parts.push(
      `To finish by ${formatPretty(target)}, study about ${formatHours(schedule.hoursPerWeekToHitTarget)} hours a week.`,
    )
  }
  return parts.join(' ')
}

function taskMeta(task: Task, timing: TaskTiming | undefined, today: string, done = false): string {
  const hours = `${formatHours(task.hours)} ${task.hours === 1 ? 'hour' : 'hours'}`
  if (task.optional) return `${hours} · Optional`
  if (done) return hours
  const due = dueText(timing?.due ?? null, today, timing?.overdue ?? false)
  return due ? `${hours} · ${due}` : hours
}

function Phase({
  section,
  schedule,
  today,
  done,
  open,
  notes,
  onToggleOpen,
  onToggleCheck,
  onNote,
}: {
  section: Section
  schedule: Schedule
  today: string
  done: ReadonlySet<string>
  open: Record<string, boolean>
  notes: Record<string, string>
  onToggleOpen: (id: string) => void
  onToggleCheck: (id: string) => void
  onNote: (key: string, body: string) => void
}) {
  const required = section.tasks.filter((task) => !task.optional)
  const optional = section.tasks.filter((task) => task.optional)
  const requiredDone = required.filter((task) => done.has(task.id)).length

  return (
    <section className="section">
      <h2 id={section.id}>
        <Inlines nodes={section.title} />
      </h2>
      {required.length > 0 && (
        <p className="phase-count">
          {requiredDone} of {required.length} required
        </p>
      )}
      <Blocks blocks={section.preface} />
      <div className="tasks">
        {required.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            timing={schedule.byId[task.id]}
            today={today}
            done={done.has(task.id)}
            expanded={open[task.id] ?? false}
            note={notes[checkNoteKey(task.id)] ?? ''}
            onToggleOpen={() => onToggleOpen(task.id)}
            onToggleCheck={() => onToggleCheck(task.id)}
            onNote={onNote}
          />
        ))}
      </div>
      {optional.length > 0 && (
        <details className="optional">
          <summary>
            Optional. Extra time only. ({optional.length})
          </summary>
          <div className="tasks">
            {optional.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                timing={schedule.byId[task.id]}
                today={today}
                done={done.has(task.id)}
                expanded={open[task.id] ?? false}
                note={notes[checkNoteKey(task.id)] ?? ''}
                onToggleOpen={() => onToggleOpen(task.id)}
                onToggleCheck={() => onToggleCheck(task.id)}
                onNote={onNote}
              />
            ))}
          </div>
        </details>
      )}
    </section>
  )
}

function TaskRow({
  task,
  timing,
  today,
  done,
  expanded,
  note,
  onToggleOpen,
  onToggleCheck,
  onNote,
}: {
  task: Task
  timing: TaskTiming | undefined
  today: string
  done: boolean
  expanded: boolean
  note: string
  onToggleOpen: () => void
  onToggleCheck: () => void
  onNote: (key: string, body: string) => void
}) {
  const title = inlineText(task.title)
  const overdue = Boolean(timing?.overdue)
  const dueToday = !done && timing?.due === today
  const className = ['task', done ? 'done' : '', overdue ? 'overdue' : '', dueToday ? 'today' : ''].filter(Boolean).join(' ')
  return (
    <div id={`task-${task.id}`} className={className}>
      <div className="task-row">
        <input
          type="checkbox"
          checked={done}
          aria-label={title}
          onChange={onToggleCheck}
        />
        <button type="button" className="task-main" aria-expanded={expanded} onClick={onToggleOpen}>
          <span className={expanded ? 'disclosure open' : 'disclosure'} aria-hidden="true" />
          <span className="task-title">{title}</span>
          <span className="task-meta">{taskMeta(task, timing, today, done)}</span>
        </button>
      </div>
      {expanded && (
        <div className="task-body">
          <Blocks blocks={task.body} />
          <div className="check">
            <textarea
              rows={3}
              placeholder="Note for this day"
              value={note}
              onChange={(event) => onNote(checkNoteKey(task.id), event.target.value)}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function Reference({ section, notes }: { section: Section; notes: Record<string, string> }) {
  const readiness = section.preface.filter((block) => block.type === 'readiness')
  const fromMemory = readiness.filter((block) => notes[`readiness:${block.id}:status`] === 'memory').length
  return (
    <section className="section">
      <h2 id={section.id}>
        <Inlines nodes={section.title} />
      </h2>
      {section.id === 'self-test' && readiness.length > 0 && (
        <p className="score">
          From memory: {fromMemory} of {readiness.length}
        </p>
      )}
      <Blocks blocks={section.preface} />
      {section.id.startsWith('error-log') && <ErrorLog />}
      {section.id === 'weekly-score-tracker' && <ScoreTracker />}
    </section>
  )
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7 7 0 0 0-1.62-.94l-.36-2.54A.5.5 0 0 0 13.9 2h-3.8a.5.5 0 0 0-.5.42l-.36 2.54c-.59.24-1.13.55-1.62.94l-2.39-.96a.5.5 0 0 0-.6.22L2.71 8.48a.5.5 0 0 0 .12.64L4.86 10.7c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32c.13.23.4.32.64.22l2.39-.96c.49.39 1.03.7 1.62.94l.36 2.54c.05.24.26.42.5.42h3.8c.24 0 .45-.18.5-.42l.36-2.54c.59-.24 1.13-.55 1.62-.94l2.39.96c.24.1.51 0 .64-.22l1.92-3.32a.5.5 0 0 0-.12-.64zM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7z"
      />
    </svg>
  )
}

function Account() {
  const { configured, email, statusText, signIn, signUp, signOut } = useProgress()
  const [address, setAddress] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const summary = email ?? (configured ? statusText : 'On this browser')

  async function submit(event: FormEvent, mode: 'in' | 'up') {
    event.preventDefault()
    if (password.length < 6) {
      setMessage('Use a password of at least 6 characters.')
      return
    }
    setBusy(true)
    setMessage(null)
    const error = mode === 'in' ? await signIn(address, password) : await signUp(address, password)
    setMessage(error)
    setBusy(false)
    if (!error && mode === 'in') setPassword('')
  }

  return (
    <details className="account">
      <summary>{summary}</summary>
      {!configured && (
        <p className="hint">
          Ticks and notes stay in this browser. To sync them, copy <code>.env.example</code> to <code>.env</code>, add
          your project URL and publishable key, run <code>{MIGRATION_PATH}</code> and <code>supabase/schema.sql</code> in
          the SQL editor, then restart the dev server.
        </p>
      )}
      {configured && email && (
        <div className="account-signed-in">
          <p className={statusText === 'Synced' || statusText === 'Saving' ? 'status' : 'status warn'}>{statusText}</p>
          <button type="button" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      )}
      {configured && !email && (
        <form onSubmit={(event) => void submit(event, 'in')}>
          <label>
            Email
            <input
              type="email"
              autoComplete="username"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          {message && <p className="hint">{message}</p>}
          <div className="account-actions">
            <button type="submit" disabled={busy}>
              Sign in
            </button>
            <button type="button" disabled={busy} onClick={(event) => void submit(event, 'up')}>
              Create account
            </button>
          </div>
        </form>
      )}
    </details>
  )
}
