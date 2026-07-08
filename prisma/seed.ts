import { PrismaClient } from '@prisma/client';
import { seedReference } from './seeds/reference';
import { seedDemo } from './seeds/demo';

/**
 * Entrypoint do seed (`npm run db:seed` / `prisma db seed`, F0A-03).
 *
 * Fino por design: orquestra os dois seeds separados por responsabilidade —
 * `seeds/reference.ts` (taxonomia idempotente, prod-safe, roda sempre) e
 * `seeds/demo.ts` (vagas/candidaturas fictícias, dev-only — nunca em produção).
 */

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const reference = await seedReference(prisma);
  console.log('Seed de referência concluído (idempotente):');
  console.log(`  regions:            ${reference.regions}`);
  console.log(`  job_areas:          ${reference.jobAreas}`);
  console.log(`  service_categories: ${reference.serviceCategories}`);
  console.log(`  verification_checklist_items: ${reference.verificationChecklistItems}`);

  // Gate do seed de demo — **fail-closed** (F0C-02 / hardening de segurança).
  // O demo injeta uma Empresa `isVerified: true` com vagas ACTIVE (visíveis em
  // `/vagas`) — exatamente a "empresa-fantasma" que a plataforma existe para
  // impedir. Por isso NÃO basta `NODE_ENV !== 'production'`: com `NODE_ENV`
  // indefinido (caso comum de um `prisma db seed` avulso contra um DATABASE_URL
  // de prod) aquele guard rodava o demo. Agora exige opt-in explícito
  // (`SEED_DEMO=1`, que o script `npm run db:seed` já define) e ainda assim
  // bloqueia em produção. Sem a flag → demo pulado.
  const optedIntoDemo = process.env.SEED_DEMO === '1';
  const isProduction = process.env.NODE_ENV === 'production';

  if (optedIntoDemo && !isProduction) {
    const demo = await seedDemo(prisma);
    console.log('Seed de demo concluído (idempotente, dev-only):');
    console.log(`  demo_jobs (ACTIVE): ${demo.demoJobs}`);
    console.log(`  demo_applications:  ${demo.demoApplications}`);
    console.log(`  demo_candidate_profiles (ACTIVE): ${demo.demoCandidateProfiles}`);
  } else if (isProduction) {
    console.log('NODE_ENV=production — seed de demo pulado (dev-only).');
  } else {
    console.log('SEED_DEMO!=1 — seed de demo pulado (defina SEED_DEMO=1 para incluí-lo).');
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
