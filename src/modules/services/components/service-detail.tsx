import Link from 'next/link';
import { formatDate } from '@/shared/lib/time';
import { Badge, Button, FormCard, FormSectionTitle } from '@/shared/ui';
import type { ServiceDetail } from '../views/service-detail.view';
import type { ProviderContact } from '../views/provider-contact.view';
import { ManifestInterestButton } from './manifest-interest-button';
import { CancelInterestButton } from './cancel-interest-button';

const brl = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});

/** Texto da faixa de valor + unidade (ou null se ausente). */
function priceLabel(price: ServiceDetail['price']): string | null {
  if (!price) return null;
  const { min, max, unit } = price;
  const unitSuffix = unit ? ` (${unit})` : '';
  if (min != null && max != null) {
    return (min === max ? brl.format(min) : `${brl.format(min)} – ${brl.format(max)}`) + unitSuffix;
  }
  if (min != null) return `A partir de ${brl.format(min)}${unitSuffix}`;
  if (max != null) return `Até ${brl.format(max)}${unitSuffix}`;
  return null;
}

/** Bloco de texto longo (descrição), só renderiza se houver conteúdo. */
function Section({ title, content }: Readonly<{ title: string; content: string | null }>) {
  if (!content) return null;
  return (
    <section>
      <FormSectionTitle>{title}</FormSectionTitle>
      <p className="whitespace-pre-line text-sm leading-relaxed text-fg-muted">{content}</p>
    </section>
  );
}

/**
 * Galeria simples de fotos do serviço (até 3, AC-029-4). Sem lightbox/carrossel
 * — grid responsivo básico, consistente com o restante do DS (AD-014).
 */
function PhotoGallery({ photos }: Readonly<{ photos: ServiceDetail['photos'] }>) {
  if (photos.length === 0) return null;
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {photos.map((photo) => (
        <li key={photo.url}>
          {/* eslint-disable-next-line @next/next/no-img-element -- URL pública externa (bucket Storage), sem otimização do next/image. */}
          <img
            src={photo.url}
            alt=""
            className="h-40 w-full rounded-md object-cover"
          />
        </li>
      ))}
    </ul>
  );
}

/**
 * CTA de manifestação de interesse (USP-033/034 — AC-031-3/AC-033-1..5/AC-034-1).
 * Três caminhos por papel/estado (`service.canManifestInterest`, já decidido
 * pelo View Model): anônimo → link de cadastro; autenticado sem interesse
 * ativo → `ManifestInterestButton` real; autenticado com interesse ativo →
 * contato do prestador revelado + `CancelInterestButton` real (USP-034).
 */
function ManifestInterestCta({
  service,
  myInterestId,
  providerContact,
  consentTerm,
}: Readonly<{
  service: ServiceDetail;
  myInterestId: string | null;
  providerContact: ProviderContact | null;
  consentTerm?: { humanName: string; body: string };
}>) {
  if (service.canManifestInterest) {
    if (myInterestId && providerContact) {
      return (
        <div className="flex flex-col gap-3">
          <div className="rounded-lg border border-border bg-background p-4 text-sm">
            <p className="font-medium text-fg">Contato do prestador</p>
            <p className="text-fg-muted">{providerContact.phone ?? 'Telefone não informado'}</p>
            <p className="text-fg-muted">{providerContact.email ?? 'E-mail não informado'}</p>
          </div>
          <CancelInterestButton interestId={myInterestId} />
        </div>
      );
    }
    if (consentTerm) {
      return <ManifestInterestButton serviceId={service.id} consentTerm={consentTerm} />;
    }
    return (
      <Button variant="primary" disabled title="Indisponível no momento">
        Entrar em contato
      </Button>
    );
  }
  // Anônimo: caminho claro para criar conta (USP-001), mesmo padrão de JobDetailView.
  return (
    <Button variant="outline" asChild>
      <Link href="/cadastro">Criar conta para entrar em contato</Link>
    </Button>
  );
}

/**
 * Apresentação do detalhe de um serviço (USP-031). Consome o View Model já
 * recortado (`viewServiceDetail`): nome do prestador/Empresa público a todos,
 * NUNCA contato — nenhum dado restrito chega aqui (SVC031-MN-01). O CTA de
 * manifestação de interesse é só afordância (seam U3).
 */
export interface ServiceDetailViewProps {
  service: ServiceDetail;
  /** Id da manifestação ATIVA do viewer neste serviço, já resolvida pela página
   *  (Server Component — `getMyActiveServiceInterest`, USP-033). `null`/omitido =
   *  ainda não manifestou (ou não é cliente). */
  myInterestId?: string | null;
  /** Contato do prestador, revelado só quando `myInterestId` existe (USP-033 —
   *  SVC033-MN-01: nunca chega aqui sem manifestação ativa). */
  providerContact?: ProviderContact | null;
  /** Termo `SERVICE_HIRING` carregado server-side (página), usado pelo
   *  `ManifestInterestButton` se o consentimento não estiver ativo (AC-033-4). */
  consentTerm?: { humanName: string; body: string };
}

export function ServiceDetailView({
  service,
  myInterestId = null,
  providerContact = null,
  consentTerm,
}: Readonly<ServiceDetailViewProps>) {
  const price = priceLabel(service.price);
  const meta = [service.category, service.region].filter(Boolean);

  return (
    <FormCard className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="font-heading text-2xl font-bold text-fg">{service.title}</h1>
        <p className="text-sm text-fg-muted">{service.provider.displayName}</p>

        {meta.length > 0 && (
          <ul className="mt-1 flex flex-wrap gap-2">
            {meta.map((tag) => (
              <li key={tag}>
                <Badge variant="gray">{tag}</Badge>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-1 text-base font-semibold text-fg">{price ?? 'Valor a combinar'}</p>

        {service.publishedAt && (
          <time dateTime={service.publishedAt.toISOString()} className="text-xs text-fg-muted">
            Publicado em {formatDate(service.publishedAt)}
          </time>
        )}
      </header>

      <PhotoGallery photos={service.photos} />

      <Section title="Descrição" content={service.description} />

      {service.availability && (
        <dl className="grid grid-cols-1 gap-3 border-t border-border pt-4 text-sm">
          <div>
            <dt className="font-medium text-fg-muted">Disponibilidade</dt>
            <dd className="text-fg">{service.availability}</dd>
          </div>
        </dl>
      )}

      <div className="border-t border-border pt-5">
        <ManifestInterestCta
          service={service}
          myInterestId={myInterestId}
          providerContact={providerContact}
          consentTerm={consentTerm}
        />
      </div>
    </FormCard>
  );
}
