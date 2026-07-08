'use server';

import { createHash, randomUUID } from 'node:crypto';
import { headers } from 'next/headers';
import { getCurrentPerson } from '@/modules/identity';
import { requireActiveConsent } from '@/modules/consents';
import { AuditEvent, withAudit } from '@/modules/audit';
import { ok, fail, type ActionResult } from '@/shared/errors';
import { childLogger } from '@/shared/lib/logger';
import { clientIp } from '@/shared/lib/clientIp';
import { prisma } from '@/shared/lib/prisma';
import {
  createSupabaseStorageClient,
  STORAGE_BUCKETS,
} from '@/shared/lib/supabase/supabase-storage';
import { detectCvMime, isWithinCvSizeLimit, type CvMimeType } from '../domain/mime';
import { startOfDaySaoPaulo, isOverDailyLimit } from '../domain/rate-limit';
import { parseCvUploadFormData } from '../schemas/upload-cv-file.schema';

export interface UploadCvResult {
  uploaded: true;
}

const CONTENT_TYPE_BY_MIME: Record<CvMimeType, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

/**
 * Upload de CV (USP-040 / CVE-01). Sequência sensível completa: Zod(file) →
 * ownership → precondição (papel candidato) → consentimento `CV_AI_EXTRACTION`
 * → MIME real + tamanho (CVE-MN-02) → rate limit diário (CVE-MN-04) → storage
 * → `withAudit(CV_UPLOADED)`. Arquivo inválido, consentimento ausente/revogado
 * ou limite diário atingido bloqueiam **antes** de tocar o Storage — nunca
 * armazena nem invoca a extração nesses caminhos. Nunca lança.
 */
export async function uploadCv(formData: FormData): Promise<ActionResult<UploadCvResult>> {
  const log = childLogger({ module: 'cv-extraction', action: 'uploadCv' });

  // 1. Validação de input: presença/tipo do File.
  const parsedFile = parseCvUploadFormData(formData);
  if (!parsedFile.success) {
    return fail('VALIDATION', 'Selecione um arquivo de CV.');
  }
  const { file } = parsedFile.data;

  // 2. Ownership — Pessoa autenticada da sessão (P-002, sem personId no input).
  const person = await getCurrentPerson();
  if (!person) {
    return fail('UNAUTHENTICATED', 'Sessão expirada. Faça login novamente.');
  }

  // 3. Precondição: papel candidato já ativo (perfil existe).
  const profile = await prisma.candidateProfile.findUnique({
    where: { personId: person.id },
    select: { personId: true },
  });
  if (!profile) {
    return fail(
      'PRECONDITION_FAILED',
      'Conclua o cadastro de candidato antes de enviar o currículo.',
    );
  }

  // 4. Consentimento LGPD (CVE-06) — antes de qualquer processamento do arquivo.
  const consent = await requireActiveConsent(person.id, 'CV_AI_EXTRACTION');
  if (!consent.active) {
    return fail(
      'CONSENT_REQUIRED',
      'É necessário aceitar o termo de extração de currículo por IA para continuar.',
    );
  }

  // 5. MIME real + tamanho (CVE-01 / CVE-MN-02) — nunca a extensão do nome do
  //    arquivo. Rejeitado aqui: sem storage, sem LLM.
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!isWithinCvSizeLimit(bytes.byteLength)) {
    return fail('VALIDATION', 'O arquivo excede o limite de 5MB.');
  }
  const mimeType = detectCvMime(bytes);
  if (!mimeType) {
    return fail('VALIDATION', 'Arquivo inválido. Envie um currículo em PDF, DOC ou DOCX.');
  }

  // 6. Rate limit diário (CVE-07 / CVE-MN-04) — dia-calendário em São Paulo.
  //    Só uploads válidos chegam até aqui, então a contagem já reflete só tentativas legítimas.
  const now = new Date();
  const attemptsToday = await prisma.cvUploadAttempt.count({
    where: { personId: person.id, createdAt: { gte: startOfDaySaoPaulo(now) } },
  });
  if (isOverDailyLimit(attemptsToday)) {
    return fail(
      'PRECONDITION_FAILED',
      'Limite de 3 uploads de currículo por dia atingido. Tente novamente amanhã.',
    );
  }

  // 7. Storage — path determinístico por Pessoa (ADR-0005), relativo ao bucket
  //    `cvs` (já selecionado por `.from(STORAGE_BUCKETS.CVS)` abaixo) — sem o
  //    prefixo do nome do bucket (mesma convenção de `cvStoragePath` já usada
  //    por outras USPs, ex.: `listJobApplicants`/USP-027).
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const storagePath = `${person.id}/${randomUUID()}.${mimeType}`;
  const storage = createSupabaseStorageClient().from(STORAGE_BUCKETS.CVS);
  const uploadResult = await storage.upload(storagePath, Buffer.from(bytes), {
    contentType: CONTENT_TYPE_BY_MIME[mimeType],
  });
  if (uploadResult.error) {
    log.error(
      { err: uploadResult.error, personId: person.id },
      'cv-extraction:upload_storage_failed',
    );
    return fail('INTERNAL', 'Não foi possível enviar o currículo. Tente novamente.');
  }

  const hdrs = await headers();
  const rawIp = clientIp(hdrs);
  const ip = rawIp === 'unknown' ? null : rawIp;
  const userAgent = hdrs.get('user-agent') ?? null;

  // 8. Auditoria + persistência (só depois do Storage confirmar sucesso).
  try {
    await withAudit(
      AuditEvent.CV_UPLOADED,
      async (tx, audit) => {
        await tx.cvUploadAttempt.create({ data: { personId: person.id } });
        await tx.candidateProfile.update({
          where: { personId: person.id },
          data: {
            cvStoragePath: storagePath,
            cvSha256: sha256,
            cvUploadedAt: new Date(),
          },
        });

        audit.entityType = 'candidate_profile';
        audit.entityId = person.id;
        audit.after = { cvStoragePath: storagePath, mimeType };
      },
      { actorPersonId: person.id, ip, userAgent, context: { route: '/candidato' } },
    );

    log.info({ personId: person.id }, 'cv-extraction:uploaded');
    return ok({ uploaded: true });
  } catch (err) {
    log.error({ err, personId: person.id }, 'cv-extraction:upload_audit_failed');
    return fail('INTERNAL', 'Não foi possível salvar o currículo. Tente novamente.');
  }
}
