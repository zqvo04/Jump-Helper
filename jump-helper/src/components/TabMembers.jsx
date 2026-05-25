import { useState } from 'react'

export default function TabMembers({ members, addMember, toggleMemberActive, retireMember }) {
  const [newName,        setNewName]        = useState('')
  const [adding,         setAdding]         = useState(false)
  const [confirmRetire,  setConfirmRetire]  = useState(null)

  const active  = members.filter(m => !m.is_retired).sort((a,b)=>(a.display_order||99)-(b.display_order||99))
  const retired = members.filter(m => m.is_retired)

  async function handleAdd() {
    const name = newName.trim()
    if (!name) return
    if (members.some(m => m.name === name)) { alert('이미 존재합니다'); return }
    setAdding(true)
    await addMember(name)
    setNewName('')
    setAdding(false)
  }

  async function handleRetire(id) {
    if (confirmRetire !== id) { setConfirmRetire(id); return }
    await retireMember(id)
    setConfirmRetire(null)
  }

  return (
    <div style={{ padding:'12px 14px', display:'flex', flexDirection:'column', gap:14 }}>

      {/* Add */}
      <div className="card" style={{ padding:12 }}>
        <p className="sec-label" style={{ marginBottom:10 }}>신규 멤버 추가</p>
        <div style={{ display:'flex', gap:8 }}>
          <input
            value={newName} onChange={e=>setNewName(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&handleAdd()}
            placeholder="이름 입력" className="input"
          />
          <button onClick={handleAdd} disabled={adding||!newName.trim()}
            className={`btn ${newName.trim()?'btn-primary':''}`}
            style={{ minWidth:64, height:48, flexShrink:0 }}>
            {adding ? '…' : '추가'}
          </button>
        </div>
      </div>

      {/* Active list */}
      <div>
        <p className="sec-label" style={{ marginBottom:10 }}>
          현직 멤버 ({active.length}명)
        </p>
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          {active.map(m => (
            <div key={m.id} className="card" style={{
              padding:'12px 14px', display:'flex',
              alignItems:'center', justifyContent:'space-between',
              opacity: m.is_active ? 1 : 0.55,
            }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ width:8, height:8, borderRadius:'50%', flexShrink:0,
                  background: m.is_active ? 'var(--green)' : 'var(--text3)',
                  boxShadow: m.is_active ? '0 0 6px var(--green)' : 'none',
                }}/>
                <span style={{ fontWeight:500, fontSize:15 }}>{m.name}</span>
                {m.is_new && (
                  <span className="pill pill-cyan" style={{ fontSize:10 }}>NEW</span>
                )}
              </div>
              <div style={{ display:'flex', gap:7 }}>
                <button onClick={()=>toggleMemberActive(m.id, !m.is_active)}
                  className="btn btn-ghost"
                  style={{ height:36, padding:'0 12px', fontSize:12, minHeight:36 }}>
                  {m.is_active ? '비활성' : '활성화'}
                </button>
                <button onClick={()=>handleRetire(m.id)}
                  style={{
                    height:36, padding:'0 12px', borderRadius:6, fontSize:12,
                    cursor:'pointer', border:'1px solid', minHeight:36,
                    borderColor: confirmRetire===m.id ? 'var(--red)' : 'var(--border)',
                    background: confirmRetire===m.id ? 'var(--red-mute)' : 'var(--s3)',
                    color: confirmRetire===m.id ? 'var(--red)' : 'var(--text3)',
                  }}>
                  {confirmRetire===m.id ? '확인?' : '퇴직'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Retired */}
      {retired.length > 0 && (
        <div>
          <p className="sec-label" style={{ marginBottom:10 }}>
            퇴직 멤버 ({retired.length}명)
          </p>
          <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
            {retired.map(m => (
              <div key={m.id} className="card" style={{
                padding:'10px 14px', display:'flex', alignItems:'center', gap:10, opacity:0.5,
              }}>
                <div style={{ width:7, height:7, borderRadius:'50%', background:'var(--text3)', flexShrink:0 }}/>
                <span style={{ fontSize:14, color:'var(--text2)' }}>{m.name}</span>
                <span style={{ marginLeft:'auto', fontSize:11, color:'var(--text3)', fontFamily:'var(--mono)' }}>
                  퇴직
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {confirmRetire && (
        <button onClick={()=>setConfirmRetire(null)} className="btn btn-ghost"
          style={{ width:'100%', fontSize:13 }}>
          취소
        </button>
      )}
    </div>
  )
}
