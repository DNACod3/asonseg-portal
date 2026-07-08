import type { Metadata } from 'next';
import Link from 'next/link';
import { getCurrentPerson } from '@/modules/identity';
import {
  getActiveJobDetail,
  viewJobDetail,
  jobDetailJsonLd,
  serializeJsonLd,
  JobDetailView,
} from '@/modules/jobs';
import { Button, Card } from '@/shared/ui';

// ADR-0013/ADR-0019: detalhe público com ISR (alinhado a `/vagas` = 30min, L-002). A
// revalidação fina de `/vagas/[id]` é débito (design §5) — a janela curta de ISR cobre
// L-002; transitionContent já revalida `/vagas` quando a vaga entra/sai de ACTIVE.
export const revalidate = 1800;

/** Comprimento máximo da meta description (boa prática SEO — evita truncamento do buscador). */
const META_DESCRIPTION_MAX = 160;

/** Resume um texto longo para a meta description, cortando em limite de palavra. */
function metaDescription(text: string | null): string | null {
  if (!text) return null;
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= META_DESCRIPTION_MAX) return clean;
  return `${clean.slice(0, META_DESCRIPTION_MAX).replace(/\s+\S*$/, '')}…`;
}

/**
 * Metadados do detalhe (USP-022 / T4 / P-002). Servem crawler/social = **sempre anônimos**:
 * a busca é feita SEM viewer (`getActiveJobDetail(id, null)`), então o nome real da Empresa
 * nem é carregado — não há como vazar em `<title>`, description, Open Graph, Twitter Card ou
 * URL canônica (P-002 em todos os canais). Vaga não-detalhável ⇒ metadados de "indisponível"
 * sem dado sensível (e `noindex`).
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const canonical = `/vagas/${id}`;
  const row = await getActiveJobDetail(id, null);

  if (!row) {
    return {
      title: 'Vaga indisponível | ASONSEG',
      description: 'Esta vaga não está mais disponível.',
      alternates: { canonical },
      robots: { index: false, follow: true },
    };
  }

  const job = viewJobDetail(row, null);
  const title = `${job.title} | ASONSEG`;
  const description = metaDescription(job.description) ?? `Vaga de ${job.title}.`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical, type: 'website' },
    twitter: { card: 'summary', title, description },
  };
}

/**
 * Estado "vaga encerrada / temporariamente indisponível" (E-005/D-004). Renderizado
 * quando a vaga não casa o on-read (não-ACTIVE, expirada ou Empresa rebaixada) — mensagem
 * clara + caminho para outras vagas, NUNCA um 404 técnico nem botão de candidatura (P-005).
 */
function VagaIndisponivel() {
  return (
    <Card className="flex flex-col items-start gap-4">
      <div>
        <h1 className="text-xl font-bold text-fg">Vaga encerrada</h1>
        <p className="mt-2 text-sm text-fg-muted">
          Esta vaga não está mais disponível ou foi temporariamente removida. Veja outras
          oportunidades abertas na região.
        </p>
      </div>
      <Button variant="primary" asChild>
        <Link href="/vagas">Ver outras vagas</Link>
      </Button>
    </Card>
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
      {/* JSON-LD JobPosting sempre anônimo (P-002): projeção `viewer=null` ⇒ a Organization
          usa o rótulo por setor, nunca o nome real — independe de quem está logado. */}
      {row != null && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(jobDetailJsonLd(viewJobDetail(row, null))) }}
        />
      )}

      <Link href="/vagas" className="text-sm text-primary hover:underline">
        ← Voltar para as vagas
      </Link>

      {row == null ? <VagaIndisponivel /> : <JobDetailView job={viewJobDetail(row, viewer)} />}
    </main>
  );
}
