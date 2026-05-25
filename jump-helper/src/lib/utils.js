const CUSTOM_HOLIDAYS = new Set([
  '2026-03-20',
  '2026-04-03',
  '2026-05-01',
  '2026-05-04',
  '2026-05-05',
])

export function isHolidayDate(dateStr) {
  if (!dateStr) return false
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDay()
  return day === 0 || day === 6 || CUSTOM_HOLIDAYS.has(dateStr)
}

export function addCustomHoliday(dateStr) {
  CUSTOM_HOLIDAYS.add(dateStr)
}

export function getTodayStr() {
  return new Date().toISOString().split('T')[0]
}

export function offsetDateStr(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

export function dateDiffDays(fromStr, toStr) {
  const msPerDay = 1000 * 60 * 60 * 24
  return Math.round(
    (new Date(toStr + 'T00:00:00') - new Date(fromStr + 'T00:00:00')) / msPerDay
  )
}

const DAY_KO = ['일', '월', '화', '수', '목', '금', '토']

export function formatDateKo(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  const [y, m, day] = dateStr.split('-')
  return `${parseInt(m)}/${parseInt(day)} (${DAY_KO[d.getDay()]})`
}

export function formatDateFull(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  const [y, m, day] = dateStr.split('-')
  return `${y}.${m}.${day} (${DAY_KO[d.getDay()]})`
}

export function getYearMonth(dateStr) {
  return dateStr ? dateStr.slice(0, 7) : ''
}

export function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val))
}

export function pct(val, digits = 1) {
  return (val * 100).toFixed(digits) + '%'
}

export function signStr(val) {
  if (val > 0.0001) return '+' + (val * 100).toFixed(2)
  if (val < -0.0001) return (val * 100).toFixed(2)
  return '±0.00'
}
