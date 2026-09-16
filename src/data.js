import { supabase } from './supabase.js'
import { showToast } from './toast.js'
import { SCORE_ROWS } from './content.js'

const LOCAL_KEYS = {
  checks: 'ielts-prep-checks',
  scores: 'ielts-prep-scores',
  logs: 'ielts-prep-logs'
}

const DEFAULT_PROFILE = {
  test_label: 'IELTS Academic (computer in Cambodia)',
  start_date: '2026-09-16',
  target_window: '28 October – 7 November 2026',
  current_level: 'about band 5.5–6',
  goal: 'overall 6.5+, with no skill below 6.0',
  daily_time: '1.5–2 hours (90–120 minutes)'
}

export async function ensureProfile (userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()

  if (error) throw error
  if (data) return data

  const row = { id: userId, ...DEFAULT_PROFILE }
  const { data: inserted, error: insertErr } = await supabase
    .from('profiles')
    .insert(row)
    .select()
    .single()
  if (insertErr) throw insertErr
  return inserted
}

export async function updateProfile (userId, fields) {
  const { data, error } = await supabase
    .from('profiles')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function loadChecks (userId) {
  const { data, error } = await supabase
    .from('task_checks')
    .select('task_id, done')
    .eq('user_id', userId)
  if (error) throw error
  const map = {}
  for (const row of data || []) {
    if (row.done) map[row.task_id] = true
  }
  return map
}

export async function upsertCheck (userId, taskId, done) {
  const { error } = await supabase.from('task_checks').upsert({
    user_id: userId,
    task_id: taskId,
    done,
    updated_at: new Date().toISOString()
  })
  if (error) throw error
}

export async function loadScores (userId) {
  const { data, error } = await supabase
    .from('score_entries')
    .select('*')
    .eq('user_id', userId)
  if (error) throw error
  const map = {}
  for (const row of data || []) map[row.row_key] = row
  return map
}

export async function upsertScore (userId, rowKey, fields) {
  const { error } = await supabase.from('score_entries').upsert({
    user_id: userId,
    row_key: rowKey,
    ...fields,
    updated_at: new Date().toISOString()
  })
  if (error) throw error
}

export async function loadLogs (userId) {
  const { data, error } = await supabase
    .from('error_logs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function insertLog (userId, entry) {
  const { data, error } = await supabase
    .from('error_logs')
    .insert({ user_id: userId, ...entry })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteLog (userId, id) {
  const { error } = await supabase
    .from('error_logs')
    .delete()
    .eq('user_id', userId)
    .eq('id', id)
  if (error) throw error
}

function readLocalJSON (key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

export async function importLocalStorageIfNeeded (userId, remote) {
  const localChecks = readLocalJSON(LOCAL_KEYS.checks, {})
  const localScores = readLocalJSON(LOCAL_KEYS.scores, {})
  const localLogs = readLocalJSON(LOCAL_KEYS.logs, [])

  const hasLocal =
    Object.keys(localChecks).length > 0 ||
    Object.keys(localScores).length > 0 ||
    (Array.isArray(localLogs) && localLogs.length > 0)

  if (!hasLocal) return false

  const remoteEmpty =
    Object.keys(remote.checks).length === 0 &&
    Object.keys(remote.scores).length === 0 &&
    remote.logs.length === 0

  if (!remoteEmpty) return false

  const checkRows = Object.entries(localChecks)
    .filter(([, done]) => done)
    .map(([task_id, done]) => ({
      user_id: userId,
      task_id,
      done: !!done,
      updated_at: new Date().toISOString()
    }))

  if (checkRows.length) {
    const { error } = await supabase.from('task_checks').upsert(checkRows)
    if (error) throw error
  }

  // Old local score keys were r0c1 style; map if we can, else skip unknown
  const scoreRows = []
  SCORE_ROWS.forEach((row, rowIdx) => {
    const l = localScores[`r${rowIdx}c1`]
    const r = localScores[`r${rowIdx}c2`]
    const w = localScores[`r${rowIdx}c3`]
    const s = localScores[`r${rowIdx}c4`]
    const overall = localScores[`r${rowIdx}c5`]
    const worst = localScores[`r${rowIdx}c6`]
    if (l || r || w || s || overall || worst) {
      scoreRows.push({
        user_id: userId,
        row_key: row.key,
        l: l || null,
        r: r || null,
        w: w || null,
        s: s || null,
        overall: overall || null,
        worst_problem: worst || null,
        updated_at: new Date().toISOString()
      })
    }
  })

  if (scoreRows.length) {
    const { error } = await supabase.from('score_entries').upsert(scoreRows)
    if (error) throw error
  }

  if (Array.isArray(localLogs) && localLogs.length) {
    const logRows = localLogs.map((e) => ({
      user_id: userId,
      date: e.date || null,
      skill: e.skill || 'L',
      source: e.source || null,
      raw_score: e.raw || null,
      band: e.band || null,
      qtype: e.qtype || null,
      why: e.why || null,
      better: e.better || null,
      word: e.word || null
    }))
    const { error } = await supabase.from('error_logs').insert(logRows)
    if (error) throw error
  }

  localStorage.removeItem(LOCAL_KEYS.checks)
  localStorage.removeItem(LOCAL_KEYS.scores)
  localStorage.removeItem(LOCAL_KEYS.logs)
  showToast('Imported previous browser progress into your account')
  return true
}

export async function loadAllUserData (userId) {
  let profile = await ensureProfile(userId)
  let checks = await loadChecks(userId)
  let scores = await loadScores(userId)
  let logs = await loadLogs(userId)

  const imported = await importLocalStorageIfNeeded(userId, { checks, scores, logs })
  if (imported) {
    checks = await loadChecks(userId)
    scores = await loadScores(userId)
    logs = await loadLogs(userId)
  }

  return { profile, checks, scores, logs }
}

export { DEFAULT_PROFILE }
