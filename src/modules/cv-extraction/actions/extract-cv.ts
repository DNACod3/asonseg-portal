'use server';

import { getCurrentPerson } from '@/modules/identity';
import { requireActiveConsent } from '@/modules/consents';
import { AuditEvent, withAudit } from '@/modules/audit';
import { ok, fail, type ActionResult } from '@/shared/errors';
import { childLogger } from '@/shared/lib/logger';
import { prisma } from '@/shared/lib/prisma';
import { container } from '@/shared/container';
import {
  createSupabaseStorageClient,
  STORAGE_BUCKETS,
} from '@/shared/lib/supabase/supabase-storage';
import { CV_EXTRACTOR_TOKEN, type CvExtractedFields } from '../ports/cv-extractor.port';
import { detectCvMime } from '../domain/mime';
import { startOfDaySaoPaulo, isOverDailyExtractionLimit } from '../domain/rate-limit';

export interface ExtractCvResult {
  extracted: CvExtractedFields | null;
  fromAi: boolean;
  fallback: boolean;
}

/**
 * Extração de campos do CV via IA generativa (USP-040 / CVE-02). Sequência:
 * ownership → precondição (CV enviado) → **guarda de revogação de
 * consentimento** (CVE-MN-03 — verificado de novo aqui, entre o upload e a
 * extração, ANTES de resolver/chamar o extractor) → download dos bytes →
 * `withAudit(CV_EXTRACTION_REQUESTED)` → `CVExtractor.extract` (porta —
 * nunca lança) → sucesso: `withAudit(CV_EXTRACTION_COMPLETED)` com metadados
 * de custo/tokens/duração (CVE-08, **nunca** os valores extraídos) e retorna
 * o draft **sem persistir nada** (CVE-MN-01 — só `confirmCvFields` grava);
 * falha/vazio/malformado: `withAudit(CV_EXTRACTION_FAILED)` e retorna
 * `{ extracted: null, fallback: true }` **sem lançar** (CVE-05 / CVE-MN-06).
 */
export async function extractCvFromUpload(): Promise<ActionResult<ExtractCvResult>> {
  const log = childLogger({ module: 'cv-extraction', action: 'extractCvFromUpload' });

  // 1. Ownership — Pessoa autenticada (P-002).
  const person = await getCurrentPerson();
  if (!person) {
    return fail('UNAUTHENTICATED', 'Sessão expirada. Faça login novamente.');
  }

  // 2. Precondição — CV já enviado (upload prévio bem-sucedido).
  const profile = await prisma.candidateProfile.findUnique({
    where: { personId: person.id },
    select: { cvStoragePath: true },
  });
  if (!profile?.cvStoragePath) {
    return fail('PRECONDITION_FAILED', 'Envie um currículo antes de solicitar a extração.');
  }

  // 3. Consentimento — guarda de revogação (CVE-MN-03). Checado de novo aqui
  //    (não só no upload): revogar entre upload e extração deve interromper
  //    o fluxo ANTES de resolver o extractor — o LLM nunca é chamado.
  const consent = await requireActiveConsent(person.id, 'CV_AI_EXTRACTION');
  if (!consent.active) {
    return fail(
      'CONSENT_REQUIRED',
      'É necessário aceitar o termo de extração de currículo por IA para continuar.',
    );
  }

  // 3.5 Rate limit durável de EXTRAÇÃO (CVE-07 / custo LLM): `extractCvFromUpload`
  //     é Server Action independente cujas pré-condições (sessão + CV enviado +
  //     consent) não se consomem por chamada — sem este teto, um candidato
  //     autenticado poderia invocá-la em loop e gerar chamadas Anthropic pagas
  //     ilimitadas. Conta por dia-calendário em São Paulo; a linha de tentativa
  //     é criada no tx de CV_EXTRACTION_REQUESTED (abaixo), consumindo a cota
  //     mesmo em falha/fallback da IA.
  const now = new Date();
  const extractionsToday = await prisma.cvExtractionAttempt.count({
    where: { personId: person.id, createdAt: { gte: startOfDaySaoPaulo(now) } },
  });
  if (isOverDailyExtractionLimit(extractionsToday)) {
    return fail(
      'PRECONDITION_FAILED',
      'Limite de extrações de currículo por IA atingido hoje. Tente novamente amanhã.',
    );
  }

  try {
    // 4. Download dos bytes do Storage. Falha aqui (arquivo ausente/corrompido)
    //    nunca chegou a solicitar extração — cai no mesmo fallback gracioso.
    const storage = createSupabaseStorageClient().from(STORAGE_BUCKETS.CVS);
    const downloadResult = await storage.download(profile.cvStoragePath);
    if (downloadResult.error || !downloadResult.data) {
      log.error(
        { err: downloadResult.error, personId: person.id },
        'cv-extraction:download_failed',
      );
      return ok({ extracted: null, fromAi: false, fallback: true });
    }

    const bytes = new Uint8Array(await downloadResult.data.arrayBuffer());
    const mimeType = detectCvMime(bytes);
    if (!mimeType) {
      log.error({ personId: person.id }, 'cv-extraction:download_mime_undetectable');
      return ok({ extracted: null, fromAi: false, fallback: true });
    }

    // 5. Solicitação de extração (auditoria — nunca o conteúdo do arquivo).
    await withAudit(
      AuditEvent.CV_EXTRACTION_REQUESTED,
      async (tx, audit) => {
        // Consome a cota diária na MESMA tx da auditoria da solicitação: toda
        // extração que chega a chamar o LLM (sucesso, falha ou fallback) conta.
        await tx.cvExtractionAttempt.create({ data: { personId: person.id } });
        audit.entityType = 'candidate_profile';
        audit.entityId = person.id;
      },
      { actorPersonId: person.id, context: { route: '/candidato' } },
    );

    // 6. Extração via porta — contrato: nunca lança.
    const extractor = container.resolve(CV_EXTRACTOR_TOKEN);
    const result = await extractor.extract({ content: bytes, mimeType });

    if (!result.ok) {
      await withAudit(
        AuditEvent.CV_EXTRACTION_FAILED,
        async (_tx, audit) => {
          audit.entityType = 'candidate_profile';
          audit.entityId = person.id;
          audit.after = { reason: result.reason };
        },
        { actorPersonId: person.id, context: { route: '/candidato' } },
      );
      log.info({ personId: person.id, reason: result.reason }, 'cv-extraction:extraction_failed');
      return ok({ extracted: null, fromAi: false, fallback: true });
    }

    // 7. Sucesso — metadados de custo/tokens/duração (CVE-08); NUNCA os
    //    valores extraídos (PII) na auditoria; NUNCA persiste (CVE-MN-01).
    await withAudit(
      AuditEvent.CV_EXTRACTION_COMPLETED,
      async (_tx, audit) => {
        audit.entityType = 'candidate_profile';
        audit.entityId = person.id;
        audit.after = {
          inputTokens: result.usage.inputTokens,
          outputTokens: result.usage.outputTokens,
          durationMs: result.usage.durationMs,
          estimatedCostUsd: result.usage.estimatedCostUsd,
          model: result.usage.model,
        };
      },
      { actorPersonId: person.id, context: { route: '/candidato' } },
    );

    log.info({ personId: person.id }, 'cv-extraction:extracted');
    return ok({ extracted: result.fields, fromAi: true, fallback: false });
  } catch (err) {
    // Falha de infraestrutura (Storage/DB) — distinta do fallback gracioso da
    // IA: aqui é a própria plataforma que falhou, não a extração best-effort.
    log.error({ err, personId: person.id }, 'cv-extraction:extract_unexpected_error');
    return fail('INTERNAL', 'Não foi possível processar o currículo agora. Tente novamente.');
  }
}
