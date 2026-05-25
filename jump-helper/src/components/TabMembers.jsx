import { useState } from 'react'

export default function TabMembers({ members, addMember, toggleMemberActive, retireMember }) {
  const [newName, setNewName] = useState('')
  const [adding,  setAdding]  = useState(false)
  const [confirmRetire, setConfirmRetire] = useState(null)

  const activeMembers  = members.filter(m => !m.is_retired).sort((a, b) => (a.display_order || 99) - (b.display_order || 99))
  const retiredMembers = members.filter(m => m.is_retired)

  async function handleAdd() {
    const name = newName.trim()
    if (!name) return
    if (members.some(m => m.name === name)) {
      alert('이미 존재하는 이름입니다.')
      return
    }
    setAdding(true)
    await addMember(name)
    setNewName('')
    setAdding(false)
  }

  async function handleRetire(id, name) {
    if (confirmRetire !== id) { setConfirmRetire(id); return }
    await retireMember(id)
    setConfirmRetire(null)
  }

  return (
    <div style={{ padding:16, display:'flex', flexDirection:'column', gap:16 }}>
      {/* Add member */}
      <section className="card" style={{ padding:14 }}>
        <div style={{ fontSize:12, color:'var(--muted)', marginBottom:10, fontWeight:600 }}>신규 멤버 추가</div>
        <div style={{ display:'flex', gap:8 }}>
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="이름 입력"
            style={{
              flex:1, background:'var(--surface4)', border:'1px solid var(--border)',
              borderRadius:6, padding:'8px 12px', color:'var(--text)', fontSize:14,
            }}
          />
          <button
            onClick={handleAdd}
            disabled={adding || !newName.trim()}
            style={{
              padding:'8px 18px', borderRadius:6, border:'none',
              background: newName.trim() ? 'var(--accent)' : 'var(--surface4)',
              color: newName.trim() ? '#000' : 'var(--subtle)',
              fontWeight:600, cursor: newName.trim() ? 'pointer' : 'not-allowed',
              fontSize:13,
            }}>
            {adding ? '…' : '추가'}
          </button>
        </div>
      </section>

      {/* Active members */}
      <section>
        <div style={{ fontSize:12, color:'var(--muted)', marginBottom:10, fontWeight:600 }}>
          활성 멤버 ({activeMembers.length}명)
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          {activeMembers.map(m => (
            <div key={m.id} className="card" style={{
              padding:'10px 14px', display:'flex', alignItems:'center', justifyContent:'space-between',
              opacity: m.is_active ? 1 : 0.5,
            }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={{
                  width:8, height:8, borderRadius:'50%',
                  background: m.is_active ? 'var(--success)' : 'var(--subtle)',
                }}/>
                <span style={{ fontWeight:500 }}>{m.name}</span>
                {m.is_new && (
                  <span style={{
                    fontSize:10, padding:'1px 6px', borderRadius:99,
                    background:'rgba(0,229,255,0.12)', color:'var(--accent)',
                    border:'1px solid rgba(0,229,255,0.25)',
                  }}>NEW</span>
                )}
              </div>
              <div style={{ display:'flex', gap:6 }}>
                <button
                  onClick={() => toggleMemberActive(m.id, !m.is_active)}
                  style={{
                    padding:'4px 12px', borderRadius:6, fontSize:12,
                    border:'1px solid var(--border)', background:'var(--surface4)',
                    color:'var(--muted)', cursor:'pointer',
                  }}>
                  {m.is_active ? '비활성화' : '활성화'}
                </button>
                <button
                  onClick={() => handleRetire(m.id, m.name)}
                  style={{
                    padding:'4px 12px', borderRadius:6, fontSize:12,
                    border:`1px solid ${confirmRetire === m.id ? '#f85149' : 'var(--border)'}`,
                    background: confirmRetire === m.id ? 'rgba(248,81,73,0.15)' : 'var(--surface4)',
                    color: confirmRetire === m.id ? '#f85149' : 'var(--muted)',
                    cursor:'pointer',
                  }}>
                  {confirmRetire === m.id ? '확인?' : '퇴직'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Retired members */}
      {retiredMembers.length > 0 && (
        <section>
          <div style={{ fontSize:12, color:'var(--subtle)', marginBottom:10, fontWeight:600 }}>
            퇴직 멤버 ({retiredMembers.length}명) — 이력 보존
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
            {retiredMembers.map(m => (
              <div key={m.id} className="card" style={{
                padding:'8px 14px', display:'flex', alignItems:'center', gap:10, opacity:0.6,
              }}>
                <div style={{ width:8, height:8, borderRadius:'50%', background:'var(--subtle)' }}/>
                <span style={{ fontSize:13, color:'var(--muted)' }}>{m.name}</span>
                <span style={{ fontSize:11, color:'var(--subtle)', marginLeft:'auto' }}>퇴직</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Cancel confirm */}
      {confirmRetire && (
        <div style={{ textAlign:'center' }}>
          <button onClick={() => setConfirmRetire(null)} style={{
            fontSize:12, color:'var(--subtle)', background:'none', border:'none', cursor:'pointer',
          }}>취소</button>
        </div>
      )}
    </div>
  )
}
