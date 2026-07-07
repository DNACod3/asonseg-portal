'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Input, Label } from '@/shared/ui';
import {
  changePasswordFirstAccessSchema,
  type ChangePasswordFirstAccessInput,
} from '../schemas/changePassword';
import { changePasswordFirstAccess } from '../actions/changePassword';

/**
 * Formulário de troca de senha no 1º acesso (USP-004 — T-09). Forçado quando a
 * credencial tem `primeiroAcesso=true`; ao salvar, libera a navegação e segue
 * para `/inicio`.
 *
 * Refactor Fase 1 (AD-014, USP-004 delta): restilizado com os primitivos
 * (`Input`/`Label`/`Button`) e tokens do Design System, seguindo o padrão do
 * `LoginForm` — fluxo (RHF/Zod/changePasswordFirstAccess/redirect) preservado
 * sem alteração.
 */
export function ChangePasswordForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ChangePasswordFirstAccessInput>({
    resolver: zodResolver(changePasswordFirstAccessSchema),
  });

  function onSubmit(data: ChangePasswordFirstAccessInput) {
    setServerError(null);
    startTransition(async () => {
      const result = await changePasswordFirstAccess(data);
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
        {isPending ? 'Salvando…' : 'Salvar nova senha'}
      </Button>
    </form>
  );
}
