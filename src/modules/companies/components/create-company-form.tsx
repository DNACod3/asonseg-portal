'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { Button, Input, Label, LgpdBox, Textarea } from '@/shared/ui';
import {
  createCompanySchema,
  type CreateCompanyInput,
} from '../schemas/create-company.schema';
import { createCompany } from '../actions/create-company';

export interface CreateCompanyFormProps {
  /** Dados do termo COMPANY_REPRESENTATION carregados server-side. */
  term: {
    version: string;
    contentHash: string;
    body: string;
  };
}

/**
 * Formulário de cadastro de Empresa (USP-012 / #128).
 *
 * Recebe o termo COMPANY_REPRESENTATION pré-carregado pelo Server Component pai
 * (termo validado server-side — versão + hash íntegros). O aceite explícito do
 * termo é obrigatório antes do submit. O CNPJ é normalizado pelo Zod (remove
 * máscara) e validado pelos dígitos verificadores.
 *
 * Fundação de Design System da Fase 2 (AD-014/AD-015): restilizado com os
 * primitivos (`Input`/`Label`/`Textarea`/`Button`/`LgpdBox`) e tokens — fluxo
 * (RHF/Zod/gate do consentimento/`createCompany`) preservado sem alteração.
 */
export function CreateCompanyForm({ term }: CreateCompanyFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [consentChecked, setConsentChecked] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateCompanyInput>({
    resolver: zodResolver(createCompanySchema),
    defaultValues: {
      type: 'SIMPLES_NACIONAL',
      companyRepresentationTermVersion: term.version,
      companyRepresentationTermHash: term.contentHash,
    },
  });

  function onSubmit(data: CreateCompanyInput) {
    if (!consentChecked) return;
    setServerError(null);
    startTransition(async () => {
      const result = await createCompany(data);
      if (result.ok) {
        router.push(`/empresa/${result.data.companyId}/responsaveis`);
        router.refresh();
      } else {
        setServerError(result.error.message);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      {/* CNPJ */}
      <div>
        <Label htmlFor="cnpj">CNPJ</Label>
        <Input
          id="cnpj"
          type="text"
          placeholder="XX.XXX.XXX/XXXX-XX"
          aria-describedby={errors.cnpj ? 'cnpj-error' : undefined}
          aria-invalid={!!errors.cnpj}
          {...register('cnpj')}
        />
        {errors.cnpj && (
          <p id="cnpj-error" role="alert" className="mt-1 text-xs text-danger">
            {errors.cnpj.message}
          </p>
        )}
      </div>

      {/* Tipo */}
      <div>
        <Label>Tipo</Label>
        <div className="flex gap-4">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-fg">
            <input type="radio" value="SIMPLES_NACIONAL" className="accent-primary" {...register('type')} />
            CNPJ Regular (Simples Nacional, etc.)
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-fg">
            <input type="radio" value="MEI" className="accent-primary" {...register('type')} />
            MEI
          </label>
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
        <Input
          id="razaoSocial"
          type="text"
          aria-describedby={errors.razaoSocial ? 'razaoSocial-error' : undefined}
          aria-invalid={!!errors.razaoSocial}
          {...register('razaoSocial')}
        />
        {errors.razaoSocial && (
          <p id="razaoSocial-error" role="alert" className="mt-1 text-xs text-danger">
            {errors.razaoSocial.message}
          </p>
        )}
      </div>

      {/* Nome Fantasia */}
      <div>
        <Label htmlFor="nomeFantasia">Nome fantasia</Label>
        <Input
          id="nomeFantasia"
          type="text"
          aria-describedby={errors.nomeFantasia ? 'nomeFantasia-error' : undefined}
          aria-invalid={!!errors.nomeFantasia}
          {...register('nomeFantasia')}
        />
        {errors.nomeFantasia && (
          <p id="nomeFantasia-error" role="alert" className="mt-1 text-xs text-danger">
            {errors.nomeFantasia.message}
          </p>
        )}
      </div>

      {/* Setor */}
      <div>
        <Label htmlFor="setor">Setor</Label>
        <Input
          id="setor"
          type="text"
          placeholder="Ex.: Tecnologia, Saúde, Construção civil…"
          aria-describedby={errors.setor ? 'setor-error' : undefined}
          aria-invalid={!!errors.setor}
          {...register('setor')}
        />
        {errors.setor && (
          <p id="setor-error" role="alert" className="mt-1 text-xs text-danger">
            {errors.setor.message}
          </p>
        )}
      </div>

      {/* Descrição (opcional) */}
      <div>
        <Label htmlFor="descricao">
          Descrição <span className="font-normal text-fg-muted">(opcional)</span>
        </Label>
        <Textarea
          id="descricao"
          rows={3}
          placeholder="Breve descrição das atividades da Empresa."
          {...register('descricao')}
        />
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

      {/* Campos ocultos para o termo */}
      <input type="hidden" {...register('companyRepresentationTermVersion')} />
      <input type="hidden" {...register('companyRepresentationTermHash')} />

      {/* Termo de representação empresarial */}
      <LgpdBox title="Termo de representação empresarial">
        <div
          className="mb-3 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-sm border border-border bg-surface p-2 text-xs text-fg-muted"
          aria-label="Conteúdo do termo de representação empresarial"
        >
          {term.body}
        </div>
        <label className="flex cursor-pointer items-start gap-2 text-sm text-fg">
          <input
            type="checkbox"
            className="mt-0.5 accent-primary"
            checked={consentChecked}
            onChange={(e) => setConsentChecked(e.target.checked)}
          />
          <span>
            Li e aceito o <strong>Termo de representação empresarial</strong> (versão{' '}
            {term.version}). Declaro que tenho poderes para representar a Empresa cadastrada.
          </span>
        </label>
      </LgpdBox>

      {/* Erro do servidor */}
      {serverError && (
        <div
          role="alert"
          className="rounded-sm bg-[color-mix(in_srgb,var(--color-danger)_10%,transparent)] p-3 text-sm text-danger"
        >
          {serverError}
        </div>
      )}

      <Button type="submit" variant="primary" disabled={isPending || !consentChecked}>
        {isPending ? 'Cadastrando…' : 'Cadastrar Empresa'}
      </Button>
    </form>
  );
}
