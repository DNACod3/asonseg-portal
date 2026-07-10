import { describe, it, expect, beforeEach } from 'vitest';
import pino from 'pino';
import { SENSITIVE_FIELDS, REDACT_PATHS } from '../logger';

/**
 * Testes de redação do logger (H4, Fase 6 — hardening, MN-H4). Monta um pino
 * real com a MESMA config de `REDACT_PATHS` exportada de `logger.ts`, escrevendo
 * em um destino de teste em memória (não em stdout) — assim provamos a redação
 * de ponta a ponta, não uma reimplementação da lista de campos.
 */

class MemoryStream {
  lines: string[] = [];
  write(chunk: string): boolean {
    this.lines.push(chunk);
    return true;
  }
  get entries(): Record<string, unknown>[] {
    return this.lines
      .flatMap((l) => l.split('\n'))
      .filter((l) => l.trim().length > 0)
      .map((l) => JSON.parse(l));
  }
}

/** Primeira entrada logada — asserta presença antes de indexar (noUncheckedIndexedAccess). */
function firstEntry(s: MemoryStream): Record<string, unknown> {
  const entry = s.entries[0];
  if (!entry) throw new Error('nenhuma entrada logada');
  return entry;
}

let sink: MemoryStream;
let testLogger: pino.Logger;

beforeEach(() => {
  sink = new MemoryStream();
  testLogger = pino({ redact: { paths: REDACT_PATHS, censor: '[REDACTED]' } }, sink as unknown as pino.DestinationStream);
});

describe('shared/lib/logger — redação de PII (H4, MN-H4)', () => {
  it('sanity: os campos PII do domínio estão em SENSITIVE_FIELDS', () => {
    expect(SENSITIVE_FIELDS).toEqual(
      expect.arrayContaining([
        'fullAddress',
        'endereco',
        'birthDate',
        'experienceText',
        'skillsText',
        'coursesText',
        'cpf',
        'email',
      ]),
    );
  });

  it('redige PII na raiz do objeto logado', () => {
    testLogger.info({
      cpf: '52998224725',
      email: 'maria@example.com',
      fullAddress: 'Rua das Flores, 123',
      birthDate: '1990-01-01',
      nome: 'Maria', // campo NÃO sensível — não deve ser afetado
    });

    const entry = firstEntry(sink);
    expect(entry.cpf).toBe('[REDACTED]');
    expect(entry.email).toBe('[REDACTED]');
    expect(entry.fullAddress).toBe('[REDACTED]');
    expect(entry.birthDate).toBe('[REDACTED]');
    expect(entry.nome).toBe('Maria'); // vizinho não-sensível preservado
  });

  it('redige PII um nível de aninhamento (*.campo)', () => {
    testLogger.info({
      pessoa: {
        cpf: '52998224725',
        endereco: 'Av. Central, 45',
        cargo: 'Assistente Social', // não sensível
      },
    });

    const entry = firstEntry(sink);
    const pessoa = entry.pessoa as Record<string, unknown>;
    expect(pessoa.cpf).toBe('[REDACTED]');
    expect(pessoa.endereco).toBe('[REDACTED]');
    expect(pessoa.cargo).toBe('Assistente Social');
  });

  it('redige PII dois níveis de aninhamento (*.*.campo)', () => {
    testLogger.info({
      contexto: {
        candidato: {
          birthDate: '1985-05-20',
          experienceText: 'Trabalhei 5 anos como cuidador domiciliar de idosos.',
        },
      },
    });

    const entry = firstEntry(sink);
    const candidato = (entry.contexto as Record<string, unknown>).candidato as Record<
      string,
      unknown
    >;
    expect(candidato.birthDate).toBe('[REDACTED]');
    expect(candidato.experienceText).toBe('[REDACTED]');
  });

  it('redige o texto bruto de CV (skillsText/coursesText) em qualquer profundidade coberta', () => {
    testLogger.info({
      skillsText: 'Culinária, cuidados com idosos, informática básica.',
      dados: { coursesText: 'Curso de cuidador de idosos — 2024.' },
    });

    const entry = firstEntry(sink);
    expect(entry.skillsText).toBe('[REDACTED]');
    expect((entry.dados as Record<string, unknown>).coursesText).toBe('[REDACTED]');
  });

  it('MN-H4: mata a mutação de remover um campo de SENSITIVE_FIELDS (fullAddress deixaria de ser redigido)', () => {
    // Constrói um logger SEM fullAddress na lista de redação — simula a
    // regressão de alguém remover o campo de SENSITIVE_FIELDS.
    const weakenedPaths = REDACT_PATHS.filter((p) => !p.includes('fullAddress'));
    const weakSink = new MemoryStream();
    const weakLogger = pino(
      { redact: { paths: weakenedPaths, censor: '[REDACTED]' } },
      weakSink as unknown as pino.DestinationStream,
    );

    weakLogger.info({ fullAddress: 'Rua das Flores, 123' });
    const entry = firstEntry(weakSink);
    // Prova que, SEM o campo em SENSITIVE_FIELDS, o endereço vaza em claro —
    // ou seja, o teste acima (com REDACT_PATHS real) só passa PORQUE o campo
    // está presente na lista de produção.
    expect(entry.fullAddress).toBe('Rua das Flores, 123');
  });
});
