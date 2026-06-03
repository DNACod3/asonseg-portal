'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Turnstile } from '@marsidev/react-turnstile';
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
        <div role="status" className="rounded-lg bg-green-50 p-4 text-sm text-green-800">
          {confirmacao}
        </div>
        <p className="text-center text-xs text-gray-500">
          <a href="/login" className="font-medium text-blue-600 hover:underline">
            Voltar para o login
          </a>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-sm font-medium text-gray-700">
          E-mail
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="seu@email.com"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          aria-describedby={errors.email ? 'email-error' : undefined}
          aria-invalid={!!errors.email}
          {...register('email')}
        />
        {errors.email && (
          <p id="email-error" role="alert" className="text-xs text-red-600">
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
        <p role="alert" className="text-center text-xs text-red-600">
          {errors.captchaToken.message}
        </p>
      )}

      {serverError && (
        <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {serverError}
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? 'Enviando…' : 'Enviar link de recuperação'}
      </button>

      <p className="text-center text-xs text-gray-500">
        Lembrou a senha?{' '}
        <a href="/login" className="font-medium text-blue-600 hover:underline">
          Voltar para o login
        </a>
      </p>
    </form>
  );
}
