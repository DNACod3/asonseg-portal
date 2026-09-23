# OpenWolf — Gaps de protocolo e USPs sem issue no board

Registro de trabalho executado fora do board `Asonseg-portal` (project #3, owner DNACod3), ou com gap de protocolo (timer não iniciado, etc.). Conforme skill `openwolf-task-protocol-asonseg-portal` seção 7.

## 2026-09-23 — USP-067 (Fase 11) mergeada sem issue no board

- **PR:** https://github.com/DNACod3/asonseg-portal/pull/297 (squash `88d839a` em master)
- **Trabalho:** Painel `/inicio` por papel (Fase 11 do ROADMAP, unidade única)
- **Gap:** USP-067 foi criada direto no `.specs/project/ROADMAP.md` em 2026-08-15 a pedido do dono. Nunca teve issue correspondente no project #3 (nem em `docs/IDSD/ice-portal-asonseg/` — a memória `fonte-verdade-usp-board.md` já sinaliza que a numeração de USP do IDSD/ROADMAP diverge da do board).
- **Consequência:** Regras 2, 4, 5, 6-8 do protocolo (Spent Time, cascade Estimate/Remaining, cascade tokens Task→US→Epic) não têm onde ser aplicadas — não há card do board para escrever, sem Epic pai localizável. Timer não estava ativo (`.wolf/task-timer.json` `actives: []`).
- **Registro alternativo:** AD-032 (PASS iteração 2) e AD-033 (rodada de correção pós-`/pr-review`) em `.specs/project/STATE.md`. `validation.md` da USP-067 tem o audit trail completo (spec + design + tasks + veredito Verifier).
- **Follow-ups não-bloqueantes deixados como issue:**
  - #298 — `provider-block.test.tsx` mocka Server Action no barrel em vez do source (dívida de teste)
  - #299 — `NEXT_PUBLIC_SITE_URL` faltando no Preview env do Vercel `portal-staging` (dívida de infra)
