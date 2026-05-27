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

export default function TabMonthly({ history, members, dynamicROT, swapROTOrder, setMemberOrder }) {
  const today = getTodayStr()
  const [ym,      setYm]      = useState(today.slice(0,7))
  const [section, setSection] = useState('calendar')
  const [year, month] = ym.split('-').map(Number)
  const daysInMonth   = new Date(year, month, 0).getDate()
  const days = Array.from({length:daysInMonth},(_,i)=>`${ym}-${String(i+1).padStart(2,'0')}`)

  const effectiveROT = dynamicROT ?? []

  const rotSchedule = useMemo(()=>{
    const wdHist  = history.filter(h=>!h.is_holiday).sort((a,b)=>a.date.localeCompare(b.date))
    const holHist = history.filter(h=> h.is_holiday).sort((a,b)=>a.date.localeCompare(b.date))
    const wdOff   = findBestROTOffset(wdHist,  effectiveROT)
    const holOff  = findBestROTOffset(holHist, effectiveROT)
    const sched   = {}
    wdHist.forEach((h,i)  =>{ sched[h.date]={rotPerson:effectiveROT[(wdOff +i)%effectiveROT.length]??'—', actual:h.person, isHoliday:false} })
    holHist.forEach((h,i) =>{ sched[h.date]={rotPerson:effectiveROT[(holOff+i)%effectiveROT.length]??'—', actual:h.person, isHoliday:true } })
    let wdCnt=wdHist.length, holCnt=holHist.length
    const ref=new Date(ym+'-01T00:00:00')
    for(let i=0;i<62;i++){
      const d=new Date(ref); d.setDate(d.getDate()+i)
      const ds=d.toISOString().split('T')[0]
      if(!sched[ds]){
        const hol=isHolidayDate(ds)
        if(hol){sched[ds]={rotPerson:effectiveROT[(holOff+holCnt)%effectiveROT.length]??'—',actual:null,isHoliday:true};holCnt++}
        else   {sched[ds]={rotPerson:effectiveROT[(wdOff +wdCnt )%effectiveROT.length]??'—',actual:null,isHoliday:false};wdCnt++}
      }
    }
    return sched
  },[history, ym, effectiveROT.join(',')])

  const doneCount = days.filter(d=>rotSchedule[d]?.actual).length
  const swapCount = days.filter(d=>{ const i=rotSchedule[d]; return i?.actual&&i.actual!==i.rotPerson }).length

  return (
    <div style={{padding:'12px 14px',display:'flex',flexDirection:'column',gap:12}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <button onClick={()=>{const d=new Date(year,month-2,1);setYm(d.toISOString().slice(0,7))}} className="btn btn-ghost" style={{width:40,height:40,padding:0,minHeight:40,fontSize:18}}>←</button>
        <div style={{textAlign:'center'}}>
          <div style={{fontFamily:'var(--display)',fontWeight:800,fontSize:18,color:'var(--cyan)'}}>{year}년 {month}월</div>
          {doneCount>0&&<div style={{fontFamily:'var(--mono)',fontSize:11,color:'var(--text3)',marginTop:2}}>교환 {swapCount}/{doneCount}건 ({Math.round(swapCount/doneCount*100)}%)</div>}
        </div>
        <button onClick={()=>{const d=new Date(year,month,1);setYm(d.toISOString().slice(0,7))}} className="btn btn-ghost" style={{width:40,height:40,padding:0,minHeight:40,fontSize:18}}>→</button>
      </div>

      <div style={{display:'flex',gap:6}}>
        {[['calendar','📅 월별'],['rot','🔢 순번 관리']].map(([key,label])=>(
          <button key={key} onClick={()=>setSection(key)} style={{
            flex:1,height:38,borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer',
            border:`1.5px solid ${section===key?'var(--cyan)':'var(--border)'}`,
            background:section===key?'var(--cyan-mute)':'var(--s1)',
            color:section===key?'var(--cyan)':'var(--text3)',
          }}>{label}</button>
        ))}
      </div>

      {section==='calendar' && <CalendarView days={days} rotSchedule={rotSchedule} today={today}/>}
      {section==='rot'      && <ROTView members={members} effectiveROT={effectiveROT} swapROTOrder={swapROTOrder} setMemberOrder={setMemberOrder}/>}
    </div>
  )
}

function CalendarView({days, rotSchedule, today}) {
  return (
    <div style={{display:'flex',flexDirection:'column',gap:4}}>
      <div style={{display:'flex',gap:10,fontSize:11,fontFamily:'var(--mono)',flexWrap:'wrap',marginBottom:4}}>
        <span style={{color:'var(--cyan)'}}>◆ 오늘</span>
        <span style={{color:'var(--amber)'}}>● 교환</span>
        <span style={{color:'var(--text3)'}}>✓ 유지</span>
        <span style={{color:'var(--text2)'}}>○ 예정</span>
      </div>
      {days.map(date=>{
        const d=new Date(date+'T00:00:00'),dow=d.getDay()
        const info=rotSchedule[date]
        const isHol=info?.isHoliday??isHolidayDate(date)
        const isToday=date===today,isPast=date<today
        const rotP=info?.rotPerson??'—',actualP=info?.actual??null
        const isSwap=actualP&&actualP!==rotP
        let bg='var(--s1)',borderColor='var(--border)',opacity=1
        if(isToday){bg='rgba(0,212,232,0.08)';borderColor='var(--cyan)'}
        else if(isPast&&isSwap){bg='rgba(240,165,0,0.05)';borderColor='rgba(240,165,0,0.25)';opacity=0.9}
        else if(isPast){opacity=0.4}
        return (
          <div key={date} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 12px',borderRadius:8,background:bg,border:`1px solid ${borderColor}`,opacity,boxShadow:isToday?'0 0 0 2px rgba(0,212,232,0.15)':'none'}}>
            <div style={{width:46,flexShrink:0}}>
              <div style={{fontFamily:'var(--mono)',fontWeight:700,fontSize:13,color:isToday?'var(--cyan)':isPast?'var(--text3)':'var(--text)'}}>{date.slice(5).replace('-','/')}</div>
              <div style={{fontSize:9,marginTop:1,display:'flex',gap:3}}>
                <span style={{color:dow===0?'#f85149':dow===6?'#60a5fa':'var(--text3)'}}>{DAY_KO[dow]}</span>
                {isHol&&<span style={{color:'var(--amber)'}}>휴</span>}
                {isToday&&<span style={{color:'var(--cyan)',fontWeight:700}}>TODAY</span>}
              </div>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:10,color:'var(--text3)',marginBottom:1,fontFamily:'var(--mono)'}}>기본순번</div>
              <div style={{fontWeight:600,fontSize:14,color:isPast&&!isToday?'var(--text3)':'var(--text)'}}>{rotP}</div>
            </div>
            <div style={{textAlign:'right',minWidth:72}}>
              {actualP?(isSwap?(
                <div>
                  <div style={{fontSize:10,color:'var(--amber)',fontFamily:'var(--mono)',marginBottom:1}}>교환</div>
                  <div style={{fontWeight:700,fontSize:14,color:'var(--amber)'}}>{actualP}</div>
                </div>
              ):(
                <div style={{display:'flex',alignItems:'center',gap:4,justifyContent:'flex-end'}}>
                  <span style={{fontSize:11,color:'var(--green)'}}>✓</span>
                  <span style={{fontSize:13,color:'var(--text3)'}}>{actualP}</span>
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

function ROTView({members, effectiveROT, swapROTOrder, setMemberOrder}) {
  const [editMode,  setEditMode]  = useState(false)
  const [inserting, setInserting] = useState(null)
  const [insertPos, setInsertPos] = useState(1)

  const rotMembers = members
    .filter(m=>m.is_active&&!m.is_retired&&!NON_ROT_MEMBERS.includes(m.name))
    .sort((a,b)=>(a.display_order??99)-(b.display_order??99))

  const nonROTMembers = members.filter(m=>m.is_active&&!m.is_retired&&NON_ROT_MEMBERS.includes(m.name))

  const newMembers = members.filter(m=>
    m.is_active&&!m.is_retired&&!NON_ROT_MEMBERS.includes(m.name)&&
    !['김찬혁','이상헌','박민서','김진영','모준찬','서희옥','김영훈','서동혁','허진혁','조영휘','김경은','장시은','이규현','이소연','강체리','박소영'].includes(m.name)
  )

  async function moveUp(idx) {
    if(idx===0) return
    const a=rotMembers[idx], b=rotMembers[idx-1]
    await swapROTOrder(a.id, b.id)
  }
  async function moveDown(idx) {
    if(idx===rotMembers.length-1) return
    const a=rotMembers[idx], b=rotMembers[idx+1]
    await swapROTOrder(a.id, b.id)
  }
  async function handleInsert(member) {
    await setMemberOrder(member.id, insertPos)
    setInserting(null)
  }

  return (
    <div style={{display:'flex',flexDirection:'column',gap:14}}>

      {/* 편집 토글 */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <p className="sec-label">기본순번 ({effectiveROT.length}명)</p>
        <button onClick={()=>setEditMode(v=>!v)} style={{
          height:34,padding:'0 14px',borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer',
          border:`1.5px solid ${editMode?'var(--amber)':'var(--border)'}`,
          background:editMode?'var(--amber-mute)':'var(--s3)',
          color:editMode?'var(--amber)':'var(--text3)',minHeight:34,
        }}>
          {editMode?'✓ 완료':'✏️ 순번 편집'}
        </button>
      </div>

      {/* ROT 리스트 */}
      <div className="card" style={{padding:8,display:'flex',flexDirection:'column',gap:3}}>
        {rotMembers.map((m,i)=>{
          const isNew=newMembers.some(n=>n.id===m.id)
          return (
            <div key={m.id} style={{
              display:'flex',alignItems:'center',gap:10,
              padding:'10px 12px',borderRadius:8,
              background:isNew?'rgba(0,200,83,0.05)':i%2===0?'var(--s2)':'transparent',
              border:`1px solid ${isNew?'rgba(0,200,83,0.2)':'transparent'}`,
            }}>
              <div style={{
                width:28,height:28,borderRadius:'50%',flexShrink:0,
                background:isNew?'var(--green-mute)':'var(--s4)',
                border:`1px solid ${isNew?'rgba(0,200,83,0.3)':'var(--border)'}`,
                display:'flex',alignItems:'center',justifyContent:'center',
                fontFamily:'var(--mono)',fontSize:11,fontWeight:700,
                color:isNew?'var(--green)':'var(--cyan)',
              }}>{i+1}</div>
              <span style={{fontWeight:600,fontSize:15,flex:1,color:isNew?'var(--green)':'var(--text)'}}>{m.name}</span>
              {isNew&&<span className="pill pill-green" style={{fontSize:10}}>NEW</span>}
              {editMode&&(
                <div style={{display:'flex',gap:4}}>
                  <button onClick={()=>moveUp(i)} disabled={i===0}
                    style={{width:32,height:32,borderRadius:6,border:'1px solid var(--border)',background:'var(--s4)',color:i===0?'var(--text3)':'var(--text)',cursor:i===0?'not-allowed':'pointer',fontSize:14,minHeight:32}}>↑</button>
                  <button onClick={()=>moveDown(i)} disabled={i===rotMembers.length-1}
                    style={{width:32,height:32,borderRadius:6,border:'1px solid var(--border)',background:'var(--s4)',color:i===rotMembers.length-1?'var(--text3)':'var(--text)',cursor:i===rotMembers.length-1?'not-allowed':'pointer',fontSize:14,minHeight:32}}>↓</button>
                </div>
              )}
            </div>
          )
        })}
        <div style={{marginTop:4,padding:'8px 12px',borderRadius:7,background:'var(--cyan-mute)',border:'1px solid rgba(0,212,232,0.2)',fontSize:12,color:'var(--cyan)',fontFamily:'var(--mono)',display:'flex',gap:6,alignItems:'center'}}>
          <span>↺</span><span>{effectiveROT.at(-1)} → {effectiveROT[0]}</span>
        </div>
      </div>

      {/* 순번 외 */}
      {nonROTMembers.length>0&&(
        <div>
          <p className="sec-label" style={{marginBottom:10}}>순번 외 멤버</p>
          <div style={{display:'flex',flexDirection:'column',gap:5}}>
            {nonROTMembers.map(m=>(
              <div key={m.id} className="card" style={{padding:'10px 14px',display:'flex',alignItems:'center',gap:10}}>
                <div style={{width:28,height:28,borderRadius:'50%',background:'var(--s4)',border:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,color:'var(--text3)',fontFamily:'var(--mono)'}}>—</div>
                <span style={{fontWeight:500,fontSize:15}}>{m.name}</span>
                <span style={{marginLeft:'auto',fontSize:11,color:'var(--text3)'}}>순번 외</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 신규 멤버 배치 */}
      {newMembers.length>0&&(
        <div>
          <p className="sec-label" style={{marginBottom:10}}>신규 멤버 순번 배치</p>
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {newMembers.map(m=>(
              <div key={m.id} className="card" style={{padding:12,border:`1px solid ${inserting===m.id?'var(--cyan)':'var(--border)'}`,background:inserting===m.id?'var(--cyan-mute)':'var(--s1)'}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:inserting===m.id?12:0}}>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <span className="pill pill-green" style={{fontSize:10}}>NEW</span>
                    <span style={{fontWeight:600,fontSize:15}}>{m.name}</span>
                    {m.display_order&&<span style={{fontSize:11,color:'var(--cyan)',fontFamily:'var(--mono)'}}>현재 {m.display_order}번</span>}
                  </div>
                  <button onClick={()=>{setInserting(inserting===m.id?null:m.id);setInsertPos(m.display_order||effectiveROT.length+1)}} style={{
                    height:32,padding:'0 12px',borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer',minHeight:32,
                    border:`1px solid ${inserting===m.id?'var(--cyan)':'var(--border)'}`,
                    background:inserting===m.id?'var(--cyan)':'var(--s3)',
                    color:inserting===m.id?'#000':'var(--text2)',
                  }}>{inserting===m.id?'취소':'순번 지정'}</button>
                </div>
                {inserting===m.id&&(
                  <div style={{display:'flex',flexDirection:'column',gap:10}}>
                    <div style={{fontSize:12,color:'var(--text3)'}}>몇 번째에 배치할까요?</div>
                    <div style={{display:'flex',gap:8,alignItems:'center'}}>
                      <button onClick={()=>setInsertPos(p=>Math.max(1,p-1))} className="btn btn-ghost" style={{width:44,height:44,padding:0,minHeight:44,fontSize:20}}>−</button>
                      <div style={{flex:1,textAlign:'center',fontFamily:'var(--mono)',fontWeight:700,fontSize:22,color:'var(--cyan)',background:'var(--s3)',borderRadius:8,padding:'8px'}}>
                        {insertPos}번
                        <div style={{fontSize:11,fontWeight:400,color:'var(--text3)',marginTop:2}}>
                          {rotMembers[insertPos-2]?`← ${rotMembers[insertPos-2].name}`:'맨 앞'} → {rotMembers[insertPos-1]?.name||'맨 끝'}
                        </div>
                      </div>
                      <button onClick={()=>setInsertPos(p=>Math.min(effectiveROT.length+1,p+1))} className="btn btn-ghost" style={{width:44,height:44,padding:0,minHeight:44,fontSize:20}}>+</button>
                    </div>
                    <button onClick={()=>handleInsert(m)} className="btn btn-primary" style={{width:'100%',height:44}}>
                      {m.name}을 {insertPos}번 순번으로 배치
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{fontSize:11,color:'var(--text3)',lineHeight:1.7,padding:'8px 12px',background:'var(--s2)',borderRadius:8,border:'1px solid var(--border)'}}>
        * ↑↓ 버튼으로 순번 조정 가능 (편집 모드)<br/>
        * 변경 즉시 예측에도 반영됩니다
      </div>
    </div>
  )
}
