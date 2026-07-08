import { z } from 'zod';
import { MAX_VALIDADE_DIAS, validadeStatus } from '../domain/validade';

// Limites de tamanho (L-003). Valores generosos no MVP; o catálogo D-007 pode apertar depois.
export const TITLE_MIN = 2;
export const TITLE_MAX = 120;
export const DESCRICAO_MAX = 5000;
export const REQUISITOS_MAX = 5000;
export const REGIME_MAX = 60;
export const LOCAL_MAX = 200;
export const BENEFICIOS_MAX = 2000;
export const SALARIO_MAX = 120;
export const CONTRATO_MAX = 60;
export const ESCOLARIDADE_MAX = 120;

// ── Campos compartilhados (rascunho e submissão) ───────────────────────────────
const companyId = z.string().uuid('Empresa inválida.');
const title = z
  .string()
  .trim()
  .min(TITLE_MIN, 'Título deve ter ao menos 2 caracteres.')
  .max(TITLE_MAX, `Título deve ter no máximo ${TITLE_MAX} caracteres.`);
const areaId = z.string().uuid('Selecione uma área válida.');
const description = z
  .string()
  .trim()
  .min(1, 'Descrição é obrigatória.')
  .max(DESCRICAO_MAX, `Descrição deve ter no máximo ${DESCRICAO_MAX} caracteres.`);
const requirements = z
  .string()
  .trim()
  .min(1, 'Requisitos são obrigatórios.')
  .max(REQUISITOS_MAX, `Requisitos devem ter no máximo ${REQUISITOS_MAX} caracteres.`);
const workRegime = z
  .string()
  .trim()
  .min(1, 'Regime de trabalho é obrigatório.')
  .max(REGIME_MAX, `Regime deve ter no máximo ${REGIME_MAX} caracteres.`);
const location = z
  .string()
  .trim()
  .min(1, 'Local é obrigatório.')
  .max(LOCAL_MAX, `Local deve ter no máximo ${LOCAL_MAX} caracteres.`);
const benefits = z.string().trim().max(BENEFICIOS_MAX).optional();
const salary = z.string().trim().max(SALARIO_MAX).optional();
// ── Campos de busca (USP-021 / TD §4.5 / E-002) ────────────────────────────────
// Obrigatórios no SUBMIT (tornam os filtros possíveis); opcionais no rascunho.
const contractType = z
  .string()
  .trim()
  .min(1, 'Tipo de contrato é obrigatório.')
  .max(CONTRATO_MAX, `Tipo de contrato deve ter no máximo ${CONTRATO_MAX} caracteres.`);
const regionId = z.string().uuid('Selecione uma região válida.');
const educationLevelRequired = z.string().trim().max(ESCOLARIDADE_MAX).optional();
// Salário numérico (faixa): input do form chega como string; '' → undefined; senão ≥ 0.
// (`salary` freetext legado é mantido por compat; a faixa é a fonte do filtro E-002.)
const salaryAmount = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? undefined : v),
  z.coerce
    .number({ invalid_type_error: 'Informe um valor numérico.' })
    .nonnegative('O salário não pode ser negativo.')
    .optional(),
);
const salaryVisible = z.boolean().optional().default(true);
// Validade como string `yyyy-MM-dd` validada (não convertida): mantém input = output
// (evita o duplo-parse do RHF→Server Action). A conversão para Date acontece na borda
// de persistência. A regra de futuro/teto roda no superRefine via {@link validadeStatus}.
const validUntilStr = z
  .string({ errorMap: () => ({ message: 'Data de validade é obrigatória.' }) })
  .min(1, 'Data de validade é obrigatória.')
  .refine((s) => !Number.isNaN(new Date(s).getTime()), 'Data de validade inválida.');

/**
 * Schema de **submissão à moderação** (USP-020 / L-003). Exige todos os campos
 * obrigatórios e a validade futura dentro do teto. As mensagens distintas de
 * validade (E-004 vs E-005) saem de {@link validadeStatus}, a regra pura.
 *
 * ADR-0028 (sanitização de PII óbvia em conteúdo textual): não há helper de scrub
 * de conteúdo no projeto hoje — a auditoria já redige PII e a moderação humana é a
 * barreira final. Gancho deixado marcado aqui para defesa em profundidade futura.
 */
export const publishJobSchema = z
  .object({
    companyId,
    title,
    areaId,
    description,
    requirements,
    workRegime,
    location,
    benefits,
    salary,
    contractType,
    regionId,
    educationLevelRequired,
    salaryMin: salaryAmount,
    salaryMax: salaryAmount,
    salaryVisible,
    validUntil: validUntilStr,
  })
  .superRefine((data, ctx) => {
    // Faixa coerente: máximo não pode ser menor que o mínimo (AD-5).
    if (
      typeof data.salaryMin === 'number' &&
      typeof data.salaryMax === 'number' &&
      data.salaryMax < data.salaryMin
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['salaryMax'],
        message: 'O salário máximo não pode ser menor que o mínimo.',
      });
    }
    const status = validadeStatus(new Date(data.validUntil), new Date());
    if (status === 'passado') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['validUntil'],
        message: 'A data de validade deve ser futura.',
      });
    } else if (status === 'excede_teto') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['validUntil'],
        message: `A validade não pode ultrapassar ${MAX_VALIDADE_DIAS} dias.`,
      });
    }
  });

/**
 * Schema de **rascunho** (USP-020 / E-003 / AC-020-4). Salvar a qualquer momento:
 * só `companyId` (a quem pertence) e `title` são obrigatórios; os demais campos são
 * parciais e a validade NÃO é exigida nem precisa ser futura num rascunho.
 */
export const draftJobSchema = z.object({
  companyId,
  title,
  areaId: areaId.optional(),
  description: z.string().trim().max(DESCRICAO_MAX).optional(),
  requirements: z.string().trim().max(REQUISITOS_MAX).optional(),
  workRegime: z.string().trim().max(REGIME_MAX).optional(),
  location: z.string().trim().max(LOCAL_MAX).optional(),
  benefits,
  salary,
  contractType: contractType.optional(),
  regionId: regionId.optional(),
  educationLevelRequired,
  salaryMin: salaryAmount,
  salaryMax: salaryAmount,
  salaryVisible,
  validUntil: validUntilStr.optional(),
});

/**
 * Schema de **submissão** (USP-020). Duas formas: submeter um rascunho existente
 * (`{ jobId }`) ou submeter um formulário completo de uma vez (cria DRAFT + transiciona).
 * O formulário completo reusa {@link publishJobSchema} (L-003 + validade futura).
 */
export const submitJobSchema = z.union([
  z.object({ jobId: z.string().uuid('Vaga inválida.') }),
  publishJobSchema,
]);

/**
 * Schema de **edição** de uma vaga já `ACTIVE` (USP-023 / E-001 / AC-023-1). Subconjunto
 * editável de `publishJobSchema`: os campos de conteúdo/busca (mesmas regras de
 * completude do submit — a vaga volta a `DRAFT` e passa por nova moderação, então deve
 * sair completa). **Exclui** `companyId` (imutável — resolvido a partir da vaga carregada,
 * nunca do input do cliente) e `validUntil` (prorrogar é `extendJobValidity`, ação separada
 * que não força re-moderação — E-004 vs E-001).
 */
export const editJobSchema = z.object({
  jobId: z.string().uuid('Vaga inválida.'),
  title,
  areaId,
  description,
  requirements,
  workRegime,
  location,
  benefits,
  salary,
  contractType,
  regionId,
  educationLevelRequired,
  salaryMin: salaryAmount,
  salaryMax: salaryAmount,
  salaryVisible,
});

export type PublishJobInput = z.input<typeof publishJobSchema>;
export type PublishJobData = z.output<typeof publishJobSchema>;
export type DraftJobInput = z.input<typeof draftJobSchema>;
export type DraftJobData = z.output<typeof draftJobSchema>;
export type SubmitJobInput = z.input<typeof submitJobSchema>;
export type SubmitJobData = z.output<typeof submitJobSchema>;
export type EditJobInput = z.input<typeof editJobSchema>;
export type EditJobData = z.output<typeof editJobSchema>;
