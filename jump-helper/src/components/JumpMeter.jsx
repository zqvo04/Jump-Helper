import { useMemo } from 'react'
import { computePredictions } from '../lib/prediction'
import { isHolidayDate, getTodayStr, offsetDateStr, formatDateKo, pct } from '../lib/utils'

export default function JumpMeter({ history, weights, members, dynamicROT }) {
  const today    = getTodayStr()
  const tomorrow = offsetDateStr(today, 1)
  const dayAfter = offsetDateStr(today, 2)

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

  // JUMP % = 1 - (나쁜 사람들의 예측 확률 합)
  // 나쁜 사람이 없으면 null (미설정 상태)
  const calcJump = (preds) => {
    if (badMembers.length === 0) return null
    const badProb = badMembers.reduce((s, m) => {
      return s + (preds.find(x => x.person === m.name)?.prob ?? 0)
    }, 0)
    return Math.max(0, 1 - badProb)
  }

  const jumpTomorrow = calcJump(predTomorrow)
  const jumpDayAfter = calcJump(predDayAfter)
  const hasBad = badMembers.length > 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {!hasBad && (
        <div style={{
          padding: 16, borderRadius: 12,
          background: 'rgba(232,160,0,0.08)', border: '1.5px solid rgba(232,160,0,0.2)',
          fontSize: 13, color: 'var(--cyan-dim)', textAlign: 'center', lineHeight: 1.7,
        }}>
          <strong>멤버 관리</strong> 탭에서 <strong>🍄 나쁜 사람</strong>을 지정하면<br/>
          JUMP % 계산이 시작됩니다 (나쁜 사람이 배정될 확률의 역수)
        </div>
      )}

      <div className="grid-2">
        <JumpCard
          label="내일" date={tomorrow} isHoliday={tomorrowHol}
          jumpPct={jumpTomorrow} badMembers={badMembers}
          predictions={predTomorrow} hasBad={hasBad}
        />
        <JumpCard
          label="모레" date={dayAfter} isHoliday={dayAfterHol}
          jumpPct={jumpDayAfter} badMembers={badMembers}
          predictions={predDayAfter} hasBad={hasBad}
        />
      </div>
    </div>
  )
}

function JumpCard({ label, date, isHoliday, jumpPct, badMembers, predictions, hasBad }) {
  const pct100    = jumpPct !== null ? Math.round(jumpPct * 100) : null
  const mood      = pct100 === null ? 'mid' : pct100 >= 60 ? 'high' : pct100 >= 30 ? 'mid' : 'low'
  const moodColor = mood === 'high' ? 'var(--green)' : mood === 'mid' ? 'var(--cyan-dim)' : 'var(--red)'

  // 나쁜 사람별 개별 확률
  const badProbs = badMembers.map(m => {
    const pred = predictions.find(x => x.person === m.name)
    return { name: m.name, prob: pred?.prob ?? 0, rank: predictions.findIndex(x => x.person === m.name) + 1 }
  }).sort((a, b) => b.prob - a.prob)

  const totalBadProb = badProbs.reduce((s, b) => s + b.prob, 0)

  return (
    <div className="card" style={{
      padding: 18, overflow: 'hidden', position: 'relative',
      borderColor: hasBad && pct100 !== null ? `${moodColor}50` : 'var(--border)',
    }}>
      {hasBad && pct100 !== null && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg,${moodColor},transparent)` }}/>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: 18, color: 'var(--text)' }}>{label}</div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
            {formatDateKo(date)} · {isHoliday ? '휴일' : '평일'}
          </div>
        </div>
        <span style={{
          padding: '5px 12px', borderRadius: 99, fontSize: 12, fontWeight: 800,
          background: isHoliday ? 'rgba(230,81,0,0.09)' : 'rgba(46,125,50,0.09)',
          color: isHoliday ? 'var(--amber)' : 'var(--green)',
          border: `1.5px solid ${isHoliday ? 'rgba(230,81,0,0.2)' : 'rgba(46,125,50,0.2)'}`,
        }}>{isHoliday ? '🌙 휴일' : '☀️ 평일'}</span>
      </div>

      {/* Character + % */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 16 }}>
        <JumpCharacter mood={hasBad ? mood : 'mid'} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4, fontWeight: 700 }}>JUMP %</div>
          <div style={{
            fontFamily: 'var(--mono)', fontWeight: 900, fontSize: 52, lineHeight: 1,
            color: hasBad && pct100 !== null ? moodColor : 'var(--text3)',
          }}>
            {hasBad && pct100 !== null ? pct100 : '—'}
            {hasBad && pct100 !== null && <span style={{ fontSize: 22, fontWeight: 600 }}>%</span>}
          </div>

          {hasBad && pct100 !== null && (
            <div style={{ marginTop: 10, height: 8, background: 'var(--s3)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 4, width: `${pct100}%`,
                background: moodColor, transition: 'width 0.8s cubic-bezier(.4,0,.2,1)',
                boxShadow: `0 0 10px ${moodColor}60`,
              }}/>
            </div>
          )}

          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>
            {hasBad
              ? `나쁜 사람 위험도 ${pct(totalBadProb)} 역산`
              : '나쁜 사람을 지정해주세요'}
          </div>
        </div>
      </div>

      {/* 나쁜 사람별 위험 확률 */}
      {hasBad && badProbs.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700, marginBottom: 2 }}>🍄 나쁜 사람 배정 위험도</div>
          {badProbs.map(b => {
            const danger = b.prob >= 0.2 ? 'var(--red)' : b.prob >= 0.1 ? 'var(--amber)' : 'var(--green)'
            return (
              <div key={b.name} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 12px', borderRadius: 10,
                background: b.prob >= 0.15 ? 'rgba(198,40,40,0.05)' : 'var(--s2)',
                border: `1.5px solid ${b.prob >= 0.15 ? 'rgba(198,40,40,0.2)' : 'var(--border)'}`,
              }}>
                <span style={{ fontSize: 14 }}>🍄</span>
                <span style={{ fontWeight: 700, fontSize: 14, flex: 1 }}>{b.name}</span>
                <span style={{
                  fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)',
                  background: 'var(--s3)', padding: '2px 8px', borderRadius: 6,
                }}>{b.rank}위</span>
                <span style={{ fontFamily: 'var(--mono)', fontWeight: 800, fontSize: 15, color: danger }}>
                  {pct(b.prob)}
                </span>
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
    <div style={{ width: 90, height: 90, flexShrink: 0 }}>
      {mood === 'high' && <CharHigh />}
      {mood === 'mid'  && <CharMid  />}
      {mood === 'low'  && <CharLow  />}
    </div>
  )
}

function CharHigh() {
  return (
    <svg viewBox="0 0 90 90" xmlns="http://www.w3.org/2000/svg" style={{ width:'100%', height:'100%' }}>
      <style>{`@keyframes jmp{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}.jumper{animation:jmp 0.7s ease-in-out infinite;transform-origin:45px 45px}`}</style>
      <g className="jumper">
        <circle cx="45" cy="25" r="14" fill="#2E7D32" stroke="#1B5E20" strokeWidth="1.5"/>
        <ellipse cx="40" cy="23" rx="3" ry="3.5" fill="#fff"/>
        <ellipse cx="50" cy="23" rx="3" ry="3.5" fill="#fff"/>
        <circle cx="41" cy="24" r="1.8" fill="#003a40"/>
        <circle cx="51" cy="24" r="1.8" fill="#003a40"/>
        <path d="M39 29 Q45 35 51 29" stroke="#003a40" strokeWidth="2" fill="none" strokeLinecap="round"/>
        <circle cx="37" cy="27" r="3" fill="rgba(255,100,100,0.3)"/>
        <circle cx="53" cy="27" r="3" fill="rgba(255,100,100,0.3)"/>
        <rect x="37" y="40" width="16" height="20" rx="5" fill="#2E7D32" stroke="#1B5E20" strokeWidth="1.5"/>
        <line x1="37" y1="44" x2="24" y2="33" stroke="#2E7D32" strokeWidth="4" strokeLinecap="round"/>
        <line x1="53" y1="44" x2="66" y2="33" stroke="#2E7D32" strokeWidth="4" strokeLinecap="round"/>
        <line x1="40" y1="60" x2="32" y2="75" stroke="#2E7D32" strokeWidth="4" strokeLinecap="round"/>
        <line x1="50" y1="60" x2="58" y2="75" stroke="#2E7D32" strokeWidth="4" strokeLinecap="round"/>
        <text x="30" y="18" fontSize="12" fill="#FFD700">★</text>
        <text x="54" y="15" fontSize="10" fill="#FFD700">★</text>
      </g>
    </svg>
  )
}

function CharMid() {
  return (
    <svg viewBox="0 0 90 90" xmlns="http://www.w3.org/2000/svg" style={{ width:'100%', height:'100%' }}>
      <style>{`@keyframes floatq{0%,100%{transform:translateY(0) rotate(-5deg)}50%{transform:translateY(-6px) rotate(5deg)}}.qmark{animation:floatq 1.5s ease-in-out infinite}`}</style>
      <text className="qmark" x="60" y="20" fontSize="18" fontWeight="700" fill="#E8A000">?</text>
      <circle cx="45" cy="28" r="15" fill="#E8A000" stroke="#C07800" strokeWidth="1.5"/>
      <ellipse cx="40" cy="26" rx="3" ry="3" fill="#fff"/>
      <ellipse cx="50" cy="26" rx="3" ry="3" fill="#fff"/>
      <circle cx="40.5" cy="27" r="1.8" fill="#3a2800"/>
      <circle cx="50.5" cy="27" r="1.8" fill="#3a2800"/>
      <path d="M39 33 Q42 31 45 33 Q48 35 51 33" stroke="#3a2800" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
      <rect x="37" y="44" width="16" height="20" rx="5" fill="#E8A000" stroke="#C07800" strokeWidth="1.5"/>
      <line x1="37" y1="50" x2="24" y2="52" stroke="#E8A000" strokeWidth="4" strokeLinecap="round"/>
      <line x1="53" y1="50" x2="66" y2="52" stroke="#E8A000" strokeWidth="4" strokeLinecap="round"/>
      <line x1="41" y1="64" x2="38" y2="80" stroke="#E8A000" strokeWidth="4" strokeLinecap="round"/>
      <line x1="49" y1="64" x2="52" y2="80" stroke="#E8A000" strokeWidth="4" strokeLinecap="round"/>
    </svg>
  )
}

function CharLow() {
  return (
    <svg viewBox="0 0 90 90" xmlns="http://www.w3.org/2000/svg" style={{ width:'100%', height:'100%' }}>
      <style>{`@keyframes rn{0%{transform:translateY(-5px);opacity:0}50%{opacity:0.8}100%{transform:translateY(20px);opacity:0}}.d1{animation:rn 1.2s ease-in infinite}.d2{animation:rn 1.2s ease-in infinite 0.4s}.d3{animation:rn 1.2s ease-in infinite 0.8s}`}</style>
      <ellipse className="d1" cx="20" cy="8" rx="2" ry="4" fill="#90CAF9" opacity="0.7"/>
      <ellipse className="d2" cx="32" cy="5" rx="2" ry="4" fill="#90CAF9" opacity="0.7"/>
      <ellipse className="d3" cx="14" cy="12" rx="1.5" ry="3" fill="#90CAF9" opacity="0.6"/>
      <ellipse cx="22" cy="16" rx="12" ry="7" fill="#90A4AE" opacity="0.5"/>
      <circle cx="45" cy="34" r="14" fill="#90A4AE" stroke="#607D8B" strokeWidth="1.5"/>
      <ellipse cx="40" cy="32" rx="3" ry="2.5" fill="#fff"/>
      <ellipse cx="50" cy="32" rx="3" ry="2.5" fill="#fff"/>
      <circle cx="40" cy="33" r="1.8" fill="#1a2530"/>
      <circle cx="50" cy="33" r="1.8" fill="#1a2530"/>
      <path d="M39 39 Q45 35 51 39" stroke="#1a2530" strokeWidth="2" fill="none" strokeLinecap="round"/>
      <rect x="37" y="49" width="16" height="18" rx="5" fill="#90A4AE" stroke="#607D8B" strokeWidth="1.5"/>
      <line x1="37" y1="53" x2="26" y2="63" stroke="#90A4AE" strokeWidth="4" strokeLinecap="round"/>
      <line x1="53" y1="53" x2="64" y2="63" stroke="#90A4AE" strokeWidth="4" strokeLinecap="round"/>
      <line x1="41" y1="67" x2="40" y2="82" stroke="#90A4AE" strokeWidth="4" strokeLinecap="round"/>
      <line x1="49" y1="67" x2="50" y2="82" stroke="#90A4AE" strokeWidth="4" strokeLinecap="round"/>
    </svg>
  )
}
