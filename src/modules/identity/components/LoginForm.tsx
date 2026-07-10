'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Turnstile } from '@marsidev/react-turnstile';
import { Button, Input, Label } from '@/shared/ui';
import { signInSchema, type SignInInput } from '../schemas/signIn';
import { loginAction } from '../actions/login';

interface Props {
  /** Site key pública do Turnstile — só usada quando o servidor exige CAPTCHA (H1). */
  siteKey: string;
}

/**
 * Formulário de login (USP-004 — T-07). RHF + Zod (validação client-side de
 * formato) consumindo a Server Action `loginAction`. Qualquer falha do servidor
 * exibe a **mensagem única** vinda da action (anti-enumeração — D-G); o sucesso
 * navega para `redirectTo` (`/inicio` ou `/trocar-senha` no 1º acesso).
 *
 * Fundação de Design System da Fase 1 (T13, DS-18/DS-19/DS-20): restilizado
 * com os primitivos (`Input`/`Label`/`Button`) e tokens — fluxos (RHF/Zod/
 * loginAction/mensagem única/navegação) preservados sem alteração.
 *
 * CAPTCHA adaptativo (H1, Fase 6 — hardening): o widget Turnstile só é
 * renderizado quando o servidor sinaliza `error.code === 'CAPTCHA_REQUIRED'`
 * (≥3 falhas recentes na chave `email, ip`) — o caminho feliz (<3 falhas)
 * nunca carrega o widget, sem fricção adicional.
 */
export function LoginForm({ siteKey }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [captchaRequired, setCaptchaRequired] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<SignInInput>({ resolver: zodResolver(signInSchema) });

  function handleCaptchaSuccess(token: string) {
    setValue('captchaToken', token);
  }

  function onSubmit(data: SignInInput) {
    setServerError(null);
    startTransition(async () => {
      const result = await loginAction(data);
      if (result.ok) {
        router.replace(result.data.redirectTo);
        router.refresh();
      } else {
        if (result.error.code === 'CAPTCHA_REQUIRED') {
          setCaptchaRequired(true);
        }
        setServerError(result.error.message);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      {/* E-mail */}
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

      {/* Senha */}
      <div className="flex flex-col gap-1">
        <Label htmlFor="senha">Senha</Label>
        <Input
          id="senha"
          type="password"
          autoComplete="current-password"
          placeholder="Sua senha"
          aria-describedby={errors.senha ? 'senha-error' : undefined}
          aria-invalid={!!errors.senha}
          {...register('senha')}
        />
        {errors.senha && (
          <p id="senha-error" role="alert" className="text-xs text-danger">
            {errors.senha.message}
          </p>
        )}
        <a href="/recuperar-senha" className="self-end text-xs font-medium text-primary hover:underline">
          Esqueci minha senha
        </a>
      </div>

      {/* CAPTCHA Turnstile — só aparece quando o servidor exige (H1, ≥3 falhas) */}
      {/* DS-MN-03: usa o primitivo Input (não o elemento nativo cru) mesmo no campo hidden. */}
      <Input type="hidden" {...register('captchaToken')} />
      {captchaRequired && (
        <div className="flex justify-center">
          <Turnstile siteKey={siteKey} onSuccess={handleCaptchaSuccess} options={{ language: 'pt-BR' }} />
        </div>
      )}

      {/* Erro do servidor (mensagem única, anti-enumeração) */}
      {serverError && (
        <div
          role="alert"
          className="rounded-sm bg-[color-mix(in_srgb,var(--color-danger)_10%,transparent)] p-3 text-sm text-danger"
        >
          {serverError}
        </div>
      )}

      <Button type="submit" variant="primary" disabled={isPending}>
        {isPending ? 'Entrando…' : 'Entrar'}
      </Button>

      <p className="text-center text-xs text-fg-muted">
        Ainda não tem conta?{' '}
        <a href="/cadastro" className="font-medium text-primary hover:underline">
          Criar conta
        </a>
      </p>
    </form>
  );
}
