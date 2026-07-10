/**
 * Catálogo puro das métricas de produto MP1..MP10 (PRD §4 "Métricas de
 * Produto"). Fundação compartilhada entre USP-041 (home pública — consome
 * MP1/MP2/MP4) e USP-042 (relatórios operacionais — preenche o restante).
 *
 * Sem IO: apenas descritores estáticos (id/label/unidade). A resolução de
 * *como* cada métrica é calculada (query Prisma) vive em `queries/`, não
 * aqui — este arquivo nunca importa Prisma/runtime.
 */

/** Unidade de exibição de uma métrica de produto. */
export type MetricUnit = 'count' | 'percent' | 'hours';

export type MetricId =
  | 'MP1'
  | 'MP2'
  | 'MP3'
  | 'MP4'
  | 'MP5'
  | 'MP6'
  | 'MP7'
  | 'MP8'
  | 'MP9'
  | 'MP10';

export interface MetricDescriptor {
  readonly id: MetricId;
  readonly label: string;
  readonly unit: MetricUnit;
}

/**
 * Catálogo MP1..MP10 (labels verbatim do PRD §4). Metas absolutas (QP-007/
 * D-004) não confirmadas com o sponsor — o catálogo descreve o QUE é medido,
 * não uma meta (ASSUMP-U1-01, design.md §6).
 */
export const MP: Readonly<Record<MetricId, MetricDescriptor>> = {
  MP1: {
    id: 'MP1',
    label: 'Nº de candidatos com perfil ativo (moderado)',
    unit: 'count',
  },
  MP2: {
    id: 'MP2',
    label: 'Nº de empresas verificadas (com ao menos 1 vaga aprovada)',
    unit: 'count',
  },
  MP3: {
    id: 'MP3',
    label: 'Nº de prestadores ativos com ao menos 1 serviço aprovado',
    unit: 'count',
  },
  MP4: {
    id: 'MP4',
    label: 'Nº acumulado de vagas publicadas e aprovadas',
    unit: 'count',
  },
  MP5: {
    id: 'MP5',
    label: 'Nº acumulado de serviços publicados e aprovados',
    unit: 'count',
  },
  MP6: {
    id: 'MP6',
    label: 'Nº de candidaturas realizadas',
    unit: 'count',
  },
  MP7: {
    id: 'MP7',
    label: 'Nº de manifestações de interesse em serviços',
    unit: 'count',
  },
  MP8: {
    id: 'MP8',
    label: 'Nº de encaminhamentos ASONSEG criados',
    unit: 'count',
  },
  MP9: {
    id: 'MP9',
    label: '% de encaminhamentos com resultado registrado positivo (contratado)',
    unit: 'percent',
  },
  MP10: {
    id: 'MP10',
    label: 'Tempo médio de moderação (envio → decisão do coordenador)',
    unit: 'hours',
  },
};
