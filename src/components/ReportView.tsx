'use client';

import { useRef, useState } from 'react';
import type { PatientInfo, SideResult } from '@/types';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { generatePDF } from '@/lib/report-pdf';
import { generatePNG } from '@/lib/report-png';
import { generateCSV } from '@/lib/report-csv';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

interface Props {
  patient: PatientInfo;
  rightResult: SideResult;
  leftResult: SideResult;
  onReset: () => void;
}

export default function ReportView({ patient, rightResult, leftResult, onReset }: Props) {
  const reportRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const examDate = new Date().toISOString().split('T')[0];

  const download = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePDF = async () => {
    if (!reportRef.current) return;
    setExporting(true);
    try {
      const blob = await generatePDF(reportRef.current);
      download(blob, `경직진자검사_${patient.registrationNo}_${examDate}.pdf`);
    } finally {
      setExporting(false);
    }
  };

  const handlePNG = async () => {
    if (!reportRef.current) return;
    setExporting(true);
    try {
      const blob = await generatePNG(reportRef.current);
      download(blob, `경직진자검사_${patient.registrationNo}_${examDate}.png`);
    } finally {
      setExporting(false);
    }
  };

  const handleCSV = () => {
    const csv = generateCSV(patient, rightResult, leftResult, examDate);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    download(blob, `경직진자검사_${patient.registrationNo}_${examDate}.csv`);
  };

  const handleShare = async () => {
    if (!reportRef.current || !navigator.share) return;
    setExporting(true);
    try {
      const blob = await generatePNG(reportRef.current);
      const file = new File([blob], `경직진자검사_${patient.registrationNo}.png`, { type: 'image/png' });
      await navigator.share({ files: [file], title: '경직진자검사 보고서' });
    } catch {
      // User cancelled share
    } finally {
      setExporting(false);
    }
  };

  const getVal = (result: SideResult, key: 'ri' | 'swing' | 'osc' | 'ext') => {
    if (result.type !== 'measured') return 'N/A';
    const a = result.analysis;
    switch (key) {
      case 'ri': return a.relaxationIndex.toFixed(2);
      case 'swing': return `${a.firstSwingExcursion.toFixed(1)}°`;
      case 'osc': return `${a.numberOfOscillations}`;
      case 'ext': return `${a.firstExtensionAngle.toFixed(1)}°`;
    }
  };

  const getInterp = (result: SideResult, label: string) => {
    if (result.type === 'measured') return `${label}: ${result.analysis.interpretation}`;
    return `${label}: 측정 불가 (${result.info.reason})`;
  };

  return (
    <div className="w-full max-w-2xl space-y-4">
      {/* Report content for export */}
      <div ref={reportRef} className="bg-white p-6 space-y-5" style={{ width: '210mm', maxWidth: '100%' }}>
        {/* Header */}
        <div className="text-center border-b-2 border-gray-800 pb-3">
          <h1 className="text-xl font-bold">경직진자검사 보고서</h1>
          <p className="text-sm text-gray-500">Spasticity Pendulum Test</p>
          <div className="flex justify-center gap-8 mt-2 text-sm">
            <span>검사일: {examDate}</span>
            <span>청구코드: <strong>EX776</strong></span>
          </div>
        </div>

        {/* Patient Info */}
        <div className="border rounded-lg p-4">
          <h2 className="text-sm font-semibold text-gray-500 mb-2">환자정보</h2>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>성명: <strong>{patient.name}</strong></div>
            <div>등록번호: <strong>{patient.registrationNo}</strong></div>
            <div>생년월일: <strong>{patient.birthDate}</strong></div>
            <div>성별: <strong>{patient.gender}</strong></div>
          </div>
        </div>

        {/* Results Table */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 mb-2">검사 결과</h2>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-2 text-left">지표</th>
                <th className="border p-2 text-center">우측</th>
                <th className="border p-2 text-center">좌측</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border p-2">Relaxation Index (RI)</td>
                <td className="border p-2 text-center font-semibold">{getVal(rightResult, 'ri')}</td>
                <td className="border p-2 text-center font-semibold">{getVal(leftResult, 'ri')}</td>
              </tr>
              <tr>
                <td className="border p-2">1st Swing Excursion</td>
                <td className="border p-2 text-center">{getVal(rightResult, 'swing')}</td>
                <td className="border p-2 text-center">{getVal(leftResult, 'swing')}</td>
              </tr>
              <tr>
                <td className="border p-2">Number of Oscillations</td>
                <td className="border p-2 text-center">{getVal(rightResult, 'osc')}</td>
                <td className="border p-2 text-center">{getVal(leftResult, 'osc')}</td>
              </tr>
              <tr>
                <td className="border p-2">1st Extension Angle</td>
                <td className="border p-2 text-center">{getVal(rightResult, 'ext')}</td>
                <td className="border p-2 text-center">{getVal(leftResult, 'ext')}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Graphs */}
        <div className="space-y-4">
          <GraphSection label="우측 하지" result={rightResult} color="rgb(59, 130, 246)" />
          <GraphSection label="좌측 하지" result={leftResult} color="rgb(239, 68, 68)" />
        </div>

        {/* Interpretation */}
        <div className="border rounded-lg p-4">
          <h2 className="text-sm font-semibold text-gray-500 mb-2">소견</h2>
          <p className="text-sm">{getInterp(rightResult, '우측 하지')}</p>
          <p className="text-sm">{getInterp(leftResult, '좌측 하지')}</p>
          <p className="text-xs text-gray-400 mt-2">정상 범위: RI ≥ 1.4</p>
        </div>

        {/* References */}
        <div className="text-xs text-gray-500">
          <h2 className="font-semibold mb-1">References</h2>
          <ol className="list-decimal list-inside space-y-0.5">
            <li>Wartenberg R. Pendulousness of the legs as a diagnostic test. Arch Neurol Psychiatry. 1951;66:18-21</li>
            <li>Bajd T, Vodovnik L. Pendulum testing of spasticity. J Biomed Eng. 1984;6(1):9-16</li>
            <li>Stillman B, McMeeken J. A video analysis of the pendulum test. Arch Phys Med Rehabil. 1995;76(2):166-176</li>
          </ol>
        </div>

        {/* Examiner */}
        <div className="border-t-2 border-gray-800 pt-3 flex justify-between text-sm">
          <div>검사자: {patient.examiner}</div>
          <div>검사기관: {patient.institution}</div>
        </div>
      </div>

      {/* Export buttons (not part of report) */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={handlePDF}
          disabled={exporting}
          className="py-3 bg-red-600 text-white rounded-xl font-semibold active:bg-red-700 disabled:opacity-50"
        >
          PDF 다운로드
        </button>
        <button
          onClick={handlePNG}
          disabled={exporting}
          className="py-3 bg-blue-600 text-white rounded-xl font-semibold active:bg-blue-700 disabled:opacity-50"
        >
          PNG 다운로드
        </button>
        <button
          onClick={handleCSV}
          className="py-3 bg-green-600 text-white rounded-xl font-semibold active:bg-green-700"
        >
          CSV 다운로드
        </button>
        {typeof navigator !== 'undefined' && 'share' in navigator && (
          <button
            onClick={handleShare}
            disabled={exporting}
            className="py-3 bg-yellow-500 text-white rounded-xl font-semibold active:bg-yellow-600 disabled:opacity-50"
          >
            공유
          </button>
        )}
      </div>

      <button
        onClick={onReset}
        className="w-full py-3 border border-gray-300 rounded-xl text-gray-600 font-medium active:bg-gray-100"
      >
        새 검사 시작
      </button>
    </div>
  );
}

function GraphSection({
  label,
  result,
  color,
}: {
  label: string;
  result: SideResult;
  color: string;
}) {
  if (result.type === 'skipped') {
    return (
      <div className="border rounded-lg p-4 bg-gray-50 text-center">
        <h3 className="text-sm font-semibold mb-2">{label} 진자 그래프</h3>
        <p className="text-gray-400 text-sm">측정 불가: {result.info.reason}</p>
      </div>
    );
  }

  const { angles, timestamps } = result.analysis;

  const data = {
    labels: timestamps.map(t => t.toFixed(1)),
    datasets: [
      {
        label: `${label} 각도 (°)`,
        data: angles,
        borderColor: color,
        borderWidth: 1.5,
        pointRadius: 0,
        tension: 0.1,
        fill: false,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: true,
    animation: false as const,
    plugins: {
      legend: { display: false },
      title: {
        display: true,
        text: `${label} 진자 그래프`,
        font: { size: 12 },
      },
    },
    scales: {
      x: {
        title: { display: true, text: '시간 (s)', font: { size: 10 } },
        ticks: { maxTicksLimit: 10, font: { size: 9 } },
      },
      y: {
        title: { display: true, text: '각도 (°)', font: { size: 10 } },
        ticks: { font: { size: 9 } },
      },
    },
  };

  return (
    <div className="border rounded-lg p-3">
      <Line data={data} options={options} />
    </div>
  );
}
