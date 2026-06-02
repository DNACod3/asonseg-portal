'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  changePasswordFirstAccessSchema,
  type ChangePasswordFirstAccessInput,
} from '../schemas/changePassword';
import { changePasswordFirstAccess } from '../actions/changePassword';

/**
 * Formulário de troca de senha no 1º acesso (USP-004 — T-09). Forçado quando a
 * credencial tem `primeiroAcesso=true`; ao salvar, libera a navegação e segue
 * para `/inicio`.
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
        <label htmlFor="senhaNova" className="text-sm font-medium text-gray-700">
          Nova senha
        </label>
        <input
          id="senhaNova"
          type="password"
          autoComplete="new-password"
          placeholder="Mínimo 8 caracteres, com letras e números"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          aria-describedby={errors.senhaNova ? 'senhaNova-error' : undefined}
          aria-invalid={!!errors.senhaNova}
          {...register('senhaNova')}
        />
        {errors.senhaNova && (
          <p id="senhaNova-error" role="alert" className="text-xs text-red-600">
            {errors.senhaNova.message}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="confirmar" className="text-sm font-medium text-gray-700">
          Confirmar nova senha
        </label>
        <input
          id="confirmar"
          type="password"
          autoComplete="new-password"
          placeholder="Repita a nova senha"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          aria-describedby={errors.confirmar ? 'confirmar-error' : undefined}
          aria-invalid={!!errors.confirmar}
          {...register('confirmar')}
        />
        {errors.confirmar && (
          <p id="confirmar-error" role="alert" className="text-xs text-red-600">
            {errors.confirmar.message}
          </p>
        )}
      </div>

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
        {isPending ? 'Salvando…' : 'Salvar nova senha'}
      </button>
    </form>
  );
}
