# Expectations — USP-010: Cadastro de prestador de serviço (papel)

**Origem:** AC-010-1 e AC-010-2 do PRD v0.3, ajustados e estendidos.

## 1. Cenários de sucesso testáveis

- **E-001:** WHEN a Pessoa autenticada solicita ativar o papel prestador PF **com aceite do termo da finalidade 3 (oferta de serviço)**, the system SHALL ativar o papel imediatamente, persistir o consentimento da finalidade 3 (versão+data+IP) e gravar log de auditoria — em transação única.

  *Ajuste do AC-010-1:* explicita aceite da finalidade 3 + atomicidade.

- **E-002:** The system SHALL permitir que o prestador informe dados fiscais opcionais (CNPJ MEI próprio) **sem que isso altere o tipo do cadastro** (continua sendo prestador PF, não vira Empresa).

- **E-003:** WHEN o papel prestador é ativado, the system SHALL redirecionar o usuário para a tela de próximo passo "publicar primeiro serviço" (USP-029) ou para o painel do prestador.

## 2. Proibições (must-not)

- **P-001 (toca F1 — confusão MEI vs Empresa):** O sistema NÃO PODE persistir o CNPJ MEI declarado pelo prestador PF na tabela/entidade Empresa. CNPJ MEI do prestador PF é atributo da Pessoa/Papel, não cria registro de Empresa. Para publicar em nome de Empresa MEI, é obrigatório o fluxo USP-012.

- **P-002 (toca F1 — busca confundida):** O sistema NÃO PODE permitir que uma busca por prestador (USP-030) confunda prestador PF que declarou CNPJ MEI com Empresa MEI cadastrada via USP-012. Os dois precisam ser distinguíveis no resultado.

- **P-003 (toca F2 — papel sem consentimento):** O sistema NÃO PODE ativar o papel prestador sem que o consentimento da finalidade 3 esteja persistido na mesma transação. Mesmo padrão do USP-006/P-001.

- **P-004 (toca F3 — UX confusa prestador vs cliente):** O sistema NÃO PODE permitir ativação do papel prestador sem que a tela explicite "agora você OFERECE serviços" (distinguindo claramente do papel cliente, que CONTRATA serviços).

- **P-005:** O sistema NÃO PODE ativar o papel prestador em Pessoa cadastrada sem credencial (USP-002 sem USP-003). Prestador precisa logar.

## 3. Limites

- **L-001 (Performance):** Submit da ativação ≤ 2s p95.
- **L-002 (Conteúdo):** Termo da finalidade 3 é a versão vigente no momento (USP-043).

## 4. Critérios de pronto, do ponto de vista do dono do intent

- **D-001:** Uma Pessoa real, em ensaio, ativa o papel prestador em ≤ 60 segundos do clique inicial. Tela final mostra "próximo passo: publicar serviço".

- **D-002 (gate jurídico):** Antes desta USP ir para produção, o termo da **finalidade 3 (oferta de serviço)** está aprovado pelo jurídico via D-002 do PRD. Sem isso, a USP **não vai para produção**.

- **D-003:** Em teste com CNPJ MEI declarado: prestador informa MEI; sistema persiste como atributo da Pessoa; busca de Empresas (USP-027/USP-030) **não retorna** esse prestador como Empresa MEI.

- **D-004:** Inspeção visual da tela de ativação: o sponsor confirma que o texto distingue claramente "oferecer" de "contratar" serviço.
