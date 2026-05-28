import { useState, useMemo } from 'react'

const today = () => new Date().toISOString().split('T')[0]

function elapsedDays(fromDate) {
  if (!fromDate) return null
  const d1 = new Date(fromDate + 'T00:00:00')
  const d2 = new Date(today() + 'T00:00:00')
  return Math.round((d2 - d1) / 86400000)
}

function elapsedColor(days) {
  if (days === null) return 'var(--text3)'
  if (days <= 7)  return 'var(--red)'
  if (days <= 14) return 'var(--amber)'
  if (days <= 21) return '#d4a000'
  return 'var(--green)'
}

export default function TabStats({ history, members }) {
  const [search,     setSearch]     = useState('')
  const [filterType, setFilterType] = useState('all')
  const [page,       setPage]       = useState(1)
  const PAGE = 20

  const todayStr = today()
  const active = members.filter(m => !m.is_retired)

  const summary = useMemo(() => ({
    total:   history.length,
    weekday: history.filter(h => !h.is_holiday).length,
    holiday: history.filter(h =>  h.is_holiday).length,
  }), [history])

  // 경과일 기준 멤버 카드 데이터
  const memberCards = useMemo(() => {
    return active
      .filter(m => m.is_active)
      .map(m => {
        const recs    = history.filter(h => h.person === m.name).sort((a,b) => a.date.localeCompare(b.date))
        const wdRecs  = recs.filter(h => !h.is_holiday)
        const holRecs = recs.filter(h =>  h.is_holiday)

        const lastAny = recs.at(-1)?.date ?? null
        const lastWd  = wdRecs.at(-1)?.date ?? null
        const lastHol = holRecs.at(-1)?.date ?? null

        const anyElapsed = elapsedDays(lastAny)
        const wdElapsed  = elapsedDays(lastWd)
        const holElapsed = elapsedDays(lastHol)

        return {
          name: m.name,
          total:    recs.length,
          weekday:  wdRecs.length,
          holiday:  holRecs.length,
          lastAny,  lastWd,  lastHol,
          anyElapsed, wdElapsed, holElapsed,
        }
      })
      // 경과일 많은 순 (기록 없으면 맨 위)
      .sort((a, b) => {
        if (a.anyElapsed === null && b.anyElapsed === null) return 0
        if (a.anyElapsed === null) return -1
        if (b.anyElapsed === null) return 1
        return b.anyElapsed - a.anyElapsed
      })
  }, [history, active])

  // 이력 검색 필터
  const filtered = useMemo(() =>
    history.filter(h => {
      const typeOk = filterType === 'all' || (filterType === 'weekday' ? !h.is_holiday : h.is_holiday)
      const searchOk = !search || h.person.includes(search) || h.date.includes(search)
      return typeOk && searchOk
    }).sort((a,b) => b.date.localeCompare(a.date))
  , [history, search, filterType])

  const totalPages = Math.ceil(filtered.length / PAGE)
  const pageItems  = filtered.slice((page-1)*PAGE, page*PAGE)

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

      {/* ── 요약 카드 ── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
        {[
          ['전체',  summary.total,   'var(--cyan-dim)'],
          ['평일',  summary.weekday, '#1565C0'],
          ['휴일',  summary.holiday, 'var(--amber)'],
        ].map(([label, val, color]) => (
          <div key={label} className="card" style={{ padding:'14px 12px', textAlign:'center' }}>
            <div style={{ fontFamily:'var(--mono)', fontWeight:900, fontSize:26, color, lineHeight:1 }}>{val}</div>
            <div style={{ fontSize:11, color:'var(--text3)', marginTop:4, fontWeight:700 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* ── 경과일 순 멤버 카드 ── */}
      <div>
        <p className="sec-label" style={{ marginBottom:10 }}>
          담당자별 경과일 <span style={{ fontFamily:'var(--mono)', fontSize:10, color:'var(--text3)', fontWeight:400, marginLeft:6 }}>기준일: {todayStr}</span>
        </p>
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {memberCards.map((m, idx) => {
            const color = elapsedColor(m.anyElapsed)
            return (
              <div key={m.name} className="card" style={{
                padding:'12px 16px',
                borderLeft:`4px solid ${color}`,
              }}>
                {/* 메인 행 */}
                <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                  {/* 순위 */}
                  <div style={{
                    width:28, height:28, borderRadius:'50%', flexShrink:0,
                    background:'var(--s3)', border:'1.5px solid var(--border2)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontFamily:'var(--mono)', fontSize:11, fontWeight:700, color:'var(--text3)',
                  }}>{idx + 1}</div>

                  {/* 이름 */}
                  <span style={{ fontWeight:800, fontSize:15, flex:1 }}>{m.name}</span>

                  {/* 전체 경과일 (크게) */}
                  <div style={{ textAlign:'right' }}>
                    {m.anyElapsed !== null ? (
                      <>
                        <span style={{
                          fontFamily:'var(--mono)', fontWeight:900,
                          fontSize:22, color, lineHeight:1,
                        }}>{m.anyElapsed}</span>
                        <span style={{ fontSize:12, color, marginLeft:3, fontWeight:700 }}>일</span>
                      </>
                    ) : (
                      <span style={{ fontFamily:'var(--mono)', fontSize:14, color:'var(--text3)' }}>기록없음</span>
                    )}
                    {m.lastAny && (
                      <div style={{ fontSize:10, color:'var(--text3)', marginTop:2, fontFamily:'var(--mono)' }}>
                        {m.lastAny}
                      </div>
                    )}
                  </div>
                </div>

                {/* 디테일: 평일/휴일 경과일 + 횟수 */}
                <div style={{
                  marginTop:8, paddingTop:8,
                  borderTop:'1px solid var(--border)',
                  display:'flex', gap:16, alignItems:'center',
                }}>
                  {/* 평일 경과 */}
                  <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                    <span style={{ fontSize:10, color:'#1565C0', fontWeight:800 }}>평일</span>
                    <span style={{ fontFamily:'var(--mono)', fontSize:12, fontWeight:700, color: elapsedColor(m.wdElapsed) }}>
                      {m.wdElapsed !== null ? m.wdElapsed+'일' : '—'}
                    </span>
                    <span style={{ fontSize:10, color:'var(--text3)' }}>({m.weekday}회)</span>
                  </div>

                  <span style={{ color:'var(--border2)', fontSize:12 }}>|</span>

                  {/* 휴일 경과 */}
                  <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                    <span style={{ fontSize:10, color:'var(--amber)', fontWeight:800 }}>휴일</span>
                    <span style={{ fontFamily:'var(--mono)', fontSize:12, fontWeight:700, color: elapsedColor(m.holElapsed) }}>
                      {m.holElapsed !== null ? m.holElapsed+'일' : '—'}
                    </span>
                    <span style={{ fontSize:10, color:'var(--text3)' }}>({m.holiday}회)</span>
                  </div>

                  <span style={{ color:'var(--border2)', fontSize:12 }}>|</span>

                  {/* 전체 횟수 */}
                  <div style={{ marginLeft:'auto', fontSize:11, color:'var(--text3)' }}>
                    총 <span style={{ fontFamily:'var(--mono)', fontWeight:700, color:'var(--text2)' }}>{m.total}</span>회
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* 색상 범례 */}
        <div style={{ display:'flex', gap:12, marginTop:10, fontSize:11, flexWrap:'wrap' }}>
          {[['var(--red)','7일 이하'],['var(--amber)','8~14일'],['#d4a000','15~21일'],['var(--green)','22일+']].map(([c,l]) => (
            <span key={l} style={{ display:'flex', alignItems:'center', gap:4, color:c, fontWeight:700 }}>
              <span style={{ width:10, height:10, borderRadius:2, background:c, display:'inline-block' }}/>
              {l}
            </span>
          ))}
        </div>
      </div>

      {/* ── 이력 검색 ── */}
      <div>
        <p className="sec-label" style={{ marginBottom:10 }}>전체 이력</p>
        <div style={{ display:'flex', gap:8, marginBottom:8 }}>
          <input
            value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="이름·날짜 검색" className="input"
            style={{ flex:1, height:42 }}
          />
        </div>
        <div style={{ display:'flex', gap:6, marginBottom:10 }}>
          {[['all','전체'],['weekday','평일'],['holiday','휴일']].map(([v,l]) => (
            <button key={v} onClick={() => { setFilterType(v); setPage(1) }} style={{
              height:34, padding:'0 14px', borderRadius:8, fontSize:12, fontWeight:700,
              cursor:'pointer', border:'1.5px solid', minHeight:34,
              background: filterType===v ? 'var(--red)'          : 'var(--s1)',
              borderColor:filterType===v ? 'var(--side-dk)'      : 'var(--border)',
              color:      filterType===v ? '#FFF'                : 'var(--text2)',
            }}>{l}</button>
          ))}
        </div>

        <div className="card table-wrap">
          <table>
            <thead><tr>
              <th>날짜</th><th>타입</th><th>담당자</th>
            </tr></thead>
            <tbody>
              {pageItems.map(h => (
                <tr key={h.date}>
                  <td style={{ fontFamily:'var(--mono)', fontSize:12, color:'var(--text3)' }}>{h.date}</td>
                  <td>
                    <span style={{
                      padding:'2px 8px', borderRadius:99, fontSize:11, fontWeight:700,
                      background: h.is_holiday ? 'rgba(230,81,0,0.09)' : 'rgba(21,101,192,0.08)',
                      color: h.is_holiday ? 'var(--amber)' : '#1565C0',
                    }}>{h.is_holiday ? '휴일' : '평일'}</span>
                  </td>
                  <td style={{ fontWeight:700 }}>{h.person}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div style={{ display:'flex', justifyContent:'center', alignItems:'center', gap:10, padding:12 }}>
              <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1}
                className="btn btn-ghost" style={{ width:36, height:36, padding:0, minHeight:36, fontSize:16 }}>←</button>
              <span style={{ fontFamily:'var(--mono)', fontSize:12, color:'var(--text3)' }}>
                {page} / {totalPages}
              </span>
              <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page===totalPages}
                className="btn btn-ghost" style={{ width:36, height:36, padding:0, minHeight:36, fontSize:16 }}>→</button>
            </div>
          )}
          {pageItems.length === 0 && (
            <div style={{ padding:24, textAlign:'center', color:'var(--text3)', fontSize:13 }}>결과 없음</div>
          )}
        </div>
      </div>
    </div>
  )
}
