'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  REFERENCE_DISPLAY_MS,
  createFirstPlayableRound,
  type Point,
  type RoundDefinition,
} from '../packages/shape-engine';

type Phase = 'reference' | 'transforming' | 'choosing' | 'revealed';

const SHAPE_COLORS = ['#ef6a5b', '#446df6', '#12a594', '#9b6bd6'];

function lerpPoints(from: Point[], to: Point[], amount: number): Point[] {
  return from.map((point, index) => ({
    x: point.x + (to[index].x - point.x) * amount,
    y: point.y + (to[index].y - point.y) * amount,
  }));
}

function drawShape(canvas: HTMLCanvasElement, points: Point[], color: string) {
  const context = canvas.getContext('2d');
  if (!context) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  context.scale(dpr, dpr);
  context.clearRect(0, 0, width, height);

  // Every canvas uses the same virtual 240 × 240 coordinate space. Never fit
  // candidates to their own bounds: that would erase the visual area clue.
  const scale = Math.min(width, height) / 240;
  const offsetX = width / 2;
  const offsetY = height / 2;

  context.beginPath();
  points.forEach((point, index) => {
    const x = point.x * scale + offsetX;
    const y = point.y * scale + offsetY;
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.closePath();
  context.fillStyle = color;
  context.fill();
}

function ShapeCanvas({ from, to = from, color, animate = false, className = '' }: {
  from: Point[];
  to?: Point[];
  color: string;
  animate?: boolean;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let frame = 0;
    const startedAt = performance.now();

    const paint = (now: number) => {
      const rawProgress = animate ? Math.min((now - startedAt) / 620, 1) : 1;
      const eased = 1 - Math.pow(1 - rawProgress, 3);
      drawShape(canvas, lerpPoints(from, to, eased), color);
      if (rawProgress < 1) frame = requestAnimationFrame(paint);
    };

    frame = requestAnimationFrame(paint);
    const onResize = () => drawShape(canvas, to, color);
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', onResize);
    };
  }, [animate, color, from, to]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}

function Game({ round, onNext }: { round: RoundDefinition; onNext: () => void }) {
  const [phase, setPhase] = useState<Phase>('reference');
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    const transformTimer = window.setTimeout(() => setPhase('transforming'), REFERENCE_DISPLAY_MS);
    const chooseTimer = window.setTimeout(() => setPhase('choosing'), REFERENCE_DISPLAY_MS + 660);
    return () => {
      window.clearTimeout(transformTimer);
      window.clearTimeout(chooseTimer);
    };
  }, [round.seed]);

  const choose = useCallback((index: number) => {
    if (phase !== 'choosing') return;
    setSelected(index);
    setPhase('revealed');
  }, [phase]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const index = Number(event.key) - 1;
      if (index >= 0 && index < 3) choose(index);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [choose]);

  const color = SHAPE_COLORS[round.seed % SHAPE_COLORS.length];

  return (
    <main className="game-shell">
      <header className="game-header">
        <div>
          <p className="eyebrow">目分量100 <span>試作版</span></p>
          <h1>さっき見た形を、覚えてる？</h1>
        </div>
        <div className="turn-pill" aria-label="現在の合計 0 / 100">
          <strong>0</strong><span>/ 100</span>
        </div>
      </header>

      <section className="score-area" aria-label="現在のスコア">
        <div className="gauge"><span style={{ width: '0%' }} /></div>
        <p>あと <strong>100</strong></p>
      </section>

      <section className="play-area" aria-live="polite">
        {phase === 'reference' ? (
          <div className="reference-stage">
            <div className="prompt"><span className="prompt-dot" />これが <strong>100%！</strong></div>
            <ShapeCanvas from={round.reference.points} color={color} className="reference-canvas" />
            <p className="look-note">形と大きさを、目に焼きつけて</p>
          </div>
        ) : (
          <div className="choice-stage">
            <div className="prompt choice-prompt">
              {phase === 'transforming' ? 'ぐにゃっと変身中…' : phase === 'revealed' ? '答えはこちら！' : 'どれにする？'}
            </div>
            <div className={`choices ${phase === 'transforming' ? 'is-splitting' : ''}`}>
              {round.candidates.map((candidate, index) => {
                const isSelected = selected === index;
                const isDimmed = phase === 'revealed' && !isSelected;
                return (
                  <button
                    type="button"
                    className={`choice choice-${index} ${isSelected ? 'is-selected' : ''} ${isDimmed ? 'is-dimmed' : ''}`}
                    key={`${candidate.percent}-${index}`}
                    onClick={() => choose(index)}
                    disabled={phase !== 'choosing'}
                    aria-label={phase === 'revealed' ? `${candidate.percent}%${isSelected ? '、あなたの選択' : ''}` : `候補 ${index + 1}`}
                  >
                    <span className="key-hint">{index + 1}</span>
                    <ShapeCanvas
                      from={round.reference.points}
                      to={candidate.shape.points}
                      color={color}
                      animate={phase === 'transforming'}
                      className="candidate-canvas"
                    />
                    <span className={`answer ${phase === 'revealed' ? 'is-visible' : ''}`}>
                      {candidate.percent}%{isSelected && <small>あなた</small>}
                    </span>
                  </button>
                );
              })}
            </div>

            {phase === 'choosing' && <p className="hint">図形をタップ <span>PCなら 1・2・3</span></p>}
            {phase === 'revealed' && selected !== null && (
              <div className="reveal-panel">
                <p>あなたの目分量は <strong>{round.candidates[selected].percent}%</strong></p>
                <button type="button" onClick={onNext}>もう一問</button>
              </div>
            )}
          </div>
        )}
      </section>

      <footer>100%の形は、選ぶときには消えています。</footer>
    </main>
  );
}

export default function Home() {
  const [seed, setSeed] = useState(100);
  const round = useMemo(() => createFirstPlayableRound(seed), [seed]);
  return <Game key={seed} round={round} onNext={() => setSeed((value) => value + 1)} />;
}
