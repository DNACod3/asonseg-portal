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

  if (process.env.NODE_ENV !== 'production') {
    const demo = await seedDemo(prisma);
    console.log('Seed de demo concluído (idempotente, dev-only):');
    console.log(`  demo_jobs (ACTIVE): ${demo.demoJobs}`);
    console.log(`  demo_applications:  ${demo.demoApplications}`);
  } else {
    console.log('NODE_ENV=production — seed de demo pulado (dev-only).');
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
