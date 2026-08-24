export const REFERENCE_DISPLAY_MS = 1500;
export const MAX_TURNS = 5;
export const MIN_CANDIDATE_PERCENT = 8;
export const MAX_CANDIDATE_PERCENT = 65;

export type Point = { x: number; y: number };
export type ShapeDefinition = { centerX: number; centerY: number; points: Point[]; area: number; seed: number };
export type CandidateDefinition = { percent: number; shape: ShapeDefinition };
export type RoundDefinition = { seed: number; reference: ShapeDefinition; candidates: CandidateDefinition[] };
export type GameOutcome = 'continue' | 'perfect' | 'bust' | 'turns-exhausted';
export type GameEvaluation = { total: number; turnsUsed: number; outcome: GameOutcome; difference: number };
export type BalanceSimulation = {
  bustCandidateRate: number;
  perfectRate: number;
  averageFinal: number;
  averageTurns: number;
  allBustRate: number;
};

function mulberry32(seed: number) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function clampInteger(value: number, minimum = MIN_CANDIDATE_PERCENT, maximum = MAX_CANDIDATE_PERCENT) {
  return Math.max(minimum, Math.min(maximum, Math.round(value)));
}

export function polygonArea(points: Point[]): number {
  let sum = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    sum += current.x * next.y - next.x * current.y;
  }
  return Math.abs(sum) / 2;
}

function orientation(a: Point, b: Point, c: Point): number {
  return Math.sign((b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y));
}

function segmentsCross(a: Point, b: Point, c: Point, d: Point): boolean {
  return orientation(a, b, c) !== orientation(a, b, d) && orientation(c, d, a) !== orientation(c, d, b);
}

export function hasSelfIntersections(points: Point[]): boolean {
  for (let first = 0; first < points.length; first += 1) {
    const firstNext = (first + 1) % points.length;
    for (let second = first + 1; second < points.length; second += 1) {
      const secondNext = (second + 1) % points.length;
      const adjacent = first === second || firstNext === second || secondNext === first;
      if (!adjacent && segmentsCross(points[first], points[firstNext], points[second], points[secondNext])) return true;
    }
  }
  return false;
}

export function evaluateSelection(
  current: number,
  selectedPercent: number,
  turnsUsedBeforeSelection: number,
  maxTurns = MAX_TURNS,
): GameEvaluation {
  const total = current + selectedPercent;
  const turnsUsed = turnsUsedBeforeSelection + 1;
  let outcome: GameOutcome = 'continue';
  if (total === 100) outcome = 'perfect';
  else if (total > 100) outcome = 'bust';
  else if (turnsUsed >= maxTurns) outcome = 'turns-exhausted';
  return { total, turnsUsed, outcome, difference: Math.abs(100 - total) };
}

export function generateReferenceShape(seed: number, vertexCount = 16, irregularity = 0.24): ShapeDefinition {
  const random = mulberry32(seed);
  const phaseA = random() * Math.PI * 2;
  const phaseB = random() * Math.PI * 2;
  const points: Point[] = [];

  for (let index = 0; index < vertexCount; index += 1) {
    const angle = (index / vertexCount) * Math.PI * 2;
    const harmonic = Math.sin(angle * 3 + phaseA) * 0.55 + Math.sin(angle * 5 + phaseB) * 0.25;
    const jitter = (random() - 0.5) * 0.65;
    const radius = 100 * (1 + irregularity * (harmonic + jitter));
    points.push({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
  }

  return { centerX: 0, centerY: 0, points, area: polygonArea(points), seed };
}

export function deriveCandidateShape(
  reference: ShapeDefinition,
  targetPercent: number,
  seed: number,
  deformation = 0.3,
): ShapeDefinition {
  const random = mulberry32(seed);
  const phase = random() * Math.PI * 2;
  const aspect = 0.78 + random() * 0.5;
  const angle = (random() - 0.5) * 0.5;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const deformed = reference.points.map((point, index) => {
    const wave = Math.sin((index / reference.points.length) * Math.PI * 4 + phase);
    const localScale = Math.max(0.54, 1 + deformation * (wave * 0.55 + random() - 0.5));
    const x = point.x * localScale * aspect;
    const y = point.y * localScale / aspect;
    return { x: x * cos - y * sin, y: x * sin + y * cos };
  });
  const targetArea = reference.area * (targetPercent / 100);
  const scale = Math.sqrt(targetArea / polygonArea(deformed));
  const points = deformed.map((point) => ({ x: point.x * scale, y: point.y * scale }));
  return { centerX: 0, centerY: 0, points, area: polygonArea(points), seed };
}

function shuffle<T>(items: T[], seed: number): T[] {
  const random = mulberry32(seed);
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

export function createFirstPlayableRound(seed: number): RoundDefinition {
  const reference = generateReferenceShape(seed);
  const random = mulberry32(seed * 31 + 7);
  const percentages = shuffle([
    18 + Math.floor(random() * 12),
    34 + Math.floor(random() * 12),
    50 + Math.floor(random() * 14),
  ], seed + 99);
  const candidates = percentages.map((percent, index) => ({
    percent: Math.max(MIN_CANDIDATE_PERCENT, Math.min(MAX_CANDIDATE_PERCENT, percent)),
    shape: deriveCandidateShape(reference, percent, seed * 101 + index * 17 + 3),
  }));
  return { seed, reference, candidates };
}

export function generateCandidatePercentages(
  current: number,
  turnsUsed: number,
  seed: number,
  maxTurns = MAX_TURNS,
): number[] {
  const random = mulberry32(seed);
  const remaining = Math.max(0, 100 - current);
  const turnsLeft = Math.max(1, maxTurns - turnsUsed);
  const idealAverage = remaining / turnsLeft;

  const values = Array.from({ length: 3 }, () => {
    const profile = Math.floor(random() * 4);
    if (profile === 0) {
      const spread = Math.max(5, idealAverage * 0.42);
      return clampInteger(idealAverage + (random() - 0.5) * spread * 2);
    }
    if (profile === 1) {
      return clampInteger(remaining * (0.28 + random() * 0.48));
    }
    if (profile === 2) {
      const dangerOffset = Math.max(4, remaining * (0.04 + random() * 0.22));
      return clampInteger(remaining + (random() < 0.62 ? dangerOffset : -dangerOffset));
    }
    return clampInteger(MIN_CANDIDATE_PERCENT + random() * (MAX_CANDIDATE_PERCENT - MIN_CANDIDATE_PERCENT));
  });

  return shuffle(values, seed ^ 0x9e3779b9);
}

export function createRound(
  seed: number,
  current: number,
  turnsUsed: number,
  options: { vertexCount?: number; irregularity?: number; deformation?: number; maxTurns?: number } = {},
): RoundDefinition {
  const reference = generateReferenceShape(seed, options.vertexCount ?? 16, options.irregularity ?? 0.24);
  const percentages = generateCandidatePercentages(current, turnsUsed, seed * 31 + 17, options.maxTurns ?? MAX_TURNS);
  const candidates = percentages.map((percent, index) => ({
    percent,
    shape: deriveCandidateShape(reference, percent, seed * 101 + index * 37 + 11, options.deformation ?? 0.3),
  }));
  return { seed, reference, candidates };
}

export function simulateBalance(
  startingCurrent: number,
  turnsLeft: number,
  iterations = 1000,
  seed = 1,
): BalanceSimulation {
  let bustCandidates = 0;
  let totalCandidates = 0;
  let perfects = 0;
  let finalTotal = 0;
  let turnsTotal = 0;
  let allBustRounds = 0;
  let roundCount = 0;

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    let current = startingCurrent;
    let used = 0;
    const maxTurns = Math.max(1, turnsLeft);

    while (used < maxTurns && current < 100) {
      const values = generateCandidatePercentages(current, used, seed + iteration * 997 + used * 53, maxTurns);
      const bustCount = values.filter((value) => current + value > 100).length;
      bustCandidates += bustCount;
      totalCandidates += values.length;
      if (bustCount === values.length) allBustRounds += 1;
      roundCount += 1;

      const desired = (100 - current) / Math.max(1, maxTurns - used);
      const estimatedNoise = (mulberry32(seed + iteration * 193 + used * 17)() - 0.5) * 12;
      const chosen = values.reduce((best, value) =>
        Math.abs(value - (desired + estimatedNoise)) < Math.abs(best - (desired + estimatedNoise)) ? value : best,
      values[0]);
      current += chosen;
      used += 1;
      if (current >= 100) break;
    }

    if (current === 100) perfects += 1;
    finalTotal += current;
    turnsTotal += used;
  }

  return {
    bustCandidateRate: totalCandidates ? bustCandidates / totalCandidates : 0,
    perfectRate: perfects / iterations,
    averageFinal: finalTotal / iterations,
    averageTurns: turnsTotal / iterations,
    allBustRate: roundCount ? allBustRounds / roundCount : 0,
  };
}
