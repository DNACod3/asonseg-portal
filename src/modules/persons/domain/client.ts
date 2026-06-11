import type { Role } from '@prisma/client';

export function decideClientActivation(currentRoles: Role[]): { needsActivation: boolean } {
  return { needsActivation: !currentRoles.includes('CLIENT') };
}
