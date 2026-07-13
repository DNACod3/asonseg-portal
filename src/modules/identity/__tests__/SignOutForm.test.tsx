import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SignOutForm } from '../components/SignOutForm';

/**
 * USP-049 — LOGOUT-03, DS-MN-01.
 *
 * `SignOutForm` renderiza um `<form action={signOutAction}>` com um botão
 * "Sair" — tokens-only (sem hex cru), via `Button` do Design System.
 */
describe('SignOutForm', () => {
  it('renderiza um form com botão "Sair"', () => {
    render(<SignOutForm />);
    const button = screen.getByRole('button', { name: 'Sair' });
    expect(button).toBeInTheDocument();
    expect(button.closest('form')).not.toBeNull();
  });

  it('o botão é do tipo submit (submete o form ao signOutAction)', () => {
    render(<SignOutForm />);
    const button = screen.getByRole('button', { name: 'Sair' });
    expect(button).toHaveAttribute('type', 'submit');
  });
});
