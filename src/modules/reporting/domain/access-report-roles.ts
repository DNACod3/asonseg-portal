/**
 * Papéis internos autorizados a emitir o relatório de acesso de um titular
 * (LGPD art. 19). Não há `requirePermission()` RBAC neste repo ainda
 * (USP-007+), então a checagem em `issueAccessReport` é inline: o
 * solicitante precisa de ao menos um destes papéis.
 *
 * Vive fora de `actions/access-report.ts` (que tem `'use server'`) porque um
 * arquivo `'use server'` só pode exportar funções async — um `const` array
 * quebra o build do Next assim que QUALQUER rota importar o barrel do
 * módulo (USP-041 / T5 expôs isso: a home pública foi a 1ª página a
 * importar `@/modules/reporting`). Sem IO — constante pura, mesmo espírito
 * de `domain/`.
 */
export const ACCESS_REPORT_ROLES = ['SOCIAL_ASSISTANT', 'BOARD', 'COORDINATOR'] as const;
