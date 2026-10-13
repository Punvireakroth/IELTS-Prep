import { useState, type FormEvent } from 'react'
import { Blocks } from './MarkdownView'
import { parseMarkdown } from './markdown'
import { type ErrorEntry, type Skill, useRecords } from './records'

const SKILLS: { value: Skill; label: string }[] = [
  { value: 'L', label: 'Listening' },
  { value: 'R', label: 'Reading' },
  { value: 'W', label: 'Writing' },
  { value: 'S', label: 'Speaking' },
]

type Draft = {
  date: string
  skill: Skill
  source: string
  raw_score: string
  band: string
  qtype: string
  why: string
  better: string
  word: string
}

function today () {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

function emptyDraft (): Draft {
  return {
    date: today(),
    skill: 'L',
    source: '',
    raw_score: '',
    band: '',
    qtype: '',
    why: '',
    better: '',
    word: '',
  }
}

function draftFrom (entry: ErrorEntry): Draft {
  return {
    date: entry.date,
    skill: entry.skill,
    source: entry.source,
    raw_score: entry.raw_score,
    band: entry.band,
    qtype: entry.qtype,
    why: entry.why,
    better: entry.better,
    word: entry.word,
  }
}

export function ErrorLog () {
  const { logs, notice, addLog, updateLog, deleteLog } = useRecords()
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<Draft>(emptyDraft)

  function setField (key: keyof Draft, value: string) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  async function onCreate (event: FormEvent) {
    event.preventDefault()
    await addLog(draft)
    setDraft(emptyDraft())
  }

  async function onUpdate (event: FormEvent) {
    event.preventDefault()
    if (!editingId) return
    await updateLog(editingId, editDraft)
    setEditingId(null)
  }

  return (
    <div className="tool">
      <p className="hint">After every Listening or Reading test, log the misses here. Week 6 is built from this.</p>
      {notice && <p className="status warn">{notice}</p>}
      <LogForm draft={draft} submitLabel="Save entry" onChange={setField} onSubmit={(event) => void onCreate(event)} />
      <div className="log-entries">
        {logs.length === 0 && <p className="hint">No entries yet.</p>}
        {logs.map((entry) => (
          editingId === entry.id ? (
            <article key={entry.id} className="log-entry">
              <LogForm
                draft={editDraft}
                submitLabel="Save changes"
                onChange={(key, value) => setEditDraft((current) => ({ ...current, [key]: value }))}
                onSubmit={(event) => void onUpdate(event)}
                onCancel={() => setEditingId(null)}
              />
            </article>
          ) : (
            <article key={entry.id} className="log-entry">
              <header>
                <span>
                  <span className="skill-pill">{entry.skill}</span>
                  {entry.date}
                </span>
                <span className="log-actions">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(entry.id)
                      setEditDraft(draftFrom(entry))
                    }}
                  >
                    Edit
                  </button>
                  <button type="button" className="danger" onClick={() => void deleteLog(entry.id)}>
                    Delete
                  </button>
                </span>
              </header>
              {entry.source && (
                <p className="log-meta">
                  <strong>Source. </strong>
                  {/^https?:\/\//i.test(entry.source) ? (
                    <a href={entry.source} target="_blank" rel="noreferrer">{entry.source}</a>
                  ) : entry.source}
                </p>
              )}
              {(entry.raw_score || entry.band) && (
                <p className="log-meta">
                  <strong>Score. </strong>
                  {entry.raw_score || 'n/a'} · band {entry.band || 'n/a'}
                </p>
              )}
              {entry.qtype && <p className="log-meta"><strong>Missed. </strong>{entry.qtype}</p>}
              {entry.why && <p className="log-meta"><strong>Why. </strong>{entry.why}</p>}
              {entry.better && (
                <div className="log-rich">
                  <Blocks blocks={parseMarkdown(entry.better)} />
                </div>
              )}
              {entry.word && <p className="log-meta"><strong>Word. </strong>{entry.word}</p>}
            </article>
          )
        ))}
      </div>
    </div>
  )
}

function LogForm ({
  draft,
  submitLabel,
  onChange,
  onSubmit,
  onCancel,
}: {
  draft: Draft
  submitLabel: string
  onChange: (key: keyof Draft, value: string) => void
  onSubmit: (event: FormEvent) => void
  onCancel?: () => void
}) {
  return (
    <form className="log-form" onSubmit={onSubmit}>
      <div className="log-row">
        <label>
          Date
          <input type="date" required value={draft.date} onChange={(event) => onChange('date', event.target.value)} />
        </label>
        <label>
          Skill
          <select value={draft.skill} onChange={(event) => onChange('skill', event.target.value)}>
            {SKILLS.map((skill) => (
              <option key={skill.value} value={skill.value}>{skill.label}</option>
            ))}
          </select>
        </label>
      </div>
      <label>
        Source + URL
        <input value={draft.source} onChange={(event) => onChange('source', event.target.value)} />
      </label>
      <div className="log-row">
        <label>
          Raw score (L/R)
          <input value={draft.raw_score} placeholder="e.g. 24 / 40" onChange={(event) => onChange('raw_score', event.target.value)} />
        </label>
        <label>
          Estimated band
          <input value={draft.band} placeholder="e.g. 6.0" onChange={(event) => onChange('band', event.target.value)} />
        </label>
      </div>
      <label>
        Question type missed
        <input value={draft.qtype} placeholder="TFNG, headings…" onChange={(event) => onChange('qtype', event.target.value)} />
      </label>
      <label>
        Why
        <input value={draft.why} placeholder="word trap / time / grammar…" onChange={(event) => onChange('why', event.target.value)} />
      </label>
      <label>
        Correct answer / feedback
        <textarea rows={5} value={draft.better} placeholder="Markdown is fine" onChange={(event) => onChange('better', event.target.value)} />
      </label>
      <label>
        Word to reuse
        <input value={draft.word} onChange={(event) => onChange('word', event.target.value)} />
      </label>
      <div className="log-actions">
        <button type="submit" className="primary">{submitLabel}</button>
        {onCancel && (
          <button type="button" onClick={onCancel}>Cancel</button>
        )}
      </div>
    </form>
  )
}
