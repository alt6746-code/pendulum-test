import type { PatientInfo, SideResult } from '@/types';

/**
 * Generate CSV report content with BOM for UTF-8 Excel compatibility.
 */
export function generateCSV(
  patient: PatientInfo,
  right: SideResult,
  left: SideResult,
  examDate: string,
): string {
  const BOM = '\uFEFF';
  const lines: string[] = [];

  // Header info
  lines.push('경직진자검사 보고서 (Spasticity Pendulum Test)');
  lines.push(`검사일,${examDate}`);
  lines.push(`청구코드,EX776`);
  lines.push('');

  // Patient info
  lines.push('환자정보');
  lines.push(`성명,${patient.name}`);
  lines.push(`등록번호,${patient.registrationNo}`);
  lines.push(`생년월일,${patient.birthDate}`);
  lines.push(`성별,${patient.gender}`);
  lines.push('');

  // Results table
  lines.push('검사 결과');
  lines.push('지표,우측,좌측');

  const rightVals = getValues(right);
  const leftVals = getValues(left);

  lines.push(`Relaxation Index (RI),${rightVals.ri},${leftVals.ri}`);
  lines.push(`1st Swing Excursion (°),${rightVals.swing},${leftVals.swing}`);
  lines.push(`Number of Oscillations,${rightVals.osc},${leftVals.osc}`);
  lines.push(`1st Extension Angle (°),${rightVals.ext},${leftVals.ext}`);
  lines.push('');

  // Interpretation
  lines.push('소견');
  lines.push(`우측,${rightVals.interp}`);
  lines.push(`좌측,${leftVals.interp}`);
  lines.push('');

  // Examiner
  lines.push(`검사자,${patient.examiner}`);
  lines.push(`검사기관,${patient.institution}`);

  return BOM + lines.join('\n');
}

function getValues(result: SideResult) {
  if (result.type === 'measured') {
    const a = result.analysis;
    return {
      ri: a.relaxationIndex.toFixed(2),
      swing: a.firstSwingExcursion.toFixed(1),
      osc: a.numberOfOscillations.toString(),
      ext: a.firstExtensionAngle.toFixed(1),
      interp: a.interpretation,
    };
  }
  const reason = `N/A (${result.info.reason})`;
  return { ri: reason, swing: reason, osc: reason, ext: reason, interp: reason };
}
