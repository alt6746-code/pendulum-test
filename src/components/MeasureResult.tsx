'use client';

import type { AnalysisResult } from '@/types';

interface Props {
  analysis: AnalysisResult;
  onNext: () => void;
}

export default function MeasureResult({ analysis, onNext }: Props) {
  const sideLabel = analysis.side === 'right' ? '오른쪽' : '왼쪽';

  const riColor =
    analysis.relaxationIndex >= 1.4 ? 'text-green-600' :
    analysis.relaxationIndex >= 1.0 ? 'text-yellow-600' :
    analysis.relaxationIndex >= 0.6 ? 'text-orange-600' :
    'text-red-600';

  return (
    <div className="w-full max-w-md space-y-6">
      <div className="text-center">
        <div className="text-4xl mb-2">✅</div>
        <h2 className="text-xl font-bold">{sideLabel} 다리 측정 완료</h2>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border p-5 space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-500">Relaxation Index (RI)</span>
          <span className={`text-2xl font-bold ${riColor}`}>
            {analysis.relaxationIndex.toFixed(2)}
          </span>
        </div>
        <hr />
        <div className="flex justify-between">
          <span className="text-sm text-gray-500">1st Swing Excursion</span>
          <span className="font-medium">{analysis.firstSwingExcursion.toFixed(1)}°</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-gray-500">Oscillations</span>
          <span className="font-medium">{analysis.numberOfOscillations}회</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-gray-500">1st Extension Angle</span>
          <span className="font-medium">{analysis.firstExtensionAngle.toFixed(1)}°</span>
        </div>
        <hr />
        <p className="text-sm text-gray-700">{analysis.interpretation}</p>
      </div>

      <button
        onClick={onNext}
        className="w-full py-4 bg-blue-600 text-white text-lg font-semibold rounded-xl active:bg-blue-700 transition-colors"
      >
        다음
      </button>
    </div>
  );
}
