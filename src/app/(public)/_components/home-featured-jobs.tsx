import { Badge, Card, cn } from '@/shared/ui';

/**
 * USP-047 (T2, HOME-04/HOME-14). Stack de cards de destaque de vaga do
 * hero-visual, fiéis ao protótipo (`docs/prototipo/index.html` L873-900):
 * ícone + título + empresa + tags. Server Component estático — conteúdo
 * default é mock (paridade visual); a seam `jobs?` deixa a USP-048 injetar
 * dados vivos sem reescrever o componente (A-07).
 */
export interface FeaturedJob {
  title: string;
  company: string;
  tags?: string[];
  iconVariant?: 'blue' | 'orange';
}

const DEFAULT_JOBS: FeaturedJob[] = [
  {
    title: 'Auxiliar Administrativo',
    company: 'Supermercado Angeloni - CLT',
    tags: ['Administrativa', 'CLT'],
    iconVariant: 'blue',
  },
  {
    title: 'Técnico em Enfermagem',
    company: 'Clínica São Lucas - CLT',
    iconVariant: 'orange',
  },
];

const TAG_BADGE_VARIANTS: Array<'blue' | 'green'> = ['blue', 'green'];

function JobIcon({ variant = 'blue' }: { variant?: 'blue' | 'orange' }) {
  return (
    <div
      className={cn(
        'flex h-12 w-12 shrink-0 items-center justify-center rounded-lg',
        variant === 'blue' ? 'bg-primary/10 text-primary' : 'bg-cta/10 text-cta',
      )}
    >
      <svg
        aria-hidden="true"
        width="24"
        height="24"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="2"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 0 0 .75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 0 0-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0 1 12 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 0 1-.673-.38m0 0A2.18 2.18 0 0 1 3 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 0 1 3.413-.387m7.5 0V5.25A2.25 2.25 0 0 0 13.5 3h-3a2.25 2.25 0 0 0-2.25 2.25v.894m7.5 0a48.667 48.667 0 0 0-7.5 0"
        />
      </svg>
    </div>
  );
}

export interface HomeFeaturedJobsProps {
  jobs?: FeaturedJob[];
  className?: string;
}

export function HomeFeaturedJobs({ jobs = DEFAULT_JOBS, className }: HomeFeaturedJobsProps) {
  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {jobs.map((job) => (
        <Card key={job.title} className="flex items-start gap-4">
          <JobIcon variant={job.iconVariant} />
          <div className="flex flex-col gap-1">
            <h4 className="font-heading font-bold text-fg">{job.title}</h4>
            <p className="text-sm text-fg-muted">{job.company}</p>
            {job.tags && job.tags.length > 0 ? (
              <div className="mt-1 flex flex-wrap gap-2">
                {job.tags.map((tag, index) => (
                  <Badge key={tag} variant={TAG_BADGE_VARIANTS[index % TAG_BADGE_VARIANTS.length]}>
                    {tag}
                  </Badge>
                ))}
              </div>
            ) : null}
          </div>
        </Card>
      ))}
    </div>
  );
}
