import { useState, useEffect, useCallback } from 'react'
import { supabase } from './lib/supabase'
import { SEED_DATA, DEFAULT_MEMBERS_INIT } from './lib/seedData'
import { computePredictions, applyMLUpdate, INITIAL_WEIGHTS, WEIGHTS_VERSION, getEffectiveROT, NON_ROT_MEMBERS } from './lib/prediction'
import { isHolidayDate, getTodayStr, formatDateKo } from './lib/utils'
import TabInput      from './components/TabInput'
import TabPrediction from './components/TabPrediction'
import TabMembers    from './components/TabMembers'
import TabAnalysis   from './components/TabAnalysis'
import TabStats      from './components/TabStats'
import TabElapsed    from './components/TabElapsed'
import JumpMeter     from './components/JumpMeter'
import TabMonthly    from './components/TabMonthly'

const TABS = [
  { label:'JUMP 대시보드', icon:'⚡', short:'JUMP' },
  { label:'담당자 입력',   icon:'✏️', short:'입력' },
  { label:'예측 보기',     icon:'🎯', short:'예측' },
  { label:'멤버 관리',     icon:'👥', short:'멤버' },
  { label:'분석',          icon:'📊', short:'분석' },
  { label:'통계',          icon:'📈', short:'통계' },
  { label:'월별 순번',     icon:'🗓️', short:'월별' },
]

function useWindowWidth() {
  const [w, setW] = useState(() => typeof window !== 'undefined' ? window.innerWidth : 1024)
  useEffect(() => {
    const fn = () => setW(window.innerWidth)
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])
  return w
}

export default function App() {
  const [history,   setHistory]   = useState([])
  const [weights,   setWeights]   = useState(INITIAL_WEIGHTS)
  const [members,   setMembers]   = useState([])
  const [mlLog,     setMlLog]     = useState([])
  const [activeTab, setActiveTab] = useState(0)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState(null)
  const [weightsId, setWeightsId] = useState(null)
  const [sideOpen,  setSideOpen]  = useState(false)

  const windowWidth = useWindowWidth()
  const isDesktop   = windowWidth >= 768

  useEffect(() => { initApp() }, [])

  function selectTab(i) { setActiveTab(i); setSideOpen(false) }

  async function initApp() {
    try {
      await supabase.from('duty_history').upsert(SEED_DATA, { onConflict:'date', ignoreDuplicates:true })
      const { data:em } = await supabase.from('duty_members').select('id').limit(1)
      if (!em || em.length === 0) await supabase.from('duty_members').insert(DEFAULT_MEMBERS_INIT)
      const { data:wRows } = await supabase.from('duty_weights').select('*').order('updated_at',{ascending:false}).limit(1)
      if (!wRows || wRows.length === 0) {
        const { data:wNew } = await supabase.from('duty_weights').insert({ version:WEIGHTS_VERSION, ...INITIAL_WEIGHTS }).select()
        if (wNew?.[0]) { setWeightsId(wNew[0].id); setWeights(INITIAL_WEIGHTS) }
      } else {
        const row = wRows[0]; setWeightsId(row.id)
        if (row.version !== WEIGHTS_VERSION) {
          await supabase.from('duty_weights').update({ version:WEIGHTS_VERSION, ...INITIAL_WEIGHTS, updated_at:new Date().toISOString() }).eq('id', row.id)
          setWeights(INITIAL_WEIGHTS)
        } else {
          setWeights({ elapsed:+row.elapsed, fairness:+row.fairness, recency:+row.recency, rot:+row.rot, dow:+(row.dow??0.14) })
        }
      }
      await loadAll(); setLoading(false)
    } catch(err) { setError(err.message); setLoading(false) }
  }

  const loadAll = useCallback(async () => {
    const [h,m,l,w] = await Promise.all([
      supabase.from('duty_history').select('*').order('date'),
      supabase.from('duty_members').select('*').order('display_order'),
      supabase.from('duty_ml_log').select('*').order('created_at',{ascending:false}).limit(200),
      supabase.from('duty_weights').select('*').order('updated_at',{ascending:false}).limit(1),
    ])
    if (h.data) setHistory(h.data)
    if (m.data) setMembers(m.data)
    if (l.data) setMlLog(l.data)
    if (w.data?.[0]) { const r=w.data[0]; setWeightsId(r.id); setWeights({ elapsed:+r.elapsed, fairness:+r.fairness, recency:+r.recency, rot:+r.rot, dow:+(r.dow??0.14) }) }
  }, [])

  const saveEntry = useCallback(async (date, person, isHoliday) => {
    const activeMems = members.filter(m => m.is_active && !m.is_retired)
    const dynROT = getEffectiveROT(members)
    const predictions = computePredictions(date, isHoliday, history, activeMems, weights, dynROT)
    const rank = predictions.findIndex(p => p.person === person) + 1
    const actualPred = predictions.find(p => p.person === person)
    const newWeights = applyMLUpdate(weights, person, predictions)
    const top5 = predictions.slice(0,5).map(p => ({ person:p.person, prob:p.prob }))
    const delta = {
      elapsed:  +(newWeights.elapsed  - weights.elapsed ).toFixed(6),
      fairness: +(newWeights.fairness - weights.fairness).toFixed(6),
      recency:  +(newWeights.recency  - weights.recency ).toFixed(6),
      rot:      +(newWeights.rot      - weights.rot     ).toFixed(6),
      dow:      +(newWeights.dow      - weights.dow     ).toFixed(6),
    }
    await Promise.all([
      supabase.from('duty_history').upsert({ date, person, is_holiday:isHoliday }, { onConflict:'date' }),
      supabase.from('duty_ml_log').insert({ date, actual_person:person, is_holiday:isHoliday, predicted_rank:rank||99, predicted_prob:actualPred?.prob??0, top5, weights_before:{...weights}, weights_after:newWeights, delta }),
    ])
    if (weightsId) await supabase.from('duty_weights').update({ ...newWeights, updated_at:new Date().toISOString() }).eq('id', weightsId)
    else {
      const { data:wNew } = await supabase.from('duty_weights').insert({ version:WEIGHTS_VERSION, ...newWeights }).select()
      if (wNew?.[0]) setWeightsId(wNew[0].id)
    }
    setWeights(newWeights)
    setHistory(prev => [...prev.filter(h => h.date !== date), { date, person, is_holiday:isHoliday }].sort((a,b) => a.date.localeCompare(b.date)))
    const { data:newLog } = await supabase.from('duty_ml_log').select('*').order('created_at',{ascending:false}).limit(200)
    if (newLog) setMlLog(newLog)
    return { rank:rank||99, predictions, oldWeights:{...weights}, newWeights, delta }
  }, [history, members, weights, weightsId])

  const addMember = useCallback(async (name) => {
    const maxOrder = members.reduce((m,r) => Math.max(m, r.display_order||0), 0)
    const { data } = await supabase.from('duty_members').insert({ name, is_active:true, is_retired:false, is_new:true, is_non_rot:true, display_order:maxOrder+1 }).select()
    if (data?.[0]) setMembers(prev => [...prev, data[0]])
  }, [members])

  const toggleMemberActive = useCallback(async (id, isActive) => {
    await supabase.from('duty_members').update({ is_active:isActive }).eq('id', id)
    setMembers(prev => prev.map(m => m.id===id ? {...m, is_active:isActive} : m))
  }, [])

  const retireMember = useCallback(async (id) => {
    await supabase.from('duty_members').update({ is_retired:true, is_active:false }).eq('id', id)
    setMembers(prev => prev.map(m => m.id===id ? {...m, is_retired:true, is_active:false} : m))
  }, [])

  const setMemberType = useCallback(async (id, type) => {
    await supabase.from('duty_members').update({ member_type:type }).eq('id', id)
    setMembers(prev => prev.map(m => m.id===id ? {...m, member_type:type} : m))
  }, [])

  const setMemberOrder = useCallback(async (id, order) => {
    await supabase.from('duty_members').update({ display_order:order }).eq('id', id)
    setMembers(prev => prev.map(m => m.id===id ? {...m, display_order:order} : m))
  }, [])

  const swapROTOrder = useCallback(async (id1, id2) => {
    const m1 = members.find(m => m.id===id1), m2 = members.find(m => m.id===id2)
    if (!m1||!m2) return
    await Promise.all([
      supabase.from('duty_members').update({ display_order:m2.display_order }).eq('id', id1),
      supabase.from('duty_members').update({ display_order:m1.display_order }).eq('id', id2),
    ])
    setMembers(prev => prev.map(m => m.id===id1 ? {...m, display_order:m2.display_order} : m.id===id2 ? {...m, display_order:m1.display_order} : m))
  }, [members])

  const setNonROT = useCallback(async (id, isNonRot) => {
    let newOrder
    if (!isNonRot) {
      const rotMems = members.filter(m => !(m.is_non_rot??NON_ROT_MEMBERS.includes(m.name)) && m.is_active && !m.is_retired)
      newOrder = rotMems.length > 0 ? Math.max(...rotMems.map(m => m.display_order||0)) + 1 : 1
    }
    const update = { is_non_rot:isNonRot, ...(newOrder !== undefined ? { display_order:newOrder } : {}) }
    await supabase.from('duty_members').update(update).eq('id', id)
    setMembers(prev => prev.map(m => m.id===id ? {...m, ...update} : m))
  }, [members])

  const resetWeights = useCallback(async () => {
    if (!weightsId) return
    await supabase.from('duty_weights').update({ ...INITIAL_WEIGHTS, version:WEIGHTS_VERSION, updated_at:new Date().toISOString() }).eq('id', weightsId)
    setWeights(INITIAL_WEIGHTS)
  }, [weightsId])

  if (loading) return <Loader />
  if (error)   return <Err msg={error} />

  const dynamicROT = getEffectiveROT(members)
  const tabProps = { history, weights, members, mlLog, saveEntry, addMember, toggleMemberActive, retireMember, resetWeights, setMemberType, setMemberOrder, swapROTOrder, setNonROT, dynamicROT, isDesktop }
  const today    = getTodayStr()
  const todayHol = isHolidayDate(today)
  const goodCnt  = members.filter(m => m.is_active && !m.is_retired && m.member_type === 'good').length
  const badCnt   = members.filter(m => m.is_active && !m.is_retired && m.member_type === 'bad').length
  const top1Pct  = mlLog.length ? Math.round(mlLog.slice(0,10).filter(l => l.predicted_rank === 1).length / Math.min(mlLog.length,10) * 100) : null

  /* ── LAYOUT ──────────────────────────────────────────── */
  const sidebarStyle = {
    width: isDesktop ? 220 : 240,
    flexShrink: 0,
    background: 'linear-gradient(180deg,#C62828 0%,#8B0000 100%)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    zIndex: 100,
    // KEY: position changes based on device
    position: isDesktop ? 'relative' : 'fixed',
    top: 0, bottom: 0, left: 0,
    transform: isDesktop ? 'none' : (sideOpen ? 'translateX(0)' : 'translateX(-100%)'),
    transition: isDesktop ? 'none' : 'transform 0.25s ease',
    boxShadow: isDesktop ? '2px 0 12px rgba(0,0,0,0.08)' : '4px 0 20px rgba(0,0,0,0.2)',
  }

  return (
    <div style={{ display:'flex', height:'100dvh', overflow:'hidden', background:'var(--bg)' }}>

      {/* Mobile backdrop */}
      {!isDesktop && sideOpen && (
        <div onClick={() => setSideOpen(false)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:99, backdropFilter:'blur(2px)' }}/>
      )}

      {/* ── Sidebar ── */}
      <aside style={sidebarStyle}>
        {/* Logo */}
        <div style={{ padding:'18px 16px 12px', borderBottom:'1px solid rgba(255,255,255,0.12)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:40, height:40, borderRadius:11, background:'rgba(255,255,255,0.18)', border:'2px solid rgba(255,255,255,0.3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0 }}>⚡</div>
            <div>
              <div style={{ fontWeight:900, fontSize:15, color:'#FFF', letterSpacing:-0.3 }}>Jump 도우미</div>
              <div style={{ fontSize:10, color:'rgba(255,255,255,0.45)', marginTop:1 }}>Duty Oracle v5.1</div>
            </div>
          </div>
        </div>

        {/* Today */}
        <div style={{ margin:'10px 10px 4px', padding:'10px 12px', borderRadius:10, background:'rgba(0,0,0,0.18)' }}>
          <div style={{ fontSize:10, color:'rgba(255,255,255,0.45)', fontWeight:700 }}>TODAY</div>
          <div style={{ fontWeight:800, fontSize:14, color:'#FFF', marginTop:3 }}>{formatDateKo(today)}</div>
          <div style={{ display:'flex', gap:6, marginTop:7, flexWrap:'wrap' }}>
            <span style={{ fontSize:11, padding:'3px 9px', borderRadius:99, background:todayHol?'rgba(255,167,38,0.25)':'rgba(76,175,80,0.25)', color:todayHol?'#FFD54F':'#A5D6A7', fontWeight:700 }}>
              {todayHol ? '🌙 휴일' : '☀️ 평일'}
            </span>
            {top1Pct !== null && <span style={{ fontSize:11, padding:'3px 9px', borderRadius:99, background:'rgba(255,255,255,0.15)', color:'#FFF', fontWeight:700 }}>🎯 {top1Pct}%</span>}
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex:1, padding:'6px 0', overflowY:'auto' }}>
          <div style={{ padding:'6px 16px 4px', fontSize:9, fontWeight:800, color:'rgba(255,255,255,0.35)', letterSpacing:0.1 }}>NAVIGATION</div>
          {TABS.map((t,i) => (
            <button key={i} onClick={() => selectTab(i)} style={{
              display:'flex', alignItems:'center', gap:11, padding:'11px 14px',
              borderRadius:10, margin:'2px 8px', cursor:'pointer',
              width:'calc(100% - 16px)', textAlign:'left', border:'none',
              background: activeTab===i ? 'rgba(255,255,255,0.18)' : 'transparent',
              color: activeTab===i ? '#FFF' : 'rgba(255,255,255,0.58)',
              fontWeight: activeTab===i ? 800 : 600,
              fontSize:13, fontFamily:'var(--sans)', transition:'background 0.15s',
            }}>
              <span style={{ fontSize:17, width:22, textAlign:'center', flexShrink:0 }}>{t.icon}</span>
              <span style={{ flex:1 }}>{t.label}</span>
              {activeTab===i && <span style={{ width:6, height:6, borderRadius:'50%', background:'#FFF', flexShrink:0 }}/>}
            </button>
          ))}
        </nav>

        {/* Team status */}
        <div style={{ padding:'12px', borderTop:'1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ fontSize:9, color:'rgba(255,255,255,0.35)', marginBottom:8, fontWeight:800, letterSpacing:0.1 }}>TEAM STATUS</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6 }}>
            {[
              ['⭐', goodCnt, '좋은사람', 'rgba(76,175,80,0.25)', '#A5D6A7'],
              ['👥', members.filter(m => m.is_active && !m.is_retired).length, '전체', 'rgba(255,255,255,0.1)', '#FFF'],
              ['🍄', badCnt, '위험군', 'rgba(239,83,80,0.25)', '#EF9A9A'],
            ].map(([icon, cnt, label, bg, color]) => (
              <div key={label} style={{ textAlign:'center', padding:'7px 4px', borderRadius:8, background:bg }}>
                <div style={{ fontSize:12 }}>{icon}</div>
                <div style={{ fontFamily:'var(--mono)', fontWeight:900, fontSize:15, color, lineHeight:1, marginTop:2 }}>{cnt}</div>
                <div style={{ fontSize:9, color, opacity:0.8, marginTop:2 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minWidth:0 }}>

        {/* Header */}
        <header style={{
          background:'var(--s1)', borderBottom:'1.5px solid var(--border)',
          padding:`0 ${isDesktop ? 24 : 16}px`, height:56, flexShrink:0,
          display:'flex', alignItems:'center', justifyContent:'space-between',
          boxShadow:'0 2px 8px rgba(26,31,54,0.06)',
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:14 }}>
            {/* Hamburger — mobile only */}
            {!isDesktop && (
              <button onClick={() => setSideOpen(v => !v)} style={{
                width:38, height:38, borderRadius:9, display:'flex', flexDirection:'column',
                alignItems:'center', justifyContent:'center', gap:5,
                background: sideOpen ? 'var(--red)' : 'var(--s3)',
                border:`1.5px solid ${sideOpen ? '#8B0000' : 'var(--border)'}`,
                cursor:'pointer', padding:0, flexShrink:0, transition:'all 0.15s',
              }}>
                {[0,1,2].map(i => (
                  <div key={i} style={{
                    width:15, height:2, borderRadius:1,
                    background: sideOpen ? '#FFF' : 'var(--text2)',
                    transition:'all 0.2s',
                    transform: sideOpen
                      ? (i===0 ? 'rotate(45deg) translate(3px,3px)' : i===2 ? 'rotate(-45deg) translate(3px,-3px)' : 'scaleX(0)')
                      : 'none',
                  }}/>
                ))}
              </button>
            )}
            <div style={{ fontWeight:900, fontSize:isDesktop?19:16, color:'var(--text)' }}>
              {TABS[activeTab].icon} {TABS[activeTab].label}
            </div>
          </div>
          <div style={{ display:'flex', gap:10, alignItems:'center' }}>
            <span style={{ fontFamily:'var(--mono)', fontSize:13, color:'var(--text3)' }}>{formatDateKo(today)}</span>
            <span style={{
              padding:'5px 12px', borderRadius:99, fontSize:13, fontWeight:800,
              background: todayHol ? 'rgba(230,81,0,0.09)' : 'rgba(46,125,50,0.09)',
              color: todayHol ? 'var(--amber)' : 'var(--green)',
              border:`1.5px solid ${todayHol ? 'rgba(230,81,0,0.2)' : 'rgba(46,125,50,0.2)'}`,
            }}>{todayHol ? '휴일' : '평일'}</span>
          </div>
        </header>

        {/* Content */}
        <main className="scroll-y" style={{ flex:1, background:'var(--bg)' }}>
          <div style={{
            padding: isDesktop ? '24px 32px' : '14px',
            paddingBottom: 32,
            maxWidth: isDesktop ? 1280 : 'none',
            margin: isDesktop ? '0 auto' : 0,
          }}>
            {activeTab===0 && <JumpMeter {...tabProps}/>}
            {activeTab===1 && <TabInput {...tabProps}/>}
            {activeTab===2 && <TabPrediction {...tabProps}/>}
            {activeTab===3 && <TabMembers {...tabProps}/>}
            {activeTab===4 && <TabAnalysis {...tabProps}/>}
            {activeTab===5 && <TabStats {...tabProps}/>}
            {activeTab===6 && <TabMonthly {...tabProps}/>}
          </div>
        </main>
      </div>
    </div>
  )
}

function Loader() {
  return (
    <div style={{ height:'100dvh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'var(--bg)', gap:16 }}>
      <div style={{ width:44, height:44, border:'3px solid var(--border2)', borderTopColor:'var(--red)', borderRadius:'50%' }} className="spin"/>
      <p style={{ color:'var(--text3)', fontFamily:'var(--mono)', fontSize:12 }}>Loading…</p>
    </div>
  )
}

function Err({ msg }) {
  return (
    <div style={{ height:'100dvh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'var(--bg)', gap:12, padding:24 }}>
      <span style={{ fontSize:40 }}>🍄</span>
      <p style={{ fontWeight:900, fontSize:16, color:'var(--red)' }}>연결 오류</p>
      <p style={{ color:'var(--text2)', fontSize:13, textAlign:'center', lineHeight:1.6, background:'var(--s1)', padding:'12px 16px', borderRadius:12, boxShadow:'var(--shadow)' }}>{msg}</p>
    </div>
  )
}
