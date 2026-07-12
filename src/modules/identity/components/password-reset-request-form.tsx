'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Turnstile } from '@marsidev/react-turnstile';
import { Button, Input, Label } from '@/shared/ui';
import {
  requestPasswordResetSchema,
  type RequestPasswordResetInput,
} from '../schemas/password-reset.schema';
import { requestPasswordReset } from '../actions/request-password-reset';

/**
 * Formulário de solicitação de recuperação de senha (USP-005 — #72). RHF + Zod
 * consumindo `requestPasswordReset`. Exige CAPTCHA (Turnstile — ADR-0014/USP-005)
 * antes de enviar. No sucesso, exibe sempre a MESMA mensagem genérica de
 * confirmação (anti-enumeração) — nunca revela se o e-mail existe.
 *
 * Refactor Fase 1 (AD-014, USP-005 delta): restilizado com os primitivos
 * (`Input`/`Label`/`Button`) e tokens do Design System, seguindo o padrão do
 * `LoginForm` — CAPTCHA, anti-enumeração e a mensagem genérica preservados sem
 * alteração.
 */
export function PasswordResetRequestForm({ siteKey }: { siteKey: string }) {
  const [isPending, startTransition] = useTransition();
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [confirmacao, setConfirmacao] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<RequestPasswordResetInput>({ resolver: zodResolver(requestPasswordResetSchema) });

  function handleCaptchaSuccess(token: string) {
    setCaptchaToken(token);
    setValue('captchaToken', token);
  }

  function onSubmit(data: RequestPasswordResetInput) {
    if (!captchaToken) {
      setServerError('Complete o desafio CAPTCHA antes de continuar.');
      return;
    }
    setServerError(null);
    startTransition(async () => {
      const result = await requestPasswordReset(data);
      if (result.ok) {
        setConfirmacao(result.data.message);
      } else {
        setServerError(result.error.message);
      }
    });
  }

  // Após enviar, mostra apenas a confirmação genérica (sem reexibir o formulário).
  if (confirmacao) {
    return (
      <div className="flex flex-col gap-4">
        <div
          role="status"
          className="rounded-sm bg-[color-mix(in_srgb,var(--color-success)_10%,transparent)] p-4 text-sm text-success"
        >
          {confirmacao}
        </div>
        <p className="text-center text-xs text-fg-muted">
          <a href="/login" className="font-medium text-primary hover:underline">
            Voltar para o login
          </a>
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      method="post"
      noValidate
      className="flex flex-col gap-5"
    >
      <div className="flex flex-col gap-1">
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="seu@email.com"
          aria-describedby={errors.email ? 'email-error' : undefined}
          aria-invalid={!!errors.email}
          {...register('email')}
        />
        {errors.email && (
          <p id="email-error" role="alert" className="text-xs text-danger">
            {errors.email.message}
          </p>
        )}
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

      <Button type="submit" variant="primary" disabled={isPending}>
        {isPending ? 'Enviando…' : 'Enviar link de recuperação'}
      </Button>

      <p className="text-center text-xs text-fg-muted">
        Lembrou a senha?{' '}
        <a href="/login" className="font-medium text-primary hover:underline">
          Voltar para o login
        </a>
      </p>
    </form>
  );
}
