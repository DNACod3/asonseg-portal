'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Input, Label, Textarea } from '@/shared/ui';
// Import relativo direto do arquivo `'use server'` (não do barrel `@/modules/referrals`):
// este é um Client Component, e o barrel do PRÓPRIO módulo reexporta código
// server-only. Mesmo padrão de `socioeconomic-record-form.tsx` (ADR-0017).
import { createReferral } from '../actions/create-referral';
import { createReferralSchema, type CreateReferralInput } from '../schemas/referral.schema';

const errorClass = 'mt-1 text-xs text-danger';

export interface ReferralFormProps {
  /** Pessoa pré-selecionada (ex.: link vindo da ficha da Pessoa). */
  initialPersonId?: string;
  /** Vaga pré-selecionada (ex.: link vindo do detalhe da vaga). */
  initialJobId?: string;
}

/**
 * Formulário de encaminhamento institucional (USP-037 / AC-037-1..5) — fatia
 * vertical fina. O campo **resumo profissional** só é exibido/obrigatório
 * quando a AS marca "Pessoa sem CV anexado" (REF-MN-03; a obrigatoriedade
 * real é validada por `createReferral`, que conhece o `CandidateProfile` da
 * Pessoa — este toggle é só UX: evita pedir o resumo quando desnecessário).
 * Submete a `createReferral` (Server Action).
 */
export function ReferralForm({ initialPersonId, initialJobId }: ReferralFormProps) {
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [created, setCreated] = useState(false);
  const [semCv, setSemCv] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateReferralInput>({
    resolver: zodResolver(createReferralSchema),
    defaultValues: {
      personId: initialPersonId ?? '',
      jobId: initialJobId ?? '',
      // undefined (não ''): o schema rejeita professionalSummary presente-porém-vazio
      // (trim().min(1)) — um valor não enviado precisa ficar ausente, não string vazia.
      professionalSummary: undefined,
      justification: undefined,
    },
  });

  function onSubmit(data: CreateReferralInput) {
    setServerError(null);
    setCreated(false);
    startTransition(async () => {
      const result = await createReferral({
        personId: data.personId,
        jobId: data.jobId,
        professionalSummary: semCv ? data.professionalSummary : undefined,
        justification: data.justification,
      });
      if (!result.ok) {
        setServerError(result.error.message);
        return;
      }
      setCreated(true);
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <div>
        <Label htmlFor="personId">Pessoa (id)</Label>
        <Input id="personId" type="text" {...register('personId')} />
        {errors.personId && <p className={errorClass}>{errors.personId.message}</p>}
      </div>

      <div>
        <Label htmlFor="jobId">Vaga (id)</Label>
        <Input id="jobId" type="text" {...register('jobId')} />
        {errors.jobId && <p className={errorClass}>{errors.jobId.message}</p>}
      </div>

      <div className="flex items-center gap-2">
        <input
          id="semCv"
          type="checkbox"
          checked={semCv}
          onChange={(e) => setSemCv(e.target.checked)}
          className="h-4 w-4"
        />
        <Label htmlFor="semCv">Pessoa não possui CV anexado</Label>
      </div>

      {semCv && (
        <div>
          <Label htmlFor="professionalSummary">
            Resumo profissional <span className="font-normal text-fg-muted">(obrigatório — Pessoa sem CV)</span>
          </Label>
          <Textarea id="professionalSummary" rows={4} {...register('professionalSummary')} />
          {errors.professionalSummary && <p className={errorClass}>{errors.professionalSummary.message}</p>}
        </div>
      )}

      <div>
        <Label htmlFor="justification">
          Motivo do encaminhamento <span className="font-normal text-fg-muted">(opcional)</span>
        </Label>
        <Textarea id="justification" rows={3} {...register('justification')} />
        {errors.justification && <p className={errorClass}>{errors.justification.message}</p>}
      </div>

      {serverError && (
        <div
          role="alert"
          className="rounded-lg bg-[color-mix(in_srgb,var(--color-danger)_10%,transparent)] p-3 text-sm text-danger"
        >
          {serverError}
        </div>
      )}

      {created && !serverError && (
        <div
          role="status"
          className="rounded-lg bg-[color-mix(in_srgb,var(--color-primary)_10%,transparent)] p-3 text-sm text-primary"
        >
          Encaminhamento criado com sucesso.
        </div>
      )}

      <Button type="submit" variant="primary" disabled={isPending}>
        {isPending ? 'Encaminhando…' : 'Encaminhar'}
      </Button>
    </form>
  );
}
