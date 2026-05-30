import { hashSync, compareSync } from 'bcryptjs';

/**
 * Anti-timing helper para o fluxo de login (USP-004 — proibição P-002).
 *
 * Quando o e-mail é desconhecido, Supabase Auth retorna rápido (sem ler hash);
 * quando o e-mail existe mas a senha está errada, o tempo gasto em `bcrypt.compare`
 * é da ordem de ~80–200ms. Essa diferença permite enumeração de e-mails
 * cadastrados por análise de timing.
 *
 * Solução: no caminho de "e-mail desconhecido", executar um `compareSync` contra
 * um hash dummy gerado no boot, nivelando o tempo de resposta.
 *
 * O hash dummy é gerado uma única vez por processo (custo equivalente a um
 * bcrypt real com cost 10) e reutilizado em todas as chamadas.
 *
 * Cf. IDSD/.specs/features/usp-004-autenticar-no-portal/design.md §D-A.
 */
const DUMMY_PASSWORD = 'asonseg-anti-timing-dummy-password-do-not-use';

/** Hash bcrypt dummy gerado uma vez no boot (cost 10, default do Supabase Auth). */
export const DUMMY_HASH: string = hashSync(DUMMY_PASSWORD, 10);

/**
 * Executa um `bcrypt.compare` contra o hash dummy para nivelar o tempo de
 * resposta no caminho de "e-mail desconhecido". Retorno é sempre descartado.
 */
export function consumeTimingBudget(): void {
  // Compara com uma senha qualquer — o tempo de `compareSync` é dominado pelo
  // bcrypt iteration count, não pela igualdade dos textos.
  compareSync('not-the-real-password', DUMMY_HASH);
}
