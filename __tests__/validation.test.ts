import type { SensorSample, MeasurementData } from '@/types';
import { validateMeasurement } from '@/lib/validation';
import { detectMotionStart, detectMotionEnd, computeBaseline } from '@/lib/analysis';

const SAMPLING_HZ = 60;
const DT = 1000 / SAMPLING_HZ;

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
    const t = i * (DT / 1000);
    const tMotion = t - baselineSecBefore;
    let angle = 0;
    let angularVelocity = 0;

    if (tMotion >= 0) {
      const decay = Math.exp(-dampingRatio * tMotion);
      angle = startAngleDeg * decay * Math.sin(omega * tMotion);
      angularVelocity = startAngleDeg * decay * (
        -dampingRatio * Math.sin(omega * tMotion) +
        omega * Math.cos(omega * tMotion)
      );
    }

    const angleRad = (angle * Math.PI) / 180;
    const g = 9.81;

    samples.push({
      timestamp: i * DT,
      alpha: 0,
      beta: angularVelocity,
      gamma: 0,
      accX: 0,
      accY: g * Math.sin(angleRad),
      accZ: g * Math.cos(angleRad),
    });
  }
  return samples;
}

function makeMeasurement(samples: SensorSample[]): MeasurementData {
  const startIndex = detectMotionStart(samples, 15);
  const si = Math.max(0, startIndex);
  const baseline = computeBaseline(samples, si);
  const endIndex = detectMotionEnd(samples, si, 2000, 3);
  return {
    side: 'right',
    samples,
    startIndex: si,
    endIndex,
    samplingRate: SAMPLING_HZ,
    baselineAngle: baseline,
  };
}

// --- Test datasets ---
const normalSamples = generateDampedPendulum(80, 0.3, 0.8, 12, 2);
const flatSamples: SensorSample[] = Array.from({ length: 300 }, (_, i) => ({
  timestamp: i * DT,
  alpha: 0, beta: 0, gamma: 0,
  accX: 0, accY: 0, accZ: 9.81,
}));

// Impact data: normal + a 5g spike
const impactSamples = generateDampedPendulum(80, 0.3, 0.8, 12, 2);
const impactIdx = Math.floor(2.5 * SAMPLING_HZ); // during motion
impactSamples[impactIdx] = {
  ...impactSamples[impactIdx],
  accX: 45, accY: 10, accZ: 10, // total > 4g
};

// Very short: large enough angle to pass no-motion check but too few oscillations
const shortSamples = generateDampedPendulum(60, 5.0, 0.5, 3, 2);

describe('validateMeasurement', () => {
  test('정상 데이터 → valid', () => {
    const result = validateMeasurement(makeMeasurement(normalSamples));
    expect(result.type).toBe('valid');
  });

  test('진동 없는 데이터 → no-motion', () => {
    const data = makeMeasurement(flatSamples);
    // Force startIndex to 0 since no motion detected
    data.startIndex = 0;
    data.endIndex = flatSamples.length - 1;
    const result = validateMeasurement(data);
    expect(result.type).toBe('no-motion');
  });

  test('외부 충격 포함 데이터 → impact', () => {
    const result = validateMeasurement(makeMeasurement(impactSamples));
    expect(result.type).toBe('impact');
  });

  test('진동 2회 미만 → too-short', () => {
    const result = validateMeasurement(makeMeasurement(shortSamples));
    expect(result.type).toBe('too-short');
  });

  test('메시지가 한국어로 나옴', () => {
    const result = validateMeasurement(makeMeasurement(normalSamples));
    expect(result.message).toBe('측정 완료');

    const data = makeMeasurement(flatSamples);
    data.startIndex = 0;
    data.endIndex = flatSamples.length - 1;
    const noMotion = validateMeasurement(data);
    expect(noMotion.message).toContain('감지되지 않았습니다');
  });
});
