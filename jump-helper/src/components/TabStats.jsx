import { useState, useMemo } from 'react'
import { getTodayStr, getYearMonth } from '../lib/utils'

export default function TabStats({ history, members }) {
  const [search,    setSearch]    = useState('')
  const [page,      setPage]      = useState(1)
  const [filterType, setFilterType] = useState('all') // all|weekday|holiday
  const PAGE_SIZE = 20

  const activeMembers = members.filter(m => !m.is_retired)

  // ── Summary cards ──────────────────────────────────────────────────
  const summary = useMemo(() => {
    const weekday = history.filter(h => !h.is_holiday).length
    const holiday = history.filter(h => h.is_holiday).length
    return { total: history.length, weekday, holiday }
  }, [history])

  // ── Member assignment counts ─────────────────────────────────────
  const memberStats = useMemo(() => {
    return activeMembers.map(m => {
      const allRecs = history.filter(h => h.person === m.name)
      const weekday = allRecs.filter(h => !h.is_holiday).length
      const holiday = allRecs.filter(h => h.is_holiday).length
      const total   = allRecs.length
      const last    = allRecs.sort((a,b) => a.date.localeCompare(b.date)).at(-1)?.date
      // avg interval (weekday)
      const wdSorted = allRecs.filter(h => !h.is_holiday).sort((a,b)=>a.date.localeCompare(b.date))
      let avgInterval = null
      if (wdSorted.length >= 2) {
        const diffs = []
        for (let i = 1; i < wdSorted.length; i++) {
          const d1 = new Date(wdSorted[i-1].date + 'T00:00:00')
          const d2 = new Date(wdSorted[i].date + 'T00:00:00')
          diffs.push((d2 - d1) / 86400000)
        }
        avgInterval = Math.round(diffs.reduce((a,b) => a+b,0) / diffs.length)
      }
      return { name: m.name, total, weekday, holiday, last, avgInterval }
    }).sort((a,b) => b.total - a.total)
  }, [history, activeMembers])

  const maxTotal = memberStats[0]?.total || 1

  // ── Monthly heatmap data ─────────────────────────────────────────
  const heatmapMonths = useMemo(() => {
    const months = {}
    for (const h of history) {
      const ym = h.date.slice(0, 7)
      if (!months[ym]) months[ym] = {}
      months[ym][h.date.slice(8, 10)] = h.person
    }
    return Object.entries(months).sort((a,b) => a[0].localeCompare(b[0])).slice(-6)
  }, [history])

  // ── Filtered history (search) ────────────────────────────────────
  const filtered = useMemo(() => {
    return history.filter(h => {
      const typeOk = filterType === 'all' || (filterType === 'weekday' ? !h.is_holiday : h.is_holiday)
      const searchOk = !search || h.person.includes(search) || h.date.includes(search)
      return typeOk && searchOk
    }).sort((a,b) => b.date.localeCompare(a.date))
  }, [history, search, filterType])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const pageItems  = filtered.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE)

  function onSearch(val) { setSearch(val); setPage(1) }

  return (
    <div style={{ padding:16, display:'flex', flexDirection:'column', gap:16 }}>
      {/* Summary cards */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
        {[
          { label:'전체',  val:summary.total,   color:'var(--accent)' },
          { label:'평일',  val:summary.weekday, color:'#06b6d4' },
          { label:'휴일',  val:summary.holiday, color:'#f5a623' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding:12, textAlign:'center' }}>
            <div style={{ fontFamily:'IBM Plex Mono', fontSize:26, fontWeight:700, color:s.color }}>
              {s.val}
            </div>
            <div style={{ fontSize:11, color:'var(--muted)', marginTop:2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Member bar chart */}
      <section>
        <div style={{ fontSize:12, color:'var(--muted)', marginBottom:10, fontWeight:600 }}>
          멤버별 담당 횟수
        </div>
        <div className="card" style={{ padding:12, display:'flex', flexDirection:'column', gap:6 }}>
          {memberStats.map(m => (
            <div key={m.name}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                <span style={{ fontSize:12, fontWeight:500 }}>{m.name}</span>
                <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                  <span style={{ fontSize:10, color:'#06b6d4', fontFamily:'IBM Plex Mono' }}>
                    평{m.weekday}
                  </span>
                  <span style={{ fontSize:10, color:'#f5a623', fontFamily:'IBM Plex Mono' }}>
                    휴{m.holiday}
                  </span>
                  <span style={{ fontFamily:'IBM Plex Mono', fontSize:12, fontWeight:700, color:'var(--text)' }}>
                    {m.total}
                  </span>
                </div>
              </div>
              <div style={{ height:6, background:'var(--surface4)', borderRadius:3, overflow:'hidden', display:'flex', gap:1 }}>
                <div style={{
                  height:'100%', background:'#06b6d4', borderRadius:3,
                  width:`${m.weekday / maxTotal * 100}%`, transition:'width 0.4s',
                  flexShrink:0,
                }}/>
                <div style={{
                  height:'100%', background:'#f5a623', borderRadius:3,
                  width:`${m.holiday / maxTotal * 100}%`, transition:'width 0.4s',
                  flexShrink:0,
                }}/>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Monthly heatmap */}
      <section>
        <div style={{ fontSize:12, color:'var(--muted)', marginBottom:10, fontWeight:600 }}>
          월별 현황 (최근 6개월)
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {heatmapMonths.map(([ym, days]) => {
            const [y, m] = ym.split('-')
            const daysInMonth = new Date(+y, +m, 0).getDate()
            return (
              <div key={ym} className="card" style={{ padding:10 }}>
                <div style={{ fontSize:11, color:'var(--muted)', marginBottom:6 }}>
                  {y}년 {parseInt(m)}월
                  <span style={{ marginLeft:8, color:'var(--subtle)', fontFamily:'IBM Plex Mono' }}>
                    {Object.keys(days).length}건
                  </span>
                </div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:2 }}>
                  {Array.from({ length: daysInMonth }, (_, i) => {
                    const dd = String(i + 1).padStart(2, '0')
                    const person = days[dd]
                    return (
                      <div key={dd} title={person ? `${ym}-${dd}: ${person}` : `${ym}-${dd}`} style={{
                        width:16, height:16, borderRadius:2,
                        background: person ? 'var(--accent)' : 'var(--surface4)',
                        opacity: person ? 1 : 0.4,
                        border: `1px solid ${person ? 'rgba(0,229,255,0.4)' : 'var(--border)'}`,
                      }}/>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Member detail stats */}
      <section>
        <div style={{ fontSize:12, color:'var(--muted)', marginBottom:8, fontWeight:600 }}>멤버별 상세</div>
        <div className="card" style={{ overflow:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
            <thead>
              <tr style={{ borderBottom:'1px solid var(--border)', color:'var(--subtle)' }}>
                {['이름','전체','평일','휴일','평균간격(평일)','최근날짜'].map(h => (
                  <th key={h} style={{ padding:'8px 10px', textAlign:'left', fontWeight:500, whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {memberStats.map(m => (
                <tr key={m.name} style={{ borderBottom:'1px solid rgba(48,54,61,0.4)' }}>
                  <td style={{ padding:'7px 10px', fontWeight:500 }}>{m.name}</td>
                  <td style={{ padding:'7px 10px', fontFamily:'IBM Plex Mono', color:'var(--text)' }}>{m.total}</td>
                  <td style={{ padding:'7px 10px', fontFamily:'IBM Plex Mono', color:'#06b6d4' }}>{m.weekday}</td>
                  <td style={{ padding:'7px 10px', fontFamily:'IBM Plex Mono', color:'#f5a623' }}>{m.holiday}</td>
                  <td style={{ padding:'7px 10px', fontFamily:'IBM Plex Mono', color:'var(--muted)' }}>
                    {m.avgInterval != null ? m.avgInterval + '일' : '—'}
                  </td>
                  <td style={{ padding:'7px 10px', fontFamily:'IBM Plex Mono', fontSize:11, color:'var(--subtle)' }}>
                    {m.last ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* History search */}
      <section>
        <div style={{ fontSize:12, color:'var(--muted)', marginBottom:8, fontWeight:600 }}>전체 이력</div>
        <div style={{ display:'flex', gap:8, marginBottom:10 }}>
          <input
            value={search}
            onChange={e => onSearch(e.target.value)}
            placeholder="이름 또는 날짜 검색"
            style={{
              flex:1, background:'var(--surface4)', border:'1px solid var(--border)',
              borderRadius:6, padding:'7px 12px', color:'var(--text)', fontSize:13,
            }}
          />
          <div style={{ display:'flex', gap:6 }}>
            {[['all','전체'],['weekday','평일'],['holiday','휴일']].map(([v,l]) => (
              <button key={v} onClick={() => { setFilterType(v); setPage(1) }} style={{
                padding:'6px 10px', borderRadius:6, fontSize:12,
                border:'1px solid', cursor:'pointer',
                background: filterType===v ? 'rgba(0,229,255,0.1)' : 'var(--surface4)',
                borderColor: filterType===v ? 'var(--accent)' : 'var(--border)',
                color: filterType===v ? 'var(--accent)' : 'var(--muted)',
              }}>{l}</button>
            ))}
          </div>
        </div>

        <div className="card" style={{ overflow:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
            <thead>
              <tr style={{ borderBottom:'1px solid var(--border)', color:'var(--subtle)' }}>
                <th style={{ padding:'8px 10px', textAlign:'left', fontWeight:500 }}>날짜</th>
                <th style={{ padding:'8px 10px', textAlign:'left', fontWeight:500 }}>타입</th>
                <th style={{ padding:'8px 10px', textAlign:'left', fontWeight:500 }}>담당자</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map(h => (
                <tr key={h.date} style={{ borderBottom:'1px solid rgba(48,54,61,0.4)' }}>
                  <td style={{ padding:'7px 10px', fontFamily:'IBM Plex Mono', fontSize:11, color:'var(--muted)' }}>
                    {h.date}
                  </td>
                  <td style={{ padding:'7px 10px' }}>
                    <span style={{ fontSize:10, padding:'1px 6px', borderRadius:99,
                      background: h.is_holiday ? 'rgba(245,166,35,0.15)' : 'rgba(0,229,255,0.1)',
                      color: h.is_holiday ? '#f5a623' : 'var(--accent)',
                    }}>
                      {h.is_holiday ? '휴일' : '평일'}
                    </span>
                  </td>
                  <td style={{ padding:'7px 10px', fontWeight:500 }}>{h.person}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display:'flex', justifyContent:'center', gap:6, padding:12 }}>
              <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1}
                style={{ padding:'4px 12px', borderRadius:6, background:'var(--surface4)', border:'1px solid var(--border)', color:'var(--muted)', cursor:'pointer', fontSize:12 }}>
                ←
              </button>
              <span style={{ padding:'4px 12px', fontSize:12, color:'var(--muted)', fontFamily:'IBM Plex Mono' }}>
                {page} / {totalPages}
              </span>
              <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page===totalPages}
                style={{ padding:'4px 12px', borderRadius:6, background:'var(--surface4)', border:'1px solid var(--border)', color:'var(--muted)', cursor:'pointer', fontSize:12 }}>
                →
              </button>
            </div>
          )}
          {filtered.length === 0 && (
            <div style={{ padding:20, textAlign:'center', color:'var(--subtle)', fontSize:13 }}>
              검색 결과 없음
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
