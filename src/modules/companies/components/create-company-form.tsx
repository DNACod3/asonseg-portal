'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import {
  createCompanySchema,
  type CreateCompanyInput,
} from '../schemas/create-company.schema';
import { createCompany } from '../actions/create-company';

const inputClass =
  'rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 w-full';
const errorClass = 'mt-1 text-xs text-red-600';
const labelClass = 'block text-sm font-medium text-gray-700 mb-1';

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
        router.push(`/empresa/${result.data.companyId}`);
        router.refresh();
      } else {
        setServerError(result.error.message);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5 max-w-lg">
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
        <input
          id="razaoSocial"
          type="text"
          className={inputClass}
          {...register('razaoSocial')}
        />
        {errors.razaoSocial && <p className={errorClass}>{errors.razaoSocial.message}</p>}
      </div>

      {/* Nome Fantasia */}
      <div>
        <label className={labelClass} htmlFor="nomeFantasia">
          Nome fantasia
        </label>
        <input
          id="nomeFantasia"
          type="text"
          className={inputClass}
          {...register('nomeFantasia')}
        />
        {errors.nomeFantasia && <p className={errorClass}>{errors.nomeFantasia.message}</p>}
      </div>

      {/* Setor */}
      <div>
        <label className={labelClass} htmlFor="setor">
          Setor
        </label>
        <input
          id="setor"
          type="text"
          placeholder="Ex.: Tecnologia, Saúde, Construção civil…"
          className={inputClass}
          {...register('setor')}
        />
        {errors.setor && <p className={errorClass}>{errors.setor.message}</p>}
      </div>

      {/* Descrição (opcional) */}
      <div>
        <label className={labelClass} htmlFor="descricao">
          Descrição <span className="text-gray-400 font-normal">(opcional)</span>
        </label>
        <textarea
          id="descricao"
          rows={3}
          className={inputClass}
          placeholder="Breve descrição das atividades da Empresa."
          {...register('descricao')}
        />
        {errors.descricao && <p className={errorClass}>{errors.descricao.message}</p>}
      </div>

      {/* Endereço (opcional) */}
      <div>
        <label className={labelClass} htmlFor="endereco">
          Endereço <span className="text-gray-400 font-normal">(opcional)</span>
        </label>
        <input
          id="endereco"
          type="text"
          className={inputClass}
          {...register('endereco')}
        />
        {errors.endereco && <p className={errorClass}>{errors.endereco.message}</p>}
      </div>

      {/* Campos ocultos para o termo */}
      <input type="hidden" {...register('companyRepresentationTermVersion')} />
      <input type="hidden" {...register('companyRepresentationTermHash')} />

      {/* Termo de representação empresarial */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
        <p className="font-medium mb-2">Termo de representação empresarial</p>
        <div
          className="max-h-40 overflow-y-auto text-xs text-gray-600 whitespace-pre-wrap mb-3 border border-gray-200 rounded p-2 bg-white"
          aria-label="Conteúdo do termo de representação empresarial"
        >
          {term.body}
        </div>
        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            className="mt-0.5 accent-blue-600"
            checked={consentChecked}
            onChange={(e) => setConsentChecked(e.target.checked)}
          />
          <span>
            Li e aceito o <strong>Termo de representação empresarial</strong> (versão{' '}
            {term.version}). Declaro que tenho poderes para representar a Empresa cadastrada.
          </span>
        </label>
      </div>

      {/* Erro do servidor */}
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
        disabled={isPending || !consentChecked}
        className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isPending ? 'Cadastrando…' : 'Cadastrar Empresa'}
      </button>
    </form>
  );
}
