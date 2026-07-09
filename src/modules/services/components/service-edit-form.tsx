'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import type { ActionError } from '@/shared/errors';
import { editServiceObjectSchema, type EditServiceInput } from '../schemas/publish-service.schema';
import { editService } from '../actions/edit-service';
import { submitServiceForModeration } from '../actions/submit-service-for-moderation';
import type { ServiceCategoryOption } from '../queries/list-service-categories';
import type { RegionOption } from './service-form';
import { Button, Input, Label, Textarea } from '@/shared/ui';

const selectClass =
  'w-full rounded-sm border-[1.5px] border-border bg-surface px-4 py-3 text-[0.95rem] text-fg transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-60';
const errorClass = 'mt-1 text-xs text-danger';

export interface ServiceEditFormProps {
  serviceId: string;
  categories: ServiceCategoryOption[];
  regions: RegionOption[];
  /** Valores atuais do serviço (ACTIVE) — pré-preenchem o formulário (AC-032-1). */
  initialValues: Omit<EditServiceInput, 'serviceId'>;
}

/**
 * Formulário de edição de um serviço `ACTIVE` (USP-032 / AC-032-1). Mesmos
 * campos e padrões visuais de `ServiceForm` (AD-014), restrito ao subconjunto
 * de `editServiceSchema` (sem `companyId` — imutável). No submit: `editService`
 * (→ `DRAFT`) e, em sucesso, encadeia `submitServiceForModeration({ serviceId })`
 * (→ `IN_MODERATION`) — a UI nunca deixa o serviço parado em `DRAFT` sem
 * reenvio (AC-032-1/SVC032-MN-03). Espelha `JobEditForm`.
 */
export function ServiceEditForm({ serviceId, categories, regions, initialValues }: ServiceEditFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<Omit<EditServiceInput, 'serviceId'>>({
    resolver: zodResolver(editServiceObjectSchema.omit({ serviceId: true })),
    defaultValues: initialValues,
  });

  function applyFieldErrors(error: ActionError) {
    if (!error.fieldErrors) return;
    for (const [field, messages] of Object.entries(error.fieldErrors)) {
      if (messages?.[0]) setError(field as keyof Omit<EditServiceInput, 'serviceId'>, { message: messages[0] });
    }
  }

  function onSubmit(data: Omit<EditServiceInput, 'serviceId'>) {
    setServerError(null);
    setSuccess(null);
    startTransition(async () => {
      const editResult = await editService({ serviceId, ...data });
      if (!editResult.ok) {
        applyFieldErrors(editResult.error);
        setServerError(editResult.error.message);
        return;
      }
      const submitResult = await submitServiceForModeration({ serviceId });
      if (!submitResult.ok) {
        setServerError(submitResult.error.message);
        return;
      }
      setSuccess('Serviço enviado para moderação. Ele ficará visível após a aprovação.');
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex max-w-lg flex-col gap-5">
      <div>
        <Label htmlFor="title">Título do serviço</Label>
        <Input id="title" type="text" {...register('title')} />
        {errors.title && <p className={errorClass}>{errors.title.message}</p>}
      </div>

      <div>
        <Label htmlFor="categoryId">Categoria</Label>
        <select
          id="categoryId"
          className={selectClass}
          defaultValue={initialValues.categoryId}
          {...register('categoryId')}
        >
          <option value="" disabled>
            Selecione…
          </option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        {errors.categoryId && <p className={errorClass}>{errors.categoryId.message}</p>}
      </div>

      <div>
        <Label htmlFor="description">Descrição</Label>
        <Textarea id="description" rows={4} {...register('description')} />
        {errors.description && <p className={errorClass}>{errors.description.message}</p>}
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 block text-sm font-medium text-fg">Valor</legend>
        <div className="flex gap-3">
          <div className="flex-1">
            <Label className="sr-only" htmlFor="priceMin">
              Valor mínimo
            </Label>
            <Input id="priceMin" type="number" min={0} step="0.01" placeholder="Mínimo (R$)" {...register('priceMin')} />
            {errors.priceMin && <p className={errorClass}>{errors.priceMin.message}</p>}
          </div>
          <div className="flex-1">
            <Label className="sr-only" htmlFor="priceMax">
              Valor máximo
            </Label>
            <Input id="priceMax" type="number" min={0} step="0.01" placeholder="Máximo (R$)" {...register('priceMax')} />
            {errors.priceMax && <p className={errorClass}>{errors.priceMax.message}</p>}
          </div>
        </div>
        <div>
          <Label htmlFor="priceUnit">Unidade</Label>
          <Input id="priceUnit" type="text" {...register('priceUnit')} />
          {errors.priceUnit && <p className={errorClass}>{errors.priceUnit.message}</p>}
        </div>
      </fieldset>

      <div>
        <Label htmlFor="regionId">Região</Label>
        <select
          id="regionId"
          className={selectClass}
          defaultValue={initialValues.regionId}
          {...register('regionId')}
        >
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

      <div>
        <Label htmlFor="availabilityDescription">Disponibilidade</Label>
        <Textarea id="availabilityDescription" rows={2} {...register('availabilityDescription')} />
        {errors.availabilityDescription && (
          <p className={errorClass}>{errors.availabilityDescription.message}</p>
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

      <Button type="submit" variant="primary" disabled={isPending}>
        {isPending ? 'Salvando…' : 'Salvar e enviar para moderação'}
      </Button>
    </form>
  );
}
