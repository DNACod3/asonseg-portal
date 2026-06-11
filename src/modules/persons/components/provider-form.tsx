'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
// Import direto do módulo `'use server'` (não do barrel `@/modules/identity`):
// este é um Client Component e o barrel reexporta código server-only. O arquivo
// da action é `'use server'`, então o import vira um stub RPC client-safe.
// (mesma exceção justificada do CandidateForm).
// eslint-disable-next-line no-restricted-imports
import { activateAdditionalRole } from '@/modules/identity/actions/activate-additional-role';
// eslint-disable-next-line no-restricted-imports
import { PROFILE_FIELD_META, type ProfileField } from '@/modules/identity/domain/role-activation';
import { providerProfileSchema, type ProviderProfileInput } from '../schemas/provider';
import { activateProviderRole } from '../actions/activate-provider-role';

const inputClass =
  'rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 w-full';
const errorClass = 'mt-1 text-xs text-red-600';
const labelClass = 'block text-sm font-medium text-gray-700 mb-1';

export interface ProviderFormProps {
  /** Regiões de atuação do catálogo (taxonomia Region). */
  regions: ReadonlyArray<{ id: string; name: string }>;
  /** Termo SERVICE_OFFERING carregado server-side (versão + hash íntegros). */
  term: { version: string; contentHash: string; body: string };
  /** A Pessoa já tem o papel prestador ativo? Se sim, o aceite de termo não é exigido de novo. */
  alreadyProvider: boolean;
  /** Campos de perfil (telefone/endereço) ainda não preenchidos na Pessoa (E-001/USP-006). */
  missingFields: readonly ProfileField[];
  /** Status atual do perfil, se já existir. */
  initialStatus: string | null;
}

/**
 * Formulário de cadastro de prestador de serviço PF (USP-010 / #116 — CAD-06..08).
 *
 * Orquestra o fluxo canônico: se a Pessoa ainda não é prestadora, ativa o papel
 * PROVIDER + consentimento SERVICE_OFFERING via `activateAdditionalRole` (USP-006),
 * depois cria/atualiza o ProviderProfile em DRAFT (`activateProviderRole`). O envio
 * é bloqueado sem aceite do termo (P-003). Papel ativo imediatamente, **sem
 * moderação** (ADR-0015).
 *
 * - **P-004:** a copy deixa explícito "agora você OFERECE serviços" (distinto do
 *   papel cliente, que CONTRATA).
 * - **E-002 (ADR-0031):** CTA "registrar meu MEI / atuar como empresa" navega ao
 *   fluxo de cadastro de Empresa (USP-012). **Nenhum campo de CNPJ aqui.**
 * - **E-003:** após salvar, CTA "publicar primeiro serviço" (USP-029).
 * - **GAP-B:** upload de foto difere p/ Fase 4 (bucket `provider-photos`) — placeholder.
 */
export function ProviderForm({
  regions,
  term,
  alreadyProvider,
  missingFields,
  initialStatus,
}: ProviderFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [consentChecked, setConsentChecked] = useState(alreadyProvider);
  const [profileValues, setProfileValues] = useState<Partial<Record<ProfileField, string>>>({});
  const [profileErrors, setProfileErrors] = useState<Partial<Record<ProfileField, string>>>({});
  const [status, setStatus] = useState<string | null>(initialStatus);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProviderProfileInput>({
    resolver: zodResolver(providerProfileSchema),
  });

  function setProfileField(field: ProfileField, value: string) {
    setProfileValues((v) => ({ ...v, [field]: value }));
    if (profileErrors[field]) setProfileErrors((e) => ({ ...e, [field]: undefined }));
  }

  function onSubmit(data: ProviderProfileInput) {
    if (!consentChecked) return;
    setServerError(null);

    // Campos faltantes do perfil (telefone/endereço) são obrigatórios na 1ª ativação.
    if (!alreadyProvider) {
      const fieldErrors: Partial<Record<ProfileField, string>> = {};
      for (const field of missingFields) {
        if (!profileValues[field]?.trim()) {
          fieldErrors[field] = 'Campo obrigatório para ativar este papel';
        }
      }
      if (Object.keys(fieldErrors).length > 0) {
        setProfileErrors(fieldErrors);
        return;
      }
    }

    startTransition(async () => {
      // 1. Papel + consentimento SERVICE_OFFERING (USP-006), se ainda não for prestadora.
      if (!alreadyProvider) {
        const roleResult = await activateAdditionalRole({
          role: 'PROVIDER',
          termVersion: term.version,
          termContentHash: term.contentHash,
          acceptTerm: true,
          profile: Object.fromEntries(
            missingFields.map((field) => [field, profileValues[field]?.trim() ?? '']),
          ),
        });
        // CONFLICT = papel já ativo (corrida/idempotência) — segue para o perfil.
        if (!roleResult.ok && roleResult.error.code !== 'CONFLICT') {
          setServerError(roleResult.error.message);
          return;
        }
      }

      // 2. Cria/atualiza o perfil de prestador em DRAFT (USP-010).
      const result = await activateProviderRole(data);
      if (!result.ok) {
        setServerError(result.error.message);
        return;
      }
      setStatus(result.data.publicationStatus);
      router.refresh();
    });
  }

  const isActivated = status === 'DRAFT';

  return (
    <div className="flex flex-col gap-6 max-w-lg">
      {/* P-004 — distingue OFERECER (prestador) de CONTRATAR (cliente). */}
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        Ao ativar este papel, <strong>agora você OFERECE serviços</strong> no portal — diferente do
        papel de cliente, que <strong>contrata</strong> serviços de outras pessoas.
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
        {/* Dados de perfil faltantes (telefone/endereço) — só na 1ª ativação. */}
        {!alreadyProvider &&
          missingFields.map((field) => {
            const meta = PROFILE_FIELD_META[field];
            const errorId = `${field}-error`;
            return (
              <div key={field}>
                <label className={labelClass} htmlFor={field}>
                  {meta.label}
                </label>
                <input
                  id={field}
                  type={meta.type}
                  autoComplete={meta.autoComplete}
                  placeholder={meta.placeholder}
                  value={profileValues[field] ?? ''}
                  onChange={(e) => setProfileField(field, e.target.value)}
                  aria-describedby={profileErrors[field] ? errorId : undefined}
                  aria-invalid={!!profileErrors[field]}
                  className={inputClass}
                />
                {profileErrors[field] && (
                  <p id={errorId} role="alert" className={errorClass}>
                    {profileErrors[field]}
                  </p>
                )}
              </div>
            );
          })}

        {/* Título do prestador (opcional) */}
        <div>
          <label className={labelClass} htmlFor="headline">
            Título profissional <span className="text-gray-400 font-normal">(opcional)</span>
          </label>
          <input
            id="headline"
            type="text"
            placeholder="Ex.: Eletricista predial"
            className={inputClass}
            {...register('headline')}
          />
          {errors.headline && <p className={errorClass}>{errors.headline.message}</p>}
        </div>

        {/* Descrição (opcional) */}
        <div>
          <label className={labelClass} htmlFor="description">
            Descrição dos serviços <span className="text-gray-400 font-normal">(opcional)</span>
          </label>
          <textarea id="description" rows={4} className={inputClass} {...register('description')} />
          {errors.description && <p className={errorClass}>{errors.description.message}</p>}
        </div>

        {/* Região de atuação (opcional) */}
        <div>
          <label className={labelClass} htmlFor="regionId">
            Região de atuação <span className="text-gray-400 font-normal">(opcional)</span>
          </label>
          <select id="regionId" className={inputClass} defaultValue="" {...register('regionId')}>
            <option value="">Selecione…</option>
            {regions.map((region) => (
              <option key={region.id} value={region.id}>
                {region.name}
              </option>
            ))}
          </select>
          {errors.regionId && <p className={errorClass}>{errors.regionId.message}</p>}
        </div>

        {/* GAP-B — upload de foto difere p/ Fase 4 (bucket provider-photos). */}
        <div>
          <label className={labelClass} htmlFor="photo">
            Foto do perfil <span className="text-gray-400 font-normal">(em breve)</span>
          </label>
          <input
            id="photo"
            type="file"
            accept="image/*"
            disabled
            aria-disabled
            className={`${inputClass} cursor-not-allowed bg-gray-100 text-gray-400`}
          />
          <p className="mt-1 text-xs text-gray-400">
            O envio de foto será habilitado em breve.
          </p>
        </div>

        {/* Termo de consentimento SERVICE_OFFERING (P-003) — exigido na 1ª ativação. */}
        {!alreadyProvider && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
            <p className="font-medium mb-2">Termo de oferta de serviços</p>
            <div
              className="max-h-40 overflow-y-auto text-xs text-gray-600 whitespace-pre-wrap mb-3 border border-gray-200 rounded p-2 bg-white"
              aria-label="Conteúdo do termo de oferta de serviços"
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
                Li e aceito o <strong>Termo de oferta de serviços</strong> (versão {term.version}) e
                autorizo o tratamento dos meus dados para essa finalidade.
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
          {isPending ? 'Salvando…' : 'Ativar papel de prestador'}
        </button>
      </form>

      {/* E-003 — próximo passo após ativação. */}
      {isActivated && (
        <div
          role="status"
          className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
        >
          <p className="mb-3">
            Papel de prestador <strong>ativado</strong>. O próximo passo é publicar seu primeiro
            serviço.
          </p>
          <Link
            href="/servicos/novo"
            className="inline-block rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition-colors"
          >
            Publicar primeiro serviço
          </Link>
        </div>
      )}

      {/* E-002 (ADR-0031) — declarar MEI redireciona ao fluxo de Empresa (USP-012). */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600">
        <p className="mb-2">
          Tem um <strong>CNPJ MEI</strong> e quer atuar como empresa? O cadastro do MEI é feito como
          uma empresa sua.
        </p>
        <Link
          href="/empresa"
          className="inline-block rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-300 transition-colors"
        >
          Registrar meu MEI / atuar como empresa
        </Link>
      </div>
    </div>
  );
}
