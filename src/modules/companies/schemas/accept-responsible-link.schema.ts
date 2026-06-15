import { z } from 'zod';

/**
 * Aceite de um vínculo de responsável pendente (USP-013 / P-002). A identidade
 * da Pessoa vem da sessão (o link de e-mail não autentica) — só a Empresa é input.
 */
export const acceptResponsibleLinkSchema = z.object({
  empresaId: z.string().uuid('Empresa inválida.'),
});

export type AcceptResponsibleLinkInput = z.input<typeof acceptResponsibleLinkSchema>;
export type AcceptResponsibleLinkData = z.output<typeof acceptResponsibleLinkSchema>;
