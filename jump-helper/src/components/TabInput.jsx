import { useState, useEffect } from 'react'
import { computePredictions } from '../lib/prediction'
import { isHolidayDate, getTodayStr, formatDateFull, pct, signStr } from '../lib/utils'

export default function TabInput({ history, weights, members, saveEntry }) {
  const today = getTodayStr()
  const [date,        setDate]        = useState(today)
  const [isHoliday,   setIsHoliday]   = useState(isHolidayDate(today))
  const [selected,    setSelected]    = useState(null)
  const [saving,      setSaving]      = useState(false)
  const [result,      setResult]      = useState(null)
  const [predictions, setPredictions] = useState([])

  useEffect(() => {
    const activeMems = members.filter(m => m.is_active && !m.is_retired)
    setPredictions(computePredictions(date, isHoliday, history, activeMems, weights))
    setSelected(null)
    setResult(null)
  }, [date, isHoliday, history, members, weights])

  function handleDateChange(v) {
    setDate(v)
    setIsHoliday(isHolidayDate(v))
  }

  async function handleSave() {
    if (!selected || saving) return
    setSaving(true)
    try { setResult(await saveEntry(date, selected, isHoliday)) }
    finally { setSaving(false) }
  }

  const activeMems = members.filter(m => m.is_active && !m.is_retired)
  const predMap = Object.fromEntries(predictions.map(p => [p.person, p]))
  const alreadyEntered = history.some(h => h.date === date)
  const maxProb = predictions[0]?.prob ?? 0

  if (result) return <ResultView result={result} onReset={() => { setResult(null); setSelected(null) }} />

  return (
    <div style={{ padding:'12px 14px', display:'flex', flexDirection:'column', gap:12 }}>

      {/* Date + type row */}
      <div className="card" style={{ padding:12, display:'flex', gap:10, alignItems:'center' }}>
        <input
          type="date" value={date}
          onChange={e => handleDateChange(e.target.value)}
          className="input"
          style={{ flex:1, maxWidth:160 }}
        />
        <div style={{ display:'flex', gap:6 }}>
          {[false, true].map(v => (
            <button key={String(v)}
              onClick={() => setIsHoliday(v)}
              style={{
                height:48, padding:'0 14px', borderRadius:8, fontSize:13, fontWeight:600,
                cursor:'pointer', border:'1.5px solid',
                borderColor: isHoliday===v ? (v?'var(--amber)':'var(--cyan)') : 'var(--border)',
                background:  isHoliday===v ? (v?'var(--amber-mute)':'var(--cyan-mute)') : 'var(--s3)',
                color:       isHoliday===v ? (v?'var(--amber)':'var(--cyan)') : 'var(--text3)',
                transition:'all 0.15s',
              }}>
              {v ? '휴일' : '평일'}
            </button>
          ))}
        </div>
      </div>

      {alreadyEntered && (
        <div style={{ padding:'9px 13px', borderRadius:8, background:'var(--amber-mute)',
          border:'1px solid rgba(240,165,0,0.25)', fontSize:12, color:'var(--amber)' }}>
          ⚠️ 이미 입력된 날짜 — 덮어쓰기 가능
        </div>
      )}

      {/* Person grid */}
      <div>
        <p className="sec-label" style={{ marginBottom:10 }}>
          담당자 선택 — {formatDateFull(date)} · {isHoliday ? '휴일' : '평일'}
        </p>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:7 }}>
          {activeMems.map(m => {
            const pred = predMap[m.name]
            const prob = pred?.prob ?? 0
            const isTop = predictions[0]?.person === m.name
            const isSel = selected === m.name
            const barW = maxProb > 0 ? (prob / maxProb) * 100 : 0
            const probColor = prob >= 0.15 ? 'var(--cyan)' : prob >= 0.08 ? 'var(--amber)' : 'var(--text3)'

            return (
              <button key={m.name}
                className={`person-btn ${isSel?'selected':''} ${isTop&&!isSel?'top1':''}`}
                onClick={() => setSelected(m.name)}>
                <span style={{
                  fontSize:13, fontWeight:600, lineHeight:1.2, textAlign:'center',
                  color: isSel ? 'var(--cyan)' : 'var(--text)',
                }}>
                  {m.name}
                </span>
                <span style={{ fontFamily:'var(--mono)', fontSize:11, fontWeight:600, color:probColor }}>
                  {pct(prob)}
                </span>
                <div style={{ width:'80%', height:2, background:'var(--s4)', borderRadius:1 }}>
                  <div style={{ width:`${barW}%`, height:'100%',
                    background: isSel ? 'var(--cyan)' : probColor, borderRadius:1,
                    transition:'width 0.3s ease' }}/>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={!selected || saving}
        style={{
          width:'100%', height:52, borderRadius:10, border:'none',
          background: selected ? 'var(--cyan)' : 'var(--s3)',
          color: selected ? '#000' : 'var(--text3)',
          fontSize:16, fontWeight:700, fontFamily:'var(--display)',
          cursor: selected ? 'pointer' : 'not-allowed',
          transition:'all 0.15s', letterSpacing:0.3,
        }}>
        {saving ? '저장 중…' : selected ? `${selected} 저장 + 학습 ▶` : '담당자를 선택하세요'}
      </button>
    </div>
  )
}

function ResultView({ result, onReset }) {
  const { rank, predictions, newWeights, delta } = result
  const top5 = predictions.slice(0, 5)
  const actualPred = predictions[rank - 1]
  const rankColor = rank === 1 ? 'var(--green)' : rank <= 3 ? 'var(--cyan)' : rank <= 5 ? 'var(--amber)' : 'var(--red)'
  const medal = ['🥇','🥈','🥉'][rank-1] ?? `${rank}위`

  return (
    <div className="fade-up" style={{ padding:'12px 14px', display:'flex', flexDirection:'column', gap:12 }}>

      {/* Rank result */}
      <div className="card" style={{ padding:20, textAlign:'center' }}>
        <div style={{ fontSize:52, lineHeight:1, marginBottom:8 }}>{typeof medal === 'string' && medal.includes('위') ? '📍' : medal}</div>
        <div style={{ fontFamily:'var(--mono)', fontSize:32, fontWeight:700, color:rankColor }}>
          {rank}위 예측
        </div>
        <div style={{ color:'var(--text3)', fontSize:13, marginTop:4, fontFamily:'var(--mono)' }}>
          예측 확률 {actualPred ? pct(actualPred.prob) : '—'}
        </div>

        {/* Top5 row */}
        <div style={{ display:'flex', gap:5, justifyContent:'center', marginTop:14, flexWrap:'wrap' }}>
          {top5.map((p, i) => (
            <span key={p.person} style={{
              padding:'4px 9px', borderRadius:6, fontSize:11, fontFamily:'var(--mono)',
              background: i === rank-1 ? 'var(--green-mute)' : 'var(--s3)',
              border:`1px solid ${i===rank-1?'rgba(0,200,83,0.35)':'var(--border)'}`,
              color: i === rank-1 ? 'var(--green)' : 'var(--text3)',
              fontWeight: i === rank-1 ? 700 : 400,
            }}>
              {i+1}.{p.person} {pct(p.prob)}
            </span>
          ))}
        </div>
      </div>

      {/* Weight delta */}
      <div className="card" style={{ padding:12 }}>
        <p className="sec-label" style={{ marginBottom:10 }}>가중치 변화</p>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:7 }}>
          {Object.entries(newWeights).map(([k, v]) => {
            const d = delta[k]
            const pos = d > 0.0001; const neg = d < -0.0001
            const labels = { elapsed:'경과', fairness:'공정', recency:'최근', rot:'순번' }
            return (
              <div key={k} style={{
                padding:'10px 8px', borderRadius:8, textAlign:'center',
                background: pos ? 'var(--green-mute)' : neg ? 'var(--red-mute)' : 'var(--s3)',
                border:`1px solid ${pos?'rgba(0,200,83,0.2)':neg?'rgba(255,68,68,0.2)':'var(--border)'}`,
              }}>
                <div style={{ fontSize:10, color:'var(--text3)', marginBottom:4 }}>{labels[k]}</div>
                <div style={{ fontFamily:'var(--mono)', fontWeight:700, fontSize:14, color:'var(--text)' }}>
                  {(v*100).toFixed(1)}%
                </div>
                <div style={{ fontFamily:'var(--mono)', fontSize:10, marginTop:2,
                  color: pos?'var(--green)':neg?'var(--red)':'var(--text3)' }}>
                  {signStr(d)}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <button onClick={onReset} className="btn" style={{ width:'100%', height:48 }}>
        ← 다음 입력
      </button>
    </div>
  )
}
