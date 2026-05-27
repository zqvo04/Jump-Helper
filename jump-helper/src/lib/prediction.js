import { dateDiffDays, clamp } from './utils'

export const ROT_ORDER = [
  '김찬혁', '이상헌', '박민서', '김진영', '모준찬', '서희옥',
  '김영훈', '서동혁', '허진혁', '조영휘', '김경은', '장시은',
  '이규현', '이소연', '강체리', '박소영',
]

export const NON_ROT_MEMBERS = ['이동원', '배성재']
export const WEIGHTS_VERSION  = 'v5.1'
export const INITIAL_WEIGHTS  = { elapsed:0.22, fairness:0.40, recency:0.21, rot:0.03, dow:0.14 }

function rotDist(from, to) {
  const n = ROT_ORDER.length
  const fi = ROT_ORDER.indexOf(from), ti = ROT_ORDER.indexOf(to)
  if (fi===-1||ti===-1) return null
  const d = (ti - fi + n) % n
  return d === 0 ? n : d
}

// 최근성 가중 교환 테이블
// 최근 기록일수록 가중치 1.0→3.0 선형 증가
function buildSwapTable(sortedSameType) {
  if (sortedSameType.length < 8) return null
  const n = sortedSameType.length
  const counts = {}

  for (let i = 1; i < n; i++) {
    const prev = sortedSameType[i-1].person
    const curr = sortedSameType[i].person
    const pi   = ROT_ORDER.indexOf(prev)
    if (pi === -1) continue
    const expected = ROT_ORDER[(pi + 1) % ROT_ORDER.length]
    if (expected !== curr) {
      // 최근일수록 높은 가중치 (1.0 ~ 3.0)
      const w = 1 + (i / n) * 2
      if (!counts[expected]) counts[expected] = {}
      counts[expected][curr] = (counts[expected][curr] || 0) + w

      // 역방향도 절반 가중치로 기록
      // (A가 B 자리를 가져갔다면, B도 A와 자주 교환하는 관계)
      if (!counts[curr]) counts[curr] = {}
      counts[curr][expected] = (counts[curr][expected] || 0) + w * 0.5
    }
  }

  const table = {}
  for (const [exp, map] of Object.entries(counts)) {
    const total = Object.values(map).reduce((a, b) => a + b, 0)
    if (!total) continue
    table[exp] = {}
    for (const [p, cnt] of Object.entries(map)) table[exp][p] = cnt / total
  }
  return table
}

export function computePredictions(targetDate, isHoliday, history, activeMembers, weights) {
  const past           = history.filter(h => h.date < targetDate)
  const pastSorted     = [...past].sort((a, b) => a.date.localeCompare(b.date))
  const sameType       = past.filter(h => h.is_holiday === isHoliday)
  const sameTypeSorted = [...sameType].sort((a, b) => a.date.localeCompare(b.date))

  const members = activeMembers.filter(m => m.is_active && !m.is_retired)
  const N = members.length
  if (N === 0) return []

  const swapTable      = buildSwapTable(sameTypeSorted)
  const lastSameType   = sameTypeSorted.at(-1)
  const prevPerson     = lastSameType?.person ?? null
  const prevPersonIdx  = prevPerson ? ROT_ORDER.indexOf(prevPerson) : -1

  // ROT 예상 다음 사람 (교환 감지용)
  const rotExpectedNext = prevPersonIdx !== -1
    ? ROT_ORDER[(prevPersonIdx + 1) % ROT_ORDER.length]
    : null

  // F1: 팀 평균 경과일 (타입 무관)
  let totalElapsed = 0, elapsedN = 0
  for (const m of members) {
    const last = findLast(pastSorted, h => h.person === m.name)
    if (last) { totalElapsed += dateDiffDays(last.date, targetDate); elapsedN++ }
  }
  const teamAvg = elapsedN > 0 ? totalElapsed / elapsedN : 30

  // F2: 같은 타입 공정성
  const totalST        = sameType.length
  const expectedAssign = N > 0 ? totalST / N : 0

  // F3: 최근 21일
  const cut21 = addDays(targetDate, -21)
  const w21   = sameType.filter(h => h.date >= cut21 && h.date < targetDate)
  const exp21 = N > 0 ? w21.length / N : 0

  // F5: 요일별 공정성 (같은 타입 + 같은 요일)
  const targetDow = new Date(targetDate + 'T00:00:00').getDay()
  const sameDow   = sameType.filter(h => new Date(h.date + 'T00:00:00').getDay() === targetDow)
  const totalDow  = sameDow.length
  const expDow    = totalDow > 0 ? totalDow / N : 0

  const results = members.map(m => {
    const name = m.name

    // F1 elapsed
    const lastAny = findLast(pastSorted, h => h.person === name)
    const f1 = !lastAny
      ? 0.5
      : Math.min(dateDiffDays(lastAny.date, targetDate) / teamAvg, 3) / 3

    // F2 fairness
    const f2 = expectedAssign < 0.001
      ? 0.5
      : clamp(0.5 + (expectedAssign - sameType.filter(h => h.person === name).length) / (2 * expectedAssign), 0, 1)

    // F3 recency
    const cnt21 = w21.filter(h => h.person === name).length
    const f3    = exp21 < 0.05 ? 1 : 1 / (1 + cnt21 / exp21)

    // F4 rot + 교환 패턴
    let f4
    if (NON_ROT_MEMBERS.includes(name)) {
      f4 = 0.3
    } else if (prevPersonIdx === -1) {
      f4 = ROT_ORDER.indexOf(name) !== -1 ? 0.4 : 0.3
    } else {
      const dist = rotDist(prevPerson, name)
      if (dist === null) {
        f4 = 0.3
      } else {
        const base = Math.exp(-Math.pow(dist - 1, 2) / 72)
        let swapBonus = 0
        if (swapTable && rotExpectedNext) {
          // 직전 ROT 예상자 기준 교환 확률
          const swapsMap = swapTable[rotExpectedNext]
          if (swapsMap) swapBonus = (swapsMap[name] ?? 0) * 0.40
        }
        f4 = Math.min(1.0, base + swapBonus)
      }
    }

    // F5 day-of-week fairness
    let f5
    if (totalDow < 3) {
      f5 = 0.5  // 데이터 부족
    } else {
      const actualDow = sameDow.filter(h => h.person === name).length
      f5 = clamp(0.5 + (expDow - actualDow) / (2 * Math.max(expDow, 0.1)), 0, 1)
    }

    const w = weights
    const score = w.elapsed*f1 + w.fairness*f2 + w.recency*f3 + w.rot*f4 + (w.dow??0)*f5
    return {
      person: name, score,
      features: { f1, f2, f3, f4, f5 },
      elapsedDays: lastAny ? dateDiffDays(lastAny.date, targetDate) : null,
    }
  })

  const maxScore = Math.max(...results.map(r => r.score))
  const expVals  = results.map(r => Math.exp((r.score - maxScore) * 2.5))
  const sumExp   = expVals.reduce((a, b) => a + b, 0)

  return results
    .map((r, i) => ({ ...r, prob: expVals[i] / sumExp }))
    .sort((a, b) => b.prob - a.prob)
}

// ⑤ 확률 가중 기댓값으로 온라인 학습 개선
export function applyMLUpdate(weights, actualPerson, predictions) {
  const actualPred = predictions.find(p => p.person === actualPerson)
  if (!actualPred) return weights

  const errorRate = 1 - actualPred.prob
  const lr = 0.010 * (1 + errorRate * 1.5)

  // Top3 평균 대신 전체 확률 가중 기댓값 사용
  const expAvg = {
    f1: predictions.reduce((s, p) => s + p.prob * p.features.f1, 0),
    f2: predictions.reduce((s, p) => s + p.prob * p.features.f2, 0),
    f3: predictions.reduce((s, p) => s + p.prob * p.features.f3, 0),
    f4: predictions.reduce((s, p) => s + p.prob * p.features.f4, 0),
    f5: predictions.reduce((s, p) => s + p.prob * (p.features.f5 ?? 0.5), 0),
  }

  const steps = { elapsed:0.30, fairness:0.30, recency:0.25, rot:0.20, dow:0.25 }
  const featureMap = [
    ['elapsed','f1'], ['fairness','f2'], ['recency','f3'], ['rot','f4'], ['dow','f5']
  ]
  const af = actualPred.features
  const nw = { ...weights }

  for (const [wk, fk] of featureMap) {
    if (nw[wk] === undefined) continue
    const signal = (af[fk] ?? 0.5) >= expAvg[fk]
    if (signal) nw[wk] = Math.min(0.65, nw[wk] + lr * steps[wk])
    else        nw[wk] = Math.max(0.03, nw[wk] - lr * steps[wk] * 0.75)
  }

  const total = Object.values(nw).reduce((a, b) => a + b, 0)
  for (const k of Object.keys(nw)) nw[k] = nw[k] / total

  return nw
}

function findLast(arr, fn) {
  for (let i = arr.length - 1; i >= 0; i--) if (fn(arr[i])) return arr[i]
  return null
}
function addDays(s, n) {
  const d = new Date(s + 'T00:00:00'); d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}
