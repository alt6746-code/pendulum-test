import type { PatientInfo, SideResult, AnalysisResult, MeasurementData } from '@/types';
import { generateCSV } from '@/lib/report-csv';

const mockPatient: PatientInfo = {
  name: '홍길동',
  registrationNo: '12345678',
  birthDate: '1965-03-15',
  gender: '남',
  examiner: '김검사',
  institution: '한빛재활병원',
};

const mockAnalysis: AnalysisResult = {
  side: 'right',
  relaxationIndex: 0.82,
  firstSwingExcursion: 45.2,
  numberOfOscillations: 3,
  firstExtensionAngle: 12.3,
  angles: [],
  timestamps: [],
  interpretation: 'RI 0.82로 중등도 경직 소견 (moderate spasticity)',
};

const mockData: MeasurementData = {
  side: 'right',
  samples: [],
  startIndex: 0,
  endIndex: 0,
  samplingRate: 60,
  baselineAngle: 0,
};

const rightMeasured: SideResult = { type: 'measured', data: mockData, analysis: mockAnalysis };

const leftMeasured: SideResult = {
  type: 'measured',
  data: { ...mockData, side: 'left' },
  analysis: {
    ...mockAnalysis,
    side: 'left',
    relaxationIndex: 1.65,
    firstSwingExcursion: 78.5,
    numberOfOscillations: 7,
    firstExtensionAngle: 25.1,
    interpretation: 'RI 1.65로 정상 범위 내',
  },
};

const leftSkipped: SideResult = {
  type: 'skipped',
  info: { side: 'left', reason: '좌측 슬하 절단' },
};

describe('generateCSV', () => {
  test('양쪽 측정 데이터 CSV 생성', () => {
    const csv = generateCSV(mockPatient, rightMeasured, leftMeasured, '2026-11-12');

    expect(csv).toContain('EX776');
    expect(csv).toContain('홍길동');
    expect(csv).toContain('12345678');
    expect(csv).toContain('Relaxation Index');
    expect(csv).toContain('0.82');
    expect(csv).toContain('1.65');
    expect(csv).toContain('한빛재활병원');
  });

  test('한쪽 N/A인 경우 CSV에 N/A 표시', () => {
    const csv = generateCSV(mockPatient, rightMeasured, leftSkipped, '2026-11-12');

    expect(csv).toContain('N/A');
    expect(csv).toContain('절단');
  });

  test('BOM 포함', () => {
    const csv = generateCSV(mockPatient, rightMeasured, leftMeasured, '2026-11-12');
    expect(csv.charCodeAt(0)).toBe(0xFEFF);
  });
});
