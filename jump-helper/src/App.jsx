import { useState, useEffect, useCallback } from 'react'
import { supabase } from './lib/supabase'
import { SEED_DATA, DEFAULT_MEMBERS_INIT } from './lib/seedData'
import { computePredictions, applyMLUpdate, INITIAL_WEIGHTS, WEIGHTS_VERSION, getEffectiveROT } from './lib/prediction'
import { isHolidayDate, getTodayStr, formatDateKo } from './lib/utils'
import TabInput from './components/TabInput'
import TabPrediction from './components/TabPrediction'
import TabMembers from './components/TabMembers'
import TabAnalysis from './components/TabAnalysis'
import TabStats from './components/TabStats'
import TabElapsed from './components/TabElapsed'
import JumpMeter from './components/JumpMeter'
import TabMonthly from './components/TabMonthly'

const TABS = [
  { label:'JUMP',  icon:'⚡' },
  { label:'입력',  icon:'✏️' },
  { label:'예측',  icon:'🎯' },
  { label:'멤버',  icon:'👥' },
  { label:'분석',  icon:'📊' },
  { label:'통계',  icon:'📈' },
  { label:'월별',  icon:'🗓️' },
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

  useEffect(() => { initApp() }, [])

  async function initApp() {
    try {
      await supabase.from('duty_history').upsert(SEED_DATA, { onConflict:'date', ignoreDuplicates:true })
      const { data:em } = await supabase.from('duty_members').select('id').limit(1)
      if (!em || em.length===0) await supabase.from('duty_members').insert(DEFAULT_MEMBERS_INIT)
      const { data:wRows } = await supabase.from('duty_weights').select('*').order('updated_at',{ascending:false}).limit(1)
      if (!wRows || wRows.length===0) {
        const { data:wNew } = await supabase.from('duty_weights').insert({ version:WEIGHTS_VERSION, ...INITIAL_WEIGHTS }).select()
        if (wNew?.[0]) { setWeightsId(wNew[0].id); setWeights(INITIAL_WEIGHTS) }
      } else {
        const row=wRows[0]; setWeightsId(row.id)
        if (row.version!==WEIGHTS_VERSION) {
          await supabase.from('duty_weights').update({ version:WEIGHTS_VERSION, ...INITIAL_WEIGHTS, updated_at:new Date().toISOString() }).eq('id',row.id)
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
    if (w.data?.[0]) {
      const r=w.data[0]; setWeightsId(r.id)
      setWeights({elapsed:+r.elapsed,fairness:+r.fairness,recency:+r.recency,rot:+r.rot,dow:+(r.dow??0.14)})
    }
  }, [])

  const saveEntry = useCallback(async (date, person, isHoliday) => {
    const activeMems = members.filter(m=>m.is_active&&!m.is_retired)
    const predictions = computePredictions(date, isHoliday, history, activeMems, weights, getEffectiveROT(members))
    const rank = predictions.findIndex(p=>p.person===person)+1
    const actualPred = predictions.find(p=>p.person===person)
    const newWeights = applyMLUpdate(weights, person, predictions)
    const top5 = predictions.slice(0,5).map(p=>({person:p.person,prob:p.prob}))
    const delta = {
      elapsed:+(newWeights.elapsed-weights.elapsed).toFixed(6),
      fairness:+(newWeights.fairness-weights.fairness).toFixed(6),
      recency:+(newWeights.recency-weights.recency).toFixed(6),
      rot:+(newWeights.rot-weights.rot).toFixed(6),
      dow:+(newWeights.dow-weights.dow).toFixed(6),
    }
    await Promise.all([
      supabase.from('duty_history').upsert({date,person,is_holiday:isHoliday},{onConflict:'date'}),
      supabase.from('duty_ml_log').insert({date,actual_person:person,is_holiday:isHoliday,predicted_rank:rank||99,predicted_prob:actualPred?.prob??0,top5,weights_before:{...weights},weights_after:newWeights,delta}),
    ])
    if (weightsId) {
      await supabase.from('duty_weights').update({...newWeights,updated_at:new Date().toISOString()}).eq('id',weightsId)
    } else {
      const { data:wNew } = await supabase.from('duty_weights').insert({version:WEIGHTS_VERSION,...newWeights}).select()
      if (wNew?.[0]) setWeightsId(wNew[0].id)
    }
    setWeights(newWeights)
    setHistory(prev=>[...prev.filter(h=>h.date!==date),{date,person,is_holiday:isHoliday}].sort((a,b)=>a.date.localeCompare(b.date)))
    const { data:newLog } = await supabase.from('duty_ml_log').select('*').order('created_at',{ascending:false}).limit(200)
    if (newLog) setMlLog(newLog)
    return { rank:rank||99, predictions, oldWeights:{...weights}, newWeights, delta }
  }, [history, members, weights, weightsId])

  const addMember = useCallback(async (name) => {
    const maxOrder = members.reduce((m,r)=>Math.max(m,r.display_order||0),0)
    const { data } = await supabase.from('duty_members').insert({name,is_active:true,is_retired:false,is_new:true,display_order:maxOrder+1}).select()
    if (data?.[0]) setMembers(prev=>[...prev,data[0]])
  }, [members])

  const toggleMemberActive = useCallback(async (id, isActive) => {
    await supabase.from('duty_members').update({is_active:isActive}).eq('id',id)
    setMembers(prev=>prev.map(m=>m.id===id?{...m,is_active:isActive}:m))
  }, [])

  const retireMember = useCallback(async (id) => {
    await supabase.from('duty_members').update({is_retired:true,is_active:false}).eq('id',id)
    setMembers(prev=>prev.map(m=>m.id===id?{...m,is_retired:true,is_active:false}:m))
  }, [])

  const setMemberType = useCallback(async (id, type) => {
    await supabase.from('duty_members').update({member_type:type}).eq('id',id)
    setMembers(prev=>prev.map(m=>m.id===id?{...m,member_type:type}:m))
  }, [])

  const setMemberOrder = useCallback(async (id, order) => {
    await supabase.from('duty_members').update({display_order:order}).eq('id',id)
    setMembers(prev=>prev.map(m=>m.id===id?{...m,display_order:order}:m))
  }, [])

  const swapROTOrder = useCallback(async (id1, id2) => {
    const m1=members.find(m=>m.id===id1), m2=members.find(m=>m.id===id2)
    if(!m1||!m2) return
    await Promise.all([
      supabase.from('duty_members').update({display_order:m2.display_order}).eq('id',id1),
      supabase.from('duty_members').update({display_order:m1.display_order}).eq('id',id2),
    ])
    setMembers(prev=>prev.map(m=>m.id===id1?{...m,display_order:m2.display_order}:m.id===id2?{...m,display_order:m1.display_order}:m))
  }, [members])

  const resetWeights = useCallback(async () => {
    if (!weightsId) return
    await supabase.from('duty_weights').update({...INITIAL_WEIGHTS,version:WEIGHTS_VERSION,updated_at:new Date().toISOString()}).eq('id',weightsId)
    setWeights(INITIAL_WEIGHTS)
  }, [weightsId])

  if (loading) return <Loader />
  if (error)   return <Err msg={error} />

  const dynamicROT = getEffectiveROT(members)
  const tabProps = { history, weights, members, mlLog, saveEntry, addMember, toggleMemberActive, retireMember, resetWeights, setMemberType, setMemberOrder, swapROTOrder, dynamicROT }
  const today = getTodayStr()
  const todayHol = isHolidayDate(today)
  const goodCount = members.filter(m=>m.is_active&&!m.is_retired&&m.member_type==='good').length
  const recentLog = mlLog.slice(0,7)
  const top1Rate  = recentLog.length ? Math.round(recentLog.filter(l=>l.predicted_rank===1).length/recentLog.length*100) : 0

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100dvh'}}>

      {/* ── Mario HUD Header ── */}
      <header style={{
        background:'linear-gradient(180deg,#8B3407 0%,#C84B0C 100%)',
        borderBottom:'3px solid #6B2500',
        padding:'0 14px',
        height:56, flexShrink:0,
        display:'flex', alignItems:'center', justifyContent:'space-between',
        boxShadow:'0 4px 8px rgba(0,0,0,0.2)',
      }}>
        {/* Logo */}
        <div style={{display:'flex',alignItems:'center',gap:6}}>
          <div style={{
            width:32,height:32,borderRadius:8,
            background:'linear-gradient(135deg,#FFD700,#F0A500)',
            border:'2px solid #C07800',
            display:'flex',alignItems:'center',justifyContent:'center',
            fontSize:16,fontWeight:900,color:'#3D2000',
            boxShadow:'0 3px 0 #8B5500',
            fontFamily:"'Press Start 2P', monospace",
          }}>?</div>
          <span style={{
            fontFamily:"'Press Start 2P', monospace",
            fontSize:11, color:'#FFE000',
            textShadow:'2px 2px 0 #8B3407, -1px -1px 0 #8B3407',
            letterSpacing:-0.5,
          }}>JUMP</span>
        </div>

        {/* HUD Counters */}
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          {/* 날짜 */}
          <div className="coin-counter">
            <span>📅</span>
            <span>{formatDateKo(today)}</span>
          </div>
          {/* 평일/휴일 */}
          <div className="coin-counter" style={{color:todayHol?'#FFB74D':'#80FF80'}}>
            <span>{todayHol?'🌙':'☀️'}</span>
            <span>{todayHol?'휴일':'평일'}</span>
          </div>
          {/* 좋은사람 카운트 */}
          {goodCount>0&&(
            <div className="coin-counter" style={{color:'#FFE000'}}>
              <span>⭐</span>
              <span>{goodCount}</span>
            </div>
          )}
        </div>
      </header>

      {/* ── Ground strip ── */}
      <div className="ground-strip" style={{flexShrink:0}}/>

      {/* ── Content ── */}
      <main className="scroll-y" style={{flex:1}}>
        <div style={{paddingBottom:12}}>
          {activeTab===0 && <JumpMeter {...tabProps} />}
          {activeTab===1 && <TabInput {...tabProps} />}
          {activeTab===2 && <TabPrediction {...tabProps} />}
          {activeTab===3 && <TabMembers {...tabProps} />}
          {activeTab===4 && <TabAnalysis {...tabProps} />}
          {activeTab===5 && <TabStats {...tabProps} />}
          {activeTab===6 && <TabMonthly {...tabProps} />}
        </div>
      </main>

      {/* ── Mario Tab Bar ── */}
      <nav className="tab-nav">
        {TABS.map((t,i)=>(
          <button key={i} className={`tab-item ${activeTab===i?'active':''}`} onClick={()=>setActiveTab(i)}>
            <span className="ti">{t.icon}</span>
            <span className="tl">{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}

function Loader() {
  return (
    <div style={{height:'100dvh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:20}}>
      <div style={{
        width:56,height:56,
        background:'linear-gradient(135deg,#FFD700,#F0A500)',
        border:'3px solid #C07800',borderRadius:12,
        display:'flex',alignItems:'center',justifyContent:'center',
        fontSize:28,boxShadow:'0 4px 0 #8B5500',
        animation:'bounce 0.6s ease-in-out infinite',
      }}>?</div>
      <div style={{fontFamily:"'Press Start 2P',monospace",fontSize:10,color:'#FFF',textShadow:'1px 1px 0 rgba(0,0,0,0.4)',letterSpacing:1}}>
        LOADING...
      </div>
    </div>
  )
}

function Err({msg}) {
  return (
    <div style={{height:'100dvh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:14,padding:24}}>
      <span style={{fontSize:48}}>🍄</span>
      <p style={{fontFamily:"'Press Start 2P',monospace",fontSize:11,color:'#E52222',textAlign:'center'}}>CONNECTION ERROR</p>
      <p style={{color:'var(--text2)',fontSize:13,textAlign:'center',lineHeight:1.6,background:'rgba(255,255,255,0.9)',padding:'12px 16px',borderRadius:10}}>{msg}</p>
    </div>
  )
}
