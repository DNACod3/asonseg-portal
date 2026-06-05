'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerByAssistantSchema } from '../schemas/register-by-assistant.schema';
import type { RegisterByAssistantInput } from '../schemas/register-by-assistant.schema';
import { CPF_EXCEPTION_MIN_JUSTIFICATION } from '../domain/assisted-registration';
import { registerPersonByAssistant } from '../actions/register-person-by-assistant';
import type { RegisterByAssistantResult } from '../actions/register-person-by-assistant';
import type { ActionResult } from '@/shared/errors';

const ROLE_OPTIONS: { value: RegisterByAssistantInput['role']; label: string }[] = [
  { value: undefined, label: 'Não definir agora' },
  { value: 'CANDIDATE', label: 'Candidato(a) — busca emprego' },
  { value: 'PROVIDER', label: 'Prestador(a) de serviços' },
  { value: 'CLIENT', label: 'Cliente — contrata serviços' },
];

const inputClass =
  'rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200';

export function AssistedRegisterForm() {
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState<RegisterByAssistantResult | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<RegisterByAssistantInput>({
    resolver: zodResolver(registerByAssistantSchema),
    defaultValues: { cpfException: false },
  });

  const cpfException = watch('cpfException');

  function onSubmit(data: RegisterByAssistantInput) {
    setServerError(null);
    startTransition(async () => {
      const result: ActionResult<RegisterByAssistantResult> =
        await registerPersonByAssistant(data);
      if (result.ok) {
        setSuccess(result.data);
        reset({ cpfException: false });
      } else {
        setServerError(result.error.message);
      }
    });
  }

  if (success) {
    return (
      <div role="status" className="flex flex-col gap-4 rounded-xl border border-green-200 bg-green-50 p-5">
        <p className="text-sm font-medium text-green-800">
          Pessoa cadastrada com sucesso
          {success.cpfException ? ' (com exceção de CPF registrada).' : '.'}
        </p>
        <p className="text-xs text-green-700">
          A Pessoa já pode ser referenciada em encaminhamentos, ficha social e relatórios. Como foi
          cadastrada sem credencial, ela não acessa o portal até reivindicar uma credencial.
        </p>
        <button
          type="button"
          onClick={() => setSuccess(null)}
          className="self-start rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
        >
          Cadastrar outra Pessoa
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      {/* Nome completo (obrigatório) */}
      <div className="flex flex-col gap-1">
        <label htmlFor="fullName" className="text-sm font-medium text-gray-700">
          Nome completo <span aria-hidden>*</span>
        </label>
        <input
          id="fullName"
          type="text"
          autoComplete="name"
          placeholder="Maria da Silva"
          className={inputClass}
          aria-describedby={errors.fullName ? 'fullName-error' : undefined}
          aria-invalid={!!errors.fullName}
          {...register('fullName')}
        />
        {errors.fullName && (
          <p id="fullName-error" role="alert" className="text-xs text-red-600">
            {errors.fullName.message}
          </p>
        )}
      </div>

      {/* Marca de exceção de CPF (exclusiva deste fluxo — E-005/P-001) */}
      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
        <input type="checkbox" className="mt-0.5 accent-amber-600" {...register('cpfException')} />
        <span className="flex flex-col">
          <span className="text-sm font-medium text-amber-900">Pessoa sem documento — exceção</span>
          <span className="text-xs text-amber-700">
            Marque apenas quando a Pessoa não tem CPF. Exige justificativa e fica registrada na
            auditoria.
          </span>
        </span>
      </label>

      {/* CPF — escondido quando a exceção está marcada */}
      {!cpfException && (
        <div className="flex flex-col gap-1">
          <label htmlFor="cpf" className="text-sm font-medium text-gray-700">
            CPF <span aria-hidden>*</span>
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
      )}

      {/* Justificativa — só quando a exceção está marcada */}
      {cpfException && (
        <div className="flex flex-col gap-1">
          <label htmlFor="cpfExceptionJustification" className="text-sm font-medium text-gray-700">
            Justificativa da exceção <span aria-hidden>*</span>
          </label>
          <textarea
            id="cpfExceptionJustification"
            rows={3}
            placeholder={`Descreva o motivo (mínimo ${CPF_EXCEPTION_MIN_JUSTIFICATION} caracteres)`}
            className={inputClass}
            aria-describedby={
              errors.cpfExceptionJustification ? 'cpfExceptionJustification-error' : undefined
            }
            aria-invalid={!!errors.cpfExceptionJustification}
            {...register('cpfExceptionJustification')}
          />
          {errors.cpfExceptionJustification && (
            <p id="cpfExceptionJustification-error" role="alert" className="text-xs text-red-600">
              {errors.cpfExceptionJustification.message}
            </p>
          )}
        </div>
      )}

      {/* Campos opcionais */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="phone" className="text-sm font-medium text-gray-700">
            Telefone <span className="text-gray-400">(opcional)</span>
          </label>
          <input
            id="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="(48) 99999-9999"
            className={inputClass}
            aria-invalid={!!errors.phone}
            {...register('phone')}
          />
          {errors.phone && (
            <p role="alert" className="text-xs text-red-600">
              {errors.phone.message}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="birthDate" className="text-sm font-medium text-gray-700">
            Data de nascimento <span className="text-gray-400">(opcional)</span>
          </label>
          <input
            id="birthDate"
            type="date"
            className={inputClass}
            aria-invalid={!!errors.birthDate}
            {...register('birthDate')}
          />
          {errors.birthDate && (
            <p role="alert" className="text-xs text-red-600">
              {errors.birthDate.message}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="fullAddress" className="text-sm font-medium text-gray-700">
          Endereço <span className="text-gray-400">(opcional)</span>
        </label>
        <input
          id="fullAddress"
          type="text"
          autoComplete="street-address"
          placeholder="Rua, número, bairro, cidade"
          className={inputClass}
          aria-invalid={!!errors.fullAddress}
          {...register('fullAddress')}
        />
        {errors.fullAddress && (
          <p role="alert" className="text-xs text-red-600">
            {errors.fullAddress.message}
          </p>
        )}
      </div>

      {/* Evidência do consentimento de atendimento social colhido em papel (E-004) */}
      <div className="flex flex-col gap-1">
        <label htmlFor="signedOnPaperAt" className="text-sm font-medium text-gray-700">
          Data da assinatura do termo (papel) <span className="text-gray-400">(opcional)</span>
        </label>
        <input
          id="signedOnPaperAt"
          type="date"
          className={inputClass}
          aria-invalid={!!errors.signedOnPaperAt}
          {...register('signedOnPaperAt')}
        />
        {errors.signedOnPaperAt ? (
          <p role="alert" className="text-xs text-red-600">
            {errors.signedOnPaperAt.message}
          </p>
        ) : (
          <p className="text-xs text-gray-500">
            Termo de atendimento social assinado em papel, no atendimento. Em branco, usa a data de
            hoje.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="role" className="text-sm font-medium text-gray-700">
          Papel pretendido <span className="text-gray-400">(opcional)</span>
        </label>
        <select id="role" className={inputClass} {...register('role')}>
          {ROLE_OPTIONS.map(({ value, label }) => (
            <option key={label} value={value ?? ''}>
              {label}
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-500">
          O papel só é ativado depois que a Pessoa reivindicar credencial e consentir com a
          finalidade.
        </p>
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
        {isPending ? 'Cadastrando…' : 'Cadastrar Pessoa'}
      </button>
    </form>
  );
}
