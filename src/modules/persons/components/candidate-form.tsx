'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { activateAdditionalRole } from '@/modules/identity';
import { candidateProfileSchema, type CandidateProfileInput } from '../schemas/candidate';
import { EDUCATION_LEVELS, EDUCATION_LEVEL_LABELS } from '../domain/candidate';
import { activateCandidateRole } from '../actions/activate-candidate-role';
import { submitCandidateForModeration } from '../actions/submit-candidate-for-moderation';

const inputClass =
  'rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 w-full';
const errorClass = 'mt-1 text-xs text-red-600';
const labelClass = 'block text-sm font-medium text-gray-700 mb-1';

export interface CandidateFormProps {
  /** Áreas de interesse do catálogo (taxonomia JobArea). */
  jobAreas: ReadonlyArray<{ id: string; name: string }>;
  /** Termo JOB_APPLICATION carregado server-side (versão + hash íntegros). */
  term: { version: string; contentHash: string; body: string };
  /** A Pessoa já tem o papel candidato ativo? Se sim, o aceite de termo não é exigido de novo. */
  alreadyCandidate: boolean;
  /** Status atual do perfil, se já existir (para refletir o fluxo rascunho → moderação). */
  initialStatus: string | null;
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
 */
export function CandidateForm({ jobAreas, term, alreadyCandidate, initialStatus }: CandidateFormProps) {
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

  return (
    <div className="flex flex-col gap-6 max-w-lg">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
        {/* Escolaridade */}
        <div>
          <label className={labelClass} htmlFor="educationLevel">
            Escolaridade
          </label>
          <select id="educationLevel" className={inputClass} defaultValue="" {...register('educationLevel')}>
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
          <label className={labelClass} htmlFor="primaryAreaOfInterestId">
            Área de interesse principal
          </label>
          <select
            id="primaryAreaOfInterestId"
            className={inputClass}
            defaultValue=""
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
          <label className={labelClass} htmlFor="phone">
            Telefone
          </label>
          <input
            id="phone"
            type="tel"
            placeholder="(11) 98888-7777"
            className={inputClass}
            {...register('phone')}
          />
          {errors.phone && <p className={errorClass}>{errors.phone.message}</p>}
        </div>

        {/* Resumo profissional (opcional) */}
        <div>
          <label className={labelClass} htmlFor="headline">
            Resumo profissional <span className="text-gray-400 font-normal">(opcional)</span>
          </label>
          <input id="headline" type="text" className={inputClass} {...register('headline')} />
          {errors.headline && <p className={errorClass}>{errors.headline.message}</p>}
        </div>

        {/* Experiência (opcional) */}
        <div>
          <label className={labelClass} htmlFor="experienceText">
            Experiência <span className="text-gray-400 font-normal">(opcional)</span>
          </label>
          <textarea id="experienceText" rows={3} className={inputClass} {...register('experienceText')} />
          {errors.experienceText && <p className={errorClass}>{errors.experienceText.message}</p>}
        </div>

        {/* Ponto de integração da USP-040: upload/extração de CV entra aqui. */}

        {/* Termo de consentimento JOB_APPLICATION (CAD-05) — exigido na 1ª ativação. */}
        {!alreadyCandidate && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
            <p className="font-medium mb-2">Termo de uso para candidatura a vagas</p>
            <div
              className="max-h-40 overflow-y-auto text-xs text-gray-600 whitespace-pre-wrap mb-3 border border-gray-200 rounded p-2 bg-white"
              aria-label="Conteúdo do termo de candidatura a vagas"
            >
              {term.body}
            </div>
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5 accent-blue-600"
                checked={consentChecked}
                onChange={(e) => setConsentChecked(e.target.checked)}
              />
              <span>
                Li e aceito o <strong>Termo de uso para candidatura a vagas</strong> (versão{' '}
                {term.version}) e autorizo o tratamento dos meus dados para essa finalidade.
              </span>
            </label>
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

        <button
          type="submit"
          disabled={isPending || !consentChecked}
          className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isPending ? 'Salvando…' : 'Salvar cadastro'}
        </button>
      </form>

      {/* Fluxo rascunho → moderação (CAD-03). */}
      {isDraft && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">
          <p className="text-amber-800 mb-3">
            Seu perfil está em <strong>rascunho</strong>. Envie para moderação para ficar visível nas
            buscas de empresas após a aprovação do coordenador.
          </p>
          <button
            type="button"
            onClick={onSubmitForModeration}
            disabled={isPending}
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:opacity-50 transition-colors"
          >
            {isPending ? 'Enviando…' : 'Enviar para moderação'}
          </button>
        </div>
      )}

      {inModeration && (
        <div
          role="status"
          className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800"
        >
          Seu perfil está <strong>em moderação</strong>. Você será avisado quando for aprovado.
        </div>
      )}
    </div>
  );
}
