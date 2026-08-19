/**
 * Provisionamento idempotente dos buckets de Storage em ambiente **hospedado**
 * (staging/produção) — PF-001 (`docs/qualidade/pontos-falhos-processo.md`).
 *
 *   npm run storage:ensure:staging
 *   npm run storage:ensure:prod
 *
 * Por que existe: `supabase/config.toml` declara os buckets de forma
 * declarativa, mas isso só vale para a stack **local** do CLI. Projeto
 * hospedado não lê `config.toml`, e o passo equivalente era manual (Studio,
 * DoD da task #97 em `docs/infra/supabase.md`). Como todo projeto novo nasce
 * sem bucket, o upload de CV falhava em staging com "Não foi possível enviar o
 * currículo" (ramo de erro de `upload-cv.ts`).
 *
 * Fonte de verdade das specs: `STORAGE_BUCKET_SPECS` (ADR-0005). O script cria
 * o que falta e corrige o que divergiu (visibilidade, limite, MIMEs) — nunca
 * apaga bucket nem objeto, então é seguro rodar quantas vezes quiser.
 *
 * A comparação de drift (`drift`/`bucketOptions`) vive em
 * `shared/lib/supabase/storage-buckets.ts` (correção B5/PR#294 — lá é pura e
 * testável; aqui, junto de `requireEnv`/`createClient`, não dava para
 * alcançá-la por teste). Este arquivo fica só com env + orquestração.
 *
 * Usa `@supabase/supabase-js` direto (não o client do app, que depende de
 * `next/headers` e não roda fora de um request do Next).
 */
import { createClient } from '@supabase/supabase-js';
import {
  STORAGE_BUCKET_SPECS,
  bucketOptions,
  drift,
  type RemoteStorageBucket,
} from '../src/shared/lib/supabase/storage-buckets';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Variável ${name} ausente. Rode via npm run storage:ensure:staging (dotenv -e .env.staging).`,
    );
  }
  return value;
}

const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

const storage = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
}).storage;

async function main(): Promise<void> {
  console.log(`Storage: ${supabaseUrl}`);

  const { data: existing, error: listError } = await storage.listBuckets();
  if (listError) throw listError;

  const byName = new Map((existing as RemoteStorageBucket[]).map((b) => [b.name, b]));
  console.log(
    `Buckets existentes: ${existing.length ? existing.map((b) => b.name).join(', ') : '(nenhum)'}\n`,
  );

  let created = 0;
  let updated = 0;

  for (const spec of STORAGE_BUCKET_SPECS) {
    const remote = byName.get(spec.name);

    if (!remote) {
      const { error } = await storage.createBucket(spec.name, bucketOptions(spec));
      if (error) throw new Error(`criar ${spec.name}: ${error.message}`);
      console.log(`  ✓ criado   ${spec.name} (public=${spec.public}, ${spec.fileSizeLimit} bytes)`);
      created++;
      continue;
    }

    const diffs = drift(remote, spec);
    if (diffs.length === 0) {
      console.log(`  = ok       ${spec.name}`);
      continue;
    }

    const { error } = await storage.updateBucket(spec.name, bucketOptions(spec));
    if (error) throw new Error(`ajustar ${spec.name}: ${error.message}`);
    console.log(`  ✓ ajustado ${spec.name} — ${diffs.join('; ')}`);
    updated++;
  }

  console.log(`\nConcluído: ${created} criado(s), ${updated} ajustado(s).`);
}

main().catch((e) => {
  console.error('Falha ao provisionar buckets:', e instanceof Error ? e.message : e);
  process.exit(1);
});
