import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

/**
 * Smoke RTL do manager de permissões delegadas (USP-008 / IDN-17/18). Cobre as
 * guardas que o restyle da Fase 1 (AD-014) não pode enfraquecer: seleção
 * obrigatória antes de conceder (U8-MN-03a) e o catálogo finito exibido no
 * `<select>` de permissão (U8-MN-03b). Não testa exaustivamente a atualização
 * otimista da lista — coberta por `delegated-permissions.int.test.ts`.
 */

const actionState = vi.hoisted(() => ({
  grantDelegatedPermission: vi.fn(),
  revokeDelegatedPermission: vi.fn(),
}));

vi.mock('../actions/grant-delegated-permission', () => ({
  grantDelegatedPermission: (...a: unknown[]) => actionState.grantDelegatedPermission(...a),
}));

vi.mock('../actions/revoke-delegated-permission', () => ({
  revokeDelegatedPermission: (...a: unknown[]) => actionState.revokeDelegatedPermission(...a),
}));

const { DelegatedPermissionsManager } = await import('../components/delegated-permissions-manager');
const { DELEGABLE_PERMISSIONS } = await import('../domain/permissions');

const volunteers = [{ id: 'vol-1', fullName: 'Voluntário Um' }];

beforeEach(() => {
  vi.clearAllMocks();
  actionState.grantDelegatedPermission.mockResolvedValue({
    ok: true,
    data: { permissionId: 'grant-1', targetPersonId: 'vol-1' },
  });
});

describe('DelegatedPermissionsManager', () => {
  it('sem voluntário e permissão selecionados → NÃO chama a action e exibe erro (U8-MN-03a)', () => {
    render(<DelegatedPermissionsManager volunteers={volunteers} existing={[]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Conceder permissão' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Selecione o voluntário e a permissão.');
    expect(actionState.grantDelegatedPermission).not.toHaveBeenCalled();
  });

  it('<select> de permissão renderiza exatamente o catálogo finito DELEGABLE_PERMISSIONS (U8-MN-03b)', () => {
    render(<DelegatedPermissionsManager volunteers={volunteers} existing={[]} />);
    const select = screen.getByLabelText('Permissão') as HTMLSelectElement;

    // +1 pelo placeholder "Selecione..." — nenhum item fora do catálogo finito.
    expect(select.options).toHaveLength(DELEGABLE_PERMISSIONS.length + 1);
    const optionValues = Array.from(select.options)
      .map((o) => o.value)
      .filter((v) => v !== '');
    expect(optionValues).toEqual([...DELEGABLE_PERMISSIONS]);
  });

  it('voluntário + permissão selecionados → chama a action com o payload correto (happy)', async () => {
    render(<DelegatedPermissionsManager volunteers={volunteers} existing={[]} />);
    fireEvent.change(screen.getByLabelText('Voluntário'), { target: { value: 'vol-1' } });
    fireEvent.change(screen.getByLabelText('Permissão'), {
      target: { value: DELEGABLE_PERMISSIONS[0] },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Conceder permissão' }));

    await waitFor(() =>
      expect(actionState.grantDelegatedPermission).toHaveBeenCalledWith({
        targetPersonId: 'vol-1',
        permission: DELEGABLE_PERMISSIONS[0],
        scopeArea: undefined,
      }),
    );
  });
});
