import { useState, useMemo } from 'react'
import { NON_ROT_MEMBERS } from '../lib/prediction'
import { isHolidayDate, getTodayStr } from '../lib/utils'

const DAY_KO = ['일','월','화','수','목','금','토']

function findBestROTOffset(recs, rotList) {
  if (!recs.length || !rotList.length) return 0
  let best=0, bestN=-1
  for (let off=0; off<rotList.length; off++) {
    let cnt=0
    recs.forEach((r,i)=>{ if(r.person===rotList[(off+i)%rotList.length]) cnt++ })
    if(cnt>bestN){bestN=cnt;best=off}
  }
  return best
}

function isNonRot(m) {
  return m.is_non_rot ?? NON_ROT_MEMBERS.includes(m.name)
}

export default function TabMonthly({ history, members, dynamicROT, swapROTOrder, setMemberOrder, setNonROT }) {
  const today = getTodayStr()
  const [ym, setYm] = useState(today.slice(0,7))
  const [section, setSection] = useState('calendar')
  const [year, month] = ym.split('-').map(Number)
  const daysInMonth = new Date(year, month, 0).getDate()
  const days = Array.from({length:daysInMonth},(_,i)=>`${ym}-${String(i+1).padStart(2,'0')}`)
  const effectiveROT = dynamicROT ?? []

  const rotSchedule = useMemo(()=>{
    const wdHist  = history.filter(h=>!h.is_holiday).sort((a,b)=>a.date.localeCompare(b.date))
    const holHist = history.filter(h=> h.is_holiday).sort((a,b)=>a.date.localeCompare(b.date))
    if (!effectiveROT.length) return {}
    const wdOff  = findBestROTOffset(wdHist,  effectiveROT)
    const holOff = findBestROTOffset(holHist, effectiveROT)
    const sched  = {}
    wdHist.forEach((h,i)  =>{ sched[h.date]={rotPerson:effectiveROT[(wdOff +i)%effectiveROT.length],actual:h.person,isHoliday:false} })
    holHist.forEach((h,i) =>{ sched[h.date]={rotPerson:effectiveROT[(holOff+i)%effectiveROT.length],actual:h.person,isHoliday:true } })
    let wdCnt=wdHist.length, holCnt=holHist.length
    const ref=new Date(ym+'-01T00:00:00')
    for(let i=0;i<62;i++){
      const d=new Date(ref);d.setDate(d.getDate()+i)
      const ds=d.toISOString().split('T')[0]
      if(!sched[ds]){
        const hol=isHolidayDate(ds)
        if(hol){sched[ds]={rotPerson:effectiveROT[(holOff+holCnt)%effectiveROT.length],actual:null,isHoliday:true};holCnt++}
        else   {sched[ds]={rotPerson:effectiveROT[(wdOff +wdCnt )%effectiveROT.length],actual:null,isHoliday:false};wdCnt++}
      }
    }
    return sched
  },[history,ym,effectiveROT.join(',')])

  const doneCount=days.filter(d=>rotSchedule[d]?.actual).length
  const swapCount=days.filter(d=>{const i=rotSchedule[d];return i?.actual&&i.actual!==i.rotPerson}).length

  return (
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      {/* 월 네비 */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <button onClick={()=>{const d=new Date(year,month-2,1);setYm(d.toISOString().slice(0,7))}} className="btn btn-ghost" style={{width:40,height:40,padding:0,minHeight:40,fontSize:18}}>←</button>
        <div style={{textAlign:'center'}}>
          <div style={{fontWeight:900,fontSize:18,color:'var(--text)'}}>{year}년 {month}월</div>
          {doneCount>0&&<div style={{fontFamily:'var(--mono)',fontSize:11,color:'var(--text3)',marginTop:2}}>교환 {swapCount}/{doneCount}건 ({Math.round(swapCount/doneCount*100)}%)</div>}
        </div>
        <button onClick={()=>{const d=new Date(year,month,1);setYm(d.toISOString().slice(0,7))}} className="btn btn-ghost" style={{width:40,height:40,padding:0,minHeight:40,fontSize:18}}>→</button>
      </div>

      {/* 섹션 탭 */}
      <div style={{display:'flex',gap:6}}>
        {[['calendar','📅 월별 일정'],['rot','🔢 순번 관리']].map(([key,label])=>(
          <button key={key} onClick={()=>setSection(key)} style={{
            flex:1,height:40,borderRadius:10,fontSize:13,fontWeight:700,cursor:'pointer',
            border:`1.5px solid ${section===key?'var(--red)':'var(--border)'}`,
            background:section===key?'var(--red)':'var(--s1)',
            color:section===key?'#FFF':'var(--text2)',
            boxShadow:section===key?'0 3px 10px rgba(198,40,40,0.25)':'var(--shadow)',
          }}>{label}</button>
        ))}
      </div>

      {section==='calendar' && <CalendarView days={days} rotSchedule={rotSchedule} today={today}/>}
      {section==='rot'      && <ROTView members={members} effectiveROT={effectiveROT} swapROTOrder={swapROTOrder} setMemberOrder={setMemberOrder} setNonROT={setNonROT}/>}
    </div>
  )
}

function CalendarView({days, rotSchedule, today}) {
  return (
    <div className="card" style={{overflow:'hidden'}}>
      {/* Legend */}
      <div style={{display:'flex',gap:16,padding:'10px 14px',borderBottom:'1px solid var(--border)',fontSize:11,flexWrap:'wrap'}}>
        <span style={{color:'var(--red)',fontWeight:700}}>◆ 오늘</span>
        <span style={{color:'var(--amber)',fontWeight:700}}>● 교환발생</span>
        <span style={{color:'var(--green)',fontWeight:700}}>✓ 순번유지</span>
        <span style={{color:'var(--text3)',fontWeight:700}}>○ 예정</span>
      </div>
      {days.map((date,idx)=>{
        const d=new Date(date+'T00:00:00'),dow=d.getDay()
        const info=rotSchedule[date]
        const isHol=info?.isHoliday??isHolidayDate(date)
        const isToday=date===today,isPast=date<today
        const rotP=info?.rotPerson??'—',actualP=info?.actual??null
        const isSwap=actualP&&actualP!==rotP
        return (
          <div key={date} style={{
            display:'flex',alignItems:'center',gap:12,padding:'10px 14px',
            background:isToday?'rgba(198,40,40,0.04)':isSwap&&isPast?'rgba(230,81,0,0.03)':'transparent',
            borderBottom:idx<days.length-1?'1px solid var(--border)':'none',
            opacity:isPast&&!isToday?0.6:1,
            outline:isToday?'2px solid rgba(198,40,40,0.3)':'none',
            outlineOffset:-1,
          }}>
            {/* Date */}
            <div style={{width:50,flexShrink:0}}>
              <div style={{fontFamily:'var(--mono)',fontWeight:700,fontSize:13,color:isToday?'var(--red)':isPast?'var(--text3)':'var(--text)'}}>
                {date.slice(5).replace('-','/')}
              </div>
              <div style={{fontSize:10,marginTop:1,display:'flex',gap:3}}>
                <span style={{color:dow===0?'var(--red)':dow===6?'#1565C0':'var(--text3)',fontWeight:700}}>{DAY_KO[dow]}</span>
                {isHol&&<span style={{color:'var(--amber)',fontWeight:700}}>휴</span>}
                {isToday&&<span style={{color:'var(--red)',fontWeight:900,fontSize:9}}>TODAY</span>}
              </div>
            </div>
            {/* 기본순번 */}
            <div style={{flex:1}}>
              <div style={{fontSize:10,color:'var(--text3)',marginBottom:2,fontWeight:700}}>기본순번</div>
              <div style={{fontWeight:700,fontSize:14,color:isPast&&!isToday?'var(--text2)':'var(--text)'}}>{rotP}</div>
            </div>
            {/* 실제 */}
            <div style={{textAlign:'right',minWidth:80}}>
              {actualP?(isSwap?(
                <div>
                  <div style={{fontSize:10,color:'var(--amber)',fontWeight:800,marginBottom:1}}>교환</div>
                  <div style={{fontWeight:800,fontSize:14,color:'var(--amber)'}}>{actualP}</div>
                </div>
              ):(
                <div style={{display:'flex',alignItems:'center',gap:5,justifyContent:'flex-end'}}>
                  <span style={{color:'var(--green)',fontWeight:900}}>✓</span>
                  <span style={{fontSize:13,color:'var(--text2)',fontWeight:600}}>{actualP}</span>
                </div>
              )):(
                <span style={{fontSize:11,color:'var(--text3)',fontFamily:'var(--mono)'}}>예정</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ROTView({members, effectiveROT, swapROTOrder, setMemberOrder, setNonROT}) {
  const [editMode, setEditMode] = useState(false)
  const [confirmId, setConfirmId] = useState(null)

  // ROT 멤버: is_non_rot = false 이거나 미설정이면서 활성
  const rotMembers = members
    .filter(m => m.is_active && !m.is_retired && !isNonRot(m))
    .sort((a,b)=>(a.display_order??99)-(b.display_order??99))

  // 순번 외 멤버: is_non_rot = true
  const nonRotMembers = members
    .filter(m => m.is_active && !m.is_retired && isNonRot(m))
    .sort((a,b)=>(a.display_order??99)-(b.display_order??99))

  async function moveUp(idx) {
    if(idx===0) return
    await swapROTOrder(rotMembers[idx].id, rotMembers[idx-1].id)
  }
  async function moveDown(idx) {
    if(idx===rotMembers.length-1) return
    await swapROTOrder(rotMembers[idx].id, rotMembers[idx+1].id)
  }

  // 순번 외로 이동 (ROT → 비ROT)
  async function removeFromROT(id) {
    if(confirmId!==id){setConfirmId(id);return}
    await setNonROT(id, true)
    setConfirmId(null)
  }

  // 순번에 편입 (비ROT → ROT 맨 뒤)
  async function addToROT(id) {
    await setNonROT(id, false)
  }

  return (
    <div style={{display:'flex',flexDirection:'column',gap:14}}>

      {/* ── ROT 멤버 리스트 ── */}
      <div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
          <div>
            <p className="sec-label">기본 순번 멤버</p>
            <span style={{fontSize:12,color:'var(--text3)',marginTop:2,display:'block'}}>{rotMembers.length}명 · 순환 배정</span>
          </div>
          <button onClick={()=>{setEditMode(v=>!v);setConfirmId(null)}} style={{
            height:36,padding:'0 14px',borderRadius:9,fontSize:12,fontWeight:700,cursor:'pointer',
            border:`1.5px solid ${editMode?'var(--red)':'var(--border)'}`,
            background:editMode?'var(--red)':'var(--s1)',
            color:editMode?'#FFF':'var(--text2)',
            minHeight:36,boxShadow:'var(--shadow)',
          }}>
            {editMode?'✓ 완료':'✏️ 순번 편집'}
          </button>
        </div>

        <div className="card" style={{overflow:'hidden'}}>
          {rotMembers.map((m,i)=>(
            <div key={m.id} style={{
              display:'flex',alignItems:'center',gap:10,padding:'11px 14px',
              background:i%2===0?'var(--s1)':'var(--s2)',
              borderBottom:i<rotMembers.length-1?'1px solid var(--border)':'none',
            }}>
              {/* 순번 번호 */}
              <div style={{
                width:30,height:30,borderRadius:'50%',flexShrink:0,
                background:'var(--red)',
                display:'flex',alignItems:'center',justifyContent:'center',
                fontFamily:'var(--mono)',fontSize:12,fontWeight:700,color:'#FFF',
                boxShadow:'0 2px 4px rgba(198,40,40,0.3)',
              }}>{i+1}</div>

              <span style={{fontWeight:700,fontSize:15,flex:1,color:'var(--text)'}}>{m.name}</span>
              {m.is_new&&<span className="pill pill-green" style={{fontSize:10}}>NEW</span>}

              {editMode&&(
                <div style={{display:'flex',gap:5,alignItems:'center'}}>
                  {/* 위/아래 이동 */}
                  <div style={{display:'flex',gap:3}}>
                    <button onClick={()=>moveUp(i)} disabled={i===0} style={{
                      width:30,height:30,borderRadius:7,border:'1.5px solid var(--border)',
                      background:'var(--s1)',color:i===0?'var(--text3)':'var(--text)',
                      cursor:i===0?'not-allowed':'pointer',fontSize:13,
                      display:'flex',alignItems:'center',justifyContent:'center',
                      boxShadow:'var(--shadow)',
                    }}>↑</button>
                    <button onClick={()=>moveDown(i)} disabled={i===rotMembers.length-1} style={{
                      width:30,height:30,borderRadius:7,border:'1.5px solid var(--border)',
                      background:'var(--s1)',color:i===rotMembers.length-1?'var(--text3)':'var(--text)',
                      cursor:i===rotMembers.length-1?'not-allowed':'pointer',fontSize:13,
                      display:'flex',alignItems:'center',justifyContent:'center',
                      boxShadow:'var(--shadow)',
                    }}>↓</button>
                  </div>
                  {/* 순번 제외 버튼 */}
                  <button onClick={()=>removeFromROT(m.id)} style={{
                    height:30,padding:'0 10px',borderRadius:7,fontSize:11,fontWeight:700,
                    cursor:'pointer',border:'1.5px solid',minHeight:30,
                    borderColor:confirmId===m.id?'var(--red)':'var(--border2)',
                    background:confirmId===m.id?'var(--red)':'var(--s3)',
                    color:confirmId===m.id?'#FFF':'var(--text3)',
                  }}>
                    {confirmId===m.id?'확인?':'순번 제외'}
                  </button>
                </div>
              )}
            </div>
          ))}

          {/* 순환 표시 */}
          {rotMembers.length>0&&(
            <div style={{padding:'10px 14px',background:'rgba(198,40,40,0.04)',borderTop:'1px solid var(--border)',fontSize:12,color:'var(--red)',fontFamily:'var(--mono)',fontWeight:700}}>
              ↺ {rotMembers.at(-1)?.name} → {rotMembers[0]?.name} (순환)
            </div>
          )}
        </div>
      </div>

      {/* ── 순번 외 멤버 ── */}
      <div>
        <div style={{marginBottom:10}}>
          <p className="sec-label">순번 외 멤버</p>
          <span style={{fontSize:12,color:'var(--text3)',marginTop:2,display:'block'}}>{nonRotMembers.length}명 · 순번에 편입 가능</span>
        </div>

        {nonRotMembers.length===0?(
          <div className="card" style={{padding:'20px',textAlign:'center',color:'var(--text3)',fontSize:13}}>
            순번 외 멤버가 없습니다
          </div>
        ):(
          <div className="card" style={{overflow:'hidden'}}>
            {nonRotMembers.map((m,i)=>(
              <div key={m.id} style={{
                display:'flex',alignItems:'center',gap:10,padding:'11px 14px',
                background:i%2===0?'var(--s1)':'var(--s2)',
                borderBottom:i<nonRotMembers.length-1?'1px solid var(--border)':'none',
              }}>
                <div style={{
                  width:30,height:30,borderRadius:'50%',flexShrink:0,
                  background:'var(--s4)',border:'1.5px solid var(--border2)',
                  display:'flex',alignItems:'center',justifyContent:'center',
                  fontSize:11,color:'var(--text3)',fontFamily:'var(--mono)',fontWeight:700,
                }}>—</div>
                <span style={{fontWeight:700,fontSize:15,flex:1,color:'var(--text)'}}>{m.name}</span>
                {m.is_new&&<span className="pill pill-cyan" style={{fontSize:10}}>NEW</span>}
                <span style={{fontSize:11,color:'var(--text3)',marginRight:4}}>순번 외</span>
                {/* 순번 편입 버튼 */}
                <button onClick={()=>addToROT(m.id)} style={{
                  height:32,padding:'0 12px',borderRadius:8,fontSize:12,fontWeight:700,
                  cursor:'pointer',border:'1.5px solid var(--green)',
                  background:'rgba(46,125,50,0.08)',color:'var(--green)',
                  minHeight:32,transition:'all 0.15s',
                }}>
                  + 순번 편입
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {confirmId&&(
        <button onClick={()=>setConfirmId(null)} className="btn btn-ghost" style={{width:'100%',fontSize:13}}>
          취소
        </button>
      )}

      <div style={{fontSize:11,color:'var(--text3)',lineHeight:1.8,padding:'10px 14px',background:'var(--s1)',borderRadius:10,border:'1px solid var(--border)'}}>
        <strong>순번 편집 모드</strong>에서:<br/>
        • ↑↓ 버튼으로 순번 위치 조정<br/>
        • <strong>순번 제외</strong>: 해당 멤버를 순번 외로 이동<br/>
        • <strong>순번 편입</strong>: 순번 외 멤버를 순번 맨 뒤에 추가
      </div>
    </div>
  )
}
