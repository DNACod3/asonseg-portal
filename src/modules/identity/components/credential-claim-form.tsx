'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Turnstile } from '@marsidev/react-turnstile';
import { Button, Input, Label } from '@/shared/ui';
import type { ActionResult } from '@/shared/errors';
import { requestCredentialClaim } from '../actions/request-credential-claim';
import type { RequestCredentialClaimResult } from '../actions/request-credential-claim';
import {
  requestCredentialClaimSchema,
  CREDENTIAL_VERIFICATION_METHODS,
  VERIFICATION_METHOD_LABELS,
  type RequestCredentialClaimInput,
} from '../schemas/credential-claim.schema';

const selectClass =
  'w-full rounded-sm border-[1.5px] border-border bg-surface px-4 py-3 text-[0.95rem] text-fg focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary';

/**
 * Formulário público de solicitação de reivindicação de credencial (USP-003 /
 * IDN-07). Exige CAPTCHA (Turnstile — ADR-0014) antes de enviar. A resposta é
 * sempre genérica — não revela se a Pessoa existe (P-006).
 */
export function CredentialClaimForm({ siteKey }: { siteKey: string }) {
  const [isPending, startTransition] = useTransition();
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<RequestCredentialClaimInput>({
    resolver: zodResolver(requestCredentialClaimSchema),
    defaultValues: { verificationMethod: 'AS_CONFIRMATION' },
  });

  function handleCaptchaSuccess(token: string) {
    setCaptchaToken(token);
    setValue('captchaToken', token);
  }

  function onSubmit(data: RequestCredentialClaimInput) {
    if (!captchaToken) {
      setServerError('Complete o desafio CAPTCHA antes de continuar.');
      return;
    }
    setServerError(null);
    startTransition(async () => {
      const result: ActionResult<RequestCredentialClaimResult> =
        await requestCredentialClaim(data);
      if (result.ok) {
        setSuccessMessage(result.data.message);
      } else {
        setServerError(result.error.message);
      }
    });
  }

  if (successMessage) {
    return (
      <div
        role="status"
        className="flex flex-col gap-3 rounded-sm border border-success bg-[color-mix(in_srgb,var(--color-success)_10%,transparent)] p-5"
      >
        <p className="text-sm font-medium text-success">Solicitação enviada</p>
        <p className="text-xs text-fg-muted">{successMessage}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      <p className="text-xs text-fg-muted">
        Informe o CPF (ou um identificador alternativo) da Pessoa já cadastrada e o e-mail que deseja
        usar para acessar o portal. Nossa equipe fará a verificação de identidade antes de ativar a
        credencial.
      </p>

      {/* CPF */}
      <div className="flex flex-col gap-1">
        <Label htmlFor="cpf">CPF</Label>
        <Input
          id="cpf"
          type="text"
          inputMode="numeric"
          placeholder="000.000.000-00"
          maxLength={14}
          aria-describedby={errors.cpf ? 'cpf-error' : undefined}
          aria-invalid={!!errors.cpf}
          {...register('cpf')}
        />
        {errors.cpf && (
          <p id="cpf-error" role="alert" className="text-xs text-danger">
            {errors.cpf.message}
          </p>
        )}
      </div>

      {/* Identificador alternativo */}
      <div className="flex flex-col gap-1">
        <Label htmlFor="alternativeIdentifier">
          Identificador alternativo <span className="text-fg-muted">(se não tiver CPF)</span>
        </Label>
        <Input
          id="alternativeIdentifier"
          type="text"
          placeholder="Protocolo de atendimento, nome completo, etc."
          aria-invalid={!!errors.alternativeIdentifier}
          {...register('alternativeIdentifier')}
        />
        {errors.alternativeIdentifier && (
          <p role="alert" className="text-xs text-danger">
            {errors.alternativeIdentifier.message}
          </p>
        )}
      </div>

      {/* E-mail desejado */}
      <div className="flex flex-col gap-1">
        <Label htmlFor="requestedEmail">
          E-mail desejado <span aria-hidden>*</span>
        </Label>
        <Input
          id="requestedEmail"
          type="email"
          autoComplete="email"
          placeholder="voce@exemplo.com"
          aria-describedby={errors.requestedEmail ? 'requestedEmail-error' : undefined}
          aria-invalid={!!errors.requestedEmail}
          {...register('requestedEmail')}
        />
        {errors.requestedEmail && (
          <p id="requestedEmail-error" role="alert" className="text-xs text-danger">
            {errors.requestedEmail.message}
          </p>
        )}
      </div>

      {/* Meio de verificação */}
      <div className="flex flex-col gap-1">
        <Label htmlFor="verificationMethod">Meio de verificação preferido</Label>
        <select id="verificationMethod" className={selectClass} {...register('verificationMethod')}>
          {CREDENTIAL_VERIFICATION_METHODS.map((method) => (
            <option key={method} value={method}>
              {VERIFICATION_METHOD_LABELS[method]}
            </option>
          ))}
        </select>
      </div>

      {/* CAPTCHA Turnstile (ADR-0014) */}
      <input type="hidden" {...register('captchaToken')} />
      <div className="flex justify-center">
        <Turnstile siteKey={siteKey} onSuccess={handleCaptchaSuccess} options={{ language: 'pt-BR' }} />
      </div>
      {errors.captchaToken && (
        <p role="alert" className="text-center text-xs text-danger">
          {errors.captchaToken.message}
        </p>
      )}

      {serverError && (
        <div
          role="alert"
          className="rounded-sm bg-[color-mix(in_srgb,var(--color-danger)_10%,transparent)] p-3 text-sm text-danger"
        >
          {serverError}
        </div>
      )}

      <Button type="submit" variant="primary" size="lg" className="w-full" disabled={isPending}>
        {isPending ? 'Enviando…' : 'Solicitar reivindicação'}
      </Button>
    </form>
  );
}
