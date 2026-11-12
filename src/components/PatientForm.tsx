'use client';

import { useState } from 'react';
import type { PatientInfo } from '@/types';

interface Props {
  onSubmit: (info: PatientInfo) => void;
}

export default function PatientForm({ onSubmit }: Props) {
  const [form, setForm] = useState<PatientInfo>({
    name: '',
    registrationNo: '',
    birthDate: '',
    gender: '남',
    examiner: '',
    institution: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof PatientInfo, string>>>({});

  const validate = (): boolean => {
    const errs: typeof errors = {};

    if (!form.name.trim()) errs.name = '성명을 입력해주세요';
    if (!form.registrationNo.trim()) {
      errs.registrationNo = '등록번호를 입력해주세요';
    } else if (!/^\d+$/.test(form.registrationNo.trim())) {
      errs.registrationNo = '숫자만 입력 가능합니다';
    }
    if (!form.birthDate) errs.birthDate = '생년월일을 선택해주세요';
    if (!form.examiner.trim()) errs.examiner = '검사자를 입력해주세요';
    if (!form.institution.trim()) errs.institution = '검사기관을 입력해주세요';

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onSubmit({
        ...form,
        name: form.name.trim(),
        registrationNo: form.registrationNo.trim(),
        examiner: form.examiner.trim(),
        institution: form.institution.trim(),
      });
    }
  };

  const update = (key: keyof PatientInfo, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: undefined }));
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md space-y-4">
      <h1 className="text-xl font-bold text-center mb-6">경직진자검사</h1>
      <p className="text-sm text-gray-500 text-center mb-4">Spasticity Pendulum Test (EX776)</p>

      <Field label="성명" error={errors.name}>
        <input
          type="text"
          value={form.name}
          onChange={e => update('name', e.target.value)}
          className="input-field"
          placeholder="환자 성명"
          autoComplete="off"
        />
      </Field>

      <Field label="등록번호" error={errors.registrationNo}>
        <input
          type="text"
          inputMode="numeric"
          value={form.registrationNo}
          onChange={e => update('registrationNo', e.target.value)}
          className="input-field"
          placeholder="숫자만 입력"
          autoComplete="off"
        />
      </Field>

      <Field label="생년월일" error={errors.birthDate}>
        <input
          type="date"
          value={form.birthDate}
          onChange={e => update('birthDate', e.target.value)}
          className="input-field"
        />
      </Field>

      <Field label="성별">
        <div className="flex gap-4">
          {(['남', '여'] as const).map(g => (
            <label key={g} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="gender"
                checked={form.gender === g}
                onChange={() => update('gender', g)}
                className="w-5 h-5"
              />
              <span className="text-base">{g}</span>
            </label>
          ))}
        </div>
      </Field>

      <Field label="검사자" error={errors.examiner}>
        <input
          type="text"
          value={form.examiner}
          onChange={e => update('examiner', e.target.value)}
          className="input-field"
          placeholder="검사자 성명"
          autoComplete="off"
        />
      </Field>

      <Field label="검사기관" error={errors.institution}>
        <input
          type="text"
          value={form.institution}
          onChange={e => update('institution', e.target.value)}
          className="input-field"
          placeholder="병원/기관명"
          autoComplete="off"
        />
      </Field>

      <button
        type="submit"
        className="w-full py-4 bg-blue-600 text-white text-lg font-semibold rounded-xl active:bg-blue-700 transition-colors"
      >
        다음
      </button>
    </form>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
}
