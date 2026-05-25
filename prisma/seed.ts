import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Seed mínimo da Fase 0. Os seeds de domínio (regiões, categorias, áreas — D-007)
 * serão adicionados pelos módulos correspondentes nas tasks seguintes.
 */
async function main() {
  await prisma.healthCheck.create({ data: {} });
  console.log('Seed concluído: HealthCheck inserido.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
