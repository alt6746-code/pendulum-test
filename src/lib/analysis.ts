import type { SensorSample, MeasurementData, AnalysisResult } from '@/types';

/**
 * Detect the index where significant angular velocity begins (leg drop).
 * Scans beta axis (rotation rate) for the first sample exceeding threshold.
 */
export function detectMotionStart(
  samples: SensorSample[],
  threshold: number = 15,
): number {
  for (let i = 0; i < samples.length; i++) {
    if (Math.abs(samples[i].beta) > threshold) {
      return Math.max(0, i - 2); // back up 2 samples for baseline capture
    }
  }
  return -1; // no motion detected
}

/**
 * Detect the index where oscillation has effectively stopped.
 * Uses a sliding window RMS of angular velocity on beta axis.
 */
export function detectMotionEnd(
  samples: SensorSample[],
  startIdx: number,
  windowMs: number = 2000,
  threshold: number = 3,
): number {
  if (samples.length === 0 || startIdx < 0) return samples.length - 1;

  const startTime = samples[startIdx].timestamp;

  // Don't check for end until at least 1 second of data after start
  const minDurationMs = 1000;

  for (let i = startIdx + 1; i < samples.length; i++) {
    const elapsed = samples[i].timestamp - startTime;
    if (elapsed < minDurationMs) continue;

    // Compute RMS of beta angular velocity over the window
    const windowStart = samples[i].timestamp - windowMs;
    let sumSq = 0;
    let count = 0;

    for (let j = i; j >= startIdx; j--) {
      if (samples[j].timestamp < windowStart) break;
      sumSq += samples[j].beta * samples[j].beta;
      count++;
    }

    if (count > 0) {
      const rms = Math.sqrt(sumSq / count);
      if (rms < threshold) {
        return i;
      }
    }
  }

  return samples.length - 1;
}

/**
 * Compute angle array using complementary filter on gyro + accelerometer.
 * Returns angles relative to baseline (0° = starting horizontal position).
 */
export function computeAngles(
  samples: SensorSample[],
  startIdx: number,
  endIdx: number,
  baselineAngle: number,
): { angles: number[]; timestamps: number[] } {
  const ALPHA = 0.98; // complementary filter coefficient
  const slice = samples.slice(startIdx, endIdx + 1);
  if (slice.length === 0) return { angles: [], timestamps: [] };

  const angles: number[] = [];
  const timestamps: number[] = [];
  const t0 = slice[0].timestamp;

  // Initial angle from accelerometer
  let angle = getAccelAngle(slice[0]) - baselineAngle;
  angles.push(angle);
  timestamps.push(0);

  for (let i = 1; i < slice.length; i++) {
    const dt = (slice[i].timestamp - slice[i - 1].timestamp) / 1000; // seconds
    const gyroRate = slice[i].beta; // deg/s
    const accelAngle = getAccelAngle(slice[i]) - baselineAngle;

    // Complementary filter
    angle = ALPHA * (angle + gyroRate * dt) + (1 - ALPHA) * accelAngle;
    angles.push(angle);
    timestamps.push((slice[i].timestamp - t0) / 1000);
  }

  return { angles, timestamps };
}

/**
 * Get tilt angle from accelerometer data (pitch).
 */
function getAccelAngle(sample: SensorSample): number {
  const { accX, accY, accZ } = sample;
  // Pitch angle: rotation around the lateral axis
  return Math.atan2(accY, Math.sqrt(accX * accX + accZ * accZ)) * (180 / Math.PI);
}

/**
 * Find peaks (local maxima and minima) in the angle array.
 * Returns indices of direction changes.
 */
function findPeaks(angles: number[]): number[] {
  if (angles.length < 3) return [];

  const peaks: number[] = [];
  for (let i = 1; i < angles.length - 1; i++) {
    const prev = angles[i - 1];
    const curr = angles[i];
    const next = angles[i + 1];

    if ((curr > prev && curr > next) || (curr < prev && curr < next)) {
      // Minimum peak height of 2° to filter noise
      if (peaks.length === 0 || Math.abs(angles[i] - angles[peaks[peaks.length - 1]]) > 2) {
        peaks.push(i);
      }
    }
  }

  return peaks;
}

/**
 * Compute the baseline angle from samples before motion start.
 */
export function computeBaseline(samples: SensorSample[], startIdx: number): number {
  const baselineSlice = samples.slice(Math.max(0, startIdx - 30), startIdx);
  if (baselineSlice.length === 0) return 0;

  let sum = 0;
  for (const s of baselineSlice) {
    sum += getAccelAngle(s);
  }
  return sum / baselineSlice.length;
}

/**
 * Full pendulum analysis: computes all clinical metrics from measurement data.
 */
export function analyzePendulum(data: MeasurementData): AnalysisResult {
  const { side, samples, startIndex, endIndex, baselineAngle } = data;

  const { angles, timestamps } = computeAngles(samples, startIndex, endIndex, baselineAngle);
  const peaks = findPeaks(angles);

  // First swing excursion: maximum angle magnitude in first swing
  const firstSwingExcursion = peaks.length > 0
    ? Math.abs(angles[peaks[0]])
    : 0;

  // Starting angle (from horizontal to full extension) — use baselineAngle
  // RI = first max flexion angle / starting angle
  // Starting angle is the angle the leg makes from vertical at rest
  // For pendulum: starting position is ~0° (horizontal), leg drops to flexion
  const startAngle = Math.abs(baselineAngle) || firstSwingExcursion;
  const relaxationIndex = startAngle > 0
    ? firstSwingExcursion / startAngle
    : 0;

  // Number of oscillations: count of peak pairs
  const numberOfOscillations = Math.max(0, Math.floor(peaks.length / 2));

  // First extension angle: angle at second peak (first reversal back)
  const firstExtensionAngle = peaks.length > 1
    ? Math.abs(angles[peaks[1]])
    : 0;

  const interpretation = getInterpretation(relaxationIndex);

  return {
    side,
    relaxationIndex: Math.round(relaxationIndex * 100) / 100,
    firstSwingExcursion: Math.round(firstSwingExcursion * 10) / 10,
    numberOfOscillations,
    firstExtensionAngle: Math.round(firstExtensionAngle * 10) / 10,
    angles,
    timestamps,
    interpretation,
  };
}

/**
 * Generate interpretation text based on Relaxation Index.
 */
export function getInterpretation(ri: number): string {
  if (ri >= 1.4) {
    return `RI ${ri.toFixed(2)}로 정상 범위 내`;
  } else if (ri >= 1.0) {
    return `RI ${ri.toFixed(2)}로 경미한 경직 소견 (mild spasticity)`;
  } else if (ri >= 0.6) {
    return `RI ${ri.toFixed(2)}로 중등도 경직 소견 (moderate spasticity)`;
  } else {
    return `RI ${ri.toFixed(2)}로 심한 경직 소견 (severe spasticity)`;
  }
}
