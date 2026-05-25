// Route group (public): conteúdo público com ISR + on-demand revalidation
// (revalidateTag/revalidatePath). ADR-0013 define a estratégia POR ROTA — o
// intervalo NÃO fica no layout do grupo (senão se propaga para todas as rotas):
//   • home `/`            → revalidate = 600  (10min, indicadores "tempo real")
//   • listagens/detalhe   → revalidate = 1800 (30min) + `force-static`
// Cada página declara o seu próprio `revalidate`.

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
