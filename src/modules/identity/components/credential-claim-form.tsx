'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ActionResult } from '@/shared/errors';
import { requestCredentialClaim } from '../actions/request-credential-claim';
import type { RequestCredentialClaimResult } from '../actions/request-credential-claim';
import {
  requestCredentialClaimSchema,
  CREDENTIAL_VERIFICATION_METHODS,
  VERIFICATION_METHOD_LABELS,
  type RequestCredentialClaimInput,
} from '../schemas/credential-claim.schema';

const inputClass =
  'rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200';

/**
 * Formulário público de solicitação de reivindicação de credencial (USP-003 /
 * IDN-07). A resposta é sempre genérica — não revela se a Pessoa existe (P-006).
 */
export function CredentialClaimForm() {
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RequestCredentialClaimInput>({
    resolver: zodResolver(requestCredentialClaimSchema),
    defaultValues: { verificationMethod: 'AS_CONFIRMATION' },
  });

  function onSubmit(data: RequestCredentialClaimInput) {
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
        className="flex flex-col gap-3 rounded-xl border border-green-200 bg-green-50 p-5"
      >
        <p className="text-sm font-medium text-green-800">Solicitação enviada</p>
        <p className="text-xs text-green-700">{successMessage}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      <p className="text-xs text-gray-500">
        Informe o CPF (ou um identificador alternativo) da Pessoa já cadastrada e o e-mail que deseja
        usar para acessar o portal. Nossa equipe fará a verificação de identidade antes de ativar a
        credencial.
      </p>

      {/* CPF */}
      <div className="flex flex-col gap-1">
        <label htmlFor="cpf" className="text-sm font-medium text-gray-700">
          CPF
        </label>
        <input
          id="cpf"
          type="text"
          inputMode="numeric"
          placeholder="000.000.000-00"
          maxLength={14}
          className={inputClass}
          aria-describedby={errors.cpf ? 'cpf-error' : undefined}
          aria-invalid={!!errors.cpf}
          {...register('cpf')}
        />
        {errors.cpf && (
          <p id="cpf-error" role="alert" className="text-xs text-red-600">
            {errors.cpf.message}
          </p>
        )}
      </div>

      {/* Identificador alternativo */}
      <div className="flex flex-col gap-1">
        <label htmlFor="alternativeIdentifier" className="text-sm font-medium text-gray-700">
          Identificador alternativo <span className="text-gray-400">(se não tiver CPF)</span>
        </label>
        <input
          id="alternativeIdentifier"
          type="text"
          placeholder="Protocolo de atendimento, nome completo, etc."
          className={inputClass}
          aria-invalid={!!errors.alternativeIdentifier}
          {...register('alternativeIdentifier')}
        />
        {errors.alternativeIdentifier && (
          <p role="alert" className="text-xs text-red-600">
            {errors.alternativeIdentifier.message}
          </p>
        )}
      </div>

      {/* E-mail desejado */}
      <div className="flex flex-col gap-1">
        <label htmlFor="requestedEmail" className="text-sm font-medium text-gray-700">
          E-mail desejado <span aria-hidden>*</span>
        </label>
        <input
          id="requestedEmail"
          type="email"
          autoComplete="email"
          placeholder="voce@exemplo.com"
          className={inputClass}
          aria-describedby={errors.requestedEmail ? 'requestedEmail-error' : undefined}
          aria-invalid={!!errors.requestedEmail}
          {...register('requestedEmail')}
        />
        {errors.requestedEmail && (
          <p id="requestedEmail-error" role="alert" className="text-xs text-red-600">
            {errors.requestedEmail.message}
          </p>
        )}
      </div>

      {/* Meio de verificação */}
      <div className="flex flex-col gap-1">
        <label htmlFor="verificationMethod" className="text-sm font-medium text-gray-700">
          Meio de verificação preferido
        </label>
        <select id="verificationMethod" className={inputClass} {...register('verificationMethod')}>
          {CREDENTIAL_VERIFICATION_METHODS.map((method) => (
            <option key={method} value={method}>
              {VERIFICATION_METHOD_LABELS[method]}
            </option>
          ))}
        </select>
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
        {isPending ? 'Enviando…' : 'Solicitar reivindicação'}
      </button>
    </form>
  );
}
