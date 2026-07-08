/**
 * View Model do cliente para o prestador dono do serviço (USP-035 — AC-035-2).
 * Espelha `view-candidate-for-employer.ts` (empregador vê candidatos, AD-018):
 * projeta **só** nome+contato+data+serviço — `cpf`/`birthDate`/`fullAddress`
 * NUNCA entram no shape (o recorte real acontece no `select` de
 * `list-provider-interests.ts`; este serializer só projeta o shape, SVC035-MN-02).
 *
 * Único ponto de projeção; o componente consome só o View Model, nunca linhas
 * Prisma (AC-035-2).
 */

/** Shape mínimo que o serializer consome — SEM `cpf`/`birthDate`/`fullAddress`. */
export interface ProviderInterestRow {
  interestId: string;
  clientName: string;
  phone: string | null;
  email: string | null;
  interestedAt: Date;
  service: { id: string; title: string };
}

export interface ProviderInterestView {
  interestId: string;
  clientName: string;
  contact: { phone: string | null; email: string | null };
  interestedAt: Date;
  service: { id: string; title: string };
}

export function viewClientForProvider(row: ProviderInterestRow): ProviderInterestView {
  return {
    interestId: row.interestId,
    clientName: row.clientName,
    contact: { phone: row.phone, email: row.email },
    interestedAt: row.interestedAt,
    service: row.service,
  };
}
