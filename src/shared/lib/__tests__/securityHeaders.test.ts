import { describe, it, expect } from 'vitest';
import { securityHeaders, applySecurityHeaders } from '@/shared/lib/securityHeaders';

describe('securityHeaders', () => {
  it('inclui todos os headers exigidos pela US #200', () => {
    const h = securityHeaders();
    expect(h['Content-Security-Policy']).toBeDefined();
    expect(h['X-Content-Type-Options']).toBe('nosniff');
    expect(h['X-Frame-Options']).toBe('DENY');
    expect(h['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(h['Permissions-Policy']).toBeDefined();
  });

  it('omite HSTS por padrão (HTTP/dev) e inclui quando hsts=true', () => {
    expect(securityHeaders()['Strict-Transport-Security']).toBeUndefined();
    const prod = securityHeaders({ hsts: true });
    expect(prod['Strict-Transport-Security']).toContain('max-age=');
    expect(prod['Strict-Transport-Security']).toContain('includeSubDomains');
  });

  it('CSP libera o Cloudflare Turnstile (script + frame)', () => {
    const csp = securityHeaders()['Content-Security-Policy']!;
    expect(csp).toContain('https://challenges.cloudflare.com');
    expect(csp).toMatch(/frame-src[^;]*challenges\.cloudflare\.com/);
    expect(csp).toMatch(/script-src[^;]*challenges\.cloudflare\.com/);
  });

  it('CSP define frame-ancestors none e object-src none', () => {
    const csp = securityHeaders()['Content-Security-Policy']!;
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
  });

  it('CSP inclui a origem do Supabase em connect-src (http e wss)', () => {
    const csp = securityHeaders({ supabaseOrigin: 'https://proj.supabase.co' })[
      'Content-Security-Policy'
    ]!;
    expect(csp).toMatch(/connect-src[^;]*https:\/\/proj\.supabase\.co/);
    expect(csp).toMatch(/connect-src[^;]*wss:\/\/proj\.supabase\.co/);
  });

  it('applySecurityHeaders escreve no objeto Headers', () => {
    const headers = new Headers();
    applySecurityHeaders(headers, { hsts: true });
    expect(headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(headers.get('Strict-Transport-Security')).toBeTruthy();
  });
});
