import { useState, useMemo } from 'react'
import { dateDiffDays, getTodayStr } from '../lib/utils'

function eColor(d) {
  if (d==null) return 'var(--text3)'
  if (d<=7)  return 'var(--red)'
  if (d<=14) return 'var(--amber)'
  if (d<=21) return '#e3c000'
  return 'var(--green)'
}

function addDays(s, n) {
  const d=new Date(s+'T00:00:00'); d.setDate(d.getDate()+n); return d.toISOString().split('T')[0]
}

export default function TabElapsed({ history, members }) {
  const [showRetired, setShowRetired] = useState(false)
  const today = getTodayStr()

  const rows = useMemo(() => {
    const list = showRetired ? members : members.filter(m=>!m.is_retired)
    return list.sort((a,b)=>(a.display_order||99)-(b.display_order||99)).map(m => {
      const all  = history.filter(h=>h.person===m.name).sort((a,b)=>a.date.localeCompare(b.date))
      const wd   = all.filter(h=>!h.is_holiday)
      const hol  = all.filter(h=>h.is_holiday)
      const cut30 = addDays(today,-30)
      return {
        name: m.name,
        is_retired: m.is_retired,
        is_active:  m.is_active,
        total: all.length,
        wd30:  wd.filter(h=>h.date>=cut30).length,
        hol30: hol.filter(h=>h.date>=cut30).length,
        wdE:   wd.at(-1)  ? dateDiffDays(wd.at(-1).date,  today) : null,
        holE:  hol.at(-1) ? dateDiffDays(hol.at(-1).date, today) : null,
        anyE:  all.at(-1) ? dateDiffDays(all.at(-1).date, today) : null,
      }
    }).sort((a,b)=>(b.anyE??-1)-(a.anyE??-1))
  }, [history, members, showRetired, today])

  return (
    <div style={{ padding:'12px 14px', display:'flex', flexDirection:'column', gap:12 }}>

      {/* Header row */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <p className="sec-label">경과일 현황</p>
          <span style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--text3)' }}>기준 {today}</span>
        </div>
        <button onClick={()=>setShowRetired(v=>!v)}
          className={`btn ${showRetired?'':'btn-ghost'}`}
          style={{ height:36, padding:'0 14px', fontSize:12, minHeight:36 }}>
          {showRetired ? '현직만' : '퇴직 포함'}
        </button>
      </div>

      {/* Legend */}
      <div style={{ display:'flex', gap:12, fontSize:11, fontFamily:'var(--mono)', flexWrap:'wrap' }}>
        {[['var(--red)','≤7d'],['var(--amber)','8~14d'],['#e3c000','15~21d'],['var(--green)','22d+']].map(([c,l])=>(
          <span key={l} style={{ color:c }}>● {l}</span>
        ))}
      </div>

      {/* Cards */}
      <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
        {rows.map(row => (
          <div key={row.name} className="card" style={{
            padding:'12px 14px', opacity: row.is_retired?0.5:row.is_active?1:0.65,
          }}>
            {/* Name row */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div style={{
                  width:7, height:7, borderRadius:'50%', flexShrink:0,
                  background: row.is_retired?'var(--text3)':row.is_active?'var(--green)':'var(--text3)',
                  boxShadow: (!row.is_retired&&row.is_active)?'0 0 5px var(--green)':'none',
                }}/>
                <span style={{ fontWeight:600, fontSize:15 }}>{row.name}</span>
                {row.is_retired && <span style={{ fontSize:10, color:'var(--text3)' }}>퇴직</span>}
              </div>
              {/* Elapsed big number */}
              {row.anyE != null && (
                <span style={{
                  fontFamily:'var(--mono)', fontWeight:700, fontSize:20,
                  color: eColor(row.anyE),
                }}>
                  {row.anyE}d
                </span>
              )}
            </div>
            {/* Stats row */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:6 }}>
              {[
                ['총',row.total,'var(--text2)'],
                ['평30',row.wd30,'#00c8e8'],
                ['휴30',row.hol30,'var(--amber)'],
                ['평일',row.wdE,eColor(row.wdE)],
                ['휴일',row.holE,eColor(row.holE)],
              ].map(([label,val,color])=>(
                <div key={label} style={{
                  background:'var(--s3)', borderRadius:6, padding:'6px 4px', textAlign:'center',
                }}>
                  <div style={{ fontSize:9, color:'var(--text3)', marginBottom:3, fontFamily:'var(--mono)' }}>
                    {label}
                  </div>
                  <div style={{ fontFamily:'var(--mono)', fontWeight:600, fontSize:12, color }}>
                    {val!=null ? (typeof val==='number'&&label.includes('일')||label==='평'||label==='휴' ? val+'d' : val) : '—'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
