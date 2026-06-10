import { z } from 'zod';

/**
 * Schema de entrada do cadastro de prestador de serviço PF (USP-010 / CAD-06..08).
 *
 * Todos os campos são **opcionais** — a ativação do papel não exige preenchimento
 * do perfil (foto/descrição/região vêm depois). O papel e o consentimento
 * `SERVICE_OFFERING` são ativados pelo fluxo canônico de papel adicional
 * (`activateAdditionalRole`, USP-006); esta entrada cuida só do `ProviderProfile`.
 *
 * **Sem campo de CNPJ (ADR-0031):** o CNPJ MEI do prestador PF reside em `companies`
 * via fluxo USP-012; declarar MEI redireciona, não é coletado aqui. Campos
 * desconhecidos (ex.: `cnpjMei`) são descartados pelo parse padrão do Zod.
 *
 * **P-005:** não há `personId` no input — a action opera sobre a Pessoa
 * autenticada da sessão (`getCurrentPerson`).
 */
export const providerProfileSchema = z.object({
  headline: z.string().trim().max(120, 'Máximo de 120 caracteres.').optional(),
  description: z.string().trim().max(5000, 'Máximo de 5000 caracteres.').optional(),
  regionId: z.string().uuid('Selecione uma região válida.').optional(),
});

/** Tipo de entrada (o que o formulário envia). */
export type ProviderProfileInput = z.input<typeof providerProfileSchema>;
/** Tipo de saída (após o parse). */
export type ProviderProfileData = z.output<typeof providerProfileSchema>;
