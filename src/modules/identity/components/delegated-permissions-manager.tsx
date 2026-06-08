'use client';

import { useState, useTransition } from 'react';
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

  const inputClass =
    'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200';
  const btnClass =
    'rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50';
  const revokeBtnClass =
    'rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 border border-red-200';

  return (
    <div className="flex flex-col gap-8">
      {/* Formulário de concessão */}
      <section className="flex flex-col gap-4 rounded-xl border border-gray-200 p-5">
        <h2 className="text-base font-semibold text-gray-900">Conceder permissão</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Voluntário</label>
            <select
              className={inputClass}
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
            <label className="mb-1 block text-xs font-medium text-gray-700">Permissão</label>
            <select
              className={inputClass}
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
            <label className="mb-1 block text-xs font-medium text-gray-700">
              Área de escopo <span className="text-gray-400">(opcional)</span>
            </label>
            <input
              type="text"
              className={inputClass}
              placeholder="ex: empregabilidade"
              value={scopeArea}
              onChange={(e) => setScopeArea(e.target.value)}
              disabled={isPending}
              maxLength={100}
            />
          </div>
        </div>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <div>
          <button onClick={onGrant} disabled={isPending} className={btnClass}>
            {isPending ? 'Concedendo...' : 'Conceder permissão'}
          </button>
        </div>
      </section>

      {/* Lista de permissões ativas */}
      <section className="flex flex-col gap-4">
        <h2 className="text-base font-semibold text-gray-900">Permissões ativas</h2>
        {grants.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhuma permissão delegada ativa no momento.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {grants.map((vol) => (
              <div key={vol.personId} className="rounded-xl border border-gray-200 p-4">
                <p className="mb-3 font-medium text-gray-900">{vol.fullName}</p>
                <ul className="flex flex-col gap-3">
                  {vol.grants.map((g) => (
                    <li key={g.id} className="flex flex-col gap-1.5 rounded-lg bg-gray-50 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-gray-800">
                          {PERMISSION_LABELS[g.permission]}
                        </span>
                        {g.scopeArea && (
                          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                            {g.scopeArea}
                          </span>
                        )}
                      </div>
                      <div className="flex items-end gap-2">
                        <input
                          type="text"
                          className="flex-1 rounded-lg border border-gray-300 px-2 py-1.5 text-xs focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-red-200"
                          placeholder="Justificativa para revogar (mín. 10 caracteres)"
                          value={justification[g.id] ?? ''}
                          onChange={(e) => setJustification((p) => ({ ...p, [g.id]: e.target.value }))}
                          disabled={isPending && pendingRevokeId === g.id}
                        />
                        <button
                          onClick={() => onRevoke(g.id)}
                          disabled={isPending}
                          className={revokeBtnClass}
                        >
                          {isPending && pendingRevokeId === g.id ? 'Revogando...' : 'Revogar'}
                        </button>
                      </div>
                      {revokeError[g.id] && (
                        <p role="alert" className="text-xs text-red-600">{revokeError[g.id]}</p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
