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
// Escape-hatch (padrão AD-013/T-A1, ver USP-018 next-cache-invalidation.ts):
// o barrel `@/modules/moderation` arrasta adapters server-only (revalidatePath,
// next/headers via o container) para o bundle client. Este é um Client
// Component — importa a action `'use server'` direto pelo caminho, não pelo
// barrel, exatamente como CLAUDE.md descreve a fronteira RSC (a action vira
// referência serializada; nada do módulo é bundlado no cliente).
// eslint-disable-next-line no-restricted-imports
import { suggestTaxonomy } from '@/modules/moderation/actions/suggest-taxonomy';
import { Button, Input, Label, Textarea } from '@/shared/ui';

/** Opção sentinela do select de área — abre o sub-fluxo "sugerir nova" (USP-019 / SUGG-07). */
const SUGGEST_AREA_VALUE = '__suggest__';

// `<select>` nativo não tem primitivo no DS (só Input/Textarea) — estilo por
// token, mesma superfície visual do `Input` (AD-014).
const selectClass =
  'w-full rounded-sm border-[1.5px] border-border bg-surface px-4 py-3 text-[0.95rem] text-fg transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-60';
const errorClass = 'mt-1 text-xs text-danger';
const legendClass = 'mb-1 block text-sm font-medium text-fg';

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

  // Sub-fluxo "Outro / sugerir nova área" (USP-019 / SUGG-07) — estado local,
  // separado do RHF principal: sugerir NÃO seleciona a área (pendente até
  // aprovação — SUGG-MN-01); o campo `areaId` continua exigido para publicar.
  const [suggestName, setSuggestName] = useState('');
  const [suggestPending, startSuggestTransition] = useTransition();
  const [suggestFeedback, setSuggestFeedback] = useState<{ kind: 'success' | 'error'; message: string } | null>(
    null,
  );

  const {
    register,
    handleSubmit,
    getValues,
    setError,
    watch,
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

  // Submete a sugestão de nova área (USP-019 / SUGG-07) — sub-fluxo à parte do
  // formulário de vaga; não altera `areaId` nem o submit de publicação.
  function onSuggestArea() {
    setSuggestFeedback(null);
    startSuggestTransition(async () => {
      const result = await suggestTaxonomy({ kind: 'JOB_AREA', name: suggestName });
      if (result.ok) {
        setSuggestName('');
        setSuggestFeedback({ kind: 'success', message: 'Sugestão enviada para aprovação.' });
      } else {
        const message =
          result.error.code === 'VALIDATION'
            ? (result.error.fieldErrors?.name?.[0] ?? result.error.message)
            : result.error.message;
        setSuggestFeedback({ kind: 'error', message });
      }
    });
  }

  const areaValue = watch('areaId');

  return (
    <form
      onSubmit={handleSubmit(onPublish)}
      noValidate
      className="flex flex-col gap-5 max-w-lg"
    >
      <input type="hidden" {...register('companyId')} />

      {/* Título */}
      <div>
        <Label htmlFor="title">Título da vaga</Label>
        <Input id="title" type="text" placeholder="Ex.: Atendente de balcão" {...register('title')} />
        {errors.title && <p className={errorClass}>{errors.title.message}</p>}
      </div>

      {/* Área */}
      <div>
        <Label htmlFor="areaId">Área de atuação</Label>
        <select id="areaId" className={selectClass} defaultValue="" {...register('areaId')}>
          <option value="" disabled>
            Selecione…
          </option>
          {jobAreas.map((area) => (
            <option key={area.id} value={area.id}>
              {area.name}
            </option>
          ))}
          <option value={SUGGEST_AREA_VALUE}>Outro / sugerir nova área</option>
        </select>
        {errors.areaId && <p className={errorClass}>{errors.areaId.message}</p>}

        {/* Sub-fluxo de sugestão (USP-019 / SUGG-07) — não seleciona a área
            para a vaga (pendente até aprovação, SUGG-MN-01); `areaId` continua
            exigido acima para publicar. */}
        {areaValue === SUGGEST_AREA_VALUE && (
          <div className="mt-2 flex flex-col gap-2 rounded-lg border border-border bg-surface p-3">
            <Label className="sr-only" htmlFor="suggest-area-name">
              Nome da nova área
            </Label>
            <Input
              id="suggest-area-name"
              type="text"
              placeholder="Ex.: Jardinagem"
              value={suggestName}
              onChange={(e) => setSuggestName(e.target.value)}
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onSuggestArea}
              disabled={suggestPending || suggestName.trim().length < 2}
              className="self-start"
            >
              {suggestPending ? 'Enviando…' : 'Sugerir área'}
            </Button>
            {suggestFeedback && (
              <p
                role={suggestFeedback.kind === 'error' ? 'alert' : 'status'}
                className={suggestFeedback.kind === 'error' ? errorClass : 'text-xs text-success'}
              >
                {suggestFeedback.message}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Descrição */}
      <div>
        <Label htmlFor="description">Descrição</Label>
        <Textarea id="description" rows={4} {...register('description')} />
        {errors.description && <p className={errorClass}>{errors.description.message}</p>}
      </div>

      {/* Requisitos */}
      <div>
        <Label htmlFor="requirements">Requisitos</Label>
        <Textarea id="requirements" rows={3} {...register('requirements')} />
        {errors.requirements && <p className={errorClass}>{errors.requirements.message}</p>}
      </div>

      {/* Regime */}
      <div>
        <Label htmlFor="workRegime">Regime de trabalho</Label>
        <Input
          id="workRegime"
          type="text"
          placeholder="Ex.: CLT, PJ, estágio"
          {...register('workRegime')}
        />
        {errors.workRegime && <p className={errorClass}>{errors.workRegime.message}</p>}
      </div>

      {/* Tipo de contrato (USP-021 / E-002) */}
      <div>
        <Label htmlFor="contractType">Tipo de contrato</Label>
        <Input
          id="contractType"
          type="text"
          placeholder="Ex.: CLT, PJ, MEI, temporário"
          {...register('contractType')}
        />
        {errors.contractType && <p className={errorClass}>{errors.contractType.message}</p>}
      </div>

      {/* Região (USP-021 / E-002) */}
      <div>
        <Label htmlFor="regionId">Região</Label>
        <select id="regionId" className={selectClass} defaultValue="" {...register('regionId')}>
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
        <Label htmlFor="educationLevelRequired">
          Escolaridade exigida <span className="font-normal text-fg-muted">(opcional)</span>
        </Label>
        <Input
          id="educationLevelRequired"
          type="text"
          placeholder="Ex.: Ensino médio completo"
          {...register('educationLevelRequired')}
        />
        {errors.educationLevelRequired && (
          <p className={errorClass}>{errors.educationLevelRequired.message}</p>
        )}
      </div>

      {/* Local */}
      <div>
        <Label htmlFor="location">Local</Label>
        <Input id="location" type="text" placeholder="Ex.: São Paulo - SP" {...register('location')} />
        {errors.location && <p className={errorClass}>{errors.location.message}</p>}
      </div>

      {/* Benefícios (opcional) */}
      <div>
        <Label htmlFor="benefits">
          Benefícios <span className="font-normal text-fg-muted">(opcional)</span>
        </Label>
        <Textarea id="benefits" rows={2} {...register('benefits')} />
        {errors.benefits && <p className={errorClass}>{errors.benefits.message}</p>}
      </div>

      {/* Faixa salarial (opcional, USP-021 / E-002) */}
      <fieldset className="flex flex-col gap-3">
        <legend className={legendClass}>
          Faixa salarial <span className="font-normal text-fg-muted">(opcional)</span>
        </legend>
        <div className="flex gap-3">
          <div className="flex-1">
            <Label className="sr-only" htmlFor="salaryMin">
              Salário mínimo
            </Label>
            <Input
              id="salaryMin"
              type="number"
              min={0}
              step="0.01"
              placeholder="Mínimo (R$)"
              {...register('salaryMin')}
            />
            {errors.salaryMin && <p className={errorClass}>{errors.salaryMin.message}</p>}
          </div>
          <div className="flex-1">
            <Label className="sr-only" htmlFor="salaryMax">
              Salário máximo
            </Label>
            <Input
              id="salaryMax"
              type="number"
              min={0}
              step="0.01"
              placeholder="Máximo (R$)"
              {...register('salaryMax')}
            />
            {errors.salaryMax && <p className={errorClass}>{errors.salaryMax.message}</p>}
          </div>
        </div>
        <Label className="flex items-center gap-2 text-sm font-normal text-fg" htmlFor="salaryVisible">
          <input id="salaryVisible" type="checkbox" {...register('salaryVisible')} />
          Exibir salário na vaga pública
        </Label>
      </fieldset>

      {/* Validade */}
      <div>
        <Label htmlFor="validUntil">
          Validade da vaga{' '}
          <span className="font-normal text-fg-muted">(até quando recebe candidatos)</span>
        </Label>
        <Input
          id="validUntil"
          type="date"
          min={isoDateOffset(1)}
          max={isoDateOffset(180)}
          {...register('validUntil')}
        />
        {errors.validUntil && <p className={errorClass}>{errors.validUntil.message}</p>}
      </div>

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

      <div className="flex gap-3">
        <Button type="button" variant="secondary" onClick={onSaveDraft} disabled={isPending}>
          {isPending ? 'Salvando…' : 'Salvar rascunho'}
        </Button>
        <Button type="submit" variant="primary" disabled={isPending}>
          {isPending ? 'Enviando…' : 'Enviar para moderação'}
        </Button>
      </div>
    </form>
  );
}
