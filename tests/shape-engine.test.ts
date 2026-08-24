import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createFirstPlayableRound,
  deriveCandidateShape,
  evaluateSelection,
  generateReferenceShape,
  hasSelfIntersections,
  polygonArea,
} from '../packages/shape-engine.ts';

test('polygonArea calculates a square', () => {
  assert.equal(polygonArea([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }]), 100);
});

test('the same seed recreates the same reference and candidates', () => {
  assert.deepEqual(createFirstPlayableRound(412), createFirstPlayableRound(412));
});

test('candidate area converges to the requested integer percentage', () => {
  const reference = generateReferenceShape(88);
  for (const percent of [8, 17, 37, 65]) {
    const candidate = deriveCandidateShape(reference, percent, percent * 17);
    assert.ok(Math.abs((candidate.area / reference.area) * 100 - percent) < 1e-9);
  }
});

test('generated radial polygons do not self-intersect', () => {
  for (let seed = 0; seed < 100; seed += 1) {
    const reference = generateReferenceShape(seed);
    assert.equal(hasSelfIntersections(reference.points), false);
    assert.equal(hasSelfIntersections(deriveCandidateShape(reference, 37, seed + 1000).points), false);
  }
});

test('candidate values remain inside the MVP range', () => {
  for (let seed = 0; seed < 100; seed += 1) {
    for (const candidate of createFirstPlayableRound(seed).candidates) {
      assert.ok(candidate.percent >= 8 && candidate.percent <= 65);
    }
  }
});

test('game evaluation detects PERFECT, BUST, and turn exhaustion', () => {
  assert.equal(evaluateSelection(76, 24, 2).outcome, 'perfect');
  assert.equal(evaluateSelection(86, 23, 2).outcome, 'bust');
  assert.equal(evaluateSelection(71, 20, 4).outcome, 'turns-exhausted');
  assert.equal(evaluateSelection(20, 20, 1).outcome, 'continue');
});
