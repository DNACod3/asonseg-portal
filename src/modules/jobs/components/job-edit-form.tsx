'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import type { ActionError } from '@/shared/errors';
import { editJobSchema, type EditJobInput } from '../schemas/publish-job.schema';
import { editJob } from '../actions/edit-job';
import { submitJobForModeration } from '../actions/submit-job-for-moderation';
import type { JobAreaOption } from '../queries/list-approved-job-areas';
import type { RegionOption } from '../queries/list-active-regions';
import { Button, Input, Label, Textarea } from '@/shared/ui';

const selectClass =
  'w-full rounded-sm border-[1.5px] border-border bg-surface px-4 py-3 text-[0.95rem] text-fg transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-60';
const errorClass = 'mt-1 text-xs text-danger';

export interface JobEditFormProps {
  jobId: string;
  jobAreas: JobAreaOption[];
  regions: RegionOption[];
  /** Valores atuais da vaga (ACTIVE) — pré-preenchem o formulário (AC-023-1). */
  initialValues: Omit<EditJobInput, 'jobId'>;
}

/**
 * Formulário de edição de uma vaga `ACTIVE` (USP-023 / T9 / E-001 / AC-023-1).
 * Mesmos campos e padrões visuais de `JobForm` (AD-014), restrito ao subconjunto
 * de `editJobSchema` (sem `companyId`/`validUntil` — imutável e fora de escopo
 * aqui, respectivamente). No submit: `editJob` (→ `DRAFT`) e, em sucesso,
 * encadeia `submitJobForModeration({ jobId })` (→ `IN_MODERATION`) — a UI nunca
 * deixa a vaga parada em `DRAFT` sem reenvio (D-001 do intent).
 */
export function JobEditForm({ jobId, jobAreas, regions, initialValues }: JobEditFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<Omit<EditJobInput, 'jobId'>>({
    resolver: zodResolver(editJobSchema.omit({ jobId: true })),
    defaultValues: initialValues,
  });

  function applyFieldErrors(error: ActionError) {
    if (!error.fieldErrors) return;
    for (const [field, messages] of Object.entries(error.fieldErrors)) {
      if (messages?.[0]) setError(field as keyof Omit<EditJobInput, 'jobId'>, { message: messages[0] });
    }
  }

  function onSubmit(data: Omit<EditJobInput, 'jobId'>) {
    setServerError(null);
    setSuccess(null);
    startTransition(async () => {
      const editResult = await editJob({ jobId, ...data });
      if (!editResult.ok) {
        applyFieldErrors(editResult.error);
        setServerError(editResult.error.message);
        return;
      }
      const submitResult = await submitJobForModeration({ jobId });
      if (!submitResult.ok) {
        setServerError(submitResult.error.message);
        return;
      }
      setSuccess('Vaga enviada para moderação. Ela ficará visível após a aprovação.');
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex max-w-lg flex-col gap-5">
      <div>
        <Label htmlFor="title">Título da vaga</Label>
        <Input id="title" type="text" {...register('title')} />
        {errors.title && <p className={errorClass}>{errors.title.message}</p>}
      </div>

      <div>
        <Label htmlFor="areaId">Área de atuação</Label>
        <select id="areaId" className={selectClass} defaultValue={initialValues.areaId} {...register('areaId')}>
          <option value="" disabled>
            Selecione…
          </option>
          {jobAreas.map((area) => (
            <option key={area.id} value={area.id}>
              {area.name}
            </option>
          ))}
        </select>
        {errors.areaId && <p className={errorClass}>{errors.areaId.message}</p>}
      </div>

      <div>
        <Label htmlFor="description">Descrição</Label>
        <Textarea id="description" rows={4} {...register('description')} />
        {errors.description && <p className={errorClass}>{errors.description.message}</p>}
      </div>

      <div>
        <Label htmlFor="requirements">Requisitos</Label>
        <Textarea id="requirements" rows={3} {...register('requirements')} />
        {errors.requirements && <p className={errorClass}>{errors.requirements.message}</p>}
      </div>

      <div>
        <Label htmlFor="workRegime">Regime de trabalho</Label>
        <Input id="workRegime" type="text" {...register('workRegime')} />
        {errors.workRegime && <p className={errorClass}>{errors.workRegime.message}</p>}
      </div>

      <div>
        <Label htmlFor="contractType">Tipo de contrato</Label>
        <Input id="contractType" type="text" {...register('contractType')} />
        {errors.contractType && <p className={errorClass}>{errors.contractType.message}</p>}
      </div>

      <div>
        <Label htmlFor="regionId">Região</Label>
        <select id="regionId" className={selectClass} defaultValue={initialValues.regionId} {...register('regionId')}>
          <option value="" disabled>
            Selecione…
          </option>
          {regions.map((region) => (
            <option key={region.id} value={region.id}>
              {region.name}
            </option>
          ))}
        </select>
        {errors.regionId && <p className={errorClass}>{errors.regionId.message}</p>}
      </div>

      <div>
        <Label htmlFor="educationLevelRequired">
          Escolaridade exigida <span className="font-normal text-fg-muted">(opcional)</span>
        </Label>
        <Input id="educationLevelRequired" type="text" {...register('educationLevelRequired')} />
        {errors.educationLevelRequired && <p className={errorClass}>{errors.educationLevelRequired.message}</p>}
      </div>

      <div>
        <Label htmlFor="location">Local</Label>
        <Input id="location" type="text" {...register('location')} />
        {errors.location && <p className={errorClass}>{errors.location.message}</p>}
      </div>

      <div>
        <Label htmlFor="benefits">
          Benefícios <span className="font-normal text-fg-muted">(opcional)</span>
        </Label>
        <Textarea id="benefits" rows={2} {...register('benefits')} />
        {errors.benefits && <p className={errorClass}>{errors.benefits.message}</p>}
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 block text-sm font-medium text-fg">
          Faixa salarial <span className="font-normal text-fg-muted">(opcional)</span>
        </legend>
        <div className="flex gap-3">
          <div className="flex-1">
            <Label className="sr-only" htmlFor="salaryMin">
              Salário mínimo
            </Label>
            <Input id="salaryMin" type="number" min={0} step="0.01" placeholder="Mínimo (R$)" {...register('salaryMin')} />
            {errors.salaryMin && <p className={errorClass}>{errors.salaryMin.message}</p>}
          </div>
          <div className="flex-1">
            <Label className="sr-only" htmlFor="salaryMax">
              Salário máximo
            </Label>
            <Input id="salaryMax" type="number" min={0} step="0.01" placeholder="Máximo (R$)" {...register('salaryMax')} />
            {errors.salaryMax && <p className={errorClass}>{errors.salaryMax.message}</p>}
          </div>
        </div>
        <Label className="flex items-center gap-2 text-sm font-normal text-fg" htmlFor="salaryVisible">
          <input id="salaryVisible" type="checkbox" {...register('salaryVisible')} />
          Exibir salário na vaga pública
        </Label>
      </fieldset>

      {success && (
        <div
          role="status"
          className="rounded-lg border border-success bg-[color-mix(in_srgb,var(--color-success)_10%,transparent)] px-4 py-3 text-sm text-success"
        >
          {success}
        </div>
      )}

      {serverError && (
        <div
          role="alert"
          className="rounded-lg border border-danger bg-[color-mix(in_srgb,var(--color-danger)_10%,transparent)] px-4 py-3 text-sm text-danger"
        >
          {serverError}
        </div>
      )}

      <Button type="submit" variant="primary" disabled={isPending}>
        {isPending ? 'Salvando…' : 'Salvar e enviar para moderação'}
      </Button>
    </form>
  );
}
