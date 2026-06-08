'use client';

import { useEffect, useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { inactivatePersonSchema } from '../schemas/inactivate-person.schema';
import type { InactivatePersonInput } from '../schemas/inactivate-person.schema';
import { inactivatePerson } from '../actions/inactivate-person';

const inputClass =
  'rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200';

interface InactivatePersonDialogProps {
  personId: string;
  personName: string;
}

/**
 * Diálogo de confirmação da inativação de uma Pessoa (USP-007 / #86).
 *
 * Coleta o motivo (obrigatório — L-004) e chama `inactivatePerson`. Trata os
 * `{ ok:false }`: PRECONDITION_FAILED (único responsável de Empresa — instrui a
 * designar novo responsável, E-003), FORBIDDEN, CONFLICT etc. são exibidos com a
 * mensagem da action. No sucesso, recarrega a rota para refletir o novo status.
 *
 * A rota `(app)/pessoas/[id]` já restringe o acesso a coordenador/diretoria; a
 * Server Action repete a checagem (defesa em profundidade).
 */
export function InactivatePersonDialog({ personId, personName }: InactivatePersonDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<InactivatePersonInput>({
    resolver: zodResolver(inactivatePersonSchema),
    defaultValues: { personId, reason: '' },
  });

  // Fecha com Esc enquanto aberto (acessibilidade).
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !isPending) closeDialog();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isPending]);

  function closeDialog() {
    setOpen(false);
    setServerError(null);
    reset({ personId, reason: '' });
  }

  function onSubmit(data: InactivatePersonInput) {
    setServerError(null);
    startTransition(async () => {
      const result = await inactivatePerson(data);
      if (result.ok) {
        setOpen(false);
        reset({ personId, reason: '' });
        router.refresh();
      } else {
        setServerError(result.error.message);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="self-start rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-300"
      >
        Inativar Pessoa
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !isPending && closeDialog()}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="inactivate-dialog-title"
            className="flex w-full max-w-md flex-col gap-4 rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="inactivate-dialog-title" className="text-lg font-bold text-gray-900">
              Inativar {personName}?
            </h2>
            <p className="text-sm text-gray-600">
              A Pessoa deixa de acessar o portal a partir de agora. O histórico (candidaturas,
              encaminhamentos, vagas, serviços e consentimentos) é preservado e continua visível
              para quem tem permissão. A inativação pode ser revertida por um responsável.
            </p>

            <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-3">
              <input type="hidden" {...register('personId')} />
              <div className="flex flex-col gap-1">
                <label htmlFor="reason" className="text-sm font-medium text-gray-700">
                  Motivo da inativação <span aria-hidden>*</span>
                </label>
                <textarea
                  id="reason"
                  rows={3}
                  autoFocus
                  placeholder="Ex.: desligamento do voluntário ao fim do projeto."
                  className={inputClass}
                  aria-describedby={errors.reason ? 'reason-error' : undefined}
                  aria-invalid={!!errors.reason}
                  {...register('reason')}
                />
                {errors.reason && (
                  <p id="reason-error" role="alert" className="text-xs text-red-600">
                    {errors.reason.message}
                  </p>
                )}
              </div>

              {serverError && (
                <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                  {serverError}
                </div>
              )}

              <div className="mt-1 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeDialog}
                  disabled={isPending}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200 disabled:opacity-60"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isPending ? 'Inativando…' : 'Confirmar inativação'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
