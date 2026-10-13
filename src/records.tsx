import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useProgress } from './progress'
import { getSupabase } from './supabase'

export const SCORE_ROWS = [
  { key: 'diagnostic', label: 'Diagnostic' },
  { key: 'week3', label: 'Week 3' },
  { key: 'week4', label: 'Week 4' },
  { key: 'mockA', label: 'Mock A' },
  { key: 'mockB', label: 'Mock B' },
  { key: 'peak', label: 'Peak' },
] as const

export type ScoreField = 'l' | 'r' | 'w' | 's' | 'overall' | 'worst_problem'
export type ScoreEntry = Record<ScoreField, string>
export type Skill = 'L' | 'R' | 'W' | 'S'

export type ErrorEntry = {
  id: string
  date: string
  skill: Skill
  source: string
  raw_score: string
  band: string
  qtype: string
  why: string
  better: string
  word: string
  updatedAt: string
}

type LogInput = Omit<ErrorEntry, 'id' | 'updatedAt'>

type RecordsValue = {
  scores: Record<string, ScoreEntry>
  logs: ErrorEntry[]
  notice: string | null
  setScore: (key: string, field: ScoreField, value: string) => void
  addLog: (entry: LogInput) => Promise<void>
  updateLog: (id: string, entry: LogInput) => Promise<void>
  deleteLog: (id: string) => Promise<void>
}

const SCORE_KEY = 'ielts-prep-scores'
const LOG_KEY = 'ielts-prep-logs'

const RecordsContext = createContext<RecordsValue | null>(null)

function emptyScore (): ScoreEntry {
  return { l: '', r: '', w: '', s: '', overall: '', worst_problem: '' }
}

function hasScore (entry: ScoreEntry) {
  return Object.values(entry).some((value) => value.trim())
}

function isSkill (value: string): value is Skill {
  return value === 'L' || value === 'R' || value === 'W' || value === 'S'
}

function readScores (): { scores: Record<string, ScoreEntry>; times: Record<string, string> } {
  const scores: Record<string, ScoreEntry> = {}
  const times: Record<string, string> = {}
  for (const row of SCORE_ROWS) scores[row.key] = emptyScore()
  try {
    const raw = localStorage.getItem(SCORE_KEY)
    if (!raw) return { scores, times }
    const parsed = JSON.parse(raw) as Record<string, unknown>
    if (parsed.scores && typeof parsed.scores === 'object') {
      const stored = parsed.scores as Record<string, ScoreEntry>
      for (const row of SCORE_ROWS) {
        if (stored[row.key]) scores[row.key] = { ...emptyScore(), ...stored[row.key] }
      }
      if (parsed.times && typeof parsed.times === 'object') {
        Object.assign(times, parsed.times as Record<string, string>)
      }
      return { scores, times }
    }
    SCORE_ROWS.forEach((row, index) => {
      const named = parsed[row.key]
      if (named && typeof named === 'object') {
        scores[row.key] = { ...emptyScore(), ...(named as ScoreEntry) }
        return
      }
      const flat = parsed as Record<string, string>
      scores[row.key] = {
        l: flat[`r${index}c1`] || '',
        r: flat[`r${index}c2`] || '',
        w: flat[`r${index}c3`] || '',
        s: flat[`r${index}c4`] || '',
        overall: flat[`r${index}c5`] || '',
        worst_problem: flat[`r${index}c6`] || '',
      }
    })
  } catch {
    return { scores, times }
  }
  return { scores, times }
}

function readLogs (): ErrorEntry[] {
  try {
    const raw = localStorage.getItem(LOG_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Array<Record<string, string>>
    if (!Array.isArray(parsed)) return []
    let changed = false
    const logs = parsed.map((entry) => {
      const valid = /^[0-9a-f-]{36}$/i.test(entry.id || '')
      if (!valid) changed = true
      return {
        id: valid ? entry.id : crypto.randomUUID(),
        date: entry.date || '',
        skill: isSkill(entry.skill) ? entry.skill : 'L',
        source: entry.source || '',
        raw_score: entry.raw_score || entry.raw || '',
        band: entry.band || '',
        qtype: entry.qtype || '',
        why: entry.why || '',
        better: entry.better || '',
        word: entry.word || '',
        updatedAt: entry.updatedAt || '',
      }
    })
    if (changed) localStorage.setItem(LOG_KEY, JSON.stringify(logs))
    return logs
  } catch {
    return []
  }
}

function fromScoreRow (row: Record<string, string | null>) {
  return {
    l: row.l || '',
    r: row.r || '',
    w: row.w || '',
    s: row.s || '',
    overall: row.overall || '',
    worst_problem: row.worst_problem || '',
  }
}

function fromLogRow (row: Record<string, string | null>): ErrorEntry {
  return {
    id: String(row.id),
    date: row.date || '',
    skill: isSkill(String(row.skill)) ? (row.skill as Skill) : 'L',
    source: row.source || '',
    raw_score: row.raw_score || '',
    band: row.band || '',
    qtype: row.qtype || '',
    why: row.why || '',
    better: row.better || '',
    word: row.word || '',
    updatedAt: String(row.created_at || ''),
  }
}

export function RecordsProvider ({ children }: { children: ReactNode }) {
  const { userId } = useProgress()
  const initialScores = useRef(readScores())
  const [scores, setScores] = useState(initialScores.current.scores)
  const [logs, setLogs] = useState<ErrorEntry[]>(() => readLogs())
  const [notice, setNotice] = useState<string | null>(null)
  const scoresRef = useRef(scores)
  const logsRef = useRef(logs)
  const timesRef = useRef(initialScores.current.times)
  const timers = useRef<Record<string, number>>({})
  scoresRef.current = scores
  logsRef.current = logs

  const persistScores = useCallback((next: Record<string, ScoreEntry>) => {
    scoresRef.current = next
    setScores(next)
    localStorage.setItem(SCORE_KEY, JSON.stringify({ scores: next, times: timesRef.current }))
  }, [])

  const persistLogs = useCallback((next: ErrorEntry[]) => {
    logsRef.current = next
    setLogs(next)
    localStorage.setItem(LOG_KEY, JSON.stringify(next))
  }, [])

  const pushScore = useCallback(async (key: string) => {
    const supabase = getSupabase()
    if (!supabase || !userId) return
    const entry = scoresRef.current[key] ?? emptyScore()
    const updatedAt = timesRef.current[key] || new Date().toISOString()
    const { error } = await supabase.from('score_entries').upsert({
      user_id: userId,
      row_key: key,
      l: entry.l || null,
      r: entry.r || null,
      w: entry.w || null,
      s: entry.s || null,
      overall: entry.overall || null,
      worst_problem: entry.worst_problem || null,
      updated_at: updatedAt,
    })
    if (error) setNotice(error.message)
  }, [userId])

  const pushLog = useCallback(async (entry: ErrorEntry) => {
    const supabase = getSupabase()
    if (!supabase || !userId) return
    const { error } = await supabase.from('error_logs').upsert({
      id: entry.id,
      user_id: userId,
      date: entry.date || null,
      skill: entry.skill,
      source: entry.source || null,
      raw_score: entry.raw_score || null,
      band: entry.band || null,
      qtype: entry.qtype || null,
      why: entry.why || null,
      better: entry.better || null,
      word: entry.word || null,
    })
    if (error) setNotice(error.message)
  }, [userId])

  useEffect(() => {
    if (!userId) return
    const supabase = getSupabase()
    if (!supabase) return
    let active = true
    const startedTimes = { ...timesRef.current }
    const startedLogIds = new Set(logsRef.current.map((entry) => entry.id))

    async function sync () {
      const [scoreRes, logRes] = await Promise.all([
        supabase!.from('score_entries').select('*').eq('user_id', userId),
        supabase!.from('error_logs').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      ])
      if (!active) return
      if (scoreRes.error || logRes.error) {
        setNotice(scoreRes.error?.message ?? logRes.error?.message ?? 'Could not sync scores and the error log')
        return
      }

      const nextScores = { ...scoresRef.current }
      for (const row of SCORE_ROWS) {
        if ((timesRef.current[row.key] || '') !== (startedTimes[row.key] || '')) {
          nextScores[row.key] = scoresRef.current[row.key] ?? emptyScore()
          continue
        }
        const remote = (scoreRes.data ?? []).find((item) => item.row_key === row.key) as Record<string, string | null> | undefined
        const localEntry = nextScores[row.key] ?? emptyScore()
        const localTime = timesRef.current[row.key] || ''
        const remoteTime = remote?.updated_at ? String(remote.updated_at) : ''
        const remoteEntry = remote ? fromScoreRow(remote) : null
        if (remoteEntry && hasScore(remoteEntry) && (!hasScore(localEntry) || remoteTime >= localTime)) {
          nextScores[row.key] = remoteEntry
          timesRef.current[row.key] = remoteTime
        } else if (hasScore(localEntry)) {
          const updatedAt = localTime || new Date().toISOString()
          timesRef.current[row.key] = updatedAt
          const { error } = await supabase!.from('score_entries').upsert({
            user_id: userId,
            row_key: row.key,
            l: localEntry.l || null,
            r: localEntry.r || null,
            w: localEntry.w || null,
            s: localEntry.s || null,
            overall: localEntry.overall || null,
            worst_problem: localEntry.worst_problem || null,
            updated_at: updatedAt,
          })
          if (error) setNotice(error.message)
        }
      }
      if (active) persistScores(nextScores)

      const merged = new Map<string, ErrorEntry>()
      for (const row of logRes.data ?? []) merged.set(String(row.id), fromLogRow(row as Record<string, string | null>))
      for (const entry of logsRef.current) {
        const remote = merged.get(entry.id)
        if (!remote || entry.updatedAt > remote.updatedAt) {
          merged.set(entry.id, entry)
          if (!startedLogIds.has(entry.id) || entry.updatedAt > (remote?.updatedAt || '')) {
            await pushLog(entry)
          }
        }
      }
      const list = [...merged.values()].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
      if (active) persistLogs(list)
    }

    void sync()
    return () => {
      active = false
    }
  }, [persistLogs, persistScores, pushLog, userId])

  const setScore = useCallback((key: string, field: ScoreField, value: string) => {
    const updatedAt = new Date().toISOString()
    timesRef.current[key] = updatedAt
    const next = {
      ...scoresRef.current,
      [key]: { ...(scoresRef.current[key] ?? emptyScore()), [field]: value },
    }
    persistScores(next)
    if (!userId) return
    window.clearTimeout(timers.current[key])
    timers.current[key] = window.setTimeout(() => {
      void pushScore(key)
    }, 400)
  }, [persistScores, pushScore, userId])

  const addLog = useCallback(async (input: LogInput) => {
    const entry: ErrorEntry = { ...input, id: crypto.randomUUID(), updatedAt: new Date().toISOString() }
    persistLogs([entry, ...logsRef.current])
    await pushLog(entry)
  }, [persistLogs, pushLog])

  const updateLog = useCallback(async (id: string, input: LogInput) => {
    const entry: ErrorEntry = { ...input, id, updatedAt: new Date().toISOString() }
    persistLogs(logsRef.current.map((item) => (item.id === id ? entry : item)))
    await pushLog(entry)
  }, [persistLogs, pushLog])

  const deleteLog = useCallback(async (id: string) => {
    persistLogs(logsRef.current.filter((item) => item.id !== id))
    const supabase = getSupabase()
    if (!supabase || !userId) return
    const { error } = await supabase.from('error_logs').delete().eq('user_id', userId).eq('id', id)
    if (error) setNotice(error.message)
  }, [persistLogs, userId])

  const value = useMemo<RecordsValue>(() => ({
    scores,
    logs,
    notice,
    setScore,
    addLog,
    updateLog,
    deleteLog,
  }), [addLog, deleteLog, logs, notice, scores, setScore, updateLog])

  return <RecordsContext.Provider value={value}>{children}</RecordsContext.Provider>
}

export function useRecords () {
  const value = useContext(RecordsContext)
  if (!value) throw new Error('useRecords must be used within RecordsProvider')
  return value
}
