'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { Button, Input, Label, LgpdBox, Textarea } from '@/shared/ui';
// Import direto do módulo `'use server'` (não do barrel `@/modules/identity`):
// este é um Client Component e o barrel reexporta código server-only
// (`container.ts` via captchaVerifier, `supabase/server.ts` via session), que o
// Next se recusa a empacotar no bundle do cliente. O arquivo da action é
// `'use server'`, então o import vira um stub RPC client-safe. Exceção justificada
// à regra de barrel (mesma situação do composition root em `shared/container.ts`).
// eslint-disable-next-line no-restricted-imports
import { activateAdditionalRole } from '@/modules/identity/actions/activate-additional-role';
import { candidateProfileSchema, type CandidateProfileInput } from '../schemas/candidate';
import { EDUCATION_LEVELS, EDUCATION_LEVEL_LABELS } from '../domain/candidate';
import { activateCandidateRole } from '../actions/activate-candidate-role';
import { submitCandidateForModeration } from '../actions/submit-candidate-for-moderation';

// `<select>` nativo não tem primitivo no DS (só Input/Textarea) — estilo por
// token, mesma superfície visual do `Input` (AD-014, padrão `job-form.tsx`).
const selectClass =
  'w-full rounded-sm border-[1.5px] border-border bg-surface px-4 py-3 text-[0.95rem] text-fg transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-60';
const errorClass = 'mt-1 text-xs text-danger';

export interface CandidateFormProps {
  /** Áreas de interesse do catálogo (taxonomia JobArea). */
  jobAreas: ReadonlyArray<{ id: string; name: string }>;
  /** Termo JOB_APPLICATION carregado server-side (versão + hash íntegros). */
  term: { version: string; contentHash: string; body: string };
  /** A Pessoa já tem o papel candidato ativo? Se sim, o aceite de termo não é exigido de novo. */
  alreadyCandidate: boolean;
  /** Status atual do perfil, se já existir (para refletir o fluxo rascunho → moderação). */
  initialStatus: string | null;
  /** CAND-3: valores do perfil existente, para abrir o formulário pré-preenchido (edição não-às-cegas). */
  defaultValues?: Partial<CandidateProfileInput>;
}

/**
 * Formulário de cadastro de candidato (USP-009 / #46 — CAD-01, CAD-05).
 *
 * Orquestra o fluxo canônico: se a Pessoa ainda não é candidata, ativa o papel
 * CANDIDATE + consentimento JOB_APPLICATION via `activateAdditionalRole` (USP-006),
 * depois cria/atualiza o CandidateProfile em DRAFT (`activateCandidateRole`). O
 * envio é bloqueado sem aceite do termo (CAD-05). Com o perfil em DRAFT, expõe a
 * ação "Enviar para moderação" (`submitCandidateForModeration` → IN_MODERATION).
 *
 * O anexo/extração de CV (CAD-02) é da USP-040 — ponto de integração marcado abaixo.
 *
 * Fundação de Design System (AD-014/AD-015/AD-016, Fase 3 unidade U1): restilizado
 * com as primitivas (`Input`/`Label`/`Textarea`/`Button`/`LgpdBox`) e tokens — fluxo
 * (RHF/Zod/gate do consentimento/actions/`transitionContent`) preservado sem alteração.
 */
export function CandidateForm({
  jobAreas,
  term,
  alreadyCandidate,
  initialStatus,
  defaultValues,
}: CandidateFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [consentChecked, setConsentChecked] = useState(alreadyCandidate);
  const [status, setStatus] = useState<string | null>(initialStatus);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CandidateProfileInput>({
    resolver: zodResolver(candidateProfileSchema),
    defaultValues,
  });

  function onSubmit(data: CandidateProfileInput) {
    if (!consentChecked) return;
    setServerError(null);
    startTransition(async () => {
      // 1. Papel + consentimento JOB_APPLICATION (USP-006), se ainda não for candidata.
      if (!alreadyCandidate) {
        const roleResult = await activateAdditionalRole({
          role: 'CANDIDATE',
          termVersion: term.version,
          termContentHash: term.contentHash,
          acceptTerm: true,
          profile: { phone: data.phone },
        });
        // CONFLICT = papel já ativo (corrida/idempotência) — segue para o perfil.
        if (!roleResult.ok && roleResult.error.code !== 'CONFLICT') {
          setServerError(roleResult.error.message);
          return;
        }
      }

      // 2. Cria/atualiza o perfil de candidato em DRAFT (USP-009).
      const result = await activateCandidateRole(data);
      if (!result.ok) {
        setServerError(result.error.message);
        return;
      }
      setStatus(result.data.publicationStatus);
      router.refresh();
    });
  }

  function onSubmitForModeration() {
    setServerError(null);
    startTransition(async () => {
      const result = await submitCandidateForModeration();
      if (!result.ok) {
        setServerError(result.error.message);
        return;
      }
      setStatus(result.data.to);
      router.refresh();
    });
  }

  const isDraft = status === 'DRAFT';
  const inModeration = status === 'IN_MODERATION';
  // CAND-2 / PERF-03 / PERF-03b: reflete o status real sem oferecer transição
  // inválida. ACTIVE ganha um aviso informativo (não-acionável); os demais
  // status (REJECTED/AWAITING_ADJUSTMENTS/PAUSED/EXPIRED/ARCHIVED/INACTIVATED)
  // não renderizam caixa alguma — superfície neutra, sem decidir re-moderação (H-5).
  const isActive = status === 'ACTIVE';

  return (
    <div className="flex max-w-lg flex-col gap-6">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
        {/* Escolaridade */}
        <div>
          <Label htmlFor="educationLevel">Escolaridade</Label>
          {/* SPEC_DEVIATION: mantém defaultValue explícito (não apenas via RHF)
              porque, sem seleção, o <select> nativo auto-seleciona a 1ª option
              HABILITADA (não a "" desabilitada) — sem isto, "submit vazio"
              passaria com um enum válido por acidente, quebrando o teste de
              validação Zod preservado (A-11). */}
          <select
            id="educationLevel"
            className={selectClass}
            defaultValue={defaultValues?.educationLevel ?? ''}
            {...register('educationLevel')}
          >
            <option value="" disabled>
              Selecione…
            </option>
            {EDUCATION_LEVELS.map((level) => (
              <option key={level} value={level}>
                {EDUCATION_LEVEL_LABELS[level]}
              </option>
            ))}
          </select>
          {errors.educationLevel && <p className={errorClass}>{errors.educationLevel.message}</p>}
        </div>

        {/* Área de interesse principal */}
        <div>
          <Label htmlFor="primaryAreaOfInterestId">Área de interesse principal</Label>
          <select
            id="primaryAreaOfInterestId"
            className={selectClass}
            defaultValue={defaultValues?.primaryAreaOfInterestId ?? ''}
            {...register('primaryAreaOfInterestId')}
          >
            <option value="" disabled>
              Selecione…
            </option>
            {jobAreas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.name}
              </option>
            ))}
          </select>
          {errors.primaryAreaOfInterestId && (
            <p className={errorClass}>{errors.primaryAreaOfInterestId.message}</p>
          )}
        </div>

        {/* Telefone */}
        <div>
          <Label htmlFor="phone">Telefone</Label>
          <Input id="phone" type="tel" placeholder="(11) 98888-7777" {...register('phone')} />
          {errors.phone && <p className={errorClass}>{errors.phone.message}</p>}
        </div>

        {/* Resumo profissional (opcional) */}
        <div>
          <Label htmlFor="headline">
            Resumo profissional <span className="font-normal text-fg-muted">(opcional)</span>
          </Label>
          <Input id="headline" type="text" {...register('headline')} />
          {errors.headline && <p className={errorClass}>{errors.headline.message}</p>}
        </div>

        {/* Experiência (opcional) */}
        <div>
          <Label htmlFor="experienceText">
            Experiência <span className="font-normal text-fg-muted">(opcional)</span>
          </Label>
          <Textarea id="experienceText" rows={3} {...register('experienceText')} />
          {errors.experienceText && <p className={errorClass}>{errors.experienceText.message}</p>}
        </div>

        {/* Ponto de integração da USP-040: upload/extração de CV entra aqui. */}

        {/* Termo de consentimento JOB_APPLICATION (CAD-05) — exigido na 1ª ativação. */}
        {!alreadyCandidate && (
          <LgpdBox title="Termo de uso para candidatura a vagas">
            <div
              className="mb-3 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-sm border border-border bg-surface p-2 text-xs text-fg-muted"
              aria-label="Conteúdo do termo de candidatura a vagas"
            >
              {term.body}
            </div>
            <label className="flex cursor-pointer items-start gap-2 text-sm text-fg">
              <input
                type="checkbox"
                className="mt-0.5 accent-primary"
                checked={consentChecked}
                onChange={(e) => setConsentChecked(e.target.checked)}
              />
              <span>
                Li e aceito o <strong>Termo de uso para candidatura a vagas</strong> (versão{' '}
                {term.version}) e autorizo o tratamento dos meus dados para essa finalidade.
              </span>
            </label>
          </LgpdBox>
        )}

        {serverError && (
          <div
            role="alert"
            className="rounded-lg bg-[color-mix(in_srgb,var(--color-danger)_10%,transparent)] p-3 text-sm text-danger"
          >
            {serverError}
          </div>
        )}

        <Button type="submit" variant="primary" disabled={isPending || !consentChecked}>
          {isPending ? 'Salvando…' : 'Salvar cadastro'}
        </Button>
      </form>

      {/* Fluxo rascunho → moderação (CAD-03). */}
      {isDraft && (
        <div className="rounded-md border border-border bg-background p-4 text-sm">
          <p className="mb-3 text-fg-muted">
            Seu perfil está em <strong className="text-fg">rascunho</strong>. Envie para moderação para
            ficar visível nas buscas de empresas após a aprovação do coordenador.
          </p>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={onSubmitForModeration}
            disabled={isPending}
          >
            {isPending ? 'Enviando…' : 'Enviar para moderação'}
          </Button>
        </div>
      )}

      {inModeration && (
        <div
          role="status"
          className="rounded-md border border-primary bg-[color-mix(in_srgb,var(--color-primary)_10%,transparent)] px-4 py-3 text-sm text-primary"
        >
          Seu perfil está <strong>em moderação</strong>. Você será avisado quando for aprovado.
        </div>
      )}

      {isActive && (
        <div
          role="status"
          className="rounded-md border border-primary bg-[color-mix(in_srgb,var(--color-primary)_10%,transparent)] px-4 py-3 text-sm text-primary"
        >
          Seu perfil está <strong>ativo</strong> e visível nas buscas de empresas.
        </div>
      )}
    </div>
  );
}
