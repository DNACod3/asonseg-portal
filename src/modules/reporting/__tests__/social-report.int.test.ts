import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Integração de `viewSocialReport` (T10 — E-001/REL42-MN-05, ADR-0022,
 * AC-042/relatório social). Requer Postgres local. Cobre as 2 barreiras de
 * privacidade: B1 (SELECT condicional ao papel) e B2 (strip estrutural no
 * tipo) — espelha `view-person-for-social-assistant.int.test.ts` (USP-039).
 */

const { prisma } = await import('@/shared/lib/prisma');
const { viewSocialReport } = await import('../views/social-report.view');

const hasDb = Boolean(process.env.DATABASE_URL);

const NAME_PREFIX = 'ReportSocialInt';
const REGION_NAME = `${NAME_PREFIX} Região`;
const SOCIAL_BENEFIT_MARKER = `${NAME_PREFIX} Bolsa Família`;
const FAMILY_COMPOSITION_MARKER = `${NAME_PREFIX} 4 pessoas`;

async function cleanup(): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET LOCAL app.audit_purge = 'on'");
    await tx.$executeRawUnsafe(
      `DELETE FROM audit_log WHERE context ->> 'via' = 'social_report' AND actor_person_id IN (SELECT id FROM persons WHERE full_name LIKE '${NAME_PREFIX}%')`,
    );
  });
  await prisma.socioeconomicRecord.deleteMany({ where: { person: { fullName: { startsWith: NAME_PREFIX } } } });
  await prisma.candidateProfile.deleteMany({ where: { person: { fullName: { startsWith: NAME_PREFIX } } } });
  await prisma.person.deleteMany({ where: { fullName: { startsWith: NAME_PREFIX } } });
  await prisma.region.deleteMany({ where: { name: REGION_NAME } });
}

describe.skipIf(!hasDb)('USP-042/T10 — viewSocialReport (integração)', () => {
  let region: { id: string };
  let asPersonId: string;
  let coordPersonId: string;

  beforeAll(async () => {
    await cleanup();

    region = await prisma.region.create({
      data: { name: REGION_NAME, cityName: 'Cidade Teste', state: 'SC' },
      select: { id: true },
    });

    const target = await prisma.person.create({
      data: { fullName: `${NAME_PREFIX} Titular`, status: 'ATIVO' },
      select: { id: true },
    });
    await prisma.candidateProfile.create({
      data: { personId: target.id, regionId: region.id },
    });
    await prisma.socioeconomicRecord.create({
      data: {
        personId: target.id,
        incomeBracket: 'UP_TO_1_MW',
        housingSituation: 'RENTED',
        socialBenefit: SOCIAL_BENEFIT_MARKER,
        familyComposition: FAMILY_COMPOSITION_MARKER,
      },
    });

    const asActor = await prisma.person.create({
      data: { fullName: `${NAME_PREFIX} AS Actor`, status: 'ATIVO' },
      select: { id: true },
    });
    asPersonId = asActor.id;
    const coordActor = await prisma.person.create({
      data: { fullName: `${NAME_PREFIX} Coord Actor`, status: 'ATIVO' },
      select: { id: true },
    });
    coordPersonId = coordActor.id;
  });

  afterAll(async () => {
    await cleanup();
  });

  it('viewer sem canViewSocialReports E sem canViewOperationalReports (VOLUNTEER) → null', async () => {
    const report = await viewSocialReport(
      { regionId: region.id },
      { roles: ['VOLUNTEER'], personId: coordPersonId },
    );
    expect(report).toBeNull();
  });

  it('AS: scope=full, sensível agregado por região presente, com SENSITIVE_FIELD_VIEWED auditado', async () => {
    const auditBefore = await prisma.auditLog.count({
      where: { action: 'SENSITIVE_FIELD_VIEWED', actorPersonId: asPersonId },
    });

    const report = await viewSocialReport(
      { regionId: region.id },
      { roles: ['SOCIAL_ASSISTANT'], personId: asPersonId },
    );

    expect(report).not.toBeNull();
    expect(report?.scope).toBe('full');
    expect(report?.sensitive).not.toBeNull();
    const regionEntry = report?.sensitive?.find((s) => s.regionId === region.id);
    expect(regionEntry?.byIncomeBracket.UP_TO_1_MW).toBe(1);
    expect(regionEntry?.byHousingSituation.RENTED).toBe(1);
    expect(regionEntry?.withSocialBenefit).toBe(1);
    expect(regionEntry?.withFamilyCompositionDeclared).toBe(1);

    const auditAfter = await prisma.auditLog.count({
      where: { action: 'SENSITIVE_FIELD_VIEWED', actorPersonId: asPersonId },
    });
    expect(auditAfter - auditBefore).toBe(1);
  });

  it('REL42-MN-05 (negativo, B2): COORDENADOR → scope=stripped, sensitive=null, NENHUM valor sensível serializado, SEM audit', async () => {
    const auditBefore = await prisma.auditLog.count({
      where: { action: 'SENSITIVE_FIELD_VIEWED', actorPersonId: coordPersonId },
    });

    const report = await viewSocialReport(
      { regionId: region.id },
      { roles: ['COORDINATOR'], personId: coordPersonId },
    );

    expect(report).not.toBeNull();
    expect(report?.scope).toBe('stripped');
    // B2 — barreira estrutural no tipo: `sensitive` é `null`, não um array vazio.
    expect(report?.sensitive).toBeNull();
    // O agregado stripped ainda existe (contagem por região é permitida ao coordenador).
    expect(report?.regions.some((r) => r.regionId === region.id && r.total >= 1)).toBe(true);

    // Nenhum valor sensível (renda/moradia/benefício/composição) aparece no payload serializado.
    const serialized = JSON.stringify(report);
    expect(serialized).not.toContain('UP_TO_1_MW');
    expect(serialized).not.toContain('RENTED');
    expect(serialized).not.toContain(SOCIAL_BENEFIT_MARKER);
    expect(serialized).not.toContain(FAMILY_COMPOSITION_MARKER);

    const auditAfter = await prisma.auditLog.count({
      where: { action: 'SENSITIVE_FIELD_VIEWED', actorPersonId: coordPersonId },
    });
    expect(auditAfter - auditBefore).toBe(0);
  });

  it('BOARD (mesmo sem ser SOCIAL_ASSISTANT) também recebe scope=full — BOARD está em ambos os guards', async () => {
    const report = await viewSocialReport({ regionId: region.id }, { roles: ['BOARD'], personId: asPersonId });
    expect(report?.scope).toBe('full');
  });
});
