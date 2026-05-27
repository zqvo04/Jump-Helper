import { useMemo } from 'react'
import { INITIAL_WEIGHTS } from '../lib/prediction'
import { signStr } from '../lib/utils'

const FK   = ['elapsed','fairness','recency','rot','dow']
const FL   = { elapsed:'경과비율', fairness:'공정성', recency:'최근역수', rot:'순번패턴', dow:'요일패턴' }
const FC   = { elapsed:'#00c8e8', fairness:'#00c853', recency:'#f0a500', rot:'#b57bee', dow:'#f472b6' }

export default function TabAnalysis({ mlLog, weights, resetWeights }) {
  const accuracy = useMemo(() => {
    function calc(logs) {
      if (!logs.length) return null
      return {
        top1: logs.filter(l=>l.predicted_rank===1).length/logs.length,
        top3: logs.filter(l=>l.predicted_rank<=3).length/logs.length,
        top5: logs.filter(l=>l.predicted_rank<=5).length/logs.length,
        n: logs.length,
      }
    }
    const s = [...mlLog].sort((a,b)=>a.date.localeCompare(b.date))
    return { all:calc(s), d14:calc(s.slice(-14)), d7:calc(s.slice(-7)) }
  }, [mlLog])

  const sparkline = useMemo(() =>
    [...mlLog].sort((a,b)=>a.date.localeCompare(b.date)).slice(-24)
  , [mlLog])

  const wHistory = useMemo(() =>
    [...mlLog].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,10)
  , [mlLog])

  return (
    <div style={{ padding:'12px 14px', display:'flex', flexDirection:'column', gap:14 }}>

      {/* Accuracy grid */}
      <div>
        <p className="sec-label" style={{ marginBottom:10 }}>예측 정확도</p>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
          {[['전체',accuracy?.all],['14일',accuracy?.d14],['7일',accuracy?.d7]].map(([label,acc])=>(
            <div key={label} className="card" style={{ padding:12 }}>
              <div style={{ fontSize:11, color:'var(--text3)', marginBottom:10,
                fontFamily:'var(--mono)', fontWeight:600 }}>{label}</div>
              {acc ? (
                <>
                  <AccRow label="Top1" val={acc.top1} color="var(--green)" />
                  <AccRow label="Top3" val={acc.top3} color="var(--cyan)" />
                  <AccRow label="Top5" val={acc.top5} color="var(--amber)" />
                  <div style={{fontSize:10,color:'var(--text3)',marginTop:8,fontFamily:'var(--mono)'}}>
                    n={acc.n}
                  </div>
                </>
              ) : <div style={{fontSize:12,color:'var(--text3)'}}>없음</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Sparkline */}
      {sparkline.length > 0 && (
        <div>
          <p className="sec-label" style={{ marginBottom:10 }}>최근 예측 이력</p>
          <div className="card" style={{ padding:12 }}>
            <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
              {sparkline.map(log => {
                const r = log.predicted_rank
                const color = r===1?'var(--green)':r<=3?'var(--cyan)':r<=5?'var(--amber)':'var(--red)'
                return (
                  <div key={log.id}
                    title={`${log.date} ${log.actual_person}`}
                    style={{
                      width:28, height:28, borderRadius:5,
                      background:`${color}20`, border:`1px solid ${color}50`,
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontSize:10, fontFamily:'var(--mono)', color, fontWeight:700,
                    }}>
                    {r<=5?r:'✕'}
                  </div>
                )
              })}
            </div>
            <div style={{ display:'flex', gap:12, marginTop:10, fontSize:10, color:'var(--text3)', fontFamily:'var(--mono)' }}>
              <span style={{color:'var(--green)'}}>■ 1위</span>
              <span style={{color:'var(--cyan)'}}>■ 2~3위</span>
              <span style={{color:'var(--amber)'}}>■ 4~5위</span>
              <span style={{color:'var(--red)'}}>■ 6위↑</span>
            </div>
          </div>
        </div>
      )}

      {/* Weights bar */}
      <div>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
          <p className="sec-label">피처 가중치</p>
          <button onClick={resetWeights} className="btn btn-ghost"
            style={{ height:30, padding:'0 12px', fontSize:11, minHeight:30 }}>
            초기화
          </button>
        </div>
        <div className="card" style={{ padding:14, display:'flex', flexDirection:'column', gap:12 }}>
          {FK.map(k => {
            const cur = weights[k], init = INITIAL_WEIGHTS[k], diff = cur - init
            return (
              <div key={k}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
                  <span style={{ fontSize:13, fontWeight:500 }}>{FL[k]}</span>
                  <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                    <span style={{ fontSize:10, color:'var(--text3)', fontFamily:'var(--mono)' }}>
                      {(init*100).toFixed(1)}
                    </span>
                    <span style={{ fontFamily:'var(--mono)', fontWeight:700, fontSize:14, color:FC[k] }}>
                      {(cur*100).toFixed(1)}%
                    </span>
                    <span style={{ fontFamily:'var(--mono)', fontSize:10,
                      color:diff>0?'var(--green)':diff<0?'var(--red)':'var(--text3)' }}>
                      {signStr(diff)}
                    </span>
                  </div>
                </div>
                <div style={{ position:'relative', height:6, background:'var(--s4)', borderRadius:3 }}>
                  <div style={{
                    position:'absolute', top:0, left:0, height:'100%',
                    width:`${Math.min(100,cur/0.65*100)}%`,
                    background:FC[k], borderRadius:3, transition:'width 0.5s ease',
                  }}/>
                  <div style={{
                    position:'absolute', top:-3, bottom:-3,
                    left:`${Math.min(100,init/0.65*100)}%`,
                    width:2, background:'rgba(255,255,255,0.25)', borderRadius:1,
                  }}/>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Weight history */}
      {wHistory.length > 0 && (
        <div>
          <p className="sec-label" style={{ marginBottom:10 }}>가중치 변화 이력</p>
          <div className="card table-wrap">
            <table>
              <thead><tr>
                {['날짜','담당자','순위','경과','공정','최근','순번'].map(h=>(
                  <th key={h}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {wHistory.map(log => (
                  <tr key={log.id}>
                    <td style={{fontFamily:'var(--mono)',fontSize:11,color:'var(--text3)'}}>{log.date}</td>
                    <td style={{fontWeight:500}}>{log.actual_person}</td>
                    <td><RankBadge rank={log.predicted_rank}/></td>
                    {FK.map(k=>(
                      <td key={k}><DCell val={log.delta?.[k]}/></td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function AccRow({ label, val, color }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
      <span style={{ fontSize:11, color:'var(--text3)' }}>{label}</span>
      <span style={{ fontFamily:'var(--mono)', fontSize:13, fontWeight:700, color }}>
        {(val*100).toFixed(0)}%
      </span>
    </div>
  )
}

function RankBadge({ rank }) {
  const color = rank===1?'var(--green)':rank<=3?'var(--cyan)':rank<=5?'var(--amber)':'var(--text3)'
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', justifyContent:'center',
      width:22, height:22, borderRadius:'50%',
      background:`${color}20`, border:`1px solid ${color}50`,
      fontSize:10, fontFamily:'var(--mono)', fontWeight:700, color,
    }}>{rank>99?'?':rank}</span>
  )
}

function DCell({ val }) {
  if (val==null) return <span style={{color:'var(--text3)'}}>—</span>
  const pos=val>0.0001,neg=val<-0.0001
  return (
    <span style={{ fontFamily:'var(--mono)', fontSize:11,
      color:pos?'var(--green)':neg?'var(--red)':'var(--text3)' }}>
      {pos?'+':''}{(val*100).toFixed(2)}
    </span>
  )
}
