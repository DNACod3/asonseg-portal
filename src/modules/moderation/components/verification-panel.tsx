'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  VERIFICATION_CHECKLIST_ITEMS,
  type VerificationChecklistItem,
} from '../domain/verification-checklist';
import { Input } from '@/shared/ui';

/** Linha de rejeição já formatada pelo Server Component (data em fuso de SP). */
export interface VerificationRejectionRow {
  rejectedAtLabel: string;
  byName: string | null;
  reason: string | null;
}

/** Dados da Empresa para o painel de verificação, prontos para render (E-001/E-004/D-006). */
export interface VerificationPanelData {
  companyId: string;
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  setor: string;
  endereco: string | null;
  isVerified: boolean;
  verifiedAtLabel: string | null;
  verifiedByName: string | null;
  rejectionCount: number;
  /** Campos alterados desde a verificação anterior (D-006) — chaves do snapshot. */
  changedSinceVerification: string[];
  rejections: VerificationRejectionRow[];
}

const FIELD_LABELS: Record<string, string> = {
  cnpj: 'CNPJ',
  razaoSocial: 'Razão social',
  nomeFantasia: 'Nome fantasia',
  setor: 'Setor',
  endereco: 'Endereço',
};

interface ChecklistState {
  checked: boolean;
  dismissed: boolean;
  reason: string;
}

function initialChecklist(items: readonly VerificationChecklistItem[]): Record<string, ChecklistState> {
  return Object.fromEntries(
    items.map((i) => [i.id, { checked: false, dismissed: false, reason: '' }]),
  );
}

/** Um item da checklist está resolvido se marcado OU dispensado com motivo. */
function isItemResolved(s: ChecklistState): boolean {
  return s.checked || (s.dismissed && s.reason.trim().length > 0);
}

const EMPTY_ITEM: ChecklistState = { checked: false, dismissed: false, reason: '' };

/**
 * Painel de verificação da Empresa (USP-017 — bloco "Verificação da Empresa",
 * separado da "Decisão da vaga" — P-002/AD-6).
 *
 *  - Empresa já verificada (E-004): só "verificada em DD/MM por Nome", sem checklist.
 *  - Empresa não verificada (E-001): banner de 1ª vaga/edição, dados em destaque,
 *    diff dos campos alterados desde a última verificação (D-006), histórico de
 *    rejeições (P-003/D-005) e a checklist interativa (P-001). A aprovação só é
 *    liberada quando todos os itens estão marcados ou dispensados com motivo —
 *    o estado de prontidão é reportado ao pai via `onReadinessChange`.
 */
export function VerificationPanel({
  data,
  checklistItems = VERIFICATION_CHECKLIST_ITEMS,
  onReadinessChange,
}: {
  data: VerificationPanelData;
  checklistItems?: readonly VerificationChecklistItem[];
  onReadinessChange?: (ready: boolean) => void;
}) {
  const [state, setState] = useState<Record<string, ChecklistState>>(() =>
    initialChecklist(checklistItems),
  );

  const ready = useMemo(
    () => checklistItems.every((i) => isItemResolved(state[i.id] ?? EMPTY_ITEM)),
    [checklistItems, state],
  );

  // Empresa já verificada não exige checklist — está pronta por definição.
  const effectiveReady = data.isVerified || ready;
  useEffect(() => {
    onReadinessChange?.(effectiveReady);
  }, [effectiveReady, onReadinessChange]);

  // E-004 — vaga subsequente de Empresa já verificada: sem painel de verificação.
  if (data.isVerified) {
    return (
      <section
        aria-label="Verificação da Empresa"
        className="rounded-lg border border-success bg-[color-mix(in_srgb,var(--color-success)_12%,transparent)] p-3"
      >
        <p className="text-sm text-success">
          ✓ Empresa verificada
          {data.verifiedAtLabel ? ` em ${data.verifiedAtLabel}` : ''}
          {data.verifiedByName ? ` por ${data.verifiedByName}` : ''}.
        </p>
      </section>
    );
  }

  const reverification = data.changedSinceVerification.length > 0;

  function update(id: string, patch: Partial<ChecklistState>) {
    setState((prev) => ({ ...prev, [id]: { ...(prev[id] ?? EMPTY_ITEM), ...patch } }));
  }

  return (
    <section
      aria-label="Verificação da Empresa"
      className="flex flex-col gap-3 rounded-lg border border-cta bg-[color-mix(in_srgb,var(--color-cta)_10%,transparent)] p-4"
    >
      <header className="flex flex-col gap-1">
        <h3 className="text-sm font-bold text-fg">Verificação da Empresa</h3>
        <p className="text-xs text-cta">
          {reverification
            ? 'Empresa editada após a verificação anterior — confira os dados alterados antes de reverificar.'
            : 'Primeira vaga desta Empresa — confira os dados manualmente antes de aprovar.'}
        </p>
      </header>

      {/* Dados da Empresa em destaque (E-001). */}
      <dl className="grid grid-cols-1 gap-1 text-xs text-fg sm:grid-cols-2">
        <Field label="CNPJ" value={data.cnpj} changed={data.changedSinceVerification.includes('cnpj')} />
        <Field label="Razão social" value={data.razaoSocial} changed={data.changedSinceVerification.includes('razaoSocial')} />
        <Field label="Nome fantasia" value={data.nomeFantasia} changed={data.changedSinceVerification.includes('nomeFantasia')} />
        <Field label="Setor" value={data.setor} changed={data.changedSinceVerification.includes('setor')} />
        <Field label="Endereço" value={data.endereco ?? '—'} changed={data.changedSinceVerification.includes('endereco')} />
      </dl>

      {reverification && (
        <p className="text-xs font-medium text-fg">
          Alterado desde a última verificação:{' '}
          {data.changedSinceVerification.map((f) => FIELD_LABELS[f] ?? f).join(', ')}.
        </p>
      )}

      {/* Histórico de rejeições (P-003 / D-005). */}
      {data.rejectionCount > 0 && (
        <details className="rounded border border-danger bg-[color-mix(in_srgb,var(--color-danger)_10%,transparent)] p-2 text-xs">
          <summary className="cursor-pointer font-semibold text-danger">
            Rejeitada {data.rejectionCount} {data.rejectionCount === 1 ? 'vez' : 'vezes'}
          </summary>
          <ul className="mt-2 flex flex-col gap-1.5">
            {data.rejections.map((r, idx) => (
              <li key={`${r.rejectedAtLabel}-${idx}`} className="text-danger">
                <span className="font-medium">{r.rejectedAtLabel}</span>
                {r.byName ? ` · ${r.byName}` : ''}
                {r.reason ? ` — ${r.reason}` : ''}
              </li>
            ))}
          </ul>
        </details>
      )}

      {/* Checklist interativa (P-001). */}
      <fieldset className="flex flex-col gap-2">
        <legend className="text-xs font-semibold text-fg">
          Checklist de verificação (obrigatória para aprovar)
        </legend>
        {checklistItems.map((item) => {
          const s = state[item.id] ?? EMPTY_ITEM;
          return (
            <div key={item.id} className="flex flex-col gap-1 rounded border border-border bg-surface p-2">
              <label className="flex items-start gap-2 text-xs text-fg">
                <input
                  type="checkbox"
                  className="mt-0.5 accent-primary"
                  checked={s.checked}
                  onChange={(e) => update(item.id, { checked: e.target.checked, dismissed: false })}
                />
                <span>{item.label}</span>
              </label>
              {!s.checked && (
                <label className="flex items-center gap-2 pl-6 text-[11px] text-fg-muted">
                  <input
                    type="checkbox"
                    className="accent-primary"
                    checked={s.dismissed}
                    onChange={(e) => update(item.id, { dismissed: e.target.checked })}
                  />
                  <span>Não se aplica (justifique)</span>
                </label>
              )}
              {s.dismissed && !s.checked && (
                <Input
                  type="text"
                  aria-label={`Motivo da dispensa: ${item.label}`}
                  className="ml-6 w-auto px-2 py-1 text-[11px]"
                  placeholder="Motivo da dispensa"
                  value={s.reason}
                  onChange={(e) => update(item.id, { reason: e.target.value })}
                />
              )}
            </div>
          );
        })}
        {!ready && (
          <p className="text-[11px] text-cta">
            Marque (ou dispense com motivo) todos os itens para liberar a aprovação da vaga.
          </p>
        )}
      </fieldset>
    </section>
  );
}

function Field({ label, value, changed }: { label: string; value: string; changed: boolean }) {
  return (
    <div className={changed ? 'rounded bg-[color-mix(in_srgb,var(--color-cta)_22%,transparent)] px-1' : ''}>
      <dt className="inline font-semibold">{label}: </dt>
      <dd className="inline">{value}</dd>
    </div>
  );
}
