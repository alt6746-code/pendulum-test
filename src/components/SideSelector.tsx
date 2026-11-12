'use client';

import { useState } from 'react';
import type { Side, SideResult } from '@/types';

interface Props {
  rightResult: SideResult | null;
  leftResult: SideResult | null;
  onSelectSide: (side: Side) => void;
  onSkipSide: (side: Side, reason: string) => void;
  onComplete: () => void;
}

export default function SideSelector({
  rightResult,
  leftResult,
  onSelectSide,
  onSkipSide,
  onComplete,
}: Props) {
  const [skipSide, setSkipSide] = useState<Side | null>(null);
  const [skipReason, setSkipReason] = useState('');

  const bothDone = rightResult !== null && leftResult !== null;

  const handleSkipConfirm = () => {
    if (skipSide && skipReason.trim()) {
      onSkipSide(skipSide, skipReason.trim());
      setSkipSide(null);
      setSkipReason('');
    }
  };

  const getSideStatus = (result: SideResult | null): string => {
    if (!result) return '';
    if (result.type === 'measured') return '✅ 측정 완료';
    return `N/A: ${result.info.reason}`;
  };

  // Skip reason modal
  if (skipSide) {
    return (
      <div className="w-full max-w-md space-y-4">
        <h2 className="text-lg font-bold text-center">
          {skipSide === 'right' ? '오른쪽' : '왼쪽'} 다리 — 해당 없음
        </h2>
        <p className="text-sm text-gray-500 text-center">사유를 입력해주세요</p>
        <textarea
          value={skipReason}
          onChange={e => setSkipReason(e.target.value)}
          className="w-full p-3 border border-gray-300 rounded-xl text-base resize-none h-24 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="예: 좌측 슬하 절단"
          autoFocus
        />
        <div className="flex gap-3">
          <button
            onClick={() => { setSkipSide(null); setSkipReason(''); }}
            className="flex-1 py-3 border border-gray-300 rounded-xl text-base font-medium active:bg-gray-100"
          >
            취소
          </button>
          <button
            onClick={handleSkipConfirm}
            disabled={!skipReason.trim()}
            className="flex-1 py-3 bg-gray-600 text-white rounded-xl text-base font-medium disabled:opacity-40 active:bg-gray-700"
          >
            확인
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md space-y-6">
      <h2 className="text-lg font-bold text-center">측정할 다리를 선택하세요</h2>

      {/* Right leg */}
      <SideButton
        label="오른쪽 다리"
        result={rightResult}
        status={getSideStatus(rightResult)}
        onMeasure={() => onSelectSide('right')}
        onSkip={() => setSkipSide('right')}
      />

      {/* Left leg */}
      <SideButton
        label="왼쪽 다리"
        result={leftResult}
        status={getSideStatus(leftResult)}
        onMeasure={() => onSelectSide('left')}
        onSkip={() => setSkipSide('left')}
      />

      {/* Report generation button */}
      {bothDone && (
        <button
          onClick={onComplete}
          className="w-full py-4 bg-green-600 text-white text-lg font-bold rounded-xl active:bg-green-700 transition-colors"
        >
          레포트 생성
        </button>
      )}
    </div>
  );
}

function SideButton({
  label,
  result,
  status,
  onMeasure,
  onSkip,
}: {
  label: string;
  result: SideResult | null;
  status: string;
  onMeasure: () => void;
  onSkip: () => void;
}) {
  const done = result !== null;

  return (
    <div className={`p-4 rounded-2xl border-2 ${done ? 'border-gray-200 bg-gray-50' : 'border-blue-200 bg-white'}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-base font-semibold">{label}</span>
        {status && (
          <span className="text-sm text-gray-500">{status}</span>
        )}
      </div>

      {!done && (
        <div className="flex gap-2">
          <button
            onClick={onMeasure}
            className="flex-1 py-3 bg-blue-600 text-white text-base font-semibold rounded-xl active:bg-blue-700 transition-colors"
          >
            측정 시작
          </button>
          <button
            onClick={onSkip}
            className="px-4 py-3 border border-gray-300 text-gray-600 text-sm rounded-xl active:bg-gray-100"
          >
            해당 없음
          </button>
        </div>
      )}
    </div>
  );
}
