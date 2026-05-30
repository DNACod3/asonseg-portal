# Expectations — USP-041: Home pública com indicadores em tempo real

**Origem:** AC-041-1 e AC-041-2 do PRD v0.3, ajustados e estendidos.

## 1. Cenários de sucesso testáveis

- **E-001:** WHEN o visitante acessa a home, the system SHALL exibir: total de vagas com status "ativo", total de candidatos com perfil "ativo", total de Empresas "verificadas" — sem qualquer dado pessoal (apenas contagens agregadas).

- **E-002:** The system SHALL atualizar os indicadores com cache curto (≤ 5 min ou janela definida pelo Arquiteto), garantindo p95 ≤ 1.5s mesmo em pico de tráfego (RNF 6.1 + RP-009).

- **E-003:** WHERE algum indicador está abaixo de um limiar mínimo configurável (cold start), the system SHALL exibir mensagem "Em breve" em vez do número zero — política de exibição mínima da diretoria.
  ✅ RESOLVIDO (dono do intent): N = 5 (contadores < 5 viram "Em breve"); tunável.

  *Ajuste:* AC do PRD não cobre exibição mínima; vem do F1 do intent + QP-004.

## 2. Proibições (must-not)

- **P-001 (toca F1 — home vazia afasta):** O sistema NÃO PODE exibir "0 vagas ativas" / "0 candidatos" no cold start sem política de exibição mínima decidida. Profecia autorrealizada destrói conversão antes do portal sequer rodar.

- **P-002 (toca F2 — cache desatualizado):** O sistema NÃO PODE manter cache de indicadores com TTL > janela acordada (alvo ≤ 5 min). Visitante candidatando a vaga que não existe é falha de resultado.

- **P-003 (toca F3 — pico derruba home):** O sistema NÃO PODE deixar a home sem estratégia de cache/CDN adequada para suportar picos de tráfego anônimo (RP-009).

- **P-004 (toca F4 — contagem inflada por moderação rápida):** O sistema NÃO PODE exibir indicador "Empresas verificadas" sem que a diretoria acompanhe contraindicadores (tempo médio de moderação MP10, taxa de reprovação na verificação USP-017). Pressão por números sem qualidade esvazia ADR-0015.

- **P-005:** O sistema NÃO PODE exibir, na home, qualquer PII direta (nomes de candidatos, nomes de empresas individualizados) — apenas agregados (ADR-0017).

## 3. Limites

- **L-001 (Performance):** Home ≤ 1.5s p95 (RNF 6.1).
- **L-002 (Cache TTL):** ≤ 5 min ou janela do Arquiteto.
- **L-003 (Rate limiting + CDN):** Estratégia para suportar picos.

## 4. Critérios de pronto, do ponto de vista do dono do intent

- **D-001 (gate operacional):** Antes desta USP ir para produção, **D-012 / QP-004 (política de exibição mínima)** está decidida pela diretoria por escrito. Sem decisão, o cold start fica visualmente quebrado.

- **D-002:** Visitante anônimo, em ensaio, abre a home; vê 3 indicadores com números reais (ou "Em breve" conforme política); carrega em ≤ 1.5s p95. Validado em ≥ 3 ensaios.

- **D-003:** Em teste de pico: 200 visitantes simultâneos; home responde dentro do alvo (cache + CDN funcionando).

- **D-004:** A diretoria abre painel operacional onde vê MP10 (tempo médio de moderação) + taxa de reprovação na verificação ao lado do número de "Empresas verificadas" — defesa contra inflar a métrica.

- **D-005:** Em teste de cache: nova vaga aprovada via USP-016 aparece no contador da home em ≤ janela acordada (não fica oculta por horas).
