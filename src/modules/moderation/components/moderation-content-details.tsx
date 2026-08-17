import type { ModerationContentView } from '../views/moderation-content';
import { Badge } from '@/shared/ui';

/** Bloco de texto longo — SEMPRE integral (P-003): sem `truncate`/`line-clamp`/slice. */
function TextField({ label, value }: Readonly<{ label: string; value: string | null }>) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs font-medium text-fg-muted">{label}</dt>
      <dd className="whitespace-pre-wrap text-sm text-fg">{value}</dd>
    </div>
  );
}

/** Bloco curto (meta), lado a lado em telas maiores. */
function MetaField({ label, value }: Readonly<{ label: string; value: string | null }>) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs font-medium text-fg-muted">{label}</dt>
      <dd className="text-sm text-fg">{value}</dd>
    </div>
  );
}

function JobDetails({ view }: Readonly<{ view: Extract<ModerationContentView, { kind: 'JOB' }> }>) {
  return (
    <div className="flex flex-col gap-3">
      <h4 className="text-sm font-semibold text-fg">{view.title}</h4>
      <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        <MetaField label="Empresa" value={view.companyName} />
        <MetaField label="Faixa salarial" value={view.salaryRange} />
        <MetaField label="Regime" value={view.workRegime} />
        <MetaField label="Tipo de contrato" value={view.contractType} />
        <MetaField label="Escolaridade exigida" value={view.educationLevelRequired} />
        <MetaField label="Localidade" value={view.location} />
        <MetaField label="Área" value={view.area} />
        <MetaField label="Região" value={view.region} />
      </dl>
      <TextField label="Descrição" value={view.description} />
      <TextField label="Requisitos" value={view.requirements} />
    </div>
  );
}

function ServiceDetails({
  view,
}: Readonly<{ view: Extract<ModerationContentView, { kind: 'SERVICE' }> }>) {
  return (
    <div className="flex flex-col gap-3">
      <h4 className="text-sm font-semibold text-fg">{view.title}</h4>
      <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        <MetaField label="Categoria" value={view.category} />
        <MetaField label="Área de atendimento" value={view.serviceArea} />
        <MetaField label="Disponibilidade" value={view.availability} />
        <MetaField label="Faixa de preço" value={view.priceRange} />
      </dl>
      <TextField label="Descrição" value={view.description} />
      {view.photos.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-fg-muted">Fotos</span>
          <div className="flex flex-wrap gap-2">
            {view.photos.map((url) => (
              // eslint-disable-next-line @next/next/no-img-element -- URL externa do CDN público (Storage), fora dos domínios otimizáveis por next/image.
              <img
                key={url}
                src={url}
                alt="Foto do serviço"
                className="h-24 w-24 rounded-lg border border-border object-cover"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CandidateProfileDetails({
  view,
}: Readonly<{ view: Extract<ModerationContentView, { kind: 'CANDIDATE_PROFILE' }> }>) {
  return (
    <div className="flex flex-col gap-3">
      <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        <MetaField label="Headline" value={view.headline} />
        <MetaField label="Escolaridade" value={view.educationLevel} />
        <MetaField label="Área de formação" value={view.educationArea} />
      </dl>
      <TextField label="Experiência" value={view.experience} />
      <TextField label="Habilidades" value={view.skills} />
      <TextField label="Cursos" value={view.courses} />
      <div>
        <span className="text-xs font-medium text-fg-muted">Currículo</span>
        <div className="mt-1">
          {view.cvUrl ? (
            <a
              href={view.cvUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-primary underline"
            >
              Abrir CV em nova aba
            </a>
          ) : (
            <Badge variant="gray">CV não anexado</Badge>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Apresenta o {@link ModerationContentView} por `ContentKind` (USP-066 /
 * E-002..E-004). Componente **puro** (sem IO) — o carregamento é
 * responsabilidade de `ModerationContentPanel`.
 *
 * `title` (JOB/SERVICE) é renderizado como cabeçalho do bloco (correção B3
 * do review da PR #294): E-002/E-003 listam "título" entre os campos a
 * exibir, e antes disso o campo entrava no `ModerationContentView` mas só
 * aparecia no card da fila, nunca dentro do painel de conteúdo em si —
 * redundante com o card, mas fecha a lacuna com o requisito.
 *
 * Texto longo (descrição/experiência/…) é sempre renderizado **integral**
 * (`whitespace-pre-wrap`, sem `truncate`/`line-clamp`/slice — P-003). Fotos
 * de serviço vêm do CDN público; o link de CV abre em nova aba (ausente ⇒
 * nota "CV não anexado").
 */
export function ModerationContentDetails({ view }: Readonly<{ view: ModerationContentView }>) {
  switch (view.kind) {
    case 'JOB':
      return <JobDetails view={view} />;
    case 'SERVICE':
      return <ServiceDetails view={view} />;
    case 'CANDIDATE_PROFILE':
      return <CandidateProfileDetails view={view} />;
  }
}
