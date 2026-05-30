# Expectations — USP-006: Ativar papel adicional na Pessoa autenticada

**Origem:** AC-006-1 a AC-006-3 do PRD v0.3, ajustados e estendidos.

## 1. Cenários de sucesso testáveis

- **E-001:** WHEN o usuário autenticado solicita ativar um novo papel público, the system SHALL exibir formulário com apenas os campos do papel novo que ainda não estão preenchidos, e exibir o termo de consentimento específico da finalidade desse papel (não o termo do cadastro inicial).

  *Ajuste do AC-006-1:* explicita exibição do termo específico da finalidade (ADR-0013).

- **E-002:** WHEN o usuário completa o preenchimento e aceita o termo da finalidade, the system SHALL ativar o papel imediatamente, persistir o consentimento com versão+data+IP e gravar log de auditoria — tudo **em transação única**.

  *Ajuste do AC-006-2:* explicita atomicidade ativação + consentimento + log.

- **E-003:** The system SHALL ativar papel sem etapa de moderação sobre o papel em si (a moderação aplica-se ao conteúdo posteriormente publicado, conforme ADR-0015).

- **E-004:** WHEN o papel ativado é candidato, prestador ou empresa-responsável, the system SHALL redirecionar o usuário para a tela de próximo passo do papel novo (cadastro CV, cadastro prestador, cadastro Empresa).

## 2. Proibições (must-not)

- **P-001 (toca F1 — papel sem consentimento):** O sistema NÃO PODE deixar um papel ativo sem o consentimento da finalidade correspondente persistido. Se a persistência do consentimento falhar, o papel não fica ativo.

- **P-002 (toca F2 — sequestro lateral):** O sistema NÃO PODE permitir que um usuário autenticado ative papel em nome de outra Pessoa por manipulação de identificador na requisição. A operação opera **exclusivamente** sobre a Pessoa autenticada da sessão.

- **P-003 (toca F3 — confusão de papel):** O sistema NÃO PODE permitir ativação de papel empresa-responsável sem que o texto da tela explicite **qual Empresa** será criada/representada, qual finalidade está sendo aceita, e dê tempo de leitura adequado do termo antes do aceite ficar disponível.
  ✅ RESOLVIDO (dono do intent): botão "aceitar" habilita após o scroll completo do termo.

- **P-004 (toca F4 — termo genérico):** O sistema NÃO PODE exibir, no fluxo de ativação de um papel, o termo de outra finalidade. Cada finalidade (ADR-0013) tem termo próprio. Reuso do termo do cadastro inicial para papéis novos é violação.

- **P-005:** O sistema NÃO PODE ativar mais de um papel em uma única transação sem capturar consentimentos distintos por finalidade.

## 3. Limites

- **L-001 (Performance):** Tempo de resposta do submit ≤ 2s p95.
- **L-002 (Conteúdo do termo):** Termo exibido SHALL ser a versão vigente para aquela finalidade no momento da ativação (USP-043).

## 4. Critérios de pronto, do ponto de vista do dono do intent

- **D-001:** Uma Pessoa, em ensaio, com papel candidato ativo, ativa o papel prestador. Total ≤ 90 segundos do clique inicial à ativação concluída. A tela de aceite exibe claramente "finalidade: oferecer serviços", não "finalidade: candidatura a vagas".

- **D-002 (gate jurídico):** Antes desta USP ir para produção, o termo de cada uma das finalidades dos quatro papéis públicos está aprovado pelo jurídico (D-002 do PRD). Sem isso, a USP **não vai para produção**.

- **D-003:** A AS abre a auditoria de uma Pessoa com múltiplos papéis ativos e vê, para cada papel, o consentimento da finalidade correspondente (versão + data + IP).

- **D-004:** Em teste de injeção: tentativa de chamada direta à API alterando o ID de Pessoa para ativar papel em outra Pessoa é rejeitada com erro determinístico.
