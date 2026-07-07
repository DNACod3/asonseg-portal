'use client';

import { useState, useTransition } from 'react';
import { Badge, Button, Card, FormRow, FormSectionTitle, Input, Label } from '@/shared/ui';
import { grantDelegatedPermission } from '../actions/grant-delegated-permission';
import { revokeDelegatedPermission } from '../actions/revoke-delegated-permission';
import { DELEGABLE_PERMISSIONS } from '../domain/permissions';
import type { VolunteerWithPermissions } from '../queries/list-delegated-permissions';
import type { PermissionId } from '@prisma/client';

const PERMISSION_LABELS: Record<PermissionId, string> = {
  MODERATE_JOB: 'Moderar vagas',
  MODERATE_CV: 'Moderar currículos',
  MODERATE_SERVICE: 'Moderar serviços',
  VALIDATE_COMPANY_FIRST_JOB: 'Validar empresa (1ª vaga)',
  INACTIVATE_PUBLISHED_CONTENT: 'Inativar conteúdo publicado',
  REFER_PERSON_TO_JOB: 'Encaminhar pessoa a vaga',
  APPROVE_CATEGORY_SUGGESTION: 'Aprovar sugestão de categoria',
  REGISTER_REFERRAL_RESULT: 'Registrar resultado de encaminhamento',
  APPROVE_CREDENTIAL_CLAIM: 'Aprovar reivindicação de credencial',
};

export interface DelegatedPermissionsManagerProps {
  volunteers: Array<{ id: string; fullName: string }>;
  existing: VolunteerWithPermissions[];
}

/**
 * Gestão de permissões delegadas a voluntários (USP-008 / IDN-17/18). Concede/
 * revoga permissões do catálogo finito `DELEGABLE_PERMISSIONS`, sempre
 * append-only (revogação nunca deleta o registro, só marca `revokedAt`).
 *
 * Refactor da Fase 1 (AD-014): restilizado com os primitivos (`Input`/
 * `Button`/`Badge`/`Card`/`FormRow`/`FormSectionTitle`) e tokens — estado,
 * guardas client (seleção obrigatória; justificativa ≥ 10) e o payload das
 * actions preservados sem alteração.
 */
export function DelegatedPermissionsManager({
  volunteers,
  existing,
}: DelegatedPermissionsManagerProps) {
  const [grants, setGrants] = useState(existing);
  const [selectedVolunteer, setSelectedVolunteer] = useState('');
  const [selectedPermission, setSelectedPermission] = useState<PermissionId | ''>('');
  const [scopeArea, setScopeArea] = useState('');
  const [error, setError] = useState('');
  const [revokeError, setRevokeError] = useState<Record<string, string>>({});
  const [justification, setJustification] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();
  const [pendingRevokeId, setPendingRevokeId] = useState<string | null>(null);

  function onGrant() {
    if (!selectedVolunteer || !selectedPermission) {
      setError('Selecione o voluntário e a permissão.');
      return;
    }
    setError('');
    startTransition(async () => {
      const result = await grantDelegatedPermission({
        targetPersonId: selectedVolunteer,
        permission: selectedPermission,
        scopeArea: scopeArea.trim() || undefined,
      });
      if (result.ok) {
        const vol = volunteers.find((v) => v.id === selectedVolunteer);
        const newGrant = {
          id: result.data.permissionId,
          permission: selectedPermission,
          scopeArea: scopeArea.trim() || null,
          grantedAt: new Date(),
        };
        setGrants((prev) => {
          const existing = prev.find((g) => g.personId === selectedVolunteer);
          if (existing) {
            return prev.map((g) =>
              g.personId === selectedVolunteer
                ? { ...g, grants: [...g.grants, newGrant] }
                : g,
            );
          }
          return [
            ...prev,
            {
              personId: selectedVolunteer,
              fullName: vol?.fullName ?? '',
              grants: [newGrant],
            },
          ];
        });
        setSelectedVolunteer('');
        setSelectedPermission('');
        setScopeArea('');
      } else {
        setError(result.error.message);
      }
    });
  }

  function onRevoke(grantId: string) {
    const reason = justification[grantId] ?? '';
    if (reason.trim().length < 10) {
      setRevokeError((p) => ({ ...p, [grantId]: 'Justificativa deve ter ao menos 10 caracteres.' }));
      return;
    }
    setRevokeError((p) => ({ ...p, [grantId]: '' }));
    setPendingRevokeId(grantId);
    startTransition(async () => {
      const result = await revokeDelegatedPermission({
        permissionGrantId: grantId,
        justification: reason,
      });
      setPendingRevokeId(null);
      if (result.ok) {
        setGrants((prev) =>
          prev
            .map((v) => ({ ...v, grants: v.grants.filter((g) => g.id !== grantId) }))
            .filter((v) => v.grants.length > 0),
        );
        setJustification((p) => { const n = { ...p }; delete n[grantId]; return n; });
      } else {
        setRevokeError((p) => ({ ...p, [grantId]: result.error.message }));
      }
    });
  }

  const selectClass =
    'w-full rounded-sm border-[1.5px] border-border bg-surface px-3 py-2 text-sm text-fg transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-60';

  return (
    <div className="flex flex-col gap-8">
      {/* Formulário de concessão */}
      <Card>
        <FormSectionTitle>Conceder permissão</FormSectionTitle>
        <FormRow cols={3}>
          <div>
            <Label htmlFor="volunteer-select">Voluntário</Label>
            <select
              id="volunteer-select"
              className={selectClass}
              value={selectedVolunteer}
              onChange={(e) => setSelectedVolunteer(e.target.value)}
              disabled={isPending}
            >
              <option value="">Selecione...</option>
              {volunteers.map((v) => (
                <option key={v.id} value={v.id}>{v.fullName}</option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="permission-select">Permissão</Label>
            <select
              id="permission-select"
              className={selectClass}
              value={selectedPermission}
              onChange={(e) => setSelectedPermission(e.target.value as PermissionId)}
              disabled={isPending}
            >
              <option value="">Selecione...</option>
              {DELEGABLE_PERMISSIONS.map((p) => (
                <option key={p} value={p}>{PERMISSION_LABELS[p]}</option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="scope-area">
              Área de escopo <span className="text-fg-muted">(opcional)</span>
            </Label>
            <Input
              id="scope-area"
              type="text"
              placeholder="ex: empregabilidade"
              value={scopeArea}
              onChange={(e) => setScopeArea(e.target.value)}
              disabled={isPending}
              maxLength={100}
            />
          </div>
        </FormRow>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <div>
          <Button onClick={onGrant} disabled={isPending} variant="primary">
            {isPending ? 'Concedendo...' : 'Conceder permissão'}
          </Button>
        </div>
      </Card>

      {/* Lista de permissões ativas */}
      <section className="flex flex-col gap-4">
        <FormSectionTitle>Permissões ativas</FormSectionTitle>
        {grants.length === 0 ? (
          <p className="text-sm text-fg-muted">Nenhuma permissão delegada ativa no momento.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {grants.map((vol) => (
              <Card key={vol.personId}>
                <p className="mb-3 font-medium text-fg">{vol.fullName}</p>
                <ul className="flex flex-col gap-3">
                  {vol.grants.map((g) => (
                    <li key={g.id} className="flex flex-col gap-1.5 rounded-lg bg-background p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-fg">
                          {PERMISSION_LABELS[g.permission]}
                        </span>
                        {g.scopeArea && <Badge variant="blue">{g.scopeArea}</Badge>}
                      </div>
                      <div className="flex items-end gap-2">
                        <Input
                          type="text"
                          className="flex-1"
                          placeholder="Justificativa para revogar (mín. 10 caracteres)"
                          value={justification[g.id] ?? ''}
                          onChange={(e) => setJustification((p) => ({ ...p, [g.id]: e.target.value }))}
                          disabled={isPending && pendingRevokeId === g.id}
                        />
                        <Button
                          onClick={() => onRevoke(g.id)}
                          disabled={isPending}
                          variant="outline"
                          className="border-danger text-danger hover:border-danger hover:bg-[color-mix(in_srgb,var(--color-danger)_10%,transparent)] hover:text-danger"
                        >
                          {isPending && pendingRevokeId === g.id ? 'Revogando...' : 'Revogar'}
                        </Button>
                      </div>
                      {revokeError[g.id] && (
                        <p role="alert" className="text-xs text-danger">
                          {revokeError[g.id]}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
