import { useState } from 'react'

// 이름으로 아바타 색 결정
const AVATAR_COLORS = ['#C62828','#1565C0','#2E7D32','#6A1B9A','#E65100','#0277BD','#4A148C','#558B2F']
function avatarColor(name) { return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length] }
function avatarInitial(name) { return name[0] }

// HP: 최근 활동도 (최근 30일 내 배정 비율)
function hpScore(history, name) {
  const recent = history.filter(h => h.person === name && h.date >= addDays(new Date().toISOString().split('T')[0], -90)).length
  const total  = history.filter(h => h.person === name).length
  return total === 0 ? 0 : Math.min(100, Math.round((recent / Math.max(total * 0.3, 1)) * 100))
}
function addDays(d, n) {
  const dt = new Date(d + 'T00:00:00'); dt.setDate(dt.getDate() + n)
  return dt.toISOString().split('T')[0]
}

export default function TabMembers({ members, history, addMember, toggleMemberActive, retireMember, setMemberType, isDesktop }) {
  const [newName,       setNewName]       = useState('')
  const [adding,        setAdding]        = useState(false)
  const [confirmRetire, setConfirmRetire] = useState(null)
  const [showAdd,       setShowAdd]       = useState(false)

  const active  = members.filter(m => !m.is_retired).sort((a,b) => (a.display_order??99)-(b.display_order??99))
  const retired = members.filter(m => m.is_retired)
  const goodCnt = active.filter(m => m.member_type==='good').length
  const badCnt  = active.filter(m => m.member_type==='bad').length
  const neutralCnt = active.length - goodCnt - badCnt

  async function handleAdd() {
    const name = newName.trim()
    if (!name) return
    if (members.some(m => m.name===name)) { alert('이미 존재합니다'); return }
    setAdding(true); await addMember(name); setNewName(''); setAdding(false); setShowAdd(false)
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
    <div style={{ display:'flex', flexDirection:'column', gap:18, position:'relative' }}>

      {/* ── 상태 카드 3개 ── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
        {[
          { label:'좋은 사람', sub:'활동적인 우수 멤버', cnt:goodCnt, icon:'⭐', iconBg:'#FFF8E1', iconColor:'#F9A825', bg:'#FFF', accent:'#2E7D32', barColor:'#4CAF50' },
          { label:'위험군',    sub:'주의가 필요한 멤버', cnt:badCnt,  icon:'🍄', iconBg:'#FFEBEE', iconColor:'#C62828', bg:'#FFF', accent:'#C62828', barColor:'#EF5350' },
          { label:'중립',      sub:'비활동 또는 대기',  cnt:neutralCnt, icon:'☁️', iconBg:'#E3F2FD', iconColor:'#1565C0', bg:'#FFF', accent:'#1565C0', barColor:'#42A5F5' },
        ].map(s => (
          <div key={s.label} style={{
            background:s.bg, borderRadius:14, padding:isDesktop?'20px 18px':'14px 12px',
            border:`1.5px solid ${s.accent}20`,
            boxShadow:`0 4px 16px ${s.accent}12`,
            display:'flex', flexDirection:'column', gap:8,
          }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
              <div style={{ width:44, height:44, borderRadius:12, background:s.iconBg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22 }}>
                {s.icon}
              </div>
              <div style={{ fontFamily:'var(--mono)', fontWeight:900, fontSize:isDesktop?32:24, color:s.accent, lineHeight:1 }}>
                {String(s.cnt).padStart(2,'0')}
              </div>
            </div>
            <div>
              <div style={{ fontWeight:900, fontSize:isDesktop?15:13, color:'var(--text)' }}>{s.label}</div>
              <div style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>{s.sub}</div>
            </div>
            <div style={{ height:4, background:`${s.accent}15`, borderRadius:2 }}>
              <div style={{ height:'100%', borderRadius:2, background:s.barColor, width:`${active.length>0?Math.round(s.cnt/active.length*100):0}%`, transition:'width 0.5s' }}/>
            </div>
          </div>
        ))}
      </div>

      {/* ── 멤버 리스트 ── */}
      <div className="card" style={{ overflow:'hidden' }}>
        {/* 리스트 헤더 */}
        <div style={{ background:'var(--red)', padding:'12px 18px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <span style={{ fontWeight:900, fontSize:14, color:'#FFF' }}>멤버 리스트</span>
          <div style={{ background:'rgba(255,255,255,0.15)', borderRadius:8, padding:'6px 12px', display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ color:'rgba(255,255,255,0.7)', fontSize:14 }}>🔍</span>
            <span style={{ color:'rgba(255,255,255,0.6)', fontSize:12 }}>{active.length}명 활성</span>
          </div>
        </div>

        {/* 안내 */}
        <div style={{ padding:'10px 18px', background:'var(--s2)', borderBottom:'1px solid var(--border)', fontSize:12, color:'var(--text3)', lineHeight:1.5 }}>
          분류 버튼 클릭 → <span style={{color:'var(--green)',fontWeight:700}}>⭐ 좋은 사람</span> → <span style={{color:'var(--red)',fontWeight:700}}>🍄 위험군</span> → 중립 순환
        </div>

        {/* 데스크탑: 테이블 / 모바일: 카드 */}
        {isDesktop ? (
          <table>
            <thead><tr>
              <th>멤버</th>
              <th>상태</th>
              <th>HP / 활동성</th>
              <th>분류</th>
              <th>액션</th>
            </tr></thead>
            <tbody>
              {active.map(m => {
                const hp = hpScore(history ?? [], m.name)
                const hpColor = hp >= 70 ? '#4CAF50' : hp >= 40 ? '#FFA726' : '#EF5350'
                const lastRec = (history ?? []).filter(h=>h.person===m.name).sort((a,b)=>b.date.localeCompare(a.date))[0]
                return (
                  <tr key={m.id}>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                        <div className="avatar" style={{ width:38, height:38, background:avatarColor(m.name), color:'#FFF', fontSize:16, fontWeight:900 }}>
                          {avatarInitial(m.name)}
                        </div>
                        <div>
                          <div style={{ fontWeight:800, fontSize:14 }}>{m.name}</div>
                          <div style={{ fontSize:11, color:'var(--text3)', fontFamily:'var(--mono)' }}>
                            LV {(history??[]).filter(h=>h.person===m.name).length}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={m.is_active ? 'badge-active' : 'badge-stunned'}>
                        {m.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ minWidth:140 }}>
                      <div style={{ fontSize:11, color:'var(--text3)', marginBottom:4, fontFamily:'var(--mono)' }}>
                        {hp}% · {lastRec ? lastRec.date : '—'}
                      </div>
                      <div className="hp-track">
                        <div className="hp-fill" style={{ width:`${hp}%`, background:hpColor }}/>
                      </div>
                    </td>
                    <td>
                      <button onClick={()=>cycleType(m)} style={{
                        padding:'5px 14px', borderRadius:20, fontSize:12, fontWeight:700, cursor:'pointer',
                        border:`1.5px solid ${m.member_type==='good'?'rgba(46,125,50,0.3)':m.member_type==='bad'?'rgba(198,40,40,0.3)':'var(--border)'}`,
                        background: m.member_type==='good'?'rgba(46,125,50,0.08)':m.member_type==='bad'?'rgba(198,40,40,0.07)':'var(--s2)',
                        color: m.member_type==='good'?'var(--green)':m.member_type==='bad'?'var(--red)':'var(--text3)',
                      }}>
                        {m.member_type==='good'?'⭐ 좋은':m.member_type==='bad'?'🍄 위험군':'중립'}
                      </button>
                    </td>
                    <td>
                      <div style={{ display:'flex', gap:6 }}>
                        <button onClick={()=>toggleMemberActive(m.id,!m.is_active)}
                          style={{ width:34, height:34, borderRadius:8, border:'1.5px solid var(--border)', background:'var(--s2)', color:'var(--text2)', cursor:'pointer', fontSize:15, display:'flex', alignItems:'center', justifyContent:'center' }}
                          title={m.is_active?'비활성화':'활성화'}>
                          {m.is_active?'⏸':'▶'}
                        </button>
                        <button onClick={()=>handleRetire(m.id)}
                          style={{ width:34, height:34, borderRadius:8, border:`1.5px solid ${confirmRetire===m.id?'var(--red)':'var(--border)'}`, background:confirmRetire===m.id?'rgba(198,40,40,0.07)':'var(--s2)', color:confirmRetire===m.id?'var(--red)':'var(--text3)', cursor:'pointer', fontSize:13, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center' }}
                          title="퇴직">
                          {confirmRetire===m.id?'✓':'✕'}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <div style={{ display:'flex', flexDirection:'column' }}>
            {active.map((m, idx) => {
              const hp = hpScore(history ?? [], m.name)
              const hpColor = hp >= 70 ? '#4CAF50' : hp >= 40 ? '#FFA726' : '#EF5350'
              return (
                <div key={m.id} style={{
                  display:'flex', alignItems:'center', gap:12, padding:'12px 16px',
                  borderBottom: idx < active.length-1 ? '1px solid var(--border)' : 'none',
                  opacity: m.is_active ? 1 : 0.55,
                }}>
                  <div className="avatar" style={{ width:40, height:40, background:avatarColor(m.name), color:'#FFF', fontSize:17, fontWeight:900, flexShrink:0 }}>
                    {avatarInitial(m.name)}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                      <span style={{ fontWeight:800, fontSize:14 }}>{m.name}</span>
                      <span className={m.is_active?'badge-active':'badge-stunned'} style={{ fontSize:10, padding:'1px 7px' }}>
                        {m.is_active?'Active':'Off'}
                      </span>
                      {m.is_new && <span className="pill pill-cyan" style={{ fontSize:9 }}>NEW</span>}
                    </div>
                    <div className="hp-track" style={{ height:5 }}>
                      <div className="hp-fill" style={{ width:`${hp}%`, background:hpColor }}/>
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:5, flexShrink:0 }}>
                    <button onClick={()=>cycleType(m)} style={{
                      height:30, padding:'0 10px', borderRadius:16, fontSize:11, fontWeight:700, cursor:'pointer',
                      border:`1.5px solid ${m.member_type==='good'?'rgba(46,125,50,0.3)':m.member_type==='bad'?'rgba(198,40,40,0.3)':'var(--border)'}`,
                      background: m.member_type==='good'?'rgba(46,125,50,0.07)':m.member_type==='bad'?'rgba(198,40,40,0.07)':'var(--s2)',
                      color: m.member_type==='good'?'var(--green)':m.member_type==='bad'?'var(--red)':'var(--text3)',
                    }}>{m.member_type==='good'?'⭐':m.member_type==='bad'?'🍄':'중립'}</button>
                    <button onClick={()=>toggleMemberActive(m.id,!m.is_active)}
                      style={{ width:30, height:30, borderRadius:7, border:'1.5px solid var(--border)', background:'var(--s2)', color:'var(--text2)', cursor:'pointer', fontSize:13, display:'flex', alignItems:'center', justifyContent:'center' }}>
                      {m.is_active?'⏸':'▶'}
                    </button>
                    <button onClick={()=>handleRetire(m.id)}
                      style={{ width:30, height:30, borderRadius:7, border:`1.5px solid ${confirmRetire===m.id?'var(--red)':'var(--border)'}`, background:confirmRetire===m.id?'rgba(198,40,40,0.07)':'var(--s2)', color:confirmRetire===m.id?'var(--red)':'var(--text3)', cursor:'pointer', fontSize:12, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center' }}>
                      {confirmRetire===m.id?'✓':'✕'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 퇴직자 */}
      {retired.length > 0 && (
        <div>
          <p className="sec-label" style={{ marginBottom:10 }}>퇴직 멤버 ({retired.length}명)</p>
          <div className="card" style={{ overflow:'hidden' }}>
            {retired.map((m,i) => (
              <div key={m.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 16px', opacity:0.5, borderBottom:i<retired.length-1?'1px solid var(--border)':'none' }}>
                <div className="avatar" style={{ width:32, height:32, background:'var(--s4)', border:'1.5px solid var(--border2)', color:'var(--text3)', fontSize:13, fontWeight:700 }}>
                  {avatarInitial(m.name)}
                </div>
                <span style={{ fontSize:14, fontWeight:600, color:'var(--text2)' }}>{m.name}</span>
                <span style={{ marginLeft:'auto', fontSize:11, color:'var(--text3)', fontFamily:'var(--mono)' }}>퇴직</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {confirmRetire && (
        <button onClick={()=>setConfirmRetire(null)} className="btn btn-ghost" style={{ fontSize:13 }}>취소</button>
      )}

      {/* ── FAB: 신규 멤버 추가 ── */}
      <div style={{ position:'fixed', bottom: isDesktop?32:24, right: isDesktop?40:20, zIndex:200 }}>
        {showAdd && (
          <div style={{
            position:'absolute', bottom:66, right:0,
            background:'var(--s1)', borderRadius:14, padding:16, width:240,
            boxShadow:'var(--sh-lg)', border:'1.5px solid var(--border)',
          }} className="fade-up">
            <div style={{ fontSize:13, fontWeight:800, color:'var(--text)', marginBottom:10 }}>신규 멤버 등록</div>
            <input value={newName} onChange={e=>setNewName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleAdd()}
              placeholder="이름 입력" className="input" style={{ height:40, fontSize:14 }}/>
            <button onClick={handleAdd} disabled={adding||!newName.trim()}
              className={`btn ${newName.trim()?'btn-green':''}`}
              style={{ width:'100%', marginTop:8, height:40, fontSize:13, minHeight:40 }}>
              {adding?'추가 중…':'+ 추가'}
            </button>
          </div>
        )}
        <button className="fab" onClick={()=>setShowAdd(v=>!v)} title="신규 멤버 등록">
          {showAdd ? '✕' : '+'}
        </button>
      </div>
    </div>
  )
}
