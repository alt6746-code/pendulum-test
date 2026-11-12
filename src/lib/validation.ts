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

  // 1. Check for no motion: first swing < 10°
  const { angles } = computeAngles(samples, startIndex, endIndex, baselineAngle);
  const maxAngle = angles.reduce((max, a) => Math.max(max, Math.abs(a)), 0);
  if (maxAngle < 10) {
    return { type: 'no-motion', message: MESSAGES['no-motion'] };
  }

  // 2. Check for impact: acceleration spike > 4g (39.24 m/s²)
  const IMPACT_THRESHOLD = 4 * 9.81;
  for (let i = startIndex; i <= endIndex && i < samples.length; i++) {
    const s = samples[i];
    const totalAcc = Math.sqrt(s.accX * s.accX + s.accY * s.accY + s.accZ * s.accZ);
    if (totalAcc > IMPACT_THRESHOLD) {
      return { type: 'impact', message: MESSAGES['impact'] };
    }
  }

  // 3. Check for too-short: fewer than 2 oscillations
  // Count peaks (local maxima and minima with minimum prominence)
  let peakCount = 0;
  for (let i = 1; i < angles.length - 1; i++) {
    const isMax = angles[i] > angles[i - 1] && angles[i] > angles[i + 1];
    const isMin = angles[i] < angles[i - 1] && angles[i] < angles[i + 1];
    if ((isMax || isMin) && Math.abs(angles[i]) > 3) {
      peakCount++;
    }
  }
  const oscillations = Math.floor(peakCount / 2);
  if (oscillations < 2) {
    return { type: 'too-short', message: MESSAGES['too-short'] };
  }

  // 4. Check for irregular pattern: swing period variation > 50%
  const peakTimes: number[] = [];
  for (let i = 2; i < angles.length; i++) {
    const prev = angles[i - 1] - angles[i - 2];
    const curr = angles[i] - angles[i - 1];
    if (prev > 0 && curr < 0 && Math.abs(angles[i - 1]) > 5) {
      // Local maximum
      const sampleIdx = startIndex + i - 1;
      if (sampleIdx < samples.length) {
        peakTimes.push(samples[sampleIdx].timestamp);
      }
    }
  }

  if (peakTimes.length >= 3) {
    const periods: number[] = [];
    for (let i = 1; i < peakTimes.length; i++) {
      periods.push(peakTimes[i] - peakTimes[i - 1]);
    }
    const avgPeriod = periods.reduce((s, p) => s + p, 0) / periods.length;
    const maxVariation = periods.reduce(
      (max, p) => Math.max(max, Math.abs(p - avgPeriod) / avgPeriod),
      0,
    );
    if (maxVariation > 0.5) {
      return { type: 'irregular', message: MESSAGES['irregular'] };
    }
  }

  return { type: 'valid', message: '측정 완료' };
}
