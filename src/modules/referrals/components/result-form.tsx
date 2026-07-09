'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Label, Textarea } from '@/shared/ui';
// Import relativo direto do arquivo `'use server'` (não do barrel `@/modules/referrals`).
// Mesmo padrão de `referral-form.tsx`/`socioeconomic-record-form.tsx` (ADR-0017).
import { registerReferralResult } from '../actions/register-referral-result';
import {
  registerReferralResultSchema,
  type RegisterReferralResultInput,
} from '../schemas/referral.schema';

// `<select>` nativo não tem primitivo no DS (só Input/Textarea) — mesmo estilo
// por token de `socioeconomic-record-form.tsx`/`candidate-form.tsx` (AD-014).
const selectClass =
  'w-full rounded-sm border-[1.5px] border-border bg-surface px-4 py-3 text-[0.95rem] text-fg transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-60';
const errorClass = 'mt-1 text-xs text-danger';

/** Rótulos PT-BR dos 4 resultados possíveis (USP-038 / AC-038-2). */
const RESULT_LABELS = {
  HIRED: 'Contratado',
  NOT_SELECTED: 'Não selecionado',
  UNDER_REVIEW: 'Em análise',
  NO_RESPONSE: 'Sem resposta',
} as const;

const RESULT_OPTIONS = Object.keys(RESULT_LABELS) as Array<keyof typeof RESULT_LABELS>;

export interface ResultFormProps {
  referralId: string;
  /** Resultado já registrado, para pré-preenchimento (re-registro — EC-4). */
  initialResult?: keyof typeof RESULT_LABELS | null;
  initialObservation?: string | null;
}

/**
 * Formulário de registro de resultado do encaminhamento (USP-038 / AC-038-1..3)
 * — fatia vertical fina. Seletor com os 4 valores + observação opcional.
 * Submete a `registerReferralResult` (Server Action). Re-registro sobrescreve
 * (EC-4) — o histórico fica no audit_log.
 */
export function ResultForm({ referralId, initialResult, initialObservation }: ResultFormProps) {
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterReferralResultInput>({
    resolver: zodResolver(registerReferralResultSchema),
    defaultValues: {
      referralId,
      result: initialResult ?? undefined,
      observation: initialObservation ?? undefined,
    },
  });

  function onSubmit(data: RegisterReferralResultInput) {
    setServerError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await registerReferralResult({ ...data, referralId });
      if (!result.ok) {
        setServerError(result.error.message);
        return;
      }
      setSaved(true);
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <input type="hidden" {...register('referralId')} />

      <div>
        <Label htmlFor="result">Resultado</Label>
        <select id="result" className={selectClass} defaultValue={initialResult ?? ''} {...register('result')}>
          <option value="" disabled>
            Selecione…
          </option>
          {RESULT_OPTIONS.map((value) => (
            <option key={value} value={value}>
              {RESULT_LABELS[value]}
            </option>
          ))}
        </select>
        {errors.result && <p className={errorClass}>{errors.result.message}</p>}
      </div>

      <div>
        <Label htmlFor="observation">
          Observação <span className="font-normal text-fg-muted">(opcional)</span>
        </Label>
        <Textarea id="observation" rows={3} {...register('observation')} />
        {errors.observation && <p className={errorClass}>{errors.observation.message}</p>}
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
        <div
          role="status"
          className="rounded-lg bg-[color-mix(in_srgb,var(--color-primary)_10%,transparent)] p-3 text-sm text-primary"
        >
          Resultado registrado com sucesso.
        </div>
      )}

      <Button type="submit" variant="primary" disabled={isPending}>
        {isPending ? 'Salvando…' : 'Salvar resultado'}
      </Button>
    </form>
  );
}
