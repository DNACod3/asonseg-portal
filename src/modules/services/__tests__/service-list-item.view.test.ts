import { describe, it, expect } from 'vitest';
import { Prisma } from '@prisma/client';
import type { CurrentPerson } from '@/modules/identity';
import { viewServiceForVisitor, type ServiceListRow } from '../views/service-list-item.view';

/**
 * View Model da lista pública de serviços (USP-030 / T030-3). Diferença chave
 * vs `viewJobForVisitor`: o nome do prestador/Empresa é público a todos —
 * não há branch de anonimização (ADR-0010). Nenhum campo de contato existe no
 * tipo/saída (SVC030-MN-02, defesa em profundidade a nível de tipo).
 */

function row(overrides: Partial<ServiceListRow> = {}): ServiceListRow {
  return {
    id: 'service-1',
    title: 'Jardinagem residencial',
    priceMin: new Prisma.Decimal(80),
    priceMax: new Prisma.Decimal(150),
    priceUnit: 'por serviço',
    publishedAt: new Date('2026-07-01T12:00:00Z'),
    category: { name: 'Jardinagem' },
    region: { name: 'Centro' },
    author: { fullName: 'João da Silva' },
    company: null,
    photos: [],
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

describe('viewServiceForVisitor — nome público (ADR-0010, sem anonimização)', () => {
  it('PF (companyId nulo): providerDisplayName = author.fullName, para anônimo e autenticado', () => {
    expect(viewServiceForVisitor(row(), anon).providerDisplayName).toBe('João da Silva');
    expect(viewServiceForVisitor(row(), authenticated).providerDisplayName).toBe('João da Silva');
  });

  it('Empresa (companyId setado): providerDisplayName = company.nomeFantasia, para anônimo e autenticado', () => {
    const r = row({ company: { nomeFantasia: 'Verde Jardins Ltda' } });
    expect(viewServiceForVisitor(r, anon).providerDisplayName).toBe('Verde Jardins Ltda');
    expect(viewServiceForVisitor(r, authenticated).providerDisplayName).toBe('Verde Jardins Ltda');
  });

  it('SVC030-MN-02: nenhum campo de contato aparece na projeção (tipo não carrega phone/emailLogin)', () => {
    const item = viewServiceForVisitor(row(), anon);
    expect(item).not.toHaveProperty('phone');
    expect(item).not.toHaveProperty('emailLogin');
    expect(item).not.toHaveProperty('contact');
    expect(Object.keys(item).sort()).toEqual(
      ['id', 'title', 'categoryName', 'regionName', 'price', 'providerDisplayName', 'coverPhotoUrl', 'publishedAt'].sort(),
    );
  });
});

describe('viewServiceForVisitor — projeção de valor e foto', () => {
  it('projeta a faixa de valor + unidade quando presente', () => {
    const item = viewServiceForVisitor(row(), anon);
    expect(item.price).toEqual({ min: 80, max: 150, unit: 'por serviço' });
  });

  it('price é null quando priceMin/priceMax/priceUnit ausentes (rascunho nunca publicado, defensivo)', () => {
    const item = viewServiceForVisitor(
      row({ priceMin: null, priceMax: null, priceUnit: null }),
      anon,
    );
    expect(item.price).toBeNull();
  });

  it('coverPhotoUrl é null sem fotos, e a URL pública do bucket provider-photos com foto', () => {
    expect(viewServiceForVisitor(row(), anon).coverPhotoUrl).toBeNull();

    const withPhoto = viewServiceForVisitor(
      row({ photos: [{ storagePath: 'author-1/foto.jpg' }] }),
      anon,
    );
    expect(withPhoto.coverPhotoUrl).toContain('/storage/v1/object/public/provider-photos/author-1/foto.jpg');
  });

  it('categoryName/regionName são null quando a FK está ausente', () => {
    const item = viewServiceForVisitor(row({ category: null, region: null }), anon);
    expect(item.categoryName).toBeNull();
    expect(item.regionName).toBeNull();
  });
});
