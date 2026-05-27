import { useState } from 'react'

const TYPE_CFG = {
  good: { label:'⭐ 좋은 사람', color:'var(--green)',  bg:'rgba(46,125,50,0.08)',  border:'rgba(46,125,50,0.25)' },
  bad:  { label:'🍄 나쁜 사람', color:'var(--red)',    bg:'rgba(198,40,40,0.07)',  border:'rgba(198,40,40,0.22)' },
  null: { label:'중립',          color:'var(--text3)', bg:'var(--s2)',             border:'var(--border)' },
}

export default function TabMembers({ members, addMember, toggleMemberActive, retireMember, setMemberType, isDesktop }) {
  const [newName, setNewName]             = useState('')
  const [adding,  setAdding]              = useState(false)
  const [confirmRetire, setConfirmRetire] = useState(null)

  const active  = members.filter(m=>!m.is_retired).sort((a,b)=>(a.display_order??99)-(b.display_order??99))
  const retired = members.filter(m=>m.is_retired)
  const goodCnt = active.filter(m=>m.member_type==='good').length
  const badCnt  = active.filter(m=>m.member_type==='bad').length
  const neutralCnt = active.length-goodCnt-badCnt

  async function handleAdd(){
    const name=newName.trim()
    if(!name) return
    if(members.some(m=>m.name===name)){alert('이미 존재합니다');return}
    setAdding(true); await addMember(name); setNewName(''); setAdding(false)
  }
  async function handleRetire(id){
    if(confirmRetire!==id){setConfirmRetire(id);return}
    await retireMember(id); setConfirmRetire(null)
  }
  function cycleType(m){
    const next=m.member_type===null?'good':m.member_type==='good'?'bad':null
    setMemberType(m.id,next)
  }

  return(
    <div style={{display:'flex',flexDirection:'column',gap:16}}>
      {/* Status cards */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10}}>
        {[
          ['⭐ 좋은 사람',goodCnt,'var(--good-bg)','rgba(46,125,50,0.08)','rgba(46,125,50,0.2)'],
          ['🍄 나쁜 사람',badCnt,'var(--bad-bg)','rgba(198,40,40,0.07)','rgba(198,40,40,0.2)'],
          ['⚪ 중립',neutralCnt,'#607D8B','var(--s2)','var(--border)'],
        ].map(([label,cnt,color,bg,border])=>(
          <div key={label} style={{padding:isDesktop?'18px 16px':'14px 12px',borderRadius:14,background:bg,border:`1.5px solid ${border}`,textAlign:'center',boxShadow:'var(--shadow)'}}>
            <div style={{fontFamily:'var(--mono)',fontWeight:900,fontSize:isDesktop?32:24,color,lineHeight:1}}>{cnt}</div>
            <div style={{fontSize:isDesktop?13:11,color,marginTop:6,fontWeight:700}}>{label}</div>
          </div>
        ))}
      </div>

      {/* Add */}
      <div className="card" style={{padding:isDesktop?16:12}}>
        <p className="sec-label" style={{marginBottom:10}}>신규 멤버 추가</p>
        <div style={{display:'flex',gap:8}}>
          <input value={newName} onChange={e=>setNewName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleAdd()} placeholder="이름 입력" className="input"/>
          <button onClick={handleAdd} disabled={adding||!newName.trim()} className={`btn ${newName.trim()?'btn-primary':''}`} style={{minWidth:70,height:46,flexShrink:0}}>
            {adding?'…':'+ 추가'}
          </button>
        </div>
      </div>

      {/* 안내 */}
      <div style={{fontSize:12,color:'var(--text3)',padding:'8px 14px',background:'var(--s1)',borderRadius:10,border:'1.5px solid var(--border)',lineHeight:1.7}}>
        버튼 클릭 → <span style={{color:'var(--green)',fontWeight:700}}>⭐ 좋은 사람</span> → <span style={{color:'var(--red)',fontWeight:700}}>🍄 나쁜 사람</span> → 중립 순환
      </div>

      {/* Member list */}
      <div>
        <p className="sec-label" style={{marginBottom:10}}>현직 멤버 ({active.length}명)</p>
        {isDesktop?(
          /* Desktop: table */
          <div className="card table-wrap">
            <table>
              <thead><tr>
                <th>이름</th><th>구분</th><th>상태</th><th>분류</th><th>관리</th>
              </tr></thead>
              <tbody>
                {active.map(m=>{
                  const tc=TYPE_CFG[m.member_type??'null']??TYPE_CFG['null']
                  return(
                    <tr key={m.id}>
                      <td>
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          <div style={{width:8,height:8,borderRadius:'50%',background:m.is_active?'var(--green)':'var(--text3)',boxShadow:m.is_active?'0 0 5px var(--green)':'none'}}/>
                          <span style={{fontWeight:700}}>{m.name}</span>
                          {m.is_new&&<span className="pill pill-green" style={{fontSize:10}}>NEW</span>}
                        </div>
                      </td>
                      <td style={{fontSize:12,color:'var(--text3)'}}>{m.is_active?'활성':'비활성'}</td>
                      <td>
                        <div style={{width:80,height:6,background:'var(--s3)',borderRadius:3}}>
                          <div style={{height:'100%',borderRadius:3,width:m.is_active?'100%':'30%',background:m.is_active?'var(--green)':'var(--text3)',transition:'width 0.3s'}}/>
                        </div>
                      </td>
                      <td>
                        <button onClick={()=>cycleType(m)} style={{padding:'5px 12px',borderRadius:8,fontSize:12,fontWeight:700,cursor:'pointer',border:`1.5px solid ${tc.border}`,background:tc.bg,color:tc.color}}>
                          {m.member_type==='good'?'⭐ 좋은':m.member_type==='bad'?'🍄 나쁜':'중립'}
                        </button>
                      </td>
                      <td>
                        <div style={{display:'flex',gap:6}}>
                          <button onClick={()=>toggleMemberActive(m.id,!m.is_active)} className="btn btn-ghost" style={{height:32,padding:'0 12px',fontSize:12,minHeight:32}}>
                            {m.is_active?'비활성':'활성화'}
                          </button>
                          <button onClick={()=>handleRetire(m.id)} style={{height:32,padding:'0 12px',borderRadius:8,fontSize:12,fontWeight:700,cursor:'pointer',border:'1.5px solid',minHeight:32,borderColor:confirmRetire===m.id?'var(--red)':'var(--border)',background:confirmRetire===m.id?'rgba(198,40,40,0.08)':'var(--s1)',color:confirmRetire===m.id?'var(--red)':'var(--text3)'}}>
                            {confirmRetire===m.id?'확인?':'퇴직'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ):(
          /* Mobile: cards */
          <div style={{display:'flex',flexDirection:'column',gap:6}}>
            {active.map(m=>{
              const tc=TYPE_CFG[m.member_type??'null']??TYPE_CFG['null']
              return(
                <div key={m.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 14px',borderRadius:12,background:m.member_type==='good'?'rgba(46,125,50,0.04)':m.member_type==='bad'?'rgba(198,40,40,0.04)':'var(--s1)',border:`1.5px solid ${m.member_type==='good'?'rgba(46,125,50,0.15)':m.member_type==='bad'?'rgba(198,40,40,0.15)':'var(--border)'}`,boxShadow:'var(--shadow)',opacity:m.is_active?1:0.55}}>
                  <div style={{display:'flex',alignItems:'center',gap:10}}>
                    <div style={{width:8,height:8,borderRadius:'50%',flexShrink:0,background:m.is_active?'var(--green)':'var(--text3)',boxShadow:m.is_active?'0 0 5px var(--green)':'none'}}/>
                    <span style={{fontWeight:700,fontSize:15}}>{m.name}</span>
                    {m.is_new&&<span className="pill pill-green" style={{fontSize:10}}>NEW</span>}
                  </div>
                  <div style={{display:'flex',gap:5}}>
                    <button onClick={()=>cycleType(m)} style={{height:32,padding:'0 10px',borderRadius:20,fontSize:11,fontWeight:700,cursor:'pointer',border:`1.5px solid ${tc.border}`,background:tc.bg,color:tc.color,minHeight:32}}>
                      {m.member_type==='good'?'⭐ 좋은':m.member_type==='bad'?'🍄 나쁜':'중립'}
                    </button>
                    <button onClick={()=>toggleMemberActive(m.id,!m.is_active)} className="btn btn-ghost" style={{height:32,padding:'0 8px',fontSize:11,minHeight:32}}>{m.is_active?'비활':'활성'}</button>
                    <button onClick={()=>handleRetire(m.id)} style={{height:32,padding:'0 8px',borderRadius:8,fontSize:11,fontWeight:700,cursor:'pointer',border:'1.5px solid',minHeight:32,borderColor:confirmRetire===m.id?'var(--red)':'var(--border)',background:confirmRetire===m.id?'rgba(198,40,40,0.08)':'var(--s1)',color:confirmRetire===m.id?'var(--red)':'var(--text3)'}}>
                      {confirmRetire===m.id?'확인?':'퇴직'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {retired.length>0&&(
        <div>
          <p className="sec-label" style={{marginBottom:10}}>퇴직 멤버 ({retired.length}명)</p>
          <div className="card" style={{overflow:'hidden'}}>
            {retired.map((m,i)=>(
              <div key={m.id} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',opacity:0.5,borderBottom:i<retired.length-1?'1px solid var(--border)':'none'}}>
                <div style={{width:7,height:7,borderRadius:'50%',background:'var(--text3)',flexShrink:0}}/>
                <span style={{fontSize:14,color:'var(--text2)',fontWeight:600}}>{m.name}</span>
                <span style={{marginLeft:'auto',fontSize:11,color:'var(--text3)',fontFamily:'var(--mono)'}}>퇴직</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {confirmRetire&&<button onClick={()=>setConfirmRetire(null)} className="btn btn-ghost" style={{width:'100%',fontSize:13}}>취소</button>}
    </div>
  )
}
