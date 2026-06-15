'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { adicionarResponsavel } from '../actions/add-responsible';

// SPEC_DEVIATION (Level-1): o design §4 descreve um fluxo de duas etapas
// (buscar Pessoa → confirmar). Colapsamos em uma única chamada de ação sem PII:
// `adicionarResponsavel` resolve a busca server-side e NÃO retorna identidade do
// alvo (P-001). Single-step é estritamente mais privado — diverge apenas da UX do
// design, não de nenhum must-not (P-NNN).

const inputClass =
  'rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 w-full';
const errorClass = 'mt-1 text-xs text-red-600';
const labelClass = 'block text-sm font-medium text-gray-700 mb-1';

/**
 * Schema do formulário: o `empresaId` vem das props (não é digitado), então o
 * form coleta só o identificador. Reusa a regra de CPF|e-mail do schema da ação.
 */
const formSchema = z.object({
  cpfOuEmail: z
    .string()
    .min(1, 'Informe um CPF ou e-mail.'),
});
type AddResponsibleFormValues = z.infer<typeof formSchema>;

export interface AddResponsibleFormProps {
  empresaId: string;
}

/**
 * Formulário de adição de responsável (USP-013). O responsável ATIVO informa o
 * CPF ou e-mail de uma Pessoa já cadastrada; o vínculo nasce PENDENTE até o
 * aceite dela. Nunca exibimos nome/identidade do alvo (P-001) — a ação não
 * retorna PII e o sucesso é confirmado de forma neutra.
 */
export function AddResponsibleForm({ empresaId }: AddResponsibleFormProps) {
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AddResponsibleFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { cpfOuEmail: '' },
  });

  function onSubmit(data: AddResponsibleFormValues) {
    setServerError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await adicionarResponsavel({ empresaId, cpfOuEmail: data.cpfOuEmail });
      if (result.ok) {
        reset({ cpfOuEmail: '' });
        setSuccess('Convite enviado. O vínculo ficará pendente até a pessoa aceitar.');
      } else {
        setServerError(result.error.message);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 max-w-lg">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Adicionar responsável</h2>
        <p className="mt-1 text-sm text-gray-600">
          Informe o CPF ou e-mail de uma pessoa <strong>já cadastrada</strong> no portal. O
          vínculo fica pendente até que ela aceite o convite.
        </p>
      </div>

      <div>
        <label className={labelClass} htmlFor="cpfOuEmail">
          CPF ou e-mail
        </label>
        <input
          id="cpfOuEmail"
          type="text"
          placeholder="CPF (somente números) ou e-mail"
          className={inputClass}
          aria-describedby={errors.cpfOuEmail ? 'cpfOuEmail-error' : undefined}
          {...register('cpfOuEmail')}
        />
        {errors.cpfOuEmail && (
          <p id="cpfOuEmail-error" className={errorClass}>
            {errors.cpfOuEmail.message}
          </p>
        )}
      </div>

      {success && (
        <div
          role="status"
          className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700"
        >
          {success}
        </div>
      )}

      {serverError && (
        <div
          role="alert"
          className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700"
        >
          {serverError}
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors self-start"
      >
        {isPending ? 'Enviando…' : 'Enviar convite'}
      </button>
    </form>
  );
}
