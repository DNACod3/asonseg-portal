'use client';

import { type ChangeEvent, useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import type { ActionError } from '@/shared/errors';
import { publishServiceSchema, type PublishServiceInput } from '../schemas/publish-service.schema';
import { submitServiceForModeration } from '../actions/submit-service-for-moderation';
import { createServiceDraft } from '../actions/create-service-draft';
import { uploadServicePhoto } from '../actions/upload-service-photo';
import { MAX_SERVICE_PHOTOS } from '../domain/photo-mime';
import type { ServiceCategoryOption } from '../queries/list-service-categories';
// Escape-hatch (padrão AD-013/T-A1, ver jobs/components/job-form.tsx): o barrel
// `@/modules/moderation` arrasta adapters server-only para o bundle client. Este
// é um Client Component — importa a action `'use server'` direto pelo caminho.
// eslint-disable-next-line no-restricted-imports
import { suggestTaxonomy } from '@/modules/moderation/actions/suggest-taxonomy';
import { Button, Input, Label, Textarea } from '@/shared/ui';

/** Opção sentinela do select de categoria — abre o sub-fluxo "sugerir nova" (espelha JobForm/SUGG-07). */
const SUGGEST_CATEGORY_VALUE = '__suggest__';
/** Opção sentinela do select PF-vs-Empresa — publicar como PF (sem `companyId`). */
const PF_VALUE = '';

const selectClass =
  'w-full rounded-sm border-[1.5px] border-border bg-surface px-4 py-3 text-[0.95rem] text-fg transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-60';
const errorClass = 'mt-1 text-xs text-danger';

export interface CompanyOption {
  id: string;
  nomeFantasia: string;
}

/** Forma mínima de região usada pelo select — evita acoplar `services` a `@/modules/jobs` por tipo. */
export interface RegionOption {
  id: string;
  name: string;
}

export interface ServiceFormProps {
  /** Empresas das quais a Pessoa é responsável ativo (AC-029-1) — lista vazia = só PF disponível. */
  companies: CompanyOption[];
  categories: ServiceCategoryOption[];
  regions: RegionOption[];
}

/**
 * Formulário de publicação de serviço (USP-029 / T029-8). Dois caminhos:
 *  - **Salvar rascunho** (AC-029-3): só título obrigatório; chama `createServiceDraft`.
 *  - **Enviar para moderação** (AC-029-2): valida tudo via `publishServiceSchema` e
 *    chama `submitServiceForModeration` → IN_MODERATION.
 *
 * Seletor PF vs Empresa X (AC-029-1): lista só as Empresas que a Pessoa representa
 * (prop `companies`, resolvida na rota); ao escolher PF, um aviso alerta que o
 * **nome** da Pessoa será exposto publicamente (ADR-0010 — nome é público, contato
 * não). Fotos (até 3, JPG/PNG/WEBP ≤5MB) sobem uma a uma via `uploadServicePhoto`
 * e os `storagePath` resultantes são enviados junto no submit/rascunho.
 *
 * O servidor é a fonte da verdade das regras; o cliente só espelha a validação (UX).
 */
export function ServiceForm({ companies, categories, regions }: ServiceFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Fotos (AC-029-4): upload individual via `uploadServicePhoto`, storagePaths
  // acumulados localmente e enviados junto no submit/rascunho.
  const [photoPaths, setPhotoPaths] = useState<string[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoPending, startPhotoTransition] = useTransition();

  // Sub-fluxo "Outro / sugerir nova categoria" (espelha JobForm/USP-019 SUGG-07).
  const [suggestName, setSuggestName] = useState('');
  const [suggestPending, startSuggestTransition] = useTransition();
  const [suggestFeedback, setSuggestFeedback] = useState<{ kind: 'success' | 'error'; message: string } | null>(
    null,
  );

  const {
    register,
    handleSubmit,
    getValues,
    setError,
    watch,
    formState: { errors },
  } = useForm<PublishServiceInput>({
    resolver: zodResolver(publishServiceSchema),
    defaultValues: {
      companyId: PF_VALUE,
      title: '',
      categoryId: '',
      description: '',
      priceMin: '',
      priceMax: '',
      priceUnit: '',
      regionId: '',
      availabilityDescription: '',
    },
  });

  /** Mapeia fieldErrors do servidor para erros inline do RHF. */
  function applyFieldErrors(error: ActionError) {
    if (!error.fieldErrors) return;
    for (const [field, messages] of Object.entries(error.fieldErrors)) {
      if (messages?.[0]) setError(field as keyof PublishServiceInput, { message: messages[0] });
    }
  }

  function onPhotosSelected(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ''; // permite selecionar o mesmo arquivo de novo depois de remover
    if (files.length === 0) return;
    if (photoPaths.length + files.length > MAX_SERVICE_PHOTOS) {
      setPhotoError(`No máximo ${MAX_SERVICE_PHOTOS} fotos.`);
      return;
    }
    setPhotoError(null);
    startPhotoTransition(async () => {
      for (const file of files) {
        const formData = new FormData();
        formData.set('file', file);
        const result = await uploadServicePhoto(formData);
        if (result.ok) {
          setPhotoPaths((prev) => [...prev, result.data.storagePath]);
        } else {
          setPhotoError(result.error.message);
          break;
        }
      }
    });
  }

  function removePhoto(path: string) {
    setPhotoPaths((prev) => prev.filter((p) => p !== path));
  }

  // Caminho "Enviar para moderação": RHF já validou o schema completo no cliente.
  function onPublish(data: PublishServiceInput) {
    setServerError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await submitServiceForModeration({ ...data, photoStoragePaths: photoPaths });
      if (result.ok) {
        setSuccess('Serviço enviado para moderação. Ele ficará visível após a aprovação.');
        router.refresh();
      } else {
        applyFieldErrors(result.error);
        setServerError(result.error.message);
      }
    });
  }

  // Caminho "Salvar rascunho": ignora a validação completa; só limpa vazios → undefined.
  function onSaveDraft() {
    setServerError(null);
    setSuccess(null);
    const v = getValues();
    const blankToUndef = (s: string | undefined) => (s && s.trim() ? s : undefined);
    startTransition(async () => {
      const result = await createServiceDraft({
        companyId: blankToUndef(v.companyId as string | undefined),
        title: v.title,
        categoryId: blankToUndef(v.categoryId),
        description: blankToUndef(v.description),
        priceMin: v.priceMin,
        priceMax: v.priceMax,
        priceUnit: blankToUndef(v.priceUnit),
        regionId: blankToUndef(v.regionId),
        availabilityDescription: blankToUndef(v.availabilityDescription),
        photoStoragePaths: photoPaths,
      });
      if (result.ok) {
        setSuccess('Rascunho salvo.');
        router.refresh();
      } else {
        applyFieldErrors(result.error);
        setServerError(result.error.message);
      }
    });
  }

  // Submete a sugestão de nova categoria — sub-fluxo à parte do formulário de serviço.
  function onSuggestCategory() {
    setSuggestFeedback(null);
    startSuggestTransition(async () => {
      const result = await suggestTaxonomy({ kind: 'SERVICE_CATEGORY', name: suggestName });
      if (result.ok) {
        setSuggestName('');
        setSuggestFeedback({ kind: 'success', message: 'Sugestão enviada para aprovação.' });
      } else {
        const message =
          result.error.code === 'VALIDATION'
            ? (result.error.fieldErrors?.name?.[0] ?? result.error.message)
            : result.error.message;
        setSuggestFeedback({ kind: 'error', message });
      }
    });
  }

  const categoryValue = watch('categoryId');
  const companyValue = watch('companyId');

  return (
    <form onSubmit={handleSubmit(onPublish)} className="flex flex-col gap-5 max-w-lg">
      {/* Seletor PF vs Empresa (AC-029-1) */}
      <div>
        <Label htmlFor="companyId">Publicar como</Label>
        <select id="companyId" className={selectClass} defaultValue={PF_VALUE} {...register('companyId')}>
          <option value={PF_VALUE}>Pessoa física (meu nome)</option>
          {companies.map((company) => (
            <option key={company.id} value={company.id}>
              Em nome de {company.nomeFantasia}
            </option>
          ))}
        </select>
        {errors.companyId && <p className={errorClass}>{errors.companyId.message}</p>}
        {(!companyValue || companyValue === PF_VALUE) && (
          <p className="mt-1 text-xs text-fg-muted">
            Publicando como pessoa física: seu nome fica visível publicamente na busca e no detalhe
            do serviço (telefone e e-mail permanecem ocultos até uma manifestação de interesse).
          </p>
        )}
      </div>

      {/* Título */}
      <div>
        <Label htmlFor="title">Título do serviço</Label>
        <Input id="title" type="text" placeholder="Ex.: Jardinagem residencial" {...register('title')} />
        {errors.title && <p className={errorClass}>{errors.title.message}</p>}
      </div>

      {/* Categoria */}
      <div>
        <Label htmlFor="categoryId">Categoria</Label>
        <select id="categoryId" className={selectClass} defaultValue="" {...register('categoryId')}>
          <option value="" disabled>
            Selecione…
          </option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
          <option value={SUGGEST_CATEGORY_VALUE}>Outro / sugerir nova categoria</option>
        </select>
        {errors.categoryId && <p className={errorClass}>{errors.categoryId.message}</p>}

        {categoryValue === SUGGEST_CATEGORY_VALUE && (
          <div className="mt-2 flex flex-col gap-2 rounded-lg border border-border bg-surface p-3">
            <Label className="sr-only" htmlFor="suggest-category-name">
              Nome da nova categoria
            </Label>
            <Input
              id="suggest-category-name"
              type="text"
              placeholder="Ex.: Jardinagem"
              value={suggestName}
              onChange={(e) => setSuggestName(e.target.value)}
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onSuggestCategory}
              disabled={suggestPending || suggestName.trim().length < 2}
              className="self-start"
            >
              {suggestPending ? 'Enviando…' : 'Sugerir categoria'}
            </Button>
            {suggestFeedback && (
              <p
                role={suggestFeedback.kind === 'error' ? 'alert' : 'status'}
                className={suggestFeedback.kind === 'error' ? errorClass : 'text-xs text-success'}
              >
                {suggestFeedback.message}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Descrição */}
      <div>
        <Label htmlFor="description">Descrição</Label>
        <Textarea id="description" rows={4} {...register('description')} />
        {errors.description && <p className={errorClass}>{errors.description.message}</p>}
      </div>

      {/* Faixa de valor + unidade */}
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 block text-sm font-medium text-fg">Valor</legend>
        <div className="flex gap-3">
          <div className="flex-1">
            <Label className="sr-only" htmlFor="priceMin">
              Valor mínimo
            </Label>
            <Input
              id="priceMin"
              type="number"
              min={0}
              step="0.01"
              placeholder="Mínimo (R$)"
              {...register('priceMin')}
            />
            {errors.priceMin && <p className={errorClass}>{errors.priceMin.message}</p>}
          </div>
          <div className="flex-1">
            <Label className="sr-only" htmlFor="priceMax">
              Valor máximo
            </Label>
            <Input
              id="priceMax"
              type="number"
              min={0}
              step="0.01"
              placeholder="Máximo (R$)"
              {...register('priceMax')}
            />
            {errors.priceMax && <p className={errorClass}>{errors.priceMax.message}</p>}
          </div>
        </div>
        <div>
          <Label htmlFor="priceUnit">Unidade</Label>
          <Input id="priceUnit" type="text" placeholder="Ex.: por hora, por diária, por serviço" {...register('priceUnit')} />
          {errors.priceUnit && <p className={errorClass}>{errors.priceUnit.message}</p>}
        </div>
      </fieldset>

      {/* Região */}
      <div>
        <Label htmlFor="regionId">Região</Label>
        <select id="regionId" className={selectClass} defaultValue="" {...register('regionId')}>
          <option value="" disabled>
            Selecione…
          </option>
          {regions.map((region) => (
            <option key={region.id} value={region.id}>
              {region.name}
            </option>
          ))}
        </select>
        {errors.regionId && <p className={errorClass}>{errors.regionId.message}</p>}
      </div>

      {/* Disponibilidade */}
      <div>
        <Label htmlFor="availabilityDescription">Disponibilidade</Label>
        <Textarea
          id="availabilityDescription"
          rows={2}
          placeholder="Ex.: Segunda a sexta, 8h às 17h"
          {...register('availabilityDescription')}
        />
        {errors.availabilityDescription && (
          <p className={errorClass}>{errors.availabilityDescription.message}</p>
        )}
      </div>

      {/* Fotos (opcional, até 3) */}
      <div>
        <Label htmlFor="photos">
          Fotos do trabalho <span className="font-normal text-fg-muted">(opcional, até {MAX_SERVICE_PHOTOS})</span>
        </Label>
        <input
          id="photos"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          disabled={photoPending || photoPaths.length >= MAX_SERVICE_PHOTOS}
          onChange={onPhotosSelected}
          className={selectClass}
        />
        {photoError && <p className={errorClass}>{photoError}</p>}
        {photoPaths.length > 0 && (
          <ul className="mt-2 flex flex-col gap-1">
            {photoPaths.map((path) => (
              <li key={path} className="flex items-center justify-between text-xs text-fg-muted">
                <span className="truncate">{path}</span>
                <Button type="button" variant="secondary" size="sm" onClick={() => removePhoto(path)}>
                  Remover
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {success && (
        <div
          role="status"
          className="rounded-lg border border-success bg-[color-mix(in_srgb,var(--color-success)_10%,transparent)] px-4 py-3 text-sm text-success"
        >
          {success}
        </div>
      )}

      {serverError && (
        <div
          role="alert"
          className="rounded-lg border border-danger bg-[color-mix(in_srgb,var(--color-danger)_10%,transparent)] px-4 py-3 text-sm text-danger"
        >
          {serverError}
        </div>
      )}

      <div className="flex gap-3">
        <Button type="button" variant="secondary" onClick={onSaveDraft} disabled={isPending}>
          {isPending ? 'Salvando…' : 'Salvar rascunho'}
        </Button>
        <Button type="submit" variant="primary" disabled={isPending}>
          {isPending ? 'Enviando…' : 'Enviar para moderação'}
        </Button>
      </div>
    </form>
  );
}
