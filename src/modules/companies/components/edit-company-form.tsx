'use client';

import { useEffect, useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { Button, Input, Label, Textarea } from '@/shared/ui';
import { normalizeCnpj } from '../domain/cnpj';
import { COMPANY_TYPE_OPTIONS } from '../domain/company-type';
import { identityFieldsChanged } from '../domain/company-edit';
import { editCompanySchema, type EditCompanyInput } from '../schemas/edit-company.schema';
import { editarEmpresa } from '../actions/edit-company';

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
 *
 * Fundação de Design System da Fase 2 (AD-014/AD-015): restilizado com os
 * primitivos (`Input`/`Label`/`Textarea`/`Button`) e tokens, incl. o diálogo de
 * re-verificação — fluxo (RHF/Zod/identityFieldsChanged/editarEmpresa/fronteira
 * client-avisa-server-decide) preservado.
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
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
        <input type="hidden" {...register('empresaId')} />

        {/* CNPJ */}
        <div>
          <Label htmlFor="cnpj">CNPJ</Label>
          <Input id="cnpj" type="text" placeholder="XX.XXX.XXX/XXXX-XX" {...register('cnpj')} />
          {errors.cnpj && (
            <p role="alert" className="mt-1 text-xs text-danger">
              {errors.cnpj.message}
            </p>
          )}
        </div>

        {/* Tipo */}
        <div>
          <Label>Tipo</Label>
          <div className="flex flex-wrap gap-4">
            {COMPANY_TYPE_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className="flex cursor-pointer items-center gap-2 text-sm text-fg"
              >
                <input type="radio" value={opt.value} className="accent-primary" {...register('type')} />
                {opt.label}
              </label>
            ))}
          </div>
          {errors.type && (
            <p role="alert" className="mt-1 text-xs text-danger">
              {errors.type.message}
            </p>
          )}
        </div>

        {/* Razão Social */}
        <div>
          <Label htmlFor="razaoSocial">Razão social</Label>
          <Input id="razaoSocial" type="text" {...register('razaoSocial')} />
          {errors.razaoSocial && (
            <p role="alert" className="mt-1 text-xs text-danger">
              {errors.razaoSocial.message}
            </p>
          )}
        </div>

        {/* Nome Fantasia */}
        <div>
          <Label htmlFor="nomeFantasia">Nome fantasia</Label>
          <Input id="nomeFantasia" type="text" {...register('nomeFantasia')} />
          {errors.nomeFantasia && (
            <p role="alert" className="mt-1 text-xs text-danger">
              {errors.nomeFantasia.message}
            </p>
          )}
        </div>

        {/* Setor */}
        <div>
          <Label htmlFor="setor">Setor</Label>
          <Input id="setor" type="text" {...register('setor')} />
          {errors.setor && (
            <p role="alert" className="mt-1 text-xs text-danger">
              {errors.setor.message}
            </p>
          )}
        </div>

        {/* Descrição (opcional) */}
        <div>
          <Label htmlFor="descricao">
            Descrição <span className="font-normal text-fg-muted">(opcional)</span>
          </Label>
          <Textarea id="descricao" rows={3} {...register('descricao')} />
          {errors.descricao && (
            <p role="alert" className="mt-1 text-xs text-danger">
              {errors.descricao.message}
            </p>
          )}
        </div>

        {/* Endereço (opcional) */}
        <div>
          <Label htmlFor="endereco">
            Endereço <span className="font-normal text-fg-muted">(opcional)</span>
          </Label>
          <Input id="endereco" type="text" {...register('endereco')} />
          {errors.endereco && (
            <p role="alert" className="mt-1 text-xs text-danger">
              {errors.endereco.message}
            </p>
          )}
        </div>

        {success && (
          <div
            role="status"
            className="rounded-sm bg-[color-mix(in_srgb,var(--color-success)_10%,transparent)] p-3 text-sm text-success"
          >
            Dados atualizados com sucesso.
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

        <Button type="submit" variant="primary" disabled={isPending}>
          {isPending ? 'Salvando…' : 'Salvar alterações'}
        </Button>
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
            className="flex w-full max-w-md flex-col gap-4 rounded-lg border border-border bg-surface p-6 shadow-md"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="reverify-title" className="text-lg font-bold text-fg">
              Confirmar alteração de dados de identidade?
            </h2>
            <p className="text-sm text-fg-muted">
              Você alterou CNPJ, razão social ou nome fantasia. Esta alteração exigirá nova
              verificação manual da Empresa na próxima vaga publicada.
            </p>
            <div className="mt-1 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setPendingConfirm(null)} disabled={isPending}>
                Cancelar
              </Button>
              <Button type="button" variant="primary" onClick={() => submit(pendingConfirm)} disabled={isPending}>
                {isPending ? 'Salvando…' : 'Confirmar e salvar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
