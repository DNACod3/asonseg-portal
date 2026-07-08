import { z } from 'zod';

// Limites de tamanho (L-003, espelha jobs/schemas/publish-job.schema.ts). Valores
// generosos no MVP; o catálogo D-007 pode apertar depois.
export const TITLE_MIN = 2;
export const TITLE_MAX = 120;
export const DESCRICAO_MAX = 5000;
export const PRICE_UNIT_MAX = 60;
export const AVAILABILITY_MAX = 500;

// ── Campos compartilhados (rascunho e submissão) ───────────────────────────────
// `companyId` é opcional em Service (ausente = PF, setado = em nome da Empresa
// X — AC-029-1). Divergência estrutural vs Job.companyId (NOT NULL lá). O select
// PF-vs-Empresa do ServiceForm usa `''` como sentinela de "PF" — preprocess
// converte para `undefined` (mesmo padrão de `priceAmount` abaixo), senão a
// string vazia falharia a validação `.uuid()` e travaria o submit de PF.
const companyId = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? undefined : v),
  z.string().uuid('Empresa inválida.').optional(),
);
const title = z
  .string()
  .trim()
  .min(TITLE_MIN, 'Título deve ter ao menos 2 caracteres.')
  .max(TITLE_MAX, `Título deve ter no máximo ${TITLE_MAX} caracteres.`);
const categoryId = z.string().uuid('Selecione uma categoria válida.');
const description = z
  .string()
  .trim()
  .min(1, 'Descrição é obrigatória.')
  .max(DESCRICAO_MAX, `Descrição deve ter no máximo ${DESCRICAO_MAX} caracteres.`);
const priceUnit = z
  .string()
  .trim()
  .min(1, 'Unidade de valor é obrigatória.')
  .max(PRICE_UNIT_MAX, `Unidade deve ter no máximo ${PRICE_UNIT_MAX} caracteres.`);
const regionId = z.string().uuid('Selecione uma região válida.');
const availabilityDescription = z
  .string()
  .trim()
  .min(1, 'Disponibilidade é obrigatória.')
  .max(AVAILABILITY_MAX, `Disponibilidade deve ter no máximo ${AVAILABILITY_MAX} caracteres.`);
// Preço numérico (faixa): input do form chega como string; '' → undefined; senão ≥ 0.
const priceAmount = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? undefined : v),
  z.coerce
    .number({ invalid_type_error: 'Informe um valor numérico.' })
    .nonnegative('O valor não pode ser negativo.')
    .optional(),
);
/** Até 3 fotos (storagePath já validado/enviado por `uploadServicePhoto`). */
const photoStoragePaths = z.array(z.string().trim().min(1)).max(3, 'No máximo 3 fotos.').optional();

/**
 * Schema de **submissão à moderação** (USP-029 / AC-029-3). Exige título, categoria,
 * descrição, faixa de valor + unidade, região e disponibilidade. `companyId`
 * ausente/nulo = publica como PF (AC-029-1).
 */
export const publishServiceSchema = z
  .object({
    companyId,
    title,
    categoryId,
    description,
    priceMin: priceAmount,
    priceMax: priceAmount,
    priceUnit,
    regionId,
    availabilityDescription,
    photoStoragePaths,
  })
  .superRefine((data, ctx) => {
    if (
      typeof data.priceMin === 'number' &&
      typeof data.priceMax === 'number' &&
      data.priceMax < data.priceMin
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['priceMax'],
        message: 'O valor máximo não pode ser menor que o mínimo.',
      });
    }
  });

/**
 * Schema de **rascunho** (USP-029 / AC-029-3). Salvar a qualquer momento: só
 * `title` é obrigatório (`companyId` opcional); os demais campos são parciais.
 */
export const draftServiceSchema = z.object({
  companyId,
  title,
  categoryId: categoryId.optional(),
  description: z.string().trim().max(DESCRICAO_MAX).optional(),
  priceMin: priceAmount,
  priceMax: priceAmount,
  priceUnit: priceUnit.optional(),
  regionId: regionId.optional(),
  availabilityDescription: z.string().trim().max(AVAILABILITY_MAX).optional(),
  photoStoragePaths,
});

/**
 * Schema de **submissão** (USP-029). Duas formas: submeter um rascunho existente
 * (`{ serviceId }`) ou submeter um formulário completo de uma vez (cria DRAFT +
 * transiciona). O formulário completo reusa {@link publishServiceSchema}.
 */
export const submitServiceSchema = z.union([
  z.object({ serviceId: z.string().uuid('Serviço inválido.') }),
  publishServiceSchema,
]);

/**
 * Forma-objeto de **edição** (sem `superRefine`) — exportada à parte para que o
 * cliente (`ServiceEditForm`) possa `.omit({ serviceId: true })` antes de aplicar
 * a validação de faixa (um `ZodEffects`, como `editServiceSchema` abaixo, não
 * expõe `.omit()`). Mesmos campos editáveis de `publishServiceSchema`. **Exclui**
 * `companyId` (imutável — resolvido a partir do serviço carregado, nunca do
 * input do cliente).
 */
export const editServiceObjectSchema = z.object({
  serviceId: z.string().uuid('Serviço inválido.'),
  title,
  categoryId,
  description,
  priceMin: priceAmount,
  priceMax: priceAmount,
  priceUnit,
  regionId,
  availabilityDescription,
});

/**
 * Schema de **edição** de um serviço já `ACTIVE` (USP-032 / AC-032-1). Subconjunto
 * editável de `publishServiceSchema`: os campos de conteúdo (mesmas regras de
 * completude do submit — o serviço volta a `DRAFT` e passa por nova moderação).
 */
export const editServiceSchema = editServiceObjectSchema.superRefine((data, ctx) => {
  if (
    typeof data.priceMin === 'number' &&
    typeof data.priceMax === 'number' &&
    data.priceMax < data.priceMin
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['priceMax'],
      message: 'O valor máximo não pode ser menor que o mínimo.',
    });
  }
});

export type PublishServiceInput = z.input<typeof publishServiceSchema>;
export type PublishServiceData = z.output<typeof publishServiceSchema>;
export type DraftServiceInput = z.input<typeof draftServiceSchema>;
export type DraftServiceData = z.output<typeof draftServiceSchema>;
export type SubmitServiceInput = z.input<typeof submitServiceSchema>;
export type SubmitServiceData = z.output<typeof submitServiceSchema>;
export type EditServiceInput = z.input<typeof editServiceSchema>;
export type EditServiceData = z.output<typeof editServiceSchema>;
