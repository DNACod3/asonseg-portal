import Link from 'next/link';
import { getCurrentPerson } from '@/modules/identity';
import { getActiveJobDetail, viewJobDetail, JobDetailView } from '@/modules/jobs';

// ADR-0013/ADR-0019: detalhe público com ISR (alinhado a `/vagas` = 30min, L-002). A
// revalidação fina de `/vagas/[id]` é débito (design §5) — a janela curta de ISR cobre
// L-002; transitionContent já revalida `/vagas` quando a vaga entra/sai de ACTIVE.
export const revalidate = 1800;

/**
 * Estado "vaga encerrada / temporariamente indisponível" (E-005/D-004). Renderizado
 * quando a vaga não casa o on-read (não-ACTIVE, expirada ou Empresa rebaixada) — mensagem
 * clara + caminho para outras vagas, NUNCA um 404 técnico nem botão de candidatura (P-005).
 */
function VagaIndisponivel() {
  return (
    <section className="flex flex-col items-start gap-4 rounded-xl border border-gray-200 bg-white p-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Vaga encerrada</h1>
        <p className="mt-2 text-sm text-gray-600">
          Esta vaga não está mais disponível ou foi temporariamente removida. Veja outras
          oportunidades abertas na região.
        </p>
      </div>
      <Link
        href="/vagas"
        className="inline-block rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
      >
        Ver outras vagas
      </Link>
    </section>
  );
}

/**
 * Detalhe público de uma vaga (USP-022 / #277). Server Component: resolve a Pessoa
 * autenticada (decide anonimização e CTA por papel — E-001/E-002/E-004) e então o detalhe
 * on-read. O detalhe depende do viewer (o `select` do nome real é condicional ao papel,
 * P-002) ⇒ sequencial, não paralelo. Anônimo é o caso comum (rota pública); o nome real da
 * Empresa nunca chega ao HTML do anônimo. Vaga não-detalhável ⇒ "vaga encerrada" (E-005).
 */
export default async function VagaDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const viewer = await getCurrentPerson();
  const row = await getActiveJobDetail(id, viewer);

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <Link href="/vagas" className="text-sm text-blue-600 hover:underline">
        ← Voltar para as vagas
      </Link>

      {row == null ? <VagaIndisponivel /> : <JobDetailView job={viewJobDetail(row, viewer)} />}
    </main>
  );
}
