// Barrel do módulo `moderation` (USP-016 / ADR-0011).
// Todos os imports externos passam por aqui — nunca por caminhos profundos.

// ── Máquina de estados (domínio puro, #121) ──────────────────────────────────
export {
  ContentStatus,
  ContentKind,
  TRANSITIONS,
} from './domain/content-status';
export type { TransitionTrigger, TransitionRule } from './domain/content-status';
export {
  findTransition,
  isValidTransition,
  requiresJustification,
} from './domain/transition-rules';
