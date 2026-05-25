import { useState, useMemo } from 'react'

export default function TabStats({ history, members }) {
  const [search,     setSearch]     = useState('')
  const [filterType, setFilterType] = useState('all')
  const [page,       setPage]       = useState(1)
  const PAGE = 20

  const active = members.filter(m => !m.is_retired)

  const summary = useMemo(() => ({
    total:   history.length,
    weekday: history.filter(h=>!h.is_holiday).length,
    holiday: history.filter(h=>h.is_holiday).length,
  }), [history])

  const memberStats = useMemo(() => {
    return active.map(m => {
      const recs = history.filter(h=>h.person===m.name)
      const wd   = recs.filter(h=>!h.is_holiday)
      const hol  = recs.filter(h=>h.is_holiday)
      const wdS  = wd.sort((a,b)=>a.date.localeCompare(b.date))
      let avg = null
      if (wdS.length>=2) {
        const diffs = wdS.slice(1).map((r,i)=>{
          return (new Date(r.date)-new Date(wdS[i].date))/86400000
        })
        avg = Math.round(diffs.reduce((a,b)=>a+b,0)/diffs.length)
      }
      return { name:m.name, total:recs.length, weekday:wd.length, holiday:hol.length,
               last:recs.sort((a,b)=>a.date.localeCompare(b.date)).at(-1)?.date, avg }
    }).sort((a,b)=>b.total-a.total)
  }, [history, active])

  const maxTotal = memberStats[0]?.total || 1

  // Heatmap: last 4 months
  const heatmap = useMemo(() => {
    const months = {}
    history.forEach(h => {
      const ym = h.date.slice(0,7)
      if (!months[ym]) months[ym]={}
      months[ym][h.date.slice(8,10)] = true
    })
    return Object.entries(months).sort((a,b)=>a[0].localeCompare(b[0])).slice(-4)
  }, [history])

  const filtered = useMemo(() =>
    history.filter(h => {
      const t = filterType==='all'||( filterType==='weekday'?!h.is_holiday:h.is_holiday)
      const s = !search||h.person.includes(search)||h.date.includes(search)
      return t&&s
    }).sort((a,b)=>b.date.localeCompare(a.date))
  , [history, search, filterType])

  const pages = Math.ceil(filtered.length/PAGE)
  const items = filtered.slice((page-1)*PAGE, page*PAGE)

  return (
    <div style={{ padding:'12px 14px', display:'flex', flexDirection:'column', gap:14 }}>

      {/* Summary */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
        {[['전체',summary.total,'var(--cyan)'],['평일',summary.weekday,'#00c8e8'],['휴일',summary.holiday,'var(--amber)']].map(([l,v,c])=>(
          <div key={l} className="card" style={{ padding:14, textAlign:'center' }}>
            <div style={{ fontFamily:'var(--mono)', fontWeight:700, fontSize:26, color:c, lineHeight:1 }}>{v}</div>
            <div style={{ fontSize:11, color:'var(--text3)', marginTop:4 }}>{l}</div>
          </div>
        ))}
      </div>

      {/* Member bars */}
      <div>
        <p className="sec-label" style={{ marginBottom:10 }}>멤버별 담당 횟수</p>
        <div className="card" style={{ padding:12, display:'flex', flexDirection:'column', gap:8 }}>
          {memberStats.map(m => (
            <div key={m.name}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                <span style={{ fontSize:13, fontWeight:500 }}>{m.name}</span>
                <div style={{ display:'flex', gap:8 }}>
                  <span style={{ fontFamily:'var(--mono)', fontSize:11, color:'#00c8e8' }}>평{m.weekday}</span>
                  <span style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--amber)' }}>휴{m.holiday}</span>
                  <span style={{ fontFamily:'var(--mono)', fontSize:12, fontWeight:700 }}>{m.total}</span>
                </div>
              </div>
              <div style={{ height:5, background:'var(--s4)', borderRadius:3, display:'flex', gap:1, overflow:'hidden' }}>
                <div style={{ height:'100%', background:'#00c8e8', borderRadius:3,
                  width:`${m.weekday/maxTotal*100}%`, flexShrink:0 }}/>
                <div style={{ height:'100%', background:'var(--amber)', borderRadius:3,
                  width:`${m.holiday/maxTotal*100}%`, flexShrink:0 }}/>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Heatmap */}
      <div>
        <p className="sec-label" style={{ marginBottom:10 }}>월별 히트맵</p>
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {heatmap.map(([ym,days])=>{
            const [y,m] = ym.split('-')
            const total = new Date(+y,+m,0).getDate()
            return (
              <div key={ym} className="card" style={{ padding:10 }}>
                <div style={{ fontSize:11, color:'var(--text3)', marginBottom:6, fontFamily:'var(--mono)' }}>
                  {y}.{m} <span style={{ color:'var(--cyan)' }}>{Object.keys(days).length}건</span>
                </div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:2 }}>
                  {Array.from({length:total},(_,i)=>{
                    const dd = String(i+1).padStart(2,'0')
                    const has = !!days[dd]
                    return (
                      <div key={dd} style={{
                        width:14, height:14, borderRadius:2,
                        background: has?'var(--cyan)':'var(--s4)',
                        opacity: has?0.85:0.35,
                      }}/>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* History */}
      <div>
        <p className="sec-label" style={{ marginBottom:10 }}>전체 이력</p>
        <div style={{ display:'flex', gap:7, marginBottom:8 }}>
          <input value={search} onChange={e=>{setSearch(e.target.value);setPage(1)}}
            placeholder="이름·날짜 검색" className="input" style={{ flex:1, height:42 }}/>
        </div>
        <div style={{ display:'flex', gap:6, marginBottom:10 }}>
          {[['all','전체'],['weekday','평일'],['holiday','휴일']].map(([v,l])=>(
            <button key={v} onClick={()=>{setFilterType(v);setPage(1)}} style={{
              height:34, padding:'0 12px', borderRadius:6, fontSize:12, cursor:'pointer',
              border:'1px solid', minHeight:34,
              background:filterType===v?'var(--cyan-mute)':'var(--s3)',
              borderColor:filterType===v?'var(--cyan)':'var(--border)',
              color:filterType===v?'var(--cyan)':'var(--text3)',
            }}>{l}</button>
          ))}
        </div>
        <div className="card table-wrap">
          <table>
            <thead><tr>
              <th>날짜</th><th>타입</th><th>담당자</th>
            </tr></thead>
            <tbody>
              {items.map(h=>(
                <tr key={h.date}>
                  <td style={{fontFamily:'var(--mono)',fontSize:11,color:'var(--text3)'}}>{h.date}</td>
                  <td>
                    <span className={`pill ${h.is_holiday?'pill-amber':'pill-cyan'}`} style={{fontSize:10}}>
                      {h.is_holiday?'휴':'평'}
                    </span>
                  </td>
                  <td style={{fontWeight:500}}>{h.person}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {pages>1&&(
            <div style={{ display:'flex', justifyContent:'center', alignItems:'center', gap:8, padding:12 }}>
              <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1}
                className="btn btn-ghost" style={{ width:36,height:36,padding:0,minHeight:36,fontSize:16 }}>←</button>
              <span style={{ fontFamily:'var(--mono)', fontSize:12, color:'var(--text3)' }}>
                {page}/{pages}
              </span>
              <button onClick={()=>setPage(p=>Math.min(pages,p+1))} disabled={page===pages}
                className="btn btn-ghost" style={{ width:36,height:36,padding:0,minHeight:36,fontSize:16 }}>→</button>
            </div>
          )}
          {items.length===0&&(
            <div style={{ padding:24, textAlign:'center', color:'var(--text3)', fontSize:13 }}>결과 없음</div>
          )}
        </div>
      </div>
    </div>
  )
}
