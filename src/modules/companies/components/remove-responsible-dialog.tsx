'use client';

import { useEffect, useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { removeResponsibleSchema, type RemoveResponsibleInput } from '../schemas/remove-responsible.schema';
import { removerResponsavel } from '../actions/remove-responsible';

const inputClass =
  'rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200';

export interface RemoveResponsibleDialogProps {
  grantId: string;
  /** Nome do responsável que será removido (exibido na confirmação). */
  nome: string;
  /** Quando true, é o vínculo do próprio ator (auto-remoção → perde o acesso). */
  isSelf: boolean;
}

/**
 * Diálogo de confirmação da remoção de um responsável (USP-014 / #137).
 *
 * Coleta um motivo **opcional** (negócio → `revokeReason`) e chama
 * `removerResponsavel`. Trata os `{ ok:false }`: PRECONDITION_FAILED (último
 * responsável ativo — instrui a designar outro antes), FORBIDDEN e demais são
 * exibidos com a mensagem da action. No sucesso recarrega a rota; na auto-remoção
 * o ator perde o acesso de gestão (ADR-0030) e a própria página passa a dar 404.
 */
export function RemoveResponsibleDialog({ grantId, nome, isSelf }: RemoveResponsibleDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const { register, handleSubmit, reset } = useForm<RemoveResponsibleInput>({
    resolver: zodResolver(removeResponsibleSchema),
    defaultValues: { grantId, motivo: '' },
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
    reset({ grantId, motivo: '' });
  }

  function onSubmit(data: RemoveResponsibleInput) {
    setServerError(null);
    startTransition(async () => {
      const result = await removerResponsavel(data);
      if (result.ok) {
        setOpen(false);
        reset({ grantId, motivo: '' });
        // Auto-remoção: o ator perde o acesso — leva à listagem das próprias Empresas.
        if (result.data.selfRemoved) {
          router.push('/empresa');
        } else {
          router.refresh();
        }
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
        className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-200"
      >
        Remover
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !isPending && closeDialog()}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="remove-responsible-title"
            className="flex w-full max-w-md flex-col gap-4 rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="remove-responsible-title" className="text-lg font-bold text-gray-900">
              Remover {isSelf ? 'você mesmo' : nome} da gestão?
            </h2>
            <p className="text-sm text-gray-600">
              {isSelf
                ? 'Você deixará de operar vagas e serviços em nome desta Empresa. O histórico do vínculo é preservado.'
                : `${nome} deixará de operar vagas e serviços em nome desta Empresa. O histórico do vínculo é preservado.`}
            </p>

            <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-3">
              <input type="hidden" {...register('grantId')} />
              <div className="flex flex-col gap-1">
                <label htmlFor="motivo" className="text-sm font-medium text-gray-700">
                  Motivo (opcional)
                </label>
                <textarea
                  id="motivo"
                  rows={3}
                  autoFocus
                  placeholder="Ex.: saiu da empresa."
                  className={inputClass}
                  {...register('motivo')}
                />
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
                  {isPending ? 'Removendo…' : 'Confirmar remoção'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
