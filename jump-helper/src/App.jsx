import { useState, useEffect, useCallback } from 'react'
import { supabase } from './lib/supabase'
import { SEED_DATA, DEFAULT_MEMBERS_INIT } from './lib/seedData'
import { computePredictions, applyMLUpdate, INITIAL_WEIGHTS, WEIGHTS_VERSION } from './lib/prediction'
import { isHolidayDate, getTodayStr, formatDateKo } from './lib/utils'
import TabInput from './components/TabInput'
import TabPrediction from './components/TabPrediction'
import TabMembers from './components/TabMembers'
import TabAnalysis from './components/TabAnalysis'
import TabStats from './components/TabStats'
import TabElapsed from './components/TabElapsed'

const TABS = [
  { label: '입력',   icon: '✏️' },
  { label: '예측',   icon: '🎯' },
  { label: '멤버',   icon: '👥' },
  { label: '분석',   icon: '📊' },
  { label: '통계',   icon: '📈' },
  { label: '경과일', icon: '📅' },
]

export default function App() {
  const [history,   setHistory]   = useState([])
  const [weights,   setWeights]   = useState(INITIAL_WEIGHTS)
  const [members,   setMembers]   = useState([])
  const [mlLog,     setMlLog]     = useState([])
  const [activeTab, setActiveTab] = useState(0)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState(null)
  const [weightsId, setWeightsId] = useState(null)

  // ── Init ─────────────────────────────────────────────────────────────
  useEffect(() => { initApp() }, [])

  async function initApp() {
    try {
      // 1. Seed duty_history (upsert, ignore duplicates by date)
      await supabase
        .from('duty_history')
        .upsert(SEED_DATA, { onConflict: 'date', ignoreDuplicates: true })

      // 2. Init members if table is empty
      const { data: existingMembers } = await supabase
        .from('duty_members').select('id').limit(1)
      if (!existingMembers || existingMembers.length === 0) {
        await supabase.from('duty_members').insert(DEFAULT_MEMBERS_INIT)
      }

      // 3. Init / load weights
      const { data: wRows } = await supabase
        .from('duty_weights')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1)

      if (!wRows || wRows.length === 0) {
        const { data: wNew } = await supabase
          .from('duty_weights')
          .insert({ version: WEIGHTS_VERSION, ...INITIAL_WEIGHTS })
          .select()
        if (wNew?.[0]) { setWeightsId(wNew[0].id); setWeights(INITIAL_WEIGHTS) }
      } else {
        const row = wRows[0]
        setWeightsId(row.id)
        if (row.version !== WEIGHTS_VERSION) {
          // Reset on version mismatch
          await supabase.from('duty_weights')
            .update({ version: WEIGHTS_VERSION, ...INITIAL_WEIGHTS, updated_at: new Date().toISOString() })
            .eq('id', row.id)
          setWeights(INITIAL_WEIGHTS)
        } else {
          setWeights({ elapsed: +row.elapsed, fairness: +row.fairness, recency: +row.recency, rot: +row.rot })
        }
      }

      await loadAll()
      setLoading(false)
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  const loadAll = useCallback(async () => {
    const [histRes, memRes, logRes, wRes] = await Promise.all([
      supabase.from('duty_history').select('*').order('date'),
      supabase.from('duty_members').select('*').order('display_order'),
      supabase.from('duty_ml_log').select('*').order('created_at', { ascending: false }).limit(200),
      supabase.from('duty_weights').select('*').order('updated_at', { ascending: false }).limit(1),
    ])
    if (histRes.data) setHistory(histRes.data)
    if (memRes.data)  setMembers(memRes.data)
    if (logRes.data)  setMlLog(logRes.data)
    if (wRes.data?.[0]) {
      const r = wRes.data[0]
      setWeightsId(r.id)
      setWeights({ elapsed: +r.elapsed, fairness: +r.fairness, recency: +r.recency, rot: +r.rot })
    }
  }, [])

  // ── Save entry + ML update ───────────────────────────────────────────
  const saveEntry = useCallback(async (date, person, isHoliday) => {
    const activeMems = members.filter(m => m.is_active && !m.is_retired)
    const predictions = computePredictions(date, isHoliday, history, activeMems, weights)

    const rank = predictions.findIndex(p => p.person === person) + 1
    const actualPred = predictions.find(p => p.person === person)
    const newWeights = applyMLUpdate(weights, person, predictions)

    const top5 = predictions.slice(0, 5).map(p => ({ person: p.person, prob: p.prob }))
    const delta = {
      elapsed:  +(newWeights.elapsed  - weights.elapsed ).toFixed(6),
      fairness: +(newWeights.fairness - weights.fairness).toFixed(6),
      recency:  +(newWeights.recency  - weights.recency ).toFixed(6),
      rot:      +(newWeights.rot      - weights.rot     ).toFixed(6),
    }

    // DB writes
    await Promise.all([
      supabase.from('duty_history').upsert({ date, person, is_holiday: isHoliday }, { onConflict: 'date' }),
      supabase.from('duty_ml_log').insert({
        date,
        actual_person: person,
        is_holiday: isHoliday,
        predicted_rank: rank || 99,
        predicted_prob: actualPred?.prob ?? 0,
        top5,
        weights_before: { ...weights },
        weights_after: newWeights,
        delta,
      }),
    ])

    if (weightsId) {
      await supabase.from('duty_weights')
        .update({ ...newWeights, updated_at: new Date().toISOString() })
        .eq('id', weightsId)
    } else {
      const { data: wNew } = await supabase
        .from('duty_weights')
        .insert({ version: WEIGHTS_VERSION, ...newWeights })
        .select()
      if (wNew?.[0]) setWeightsId(wNew[0].id)
    }

    // Local state update
    setWeights(newWeights)
    setHistory(prev => {
      const filtered = prev.filter(h => h.date !== date)
      return [...filtered, { date, person, is_holiday: isHoliday }]
        .sort((a, b) => a.date.localeCompare(b.date))
    })

    // Reload log
    const { data: newLog } = await supabase
      .from('duty_ml_log').select('*').order('created_at', { ascending: false }).limit(200)
    if (newLog) setMlLog(newLog)

    return { rank: rank || 99, predictions, oldWeights: { ...weights }, newWeights, delta }
  }, [history, members, weights, weightsId])

  // ── Member management ────────────────────────────────────────────────
  const addMember = useCallback(async (name) => {
    const maxOrder = members.reduce((m, r) => Math.max(m, r.display_order || 0), 0)
    const { data } = await supabase.from('duty_members')
      .insert({ name, is_active: true, is_retired: false, is_new: true, display_order: maxOrder + 1 })
      .select()
    if (data?.[0]) setMembers(prev => [...prev, data[0]])
  }, [members])

  const toggleMemberActive = useCallback(async (id, isActive) => {
    await supabase.from('duty_members').update({ is_active: isActive }).eq('id', id)
    setMembers(prev => prev.map(m => m.id === id ? { ...m, is_active: isActive } : m))
  }, [])

  const retireMember = useCallback(async (id) => {
    await supabase.from('duty_members').update({ is_retired: true, is_active: false }).eq('id', id)
    setMembers(prev => prev.map(m => m.id === id ? { ...m, is_retired: true, is_active: false } : m))
  }, [])

  const resetWeights = useCallback(async () => {
    if (!weightsId) return
    await supabase.from('duty_weights')
      .update({ ...INITIAL_WEIGHTS, version: WEIGHTS_VERSION, updated_at: new Date().toISOString() })
      .eq('id', weightsId)
    setWeights(INITIAL_WEIGHTS)
  }, [weightsId])

  // ── Render ────────────────────────────────────────────────────────────
  if (loading) return <LoadingScreen />
  if (error)   return <ErrorScreen error={error} />

  const tabProps = { history, weights, members, mlLog, saveEntry, addMember, toggleMemberActive, retireMember, resetWeights }

  const today = getTodayStr()
  const todayHoliday = isHolidayDate(today)

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100dvh', background:'var(--bg)' }}>
      {/* Header */}
      <header style={{
        background: 'var(--surface2)',
        borderBottom: '1px solid var(--border)',
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontFamily:'Syne', fontWeight:800, fontSize:18, color:'var(--accent)', letterSpacing:-0.5 }}>
            ⚡ Jump 도우미
          </span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontFamily:'IBM Plex Mono', fontSize:12, color:'var(--muted)' }}>
            {formatDateKo(today)}
          </span>
          <span style={{
            fontSize:11, fontWeight:600, padding:'2px 8px', borderRadius:99,
            ...(todayHoliday
              ? { background:'rgba(245,166,35,0.15)', color:'#f5a623', border:'1px solid rgba(245,166,35,0.3)' }
              : { background:'rgba(0,229,255,0.1)',   color:'var(--accent)', border:'1px solid rgba(0,229,255,0.2)' }
            )
          }}>
            {todayHoliday ? '휴일' : '평일'}
          </span>
        </div>
      </header>

      {/* Tab content */}
      <main className="scroll-area" style={{ flex:1, overflow:'auto' }}>
        {activeTab === 0 && <TabInput {...tabProps} />}
        {activeTab === 1 && <TabPrediction {...tabProps} />}
        {activeTab === 2 && <TabMembers {...tabProps} />}
        {activeTab === 3 && <TabAnalysis {...tabProps} />}
        {activeTab === 4 && <TabStats {...tabProps} />}
        {activeTab === 5 && <TabElapsed {...tabProps} />}
      </main>

      {/* Bottom tab bar */}
      <nav style={{
        background: 'var(--surface2)',
        borderTop: '1px solid var(--border)',
        display: 'grid',
        gridTemplateColumns: 'repeat(6, 1fr)',
        flexShrink: 0,
      }}>
        {TABS.map((t, i) => (
          <button
            key={i}
            onClick={() => setActiveTab(i)}
            style={{
              display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
              padding:'8px 2px 6px',
              background:'none', border:'none', cursor:'pointer',
              color: activeTab === i ? 'var(--accent)' : 'var(--muted)',
              borderTop: activeTab === i ? '2px solid var(--accent)' : '2px solid transparent',
              transition: 'color 0.2s',
              fontSize:18,
            }}
          >
            <span>{t.icon}</span>
            <span style={{ fontSize:10, marginTop:2, fontWeight: activeTab === i ? 600 : 400 }}>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}

function LoadingScreen() {
  return (
    <div style={{
      height:'100dvh', display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center', background:'var(--bg)', gap:16,
    }}>
      <div style={{
        width:48, height:48, border:'3px solid var(--border)',
        borderTopColor:'var(--accent)', borderRadius:'50%',
        animation:'spin 0.8s linear infinite',
      }}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <p style={{ color:'var(--muted)', fontFamily:'IBM Plex Mono', fontSize:13 }}>
        데이터 로드 중…
      </p>
    </div>
  )
}

function ErrorScreen({ error }) {
  return (
    <div style={{
      height:'100dvh', display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center', background:'var(--bg)', gap:12, padding:24,
    }}>
      <span style={{ fontSize:32 }}>⚠️</span>
      <p style={{ fontFamily:'Syne', fontWeight:700, color:'var(--danger)' }}>연결 오류</p>
      <p style={{ color:'var(--muted)', fontSize:13, textAlign:'center' }}>{error}</p>
      <p style={{ color:'var(--subtle)', fontSize:12, textAlign:'center' }}>
        .env.local 파일에 VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY를 설정해주세요.
      </p>
    </div>
  )
}
