import { useMemo } from 'react'
import { INITIAL_WEIGHTS } from '../lib/prediction'
import { signStr } from '../lib/utils'

const FEAT_KEYS   = ['elapsed', 'fairness', 'recency', 'rot']
const FEAT_LABELS = { elapsed:'경과비율', fairness:'공정성', recency:'최근역수', rot:'순번패턴' }
const FEAT_COLORS = { elapsed:'#06b6d4', fairness:'#3fb950', recency:'#f59e0b', rot:'#a78bfa' }

export default function TabAnalysis({ mlLog, weights, resetWeights }) {
  // Accuracy computation
  const accuracy = useMemo(() => {
    function calc(logs) {
      const top1 = logs.filter(l => l.predicted_rank === 1).length
      const top3 = logs.filter(l => l.predicted_rank <= 3).length
      const top5 = logs.filter(l => l.predicted_rank <= 5).length
      const n = logs.length
      return n === 0 ? null : { top1: top1/n, top3: top3/n, top5: top5/n, n }
    }
    const sorted = [...mlLog].sort((a, b) => a.date.localeCompare(b.date))
    return {
      all:  calc(sorted),
      d14:  calc(sorted.slice(-14)),
      d7:   calc(sorted.slice(-7)),
    }
  }, [mlLog])

  // Sparkline: last 20 results
  const sparkline = useMemo(() => {
    return [...mlLog].sort((a, b) => a.date.localeCompare(b.date)).slice(-20)
  }, [mlLog])

  // Weight history: last 10 log entries
  const weightHistory = useMemo(() => {
    return [...mlLog].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10)
  }, [mlLog])

  // Recent prediction log: last 30
  const recentLog = useMemo(() => {
    return [...mlLog].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30)
  }, [mlLog])

  const maxWeight = Math.max(...FEAT_KEYS.map(k => weights[k]))

  return (
    <div style={{ padding:16, display:'flex', flexDirection:'column', gap:16 }}>
      {/* Accuracy */}
      <section>
        <div style={{ fontSize:12, color:'var(--muted)', marginBottom:10, fontWeight:600 }}>예측 정확도</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
          {[['전체', accuracy?.all], ['최근14일', accuracy?.d14], ['최근7일', accuracy?.d7]].map(([label, acc]) => (
            <div key={label} className="card" style={{ padding:12 }}>
              <div style={{ fontSize:11, color:'var(--muted)', marginBottom:8 }}>{label}</div>
              {acc ? (
                <>
                  <AccRow label="Top1" val={acc.top1} color="#3fb950" />
                  <AccRow label="Top3" val={acc.top3} color="#f5a623" />
                  <AccRow label="Top5" val={acc.top5} color="#06b6d4" />
                  <div style={{ fontSize:10, color:'var(--subtle)', marginTop:6 }}>n={acc.n}</div>
                </>
              ) : <div style={{ fontSize:12, color:'var(--subtle)' }}>데이터 없음</div>}
            </div>
          ))}
        </div>
      </section>

      {/* Sparkline */}
      {sparkline.length > 0 && (
        <section>
          <div style={{ fontSize:12, color:'var(--muted)', marginBottom:8, fontWeight:600 }}>
            최근 예측 기록 (최대 20건)
          </div>
          <div className="card" style={{ padding:12 }}>
            <div style={{ display:'flex', gap:3, flexWrap:'wrap' }}>
              {sparkline.map((log, i) => {
                const r = log.predicted_rank
                const color = r === 1 ? '#3fb950' : r <= 3 ? '#f5a623' : r <= 5 ? '#06b6d4' : '#f85149'
                const label = r <= 5 ? `Top${r}` : `${r}위`
                return (
                  <div key={log.id} title={`${log.date} ${log.actual_person} ${label}`} style={{
                    width:24, height:24, borderRadius:4, background:`${color}25`,
                    border:`1px solid ${color}60`,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:9, fontFamily:'IBM Plex Mono', color, fontWeight:700,
                  }}>
                    {r <= 5 ? r : 'X'}
                  </div>
                )
              })}
            </div>
            <div style={{ display:'flex', gap:12, marginTop:10, fontSize:11, color:'var(--subtle)' }}>
              <span>🟢 1위</span><span>🟡 2~3위</span><span>🔵 4~5위</span><span>🔴 6위↑</span>
            </div>
          </div>
        </section>
      )}

      {/* Feature weights bar chart */}
      <section>
        <div style={{ fontSize:12, color:'var(--muted)', marginBottom:10, fontWeight:600, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span>피처 가중치</span>
          <button onClick={resetWeights} style={{
            fontSize:11, padding:'3px 10px', borderRadius:6,
            background:'var(--surface4)', border:'1px solid var(--border)',
            color:'var(--muted)', cursor:'pointer',
          }}>초기화</button>
        </div>
        <div className="card" style={{ padding:14, display:'flex', flexDirection:'column', gap:10 }}>
          {FEAT_KEYS.map(k => {
            const cur = weights[k]
            const init = INITIAL_WEIGHTS[k]
            const diff = cur - init
            return (
              <div key={k}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                  <span style={{ fontSize:13 }}>{FEAT_LABELS[k]}</span>
                  <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                    <span style={{ fontSize:11, color:'var(--subtle)', fontFamily:'IBM Plex Mono' }}>
                      init {(init*100).toFixed(1)}%
                    </span>
                    <span style={{
                      fontFamily:'IBM Plex Mono', fontSize:13, fontWeight:600,
                      color: FEAT_COLORS[k],
                    }}>
                      {(cur*100).toFixed(1)}%
                    </span>
                    <span style={{
                      fontSize:11, fontFamily:'IBM Plex Mono',
                      color: diff > 0 ? '#3fb950' : diff < 0 ? '#f85149' : 'var(--subtle)',
                    }}>
                      {signStr(diff)}
                    </span>
                  </div>
                </div>
                <div style={{ position:'relative', height:8, background:'var(--surface4)', borderRadius:4, overflow:'visible' }}>
                  {/* Current */}
                  <div style={{
                    position:'absolute', top:0, left:0, height:'100%',
                    width:`${cur * 100 / 0.65 * 100}%`,
                    background: FEAT_COLORS[k], borderRadius:4,
                    transition:'width 0.5s ease',
                  }}/>
                  {/* Init marker */}
                  <div style={{
                    position:'absolute', top:-2, bottom:-2,
                    left:`${init * 100 / 0.65 * 100}%`,
                    width:2, background:'rgba(255,255,255,0.3)', borderRadius:1,
                  }}/>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Weight history table */}
      {weightHistory.length > 0 && (
        <section>
          <div style={{ fontSize:12, color:'var(--muted)', marginBottom:8, fontWeight:600 }}>
            가중치 변화 이력 (최근 10건)
          </div>
          <div className="card" style={{ overflow:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
              <thead>
                <tr style={{ borderBottom:'1px solid var(--border)', color:'var(--subtle)' }}>
                  {['날짜','담당자','순위','경과','공정','최근','순번'].map(h => (
                    <th key={h} style={{ padding:'8px 10px', textAlign:'left', fontWeight:500, whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {weightHistory.map(log => {
                  const delta = log.delta
                  return (
                    <tr key={log.id} style={{ borderBottom:'1px solid rgba(48,54,61,0.5)' }}>
                      <td style={{ padding:'7px 10px', fontFamily:'IBM Plex Mono', fontSize:11, color:'var(--muted)' }}>
                        {log.date}
                      </td>
                      <td style={{ padding:'7px 10px', fontWeight:500 }}>{log.actual_person}</td>
                      <td style={{ padding:'7px 10px', fontFamily:'IBM Plex Mono' }}>
                        <RankBadge rank={log.predicted_rank} />
                      </td>
                      {['elapsed','fairness','recency','rot'].map(k => (
                        <td key={k} style={{ padding:'7px 10px', fontFamily:'IBM Plex Mono', fontSize:11 }}>
                          <DeltaCell val={delta?.[k]} />
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Prediction log */}
      {recentLog.length > 0 && (
        <section>
          <div style={{ fontSize:12, color:'var(--muted)', marginBottom:8, fontWeight:600 }}>
            예측 로그 (최근 30건)
          </div>
          <div className="card" style={{ overflow:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
              <thead>
                <tr style={{ borderBottom:'1px solid var(--border)', color:'var(--subtle)' }}>
                  {['날짜','타입','담당자','순위','확률','Top5'].map(h => (
                    <th key={h} style={{ padding:'8px 10px', textAlign:'left', fontWeight:500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentLog.map(log => (
                  <tr key={log.id} style={{ borderBottom:'1px solid rgba(48,54,61,0.5)' }}>
                    <td style={{ padding:'7px 10px', fontFamily:'IBM Plex Mono', fontSize:11, color:'var(--muted)' }}>
                      {log.date}
                    </td>
                    <td style={{ padding:'7px 10px' }}>
                      <span style={{ fontSize:10, padding:'1px 6px', borderRadius:99,
                        background: log.is_holiday ? 'rgba(245,166,35,0.15)' : 'rgba(0,229,255,0.1)',
                        color: log.is_holiday ? '#f5a623' : 'var(--accent)',
                        border: `1px solid ${log.is_holiday ? 'rgba(245,166,35,0.3)' : 'rgba(0,229,255,0.2)'}`,
                      }}>
                        {log.is_holiday ? '휴' : '평'}
                      </span>
                    </td>
                    <td style={{ padding:'7px 10px', fontWeight:500 }}>{log.actual_person}</td>
                    <td style={{ padding:'7px 10px' }}><RankBadge rank={log.predicted_rank} /></td>
                    <td style={{ padding:'7px 10px', fontFamily:'IBM Plex Mono', fontSize:11, color:'var(--accent)' }}>
                      {log.predicted_prob != null ? (log.predicted_prob * 100).toFixed(1) + '%' : '—'}
                    </td>
                    <td style={{ padding:'7px 10px', fontSize:11, color:'var(--subtle)' }}>
                      {Array.isArray(log.top5) ? log.top5.map(t => t.person).join(', ') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}

function AccRow({ label, val, color }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
      <span style={{ fontSize:11, color:'var(--subtle)' }}>{label}</span>
      <span style={{ fontFamily:'IBM Plex Mono', fontSize:13, fontWeight:600, color }}>
        {(val * 100).toFixed(0)}%
      </span>
    </div>
  )
}

function RankBadge({ rank }) {
  const color = rank === 1 ? '#3fb950' : rank <= 3 ? '#f5a623' : rank <= 5 ? '#06b6d4' : 'var(--muted)'
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', justifyContent:'center',
      width:22, height:22, borderRadius:'50%',
      background:`${color}20`, border:`1px solid ${color}50`,
      fontSize:11, fontFamily:'IBM Plex Mono', fontWeight:700, color,
    }}>
      {rank > 99 ? '?' : rank}
    </span>
  )
}

function DeltaCell({ val }) {
  if (val == null) return <span style={{ color:'var(--subtle)' }}>—</span>
  const pos = val > 0.0001; const neg = val < -0.0001
  return (
    <span style={{ color: pos ? '#3fb950' : neg ? '#f85149' : 'var(--subtle)' }}>
      {pos ? '+' : ''}{(val * 100).toFixed(2)}
    </span>
  )
}
