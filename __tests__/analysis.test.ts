import type { SensorSample, MeasurementData } from '@/types';
import {
  detectMotionStart,
  detectMotionEnd,
  computeAngles,
  analyzePendulum,
  getInterpretation,
  computeBaseline,
} from '@/lib/analysis';

const SAMPLING_HZ = 60;
const DT = 1000 / SAMPLING_HZ; // ms per sample

/**
 * Generate simulated damped pendulum sensor data.
 * Models: angle(t) = A * e^(-ζt) * sin(ωt)
 *
 * @param startAngleDeg - initial drop angle (degrees)
 * @param dampingRatio - how fast oscillation decays (higher = more spastic)
 * @param frequencyHz - oscillation frequency
 * @param durationSec - total duration
 * @param baselineSecBefore - seconds of flat baseline before drop
 */
function generateDampedPendulum(
  startAngleDeg: number,
  dampingRatio: number,
  frequencyHz: number,
  durationSec: number,
  baselineSecBefore: number = 2,
): SensorSample[] {
  const samples: SensorSample[] = [];
  const omega = 2 * Math.PI * frequencyHz;
  const totalSamples = Math.floor((baselineSecBefore + durationSec) * SAMPLING_HZ);

  for (let i = 0; i < totalSamples; i++) {
    const t = i * (DT / 1000); // seconds
    const tMotion = t - baselineSecBefore;

    let angle: number;
    let angularVelocity: number;

    if (tMotion < 0) {
      // Baseline: leg at rest (horizontal = startAngle from vertical)
      angle = 0; // relative to baseline
      angularVelocity = 0;
    } else {
      // Damped oscillation
      const decay = Math.exp(-dampingRatio * tMotion);
      angle = startAngleDeg * decay * Math.sin(omega * tMotion);
      // Derivative for angular velocity
      angularVelocity =
        startAngleDeg * decay * (
          -dampingRatio * Math.sin(omega * tMotion) +
          omega * Math.cos(omega * tMotion)
        );
    }

    // Simulate accelerometer: gravity projects onto axes based on tilt
    const angleRad = (angle * Math.PI) / 180;
    const g = 9.81;

    samples.push({
      timestamp: i * DT,
      alpha: 0,
      beta: angularVelocity, // primary rotation rate
      gamma: 0,
      accX: 0,
      accY: g * Math.sin(angleRad), // gravity component along tilt
      accZ: g * Math.cos(angleRad), // gravity component perpendicular
    });
  }

  return samples;
}

// --- Test datasets ---

// Normal pendulum: large swings, slow decay, many oscillations (RI ~1.6)
const normalSamples = generateDampedPendulum(80, 0.3, 0.8, 12, 2);

// Spastic pendulum: reduced swings, fast decay (RI < 1.0)
const spasticSamples = generateDampedPendulum(40, 1.5, 0.8, 8, 2);

// Severe spasticity: very fast decay, almost no oscillation
const severeSamples = generateDampedPendulum(20, 4.0, 0.8, 4, 2);

// Flat data: no motion at all
const flatSamples: SensorSample[] = Array.from({ length: 300 }, (_, i) => ({
  timestamp: i * DT,
  alpha: 0,
  beta: 0,
  gamma: 0,
  accX: 0,
  accY: 0,
  accZ: 9.81,
}));

describe('detectMotionStart', () => {
  test('정지 상태 후 낙하 시작 인덱스를 정확히 감지', () => {
    const idx = detectMotionStart(normalSamples, 15);
    // Baseline is 2 seconds = 120 samples
    expect(idx).toBeGreaterThanOrEqual(100);
    expect(idx).toBeLessThan(140);
  });

  test('움직임 없는 데이터에서 -1 반환', () => {
    const idx = detectMotionStart(flatSamples, 15);
    expect(idx).toBe(-1);
  });
});

describe('detectMotionEnd', () => {
  test('진동 소멸 후 종료 인덱스를 정확히 감지', () => {
    const startIdx = detectMotionStart(normalSamples, 15);
    const endIdx = detectMotionEnd(normalSamples, startIdx, 2000, 3);
    const endTimeSec = (normalSamples[endIdx].timestamp - normalSamples[startIdx].timestamp) / 1000;

    expect(endTimeSec).toBeGreaterThan(2);
    expect(endTimeSec).toBeLessThan(20);
  });

  test('빠르게 감쇠하는 경직 데이터도 종료 감지', () => {
    const startIdx = detectMotionStart(spasticSamples, 15);
    const endIdx = detectMotionEnd(spasticSamples, startIdx, 2000, 3);
    const endTimeSec = (spasticSamples[endIdx].timestamp - spasticSamples[startIdx].timestamp) / 1000;

    expect(endTimeSec).toBeGreaterThan(1);
    expect(endTimeSec).toBeLessThan(10);
  });
});

describe('analyzePendulum', () => {
  function makeMeasurementData(samples: SensorSample[]): MeasurementData {
    const startIndex = detectMotionStart(samples, 15);
    const baseline = computeBaseline(samples, Math.max(0, startIndex));
    const endIndex = detectMotionEnd(samples, startIndex, 2000, 3);
    return {
      side: 'right',
      samples,
      startIndex: Math.max(0, startIndex),
      endIndex,
      samplingRate: SAMPLING_HZ,
      baselineAngle: baseline,
    };
  }

  test('정상 진자 데이터에서 RI > 1.0, 다수의 진동', () => {
    const data = makeMeasurementData(normalSamples);
    const result = analyzePendulum(data);

    expect(result.relaxationIndex).toBeGreaterThan(0.8);
    expect(result.numberOfOscillations).toBeGreaterThan(2);
    expect(result.firstSwingExcursion).toBeGreaterThan(20);
  });

  test('경직 진자 데이터에서 RI 감소, 적은 진동', () => {
    const data = makeMeasurementData(spasticSamples);
    const result = analyzePendulum(data);

    expect(result.relaxationIndex).toBeLessThan(1.5);
    expect(result.numberOfOscillations).toBeLessThan(
      analyzePendulum(makeMeasurementData(normalSamples)).numberOfOscillations,
    );
  });

  test('심한 경직에서 진동 최소', () => {
    const data = makeMeasurementData(severeSamples);
    const result = analyzePendulum(data);

    expect(result.numberOfOscillations).toBeLessThanOrEqual(3);
  });

  test('side 값이 정확히 전달됨', () => {
    const data = makeMeasurementData(normalSamples);
    data.side = 'left';
    const result = analyzePendulum(data);
    expect(result.side).toBe('left');
  });
});

describe('getInterpretation', () => {
  test('RI ≥ 1.4 → 정상', () => {
    expect(getInterpretation(1.6)).toContain('정상');
  });

  test('1.0 ≤ RI < 1.4 → 경미한 경직', () => {
    expect(getInterpretation(1.2)).toContain('경미한 경직');
  });

  test('0.6 ≤ RI < 1.0 → 중등도 경직', () => {
    expect(getInterpretation(0.8)).toContain('중등도 경직');
  });

  test('RI < 0.6 → 심한 경직', () => {
    expect(getInterpretation(0.3)).toContain('심한 경직');
  });
});
