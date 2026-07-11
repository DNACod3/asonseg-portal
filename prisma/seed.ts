import { PrismaClient } from '@prisma/client';
import { seedReference } from './seeds/reference';
import { seedDemo } from './seeds/demo';
import { seedBulk } from './seeds/bulk';

/**
 * Entrypoint do seed (`npm run db:seed` / `prisma db seed`, F0A-03).
 *
 * Fino por design: orquestra os seeds separados por responsabilidade —
 * `seeds/reference.ts` (taxonomia idempotente, prod-safe, roda sempre),
 * `seeds/demo.ts` (fixtures de E2E/dev) e `seeds/bulk.ts` (20-30 registros de
 * cada cadastro + contas login-áveis, para validação em dev e staging).
 */

const prisma = new PrismaClient();

/**
 * Ambiente é **produção**? Fail-closed. `NODE_ENV` NÃO serve para distinguir
 * staging de produção (staging também builda com `NODE_ENV=production`) — o
 * discriminador confiável é `SENTRY_ENVIRONMENT` (`development|staging|production`,
 * ver `shared/env.ts`). Além disso, tratamos como produção qualquer
 * `NODE_ENV=production` SEM o marcador explícito de staging — assim um
 * `prisma db seed` avulso contra um DATABASE_URL de prod (sem SENTRY_ENVIRONMENT)
 * é barrado, não liberado.
 */
function isProductionEnv(): boolean {
  const sentryEnv = process.env.SENTRY_ENVIRONMENT;
  if (sentryEnv === 'production') return true;
  if (process.env.VERCEL_ENV === 'production') return true;
  return process.env.NODE_ENV === 'production' && sentryEnv !== 'staging';
}

async function main(): Promise<void> {
  const reference = await seedReference(prisma);
  console.log('Seed de referência concluído (idempotente):');
  console.log(`  regions:            ${reference.regions}`);
  console.log(`  job_areas:          ${reference.jobAreas}`);
  console.log(`  service_categories: ${reference.serviceCategories}`);
  console.log(`  verification_checklist_items: ${reference.verificationChecklistItems}`);

  // Gate do seed de demo/volume — **fail-closed** (F0C-02 / hardening de segurança).
  // O demo/bulk injetam Empresas `isVerified: true` com vagas ACTIVE (visíveis em
  // `/vagas`) e contas login-áveis com senha fixa — inaceitável em produção. Duplo
  // lock: (1) opt-in explícito `SEED_DEMO=1` (o script `npm run db:seed` já define);
  // (2) `!isProductionEnv()` (dev + staging apenas — ver `isProductionEnv`). Sem a
  // flag, ou em produção → tudo é pulado.
  const optedIntoDemo = process.env.SEED_DEMO === '1';
  const isProduction = isProductionEnv();

  if (optedIntoDemo && !isProduction) {
    const demo = await seedDemo(prisma);
    console.log('Seed de demo concluído (idempotente, fixtures de E2E/dev):');
    console.log(`  demo_jobs (ACTIVE): ${demo.demoJobs}`);
    console.log(`  demo_applications:  ${demo.demoApplications}`);
    console.log(`  demo_candidate_profiles (ACTIVE): ${demo.demoCandidateProfiles}`);
    console.log(`  demo_services (ACTIVE): ${demo.demoServices}`);

    const bulk = await seedBulk(prisma);
    console.log('Seed de volume concluído (idempotente, dev/staging — senha fixa 12345678):');
    console.log(`  pessoas login-áveis:     ${bulk.people}`);
    console.log(`  empresas:                ${bulk.companies}`);
    console.log(`  vagas:                   ${bulk.jobs}`);
    console.log(`  serviços:                ${bulk.services}`);
    console.log(`  candidaturas:            ${bulk.applications}`);
    console.log(`  manif. de interesse:     ${bulk.serviceInterests}`);
    console.log(`  encaminhamentos:         ${bulk.referrals}`);
    console.log(`  fichas socioeconômicas:  ${bulk.socioeconomicRecords}`);
    console.log(`  reivind. de credencial:  ${bulk.credentialClaims}`);
    console.log(`  permissões delegadas:    ${bulk.delegatedPermissions}`);
  } else if (isProduction) {
    console.log('Ambiente de produção — seed de demo/volume pulado (dev/staging apenas).');
  } else {
    console.log('SEED_DEMO!=1 — seed de demo/volume pulado (defina SEED_DEMO=1 para incluí-lo).');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
