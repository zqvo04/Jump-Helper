import { useState, useMemo } from 'react'
import { computePredictions, ROT_ORDER } from '../lib/prediction'
import { isHolidayDate, getTodayStr, offsetDateStr, formatDateFull, pct } from '../lib/utils'

const F_LABELS=['경과','공정','최근','순번','요일']
const F_KEYS  =['f1','f2','f3','f4','f5']
const F_COLORS=['#1565C0','#2E7D32','#E8A000','#6A1B9A','#C62828']

export default function TabPrediction({ history, weights, members, dynamicROT, isDesktop }) {
  const today    = getTodayStr()
  const tomorrow = offsetDateStr(today,1)
  const dayAfter = offsetDateStr(today,2)
  const [target, setTarget] = useState(tomorrow)
  const isHol    = isHolidayDate(target)
  const active   = members.filter(m=>m.is_active&&!m.is_retired)

  const preds = useMemo(()=>computePredictions(target,isHol,history,active,weights,dynamicROT),[target,isHol,history,active,weights])

  const p1=preds[0]?.prob??0, gap=p1-(preds[1]?.prob??0)
  const [confLabel,confColor,confBg]=
    p1>=0.28&&gap>=0.12?['🟢 신뢰도 높음','var(--green)','rgba(46,125,50,0.07)']:
    p1>=0.18&&gap>=0.06?['🟡 신뢰도 보통','var(--cyan-dim)','rgba(232,160,0,0.07)']:
                        ['🔴 신뢰도 낮음','var(--red)','rgba(198,40,40,0.07)']

  const sameTypeSorted=[...history].filter(h=>h.is_holiday===isHol&&h.date<target).sort((a,b)=>a.date.localeCompare(b.date))
  const lastST=sameTypeSorted.at(-1)
  const prevIdx=lastST?dynamicROT.indexOf(lastST.person):-1
  const rotNext5=prevIdx!==-1?Array.from({length:5},(_,i)=>dynamicROT[(prevIdx+1+i)%dynamicROT.length]):dynamicROT.slice(0,5)

  return(
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      {/* Date + conf row */}
      <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
        {[tomorrow,dayAfter].map(d=>{
          const h=isHolidayDate(d),active=target===d
          return(
            <button key={d} onClick={()=>setTarget(d)} style={{
              height:44,padding:'0 18px',borderRadius:10,fontSize:13,fontWeight:700,cursor:'pointer',
              border:`1.5px solid ${active?'var(--red)':'var(--border)'}`,
              background:active?'rgba(198,40,40,0.06)':'var(--s1)',
              color:active?'var(--red)':'var(--text2)',
              boxShadow:'var(--shadow)',display:'flex',alignItems:'center',gap:8,
            }}>
              <span>{d===tomorrow?'내일':'모레'}</span>
              <span style={{fontFamily:'var(--mono)',fontSize:11,opacity:0.7}}>{d.slice(5).replace('-','/')}</span>
              {h&&<span style={{fontSize:10,color:'var(--amber)'}}>휴</span>}
            </button>
          )
        })}
        <div style={{flex:1,minWidth:140,padding:'9px 14px',borderRadius:10,background:confBg,border:`1.5px solid ${confColor}40`,fontSize:13,fontWeight:700,color:confColor}}>{confLabel}</div>
        <span style={{padding:'6px 12px',borderRadius:99,fontSize:12,fontWeight:800,background:isHol?'rgba(230,81,0,0.08)':'rgba(46,125,50,0.08)',color:isHol?'var(--amber)':'var(--green)',border:`1.5px solid ${isHol?'rgba(230,81,0,0.2)':'rgba(46,125,50,0.2)'}`}}>{isHol?'🌙 휴일':'☀️ 평일'}</span>
      </div>

      {/* Top 3 */}
      <div className="grid-3">
        {preds.slice(0,3).map((pred,i)=><PredCard key={pred.person} pred={pred} rank={i+1} isDesktop={isDesktop}/>)}
      </div>

      {/* 4-5위 */}
      {preds.length>3&&(
        <div className="card" style={{overflow:'hidden'}}>
          {preds.slice(3,5).map((pred,i)=>(
            <div key={pred.person} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 16px',borderBottom:i===0?'1px solid var(--border)':'none'}}>
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                <span style={{width:28,height:28,borderRadius:'50%',background:'var(--s3)',border:'1.5px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontFamily:'var(--mono)',fontWeight:700,color:'var(--text3)',flexShrink:0}}>{i+4}</span>
                <span style={{fontWeight:700,fontSize:15}}>{pred.person}</span>
              </div>
              <div style={{display:'flex',gap:14,alignItems:'center'}}>
                <span style={{fontFamily:'var(--mono)',fontSize:11,color:'var(--text3)'}}>경과 {pred.elapsedDays!=null?pred.elapsedDays+'d':'—'}</span>
                <span style={{fontFamily:'var(--mono)',fontWeight:800,fontSize:16,color:'var(--cyan-dim)'}}>{pct(pred.prob)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ROT 참고 */}
      <div className="card" style={{padding:14}}>
        <p className="sec-label" style={{marginBottom:8}}>기본 순번 참고 · 직전 {lastST?`${lastST.person} (${lastST.date.slice(5)})`:'—'}</p>
        <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
          {rotNext5.map((name,i)=>(
            <span key={name} style={{padding:'6px 12px',borderRadius:8,fontSize:13,fontWeight:i===0?800:600,
              background:i===0?'rgba(198,40,40,0.08)':'var(--s2)',
              border:`1.5px solid ${i===0?'rgba(198,40,40,0.3)':'var(--border)'}`,
              color:i===0?'var(--red)':'var(--text2)',
            }}>{i+1}. {name}</span>
          ))}
        </div>
      </div>
    </div>
  )
}

function PredCard({pred,rank,isDesktop}){
  const medals=['🥇','🥈','🥉']
  const fVals=F_KEYS.map(k=>pred.features[k]??0)
  const rankBorder=rank===1?'var(--cyan-dim)':'var(--border)'
  const rankBg=rank===1?'#FFFBF0':'var(--s1)'
  return(
    <div className="pred-card" style={{padding:isDesktop?18:14,background:rankBg,borderColor:rankBorder}}>
      {rank===1&&<div style={{position:'absolute',top:0,left:0,right:0,height:3,background:'linear-gradient(90deg,#FFD700,#E8A000,transparent)'}}/>}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <span style={{fontSize:isDesktop?30:24}}>{medals[rank-1]}</span>
          <div>
            <div style={{fontWeight:900,fontSize:isDesktop?20:17,color:'var(--text)'}}>{pred.person}</div>
            <div style={{fontSize:11,color:'var(--text3)',marginTop:1,fontFamily:'var(--mono)'}}>경과 {pred.elapsedDays!=null?pred.elapsedDays+'일':'기록없음'}</div>
          </div>
        </div>
        <div style={{fontFamily:'var(--mono)',fontWeight:900,fontSize:isDesktop?32:26,color:'var(--cyan-dim)'}}>{pct(pred.prob)}</div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr 1fr',gap:6}}>
        {F_LABELS.map((label,i)=>(
          <div key={label}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
              <span style={{fontSize:9,color:'var(--text3)',fontWeight:700}}>{label}</span>
              <span style={{fontFamily:'var(--mono)',fontSize:9,color:F_COLORS[i],fontWeight:700}}>{fVals[i].toFixed(2)}</span>
            </div>
            <div className="fbar"><div className="fbar-fill" style={{width:`${fVals[i]*100}%`,background:F_COLORS[i]}}/></div>
          </div>
        ))}
      </div>
    </div>
  )
}
