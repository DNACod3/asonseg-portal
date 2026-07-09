'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Input, Label, Textarea } from '@/shared/ui';
// Import direto do módulo `'use server'` (não do barrel `@/modules/persons`):
// este é um Client Component e o barrel reexporta código server-only (Prisma,
// `next/headers` via as demais actions/queries), que o Next se recusa a
// empacotar no bundle do cliente. O arquivo da action é `'use server'`, então o
// import vira um stub RPC client-safe. Precedente: `candidate-form.tsx` (ADR-0017).
// eslint-disable-next-line no-restricted-imports
import { saveSocioeconomicRecord } from '@/modules/persons/actions/save-socioeconomic-record';
import {
  socioeconomicRecordSchema,
  type SocioeconomicRecordInput,
} from '../schemas/socioeconomic-record.schema';
import {
  INCOME_BRACKETS,
  INCOME_BRACKET_LABELS,
  HOUSING_SITUATIONS,
  HOUSING_SITUATION_LABELS,
} from '../domain/socioeconomic-record';

// `<select>` nativo não tem primitivo no DS (só Input/Textarea) — mesmo estilo
// por token de `candidate-form.tsx`/`job-form.tsx` (AD-014).
const selectClass =
  'w-full rounded-sm border-[1.5px] border-border bg-surface px-4 py-3 text-[0.95rem] text-fg transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-60';
const errorClass = 'mt-1 text-xs text-danger';

/** Subset de `SocioeconomicRecordView` que o form consome para pré-preenchimento. */
export interface SocioeconomicRecordFormInitial {
  incomeBracket: string | null;
  socialBenefit: string | null;
  housingSituation: string | null;
  familyComposition: string | null;
}

export interface SocioeconomicRecordFormProps {
  personId: string;
  /** Ficha já existente, para pré-preenchimento (edição). `undefined`/null = 1ª gravação. */
  initial?: SocioeconomicRecordFormInitial | null;
}

/**
 * Formulário da ficha socioeconômica (USP-036 / AC-036-1) — os 4 campos
 * declarados: renda aproximada, benefício social, situação de moradia e
 * composição familiar. Submete a `saveSocioeconomicRecord` (upsert auditado).
 */
export function SocioeconomicRecordForm({ personId, initial }: SocioeconomicRecordFormProps) {
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SocioeconomicRecordInput>({
    resolver: zodResolver(socioeconomicRecordSchema),
    defaultValues: {
      personId,
      incomeBracket: (initial?.incomeBracket ?? '') as SocioeconomicRecordInput['incomeBracket'],
      socialBenefit: initial?.socialBenefit ?? '',
      housingSituation: (initial?.housingSituation ?? '') as SocioeconomicRecordInput['housingSituation'],
      familyComposition: initial?.familyComposition ?? '',
    },
  });

  function onSubmit(data: SocioeconomicRecordInput) {
    setServerError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await saveSocioeconomicRecord({ ...data, personId });
      if (!result.ok) {
        setServerError(result.error.message);
        return;
      }
      setSaved(true);
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <input type="hidden" {...register('personId')} />

      {/* Renda aproximada */}
      <div>
        <Label htmlFor="incomeBracket">
          Renda aproximada <span className="font-normal text-fg-muted">(opcional)</span>
        </Label>
        <select id="incomeBracket" className={selectClass} defaultValue="" {...register('incomeBracket')}>
          <option value="">Não informar…</option>
          {INCOME_BRACKETS.map((bracket) => (
            <option key={bracket} value={bracket}>
              {INCOME_BRACKET_LABELS[bracket]}
            </option>
          ))}
        </select>
        {errors.incomeBracket && <p className={errorClass}>{errors.incomeBracket.message}</p>}
      </div>

      {/* Benefício social recebido */}
      <div>
        <Label htmlFor="socialBenefit">
          Benefício social recebido <span className="font-normal text-fg-muted">(opcional)</span>
        </Label>
        <Input id="socialBenefit" type="text" {...register('socialBenefit')} />
        {errors.socialBenefit && <p className={errorClass}>{errors.socialBenefit.message}</p>}
      </div>

      {/* Situação de moradia */}
      <div>
        <Label htmlFor="housingSituation">
          Situação de moradia <span className="font-normal text-fg-muted">(opcional)</span>
        </Label>
        <select
          id="housingSituation"
          className={selectClass}
          defaultValue=""
          {...register('housingSituation')}
        >
          <option value="">Não informar…</option>
          {HOUSING_SITUATIONS.map((situation) => (
            <option key={situation} value={situation}>
              {HOUSING_SITUATION_LABELS[situation]}
            </option>
          ))}
        </select>
        {errors.housingSituation && <p className={errorClass}>{errors.housingSituation.message}</p>}
      </div>

      {/* Composição familiar declarada */}
      <div>
        <Label htmlFor="familyComposition">
          Composição familiar declarada <span className="font-normal text-fg-muted">(opcional)</span>
        </Label>
        <Textarea id="familyComposition" rows={3} {...register('familyComposition')} />
        {errors.familyComposition && <p className={errorClass}>{errors.familyComposition.message}</p>}
      </div>

      {serverError && (
        <div
          role="alert"
          className="rounded-lg bg-[color-mix(in_srgb,var(--color-danger)_10%,transparent)] p-3 text-sm text-danger"
        >
          {serverError}
        </div>
      )}

      {saved && !serverError && (
        <div role="status" className="rounded-lg bg-[color-mix(in_srgb,var(--color-primary)_10%,transparent)] p-3 text-sm text-primary">
          Ficha salva com sucesso.
        </div>
      )}

      <Button type="submit" variant="primary" disabled={isPending}>
        {isPending ? 'Salvando…' : 'Salvar ficha'}
      </Button>
    </form>
  );
}
