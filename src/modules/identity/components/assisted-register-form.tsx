'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Input, Label, Textarea } from '@/shared/ui';
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

const selectClass =
  'w-full rounded-sm border-[1.5px] border-border bg-surface px-4 py-3 text-[0.95rem] text-fg focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary';

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
      <div
        role="status"
        className="flex flex-col gap-4 rounded-sm border border-success bg-[color-mix(in_srgb,var(--color-success)_10%,transparent)] p-5"
      >
        <p className="text-sm font-medium text-success">
          Pessoa cadastrada com sucesso
          {success.cpfException ? ' (com exceção de CPF registrada).' : '.'}
        </p>
        <p className="text-xs text-fg-muted">
          A Pessoa já pode ser referenciada em encaminhamentos, ficha social e relatórios. Como foi
          cadastrada sem credencial, ela não acessa o portal até reivindicar uma credencial.
        </p>
        <Button
          type="button"
          variant="outline"
          className="self-start"
          onClick={() => setSuccess(null)}
        >
          Cadastrar outra Pessoa
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      {/* Nome completo (obrigatório) */}
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

      {/* Marca de exceção de CPF (exclusiva deste fluxo — E-005/P-001) */}
      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-cta bg-[color-mix(in_srgb,var(--color-cta)_10%,transparent)] p-3">
        <input type="checkbox" className="mt-0.5 accent-cta" {...register('cpfException')} />
        <span className="flex flex-col">
          <span className="text-sm font-medium text-fg">Pessoa sem documento — exceção</span>
          <span className="text-xs text-fg-muted">
            Marque apenas quando a Pessoa não tem CPF. Exige justificativa e fica registrada na
            auditoria.
          </span>
        </span>
      </label>

      {/* CPF — escondido quando a exceção está marcada */}
      {!cpfException && (
        <div className="flex flex-col gap-1">
          <Label htmlFor="cpf">
            CPF <span aria-hidden>*</span>
          </Label>
          <Input
            id="cpf"
            type="text"
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
      )}

      {/* Justificativa — só quando a exceção está marcada */}
      {cpfException && (
        <div className="flex flex-col gap-1">
          <Label htmlFor="cpfExceptionJustification">
            Justificativa da exceção <span aria-hidden>*</span>
          </Label>
          <Textarea
            id="cpfExceptionJustification"
            rows={3}
            placeholder={`Descreva o motivo (mínimo ${CPF_EXCEPTION_MIN_JUSTIFICATION} caracteres)`}
            aria-describedby={
              errors.cpfExceptionJustification ? 'cpfExceptionJustification-error' : undefined
            }
            aria-invalid={!!errors.cpfExceptionJustification}
            {...register('cpfExceptionJustification')}
          />
          {errors.cpfExceptionJustification && (
            <p id="cpfExceptionJustification-error" role="alert" className="text-xs text-danger">
              {errors.cpfExceptionJustification.message}
            </p>
          )}
        </div>
      )}

      {/* Campos opcionais */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="phone">
            Telefone <span className="text-fg-muted">(opcional)</span>
          </Label>
          <Input
            id="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="(48) 99999-9999"
            aria-invalid={!!errors.phone}
            {...register('phone')}
          />
          {errors.phone && (
            <p role="alert" className="text-xs text-danger">
              {errors.phone.message}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="birthDate">
            Data de nascimento <span className="text-fg-muted">(opcional)</span>
          </Label>
          <Input
            id="birthDate"
            type="date"
            aria-invalid={!!errors.birthDate}
            {...register('birthDate')}
          />
          {errors.birthDate && (
            <p role="alert" className="text-xs text-danger">
              {errors.birthDate.message}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="fullAddress">
          Endereço <span className="text-fg-muted">(opcional)</span>
        </Label>
        <Input
          id="fullAddress"
          type="text"
          autoComplete="street-address"
          placeholder="Rua, número, bairro, cidade"
          aria-invalid={!!errors.fullAddress}
          {...register('fullAddress')}
        />
        {errors.fullAddress && (
          <p role="alert" className="text-xs text-danger">
            {errors.fullAddress.message}
          </p>
        )}
      </div>

      {/* Evidência do consentimento de atendimento social colhido em papel (E-004) */}
      <div className="flex flex-col gap-1">
        <Label htmlFor="signedOnPaperAt">
          Data da assinatura do termo (papel) <span className="text-fg-muted">(opcional)</span>
        </Label>
        <Input
          id="signedOnPaperAt"
          type="date"
          aria-invalid={!!errors.signedOnPaperAt}
          {...register('signedOnPaperAt')}
        />
        {errors.signedOnPaperAt ? (
          <p role="alert" className="text-xs text-danger">
            {errors.signedOnPaperAt.message}
          </p>
        ) : (
          <p className="text-xs text-fg-muted">
            Termo de atendimento social assinado em papel, no atendimento. Em branco, usa a data de
            hoje.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="role">
          Papel pretendido <span className="text-fg-muted">(opcional)</span>
        </Label>
        <select id="role" className={selectClass} {...register('role')}>
          {ROLE_OPTIONS.map(({ value, label }) => (
            <option key={label} value={value ?? ''}>
              {label}
            </option>
          ))}
        </select>
        <p className="text-xs text-fg-muted">
          O papel só é ativado depois que a Pessoa reivindicar credencial e consentir com a
          finalidade.
        </p>
      </div>

      {serverError && (
        <div
          role="alert"
          className="rounded-sm bg-[color-mix(in_srgb,var(--color-danger)_10%,transparent)] p-3 text-sm text-danger"
        >
          {serverError}
        </div>
      )}

      <Button type="submit" variant="primary" size="lg" className="w-full" disabled={isPending}>
        {isPending ? 'Cadastrando…' : 'Cadastrar Pessoa'}
      </Button>
    </form>
  );
}
