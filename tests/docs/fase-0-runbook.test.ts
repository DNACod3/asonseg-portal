import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * F0C-01 — teste estrutural do runbook único de provisionamento externo
 * (Fase 0 — Fundação, WS-C). Confirma: uma seção por serviço, as 3 colunas
 * obrigatórias (estado atual / provisionar manualmente / como verificar),
 * cobertura do restore drill + 3 spikes, cross-links a docs/infra/* e
 * docs/spikes/* (sem duplicar conteúdo), e os achados exigidos pelo plano.
 */

const DOC_PATH = join(process.cwd(), 'docs/infra/fase-0-provisioning-runbook.md');

function readDoc(): string {
  return readFileSync(DOC_PATH, 'utf8');
}

const SERVICES = ['Vercel', 'Supabase', 'Resend', 'Sentry', 'Cloudflare Turnstile', 'Anthropic'];

const SPIKES = [
  'spike-pooler-prisma.md',
  'spike-turnstile.md',
  'spike-claude-cv.md',
];

const CROSS_LINKED_INFRA_DOCS = [
  'vercel.md',
  'supabase.md',
  'resend-sentry-turnstile.md',
  'anthropic-backblaze.md',
  'dr-restore-drill.md',
];

describe('F0C-01 — runbook de provisionamento externo (Fase 0)', () => {
  it('existe: docs/infra/fase-0-provisioning-runbook.md está presente', () => {
    expect(existsSync(DOC_PATH)).toBe(true);
  });

  it('contém as 3 colunas obrigatórias (estado atual / provisionar manualmente / como verificar)', () => {
    const content = readDoc();
    expect(content).toMatch(/[Ee]stado atual/);
    expect(content).toMatch(/[Pp]rovisionar manualmente/);
    expect(content).toMatch(/[Cc]omo verificar/);
  });

  it.each(SERVICES)('cobre o serviço "%s"', (service) => {
    expect(readDoc()).toContain(service);
  });

  it('cobre o restore drill (B2 / ADR-0006)', () => {
    const content = readDoc();
    expect(content).toMatch(/restore drill|drill de restore/i);
    expect(content).toMatch(/ADR-0006|Backblaze B2/);
  });

  it.each(SPIKES)('cross-linka o spike "%s" (sem duplicar conteúdo)', (spike) => {
    expect(readDoc()).toContain(spike);
  });

  it.each(CROSS_LINKED_INFRA_DOCS)('cross-linka o doc de infra "%s"', (doc) => {
    expect(readDoc()).toContain(doc);
  });

  it('registra o achado: SDK do Sentry ausente (@sentry/nextjs), hardening adiado à Fase 6', () => {
    const content = readDoc();
    expect(content).toMatch(/@sentry\/nextjs/);
    expect(content).toMatch(/Fase 6/);
  });

  it('registra o achado: módulo cv-extraction ausente, construção adiada à USP-040', () => {
    const content = readDoc();
    expect(content).toMatch(/cv-extraction/);
    expect(content).toMatch(/USP-040/);
  });

  it('registra o achado: mismatch B2_APPLICATION_KEY x B2_APP_KEY entre env.ts e os workflows', () => {
    const content = readDoc();
    expect(content).toMatch(/B2_APPLICATION_KEY/);
    expect(content).toMatch(/B2_APP_KEY/);
  });
});
