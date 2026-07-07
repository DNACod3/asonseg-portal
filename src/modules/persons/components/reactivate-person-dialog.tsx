'use client';

import { useEffect, useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { Button, Label, Textarea } from '@/shared/ui';
import { reactivatePersonSchema } from '../schemas/reactivate-person.schema';
import type { ReactivatePersonInput } from '../schemas/reactivate-person.schema';
import { reactivatePerson } from '../actions/reactivate-person';

interface ReactivatePersonDialogProps {
  personId: string;
  personName: string;
}

/**
 * Diálogo de confirmação da reativação de uma Pessoa (USP-045).
 *
 * Coleta o motivo (obrigatório — L-003) e chama `reactivatePerson`. Trata os
 * `{ ok:false }` exibindo a mensagem da action. No sucesso, recarrega a rota
 * para refletir o novo status (E-004 — login volta a ser aceito na próxima
 * requisição após o flip de status).
 *
 * Aviso explícito na UI: grants zerados (E-003 / D-002) — o operador precisa
 * reconceder papéis conscientemente (USP-008).
 */
export function ReactivatePersonDialog({ personId, personName }: ReactivatePersonDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ReactivatePersonInput>({
    resolver: zodResolver(reactivatePersonSchema),
    defaultValues: { personId, reason: '' },
  });

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

  function onSubmit(data: ReactivatePersonInput) {
    setServerError(null);
    startTransition(async () => {
      const result = await reactivatePerson(data);
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
      <Button type="button" variant="primary" onClick={() => setOpen(true)} className="self-start">
        Reativar Pessoa
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !isPending && closeDialog()}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="reactivate-dialog-title"
            className="flex w-full max-w-md flex-col gap-4 rounded-lg bg-surface p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="reactivate-dialog-title" className="text-lg font-bold text-fg">
              Reativar {personName}?
            </h2>
            <p className="text-sm text-fg-muted">
              O acesso ao portal será restabelecido na próxima requisição da Pessoa. O histórico
              permanece íntegro.
            </p>
            <div className="rounded-sm bg-[color-mix(in_srgb,var(--color-cta)_10%,transparent)] p-3 text-sm text-cta">
              <strong>Atenção:</strong> todos os papéis e permissões anteriores serão removidos. A
              Pessoa voltará sem privilégios — você precisará reconceder os papéis necessários
              manualmente após a reativação.
            </div>

            <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-3">
              <input type="hidden" {...register('personId')} />
              <div className="flex flex-col gap-1">
                <Label htmlFor="reactivation-reason">
                  Motivo da reativação <span aria-hidden>*</span>
                </Label>
                <Textarea
                  id="reactivation-reason"
                  rows={3}
                  autoFocus
                  placeholder="Ex.: inativação por engano — voluntário permanece ativo no projeto."
                  aria-describedby={errors.reason ? 'reactivation-reason-error' : undefined}
                  aria-invalid={!!errors.reason}
                  {...register('reason')}
                />
                {errors.reason && (
                  <p id="reactivation-reason-error" role="alert" className="text-xs text-danger">
                    {errors.reason.message}
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

              <div className="mt-1 flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={closeDialog} disabled={isPending}>
                  Cancelar
                </Button>
                <Button type="submit" variant="primary" disabled={isPending}>
                  {isPending ? 'Reativando…' : 'Confirmar reativação'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
