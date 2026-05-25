import { dateDiffDays, clamp } from './utils'

export const ROT_ORDER = [
  '김찬혁', '이상헌', '박민서', '김진영', '모준찬', '서희옥',
  '김영훈', '서동혁', '허진혁', '조영휘', '김경은', '장시은',
  '이규현', '이소연', '강체리', '박소영',
]

export const NON_ROT_MEMBERS = ['이동원', '배성재']
export const WEIGHTS_VERSION = 'v4.8'
export const INITIAL_WEIGHTS = { elapsed: 0.2757, fairness: 0.4135, recency: 0.2608, rot: 0.0500 }

// ROT circular distance from→to (1–16, never 0)
function rotDist(from, to) {
  const n = ROT_ORDER.length
  const fi = ROT_ORDER.indexOf(from)
  const ti = ROT_ORDER.indexOf(to)
  if (fi === -1 || ti === -1) return null
  const d = (ti - fi + n) % n
  return d === 0 ? n : d
}

// Build normalized swap probability table from same-type history (sorted asc)
function buildSwapTable(sortedSameType) {
  if (sortedSameType.length < 8) return null

  const counts = {}
  for (let i = 1; i < sortedSameType.length; i++) {
    const prev = sortedSameType[i - 1].person
    const curr = sortedSameType[i].person
    const pi = ROT_ORDER.indexOf(prev)
    if (pi === -1) continue
    const expected = ROT_ORDER[(pi + 1) % ROT_ORDER.length]
    if (expected !== curr) {
      if (!counts[expected]) counts[expected] = {}
      counts[expected][curr] = (counts[expected][curr] || 0) + 1
    }
  }

  // Normalize per expected key
  const table = {}
  for (const [exp, map] of Object.entries(counts)) {
    const total = Object.values(map).reduce((a, b) => a + b, 0)
    if (total === 0) continue
    table[exp] = {}
    for (const [p, cnt] of Object.entries(map)) {
      table[exp][p] = cnt / total
    }
  }
  return table
}

/**
 * Compute ranked predictions for a given date.
 * @param {string} targetDate  ISO date string
 * @param {boolean} isHoliday
 * @param {Array}  history     All known records { date, person, is_holiday }
 * @param {Array}  activeMembers  Array of { name, is_active, is_retired }
 * @param {Object} weights    { elapsed, fairness, recency, rot }
 * @returns {Array} Sorted [{person, prob, score, features:{f1,f2,f3,f4}, elapsedDays}]
 */
export function computePredictions(targetDate, isHoliday, history, activeMembers, weights) {
  // Only history strictly before targetDate
  const past = history.filter(h => h.date < targetDate)
  const pastSorted = [...past].sort((a, b) => a.date.localeCompare(b.date))

  const sameType = past.filter(h => h.is_holiday === isHoliday)
  const sameTypeSorted = [...sameType].sort((a, b) => a.date.localeCompare(b.date))

  const members = activeMembers.filter(m => m.is_active && !m.is_retired)
  const N = members.length
  if (N === 0) return []

  const swapTable = buildSwapTable(sameTypeSorted)
  const lastSameType = sameTypeSorted[sameTypeSorted.length - 1]
  const prevPerson = lastSameType?.person ?? null
  const prevPersonIdx = prevPerson ? ROT_ORDER.indexOf(prevPerson) : -1

  // ── F1: team avg elapsed (all types) ────────────────────────────────
  let totalElapsed = 0; let elapsedN = 0
  for (const m of members) {
    const last = findLast(pastSorted, h => h.person === m.name)
    if (last) { totalElapsed += dateDiffDays(last.date, targetDate); elapsedN++ }
  }
  const teamAvg = elapsedN > 0 ? totalElapsed / elapsedN : 30

  // ── F2 denominators ─────────────────────────────────────────────────
  const totalST = sameType.length
  const expectedAssign = N > 0 ? totalST / N : 0

  // ── F3: recent 21-day window ─────────────────────────────────────────
  const cut21 = addDays(targetDate, -21)
  const w21 = sameType.filter(h => h.date >= cut21 && h.date < targetDate)
  const exp21 = N > 0 ? w21.length / N : 0

  const results = members.map(m => {
    const name = m.name

    // F1 elapsed
    const lastAny = findLast(pastSorted, h => h.person === name)
    let f1
    if (!lastAny) {
      f1 = 0.5
    } else {
      const elapsed = dateDiffDays(lastAny.date, targetDate)
      f1 = Math.min(elapsed / teamAvg, 3) / 3
    }

    // F2 fairness
    let f2
    if (expectedAssign < 0.001) {
      f2 = 0.5
    } else {
      const actual = sameType.filter(h => h.person === name).length
      f2 = clamp(0.5 + (expectedAssign - actual) / (2 * expectedAssign), 0, 1)
    }

    // F3 recency
    let f3
    if (exp21 < 0.05) {
      f3 = 1
    } else {
      const cnt21 = w21.filter(h => h.person === name).length
      f3 = 1 / (1 + cnt21 / exp21)
    }

    // F4 rot
    let f4
    if (NON_ROT_MEMBERS.includes(name)) {
      f4 = 0.3
    } else if (prevPersonIdx === -1) {
      // No previous same-type person or prev not in ROT → neutral
      const myIdx = ROT_ORDER.indexOf(name)
      f4 = myIdx !== -1 ? 0.4 : 0.3
    } else {
      const dist = rotDist(prevPerson, name)
      if (dist === null) {
        f4 = 0.3
      } else {
        const base = Math.exp(-Math.pow(dist - 1, 2) / 72)
        let swapBonus = 0
        if (swapTable) {
          const expectedNext = ROT_ORDER[(prevPersonIdx + 1) % ROT_ORDER.length]
          const swapsMap = swapTable[expectedNext]
          if (swapsMap) {
            swapBonus = (swapsMap[name] ?? 0) * 0.40
          }
        }
        f4 = Math.min(1.0, base + swapBonus)
      }
    }

    const score =
      weights.elapsed * f1 +
      weights.fairness * f2 +
      weights.recency * f3 +
      weights.rot * f4

    return {
      person: name,
      score,
      features: { f1, f2, f3, f4 },
      elapsedDays: lastAny ? dateDiffDays(lastAny.date, targetDate) : null,
    }
  })

  // Softmax T=2.5 (multiplier in exponent)
  const maxScore = Math.max(...results.map(r => r.score))
  const expVals = results.map(r => Math.exp((r.score - maxScore) * 2.5))
  const sumExp = expVals.reduce((a, b) => a + b, 0)

  return results
    .map((r, i) => ({ ...r, prob: expVals[i] / sumExp }))
    .sort((a, b) => b.prob - a.prob)
}

/**
 * Apply online ML weight update given actual person and prediction list.
 * @returns {Object} newWeights
 */
export function applyMLUpdate(weights, actualPerson, predictions) {
  const actualPred = predictions.find(p => p.person === actualPerson)
  if (!actualPred) return weights

  const errorRate = 1 - actualPred.prob
  const lr = 0.010 * (1 + errorRate * 1.5)

  // Reference: average feature values of top-3 predictions
  const topK = predictions.slice(0, Math.min(3, predictions.length))
  const topAvg = {
    f1: topK.reduce((s, p) => s + p.features.f1, 0) / topK.length,
    f2: topK.reduce((s, p) => s + p.features.f2, 0) / topK.length,
    f3: topK.reduce((s, p) => s + p.features.f3, 0) / topK.length,
    f4: topK.reduce((s, p) => s + p.features.f4, 0) / topK.length,
  }

  const steps = { elapsed: 0.30, fairness: 0.30, recency: 0.25, rot: 0.20 }
  const featureKeys = [['elapsed', 'f1'], ['fairness', 'f2'], ['recency', 'f3'], ['rot', 'f4']]
  const af = actualPred.features

  const nw = { ...weights }
  for (const [wk, fk] of featureKeys) {
    const signal = af[fk] >= topAvg[fk]
    if (signal) {
      nw[wk] = Math.min(0.65, nw[wk] + lr * steps[wk])
    } else {
      nw[wk] = Math.max(0.03, nw[wk] - lr * steps[wk] * 0.75)
    }
  }

  // Normalize to sum=1
  const total = Object.values(nw).reduce((a, b) => a + b, 0)
  for (const k of Object.keys(nw)) nw[k] = nw[k] / total

  return nw
}

// ── helpers ──────────────────────────────────────────────────────────────────

function findLast(sortedArr, predFn) {
  for (let i = sortedArr.length - 1; i >= 0; i--) {
    if (predFn(sortedArr[i])) return sortedArr[i]
  }
  return null
}

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}
