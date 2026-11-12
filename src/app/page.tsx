'use client';

import { useState, useCallback } from 'react';
import type { AppPhase, PatientInfo, Side, SideResult, MeasurementData, AnalysisResult } from '@/types';
import PatientForm from '@/components/PatientForm';
import SideSelector from '@/components/SideSelector';
import Measurement from '@/components/Measurement';
import MeasureResult from '@/components/MeasureResult';
import ReportView from '@/components/ReportView';

export default function Home() {
  const [phase, setPhase] = useState<AppPhase>('patient-info');
  const [patient, setPatient] = useState<PatientInfo | null>(null);
  const [currentSide, setCurrentSide] = useState<Side>('right');
  const [rightResult, setRightResult] = useState<SideResult | null>(null);
  const [leftResult, setLeftResult] = useState<SideResult | null>(null);
  const [currentAnalysis, setCurrentAnalysis] = useState<AnalysisResult | null>(null);
  const [failMessage, setFailMessage] = useState<string | null>(null);

  const handlePatientSubmit = (info: PatientInfo) => {
    setPatient(info);
    setPhase('side-select');
  };

  const handleSelectSide = (side: Side) => {
    setCurrentSide(side);
    setFailMessage(null);
    setPhase('measuring');
  };

  const handleSkipSide = (side: Side, reason: string) => {
    const skipResult: SideResult = { type: 'skipped', info: { side, reason } };
    if (side === 'right') setRightResult(skipResult);
    else setLeftResult(skipResult);
  };

  const handleMeasureSuccess = useCallback((data: MeasurementData, analysis: AnalysisResult) => {
    const result: SideResult = { type: 'measured', data, analysis };
    if (currentSide === 'right') setRightResult(result);
    else setLeftResult(result);
    setCurrentAnalysis(analysis);
    setPhase('measure-result');
  }, [currentSide]);

  const handleMeasureFail = useCallback((message: string) => {
    setFailMessage(message);
    setPhase('side-select');
  }, []);

  const handleNextAfterResult = () => {
    setCurrentAnalysis(null);
    setPhase('side-select');
  };

  const handleGoToReport = () => {
    setPhase('report');
  };

  const handleReset = () => {
    setPhase('patient-info');
    setPatient(null);
    setRightResult(null);
    setLeftResult(null);
    setCurrentAnalysis(null);
    setFailMessage(null);
  };

  return (
    <main className="flex-1 flex flex-col items-center justify-center p-4">
      {phase === 'patient-info' && (
        <PatientForm onSubmit={handlePatientSubmit} />
      )}

      {phase === 'side-select' && (
        <div className="w-full max-w-md space-y-4">
          {failMessage && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
              ⚠️ {failMessage}
            </div>
          )}
          <SideSelector
            rightResult={rightResult}
            leftResult={leftResult}
            onSelectSide={handleSelectSide}
            onSkipSide={handleSkipSide}
            onComplete={handleGoToReport}
          />
        </div>
      )}

      {phase === 'measuring' && (
        <Measurement
          side={currentSide}
          onComplete={handleMeasureSuccess}
          onFail={handleMeasureFail}
        />
      )}

      {phase === 'measure-result' && currentAnalysis && (
        <MeasureResult
          analysis={currentAnalysis}
          onNext={handleNextAfterResult}
        />
      )}

      {phase === 'report' && patient && rightResult && leftResult && (
        <ReportView
          patient={patient}
          rightResult={rightResult}
          leftResult={leftResult}
          onReset={handleReset}
        />
      )}
    </main>
  );
}
