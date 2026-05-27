import { useState, useEffect } from 'react'
import { computePredictions } from '../lib/prediction'
import { isHolidayDate, getTodayStr, formatDateFull, pct, signStr } from '../lib/utils'

export default function TabInput({ history, weights, members, saveEntry, dynamicROT, isDesktop }) {
  const today = getTodayStr()
  const [date,      setDate]      = useState(today)
  const [isHoliday, setIsHoliday] = useState(isHolidayDate(today))
  const [selected,  setSelected]  = useState(null)
  const [saving,    setSaving]    = useState(false)
  const [result,    setResult]    = useState(null)
  const [preds,     setPreds]     = useState([])

  useEffect(()=>{
    const active=members.filter(m=>m.is_active&&!m.is_retired)
    setPreds(computePredictions(date,isHoliday,history,active,weights,dynamicROT))
    setSelected(null); setResult(null)
  },[date,isHoliday,history,members,weights])

  function onDateChange(v){ setDate(v); setIsHoliday(isHolidayDate(v)) }

  async function handleSave(){
    if(!selected||saving) return
    setSaving(true)
    try{ setResult(await saveEntry(date,selected,isHoliday)) }
    finally{ setSaving(false) }
  }

  const activeMems = members.filter(m=>m.is_active&&!m.is_retired)
  const predMap    = Object.fromEntries(preds.map(p=>[p.person,p]))
  const alreadyIn  = history.some(h=>h.date===date)
  const maxProb    = preds[0]?.prob??0
  const cols       = isDesktop ? 6 : 4

  if(result) return <ResultView result={result} onReset={()=>{setResult(null);setSelected(null)}} isDesktop={isDesktop}/>

  return(
    <div style={{display:'flex',flexDirection:'column',gap:14}}>

      {/* Date row */}
      <div className="card" style={{padding:isDesktop?16:12}}>
        <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
          <input type="date" value={date} onChange={e=>onDateChange(e.target.value)}
            className="input" style={{flex:'1 1 160px',maxWidth:200,fontFamily:'var(--mono)'}}/>
          <div style={{display:'flex',gap:6}}>
            {[false,true].map(v=>(
              <button key={String(v)} onClick={()=>setIsHoliday(v)} style={{
                height:46,padding:'0 18px',borderRadius:9,fontSize:13,fontWeight:700,cursor:'pointer',border:'1.5px solid',
                borderColor:isHoliday===v?(v?'var(--amber)':'var(--green)'):'var(--border)',
                background:isHoliday===v?(v?'rgba(230,81,0,0.08)':'rgba(46,125,50,0.08)'):'var(--s1)',
                color:isHoliday===v?(v?'var(--amber)':'var(--green)'):'var(--text3)',
                boxShadow:'var(--shadow)',
              }}>{v?'🌙 휴일':'☀️ 평일'}</button>
            ))}
          </div>
          <div style={{marginLeft:'auto',fontFamily:'var(--mono)',fontSize:12,color:'var(--text3)'}}>
            {formatDateFull(date)}
          </div>
        </div>
        {alreadyIn&&<div style={{marginTop:10,padding:'8px 12px',borderRadius:8,background:'rgba(232,160,0,0.08)',border:'1.5px solid rgba(232,160,0,0.2)',fontSize:12,color:'var(--cyan-dim)'}}>⚠️ 이미 입력된 날짜 — 덮어쓰기 가능</div>}
      </div>

      {/* Person grid */}
      <div>
        <p className="sec-label" style={{marginBottom:10}}>담당자 선택 ({activeMems.length}명)</p>
        <div className="person-grid">
          {activeMems.map(m=>{
            const pred=predMap[m.name], prob=pred?.prob??0
            const isTop=preds[0]?.person===m.name, isSel=selected===m.name
            const barW=maxProb>0?(prob/maxProb)*100:0
            const probColor=prob>=0.15?'var(--green)':prob>=0.08?'var(--cyan-dim)':'var(--text3)'
            return(
              <button key={m.name} onClick={()=>setSelected(m.name)} style={{
                display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:5,
                minHeight:isDesktop?80:72,padding:isDesktop?'12px 8px':'10px 6px',
                borderRadius:12,border:'1.5px solid',cursor:'pointer',
                borderColor:isSel?'var(--red)':isTop?'rgba(232,160,0,0.5)':'var(--border)',
                background:isSel?'rgba(198,40,40,0.06)':isTop?'rgba(232,160,0,0.04)':'var(--s1)',
                boxShadow:isSel?'0 0 0 3px rgba(198,40,40,0.12),var(--shadow)':'var(--shadow)',
                transition:'all 0.1s',
              }}>
                <span style={{fontSize:isDesktop?14:13,fontWeight:700,textAlign:'center',color:isSel?'var(--red)':'var(--text)'}}>{m.name}</span>
                <span style={{fontFamily:'var(--mono)',fontSize:isDesktop?12:11,fontWeight:700,color:probColor}}>{pct(prob)}</span>
                <div style={{width:'80%',height:3,background:'var(--s3)',borderRadius:2}}>
                  <div style={{width:`${barW}%`,height:'100%',background:isSel?'var(--red)':probColor,borderRadius:2,transition:'width 0.3s'}}/>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Save */}
      <button onClick={handleSave} disabled={!selected||saving} style={{
        width:'100%',height:isDesktop?54:50,borderRadius:12,border:'none',
        background:selected?'var(--red)':'var(--s3)',
        color:selected?'#fff':'var(--text3)',
        fontSize:isDesktop?17:15,fontWeight:800,cursor:selected?'pointer':'not-allowed',
        transition:'all 0.15s',boxShadow:selected?'0 4px 14px rgba(198,40,40,0.3)':'none',
      }}>{saving?'저장 중…':selected?`${selected} 저장 + 학습 ▶`:'담당자를 선택하세요'}</button>
    </div>
  )
}

function ResultView({result,onReset,isDesktop}){
  const{rank,predictions,newWeights,delta}=result
  const top5=predictions.slice(0,5)
  const rankColor=rank===1?'var(--green)':rank<=3?'var(--cyan-dim)':rank<=5?'var(--amber)':'var(--red)'
  const actualPred=predictions[rank-1]

  return(
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <div className="card" style={{padding:isDesktop?24:18,textAlign:'center'}}>
        <div style={{fontFamily:'var(--mono)',fontSize:isDesktop?52:40,fontWeight:900,color:rankColor,lineHeight:1}}>{rank}위</div>
        <div style={{color:'var(--text3)',fontSize:13,marginTop:6,fontFamily:'var(--mono)'}}>예측 확률 {actualPred?pct(actualPred.prob):'—'}</div>
        <div style={{display:'flex',gap:6,justifyContent:'center',marginTop:14,flexWrap:'wrap'}}>
          {top5.map((p,i)=>(
            <span key={p.person} style={{padding:'5px 10px',borderRadius:8,fontSize:12,fontFamily:'var(--mono)',fontWeight:700,
              background:i===rank-1?'rgba(46,125,50,0.1)':'var(--s2)',
              border:`1.5px solid ${i===rank-1?'var(--green)':'var(--border)'}`,
              color:i===rank-1?'var(--green)':'var(--text2)',
            }}>{i+1}.{p.person} {pct(p.prob)}</span>
          ))}
        </div>
      </div>
      <div className="card" style={{padding:isDesktop?18:14}}>
        <p className="sec-label" style={{marginBottom:12}}>가중치 변화</p>
        <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:8}}>
          {Object.entries(newWeights).map(([k,v])=>{
            const d=delta[k]??0,pos=d>0.0001,neg=d<-0.0001
            const labels={elapsed:'경과',fairness:'공정',recency:'최근',rot:'순번',dow:'요일'}
            return(
              <div key={k} style={{padding:'10px 8px',borderRadius:10,textAlign:'center',
                background:pos?'rgba(46,125,50,0.06)':neg?'rgba(198,40,40,0.06)':'var(--s2)',
                border:`1.5px solid ${pos?'rgba(46,125,50,0.2)':neg?'rgba(198,40,40,0.2)':'var(--border)'}`,
              }}>
                <div style={{fontSize:10,color:'var(--text3)',marginBottom:4}}>{labels[k]}</div>
                <div style={{fontFamily:'var(--mono)',fontWeight:800,fontSize:14}}>{(v*100).toFixed(1)}%</div>
                <div style={{fontFamily:'var(--mono)',fontSize:10,marginTop:2,color:pos?'var(--green)':neg?'var(--red)':'var(--text3)'}}>{pos?'+':''}{(d*100).toFixed(2)}</div>
              </div>
            )
          })}
        </div>
      </div>
      <button onClick={onReset} className="btn" style={{width:'100%',height:46}}>← 다음 입력</button>
    </div>
  )
}
