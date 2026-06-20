'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import type { ActionError } from '@/shared/errors';
import { publishJobSchema, type PublishJobInput } from '../schemas/publish-job.schema';
import { submitJobForModeration } from '../actions/submit-job-for-moderation';
import { createJobDraft } from '../actions/create-job-draft';
import type { JobAreaOption } from '../queries/list-approved-job-areas';
import type { RegionOption } from '../queries/list-active-regions';

const inputClass =
  'rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 w-full';
const errorClass = 'mt-1 text-xs text-red-600';
const labelClass = 'block text-sm font-medium text-gray-700 mb-1';

export interface JobFormProps {
  /** Empresa em nome da qual a vaga será publicada (P-006). */
  companyId: string;
  /** Áreas aprovadas para o select (catálogo D-007). */
  jobAreas: JobAreaOption[];
  /** Regiões ativas para o select (USP-021 / E-002). */
  regions: RegionOption[];
}

/** yyyy-MM-dd deslocado `days` dias de hoje (limites min/max do date picker — UX). */
function isoDateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Formulário de publicação de vaga (USP-020 / #165). Dois caminhos:
 *  - **Salvar rascunho** (E-003): só `companyId` + título obrigatórios; chama `createJobDraft`.
 *  - **Enviar para moderação** (E-001): valida tudo (L-003 + validade futura E-004/E-005)
 *    via `publishJobSchema` e chama `submitJobForModeration` → IN_MODERATION.
 *
 * O servidor é a fonte da verdade das regras; o cliente só espelha a validação (UX).
 * Erros do `ActionResult` viram mensagens PT-BR inline (CONFLICT/FORBIDDEN/VALIDATION).
 */
export function JobForm({ companyId, jobAreas, regions }: JobFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    getValues,
    setError,
    formState: { errors },
  } = useForm<PublishJobInput>({
    resolver: zodResolver(publishJobSchema),
    defaultValues: {
      companyId,
      title: '',
      areaId: '',
      description: '',
      requirements: '',
      workRegime: '',
      location: '',
      benefits: '',
      salary: '',
      contractType: '',
      regionId: '',
      educationLevelRequired: '',
      salaryMin: '',
      salaryMax: '',
      salaryVisible: true,
      validUntil: '',
    },
  });

  /** Mapeia fieldErrors do servidor para erros inline do RHF. */
  function applyFieldErrors(error: ActionError) {
    if (!error.fieldErrors) return;
    for (const [field, messages] of Object.entries(error.fieldErrors)) {
      if (messages?.[0]) setError(field as keyof PublishJobInput, { message: messages[0] });
    }
  }

  // Caminho "Enviar para moderação": RHF já validou o schema completo no cliente.
  function onPublish(data: PublishJobInput) {
    setServerError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await submitJobForModeration(data);
      if (result.ok) {
        setSuccess('Vaga enviada para moderação. Ela ficará visível após a aprovação.');
        router.refresh();
      } else {
        applyFieldErrors(result.error);
        setServerError(result.error.message);
      }
    });
  }

  // Caminho "Salvar rascunho": ignora a validação completa; só limpa vazios → undefined.
  function onSaveDraft() {
    setServerError(null);
    setSuccess(null);
    const v = getValues();
    const blankToUndef = (s: string) => (s && s.trim() ? s : undefined);
    startTransition(async () => {
      const result = await createJobDraft({
        companyId: v.companyId,
        title: v.title,
        areaId: blankToUndef(v.areaId),
        description: blankToUndef(v.description),
        requirements: blankToUndef(v.requirements),
        workRegime: blankToUndef(v.workRegime),
        location: blankToUndef(v.location),
        benefits: blankToUndef(v.benefits ?? ''),
        salary: blankToUndef(v.salary ?? ''),
        contractType: blankToUndef(v.contractType ?? ''),
        regionId: blankToUndef(v.regionId ?? ''),
        educationLevelRequired: blankToUndef(v.educationLevelRequired ?? ''),
        // salaryMin/Max chegam como string do input; o Zod (preprocess) trata '' → undefined.
        salaryMin: v.salaryMin,
        salaryMax: v.salaryMax,
        salaryVisible: v.salaryVisible,
        validUntil: blankToUndef(v.validUntil ?? ''),
      });
      if (result.ok) {
        setSuccess('Rascunho salvo.');
        router.refresh();
      } else {
        applyFieldErrors(result.error);
        setServerError(result.error.message);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit(onPublish)} className="flex flex-col gap-5 max-w-lg">
      <input type="hidden" {...register('companyId')} />

      {/* Título */}
      <div>
        <label className={labelClass} htmlFor="title">
          Título da vaga
        </label>
        <input
          id="title"
          type="text"
          placeholder="Ex.: Atendente de balcão"
          className={inputClass}
          {...register('title')}
        />
        {errors.title && <p className={errorClass}>{errors.title.message}</p>}
      </div>

      {/* Área */}
      <div>
        <label className={labelClass} htmlFor="areaId">
          Área de atuação
        </label>
        <select id="areaId" className={inputClass} defaultValue="" {...register('areaId')}>
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

      {/* Descrição */}
      <div>
        <label className={labelClass} htmlFor="description">
          Descrição
        </label>
        <textarea id="description" rows={4} className={inputClass} {...register('description')} />
        {errors.description && <p className={errorClass}>{errors.description.message}</p>}
      </div>

      {/* Requisitos */}
      <div>
        <label className={labelClass} htmlFor="requirements">
          Requisitos
        </label>
        <textarea id="requirements" rows={3} className={inputClass} {...register('requirements')} />
        {errors.requirements && <p className={errorClass}>{errors.requirements.message}</p>}
      </div>

      {/* Regime */}
      <div>
        <label className={labelClass} htmlFor="workRegime">
          Regime de trabalho
        </label>
        <input
          id="workRegime"
          type="text"
          placeholder="Ex.: CLT, PJ, estágio"
          className={inputClass}
          {...register('workRegime')}
        />
        {errors.workRegime && <p className={errorClass}>{errors.workRegime.message}</p>}
      </div>

      {/* Tipo de contrato (USP-021 / E-002) */}
      <div>
        <label className={labelClass} htmlFor="contractType">
          Tipo de contrato
        </label>
        <input
          id="contractType"
          type="text"
          placeholder="Ex.: CLT, PJ, MEI, temporário"
          className={inputClass}
          {...register('contractType')}
        />
        {errors.contractType && <p className={errorClass}>{errors.contractType.message}</p>}
      </div>

      {/* Região (USP-021 / E-002) */}
      <div>
        <label className={labelClass} htmlFor="regionId">
          Região
        </label>
        <select id="regionId" className={inputClass} defaultValue="" {...register('regionId')}>
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

      {/* Escolaridade exigida (opcional, USP-021 / E-002) */}
      <div>
        <label className={labelClass} htmlFor="educationLevelRequired">
          Escolaridade exigida <span className="text-gray-400 font-normal">(opcional)</span>
        </label>
        <input
          id="educationLevelRequired"
          type="text"
          placeholder="Ex.: Ensino médio completo"
          className={inputClass}
          {...register('educationLevelRequired')}
        />
        {errors.educationLevelRequired && (
          <p className={errorClass}>{errors.educationLevelRequired.message}</p>
        )}
      </div>

      {/* Local */}
      <div>
        <label className={labelClass} htmlFor="location">
          Local
        </label>
        <input
          id="location"
          type="text"
          placeholder="Ex.: São Paulo - SP"
          className={inputClass}
          {...register('location')}
        />
        {errors.location && <p className={errorClass}>{errors.location.message}</p>}
      </div>

      {/* Benefícios (opcional) */}
      <div>
        <label className={labelClass} htmlFor="benefits">
          Benefícios <span className="text-gray-400 font-normal">(opcional)</span>
        </label>
        <textarea id="benefits" rows={2} className={inputClass} {...register('benefits')} />
        {errors.benefits && <p className={errorClass}>{errors.benefits.message}</p>}
      </div>

      {/* Faixa salarial (opcional, USP-021 / E-002) */}
      <fieldset className="flex flex-col gap-3">
        <legend className={labelClass}>
          Faixa salarial <span className="text-gray-400 font-normal">(opcional)</span>
        </legend>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="sr-only" htmlFor="salaryMin">
              Salário mínimo
            </label>
            <input
              id="salaryMin"
              type="number"
              min={0}
              step="0.01"
              placeholder="Mínimo (R$)"
              className={inputClass}
              {...register('salaryMin')}
            />
            {errors.salaryMin && <p className={errorClass}>{errors.salaryMin.message}</p>}
          </div>
          <div className="flex-1">
            <label className="sr-only" htmlFor="salaryMax">
              Salário máximo
            </label>
            <input
              id="salaryMax"
              type="number"
              min={0}
              step="0.01"
              placeholder="Máximo (R$)"
              className={inputClass}
              {...register('salaryMax')}
            />
            {errors.salaryMax && <p className={errorClass}>{errors.salaryMax.message}</p>}
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700" htmlFor="salaryVisible">
          <input id="salaryVisible" type="checkbox" {...register('salaryVisible')} />
          Exibir salário na vaga pública
        </label>
      </fieldset>

      {/* Validade */}
      <div>
        <label className={labelClass} htmlFor="validUntil">
          Validade da vaga{' '}
          <span className="text-gray-400 font-normal">(até quando recebe candidatos)</span>
        </label>
        <input
          id="validUntil"
          type="date"
          min={isoDateOffset(1)}
          max={isoDateOffset(180)}
          className={inputClass}
          {...register('validUntil')}
        />
        {errors.validUntil && <p className={errorClass}>{errors.validUntil.message}</p>}
      </div>

      {success && (
        <div
          role="status"
          className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700"
        >
          {success}
        </div>
      )}

      {serverError && (
        <div
          role="alert"
          className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700"
        >
          {serverError}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onSaveDraft}
          disabled={isPending}
          className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? 'Salvando…' : 'Salvar rascunho'}
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? 'Enviando…' : 'Enviar para moderação'}
        </button>
      </div>
    </form>
  );
}
