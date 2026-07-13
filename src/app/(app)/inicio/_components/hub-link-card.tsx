import Link from 'next/link';
import { Card } from '@/shared/ui';
import type { HubLink } from '@/modules/identity';

/**
 * Cartão de um atalho do hub `/inicio` (USP-049 — HUB-01). Apresentação pura,
 * tokens-only (DS-MN-01) — recebe um `HubLink` já validado por `buildHubLinks`
 * (HUB-MN-01/02).
 */
export function HubLinkCard({ link }: { link: HubLink }) {
  return (
    <Link href={link.href} className="block">
      <Card className="h-full transition-colors hover:border-primary">
        <p className="font-heading text-base font-semibold text-fg">{link.label}</p>
        <p className="mt-1 text-sm text-fg-muted">{link.description}</p>
      </Card>
    </Link>
  );
}
