import { useMemo } from 'react'
import { computePredictions } from '../lib/prediction'
import { isHolidayDate, getTodayStr, offsetDateStr, formatDateKo, pct } from '../lib/utils'

export default function JumpMeter({ history, weights, members, dynamicROT }) {
  const today    = getTodayStr()
  const tomorrow = offsetDateStr(today, 1)
  const dayAfter = offsetDateStr(today, 2)

  const goodMembers = members.filter(m => m.member_type === 'good' && m.is_active && !m.is_retired)
  const badMembers  = members.filter(m => m.member_type === 'bad'  && m.is_active && !m.is_retired)
  const activeMems  = members.filter(m => m.is_active && !m.is_retired)

  const tomorrowHol = isHolidayDate(tomorrow)
  const dayAfterHol = isHolidayDate(dayAfter)

  const predTomorrow = useMemo(() =>
    computePredictions(tomorrow, tomorrowHol, history, activeMems, weights, dynamicROT),
    [tomorrow, tomorrowHol, history, activeMems, weights]
  )
  const predDayAfter = useMemo(() =>
    computePredictions(dayAfter, dayAfterHol, history, activeMems, weights, dynamicROT),
    [dayAfter, dayAfterHol, history, activeMems, weights]
  )

  const jumpTomorrow = goodMembers.reduce((sum, m) => {
    const p = predTomorrow.find(x => x.person === m.name)
    return sum + (p?.prob ?? 0)
  }, 0)

  const jumpDayAfter = goodMembers.reduce((sum, m) => {
    const p = predDayAfter.find(x => x.person === m.name)
    return sum + (p?.prob ?? 0)
  }, 0)

  const hasGood = goodMembers.length > 0

  return (
    <div style={{ padding:'14px', display:'flex', flexDirection:'column', gap:14 }}>
      {!hasGood && (
        <div style={{
          padding:'14px', borderRadius:10,
          background:'rgba(240,165,0,0.08)', border:'1px solid rgba(240,165,0,0.2)',
          fontSize:13, color:'var(--amber)', textAlign:'center', lineHeight:1.6,
        }}>
          멤버 탭에서 <strong>좋은 사람</strong>을 지정하면<br/>JUMP % 계산이 시작됩니다 😊
        </div>
      )}
      <JumpCard label="내일" date={tomorrow} isHoliday={tomorrowHol}
        jumpPct={jumpTomorrow} goodMembers={goodMembers} predictions={predTomorrow} hasGood={hasGood} />
      <JumpCard label="모레" date={dayAfter} isHoliday={dayAfterHol}
        jumpPct={jumpDayAfter} goodMembers={goodMembers} predictions={predDayAfter} hasGood={hasGood} />
      {badMembers.length > 0 && (
        <div className="card" style={{ padding:12 }}>
          <p className="sec-label" style={{ marginBottom:8 }}>나쁜 사람 위험도</p>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {badMembers.map(m => {
              const pt = predTomorrow.find(x => x.person === m.name)
              const pd = predDayAfter.find(x => x.person === m.name)
              const maxP = Math.max(pt?.prob ?? 0, pd?.prob ?? 0)
              const dc = maxP >= 0.2 ? 'var(--red)' : maxP >= 0.1 ? 'var(--amber)' : 'var(--text3)'
              return (
                <div key={m.name} style={{
                  display:'flex', alignItems:'center', justifyContent:'space-between',
                  padding:'8px 10px', borderRadius:8,
                  background: maxP >= 0.15 ? 'var(--red-mute)' : 'var(--s3)',
                  border:`1px solid ${maxP>=0.15?'rgba(255,68,68,0.2)':'var(--border)'}`,
                }}>
                  <span style={{ fontSize:14, fontWeight:500 }}>😈 {m.name}</span>
                  <div style={{ display:'flex', gap:8 }}>
                    <span style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--text3)' }}>내일 {pct(pt?.prob??0)}</span>
                    <span style={{ fontFamily:'var(--mono)', fontSize:12, fontWeight:700, color:dc }}>모레 {pct(pd?.prob??0)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function JumpCard({ label, date, isHoliday, jumpPct, goodMembers, predictions, hasGood }) {
  const pct100 = Math.round(jumpPct * 100)
  const mood = pct100 >= 50 ? 'high' : pct100 >= 20 ? 'mid' : 'low'
  const moodColor = mood==='high' ? 'var(--green)' : mood==='mid' ? 'var(--amber)' : 'var(--red)'

  return (
    <div className="card" style={{ padding:16, overflow:'hidden', position:'relative',
      borderColor: hasGood ? `${moodColor}40` : 'var(--border)' }}>
      {hasGood && (
        <div style={{ position:'absolute', top:0, left:0, right:0, height:2,
          background:`linear-gradient(90deg, ${moodColor}, transparent)` }}/>
      )}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <div>
          <div style={{ fontFamily:'var(--display)', fontWeight:800, fontSize:15, color:'var(--text2)' }}>{label}</div>
          <div style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--text3)', marginTop:2 }}>
            {formatDateKo(date)} · {isHoliday?'휴일':'평일'}
          </div>
        </div>
        <span className={`pill ${isHoliday?'pill-amber':'pill-cyan'}`}>{isHoliday?'휴일':'평일'}</span>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:20, marginBottom:14 }}>
        <JumpCharacter mood={hasGood ? mood : 'mid'} />
        <div style={{ flex:1 }}>
          <div style={{ fontSize:12, color:'var(--text3)', marginBottom:4, fontFamily:'var(--mono)' }}>JUMP %</div>
          <div style={{ fontFamily:'var(--mono)', fontWeight:800, fontSize:52, lineHeight:1,
            color: hasGood ? moodColor : 'var(--text3)' }}>
            {hasGood ? pct100 : '—'}
            {hasGood && <span style={{ fontSize:22, fontWeight:500 }}>%</span>}
          </div>
          {hasGood && (
            <div style={{ marginTop:8, height:6, background:'var(--s4)', borderRadius:3, overflow:'hidden' }}>
              <div style={{ height:'100%', borderRadius:3, width:`${pct100}%`, background:moodColor,
                transition:'width 0.8s cubic-bezier(.4,0,.2,1)', boxShadow:`0 0 8px ${moodColor}80` }}/>
            </div>
          )}
          <div style={{ fontSize:11, color:'var(--text3)', marginTop:6 }}>
            {hasGood ? `좋은 사람 ${goodMembers.length}명의 합산 확률` : '좋은 사람을 지정해주세요'}
          </div>
        </div>
      </div>
      {hasGood && (
        <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
          {goodMembers.map(m => {
            const pred = predictions.find(x => x.person === m.name)
            const p = pred?.prob ?? 0
            const rank = predictions.findIndex(x => x.person === m.name) + 1
            return (
              <div key={m.name} style={{ display:'flex', alignItems:'center', gap:8,
                padding:'7px 10px', borderRadius:8,
                background:`${moodColor}10`, border:`1px solid ${moodColor}25` }}>
                <span style={{ fontSize:13 }}>😊</span>
                <span style={{ fontWeight:600, fontSize:13, flex:1 }}>{m.name}</span>
                <span style={{ fontFamily:'var(--mono)', fontSize:10, color:'var(--text3)',
                  background:'var(--s4)', padding:'2px 6px', borderRadius:4 }}>{rank}위</span>
                <span style={{ fontFamily:'var(--mono)', fontWeight:700, fontSize:14, color:moodColor }}>{pct(p)}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function JumpCharacter({ mood }) {
  return (
    <div style={{ width:90, height:90, flexShrink:0 }}>
      {mood==='high' && <CharHigh />}
      {mood==='mid'  && <CharMid  />}
      {mood==='low'  && <CharLow  />}
    </div>
  )
}

function CharHigh() {
  return (
    <svg viewBox="0 0 90 90" xmlns="http://www.w3.org/2000/svg" style={{ width:'100%', height:'100%' }}>
      <style>{`
        @keyframes jmp { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
        @keyframes stspin { 0%{transform:rotate(0deg) scale(1);opacity:1} 100%{transform:rotate(360deg) scale(0);opacity:0} }
        .jumper{animation:jmp 0.7s ease-in-out infinite;transform-origin:45px 45px}
        .star1{animation:stspin 1.2s ease-in-out infinite;transform-origin:15px 20px}
        .star2{animation:stspin 1.2s ease-in-out infinite 0.4s;transform-origin:72px 18px}
        .star3{animation:stspin 1.2s ease-in-out infinite 0.8s;transform-origin:75px 40px}
      `}</style>
      <text className="star1" x="10" y="22" fontSize="12" fill="#f0a500">★</text>
      <text className="star2" x="67" y="20" fontSize="10" fill="#00c853">✦</text>
      <text className="star3" x="70" y="42" fontSize="8"  fill="#00d4e8">✦</text>
      <g className="jumper">
        <circle cx="45" cy="25" r="14" fill="#00d4e8" stroke="#009fb0" strokeWidth="1.5"/>
        <ellipse cx="40" cy="23" rx="3" ry="3.5" fill="#fff"/>
        <ellipse cx="50" cy="23" rx="3" ry="3.5" fill="#fff"/>
        <circle cx="41" cy="24" r="1.8" fill="#003a40"/>
        <circle cx="51" cy="24" r="1.8" fill="#003a40"/>
        <circle cx="42" cy="23" r="0.7" fill="#fff"/>
        <circle cx="52" cy="23" r="0.7" fill="#fff"/>
        <path d="M39 29 Q45 35 51 29" stroke="#003a40" strokeWidth="2" fill="none" strokeLinecap="round"/>
        <circle cx="37" cy="27" r="3" fill="rgba(255,100,100,0.3)"/>
        <circle cx="53" cy="27" r="3" fill="rgba(255,100,100,0.3)"/>
        <rect x="37" y="40" width="16" height="20" rx="5" fill="#00d4e8" stroke="#009fb0" strokeWidth="1.5"/>
        <line x1="37" y1="44" x2="24" y2="33" stroke="#00d4e8" strokeWidth="4" strokeLinecap="round"/>
        <line x1="53" y1="44" x2="66" y2="33" stroke="#00d4e8" strokeWidth="4" strokeLinecap="round"/>
        <line x1="40" y1="60" x2="32" y2="75" stroke="#00d4e8" strokeWidth="4" strokeLinecap="round"/>
        <line x1="50" y1="60" x2="58" y2="75" stroke="#00d4e8" strokeWidth="4" strokeLinecap="round"/>
        <ellipse cx="31" cy="76" rx="5" ry="3" fill="#009fb0"/>
        <ellipse cx="59" cy="76" rx="5" ry="3" fill="#009fb0"/>
      </g>
    </svg>
  )
}

function CharMid() {
  return (
    <svg viewBox="0 0 90 90" xmlns="http://www.w3.org/2000/svg" style={{ width:'100%', height:'100%' }}>
      <style>{`
        @keyframes floatq { 0%,100%{transform:translateY(0) rotate(-5deg);opacity:1} 50%{transform:translateY(-6px) rotate(5deg);opacity:0.7} }
        @keyframes blnk { 0%,90%,100%{transform:scaleY(1)} 95%{transform:scaleY(0.1)} }
        .qmark{animation:floatq 1.5s ease-in-out infinite;transform-origin:68px 14px}
        .eyesg{animation:blnk 3s ease-in-out infinite;transform-origin:45px 25px}
      `}</style>
      <text className="qmark" x="60" y="20" fontSize="18" fontWeight="700" fill="#f0a500">?</text>
      <circle cx="45" cy="28" r="15" fill="#f0a500" stroke="#c07800" strokeWidth="1.5"/>
      <g className="eyesg">
        <ellipse cx="40" cy="26" rx="3" ry="3" fill="#fff"/>
        <ellipse cx="50" cy="26" rx="3" ry="3" fill="#fff"/>
        <circle cx="40.5" cy="27" r="1.8" fill="#3a2800"/>
        <circle cx="50.5" cy="27" r="1.8" fill="#3a2800"/>
        <circle cx="41.2" cy="26.2" r="0.7" fill="#fff"/>
        <circle cx="51.2" cy="26.2" r="0.7" fill="#fff"/>
      </g>
      <path d="M37 21 Q40 19 43 21" stroke="#3a2800" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
      <path d="M47 21 Q50 19 53 21" stroke="#3a2800" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
      <path d="M39 33 Q42 31 45 33 Q48 35 51 33" stroke="#3a2800" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
      <rect x="37" y="44" width="16" height="20" rx="5" fill="#f0a500" stroke="#c07800" strokeWidth="1.5"/>
      <line x1="37" y1="50" x2="24" y2="52" stroke="#f0a500" strokeWidth="4" strokeLinecap="round"/>
      <line x1="53" y1="50" x2="66" y2="52" stroke="#f0a500" strokeWidth="4" strokeLinecap="round"/>
      <circle cx="23" cy="52" r="4" fill="#c07800"/>
      <circle cx="67" cy="52" r="4" fill="#c07800"/>
      <line x1="41" y1="64" x2="38" y2="80" stroke="#f0a500" strokeWidth="4" strokeLinecap="round"/>
      <line x1="49" y1="64" x2="52" y2="80" stroke="#f0a500" strokeWidth="4" strokeLinecap="round"/>
      <ellipse cx="37" cy="81" rx="5" ry="3" fill="#c07800"/>
      <ellipse cx="53" cy="81" rx="5" ry="3" fill="#c07800"/>
    </svg>
  )
}

function CharLow() {
  return (
    <svg viewBox="0 0 90 90" xmlns="http://www.w3.org/2000/svg" style={{ width:'100%', height:'100%' }}>
      <style>{`
        @keyframes rn { 0%{transform:translateY(-5px);opacity:0} 50%{opacity:0.8} 100%{transform:translateY(20px);opacity:0} }
        @keyframes swy { 0%,100%{transform:rotate(-3deg)} 50%{transform:rotate(3deg)} }
        .drop1{animation:rn 1.2s ease-in infinite;transform-origin:20px 5px}
        .drop2{animation:rn 1.2s ease-in infinite 0.4s;transform-origin:30px 5px}
        .drop3{animation:rn 1.2s ease-in infinite 0.8s;transform-origin:15px 5px}
        .bsway{animation:swy 2.5s ease-in-out infinite;transform-origin:45px 55px}
      `}</style>
      <ellipse className="drop1" cx="20" cy="8"  rx="2" ry="4" fill="#4488aa" opacity="0.7"/>
      <ellipse className="drop2" cx="32" cy="5"  rx="2" ry="4" fill="#4488aa" opacity="0.7"/>
      <ellipse className="drop3" cx="14" cy="12" rx="1.5" ry="3" fill="#4488aa" opacity="0.6"/>
      <ellipse cx="22" cy="16" rx="12" ry="7" fill="#445566" opacity="0.5"/>
      <ellipse cx="30" cy="14" rx="9"  ry="6" fill="#445566" opacity="0.5"/>
      <ellipse cx="16" cy="18" rx="8"  ry="5" fill="#445566" opacity="0.5"/>
      <g className="bsway">
        <circle cx="45" cy="34" r="14" fill="#667788" stroke="#445566" strokeWidth="1.5"/>
        <ellipse cx="40" cy="32" rx="3" ry="2.5" fill="#fff"/>
        <ellipse cx="50" cy="32" rx="3" ry="2.5" fill="#fff"/>
        <circle cx="40" cy="33" r="1.8" fill="#1a2530"/>
        <circle cx="50" cy="33" r="1.8" fill="#1a2530"/>
        <path d="M41 35 Q41 38 39.5 38.5 Q38 37 38.5 35.5 Z" fill="#4499cc" opacity="0.8"/>
        <path d="M37 27 Q40 29 43 27" stroke="#1a2530" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
        <path d="M47 27 Q50 29 53 27" stroke="#1a2530" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
        <path d="M39 39 Q45 35 51 39" stroke="#1a2530" strokeWidth="2" fill="none" strokeLinecap="round"/>
        <rect x="37" y="49" width="16" height="18" rx="5" fill="#667788" stroke="#445566" strokeWidth="1.5"/>
        <line x1="37" y1="53" x2="26" y2="63" stroke="#667788" strokeWidth="4" strokeLinecap="round"/>
        <line x1="53" y1="53" x2="64" y2="63" stroke="#667788" strokeWidth="4" strokeLinecap="round"/>
        <line x1="41" y1="67" x2="40" y2="82" stroke="#667788" strokeWidth="4" strokeLinecap="round"/>
        <line x1="49" y1="67" x2="50" y2="82" stroke="#667788" strokeWidth="4" strokeLinecap="round"/>
        <ellipse cx="39" cy="83" rx="5" ry="3" fill="#445566"/>
        <ellipse cx="51" cy="83" rx="5" ry="3" fill="#445566"/>
      </g>
    </svg>
  )
}
