import { useState, useMemo } from 'react'
import { computePredictions, ROT_ORDER } from '../lib/prediction'
import { isHolidayDate, getTodayStr, offsetDateStr, formatDateFull, pct } from '../lib/utils'

const F_LABELS = ['경과','공정','최근','순번','요일']
const F_KEYS   = ['f1','f2','f3','f4','f5']
const F_COLORS = ['#00c8e8','#00c853','#f0a500','#b57bee','#f472b6']

export default function TabPrediction({ history, weights, members }) {
  const today    = getTodayStr()
  const tomorrow = offsetDateStr(today, 1)
  const dayAfter = offsetDateStr(today, 2)
  const [target, setTarget] = useState(tomorrow)

  const isHoliday  = isHolidayDate(target)
  const activeMems = members.filter(m => m.is_active && !m.is_retired)

  const predictions = useMemo(() =>
    computePredictions(target, isHoliday, history, activeMems, weights),
    [target, isHoliday, history, activeMems, weights]
  )

  const p1 = predictions[0]?.prob ?? 0
  const gap = p1 - (predictions[1]?.prob ?? 0)

  const [confClass, confText, confBg, confColor] =
    p1 >= 0.28 && gap >= 0.12 ? ['green',  '🟢 신뢰도 높음', 'var(--green-mute)', 'var(--green)'] :
    p1 >= 0.18 && gap >= 0.06 ? ['amber',  '🟡 신뢰도 보통', 'var(--amber-mute)', 'var(--amber)'] :
                                 ['red',    '🔴 신뢰도 낮음', 'var(--red-mute)',   'var(--red)']

  const sameTypeSorted = [...history]
    .filter(h => h.is_holiday === isHoliday && h.date < target)
    .sort((a,b) => a.date.localeCompare(b.date))
  const lastST = sameTypeSorted.at(-1)
  const prevIdx = lastST ? ROT_ORDER.indexOf(lastST.person) : -1
  const rotNext5 = prevIdx !== -1
    ? Array.from({length:5},(_,i) => ROT_ORDER[(prevIdx+1+i) % ROT_ORDER.length])
    : ROT_ORDER.slice(0,5)

  return (
    <div style={{ padding:'12px 14px', display:'flex', flexDirection:'column', gap:12 }}>

      {/* Date selector */}
      <div style={{ display:'flex', gap:7 }}>
        {[tomorrow, dayAfter].map(d => {
          const hol = isHolidayDate(d)
          const active = target === d
          return (
            <button key={d} onClick={() => setTarget(d)} style={{
              flex:1, height:46, borderRadius:9, cursor:'pointer',
              border:`1.5px solid ${active?'var(--cyan)':'var(--border)'}`,
              background: active ? 'var(--cyan-mute)' : 'var(--s1)',
              color: active ? 'var(--cyan)' : 'var(--text2)',
              fontWeight:600, fontSize:13, transition:'all 0.15s',
              display:'flex', alignItems:'center', justifyContent:'center', gap:6,
            }}>
              <span>{d===tomorrow?'내일':'모레'}</span>
              <span style={{ fontFamily:'var(--mono)', fontSize:11, opacity:0.75 }}>
                {d.slice(5).replace('-','/')}
              </span>
              {hol && <span style={{ fontSize:10, color:'var(--amber)' }}>휴</span>}
            </button>
          )
        })}
      </div>

      {/* Confidence + type */}
      <div style={{ display:'flex', gap:8, alignItems:'center' }}>
        <div style={{
          flex:1, padding:'9px 13px', borderRadius:8,
          background: confBg, border:`1px solid ${confColor}40`,
          fontSize:13, fontWeight:600, color:confColor,
        }}>
          {confText}
        </div>
        <span className={`pill ${isHoliday?'pill-amber':'pill-cyan'}`} style={{ fontSize:12 }}>
          {isHoliday ? '🏖️ 휴일' : '💼 평일'}
        </span>
      </div>

      {/* Top 3 */}
      {predictions.slice(0,3).map((pred, i) => (
        <PredCard key={pred.person} pred={pred} rank={i+1} />
      ))}

      {/* 4–5위 */}
      {predictions.length > 3 && (
        <div className="card" style={{ padding:'4px 0' }}>
          {predictions.slice(3,5).map((pred, i) => (
            <div key={pred.person} style={{
              display:'flex', alignItems:'center', justifyContent:'space-between',
              padding:'12px 14px',
              borderBottom: i===0 ? '1px solid var(--border)' : 'none',
            }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <span style={{
                  width:26, height:26, borderRadius:'50%',
                  background:'var(--s3)', border:'1px solid var(--border2)',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:11, fontFamily:'var(--mono)', fontWeight:700, color:'var(--text3)',
                  flexShrink:0,
                }}>{i+4}</span>
                <span style={{ fontWeight:500, fontSize:15 }}>{pred.person}</span>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <span style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--text3)' }}>
                  {pred.elapsedDays != null ? pred.elapsedDays+'d' : '—'}
                </span>
                <span style={{ fontFamily:'var(--mono)', fontWeight:700, fontSize:15, color:'var(--cyan)' }}>
                  {pct(pred.prob)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ROT reference */}
      <div className="card" style={{ padding:12 }}>
        <p className="sec-label" style={{ marginBottom:8 }}>
          기본 순번 참고 · 직전 {lastST ? `${lastST.person} (${lastST.date.slice(5)})` : '—'}
        </p>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          {rotNext5.map((name, i) => (
            <span key={name} style={{
              padding:'5px 11px', borderRadius:6, fontSize:12, fontWeight: i===0?700:400,
              background: i===0 ? 'var(--cyan-mute)' : 'var(--s3)',
              border:`1px solid ${i===0?'rgba(0,212,232,0.3)':'var(--border)'}`,
              color: i===0 ? 'var(--cyan)' : 'var(--text3)',
            }}>
              {i+1}. {name}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

function PredCard({ pred, rank }) {
  const medals = ['🥇','🥈','🥉']
  const { f1,f2,f3,f4 } = pred.features
  const fVals = [f1,f2,f3,f4]

  return (
    <div className={`pred-card ${rank===1?'rank1':''} fade-up`} style={{ padding:14 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:26 }}>{medals[rank-1]}</span>
          <div>
            <div style={{ fontFamily:'var(--display)', fontWeight:700, fontSize:18 }}>{pred.person}</div>
            <div style={{ fontSize:11, color:'var(--text3)', fontFamily:'var(--mono)', marginTop:1 }}>
              경과 {pred.elapsedDays != null ? pred.elapsedDays+'일' : '기록없음'}
            </div>
          </div>
        </div>
        <div style={{ fontFamily:'var(--mono)', fontWeight:700, fontSize:26, color:'var(--cyan)' }}>
          {pct(pred.prob)}
        </div>
      </div>
      {/* Feature bars */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:8 }}>
        {F_LABELS.map((label, i) => (
          <div key={label}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
              <span style={{ fontSize:10, color:'var(--text3)' }}>{label}</span>
              <span style={{ fontFamily:'var(--mono)', fontSize:10, color:F_COLORS[i], fontWeight:600 }}>
                {fVals[i].toFixed(2)}
              </span>
            </div>
            <div className="fbar">
              <div className="fbar-fill" style={{ width:`${fVals[i]*100}%`, background:F_COLORS[i] }}/>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
