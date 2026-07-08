/**
 * Termo de isenção de responsabilidade da ASONSEG (AC-030-4 / AC-031-4 —
 * épico servicos). A ASONSEG atua exclusivamente como plataforma de conexão:
 * não presta, não intermedia financeiramente e não garante a execução dos
 * serviços anunciados. Componente compartilhado entre a busca (`/servicos`,
 * USP-030) e o detalhe (`/servicos/[id]`, USP-031).
 */
export function AsonsegDisclaimer() {
  return (
    <p
      role="note"
      className="rounded-lg border border-border bg-surface px-4 py-3 text-xs text-fg-muted"
    >
      A ASONSEG é apenas plataforma de conexão: não presta, não intermedia financeiramente e não
      garante a execução dos serviços anunciados.
    </p>
  );
}
