import { useState, useMemo } from 'react'
import { ROT_ORDER } from '../lib/prediction'
import { isHolidayDate, getTodayStr } from '../lib/utils'

const DAY_KO = ['일','월','화','수','목','금','토']

function findBestROTOffset(recs) {
  if (recs.length === 0) return 0
  const n = ROT_ORDER.length
  let best = 0, bestN = -1
  for (let off = 0; off < n; off++) {
    let cnt = 0
    recs.forEach((r, i) => { if (r.person === ROT_ORDER[(off + i) % n]) cnt++ })
    if (cnt > bestN) { bestN = cnt; best = off }
  }
  return best
}

export default function TabMonthly({ history, members }) {
  const today = getTodayStr()
  const [ym, setYm] = useState(today.slice(0, 7))
  const [year, month] = ym.split('-').map(Number)

  const daysInMonth = new Date(year, month, 0).getDate()
  const days = Array.from({ length: daysInMonth }, (_, i) =>
    `${ym}-${String(i + 1).padStart(2, '0')}`
  )

  // ROT 스케줄 계산
  const rotSchedule = useMemo(() => {
    const wdHist  = history.filter(h => !h.is_holiday).sort((a,b) => a.date.localeCompare(b.date))
    const holHist = history.filter(h =>  h.is_holiday).sort((a,b) => a.date.localeCompare(b.date))

    const wdOff  = findBestROTOffset(wdHist)
    const holOff = findBestROTOffset(holHist)

    const sched = {}

    // 이미 기록된 날짜
    wdHist.forEach((h, i) => {
      sched[h.date] = { rotPerson: ROT_ORDER[(wdOff + i) % ROT_ORDER.length], actual: h.person, isHoliday: false }
    })
    holHist.forEach((h, i) => {
      sched[h.date] = { rotPerson: ROT_ORDER[(holOff + i) % ROT_ORDER.length], actual: h.person, isHoliday: true }
    })

    // 미래 날짜 연장
    let wdCnt  = wdHist.length
    let holCnt = holHist.length

    // 현재 달 이후 날짜도 포함하기 위해 충분히 탐색
    const allFuture = []
    const ref = new Date(ym + '-01T00:00:00')
    for (let i = 0; i < 62; i++) {
      const d = new Date(ref); d.setDate(d.getDate() + i)
      const ds = d.toISOString().split('T')[0]
      if (!sched[ds]) allFuture.push(ds)
    }
    allFuture.sort().forEach(ds => {
      const hol = isHolidayDate(ds)
      if (hol) {
        sched[ds] = { rotPerson: ROT_ORDER[(holOff + holCnt) % ROT_ORDER.length], actual: null, isHoliday: true }
        holCnt++
      } else {
        sched[ds] = { rotPerson: ROT_ORDER[(wdOff + wdCnt) % ROT_ORDER.length], actual: null, isHoliday: false }
        wdCnt++
      }
    })

    return sched
  }, [history, ym])

  function prevMonth() {
    const d = new Date(year, month - 2, 1)
    setYm(d.toISOString().slice(0, 7))
  }
  function nextMonth() {
    const d = new Date(year, month, 1)
    setYm(d.toISOString().slice(0, 7))
  }

  // 이번 달 교환 통계
  const swapCount = days.filter(date => {
    const info = rotSchedule[date]
    return info?.actual && info.actual !== info.rotPerson
  }).length
  const doneCount = days.filter(date => rotSchedule[date]?.actual).length

  return (
    <div style={{ padding:'12px 14px', display:'flex', flexDirection:'column', gap:12 }}>

      {/* 월 네비 */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <button onClick={prevMonth} className="btn btn-ghost" style={{ width:40, height:40, padding:0, minHeight:40, fontSize:18 }}>←</button>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontFamily:'var(--display)', fontWeight:800, fontSize:18, color:'var(--cyan)' }}>
            {year}년 {month}월
          </div>
          {doneCount > 0 && (
            <div style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--text3)', marginTop:2 }}>
              교환 {swapCount}/{doneCount}건 ({Math.round(swapCount/doneCount*100)}%)
            </div>
          )}
        </div>
        <button onClick={nextMonth} className="btn btn-ghost" style={{ width:40, height:40, padding:0, minHeight:40, fontSize:18 }}>→</button>
      </div>

      {/* 범례 */}
      <div style={{ display:'flex', gap:12, fontSize:11, fontFamily:'var(--mono)', flexWrap:'wrap' }}>
        <span style={{ color:'var(--cyan)' }}>◆ 오늘</span>
        <span style={{ color:'var(--amber)' }}>● 교환발생</span>
        <span style={{ color:'var(--text3)' }}>● 순번유지</span>
        <span style={{ color:'var(--text2)' }}>○ 예정</span>
      </div>

      {/* 날짜 목록 */}
      <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
        {days.map(date => {
          const d    = new Date(date + 'T00:00:00')
          const dow  = d.getDay()
          const info = rotSchedule[date]
          const isHol    = info?.isHoliday ?? isHolidayDate(date)
          const isToday  = date === today
          const isPast   = date < today
          const rotP     = info?.rotPerson ?? '—'
          const actualP  = info?.actual ?? null
          const isSwap   = actualP && actualP !== rotP
          const isNonROT = actualP && !ROT_ORDER.includes(actualP)

          let bg, borderColor, opacity = 1
          if (isToday) {
            bg = 'rgba(0,212,232,0.08)'; borderColor = 'var(--cyan)'
          } else if (isPast && isSwap) {
            bg = 'rgba(240,165,0,0.07)'; borderColor = 'rgba(240,165,0,0.35)'
          } else if (isPast) {
            bg = 'transparent'; borderColor = 'var(--border)'; opacity = 0.55
          } else {
            bg = 'var(--s1)'; borderColor = 'var(--border)'
          }

          return (
            <div key={date} style={{
              display:'flex', alignItems:'center', gap:10,
              padding:'9px 12px', borderRadius:8,
              background:bg, border:`1px solid ${borderColor}`,
              opacity, transition:'opacity 0.1s',
              boxShadow: isToday ? '0 0 0 2px rgba(0,212,232,0.2)' : 'none',
            }}>
              {/* 날짜 */}
              <div style={{ width:46, flexShrink:0 }}>
                <div style={{
                  fontFamily:'var(--mono)', fontWeight:700, fontSize:13,
                  color: isToday ? 'var(--cyan)' : isPast ? 'var(--text3)' : 'var(--text)',
                }}>
                  {date.slice(5).replace('-','/')}
                </div>
                <div style={{ fontSize:9, marginTop:1 }}>
                  <span style={{ color: dow===0?'#f85149':dow===6?'#60a5fa':'var(--text3)' }}>
                    {DAY_KO[dow]}
                  </span>
                  {isHol && <span style={{ color:'var(--amber)', marginLeft:3 }}>휴</span>}
                  {isToday && <span style={{ color:'var(--cyan)', marginLeft:3, fontWeight:700 }}>TODAY</span>}
                </div>
              </div>

              {/* 기본 순번 */}
              <div style={{ flex:1 }}>
                <div style={{ fontSize:10, color:'var(--text3)', marginBottom:2, fontFamily:'var(--mono)' }}>기본순번</div>
                <div style={{ fontWeight:600, fontSize:14, color: isPast&&!isToday?'var(--text3)':'var(--text)' }}>
                  {rotP}
                </div>
              </div>

              {/* 실제 / 예정 */}
              <div style={{ textAlign:'right', minWidth:72 }}>
                {actualP ? (
                  isSwap ? (
                    <div>
                      <div style={{ fontSize:10, color:'var(--amber)', fontFamily:'var(--mono)', marginBottom:1 }}>
                        {isNonROT ? '외부교환' : '교환'}
                      </div>
                      <div style={{ fontWeight:700, fontSize:14, color:'var(--amber)' }}>
                        {actualP}
                      </div>
                    </div>
                  ) : (
                    <div style={{ display:'flex', alignItems:'center', gap:4, justifyContent:'flex-end' }}>
                      <span style={{ fontSize:11, color:'var(--text3)', fontFamily:'var(--mono)' }}>✓</span>
                      <span style={{ fontSize:13, color:'var(--text3)' }}>{actualP}</span>
                    </div>
                  )
                ) : (
                  <div style={{ fontSize:11, color:'var(--text3)', fontFamily:'var(--mono)' }}>예정</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
