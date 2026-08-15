import type { ContentKind } from '../domain/content-status';

/**
 * Conteúdo integral de um item da fila de moderação (USP-066 / E-002..E-004).
 *
 * Union discriminada por `ContentKind` — cada variante espelha "como será
 * publicado" (sem anonimização de papel: o moderador vê o rascunho integral,
 * ao contrário de `viewJobDetail`/`viewServiceDetail`, que anonimizam para o
 * visitante). Tipo **puro** (sem IO): a leitura real é responsabilidade dos
 * adapters por `ContentKind` (`ContentModerationReader`), resolvidos no
 * container.
 */
export type ModerationContentView =
  | {
      kind: 'JOB';
      title: string;
      description: string | null;
      requirements: string | null;
      salaryRange: string | null;
      workRegime: string | null;
      contractType: string | null;
      educationLevelRequired: string | null;
      location: string | null;
      area: string | null;
      region: string | null;
      companyName: string | null;
    }
  | {
      kind: 'SERVICE';
      title: string;
      description: string | null;
      category: string | null;
      serviceArea: string | null;
      availability: string | null;
      priceRange: string | null;
      photos: string[];
    }
  | {
      kind: 'CANDIDATE_PROFILE';
      headline: string | null;
      educationLevel: string | null;
      educationArea: string | null;
      experience: string | null;
      skills: string | null;
      courses: string | null;
      /** URL assinada do CV (TTL 300s — E-004), ou `null` se ausente/indisponível. */
      cvUrl: string | null;
    };

/** `ContentKind` que hoje têm reader registrado (para narrowing em consumidores). */
export type ModerationContentKind = ModerationContentView['kind'];

// Reexport de conveniência — evita import duplicado de `ContentKind` só p/ tipar.
export type { ContentKind };
