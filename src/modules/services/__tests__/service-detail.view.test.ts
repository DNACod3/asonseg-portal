import { describe, it, expect } from 'vitest';
import { Prisma } from '@prisma/client';
import type { CurrentPerson } from '@/modules/identity';
import {
  viewServiceDetail,
  serviceDetailJsonLd,
  serializeJsonLd,
  type ServiceDetailRow,
} from '../views/service-detail.view';

/**
 * View Model do detalhe público de serviço (USP-031 / T031-2). AC-031-1: expõe
 * campos públicos. AC-031-2/SVC031-MN-01: oculta contato para viewer null E
 * autenticado (o tipo não carrega telefone/e-mail — defesa em profundidade a
 * nível de tipo, não apenas de runtime).
 */

function row(overrides: Partial<ServiceDetailRow> = {}): ServiceDetailRow {
  return {
    id: 'service-1',
    title: 'Jardinagem residencial',
    description: 'Poda, manutenção de grama e jardins residenciais.',
    priceMin: new Prisma.Decimal(80),
    priceMax: new Prisma.Decimal(150),
    priceUnit: 'por serviço',
    availabilityDescription: 'Segunda a sexta, 8h às 17h.',
    publishedAt: new Date('2026-07-01T12:00:00Z'),
    category: { name: 'Jardinagem' },
    region: { name: 'Centro' },
    photos: [{ storagePath: 'author-1/foto.jpg', position: 0 }],
    author: { fullName: 'João da Silva' },
    company: null,
    ...overrides,
  };
}

const anon: CurrentPerson | null = null;
const authenticated: CurrentPerson = {
  id: 'viewer-1',
  supabaseUserId: '00000000-0000-0000-0000-000000000001',
  fullName: 'Maria',
  status: 'ATIVO',
  primeiroAcesso: false,
  roles: ['CLIENT'],
  phone: null,
  fullAddress: null,
};

describe('viewServiceDetail — AC-031-1: expõe campos públicos', () => {
  it('projeta título, descrição, categoria, região, valor, disponibilidade e fotos', () => {
    const detail = viewServiceDetail(row(), anon);
    expect(detail).toMatchObject({
      id: 'service-1',
      title: 'Jardinagem residencial',
      description: 'Poda, manutenção de grama e jardins residenciais.',
      category: 'Jardinagem',
      region: 'Centro',
      price: { min: 80, max: 150, unit: 'por serviço' },
      availability: 'Segunda a sexta, 8h às 17h.',
    });
    expect(detail.photos).toHaveLength(1);
    expect(detail.photos[0]?.url).toContain('/storage/v1/object/public/provider-photos/author-1/foto.jpg');
  });

  it('PF (companyId nulo): provider.displayName = author.fullName, isPF = true', () => {
    const detail = viewServiceDetail(row(), anon);
    expect(detail.provider).toEqual({ displayName: 'João da Silva', isPF: true });
  });

  it('Empresa: provider.displayName = company.nomeFantasia, isPF = false', () => {
    const detail = viewServiceDetail(row({ company: { nomeFantasia: 'Verde Jardins Ltda' } }), anon);
    expect(detail.provider).toEqual({ displayName: 'Verde Jardins Ltda', isPF: false });
  });

  it('nome do prestador é público para anônimo E autenticado (sem branch de anonimização, ADR-0010)', () => {
    const r = row({ company: { nomeFantasia: 'Verde Jardins Ltda' } });
    expect(viewServiceDetail(r, anon).provider.displayName).toBe('Verde Jardins Ltda');
    expect(viewServiceDetail(r, authenticated).provider.displayName).toBe('Verde Jardins Ltda');
  });
});

describe('viewServiceDetail — AC-031-2/SVC031-MN-01: oculta contato para todos', () => {
  it('o tipo ServiceDetail não possui nenhum campo de contato', () => {
    const detail = viewServiceDetail(row(), anon);
    expect(detail).not.toHaveProperty('phone');
    expect(detail).not.toHaveProperty('emailLogin');
    expect(detail).not.toHaveProperty('contact');
    expect(Object.keys(detail).sort()).toEqual(
      [
        'id',
        'title',
        'description',
        'category',
        'region',
        'price',
        'availability',
        'photos',
        'provider',
        'publishedAt',
        'canManifestInterest',
      ].sort(),
    );
    expect(Object.keys(detail.provider).sort()).toEqual(['displayName', 'isPF'].sort());
  });

  it('mesmo para viewer autenticado, o tipo continua sem contato', () => {
    const detail = viewServiceDetail(row(), authenticated);
    expect(detail).not.toHaveProperty('phone');
    expect(detail).not.toHaveProperty('contact');
  });
});

describe('viewServiceDetail — canManifestInterest (seam U3)', () => {
  it('false para anônimo, true para autenticado — sem persistência/revelação real', () => {
    expect(viewServiceDetail(row(), anon).canManifestInterest).toBe(false);
    expect(viewServiceDetail(row(), authenticated).canManifestInterest).toBe(true);
  });
});

describe('viewServiceDetail — price/photos ausentes (defensivo)', () => {
  it('price é null quando priceMin/priceMax/priceUnit ausentes', () => {
    const detail = viewServiceDetail(
      row({ priceMin: null, priceMax: null, priceUnit: null }),
      anon,
    );
    expect(detail.price).toBeNull();
  });

  it('photos é [] quando o serviço não tem fotos', () => {
    const detail = viewServiceDetail(row({ photos: [] }), anon);
    expect(detail.photos).toEqual([]);
  });
});

describe('serviceDetailJsonLd — sem contato, espelha campos públicos', () => {
  it('gera schema.org Service sem nenhum campo de contato', () => {
    const detail = viewServiceDetail(row(), anon);
    const jsonLd = serviceDetailJsonLd(detail);
    expect(jsonLd).toMatchObject({
      '@type': 'Service',
      name: 'Jardinagem residencial',
      category: 'Jardinagem',
      areaServed: 'Centro',
      provider: { '@type': 'Person', name: 'João da Silva' },
    });
    expect(JSON.stringify(jsonLd)).not.toMatch(/phone|emailLogin|telefone/i);
  });
});

describe('serializeJsonLd — injeção segura', () => {
  it('escapa </script> para não quebrar o bloco (defesa XSS)', () => {
    const serialized = serializeJsonLd({ description: '</script><script>alert(1)</script>' });
    expect(serialized).not.toContain('</script>');
    expect(serialized).toContain('\\u003c/script\\u003e');
  });
});
