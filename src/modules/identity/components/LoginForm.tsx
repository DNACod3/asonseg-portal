'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { signInSchema, type SignInInput } from '../schemas/signIn';
import { loginAction } from '../actions/login';

/**
 * Formulário de login (USP-004 — T-07). RHF + Zod (validação client-side de
 * formato) consumindo a Server Action `loginAction`. Qualquer falha do servidor
 * exibe a **mensagem única** vinda da action (anti-enumeração — D-G); o sucesso
 * navega para `redirectTo` (`/inicio` ou `/trocar-senha` no 1º acesso).
 */
export function LoginForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignInInput>({ resolver: zodResolver(signInSchema) });

  function onSubmit(data: SignInInput) {
    setServerError(null);
    startTransition(async () => {
      const result = await loginAction(data);
      if (result.ok) {
        router.replace(result.data.redirectTo);
        router.refresh();
      } else {
        setServerError(result.error.message);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      {/* E-mail */}
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

      {/* Senha */}
      <div className="flex flex-col gap-1">
        <label htmlFor="senha" className="text-sm font-medium text-gray-700">
          Senha
        </label>
        <input
          id="senha"
          type="password"
          autoComplete="current-password"
          placeholder="Sua senha"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          aria-describedby={errors.senha ? 'senha-error' : undefined}
          aria-invalid={!!errors.senha}
          {...register('senha')}
        />
        {errors.senha && (
          <p id="senha-error" role="alert" className="text-xs text-red-600">
            {errors.senha.message}
          </p>
        )}
        <a
          href="/recuperar-senha"
          className="self-end text-xs font-medium text-blue-600 hover:underline"
        >
          Esqueci minha senha
        </a>
      </div>

      {/* Erro do servidor (mensagem única, anti-enumeração) */}
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
        {isPending ? 'Entrando…' : 'Entrar'}
      </button>

      <p className="text-center text-xs text-gray-500">
        Ainda não tem conta?{' '}
        <a href="/cadastro" className="font-medium text-blue-600 hover:underline">
          Criar conta
        </a>
      </p>
    </form>
  );
}
