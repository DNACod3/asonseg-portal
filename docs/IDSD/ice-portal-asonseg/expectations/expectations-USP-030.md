# Expectations — USP-030: Buscar serviços (pública)

**Origem:** AC-030-1 a AC-030-3 do PRD v0.3, ajustados e estendidos.

## 1. Cenários de sucesso testáveis

- **E-001:** WHEN o visitante (anônimo ou autenticado) acessa a lista de serviços, the system SHALL exibir apenas serviços com status "ativo" ordenados por data de publicação (mais recente primeiro).

- **E-002:** WHEN o visitante aplica filtros (categoria, faixa de preço, região, disponibilidade), the system SHALL atualizar a lista respeitando todos em AND lógico.

- **E-003:** The system SHALL aplicar busca textual case-insensitive sem acentos sobre título, descrição e categoria.

- **E-004:** The system SHALL exibir, no cadastro de prestador PF (USP-029), aviso explícito de que nome aparecerá publicamente na busca + que o cruzamento com bairro + horário fixo pode permitir identificação.

  *Ajuste:* AC do PRD não cobre aviso; vem do F1 do intent (fingerprinting).

## 2. Proibições (must-not)

- **P-001 (toca F1 — fingerprinting do prestador PF):** O sistema NÃO PODE exibir, na lista pública para anônimo, **endereço completo** do prestador PF — apenas região aproximada (bairro/cidade). Aviso ao prestador no cadastro cobre o aspecto consentido (decisão ADR-0017).

- **P-002 (toca F2 — prestador novo invisível):** O sistema NÃO PODE deixar a UX sem indicação clara da ordenação ("ordenado por mais recente — relevância semântica chega em V2"). Decisão consciente do MVP exige transparência.
  ✅ RESOLVIDO (dono do intent): sim — rotação leve dos N primeiros a cada carregamento (anti-bias).

- **P-003 (toca F3 — filtros mal calibrados):** O sistema NÃO PODE oferecer "faixa de preço" como slider livre sem opção "por orçamento" — serviços que não cobram por valor fixo (reforma, pintura) precisam aparecer mesmo quando o cliente aplica filtro de preço.

- **P-004 (toca F4 — serviço inativo aparece):** O sistema NÃO PODE exibir serviço cujo papel prestador esteja desativado, ou cujo consentimento da finalidade 3 foi revogado (USP-043). Verificação on-read garante consistência mesmo se job de invalidação atrasar.

- **P-005:** O sistema NÃO PODE expor contato (telefone/e-mail) do prestador na lista pública — apenas após manifestação de interesse (USP-033).

## 3. Limites

- **L-001 (Performance):** Lista ≤ 2s p95 no volume estimado, mesmo durante picos anônimos (RP-009).
- **L-002 (Paginação):** Resultado paginado.
- **L-003 (Rate limiting):** Endpoint público com rate limiting por IP.

## 4. Critérios de pronto, do ponto de vista do dono do intent

- **D-001:** Visitante anônimo, em ensaio, busca "manicure" em "Centro, Londrina"; vê lista coerente de prestadores PF e Empresas; sem contato exposto. Validado em ≥ 3 ensaios.

- **D-002:** A coordenadora abre a lista em modo anônimo e confere que **nenhum item** exibe telefone/e-mail do prestador, nem endereço completo. Validado por inspeção de HTML + JSON.

- **D-003:** Em teste com prestador cujo papel foi desativado: o serviço dele não aparece na lista pública, mesmo se o job de invalidação não tiver rodado ainda.

- **D-004:** Em teste de carga: 50 visitantes anônimos simultâneos; lista carrega ≤ 2s p95.

- **D-005:** A coordenadora valida com 2-3 voluntários da comunidade (em celular) que a busca de serviços é navegável sem ajuda em ≤ 5 min.
