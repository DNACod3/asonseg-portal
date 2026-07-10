import type { Metadata } from 'next';
import Link from 'next/link';
import { getCurrentPerson } from '@/modules/identity';
import { loadTerm, purposeMetadata, stripTermFrontMatter, TermLoaderError } from '@/modules/consents';
import {
  getActiveServiceDetail,
  getMyActiveServiceInterest,
  getProviderContactForService,
  viewServiceDetail,
  serviceDetailJsonLd,
  serializeJsonLd,
  ServiceDetailView,
  ServicoIndisponivel,
  AsonsegDisclaimer,
} from '@/modules/services';

// ADR-0013/ADR-0019: detalhe público com ISR (alinhado a `/servicos` = 30min).
// A revalidação on-demand (`revalidatePath('/servicos/[id]')`) já é disparada
// por `transitionContent` quando um serviço entra/sai de ACTIVE/INACTIVATED
// (NextCacheInvalidation, USP-029/T029-3).
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
 * Metadados do detalhe (USP-031 / SVC031-MN-03). Servem crawler/social =
 * **sempre anônimos**: a busca é feita SEM viewer (`getActiveServiceDetail(id, null)`)
 * e deriva de `viewServiceDetail` (fonte única — mesma usada pela página). Serviço
 * não-detalhável ⇒ metadados de "indisponível" + `noindex`.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const canonical = `/servicos/${id}`;
  const row = await getActiveServiceDetail(id, null);

  if (!row) {
    return {
      title: 'Serviço indisponível | ASONSEG',
      description: 'Este serviço não está mais disponível.',
      alternates: { canonical },
      robots: { index: false, follow: true },
    };
  }

  const service = viewServiceDetail(row, null);
  const title = `${service.title} | ASONSEG`;
  const description = metaDescription(service.description) ?? `Serviço: ${service.title}.`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical, type: 'website' },
    twitter: { card: 'summary', title, description },
  };
}

/**
 * Detalhe público de um serviço (USP-031 / AC-031-1..4). Server Component:
 * resolve a Pessoa autenticada (decide só o CTA seam — AC-031-3, o nome do
 * prestador NÃO depende do viewer, ADR-0010) e então o detalhe on-read.
 * Serviço não-detalhável ⇒ `<ServicoIndisponivel>` (SVC031-MN-02). JSON-LD
 * SEMPRE derivado de `viewServiceDetail(row, null)` (SVC031-MN-03 — mesma
 * fonte única do `generateMetadata`).
 */
export default async function ServicoDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const viewer = await getCurrentPerson();
  const row = await getActiveServiceDetail(id, viewer);
  const service = row != null ? viewServiceDetail(row, viewer) : null;

  // Bloco autenticado (USP-033 §D6): só resolvido quando há viewer E o serviço é
  // detalhável. O contato só é buscado se já existir manifestação ATIVA
  // (SVC033-MN-01 — nunca chega ao View Model sem entitlement).
  let myInterestId: string | null = null;
  let providerContact = null as Awaited<ReturnType<typeof getProviderContactForService>>;
  let consentTerm: { humanName: string; body: string } | undefined;

  if (viewer != null && service != null) {
    const mine = await getMyActiveServiceInterest(id, viewer.id);
    myInterestId = mine?.id ?? null;
    if (myInterestId) {
      providerContact = await getProviderContactForService(id, viewer.id);
    }
    try {
      const term = await loadTerm('SERVICE_HIRING');
      consentTerm = { humanName: purposeMetadata('SERVICE_HIRING').humanName, body: stripTermFrontMatter(term.content) };
    } catch (err) {
      if (!(err instanceof TermLoaderError)) throw err;
      // Termo indisponível/adulterado: o CTA autenticado degrada para o estado
      // desabilitado (mesma resiliência de `buildActivatableOptions`) — nunca
      // bloqueia a leitura pública do detalhe.
    }
  }

  return (
    // USP-046 (CASCA-12): <main> agora vem do (public)/layout.tsx.
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      {/* JSON-LD Service sempre derivado da fonte única com viewer=null (SVC031-MN-03) —
          o nome do prestador é público a todos, então o resultado independe do viewer. */}
      {row != null && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(serviceDetailJsonLd(viewServiceDetail(row, null))) }}
        />
      )}

      <Link href="/servicos" className="text-sm text-primary hover:underline">
        ← Voltar para os serviços
      </Link>

      {service != null ? (
        <ServiceDetailView
          service={service}
          myInterestId={myInterestId}
          providerContact={providerContact}
          consentTerm={consentTerm}
        />
      ) : (
        <ServicoIndisponivel />
      )}

      <AsonsegDisclaimer />
    </div>
  );
}
