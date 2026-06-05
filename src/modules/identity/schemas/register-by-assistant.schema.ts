import { z } from 'zod';
import { isValidCpf, PUBLIC_ROLES } from './registerPerson';
import { CPF_EXCEPTION_MIN_JUSTIFICATION } from '../domain/assisted-registration';

/**
 * Schema do cadastro assistido pela AS (USP-002 / IDN-04, IDN-05, IDN-06).
 *
 * Diferenças em relação ao auto-cadastro público (USP-001):
 *  - **Nome obrigatório; todos os demais campos opcionais** (E-001).
 *  - **Sem e-mail/senha** — a Pessoa é criada sem credencial (P-002): existe e é
 *    referenciável, mas não loga por nenhuma rota.
 *  - Expõe a marca **"Pessoa sem documento — exceção"** (`cpfException`), que o
 *    schema público deliberadamente NÃO tem (E-005 / P-001). A permissão de uso
 *    é reforçada na Server Action (apenas AS/diretoria).
 *
 * Regra de CPF (auditabilidade LGPD — F3):
 *  - CPF informado  ⇒ exceção deve estar desmarcada.
 *  - Sem CPF        ⇒ exceção obrigatória + justificativa ≥ 20 caracteres.
 * Assim toda Pessoa sem CPF carrega uma justificativa rastreável; não há caminho
 * silencioso para criar Pessoa sem documento sem registrar o porquê.
 *
 * Campos sensíveis da ficha social (situação de moradia, vulnerabilidade) NÃO
 * entram aqui — pertencem à USP-036, sob visibilidade restrita (P-006).
 */

/** Texto livre opcional: normaliza string vazia/branca para `undefined`. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || undefined);

export const registerByAssistantSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(3, 'Nome deve ter ao menos 3 caracteres')
      .max(150, 'Nome deve ter no máximo 150 caracteres'),

    // CPF opcional: aceita com/sem máscara; "" vira `undefined` antes de validar.
    cpf: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? v.replace(/\D/g, '') : undefined))
      .refine((v) => v === undefined || isValidCpf(v), {
        message: 'CPF inválido (formato ou dígito verificador)',
      }),

    cpfException: z.boolean().default(false),

    cpfExceptionJustification: z
      .string()
      .trim()
      .max(500, 'Justificativa deve ter no máximo 500 caracteres')
      .optional()
      .transform((v) => v || undefined),

    phone: optionalText(20),

    birthDate: z
      .string()
      .trim()
      .optional()
      .transform((v) => v || undefined)
      .refine(
        (v) => {
          if (v === undefined) return true;
          const t = Date.parse(v);
          return !Number.isNaN(t) && t <= Date.now();
        },
        { message: 'Data de nascimento inválida ou no futuro' },
      ),

    fullAddress: optionalText(255),

    // Data da assinatura física do termo de atendimento social, colhido em papel
    // (E-004 / finalidade 6 — ADR-0013). Opcional: quando ausente, a Server Action
    // assume a data do cadastro. Mesmo padrão de validação de `birthDate`.
    signedOnPaperAt: z
      .string()
      .trim()
      .optional()
      .transform((v) => v || undefined)
      .refine(
        (v) => {
          if (v === undefined) return true;
          const t = Date.parse(v);
          return !Number.isNaN(t) && t <= Date.now();
        },
        { message: 'Data da assinatura inválida ou no futuro' },
      ),

    // Papel pretendido (opcional) — mesmos papéis públicos. O grant nasce
    // AWAITING_CONSENT e só ativa com o consentimento da finalidade (ADR-0020).
    // O `<select>` da UI envia "" para "Não definir agora" → normaliza a undefined.
    role: z
      .union([z.enum(PUBLIC_ROLES), z.literal('')])
      .optional()
      .transform((v) => v || undefined),
  })
  .superRefine((data, ctx) => {
    if (data.cpfException) {
      // E-002 / P-003: exceção exige justificativa com conteúdo mínimo.
      if (
        !data.cpfExceptionJustification ||
        data.cpfExceptionJustification.length < CPF_EXCEPTION_MIN_JUSTIFICATION
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['cpfExceptionJustification'],
          message: `Justifique a exceção com ao menos ${CPF_EXCEPTION_MIN_JUSTIFICATION} caracteres.`,
        });
      }
      // Marcar exceção com CPF informado é contraditório.
      if (data.cpf) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['cpf'],
          message: 'Remova o CPF ao marcar a exceção, ou desmarque a exceção.',
        });
      }
    } else if (!data.cpf) {
      // Sem CPF e sem exceção: caminho proibido (manteria Pessoa sem documento
      // sem justificativa rastreável — F3).
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['cpf'],
        message: 'Informe o CPF ou marque "Pessoa sem documento — exceção" com justificativa.',
      });
    }
  });

/** Tipo de entrada (o que o formulário/caller envia). */
export type RegisterByAssistantInput = z.input<typeof registerByAssistantSchema>;
/** Tipo de saída (normalizado, após o parse). */
export type RegisterByAssistantData = z.output<typeof registerByAssistantSchema>;
