'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, Input, Label, LgpdBox, Textarea } from '@/shared/ui';
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

// `<select>` nativo não tem primitivo no DS (só Input/Textarea) — estilo por
// token, mesma superfície visual do `Input` (AD-014, padrão `candidate-form.tsx`).
const selectClass =
  'w-full rounded-sm border-[1.5px] border-border bg-surface px-4 py-3 text-[0.95rem] text-fg transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-60';
const errorClass = 'mt-1 text-xs text-danger';

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
    <div className="flex max-w-lg flex-col gap-6">
      {/* P-004 — distingue OFERECER (prestador) de CONTRATAR (cliente). */}
      <div className="rounded-md border border-success bg-[color-mix(in_srgb,var(--color-success)_10%,transparent)] px-4 py-3 text-sm text-success">
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
                <Label htmlFor={field}>{meta.label}</Label>
                <Input
                  id={field}
                  type={meta.type}
                  autoComplete={meta.autoComplete}
                  placeholder={meta.placeholder}
                  value={profileValues[field] ?? ''}
                  onChange={(e) => setProfileField(field, e.target.value)}
                  aria-describedby={profileErrors[field] ? errorId : undefined}
                  aria-invalid={!!profileErrors[field]}
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
          <Label htmlFor="headline">
            Título profissional <span className="font-normal text-fg-muted">(opcional)</span>
          </Label>
          <Input id="headline" type="text" placeholder="Ex.: Eletricista predial" {...register('headline')} />
          {errors.headline && <p className={errorClass}>{errors.headline.message}</p>}
        </div>

        {/* Descrição (opcional) */}
        <div>
          <Label htmlFor="description">
            Descrição dos serviços <span className="font-normal text-fg-muted">(opcional)</span>
          </Label>
          <Textarea id="description" rows={4} {...register('description')} />
          {errors.description && <p className={errorClass}>{errors.description.message}</p>}
        </div>

        {/* Região de atuação (opcional) */}
        <div>
          <Label htmlFor="regionId">
            Região de atuação <span className="font-normal text-fg-muted">(opcional)</span>
          </Label>
          <select id="regionId" className={selectClass} defaultValue="" {...register('regionId')}>
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
          <Label htmlFor="photo">
            Foto do perfil <span className="font-normal text-fg-muted">(em breve)</span>
          </Label>
          <input
            id="photo"
            type="file"
            accept="image/*"
            disabled
            aria-disabled
            className={`${selectClass} cursor-not-allowed opacity-60`}
          />
          <p className="mt-1 text-xs text-fg-muted">O envio de foto será habilitado em breve.</p>
        </div>

        {/* Termo de consentimento SERVICE_OFFERING (P-003) — exigido na 1ª ativação. */}
        {!alreadyProvider && (
          <LgpdBox title="Termo de oferta de serviços">
            <div
              className="mb-3 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-sm border border-border bg-surface p-2 text-xs text-fg-muted"
              aria-label="Conteúdo do termo de oferta de serviços"
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
                Li e aceito o <strong>Termo de oferta de serviços</strong> (versão {term.version}) e
                autorizo o tratamento dos meus dados para essa finalidade.
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
          {isPending ? 'Salvando…' : 'Ativar papel de prestador'}
        </Button>
      </form>

      {/* E-003 — próximo passo após ativação. */}
      {isActivated && (
        <div
          role="status"
          className="rounded-md border border-success bg-[color-mix(in_srgb,var(--color-success)_10%,transparent)] p-4 text-sm text-success"
        >
          <p className="mb-3">
            Papel de prestador <strong>ativado</strong>. O próximo passo é publicar seu primeiro
            serviço.
          </p>
          <Button asChild variant="primary">
            <Link href="/servicos/novo">Publicar primeiro serviço</Link>
          </Button>
        </div>
      )}

      {/* E-002 (ADR-0031) — declarar MEI redireciona ao fluxo de Empresa (USP-012). */}
      <div className="rounded-md border border-border bg-surface p-4 text-sm text-fg-muted">
        <p className="mb-2">
          Tem um <strong>CNPJ MEI</strong> e quer atuar como empresa? O cadastro do MEI é feito como
          uma empresa sua.
        </p>
        <Button asChild variant="secondary">
          <Link href="/empresa">Registrar meu MEI / atuar como empresa</Link>
        </Button>
      </div>
    </div>
  );
}
