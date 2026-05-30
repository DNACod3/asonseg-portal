# Expectations — USP-008: Configurar permissões delegadas a voluntário no portal

**Origem:** AC-008-1 a AC-008-3 do PRD v0.3, ajustados e estendidos.

## 1. Cenários de sucesso testáveis

- **E-001:** WHEN o coordenador da área Portal Empregabilidade concede uma permissão delegável (do catálogo finito) a um voluntário ativo da sua área, the system SHALL aplicar a permissão e gravar log de auditoria com concedente, beneficiário, permissão, data/hora.

- **E-002:** WHEN o coordenador revoga uma permissão de um voluntário, the system SHALL remover o acesso e registrar log. A remoção tem efeito ao próximo carregamento de sessão **ou em janela curta**, conforme decisão.
  ✅ RESOLVIDO (ADR-0030): efeito no próximo carregamento, janela ≤30s (mesma decisão de USP-007/F1 — revalidação de permissões por request).

- **E-003:** WHERE o catálogo de permissões delegáveis do Portal está definido, the system SHALL apresentá-lo como **lista finita fechada** correspondente aos 9 itens (moderar vaga, moderar CV, moderar serviço, validar Empresa, inativar conteúdo, encaminhar Pessoa, aprovar sugestão de categoria, registrar resultado, aprovar reivindicação).
  ✅ RESOLVIDO parte técnica (ADR-0030 / TD §4.5): o mecanismo está definido — enum fechado com namespace `portal:` (lista finita fechada). ❓ O CONTEÚDO final do catálogo permanece gate de negócio (D-006 / QP-006, Fase 0).

- **E-004:** WHEN o coordenador concede permissão sensível (a definir quais), the system SHALL exigir confirmação explícita extra antes de aplicar.
  ✅ RESOLVIDO (dono do intent): sem tratamento diferenciado por sensibilidade no MVP — concessão uniforme, motivação optativa.

## 2. Proibições (must-not)

- **P-001 (toca F1 — revogação tardia):** O sistema NÃO PODE permitir que voluntário com permissão revogada continue exercendo a permissão indefinidamente em sessão aberta. A janela máxima entre revogação e efeito real precisa ser declarada e respeitada.

- **P-002 (toca F2 — concessão sensível por engano):** O sistema NÃO PODE conceder permissão sensível sem confirmação extra explícita (digitação do nome da permissão, dupla confirmação, ou equivalente).

- **P-003 (toca F3 — fora do catálogo):** O sistema NÃO PODE conceder permissão que não consta no catálogo finito do Portal (ADR-0001 estendido), por nenhuma rota — UI, API direta, função administrativa. Modelo é fechado.

- **P-004 (toca F4 — reativação ressuscita permissões):** O sistema NÃO PODE, ao reativar uma Pessoa inativada (USP-007), restaurar automaticamente permissões delegadas que ela tinha antes da inativação. Reativação volta com **zero permissões delegáveis** — coordenador concede de novo se julgar adequado.

- **P-005 (toca F5 — conflito com Frente 4):** O sistema NÃO PODE permitir que IDs ou nomes de permissões do catálogo do Portal colidam com IDs/nomes da Frente 4 (Release 2). Catálogo do Portal precisa ter namespace claro.

- **P-006:** O sistema NÃO PODE permitir que coordenador conceda permissões a voluntário de outra área. Escopo é restrito a voluntários da área Portal Empregabilidade.

- **P-007:** O sistema NÃO PODE conceder permissão a Pessoa inativada (USP-007). Pessoa precisa estar ativa para receber permissão.

## 3. Limites

- **L-001 (Performance):** Submit de concessão/revogação ≤ 1s p95.
- **L-002 (Janela de efeito de revogação):** Alvo ≤ 1 carregamento de sessão (ou janela curta a definir).
- **L-003 (Auditoria):** Log imutável, retido por toda a retenção institucional.

## 4. Critérios de pronto, do ponto de vista do dono do intent

- **D-001:** A coordenadora, em ensaio, concede a permissão "moderar vaga" a um voluntário em ≤ 30 segundos. Voluntário recarrega a sessão e vê a fila de moderação (USP-016).

- **D-002 (gate operacional):** Antes desta USP ir para produção, **D-006 / QP-006 do PRD (catálogo final)** estão decididos. Sem catálogo definido, não há lista finita para apresentar. A USP **não vai para produção** sem isso.

- **D-003:** A coordenadora revoga uma permissão e o voluntário deixa de ter acesso dentro da janela acordada (testado por ensaio com sessão aberta).

- **D-004:** Em teste de bypass: tentativa de chamada direta à API concedendo permissão fora do catálogo é rejeitada com erro determinístico.

- **D-005:** Auditoria mostra histórico completo: quem concedeu, quem revogou, para quem, qual permissão, quando — para janela de teste de ≥ 7 dias.

- **D-006:** Em ensaio de concessão sensível: coordenadora clica em "conceder inativar conteúdo" e o sistema pede confirmação extra antes de aplicar.
