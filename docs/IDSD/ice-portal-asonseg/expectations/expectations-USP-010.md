# Expectations — USP-010: Cadastro de prestador de serviço (papel)

**Origem:** AC-010-1 e AC-010-2 do PRD v0.3, ajustados e estendidos.

## 1. Cenários de sucesso testáveis

- **E-001:** WHEN a Pessoa autenticada solicita ativar o papel prestador PF **com aceite do termo da finalidade 3 (oferta de serviço)**, the system SHALL ativar o papel imediatamente, persistir o consentimento da finalidade 3 (versão+data+IP) e gravar log de auditoria — em transação única.

  *Ajuste do AC-010-1:* explicita aceite da finalidade 3 + atomicidade.

- **E-002 (REESCRITO 2026-06-10 — ADR-0031):** WHEN o prestador quer registrar dados fiscais (CNPJ MEI próprio), the system SHALL **redirecioná-lo ao fluxo de cadastro de Empresa (USP-012)**, que cria uma `Company type=MEI` com o prestador como responsável. A USP-010 em si **não coleta nem persiste CNPJ** — o `ProviderProfile` não tem campo de CNPJ.

  *Texto original (superseded):* "permitir que o prestador informe dados fiscais opcionais (CNPJ MEI próprio) sem que isso altere o tipo do cadastro (continua prestador PF, não vira Empresa)." — revertido: quem tem MEI **é** Empresa MEI (via USP-012).

- **E-003:** WHEN o papel prestador é ativado, the system SHALL redirecionar o usuário para a tela de próximo passo "publicar primeiro serviço" (USP-029) ou para o painel do prestador.

## 2. Proibições (must-not)

- **~~P-001~~ (REVOGADO 2026-06-10 — ADR-0031):** _O sistema NÃO PODE persistir o CNPJ MEI declarado pelo prestador PF na tabela/entidade Empresa…_ — **revogado**. Decisão do dono do intent: o CNPJ MEI **passa a residir em `companies`** via fluxo USP-012. O `ProviderProfile` não tem campo de CNPJ. (Permanece verdadeiro apenas que cadastrar MEI usa o fluxo USP-012.)

- **~~P-002~~ (REVOGADO 2026-06-10 — ADR-0031):** _O sistema NÃO PODE permitir que uma busca por prestador confunda prestador PF com MEI declarado e Empresa MEI…_ — **revogado / sem objeto**. Não existe mais "prestador PF com MEI declarado"; quem tem MEI é Empresa MEI (USP-012). A distinção que P-002 exigia deixou de fazer sentido.

- **P-003 (toca F2 — papel sem consentimento):** O sistema NÃO PODE ativar o papel prestador sem que o consentimento da finalidade 3 esteja persistido na mesma transação. Mesmo padrão do USP-006/P-001.

- **P-004 (toca F3 — UX confusa prestador vs cliente):** O sistema NÃO PODE permitir ativação do papel prestador sem que a tela explicite "agora você OFERECE serviços" (distinguindo claramente do papel cliente, que CONTRATA serviços).

- **P-005:** O sistema NÃO PODE ativar o papel prestador em Pessoa cadastrada sem credencial (USP-002 sem USP-003). Prestador precisa logar.

## 3. Limites

- **L-001 (Performance):** Submit da ativação ≤ 2s p95.
- **L-002 (Conteúdo):** Termo da finalidade 3 é a versão vigente no momento (USP-043).

## 4. Critérios de pronto, do ponto de vista do dono do intent

- **D-001:** Uma Pessoa real, em ensaio, ativa o papel prestador em ≤ 60 segundos do clique inicial. Tela final mostra "próximo passo: publicar serviço".

- **D-002 (gate jurídico):** Antes desta USP ir para produção, o termo da **finalidade 3 (oferta de serviço)** está aprovado pelo jurídico via D-002 do PRD. Sem isso, a USP **não vai para produção**.

- **D-003 (REESCRITO 2026-06-10 — ADR-0031):** Em teste com MEI: ao optar por registrar o MEI, o prestador é **redirecionado ao fluxo USP-012** e o sistema cria uma `Company type=MEI` com ele como responsável; o `ProviderProfile` permanece **sem** campo de CNPJ. _(Original superseded: "sistema persiste como atributo da Pessoa; busca de Empresas não retorna como Empresa MEI" — não vale mais.)_

- **D-004:** Inspeção visual da tela de ativação: o sponsor confirma que o texto distingue claramente "oferecer" de "contratar" serviço.
