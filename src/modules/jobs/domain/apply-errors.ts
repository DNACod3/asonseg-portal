/**
 * Corrida de duplicidade — a linha ativa da candidatura foi criada por outra
 * requisição concorrente (garantia real = índice único parcial
 * `uq_application_active`, P2002). Reusada por `applyToJob` (USP-025) e por
 * `createReferralApplication` (USP-037 / T4).
 *
 * Vive num arquivo `domain/` puro (não em `actions/apply-to-job.ts`, que é
 * `'use server'`): arquivos `'use server'` só podem exportar funções async —
 * exportar uma classe daqueles quebra o build de produção do Next.js.
 */
export class ApplyConflictError extends Error {}
