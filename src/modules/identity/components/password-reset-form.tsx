'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Input, Label } from '@/shared/ui';
import { resetPasswordSchema, type ResetPasswordInput } from '../schemas/password-reset.schema';
import { resetPassword } from '../actions/reset-password';

/**
 * Formulário de definição de nova senha (USP-005 — #72). Recebe o `token` lido
 * da URL pela página. RHF + Zod consumindo `resetPassword`; no sucesso navega
 * para o login (a action encerra a sessão de recuperação). Token inválido ou
 * expirado vem como erro do servidor e é exibido aqui.
 *
 * Refactor Fase 1 (AD-014, USP-005 delta): restilizado com os primitivos
 * (`Input`/`Label`/`Button`) e tokens do Design System — o campo `token` oculto
 * e o fluxo (RHF/Zod/resetPassword/redirect) preservados sem alteração.
 */
export function PasswordResetForm({ token }: { token: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token },
  });

  function onSubmit(data: ResetPasswordInput) {
    setServerError(null);
    startTransition(async () => {
      const result = await resetPassword(data);
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
      <input type="hidden" {...register('token')} />

      <div className="flex flex-col gap-1">
        <Label htmlFor="senhaNova">Nova senha</Label>
        <Input
          id="senhaNova"
          type="password"
          autoComplete="new-password"
          placeholder="Mínimo 8 caracteres, com letras e números"
          aria-describedby={errors.senhaNova ? 'senhaNova-error' : undefined}
          aria-invalid={!!errors.senhaNova}
          {...register('senhaNova')}
        />
        {errors.senhaNova && (
          <p id="senhaNova-error" role="alert" className="text-xs text-danger">
            {errors.senhaNova.message}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="confirmar">Confirmar nova senha</Label>
        <Input
          id="confirmar"
          type="password"
          autoComplete="new-password"
          placeholder="Repita a nova senha"
          aria-describedby={errors.confirmar ? 'confirmar-error' : undefined}
          aria-invalid={!!errors.confirmar}
          {...register('confirmar')}
        />
        {errors.confirmar && (
          <p id="confirmar-error" role="alert" className="text-xs text-danger">
            {errors.confirmar.message}
          </p>
        )}
      </div>

      {serverError && (
        <div
          role="alert"
          className="rounded-sm bg-[color-mix(in_srgb,var(--color-danger)_10%,transparent)] p-3 text-sm text-danger"
        >
          {serverError}
        </div>
      )}

      <Button type="submit" variant="primary" disabled={isPending}>
        {isPending ? 'Salvando…' : 'Redefinir senha'}
      </Button>
    </form>
  );
}
