import { useState, useMemo } from 'react'
import { NON_ROT_MEMBERS } from '../lib/prediction'
import { isHolidayDate, getTodayStr } from '../lib/utils'

const DAY_KO = ['일','월','화','수','목','금','토']

function isNonRot(m) {
  return m.is_non_rot ?? NON_ROT_MEMBERS.includes(m.name)
}

/**
 * 캘린더 포지션 기반 ROT offset 계산
 * - 해당 달의 모든 날짜를 순서대로 나열 (평일/휴일 분리)
 * - i번째 날의 실제 배정자 vs ROT[(off+i)%N] 비교
 * - 가장 많이 맞는 off 선택
 */
function findBestOffset(ym, allDays, history, rotList, isHolFlag) {
  if (!rotList.length) return 0
  const typeDays = allDays.filter(d => isHolidayDate(d) === isHolFlag)
  if (!typeDays.length) return 0

  let best = 0, bestScore = -1
  for (let off = 0; off < rotList.length; off++) {
    let score = 0
    typeDays.forEach((d, calIdx) => {
      const rec = history.find(h => h.date === d && h.is_holiday === isHolFlag)
      if (rec && rec.person === rotList[(off + calIdx) % rotList.length]) score++
    })
    if (score > bestScore) { bestScore = score; best = off }
  }
  return best
}

/**
 * 데이터 없는 달: 직전 달 offset + 직전 달 배정 건수로 추정
 */
function estimateOffset(ym, history, rotList, isHolFlag) {
  const [y, m] = ym.split('-').map(Number)
  // 직전 달
  const prevDate  = new Date(y, m-2, 1)
  const prevYm    = prevDate.toISOString().slice(0, 7)
  const prevDim   = new Date(prevDate.getFullYear(), prevDate.getMonth()+1, 0).getDate()
  const prevDays  = Array.from({length:prevDim}, (_,i) => `${prevYm}-${String(i+1).padStart(2,'0')}`)
  const prevOff   = findBestOffset(prevYm, prevDays, history, rotList, isHolFlag)
  const prevTypeDays = prevDays.filter(d => isHolidayDate(d) === isHolFlag)
  return (prevOff + prevTypeDays.length) % rotList.length
}

export default function TabMonthly({ history, members, dynamicROT, swapROTOrder, setMemberOrder, setNonROT }) {
  const today = getTodayStr()
  const [ym, setYm] = useState(today.slice(0, 7))
  const [section, setSection] = useState('calendar')
  const [year, month] = ym.split('-').map(Number)
  const daysInMonth = new Date(year, month, 0).getDate()
  const days = useMemo(() =>
    Array.from({length:daysInMonth}, (_,i) => `${ym}-${String(i+1).padStart(2,'0')}`),
    [ym, daysInMonth]
  )
  const effectiveROT = dynamicROT ?? []

  const rotSchedule = useMemo(() => {
    if (!effectiveROT.length) return {}

    const wdDays  = days.filter(d => !isHolidayDate(d))
    const holDays = days.filter(d =>  isHolidayDate(d))

    // 이번 달 데이터가 있으면 직접 계산, 없으면 직전 달에서 추정
    const monthHasWd  = history.some(h => h.date.startsWith(ym) && !h.is_holiday)
    const monthHasHol = history.some(h => h.date.startsWith(ym) &&  h.is_holiday)

    const wdOff  = monthHasWd  ? findBestOffset(ym, days, history, effectiveROT, false)
                                : estimateOffset(ym, history, effectiveROT, false)
    const holOff = monthHasHol ? findBestOffset(ym, days, history, effectiveROT, true)
                                : estimateOffset(ym, history, effectiveROT, true)

    const sched = {}
    let wdCnt = 0, holCnt = 0

    // ★ 핵심: 항상 카운터 증가 (기록 유무 무관)
    for (const d of days) {
      const hol    = isHolidayDate(d)
      const actual = history.find(h => h.date === d)?.person ?? null

      if (hol) {
        sched[d] = {
          rotPerson: effectiveROT[(holOff + holCnt) % effectiveROT.length],
          actual, isHoliday: true,
        }
        holCnt++ // 항상 증가
      } else {
        sched[d] = {
          rotPerson: effectiveROT[(wdOff + wdCnt) % effectiveROT.length],
          actual, isHoliday: false,
        }
        wdCnt++ // 항상 증가
      }
    }

    return sched
  }, [history, ym, days, effectiveROT.join(',')])

  const doneCount  = days.filter(d => rotSchedule[d]?.actual).length
  const swapCount  = days.filter(d => { const i = rotSchedule[d]; return i?.actual && i.actual !== i.rotPerson }).length
  const matchCount = doneCount - swapCount

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

      {/* 월 네비 */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <button onClick={() => { const d=new Date(year,month-2,1); setYm(d.toISOString().slice(0,7)) }}
          className="btn btn-ghost" style={{ width:40, height:40, padding:0, minHeight:40, fontSize:18 }}>←</button>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontWeight:900, fontSize:18, color:'var(--text)' }}>{year}년 {month}월</div>
          {doneCount > 0 && (
            <div style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--text3)', marginTop:3, display:'flex', gap:10, justifyContent:'center' }}>
              <span style={{ color:'var(--green)' }}>✓ 유지 {matchCount}</span>
              <span style={{ color:'var(--amber)' }}>⇄ 교환 {swapCount}</span>
              <span>/ {doneCount}건</span>
            </div>
          )}
        </div>
        <button onClick={() => { const d=new Date(year,month,1); setYm(d.toISOString().slice(0,7)) }}
          className="btn btn-ghost" style={{ width:40, height:40, padding:0, minHeight:40, fontSize:18 }}>→</button>
      </div>

      {/* 섹션 탭 */}
      <div style={{ display:'flex', gap:6 }}>
        {[['calendar','📅 월별 일정'], ['rot','🔢 순번 관리']].map(([key,label]) => (
          <button key={key} onClick={() => setSection(key)} style={{
            flex:1, height:40, borderRadius:10, fontSize:13, fontWeight:700, cursor:'pointer',
            border:`1.5px solid ${section===key ? 'var(--red)' : 'var(--border)'}`,
            background: section===key ? 'var(--red)' : 'var(--s1)',
            color: section===key ? '#FFF' : 'var(--text2)',
            boxShadow: section===key ? '0 3px 10px rgba(198,40,40,0.25)' : 'var(--shadow)',
          }}>{label}</button>
        ))}
      </div>

      {section === 'calendar' && <CalendarView days={days} rotSchedule={rotSchedule} today={today}/>}
      {section === 'rot'      && <ROTView members={members} effectiveROT={effectiveROT} swapROTOrder={swapROTOrder} setMemberOrder={setMemberOrder} setNonROT={setNonROT}/>}
    </div>
  )
}

function CalendarView({ days, rotSchedule, today }) {
  return (
    <div className="card" style={{ overflow:'hidden' }}>
      <div style={{ display:'flex', gap:16, padding:'10px 16px', borderBottom:'1px solid var(--border)', fontSize:11, flexWrap:'wrap' }}>
        <span style={{ color:'var(--red)',   fontWeight:700 }}>◆ 오늘</span>
        <span style={{ color:'var(--amber)', fontWeight:700 }}>⇄ 교환</span>
        <span style={{ color:'var(--green)', fontWeight:700 }}>✓ 순번유지</span>
        <span style={{ color:'var(--text3)', fontWeight:700 }}>○ 예정</span>
      </div>

      {days.map((date, idx) => {
        const d     = new Date(date + 'T00:00:00'), dow = d.getDay()
        const info  = rotSchedule[date]
        const isHol = info?.isHoliday ?? isHolidayDate(date)
        const isToday = date === today
        const isPast  = date < today
        const rotP    = info?.rotPerson ?? '—'
        const actualP = info?.actual ?? null
        const isSwap  = actualP && actualP !== rotP

        return (
          <div key={date} style={{
            display:'flex', alignItems:'center', gap:12, padding:'10px 16px',
            background: isToday ? 'rgba(198,40,40,0.04)'
                      : isSwap && isPast ? 'rgba(230,81,0,0.02)'
                      : 'transparent',
            borderBottom: idx < days.length-1 ? '1px solid var(--border)' : 'none',
            opacity: isPast && !isToday ? 0.65 : 1,
            outline: isToday ? '2px solid rgba(198,40,40,0.2)' : 'none',
            outlineOffset: -1,
          }}>
            {/* 날짜 */}
            <div style={{ width:54, flexShrink:0 }}>
              <div style={{
                fontFamily:'var(--mono)', fontWeight:700, fontSize:13,
                color: isToday ? 'var(--red)' : isPast ? 'var(--text3)' : 'var(--text)',
              }}>
                {date.slice(5).replace('-','/')}
              </div>
              <div style={{ fontSize:10, marginTop:1, display:'flex', gap:3 }}>
                <span style={{
                  color: dow===0 ? 'var(--red)' : dow===6 ? '#1565C0' : 'var(--text3)',
                  fontWeight:700,
                }}>{DAY_KO[dow]}</span>
                {isHol   && <span style={{ color:'var(--amber)', fontWeight:700 }}>휴</span>}
                {isToday && <span style={{ color:'var(--red)', fontWeight:900, fontSize:9 }}>TODAY</span>}
              </div>
            </div>

            {/* 기본순번 */}
            <div style={{ flex:1 }}>
              <div style={{ fontSize:10, color:'var(--text3)', marginBottom:2, fontWeight:700 }}>기본순번</div>
              <div style={{
                fontWeight:700, fontSize:14,
                color: isPast && !isToday ? 'var(--text2)' : 'var(--text)',
              }}>{rotP}</div>
            </div>

            {/* 실제 */}
            <div style={{ textAlign:'right', minWidth:84 }}>
              {actualP ? (
                isSwap ? (
                  <div>
                    <div style={{ fontSize:10, color:'var(--amber)', fontWeight:800, marginBottom:1 }}>⇄ 교환</div>
                    <div style={{ fontWeight:800, fontSize:14, color:'var(--amber)' }}>{actualP}</div>
                  </div>
                ) : (
                  <div style={{ display:'flex', alignItems:'center', gap:5, justifyContent:'flex-end' }}>
                    <span style={{ color:'var(--green)', fontWeight:900, fontSize:14 }}>✓</span>
                    <span style={{ fontSize:14, color:'var(--green)', fontWeight:700 }}>{actualP}</span>
                  </div>
                )
              ) : (
                <span style={{ fontSize:11, color:'var(--text3)', fontFamily:'var(--mono)' }}>예정</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ROTView({ members, effectiveROT, swapROTOrder, setMemberOrder, setNonROT }) {
  const [editMode,  setEditMode]  = useState(false)
  const [confirmId, setConfirmId] = useState(null)

  const rotMembers = members
    .filter(m => m.is_active && !m.is_retired && !isNonRot(m))
    .sort((a,b) => (a.display_order??99) - (b.display_order??99))

  const nonRotMembers = members
    .filter(m => m.is_active && !m.is_retired && isNonRot(m))
    .sort((a,b) => (a.display_order??99) - (b.display_order??99))

  async function moveUp(idx) {
    if (idx === 0) return
    await swapROTOrder(rotMembers[idx].id, rotMembers[idx-1].id)
  }
  async function moveDown(idx) {
    if (idx === rotMembers.length-1) return
    await swapROTOrder(rotMembers[idx].id, rotMembers[idx+1].id)
  }
  async function removeFromROT(id) {
    if (confirmId !== id) { setConfirmId(id); return }
    await setNonROT(id, true); setConfirmId(null)
  }
  async function addToROT(id) { await setNonROT(id, false) }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <p className="sec-label">기본 순번 ({rotMembers.length}명)</p>
          <span style={{ fontSize:12, color:'var(--text3)', marginTop:2, display:'block' }}>월별 자동 패턴 매칭</span>
        </div>
        <button onClick={() => { setEditMode(v => !v); setConfirmId(null) }} style={{
          height:36, padding:'0 14px', borderRadius:9, fontSize:12, fontWeight:700, cursor:'pointer',
          border:`1.5px solid ${editMode ? 'var(--red)' : 'var(--border)'}`,
          background: editMode ? 'var(--red)' : 'var(--s1)',
          color: editMode ? '#FFF' : 'var(--text2)',
          minHeight:36, boxShadow:'var(--shadow)',
        }}>{editMode ? '✓ 완료' : '✏️ 순번 편집'}</button>
      </div>

      <div className="card" style={{ overflow:'hidden' }}>
        {rotMembers.map((m, i) => (
          <div key={m.id} style={{
            display:'flex', alignItems:'center', gap:10, padding:'11px 14px',
            background: i%2===0 ? 'var(--s1)' : 'var(--s2)',
            borderBottom: i < rotMembers.length-1 ? '1px solid var(--border)' : 'none',
          }}>
            <div style={{ width:30, height:30, borderRadius:'50%', flexShrink:0, background:'var(--red)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--mono)', fontSize:12, fontWeight:700, color:'#FFF', boxShadow:'0 2px 4px rgba(198,40,40,0.3)' }}>
              {i+1}
            </div>
            <span style={{ fontWeight:700, fontSize:15, flex:1 }}>{m.name}</span>
            {m.is_new && <span className="pill pill-green" style={{ fontSize:10 }}>NEW</span>}
            {editMode && (
              <div style={{ display:'flex', gap:5 }}>
                <button onClick={() => moveUp(i)} disabled={i===0}
                  style={{ width:30, height:30, borderRadius:7, border:'1.5px solid var(--border)', background:'var(--s1)', color:i===0?'var(--text3)':'var(--text)', cursor:i===0?'not-allowed':'pointer', fontSize:13, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'var(--shadow)' }}>↑</button>
                <button onClick={() => moveDown(i)} disabled={i===rotMembers.length-1}
                  style={{ width:30, height:30, borderRadius:7, border:'1.5px solid var(--border)', background:'var(--s1)', color:i===rotMembers.length-1?'var(--text3)':'var(--text)', cursor:i===rotMembers.length-1?'not-allowed':'pointer', fontSize:13, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'var(--shadow)' }}>↓</button>
                <button onClick={() => removeFromROT(m.id)} style={{
                  height:30, padding:'0 10px', borderRadius:7, fontSize:11, fontWeight:700, cursor:'pointer', border:'1.5px solid', minHeight:30,
                  borderColor: confirmId===m.id ? 'var(--red)' : 'var(--border2)',
                  background: confirmId===m.id ? 'rgba(198,40,40,0.08)' : 'var(--s3)',
                  color: confirmId===m.id ? 'var(--red)' : 'var(--text3)',
                }}>{confirmId===m.id ? '확인?' : '순번 제외'}</button>
              </div>
            )}
          </div>
        ))}
        <div style={{ padding:'10px 14px', background:'rgba(198,40,40,0.03)', borderTop:'1px solid var(--border)', fontSize:12, color:'var(--red)', fontFamily:'var(--mono)', fontWeight:700 }}>
          ↺ {rotMembers.at(-1)?.name} → {rotMembers[0]?.name}
        </div>
      </div>

      {nonRotMembers.length > 0 && (
        <div>
          <p className="sec-label" style={{ marginBottom:10 }}>순번 외 멤버</p>
          <div className="card" style={{ overflow:'hidden' }}>
            {nonRotMembers.map((m, i) => (
              <div key={m.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'11px 14px', background:i%2===0?'var(--s1)':'var(--s2)', borderBottom:i<nonRotMembers.length-1?'1px solid var(--border)':'none' }}>
                <div style={{ width:30, height:30, borderRadius:'50%', flexShrink:0, background:'var(--s4)', border:'1.5px solid var(--border2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, color:'var(--text3)', fontFamily:'var(--mono)', fontWeight:700 }}>—</div>
                <span style={{ fontWeight:700, fontSize:15, flex:1 }}>{m.name}</span>
                {m.is_new && <span className="pill pill-cyan" style={{ fontSize:10 }}>NEW</span>}
                <span style={{ fontSize:11, color:'var(--text3)', marginRight:6 }}>순번 외</span>
                <button onClick={() => addToROT(m.id)} style={{ height:32, padding:'0 12px', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer', border:'1.5px solid var(--green)', background:'rgba(46,125,50,0.07)', color:'var(--green)', minHeight:32 }}>
                  + 순번 편입
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {confirmId && <button onClick={() => setConfirmId(null)} className="btn btn-ghost" style={{ width:'100%', fontSize:13 }}>취소</button>}

      <div style={{ fontSize:11, color:'var(--text3)', lineHeight:1.8, padding:'10px 14px', background:'var(--s1)', borderRadius:10, border:'1px solid var(--border)' }}>
        📊 각 달의 실제 배정 데이터를 분석해 기본순번 시작점을 자동 계산합니다<br/>
        ↑↓ 편집 모드에서 순번 위치 조정 · 순번 제외/편입 가능
      </div>
    </div>
  )
}
