import { useState, useMemo } from 'react'
import { dateDiffDays, getTodayStr } from '../lib/utils'

function elapsedColor(days) {
  if (days == null) return 'var(--subtle)'
  if (days <= 7)  return '#f85149'
  if (days <= 14) return '#f5a623'
  if (days <= 21) return '#e3b341'
  return '#3fb950'
}

export default function TabElapsed({ history, members }) {
  const [showRetired, setShowRetired] = useState(false)
  const today = getTodayStr()

  const rows = useMemo(() => {
    const target = showRetired ? members : members.filter(m => !m.is_retired)
    const sorted = [...target].sort((a, b) => (a.display_order || 99) - (b.display_order || 99))

    return sorted.map(m => {
      const allRecs  = history.filter(h => h.person === m.name).sort((a,b) => a.date.localeCompare(b.date))
      const wdRecs   = allRecs.filter(h => !h.is_holiday)
      const holRecs  = allRecs.filter(h => h.is_holiday)

      // 30-day counts
      const cut30 = addDays(today, -30)
      const wd30  = wdRecs.filter(h => h.date >= cut30).length
      const hol30 = holRecs.filter(h => h.date >= cut30).length

      // Last dates
      const lastWd  = wdRecs.at(-1)?.date
      const lastHol = holRecs.at(-1)?.date
      const lastAny = allRecs.at(-1)?.date

      const wdElapsed  = lastWd  ? dateDiffDays(lastWd,  today) : null
      const holElapsed = lastHol ? dateDiffDays(lastHol, today) : null
      const anyElapsed = lastAny ? dateDiffDays(lastAny, today) : null

      return {
        name: m.name,
        is_retired: m.is_retired,
        is_active: m.is_active,
        total: allRecs.length,
        wd30, hol30,
        wdElapsed, holElapsed, anyElapsed,
      }
    })
  }, [history, members, showRetired, today])

  // Sort by anyElapsed desc (longest first = most overdue)
  const sorted = [...rows].sort((a, b) => {
    const ae = a.anyElapsed ?? -1
    const be = b.anyElapsed ?? -1
    return be - ae
  })

  return (
    <div style={{ padding:16, display:'flex', flexDirection:'column', gap:12 }}>
      {/* Controls */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div style={{ fontSize:12, color:'var(--muted)', fontWeight:600 }}>
          경과일 현황
          <span style={{ marginLeft:8, fontFamily:'IBM Plex Mono', fontSize:11, color:'var(--subtle)' }}>
            기준: {today}
          </span>
        </div>
        <button onClick={() => setShowRetired(v => !v)} style={{
          padding:'5px 12px', borderRadius:6, fontSize:11, cursor:'pointer',
          border:'1px solid var(--border)', background: showRetired ? 'rgba(0,229,255,0.1)' : 'var(--surface4)',
          color: showRetired ? 'var(--accent)' : 'var(--muted)',
        }}>
          {showRetired ? '현직만' : '퇴직자 포함'}
        </button>
      </div>

      {/* Legend */}
      <div style={{ display:'flex', gap:12, fontSize:11, color:'var(--subtle)' }}>
        <span>🔴 ≤7일</span>
        <span>🟠 8~14일</span>
        <span>🟡 15~21일</span>
        <span>🟢 22일+</span>
      </div>

      {/* Table */}
      <div className="card" style={{ overflow:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
          <thead>
            <tr style={{ borderBottom:'1px solid var(--border)', color:'var(--subtle)' }}>
              {['이름','총건수','30일평일','30일휴일','평일경과','휴일경과','전체경과'].map(h => (
                <th key={h} style={{ padding:'8px 10px', textAlign: h==='이름' ? 'left' : 'center', fontWeight:500, whiteSpace:'nowrap' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map(row => (
              <tr key={row.name} style={{
                borderBottom:'1px solid rgba(48,54,61,0.5)',
                opacity: row.is_retired ? 0.5 : row.is_active ? 1 : 0.65,
              }}>
                <td style={{ padding:'8px 10px', fontWeight:500 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <div style={{
                      width:7, height:7, borderRadius:'50%',
                      background: row.is_retired ? 'var(--subtle)' : row.is_active ? 'var(--success)' : 'var(--muted)',
                      flexShrink:0,
                    }}/>
                    {row.name}
                    {row.is_retired && (
                      <span style={{ fontSize:9, color:'var(--subtle)' }}>퇴직</span>
                    )}
                  </div>
                </td>
                <td style={{ padding:'8px 10px', textAlign:'center', fontFamily:'IBM Plex Mono' }}>
                  {row.total}
                </td>
                <td style={{ padding:'8px 10px', textAlign:'center', fontFamily:'IBM Plex Mono', color:'#06b6d4' }}>
                  {row.wd30}
                </td>
                <td style={{ padding:'8px 10px', textAlign:'center', fontFamily:'IBM Plex Mono', color:'#f5a623' }}>
                  {row.hol30}
                </td>
                <ElapsedCell val={row.wdElapsed} />
                <ElapsedCell val={row.holElapsed} />
                <ElapsedCell val={row.anyElapsed} bold />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ElapsedCell({ val, bold }) {
  const color = elapsedColor(val)
  return (
    <td style={{ padding:'8px 10px', textAlign:'center' }}>
      {val != null ? (
        <span style={{
          fontFamily:'IBM Plex Mono', fontSize:12,
          fontWeight: bold ? 700 : 500,
          color,
          background:`${color}15`,
          padding:'2px 8px', borderRadius:4,
        }}>
          {val}d
        </span>
      ) : (
        <span style={{ color:'var(--subtle)', fontSize:11 }}>—</span>
      )}
    </td>
  )
}

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}
