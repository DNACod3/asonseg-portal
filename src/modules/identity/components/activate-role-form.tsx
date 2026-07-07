'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input, Label } from '@/shared/ui';
import { activateAdditionalRole } from '../actions/activate-additional-role';
import { PROFILE_FIELD_META, type ProfileField } from '../domain/role-activation';
import type { PublicRole } from '../schemas/registerPerson';

/**
 * Opção de papel ativável — montada na página (server) com os campos faltantes
 * já calculados e o termo da finalidade já carregado/validado server-side.
 */
export interface ActivatableRoleOption {
  readonly role: PublicRole;
  readonly label: string;
  /** Nome humano da finalidade (E-001 / P-004 — termo correto, não genérico). */
  readonly purposeHumanName: string;
  readonly purposeDescription: string;
  /** Campos do perfil ainda não preenchidos (E-001). */
  readonly missingFields: readonly ProfileField[];
  readonly term: {
    readonly version: string;
    readonly contentHash: string;
    readonly body: string;
  };
}

interface Props {
  options: readonly ActivatableRoleOption[];
}

/**
 * Formulário de ativação de papel adicional (USP-006 / #79).
 *
 * Exibe os papéis públicos ativáveis; ao selecionar um, mostra **apenas os
 * campos faltantes** (E-001), o **termo específico da finalidade** (P-004) e o
 * aceite explícito. Submete a `activateAdditionalRole` e redireciona ao próximo
 * passo do papel (E-004). Privacidade/segurança: a action opera sobre a Pessoa
 * autenticada (P-002) — o componente não envia nenhum identificador de Pessoa.
 *
 * Refactor da Fase 1 (AD-014): restilizado com os primitivos (`Input`/`Label`/
 * `Button`) e tokens — fluxos (estado, validação, payload, redirect) preservados
 * sem alteração.
 */
export function ActivateRoleForm({ options }: Props) {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<PublicRole | null>(
    options.length === 1 ? options[0]!.role : null,
  );

  if (options.length === 0) {
    return (
      <p className="rounded-lg border border-border bg-surface p-5 text-sm text-fg-muted shadow-sm">
        Você já possui todos os papéis públicos disponíveis. Não há novos papéis para ativar.
      </p>
    );
  }

  const selected = options.find((o) => o.role === selectedRole) ?? null;

  return (
    <div className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-fg">
          Qual papel você quer ativar?
        </legend>
        {options.map((option) => (
          <label
            key={option.role}
            className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-background has-[:checked]:border-primary has-[:checked]:bg-[color-mix(in_srgb,var(--color-primary)_8%,transparent)]"
          >
            <input
              type="radio"
              name="role"
              value={option.role}
              checked={selectedRole === option.role}
              onChange={() => setSelectedRole(option.role)}
              className="mt-0.5 accent-primary"
            />
            <span className="flex flex-col">
              <span className="text-sm font-medium text-fg">{option.label}</span>
              <span className="text-xs text-fg-muted">{option.purposeDescription}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {selected && <RoleActivation key={selected.role} option={selected} router={router} />}
    </div>
  );
}

function RoleActivation({
  option,
  router,
}: {
  option: ActivatableRoleOption;
  router: ReturnType<typeof useRouter>;
}) {
  const [isPending, startTransition] = useTransition();
  const [values, setValues] = useState<Partial<Record<ProfileField, string>>>({});
  const [accepted, setAccepted] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<ProfileField, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  function setField(field: ProfileField, value: string) {
    setValues((v) => ({ ...v, [field]: value }));
    if (fieldErrors[field]) setFieldErrors((e) => ({ ...e, [field]: undefined }));
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setServerError(null);

    // Validação client-side: todos os campos faltantes são obrigatórios (E-001).
    const errors: Partial<Record<ProfileField, string>> = {};
    for (const field of option.missingFields) {
      const value = values[field]?.trim();
      if (!value) errors[field] = 'Campo obrigatório para ativar este papel';
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    startTransition(async () => {
      const result = await activateAdditionalRole({
        role: option.role,
        termVersion: option.term.version,
        termContentHash: option.term.contentHash,
        acceptTerm: true,
        profile: Object.fromEntries(
          option.missingFields.map((field) => [field, values[field]?.trim() ?? '']),
        ),
      });

      if (result.ok) {
        router.push(result.data.nextStep);
        router.refresh();
      } else {
        // Mapeia fieldErrors do servidor (chaves `profile.<campo>`) para os inputs.
        if (result.error.fieldErrors) {
          const mapped: Partial<Record<ProfileField, string>> = {};
          for (const field of option.missingFields) {
            const msg = result.error.fieldErrors[`profile.${field}`]?.[0];
            if (msg) mapped[field] = msg;
          }
          setFieldErrors(mapped);
        }
        setServerError(result.error.message);
      }
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="flex flex-col gap-5 rounded-lg border border-border bg-surface p-8 shadow-sm"
    >
      <div>
        <h2 className="text-lg font-semibold text-fg">Ativar papel: {option.label}</h2>
        <p className="mt-1 text-sm text-fg-muted">
          Finalidade: <strong>{option.purposeHumanName}</strong>. {option.purposeDescription}
        </p>
      </div>

      {option.missingFields.length > 0 ? (
        <div className="flex flex-col gap-4">
          {option.missingFields.map((field) => {
            const meta = PROFILE_FIELD_META[field];
            const errorId = `${field}-error`;
            return (
              <div key={field} className="flex flex-col gap-1">
                <Label htmlFor={field}>
                  {meta.label} <span aria-hidden>*</span>
                </Label>
                <Input
                  id={field}
                  type={meta.type}
                  autoComplete={meta.autoComplete}
                  placeholder={meta.placeholder}
                  value={values[field] ?? ''}
                  onChange={(e) => setField(field, e.target.value)}
                  aria-describedby={fieldErrors[field] ? errorId : undefined}
                  aria-invalid={!!fieldErrors[field]}
                />
                {fieldErrors[field] && (
                  <p id={errorId} role="alert" className="text-xs text-danger">
                    {fieldErrors[field]}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-fg-muted">
          Seu perfil já tem todos os dados necessários para este papel. Basta aceitar o termo.
        </p>
      )}

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-fg">Termo da finalidade</span>
        <div className="max-h-72 overflow-auto rounded-lg border border-border bg-background p-4 text-xs leading-relaxed whitespace-pre-wrap text-fg-muted">
          {option.term.body}
        </div>
      </div>

      <label className="flex cursor-pointer items-start gap-2 text-sm text-fg">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
          className="mt-0.5 accent-primary"
        />
        <span>
          Li e aceito o termo da finalidade <strong>{option.purposeHumanName}</strong>.
        </span>
      </label>

      {serverError && (
        <div
          role="alert"
          className="rounded-sm bg-[color-mix(in_srgb,var(--color-danger)_10%,transparent)] p-3 text-sm text-danger"
        >
          {serverError}
        </div>
      )}

      <Button type="submit" variant="primary" disabled={!accepted || isPending}>
        {isPending ? 'Ativando…' : 'Ativar papel'}
      </Button>
    </form>
  );
}
