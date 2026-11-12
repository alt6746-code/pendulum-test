'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { Side, SensorSample, MeasurementData, AnalysisResult } from '@/types';
import { requestSensorPermission, startSensorCollection } from '@/lib/sensor';
import { detectMotionStart, detectMotionEnd, analyzePendulum, computeBaseline } from '@/lib/analysis';
import { validateMeasurement } from '@/lib/validation';
import type { ValidationResult } from '@/lib/validation';

interface Props {
  side: Side;
  onComplete: (data: MeasurementData, analysis: AnalysisResult) => void;
  onFail: (message: string) => void;
}

type MeasurePhase = 'preparing' | 'countdown' | 'waiting' | 'recording' | 'analyzing';

const COUNTDOWN_SEC = 5;
const MAX_RECORDING_SEC = 30;
const MOTION_THRESHOLD = 15;       // deg/s to detect motion start
const STOP_WINDOW_MS = 2000;       // window to check for motion stop
const STOP_THRESHOLD = 3;          // deg/s RMS for motion stop
const SAMPLING_HZ = 60;

export default function Measurement({ side, onComplete, onFail }: Props) {
  const [phase, setPhase] = useState<MeasurePhase>('preparing');
  const [countdown, setCountdown] = useState(COUNTDOWN_SEC);
  const [statusText, setStatusText] = useState('');

  const samplesRef = useRef<SensorSample[]>([]);
  const cleanupRef = useRef<(() => void) | null>(null);
  const motionStartRef = useRef<number>(-1);
  const recordingStartTimeRef = useRef<number>(0);
  const analyzeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cleanupRef.current) cleanupRef.current();
      if (analyzeTimeoutRef.current) clearTimeout(analyzeTimeoutRef.current);
    };
  }, []);

  // Phase: preparing — request sensor permission
  useEffect(() => {
    if (phase !== 'preparing') return;
    setStatusText('센서 권한 확인 중...');

    requestSensorPermission().then(result => {
      if (result === 'denied') {
        onFail('센서 권한이 거부되었습니다. 브라우저 설정에서 모션 센서를 허용해주세요.');
        return;
      }
      setPhase('countdown');
    });
  }, [phase, onFail]);

  // Phase: countdown
  useEffect(() => {
    if (phase !== 'countdown') return;

    setCountdown(COUNTDOWN_SEC);
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          setPhase('waiting');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [phase]);

  const finishRecording = useCallback(() => {
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }

    setPhase('analyzing');
    setStatusText('분석 중...');

    const samples = samplesRef.current;
    const startIdx = detectMotionStart(samples, MOTION_THRESHOLD);

    if (startIdx < 0) {
      onFail('움직임이 감지되지 않았습니다. 다시 측정해주세요.');
      return;
    }

    const baseline = computeBaseline(samples, startIdx);
    const endIdx = detectMotionEnd(samples, startIdx, STOP_WINDOW_MS, STOP_THRESHOLD);

    const data: MeasurementData = {
      side,
      samples,
      startIndex: startIdx,
      endIndex: endIdx,
      samplingRate: SAMPLING_HZ,
      baselineAngle: baseline,
    };

    const validation: ValidationResult = validateMeasurement(data);
    if (validation.type !== 'valid') {
      onFail(validation.message);
      return;
    }

    const analysis = analyzePendulum(data);
    onComplete(data, analysis);
  }, [side, onComplete, onFail]);

  // Phase: waiting + recording — collect sensor data
  useEffect(() => {
    if (phase !== 'waiting') return;

    setStatusText('측정 대기 중...\n기기를 놓아주세요');
    samplesRef.current = [];
    motionStartRef.current = -1;

    let checkInterval: ReturnType<typeof setInterval> | null = null;

    startSensorCollection((sample) => {
      samplesRef.current.push(sample);

      // Auto-detect motion start
      if (motionStartRef.current < 0 && Math.abs(sample.beta) > MOTION_THRESHOLD) {
        motionStartRef.current = samplesRef.current.length - 1;
        recordingStartTimeRef.current = performance.now();
        setPhase('recording');
        setStatusText('측정 중...');
      }
    }).then(cleanup => {
      cleanupRef.current = cleanup;
    });

    return () => {
      if (checkInterval) clearInterval(checkInterval);
    };
  }, [phase]);

  // Phase: recording — monitor for motion stop or timeout
  useEffect(() => {
    if (phase !== 'recording') return;

    const checkInterval = setInterval(() => {
      const samples = samplesRef.current;
      const startIdx = motionStartRef.current;
      if (startIdx < 0 || samples.length < startIdx + 20) return;

      const elapsed = (performance.now() - recordingStartTimeRef.current) / 1000;

      // Check if motion has stopped (RMS of recent window < threshold)
      const windowSamples = Math.min(Math.floor(STOP_WINDOW_MS / (1000 / SAMPLING_HZ)), samples.length - startIdx);
      const recentStart = samples.length - windowSamples;

      if (recentStart > startIdx + 30) { // ensure at least ~0.5s of data before checking
        let sumSq = 0;
        for (let i = recentStart; i < samples.length; i++) {
          sumSq += samples[i].beta * samples[i].beta;
        }
        const rms = Math.sqrt(sumSq / windowSamples);

        if (rms < STOP_THRESHOLD && elapsed > 1) {
          clearInterval(checkInterval);
          finishRecording();
          return;
        }
      }

      // Timeout
      if (elapsed >= MAX_RECORDING_SEC) {
        clearInterval(checkInterval);
        finishRecording();
      }
    }, 200);

    return () => clearInterval(checkInterval);
  }, [phase, finishRecording]);

  const sideLabel = side === 'right' ? '오른쪽' : '왼쪽';

  return (
    <div className="w-full h-screen flex flex-col items-center justify-center bg-gray-900 text-white fixed inset-0 z-50">
      <p className="text-sm text-gray-400 mb-4">{sideLabel} 다리 측정</p>

      {phase === 'preparing' && (
        <p className="text-lg">{statusText}</p>
      )}

      {phase === 'countdown' && (
        <div className="text-center">
          <div className="text-8xl font-bold tabular-nums mb-4">{countdown}</div>
          <p className="text-lg text-gray-300">스마트폰을 암밴드에 넣어주세요</p>
        </div>
      )}

      {phase === 'waiting' && (
        <div className="text-center">
          <div className="text-6xl mb-4">⏳</div>
          <p className="text-lg whitespace-pre-line">{statusText}</p>
        </div>
      )}

      {phase === 'recording' && (
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-green-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-xl font-semibold text-green-400">측정 중...</p>
        </div>
      )}

      {phase === 'analyzing' && (
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-lg">{statusText}</p>
        </div>
      )}
    </div>
  );
}
