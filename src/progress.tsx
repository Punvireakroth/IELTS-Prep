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
import type { Session } from '@supabase/supabase-js'
import { getSupabase } from './supabase'

type Stamp = { body: string; updatedAt: string }

type Store = {
  checks: Record<string, Stamp>
  notes: Record<string, Stamp>
}

type ProgressValue = {
  configured: boolean
  userId: string | null
  email: string | null
  statusText: string
  checks: Record<string, boolean>
  notes: Record<string, string>
  toggleCheck: (key: string) => void
  setNote: (key: string, body: string) => void
  signIn: (email: string, password: string) => Promise<string | null>
  signUp: (email: string, password: string) => Promise<string | null>
  signOut: () => Promise<void>
}

const STORAGE_KEY = 'ielts-prep-progress-v1'
const LEGACY_CHECKS_KEY = 'ielts-prep-checks'
const LEGACY_CHECKS_FLAG = 'ielts-legacy-checks-imported'
const emptyStore = (): Store => ({ checks: {}, notes: {} })

const ProgressContext = createContext<ProgressValue | null>(null)

function readStore(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? (JSON.parse(raw) as Store) : emptyStore()
    return absorbLegacyChecks({
      checks: parsed.checks ?? {},
      notes: parsed.notes ?? {},
    })
  } catch {
    return absorbLegacyChecks(emptyStore())
  }
}

function absorbLegacyChecks(store: Store): Store {
  if (localStorage.getItem(LEGACY_CHECKS_FLAG) === '1') return store
  localStorage.setItem(LEGACY_CHECKS_FLAG, '1')
  try {
    const raw = localStorage.getItem(LEGACY_CHECKS_KEY)
    if (!raw) return store
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const checks = { ...store.checks }
    const updatedAt = new Date(0).toISOString()
    for (const [key, done] of Object.entries(parsed)) {
      if (!done || checks[key]) continue
      checks[key] = { body: 'true', updatedAt }
    }
    const next = { ...store, checks }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    return next
  } catch {
    return store
  }
}

function viewOf(store: Store) {
  const checks: Record<string, boolean> = {}
  const notes: Record<string, string> = {}
  for (const [key, value] of Object.entries(store.checks)) checks[key] = value.body === 'true'
  for (const [key, value] of Object.entries(store.notes)) notes[key] = value.body
  return { checks, notes }
}

export function ProgressProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => getSupabase(), [])
  const configured = supabase !== null
  const storeRef = useRef<Store>(readStore())
  const userId = useRef<string | null>(null)
  const timers = useRef<Record<string, number>>({})
  const [store, setStore] = useState<Store>(storeRef.current)
  const [userIdState, setUserIdState] = useState<string | null>(null)
  const [email, setEmail] = useState<string | null>(null)
  const [statusText, setStatusText] = useState(configured ? 'Sign in to sync' : 'On this browser')

  const commit = useCallback((next: Store) => {
    storeRef.current = next
    setStore(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }, [])

  const push = useCallback(
    async (table: 'study_checks' | 'study_notes', key: string, body: string, updatedAt: string) => {
      const uid = userId.current
      if (!supabase || !uid) return null
      setStatusText('Saving')
      if (table === 'study_checks') {
        const { error } = await supabase.from(table).upsert(
          { user_id: uid, item_key: key, checked: body === 'true', updated_at: updatedAt },
          { onConflict: 'user_id,item_key' },
        )
        if (error) {
          setStatusText(error.message)
          return error.message
        }
      } else {
        const { error } = await supabase.from(table).upsert(
          { user_id: uid, note_key: key, body, updated_at: updatedAt },
          { onConflict: 'user_id,note_key' },
        )
        if (error) {
          setStatusText(error.message)
          return error.message
        }
      }
      setStatusText('Synced')
      return null
    },
    [supabase],
  )

  const schedulePush = useCallback(
    (table: 'study_checks' | 'study_notes', key: string, body: string, updatedAt: string) => {
      if (!userId.current) return
      window.clearTimeout(timers.current[key])
      timers.current[key] = window.setTimeout(() => {
        void push(table, key, body, updatedAt)
      }, table === 'study_checks' ? 0 : 450)
    },
    [push],
  )

  const mergeRemote = useCallback(
    async (session: Session) => {
      if (!supabase) return
      userId.current = session.user.id
      setUserIdState(session.user.id)
      setEmail(session.user.email ?? null)
      setStatusText('Syncing')

      const [checksResult, notesResult, legacyChecks] = await Promise.all([
        supabase.from('study_checks').select('item_key, checked, updated_at'),
        supabase.from('study_notes').select('note_key, body, updated_at'),
        supabase.from('task_checks').select('task_id, done, updated_at'),
      ])

      if (checksResult.error || notesResult.error) {
        setStatusText(checksResult.error?.message ?? notesResult.error?.message ?? 'Could not sync')
        return
      }

      const next: Store = {
        checks: { ...storeRef.current.checks },
        notes: { ...storeRef.current.notes },
      }
      const uploads: { table: 'study_checks' | 'study_notes'; key: string; body: string; updatedAt: string }[] = []

      for (const row of checksResult.data ?? []) {
        const remoteAt = String(row.updated_at)
        const local = next.checks[row.item_key]
        const remoteBody = row.checked ? 'true' : 'false'
        if (!local || remoteAt >= local.updatedAt) {
          next.checks[row.item_key] = { body: remoteBody, updatedAt: remoteAt }
        } else {
          uploads.push({ table: 'study_checks', key: row.item_key, body: local.body, updatedAt: local.updatedAt })
        }
      }

      for (const row of notesResult.data ?? []) {
        const remoteAt = String(row.updated_at)
        const local = next.notes[row.note_key]
        if (!local || remoteAt >= local.updatedAt) {
          next.notes[row.note_key] = { body: row.body ?? '', updatedAt: remoteAt }
        } else {
          uploads.push({ table: 'study_notes', key: row.note_key, body: local.body, updatedAt: local.updatedAt })
        }
      }

      const studyKeys = new Set((checksResult.data ?? []).map((row) => row.item_key))
      if (!legacyChecks.error) {
        for (const row of legacyChecks.data ?? []) {
          if (studyKeys.has(row.task_id)) continue
          const remoteAt = String(row.updated_at)
          const local = next.checks[row.task_id]
          const remoteBody = row.done ? 'true' : 'false'
          if (!local || remoteAt >= local.updatedAt) {
            next.checks[row.task_id] = { body: remoteBody, updatedAt: remoteAt }
            uploads.push({ table: 'study_checks', key: row.task_id, body: remoteBody, updatedAt: remoteAt })
          } else {
            uploads.push({ table: 'study_checks', key: row.task_id, body: local.body, updatedAt: local.updatedAt })
          }
        }
      }

      for (const [key, value] of Object.entries(storeRef.current.checks)) {
        if (!studyKeys.has(key) && !uploads.some((item) => item.table === 'study_checks' && item.key === key)) {
          uploads.push({ table: 'study_checks', key, body: value.body, updatedAt: value.updatedAt })
        }
      }
      for (const [key, value] of Object.entries(storeRef.current.notes)) {
        if (!(notesResult.data ?? []).some((row) => row.note_key === key)) {
          uploads.push({ table: 'study_notes', key, body: value.body, updatedAt: value.updatedAt })
        }
      }

      commit(next)
      let failed: string | null = null
      for (const item of uploads) {
        failed = (await push(item.table, item.key, item.body, item.updatedAt)) ?? failed
      }
      if (!failed) setStatusText('Synced')
    },
    [commit, push, supabase],
  )

  useEffect(() => {
    if (!supabase) return
    let active = true

    void supabase.auth.getSession().then(({ data }) => {
      if (!active || !data.session) return
      void mergeRemote(data.session)
    })

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') return
      if (!session) {
        userId.current = null
        setUserIdState(null)
        setEmail(null)
        setStatusText('Sign in to sync')
        return
      }
      void mergeRemote(session)
    })

    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [mergeRemote, supabase])

  const toggleCheck = useCallback(
    (key: string) => {
      const current = storeRef.current.checks[key]?.body === 'true'
      const updatedAt = new Date().toISOString()
      const next: Store = {
        ...storeRef.current,
        checks: {
          ...storeRef.current.checks,
          [key]: { body: current ? 'false' : 'true', updatedAt },
        },
      }
      commit(next)
      schedulePush('study_checks', key, current ? 'false' : 'true', updatedAt)
    },
    [commit, schedulePush],
  )

  const setNote = useCallback(
    (key: string, body: string) => {
      const updatedAt = new Date().toISOString()
      const next: Store = {
        ...storeRef.current,
        notes: { ...storeRef.current.notes, [key]: { body, updatedAt } },
      }
      commit(next)
      schedulePush('study_notes', key, body, updatedAt)
    },
    [commit, schedulePush],
  )

  const signIn = useCallback(
    async (emailAddress: string, password: string) => {
      if (!supabase) return 'Supabase is not configured yet.'
      const { error } = await supabase.auth.signInWithPassword({
        email: emailAddress.trim(),
        password,
      })
      return error?.message ?? null
    },
    [supabase],
  )

  const signUp = useCallback(
    async (emailAddress: string, password: string) => {
      if (!supabase) return 'Supabase is not configured yet.'
      const { data, error } = await supabase.auth.signUp({
        email: emailAddress.trim(),
        password,
      })
      if (error) return error.message
      if (!data.session) {
        return 'Account created. Confirm the email, then sign in. Set the site URL to http://localhost:5173, or turn off Confirm email under Authentication settings if this account is only for you.'
      }
      return null
    },
    [supabase],
  )

  const signOut = useCallback(async () => {
    if (!supabase) return
    await supabase.auth.signOut()
  }, [supabase])

  const viewed = viewOf(store)
  const value = useMemo<ProgressValue>(
    () => ({
      configured,
      userId: userIdState,
      email,
      statusText,
      checks: viewed.checks,
      notes: viewed.notes,
      toggleCheck,
      setNote,
      signIn,
      signUp,
      signOut,
    }),
    [configured, email, setNote, signIn, signOut, signUp, statusText, toggleCheck, userIdState, viewed.checks, viewed.notes],
  )

  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>
}

export function useProgress() {
  const value = useContext(ProgressContext)
  if (!value) throw new Error('useProgress must be used within ProgressProvider')
  return value
}
