import { useState, useMemo } from 'react'
import { computePredictions, ROT_ORDER } from '../lib/prediction'
import { isHolidayDate, getTodayStr, offsetDateStr, formatDateFull, pct } from '../lib/utils'

const FEAT_LABELS = ['경과비율', '공정성', '최근역수', '순번']
const FEAT_KEYS   = ['f1', 'f2', 'f3', 'f4']
const FEAT_COLORS = ['#06b6d4', '#3fb950', '#f59e0b', '#a78bfa']

export default function TabPrediction({ history, weights, members }) {
  const today    = getTodayStr()
  const tomorrow = offsetDateStr(today, 1)
  const dayAfter = offsetDateStr(today, 2)

  const [targetDate, setTargetDate] = useState(tomorrow)

  const isHoliday = isHolidayDate(targetDate)
  const activeMems = members.filter(m => m.is_active && !m.is_retired)

  const predictions = useMemo(() =>
    computePredictions(targetDate, isHoliday, history, activeMems, weights),
    [targetDate, isHoliday, history, activeMems, weights]
  )

  const top3 = predictions.slice(0, 3)
  const rest = predictions.slice(3, 5)

  // Confidence
  const p1 = predictions[0]?.prob ?? 0
  const p2 = predictions[1]?.prob ?? 0
  const gap = p1 - p2

  let conf, confLabel, confColor
  if (p1 >= 0.28 && gap >= 0.12) {
    conf = 'high'; confLabel = '🟢 신뢰도 높음'; confColor = '#3fb950'
  } else if (p1 >= 0.18 && gap >= 0.06) {
    conf = 'mid'; confLabel = '🟡 신뢰도 보통'; confColor = '#f5a623'
  } else {
    conf = 'low'; confLabel = '🔴 신뢰도 낮음'; confColor = '#f85149'
  }

  // ROT reference: find last same-type person → next 5 in ROT
  const sameTypeSorted = [...history]
    .filter(h => h.is_holiday === isHoliday && h.date < targetDate)
    .sort((a, b) => a.date.localeCompare(b.date))
  const lastST = sameTypeSorted[sameTypeSorted.length - 1]
  const prevIdx = lastST ? ROT_ORDER.indexOf(lastST.person) : -1
  const rotNext5 = prevIdx !== -1
    ? Array.from({ length: 5 }, (_, i) => ROT_ORDER[(prevIdx + 1 + i) % ROT_ORDER.length])
    : ROT_ORDER.slice(0, 5)

  const MEDALS = ['🥇', '🥈', '🥉']

  return (
    <div style={{ padding:16, display:'flex', flexDirection:'column', gap:14 }}>
      {/* Date selector */}
      <section className="card" style={{ padding:12 }}>
        <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
          {[tomorrow, dayAfter].map(d => (
            <button key={d} onClick={() => setTargetDate(d)} style={{
              padding:'7px 14px', borderRadius:6, fontSize:13, fontWeight:600,
              cursor:'pointer', border:'1px solid',
              background: targetDate === d ? 'rgba(0,229,255,0.12)' : 'var(--surface4)',
              borderColor: targetDate === d ? 'var(--accent)' : 'var(--border)',
              color: targetDate === d ? 'var(--accent)' : 'var(--muted)',
            }}>
              {d === tomorrow ? '내일' : '모레'} {formatDateFull(d)}
              {isHolidayDate(d) && <span style={{ marginLeft:6, fontSize:11, color:'#f5a623' }}>휴일</span>}
            </button>
          ))}
          <div style={{
            marginLeft:'auto', padding:'5px 12px', borderRadius:99,
            background: `${confColor}20`, border:`1px solid ${confColor}50`,
            fontSize:12, fontWeight:600, color:confColor,
          }}>
            {confLabel}
          </div>
        </div>
      </section>

      {/* Top 3 cards */}
      <section style={{ display:'flex', flexDirection:'column', gap:10 }}>
        <div style={{ fontSize:12, color:'var(--muted)' }}>
          {isHoliday ? '🏖️ 휴일' : '💼 평일'} 예측 Top 5
        </div>

        {top3.map((pred, i) => (
          <TopCard key={pred.person} pred={pred} rank={i + 1} medal={MEDALS[i]} />
        ))}

        {/* 4-5위 list */}
        {rest.length > 0 && (
          <div className="card" style={{ padding:10 }}>
            {rest.map((pred, i) => (
              <div key={pred.person} style={{
                display:'flex', alignItems:'center', justifyContent:'space-between',
                padding:'7px 4px',
                borderBottom: i < rest.length - 1 ? '1px solid var(--border)' : 'none',
              }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{
                    width:22, height:22, borderRadius:'50%',
                    background:'var(--surface4)', border:'1px solid var(--border)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:11, fontFamily:'IBM Plex Mono', fontWeight:700, color:'var(--muted)',
                  }}>
                    {i + 4}
                  </span>
                  <span style={{ fontWeight:500 }}>{pred.person}</span>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <span style={{ fontFamily:'IBM Plex Mono', fontSize:12, color:'var(--muted)' }}>
                    경과 {pred.elapsedDays != null ? pred.elapsedDays + 'd' : '—'}
                  </span>
                  <span style={{ fontFamily:'IBM Plex Mono', fontSize:13, fontWeight:600, color:'var(--accent)' }}>
                    {pct(pred.prob)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ROT reference */}
      <section className="card" style={{ padding:12 }}>
        <div style={{ fontSize:11, color:'var(--subtle)', marginBottom:8 }}>
          기본 순번 참고 | 직전 {lastST ? `${lastST.person} (${lastST.date})` : '—'} 이후
        </div>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          {rotNext5.map((name, i) => (
            <span key={name} style={{
              padding:'4px 10px', borderRadius:6, fontSize:12,
              background: i === 0 ? 'rgba(0,229,255,0.1)' : 'var(--surface4)',
              border: `1px solid ${i === 0 ? 'rgba(0,229,255,0.3)' : 'var(--border)'}`,
              color: i === 0 ? 'var(--accent)' : 'var(--muted)',
              fontWeight: i === 0 ? 600 : 400,
            }}>
              {i + 1}. {name}
            </span>
          ))}
        </div>
      </section>
    </div>
  )
}

function TopCard({ pred, rank, medal }) {
  const { f1, f2, f3, f4 } = pred.features
  const featureVals = [f1, f2, f3, f4]

  return (
    <div className="card fade-in" style={{
      padding:14, position:'relative', overflow:'hidden',
      borderColor: rank === 1 ? 'rgba(0,229,255,0.35)' : 'var(--border)',
    }}>
      {rank === 1 && (
        <div style={{
          position:'absolute', top:0, left:0, right:0, height:2,
          background:'linear-gradient(90deg,var(--accent),transparent)',
        }}/>
      )}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:22 }}>{medal}</span>
          <div>
            <div style={{ fontFamily:'Syne', fontWeight:700, fontSize:17 }}>{pred.person}</div>
            <div style={{ fontSize:11, color:'var(--muted)', marginTop:1 }}>
              경과 {pred.elapsedDays != null ? pred.elapsedDays + '일' : '기록없음'}
            </div>
          </div>
        </div>
        <div style={{ fontFamily:'IBM Plex Mono', fontWeight:700, fontSize:24, color:'var(--accent)' }}>
          {pct(pred.prob)}
        </div>
      </div>

      {/* Feature mini bars */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:6 }}>
        {FEAT_LABELS.map((label, i) => (
          <div key={label}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
              <span style={{ fontSize:10, color:'var(--subtle)' }}>{label}</span>
              <span style={{ fontFamily:'IBM Plex Mono', fontSize:10, color:FEAT_COLORS[i] }}>
                {featureVals[i].toFixed(2)}
              </span>
            </div>
            <div className="feat-bar">
              <div className="feat-bar-fill" style={{
                width:`${featureVals[i] * 100}%`,
                background:FEAT_COLORS[i],
              }}/>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
