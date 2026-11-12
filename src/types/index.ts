export type Side = 'right' | 'left';

export interface PatientInfo {
  name: string;
  registrationNo: string;
  birthDate: string;      // YYYY-MM-DD
  gender: '남' | '여';
  examiner: string;
  institution: string;
}

export interface SensorSample {
  timestamp: number;       // ms since collection start
  alpha: number;           // deg/s (z-axis rotation rate)
  beta: number;            // deg/s (x-axis rotation rate) — primary axis
  gamma: number;           // deg/s (y-axis rotation rate)
  accX: number;            // m/s²
  accY: number;            // m/s²
  accZ: number;            // m/s²
}

export interface MeasurementData {
  side: Side;
  samples: SensorSample[];
  startIndex: number;      // index where motion detected
  endIndex: number;        // index where motion stopped
  samplingRate: number;    // Hz
  baselineAngle: number;   // deg at rest before drop
}

export interface AnalysisResult {
  side: Side;
  relaxationIndex: number;
  firstSwingExcursion: number;   // deg
  numberOfOscillations: number;
  firstExtensionAngle: number;   // deg
  angles: number[];              // processed angle array for graph
  timestamps: number[];          // seconds array for graph
  interpretation: string;        // auto-generated finding
}

export interface SkipInfo {
  side: Side;
  reason: string;
}

export type SideResult =
  | { type: 'measured'; data: MeasurementData; analysis: AnalysisResult }
  | { type: 'skipped'; info: SkipInfo };

export type AppPhase =
  | 'patient-info'
  | 'side-select'
  | 'measuring'
  | 'measure-result'
  | 'report';
