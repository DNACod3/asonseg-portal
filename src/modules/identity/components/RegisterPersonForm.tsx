'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Turnstile } from '@marsidev/react-turnstile';
import { Button, Input, Label } from '@/shared/ui';
import { registerPersonSchema } from '../schemas/registerPerson';
import type { RegisterPersonInput, PublicRole } from '../schemas/registerPerson';
import { registerPerson } from '../actions/registerPerson';
import type { ActionResult } from '@/shared/errors';
import type { RegisterPersonResult } from '../actions/registerPerson';

const ROLE_OPTIONS: { value: PublicRole; label: string; description: string }[] = [
  {
    value: 'CANDIDATE',
    label: 'Candidato(a)',
    description: 'Busco emprego ou oportunidades de trabalho',
  },
  {
    value: 'PROVIDER',
    label: 'Prestador(a) de Serviços',
    description: 'Ofereço serviços (doméstico, reparos, beleza, etc.)',
  },
  {
    value: 'CLIENT',
    label: 'Cliente',
    description: 'Quero contratar serviços de prestadores',
  },
];

interface Props {
  siteKey: string;
  onSuccess: (result: RegisterPersonResult) => void;
}

export function RegisterPersonForm({ siteKey, onSuccess }: Props) {
  const [isPending, startTransition] = useTransition();
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm<RegisterPersonInput>({
    resolver: zodResolver(registerPersonSchema),
  });

  function handleCaptchaSuccess(token: string) {
    setCaptchaToken(token);
    setValue('captchaToken', token);
  }

  function onSubmit(data: RegisterPersonInput) {
    if (!captchaToken) {
      setServerError('Complete o desafio CAPTCHA antes de continuar.');
      return;
    }
    setServerError(null);

    startTransition(async () => {
      const result: ActionResult<RegisterPersonResult> = await registerPerson(data);
      if (result.ok) {
        onSuccess(result.data);
      } else {
        setServerError(result.error.message);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      {/* Nome completo */}
      <div className="flex flex-col gap-1">
        <Label htmlFor="fullName">
          Nome completo <span aria-hidden>*</span>
        </Label>
        <Input
          id="fullName"
          type="text"
          autoComplete="name"
          placeholder="Maria da Silva"
          aria-describedby={errors.fullName ? 'fullName-error' : undefined}
          aria-invalid={!!errors.fullName}
          {...register('fullName')}
        />
        {errors.fullName && (
          <p id="fullName-error" role="alert" className="text-xs text-danger">
            {errors.fullName.message}
          </p>
        )}
      </div>

      {/* CPF */}
      <div className="flex flex-col gap-1">
        <Label htmlFor="cpf">
          CPF <span aria-hidden>*</span>
        </Label>
        <Input
          id="cpf"
          type="text"
          autoComplete="off"
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

      {/* E-mail */}
      <div className="flex flex-col gap-1">
        <Label htmlFor="email">
          E-mail <span aria-hidden>*</span>
        </Label>
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
        <Label htmlFor="password">
          Senha <span aria-hidden>*</span>
        </Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          placeholder="Mínimo 8 caracteres"
          aria-describedby={errors.password ? 'password-error' : undefined}
          aria-invalid={!!errors.password}
          {...register('password')}
        />
        {errors.password && (
          <p id="password-error" role="alert" className="text-xs text-danger">
            {errors.password.message}
          </p>
        )}
      </div>

      {/* Papel */}
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-fg">
          Como você quer usar o portal? <span aria-hidden>*</span>
        </legend>
        {ROLE_OPTIONS.map(({ value, label, description }) => (
          <label
            key={value}
            className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-background has-[:checked]:border-primary has-[:checked]:bg-[color-mix(in_srgb,var(--color-primary)_8%,transparent)]"
          >
            <input
              type="radio"
              value={value}
              className="mt-0.5 accent-primary"
              {...register('role')}
            />
            <span className="flex flex-col">
              <span className="text-sm font-medium text-fg">{label}</span>
              <span className="text-xs text-fg-muted">{description}</span>
            </span>
          </label>
        ))}
        {errors.role && (
          <p role="alert" className="text-xs text-danger">
            {errors.role.message}
          </p>
        )}
      </fieldset>

      {/* CAPTCHA Turnstile */}
      <input type="hidden" {...register('captchaToken')} />
      <div className="flex justify-center">
        <Turnstile
          siteKey={siteKey}
          onSuccess={handleCaptchaSuccess}
          options={{ language: 'pt-BR' }}
        />
      </div>
      {errors.captchaToken && (
        <p role="alert" className="text-center text-xs text-danger">
          {errors.captchaToken.message}
        </p>
      )}

      {/* Erro do servidor */}
      {serverError && (
        <div
          role="alert"
          className="rounded-sm bg-[color-mix(in_srgb,var(--color-danger)_10%,transparent)] p-3 text-sm text-danger"
        >
          {serverError}
        </div>
      )}

      <Button type="submit" variant="primary" size="lg" className="w-full" disabled={isPending}>
        {isPending ? 'Cadastrando…' : 'Criar conta'}
      </Button>

      <p className="text-center text-xs text-fg-muted">
        Ao cadastrar, você concorda com os{' '}
        <a href="/termos" className="underline hover:text-fg">
          termos de uso
        </a>{' '}
        e a{' '}
        <a href="/privacidade" className="underline hover:text-fg">
          política de privacidade
        </a>{' '}
        do portal ASONSEG.
      </p>
    </form>
  );
}
