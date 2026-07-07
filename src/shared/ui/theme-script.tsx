/**
 * Fundação de Design System da Fase 1 (T3, DS-13). Script inline anti-FOUC:
 * roda no `<head>` do root layout, antes da hidratação, e seta
 * `document.documentElement.dataset.theme` a partir de `localStorage.theme`
 * (quando `'dark'|'light'` salvo) ou de `prefers-color-scheme` (fallback).
 * Degrada sem lançar exceção quando `localStorage` está indisponível
 * (SSR/navegador privado — edge case do spec).
 *
 * Exportado como string (`THEME_INIT_SCRIPT`) para permitir teste direto do
 * comportamento (execução isolada em jsdom), além do componente que o injeta
 * como `<script>` inline.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('theme');var d=document.documentElement;if(t==='dark'||t==='light'){d.dataset.theme=t;}else{var m=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches;d.dataset.theme=m?'dark':'light';}}catch(e){}})();`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />;
}
