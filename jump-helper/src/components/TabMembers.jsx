import { useState } from 'react'

export default function TabMembers({ members, addMember, toggleMemberActive, retireMember, setMemberType }) {
  const [newName,       setNewName]       = useState('')
  const [adding,        setAdding]        = useState(false)
  const [confirmRetire, setConfirmRetire] = useState(null)

  const active  = members.filter(m=>!m.is_retired).sort((a,b)=>(a.display_order||99)-(b.display_order||99))
  const retired = members.filter(m=>m.is_retired)
  const goodCount = active.filter(m=>m.member_type==='good').length
  const badCount  = active.filter(m=>m.member_type==='bad').length

  async function handleAdd() {
    const name = newName.trim()
    if (!name) return
    if (members.some(m=>m.name===name)) { alert('이미 존재합니다'); return }
    setAdding(true); await addMember(name); setNewName(''); setAdding(false)
  }

  async function handleRetire(id) {
    if (confirmRetire!==id) { setConfirmRetire(id); return }
    await retireMember(id); setConfirmRetire(null)
  }

  function cycleType(m) {
    const next = m.member_type===null?'good' : m.member_type==='good'?'bad' : null
    setMemberType(m.id, next)
  }

  return (
    <div style={{ padding:'12px 14px', display:'flex', flexDirection:'column', gap:14 }}>
      <div style={{ display:'flex', gap:8 }}>
        {[['😊 좋은 사람', goodCount, 'var(--green)', 'var(--green-mute)', 'rgba(0,200,83,0.25)'],
          ['😈 나쁜 사람', badCount,  'var(--red)',   'var(--red-mute)',   'rgba(255,68,68,0.25)'],
          ['중립',         active.length-goodCount-badCount, 'var(--text2)', 'var(--s3)', 'var(--border)']
        ].map(([label,count,color,bg,border])=>(
          <div key={label} style={{ flex:1, padding:'10px 12px', borderRadius:10, background:bg, border:`1px solid ${border}`, textAlign:'center' }}>
            <div style={{ fontFamily:'var(--mono)', fontWeight:700, fontSize:22, color, lineHeight:1 }}>{count}</div>
            <div style={{ fontSize:11, color, marginTop:2 }}>{label}</div>
          </div>
        ))}
      </div>

      <div style={{ fontSize:12, color:'var(--text3)', padding:'8px 12px', background:'var(--s2)', borderRadius:8, border:'1px solid var(--border)', lineHeight:1.7 }}>
        버튼을 눌러 분류 →  <span style={{color:'var(--green)'}}>😊 좋은 사람</span> → <span style={{color:'var(--red)'}}>😈 나쁜 사람</span> → 중립
      </div>

      <div className="card" style={{ padding:12 }}>
        <p className="sec-label" style={{ marginBottom:10 }}>신규 멤버 추가</p>
        <div style={{ display:'flex', gap:8 }}>
          <input value={newName} onChange={e=>setNewName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleAdd()} placeholder="이름 입력" className="input"/>
          <button onClick={handleAdd} disabled={adding||!newName.trim()} className={`btn ${newName.trim()?'btn-primary':''}`} style={{ minWidth:64, height:48, flexShrink:0 }}>
            {adding?'…':'추가'}
          </button>
        </div>
      </div>

      <div>
        <p className="sec-label" style={{ marginBottom:10 }}>현직 멤버 ({active.length}명)</p>
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          {active.map(m => (
            <div key={m.id} style={{
              display:'flex', alignItems:'center', justifyContent:'space-between',
              padding:'10px 14px', borderRadius:10, opacity:m.is_active?1:0.5,
              background: m.member_type==='good'?'rgba(0,200,83,0.05)':m.member_type==='bad'?'rgba(255,68,68,0.05)':'var(--s1)',
              border:`1px solid ${m.member_type==='good'?'rgba(0,200,83,0.2)':m.member_type==='bad'?'rgba(255,68,68,0.2)':'var(--border)'}`,
            }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ width:8, height:8, borderRadius:'50%', flexShrink:0, background:m.is_active?'var(--green)':'var(--text3)', boxShadow:m.is_active?'0 0 5px var(--green)':'none' }}/>
                <span style={{ fontWeight:600, fontSize:15 }}>{m.name}</span>
                {m.is_new && <span className="pill pill-cyan" style={{fontSize:10}}>NEW</span>}
              </div>
              <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                <button onClick={()=>cycleType(m)} style={{
                  height:32, padding:'0 12px', borderRadius:20, fontSize:12, fontWeight:600, cursor:'pointer', minHeight:32, transition:'all 0.15s',
                  border:`1.5px solid ${m.member_type==='good'?'rgba(0,200,83,0.35)':m.member_type==='bad'?'rgba(255,68,68,0.35)':'var(--border)'}`,
                  background: m.member_type==='good'?'var(--green-mute)':m.member_type==='bad'?'var(--red-mute)':'var(--s3)',
                  color: m.member_type==='good'?'var(--green)':m.member_type==='bad'?'var(--red)':'var(--text3)',
                }}>
                  {m.member_type==='good'?'😊 좋은':m.member_type==='bad'?'😈 나쁜':'중립'}
                </button>
                <button onClick={()=>toggleMemberActive(m.id,!m.is_active)} className="btn btn-ghost" style={{ height:32, padding:'0 10px', fontSize:11, minHeight:32 }}>
                  {m.is_active?'비활':'활성'}
                </button>
                <button onClick={()=>handleRetire(m.id)} style={{
                  height:32, padding:'0 10px', borderRadius:6, fontSize:11, cursor:'pointer', border:'1px solid', minHeight:32,
                  borderColor:confirmRetire===m.id?'var(--red)':'var(--border)',
                  background:confirmRetire===m.id?'var(--red-mute)':'var(--s3)',
                  color:confirmRetire===m.id?'var(--red)':'var(--text3)',
                }}>
                  {confirmRetire===m.id?'확인?':'퇴직'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {retired.length > 0 && (
        <div>
          <p className="sec-label" style={{ marginBottom:10 }}>퇴직 멤버 ({retired.length}명)</p>
          <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
            {retired.map(m=>(
              <div key={m.id} className="card" style={{ padding:'10px 14px', display:'flex', alignItems:'center', gap:10, opacity:0.5 }}>
                <div style={{ width:7, height:7, borderRadius:'50%', background:'var(--text3)', flexShrink:0 }}/>
                <span style={{ fontSize:14, color:'var(--text2)' }}>{m.name}</span>
                <span style={{ marginLeft:'auto', fontSize:11, color:'var(--text3)', fontFamily:'var(--mono)' }}>퇴직</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {confirmRetire && (
        <button onClick={()=>setConfirmRetire(null)} className="btn btn-ghost" style={{width:'100%',fontSize:13}}>취소</button>
      )}
    </div>
  )
}
