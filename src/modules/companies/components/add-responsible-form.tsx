'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, Input, Label } from '@/shared/ui';
import { adicionarResponsavel } from '../actions/add-responsible';

// SPEC_DEVIATION (Level-1): o design §4 descreve um fluxo de duas etapas
// (buscar Pessoa → confirmar). Colapsamos em uma única chamada de ação sem PII:
// `adicionarResponsavel` resolve a busca server-side e NÃO retorna identidade do
// alvo (P-001). Single-step é estritamente mais privado — diverge apenas da UX do
// design, não de nenhum must-not (P-NNN).

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
 *
 * Fundação de Design System da Fase 2 (AD-014/AD-015): restilizado com os
 * primitivos (`Input`/`Label`/`Button`) e tokens — fluxo (RHF/Zod/
 * adicionarResponsavel/mensagem neutra/single-step) preservado.
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
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold text-fg">Adicionar responsável</h2>
        <p className="mt-1 text-sm text-fg-muted">
          Informe o CPF ou e-mail de uma pessoa <strong>já cadastrada</strong> no portal. O
          vínculo fica pendente até que ela aceite o convite.
        </p>
      </div>

      <div>
        <Label htmlFor="cpfOuEmail">CPF ou e-mail</Label>
        <Input
          id="cpfOuEmail"
          type="text"
          placeholder="CPF (somente números) ou e-mail"
          aria-describedby={errors.cpfOuEmail ? 'cpfOuEmail-error' : undefined}
          aria-invalid={!!errors.cpfOuEmail}
          {...register('cpfOuEmail')}
        />
        {errors.cpfOuEmail && (
          <p id="cpfOuEmail-error" role="alert" className="mt-1 text-xs text-danger">
            {errors.cpfOuEmail.message}
          </p>
        )}
      </div>

      {success && (
        <div
          role="status"
          className="rounded-sm bg-[color-mix(in_srgb,var(--color-success)_10%,transparent)] p-3 text-sm text-success"
        >
          {success}
        </div>
      )}

      {serverError && (
        <div
          role="alert"
          className="rounded-sm bg-[color-mix(in_srgb,var(--color-danger)_10%,transparent)] p-3 text-sm text-danger"
        >
          {serverError}
        </div>
      )}

      <Button type="submit" variant="primary" size="sm" disabled={isPending} className="self-start">
        {isPending ? 'Enviando…' : 'Enviar convite'}
      </Button>
    </form>
  );
}
