'use client';

import { useEffect, useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { normalizeCnpj } from '../domain/cnpj';
import { identityFieldsChanged } from '../domain/company-edit';
import { editCompanySchema, type EditCompanyInput } from '../schemas/edit-company.schema';
import { editarEmpresa } from '../actions/edit-company';

const inputClass =
  'rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 w-full';
const errorClass = 'mt-1 text-xs text-red-600';
const labelClass = 'block text-sm font-medium text-gray-700 mb-1';

export interface EditCompanyFormProps {
  /** Dados atuais da Empresa, usados para pré-preencher e detectar mudança identitária. */
  empresa: {
    id: string;
    cnpj: string;
    type: 'MEI' | 'SIMPLES_NACIONAL' | 'LUCRO_PRESUMIDO' | 'LUCRO_REAL' | 'SA';
    razaoSocial: string;
    nomeFantasia: string;
    setor: string;
    descricao: string | null;
    endereco: string | null;
    isVerified: boolean;
  };
}

/**
 * Formulário de edição de Empresa (USP-015 / #142).
 *
 * Pré-preenchido com os dados atuais. No submit, detecta se algum campo
 * **identitário** (cnpj/razaoSocial/nomeFantasia) mudou em relação ao original;
 * se sim — e a Empresa estava verificada — abre um diálogo de confirmação com o
 * aviso de re-verificação (D-015-E) **antes** de chamar `editarEmpresa`. O
 * servidor permanece a fonte da verdade do rebaixamento (P-001); o aviso é só UX.
 */
export function EditCompanyForm({ empresa }: EditCompanyFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  // Payload aguardando confirmação no diálogo de re-verificação (D-015-E).
  const [pendingConfirm, setPendingConfirm] = useState<EditCompanyInput | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EditCompanyInput>({
    resolver: zodResolver(editCompanySchema),
    defaultValues: {
      empresaId: empresa.id,
      cnpj: empresa.cnpj,
      type: empresa.type,
      razaoSocial: empresa.razaoSocial,
      nomeFantasia: empresa.nomeFantasia,
      setor: empresa.setor,
      descricao: empresa.descricao ?? '',
      endereco: empresa.endereco ?? '',
    },
  });

  // Fecha o diálogo de confirmação com Esc.
  useEffect(() => {
    if (!pendingConfirm) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !isPending) setPendingConfirm(null);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pendingConfirm, isPending]);

  function submit(data: EditCompanyInput) {
    setServerError(null);
    setSuccess(false);
    startTransition(async () => {
      const result = await editarEmpresa(data);
      if (result.ok) {
        setPendingConfirm(null);
        setSuccess(true);
        router.refresh();
      } else {
        setPendingConfirm(null);
        setServerError(result.error.message);
      }
    });
  }

  function onSubmit(data: EditCompanyInput) {
    // Detecta mudança identitária comparando com o estado original (CNPJ normalizado).
    const changed = identityFieldsChanged(
      {
        cnpj: normalizeCnpj(empresa.cnpj),
        razaoSocial: empresa.razaoSocial,
        nomeFantasia: empresa.nomeFantasia,
      },
      {
        cnpj: normalizeCnpj(data.cnpj),
        razaoSocial: data.razaoSocial,
        nomeFantasia: data.nomeFantasia,
      },
    );
    // Só pede confirmação se vai de fato rebaixar (mudou identitário E estava verificada).
    if (changed && empresa.isVerified) {
      setPendingConfirm(data);
      return;
    }
    submit(data);
  }

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5 max-w-lg">
        <input type="hidden" {...register('empresaId')} />

        {/* CNPJ */}
        <div>
          <label className={labelClass} htmlFor="cnpj">
            CNPJ
          </label>
          <input
            id="cnpj"
            type="text"
            placeholder="XX.XXX.XXX/XXXX-XX"
            className={inputClass}
            {...register('cnpj')}
          />
          {errors.cnpj && <p className={errorClass}>{errors.cnpj.message}</p>}
        </div>

        {/* Tipo */}
        <div>
          <label className={labelClass}>Tipo</label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="radio" value="SIMPLES_NACIONAL" {...register('type')} />
              CNPJ Regular (Simples Nacional, etc.)
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="radio" value="MEI" {...register('type')} />
              MEI
            </label>
          </div>
          {errors.type && <p className={errorClass}>{errors.type.message}</p>}
        </div>

        {/* Razão Social */}
        <div>
          <label className={labelClass} htmlFor="razaoSocial">
            Razão social
          </label>
          <input id="razaoSocial" type="text" className={inputClass} {...register('razaoSocial')} />
          {errors.razaoSocial && <p className={errorClass}>{errors.razaoSocial.message}</p>}
        </div>

        {/* Nome Fantasia */}
        <div>
          <label className={labelClass} htmlFor="nomeFantasia">
            Nome fantasia
          </label>
          <input id="nomeFantasia" type="text" className={inputClass} {...register('nomeFantasia')} />
          {errors.nomeFantasia && <p className={errorClass}>{errors.nomeFantasia.message}</p>}
        </div>

        {/* Setor */}
        <div>
          <label className={labelClass} htmlFor="setor">
            Setor
          </label>
          <input id="setor" type="text" className={inputClass} {...register('setor')} />
          {errors.setor && <p className={errorClass}>{errors.setor.message}</p>}
        </div>

        {/* Descrição (opcional) */}
        <div>
          <label className={labelClass} htmlFor="descricao">
            Descrição <span className="text-gray-400 font-normal">(opcional)</span>
          </label>
          <textarea id="descricao" rows={3} className={inputClass} {...register('descricao')} />
          {errors.descricao && <p className={errorClass}>{errors.descricao.message}</p>}
        </div>

        {/* Endereço (opcional) */}
        <div>
          <label className={labelClass} htmlFor="endereco">
            Endereço <span className="text-gray-400 font-normal">(opcional)</span>
          </label>
          <input id="endereco" type="text" className={inputClass} {...register('endereco')} />
          {errors.endereco && <p className={errorClass}>{errors.endereco.message}</p>}
        </div>

        {success && (
          <div
            role="status"
            className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700"
          >
            Dados atualizados com sucesso.
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
          className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isPending ? 'Salvando…' : 'Salvar alterações'}
        </button>
      </form>

      {/* Diálogo de confirmação de re-verificação (D-015-E). */}
      {pendingConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !isPending && setPendingConfirm(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="reverify-title"
            className="flex w-full max-w-md flex-col gap-4 rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="reverify-title" className="text-lg font-bold text-gray-900">
              Confirmar alteração de dados de identidade?
            </h2>
            <p className="text-sm text-gray-600">
              Você alterou CNPJ, razão social ou nome fantasia. Esta alteração exigirá nova
              verificação manual da Empresa na próxima vaga publicada.
            </p>
            <div className="mt-1 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingConfirm(null)}
                disabled={isPending}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200 disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => submit(pendingConfirm)}
                disabled={isPending}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending ? 'Salvando…' : 'Confirmar e salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
