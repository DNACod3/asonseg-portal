# Expectations — USP-011: Cadastro de cliente de serviço (papel)

**Origem:** AC-011-1 do PRD v0.3, ajustado e estendido.

## 1. Cenários de sucesso testáveis

- **E-001:** WHEN a Pessoa autenticada acessa a tela de detalhe de serviço (USP-031) e tenta manifestar interesse pela primeira vez (USP-033), the system SHALL exibir explicitamente o termo curto da finalidade 4 (contratação de serviço), exigir aceite, ativar o papel cliente e prosseguir com a manifestação — tudo numa **transação única**: ativação do papel + persistência do consentimento (versão+data+IP) + criação da manifestação.

  *Ajuste do AC-011-1:* o AC do PRD diz "ativa o papel automaticamente sem formulário adicional" — explicita aqui que **mesmo sem formulário, o termo é mostrado e o aceite é obrigatório** (ADR-0013).

- **E-002:** WHEN o papel cliente já está ativo (manifestação não é a primeira), the system SHALL prosseguir direto sem mostrar o termo de novo.

## 2. Proibições (must-not)

- **P-001 (toca F1 — papel sem consentimento):** O sistema NÃO PODE ativar o papel cliente sem o consentimento da finalidade 4 persistido na mesma transação. Mesmo padrão do USP-006/P-001.

- **P-002 (toca F2 — consentimento "invisível"):** O sistema NÃO PODE coletar consentimento implícito (clique apenas no botão "entrar em contato") sem ter exibido o texto do termo da finalidade 4 e exigido aceite explícito (checkbox marcado, clique em "aceito", ou equivalente). Consentimento precisa ser informado.

- **P-003:** O sistema NÃO PODE permitir ativação do papel cliente em Pessoa sem credencial (USP-002 sem USP-003). Cliente precisa logar.

## 3. Limites

- **L-001 (Performance):** Ativação automática + manifestação ≤ 2s p95 (sem perceber pausa real).
- **L-002 (UX):** Termo da finalidade 4 é **curto** (uma frase ou parágrafo curto) — proporcional à leveza do papel (ADR-0013 + AC-011-1).

## 4. Critérios de pronto, do ponto de vista do dono do intent

- **D-001:** Uma Pessoa real, em ensaio, manifesta interesse pela primeira vez (USP-033) num serviço e percebe que está aceitando um termo (a tela é evidente). Total do fluxo ≤ 30s do clique inicial à revelação do contato. Validado em ≥ 3 ensaios.

- **D-002 (gate jurídico):** Antes desta USP ir para produção, o termo da **finalidade 4 (contratação de serviço)** está aprovado pelo jurídico via D-002 do PRD. Sem isso, a USP **não vai para produção**.

- **D-003:** A AS abre a auditoria de uma Pessoa que ativou cliente nesta via e confere que o consentimento da finalidade 4 está persistido com versão, data e IP corretos.
