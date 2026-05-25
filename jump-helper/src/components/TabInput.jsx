import { useState, useEffect } from 'react'
import { computePredictions } from '../lib/prediction'
import { isHolidayDate, getTodayStr, offsetDateStr, formatDateFull, pct, signStr } from '../lib/utils'

const FEATURE_LABELS = { elapsed:'경과비율', fairness:'공정성', recency:'최근역수', rot:'순번' }
const FEATURE_COLORS = { elapsed:'#06b6d4', fairness:'#3fb950', recency:'#f59e0b', rot:'#a78bfa' }

export default function TabInput({ history, weights, members, saveEntry }) {
  const today = getTodayStr()
  const [date,      setDate]      = useState(today)
  const [isHoliday, setIsHoliday] = useState(isHolidayDate(today))
  const [autoHol,   setAutoHol]   = useState(isHolidayDate(today))
  const [selected,  setSelected]  = useState(null)
  const [saving,    setSaving]    = useState(false)
  const [result,    setResult]    = useState(null)
  const [predictions, setPredictions] = useState([])

  // Recompute predictions when date/type/history changes
  useEffect(() => {
    const activeMems = members.filter(m => m.is_active && !m.is_retired)
    const preds = computePredictions(date, isHoliday, history, activeMems, weights)
    setPredictions(preds)
    setSelected(null)
    setResult(null)
  }, [date, isHoliday, history, members, weights])

  function handleDateChange(val) {
    setDate(val)
    const auto = isHolidayDate(val)
    setAutoHol(auto)
    setIsHoliday(auto)
  }

  function handleHolidayToggle(val) {
    setIsHoliday(val)
  }

  async function handleSave() {
    if (!selected) return
    setSaving(true)
    try {
      const res = await saveEntry(date, selected, isHoliday)
      setResult(res)
    } finally {
      setSaving(false)
    }
  }

  const alreadyEntered = history.some(h => h.date === date)

  // Sort members: active non-retired, ordered by prediction rank
  const activeMems = members.filter(m => m.is_active && !m.is_retired)
  const predMap = Object.fromEntries(predictions.map(p => [p.person, p]))

  return (
    <div style={{ padding:16, display:'flex', flexDirection:'column', gap:16 }}>
      {/* Date + type selector */}
      <section className="card" style={{ padding:14 }}>
        <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
          <div style={{ flex:1, minWidth:160 }}>
            <label style={{ display:'block', fontSize:11, color:'var(--muted)', marginBottom:4 }}>날짜</label>
            <input
              type="date" value={date}
              onChange={e => handleDateChange(e.target.value)}
              style={{
                width:'100%', background:'var(--surface4)', border:'1px solid var(--border)',
                borderRadius:6, padding:'7px 10px', color:'var(--text)', fontSize:14,
                fontFamily:'IBM Plex Mono',
              }}
            />
          </div>
          <div>
            <label style={{ display:'block', fontSize:11, color:'var(--muted)', marginBottom:4 }}>타입</label>
            <div style={{ display:'flex', gap:6 }}>
              {[false, true].map(v => (
                <button key={String(v)}
                  onClick={() => handleHolidayToggle(v)}
                  style={{
                    padding:'7px 14px', borderRadius:6, fontSize:13, fontWeight:600,
                    cursor:'pointer', border:'1px solid',
                    background: isHoliday === v
                      ? (v ? 'rgba(245,166,35,0.2)' : 'rgba(0,229,255,0.15)')
                      : 'var(--surface4)',
                    borderColor: isHoliday === v
                      ? (v ? '#f5a623' : 'var(--accent)')
                      : 'var(--border)',
                    color: isHoliday === v
                      ? (v ? '#f5a623' : 'var(--accent)')
                      : 'var(--muted)',
                  }}>
                  {v ? '휴일' : '평일'}
                </button>
              ))}
            </div>
          </div>
        </div>
        {alreadyEntered && !result && (
          <div style={{ marginTop:10, padding:'6px 10px', background:'rgba(245,166,35,0.1)',
            border:'1px solid rgba(245,166,35,0.3)', borderRadius:6, fontSize:12, color:'#f5a623' }}>
            ⚠️ 이미 입력된 날짜입니다. 덮어쓸 수 있습니다.
          </div>
        )}
      </section>

      {/* Person grid */}
      <section>
        <div style={{ fontSize:12, color:'var(--muted)', marginBottom:10, display:'flex', justifyContent:'space-between' }}>
          <span>담당자 선택 ({activeMems.length}명)</span>
          <span style={{ fontFamily:'IBM Plex Mono', fontSize:11 }}>
            {formatDateFull(date)} · {isHoliday ? '휴일' : '평일'}
          </span>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:8 }}>
          {activeMems.map(m => {
            const pred = predMap[m.name]
            const prob = pred?.prob ?? 0
            const isTop1 = predictions[0]?.person === m.name
            const isSel = selected === m.name
            return (
              <button key={m.name}
                onClick={() => setSelected(m.name)}
                style={{
                  display:'flex', flexDirection:'column', alignItems:'center',
                  padding:'10px 6px', borderRadius:8, cursor:'pointer',
                  border: '2px solid',
                  borderColor: isSel ? 'var(--accent)' : isTop1 ? 'rgba(0,229,255,0.35)' : 'var(--border)',
                  background: isSel ? 'var(--accent-muted)' : isTop1 ? 'rgba(0,229,255,0.05)' : 'var(--surface2)',
                  transition: 'all 0.15s',
                  boxShadow: isSel ? '0 0 10px rgba(0,229,255,0.25)' : 'none',
                }}>
                <span style={{ fontSize:13, fontWeight:600, color: isSel ? 'var(--accent)' : 'var(--text)' }}>
                  {m.name}
                </span>
                <span style={{
                  fontFamily:'IBM Plex Mono', fontSize:11, marginTop:4,
                  color: prob >= 0.15 ? 'var(--accent)' : prob >= 0.08 ? '#f5a623' : 'var(--muted)',
                }}>
                  {pct(prob)}
                </span>
                {/* mini prob bar */}
                <div style={{ width:'100%', height:2, background:'var(--border)', borderRadius:1, marginTop:4 }}>
                  <div style={{
                    width: `${Math.min(100, prob * 600)}%`, height:'100%',
                    background: prob >= 0.15 ? 'var(--accent)' : '#f5a623',
                    borderRadius:1,
                  }}/>
                </div>
              </button>
            )
          })}
        </div>
      </section>

      {/* Save button */}
      {!result && (
        <button
          onClick={handleSave}
          disabled={!selected || saving}
          style={{
            width:'100%', padding:'13px', borderRadius:8, border:'none',
            background: selected ? 'var(--accent)' : 'var(--surface4)',
            color: selected ? '#000' : 'var(--subtle)',
            fontSize:15, fontWeight:700, fontFamily:'Syne',
            cursor: selected ? 'pointer' : 'not-allowed',
            transition: 'background 0.2s',
            letterSpacing:0.5,
          }}>
          {saving ? '저장 중…' : selected ? `${selected} 저장 + 학습` : '담당자를 선택하세요'}
        </button>
      )}

      {/* Result card */}
      {result && <ResultCard result={result} onReset={() => { setResult(null); setSelected(null) }} />}
    </div>
  )
}

function ResultCard({ result, onReset }) {
  const { rank, predictions, oldWeights, newWeights, delta } = result
  const actual = predictions.find(p => p.person === result.predictions[0]?.person)

  const rankLabel = rank === 1 ? '🥇 1위' : rank === 2 ? '🥈 2위' : rank === 3 ? '🥉 3위' : `${rank}위`
  const rankColor = rank <= 3 ? '#3fb950' : rank <= 5 ? '#f5a623' : 'var(--muted)'

  const top5 = predictions.slice(0, 5)
  const actualPred = predictions[rank - 1]

  return (
    <div className="fade-in" style={{ display:'flex', flexDirection:'column', gap:12 }}>
      {/* Rank result */}
      <div className="card" style={{ padding:16, textAlign:'center' }}>
        <div style={{ fontFamily:'IBM Plex Mono', fontSize:36, fontWeight:700, color:rankColor }}>
          {rankLabel}
        </div>
        <div style={{ color:'var(--muted)', fontSize:13, marginTop:4 }}>
          예측 확률 {actualPred ? pct(actualPred.prob) : '—'}
        </div>
        <div style={{ marginTop:12, display:'flex', gap:8, justifyContent:'center' }}>
          {top5.map((p, i) => (
            <div key={p.person} style={{
              padding:'4px 10px', borderRadius:6, fontSize:12,
              background: i === rank - 1 ? 'rgba(63,185,80,0.15)' : 'var(--surface4)',
              border: `1px solid ${i === rank - 1 ? '#3fb950' : 'var(--border)'}`,
              color: i === rank - 1 ? '#3fb950' : 'var(--muted)',
              fontFamily: 'IBM Plex Mono',
            }}>
              {i + 1}. {p.person} {pct(p.prob)}
            </div>
          ))}
        </div>
      </div>

      {/* Weight changes */}
      <div className="card" style={{ padding:14 }}>
        <div style={{ fontSize:12, color:'var(--muted)', marginBottom:10, fontWeight:600 }}>가중치 변화</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:8 }}>
          {Object.keys(oldWeights).map(k => {
            const d = delta[k]
            const pos = d > 0.0001
            const neg = d < -0.0001
            return (
              <div key={k} style={{
                background:'var(--surface4)', borderRadius:6, padding:'8px',
                border:`1px solid ${pos?'rgba(63,185,80,0.3)':neg?'rgba(248,81,73,0.3)':'var(--border)'}`,
              }}>
                <div style={{ fontSize:10, color:'var(--subtle)' }}>
                  {k === 'elapsed' ? '경과' : k === 'fairness' ? '공정' : k === 'recency' ? '최근' : '순번'}
                </div>
                <div style={{ fontFamily:'IBM Plex Mono', fontSize:13, fontWeight:600, color:'var(--text)', marginTop:2 }}>
                  {(newWeights[k] * 100).toFixed(1)}%
                </div>
                <div style={{
                  fontSize:10, fontFamily:'IBM Plex Mono',
                  color: pos ? '#3fb950' : neg ? '#f85149' : 'var(--subtle)'
                }}>
                  {signStr(d)}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <button onClick={onReset} style={{
        padding:'10px', borderRadius:8, background:'var(--surface4)',
        border:'1px solid var(--border)', color:'var(--muted)', cursor:'pointer', fontSize:13,
      }}>
        다음 입력
      </button>
    </div>
  )
}
