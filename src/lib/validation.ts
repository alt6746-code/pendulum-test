import type { MeasurementData } from '@/types';
import { computeAngles } from './analysis';

export type ValidationType = 'no-motion' | 'irregular' | 'impact' | 'too-short' | 'valid';

export interface ValidationResult {
  type: ValidationType;
  message: string;
}

const MESSAGES: Record<Exclude<ValidationType, 'valid'>, string> = {
  'no-motion': '움직임이 감지되지 않았습니다. 다시 측정해주세요.',
  'impact': '외부 충격이 감지되었습니다. 재측정해주세요.',
  'too-short': '충분한 데이터가 수집되지 않았습니다. 재측정해주세요.',
  'irregular': '측정이 불안정합니다. 고정 상태를 확인 후 재측정해주세요.',
};

/**
 * Validate measurement data quality.
 * Returns validation result with type and Korean message.
 */
export function validateMeasurement(data: MeasurementData): ValidationResult {
  const { samples, startIndex, endIndex, baselineAngle } = data;

  if (startIndex < 0 || startIndex >= samples.length) {
    return { type: 'no-motion', message: MESSAGES['no-motion'] };
  }

  // 1. Check for no motion: first swing < 5° (relaxed from 10° for real sensor noise)
  const { angles } = computeAngles(samples, startIndex, endIndex, baselineAngle);
  const maxAngle = angles.reduce((max, a) => Math.max(max, Math.abs(a)), 0);
  if (maxAngle < 5) {
    return { type: 'no-motion', message: MESSAGES['no-motion'] };
  }

  // 2. Check for impact: acceleration spike > 6g (relaxed from 4g for real device vibration)
  const IMPACT_THRESHOLD = 6 * 9.81;
  for (let i = startIndex; i <= endIndex && i < samples.length; i++) {
    const s = samples[i];
    const totalAcc = Math.sqrt(s.accX * s.accX + s.accY * s.accY + s.accZ * s.accZ);
    if (totalAcc > IMPACT_THRESHOLD) {
      return { type: 'impact', message: MESSAGES['impact'] };
    }
  }

  // 3. Check for too-short: fewer than 1 full oscillation
  // Count peaks with smoothing to filter sensor noise
  let peakCount = 0;
  // Use a sliding window of 3 to reduce noise sensitivity
  for (let i = 2; i < angles.length - 2; i++) {
    const prev = (angles[i - 2] + angles[i - 1]) / 2;
    const curr = angles[i];
    const next = (angles[i + 1] + angles[i + 2]) / 2;
    const isMax = curr > prev && curr > next;
    const isMin = curr < prev && curr < next;
    if ((isMax || isMin) && Math.abs(curr) > 2) {
      peakCount++;
    }
  }
  const oscillations = Math.floor(peakCount / 2);
  if (oscillations < 1) {
    return { type: 'too-short', message: MESSAGES['too-short'] };
  }

  // 4. Check for irregular pattern: only flag truly erratic data
  // Find significant peaks only (> 20% of max angle to ignore noise)
  const significantThreshold = maxAngle * 0.2;
  const peakTimes: number[] = [];
  for (let i = 1; i < angles.length - 1; i++) {
    if (angles[i] > angles[i - 1] && angles[i] > angles[i + 1] && angles[i] > significantThreshold) {
      const sampleIdx = startIndex + i;
      if (sampleIdx < samples.length) {
        // Minimum distance between peaks: 200ms to avoid double-counting
        if (peakTimes.length === 0 ||
            samples[sampleIdx].timestamp - peakTimes[peakTimes.length - 1] > 200) {
          peakTimes.push(samples[sampleIdx].timestamp);
        }
      }
    }
  }

  if (peakTimes.length >= 4) {
    const periods: number[] = [];
    for (let i = 1; i < peakTimes.length; i++) {
      periods.push(peakTimes[i] - peakTimes[i - 1]);
    }
    const avgPeriod = periods.reduce((s, p) => s + p, 0) / periods.length;
    const maxVariation = periods.reduce(
      (max, p) => Math.max(max, Math.abs(p - avgPeriod) / avgPeriod),
      0,
    );
    if (maxVariation > 1.0) {
      return { type: 'irregular', message: MESSAGES['irregular'] };
    }
  }

  return { type: 'valid', message: '측정 완료' };
}
