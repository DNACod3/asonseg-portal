# Expectations — USP-043: Consentimentos LGPD por finalidade

**Origem:** AC-043-1 a AC-043-4 do PRD v0.3, ajustados e estendidos. Pedra angular do ADR-0013.

## 1. Cenários de sucesso testáveis

- **E-001:** WHEN a Pessoa ativa um papel ou funcionalidade vinculada a uma das 8 finalidades do ADR-0013 (cadastro, candidatura a vagas, oferta de serviço, contratação de serviço, representação de Empresa, atendimento social, extração de CV via IA, encaminhamento institucional), the system SHALL exibir o termo **específico daquela finalidade** (versão vigente aprovada juridicamente) e exigir aceite explícito antes de prosseguir.

- **E-002:** The system SHALL persistir cada consentimento em **log imutável** (append-only, criptografado, com hash) com: titular (Pessoa), finalidade, versão do termo aceita, data/hora, IP. Falha de gravação aborta a operação.

  *Ajuste do AC-043-2:* explicita log imutável (toca F7 do intent + RNF 6.3).

- **E-003:** The system SHALL permitir à Pessoa visualizar seus consentimentos vigentes em painel próprio, exibindo: **nome humano da finalidade** (não código), descrição curta, base legal LGPD, versão do termo aceita, data do aceite, status (vigente/revogado).

  *Ajuste do AC-043-3:* explicita transparência da base legal (toca F5 do intent).

- **E-004:** WHEN a Pessoa solicita revogação de um consentimento, the system SHALL exigir **confirmação dupla** (modal "tem certeza?") + texto explicativo sobre o que será desativado, e — após confirmação — desativar a funcionalidade vinculada à finalidade revogada conforme **matriz de cascata acordada** (ex.: revogar finalidade 2 cancela candidaturas ativas e bloqueia novas; revogar finalidade 6 desativa edição de ficha social mas mantém histórico — ADR-0008).
  ✅ RESOLVIDO — MECANISMO (ADR-0025): matriz declarativa finalidade→efeitos + verificação `requireActiveConsent` on-read garantem a cascata determinística. ❓ PREENCHIMENTO CONCRETO da matriz (gate de negócio — preservado): a semântica de cada finalidade permanece a definir formalmente pela DPO (Angélica) + jurídico antes da USP-043.

  *Ajuste do AC-043-4:* explicita confirmação dupla + matriz de cascata (toca F2 e F6 do intent).

- **E-005:** WHEN o termo de uma finalidade é atualizado com mudança "major" (mudança de provedor, escopo, base legal), the system SHALL exigir re-aceite de todas as Pessoas com consentimento vigente nessa finalidade. Mudança "minor" (correção de typo, formatação) preserva aceite anterior.
  ✅ RESOLVIDO parcial: a classificação minor/major fica a cargo da DPO (Angélica) + jurídico, caso a caso; mecanismo de versionamento já implementado (ADR-0025).

  *Ajuste:* AC do PRD não cobre versionamento; vem do F3 do intent.

- **E-006:** WHEN a Pessoa ativa múltiplos papéis em sequência, the system SHALL exibir os termos **intercalados** com os respectivos fluxos (não enfileirar 3 modais consecutivos) — defesa contra fadiga de aceite.

  *Ajuste:* AC do PRD não cobre UX intercalada; vem do F4 do intent + ADR-0013.

## 2. Proibições (must-not)

- **P-001 (toca F1 — termo sem revisão jurídica):** O sistema NÃO PODE liberar ativação de papel/funcionalidade vinculada a finalidade cujo termo não tenha sido revisado e aprovado pelo jurídico. Sem termo aprovado por finalidade, **o papel correspondente fica desabilitado em produção**.

- **P-002 (toca F2 — revogação não cascateada):** O sistema NÃO PODE deixar papel/funcionalidade ativa após revogação do consentimento da finalidade correspondente. A cascata é determinística pela matriz acordada — sem janela de "papel ativo mas consentimento revogado".

- **P-003 (toca F3 — mudança major sem re-aceite):** O sistema NÃO PODE continuar tratando dados sob versão de termo "major" antiga após atualização "major" sem re-aceite. Pessoa que não re-aceita tem o papel desativado até aceitar a nova versão (ou revoga explicitamente).

- **P-004 (toca F4 — fadiga de aceite):** O sistema NÃO PODE empilhar 3+ modais de consentimento consecutivos sem que cada aceite esteja intercalado com o fluxo concreto da finalidade. UX que treina o usuário a clicar em "aceito" automaticamente é violação ADR-0013.

- **P-005 (toca F5 — painel opaco):** O sistema NÃO PODE exibir consentimentos no painel da Pessoa apenas por código ou número de finalidade. Nome humano + descrição + base legal são obrigatórios.

- **P-006 (toca F6 — revogação acidental sem reversão):** O sistema NÃO PODE deixar Pessoa que revogou por engano sem caminho de reativação. Re-aceite do consentimento reativa o papel imediatamente (sem precisar re-cadastrar) — desde que a Pessoa ainda exista no sistema.
  ✅ RESOLVIDO (dono do intent): revogação com confirmação simples + reativação via novo aceite (sem re-cadastro). Validação final do texto da UI permanece com jurídico.

- **P-007 (toca F7 — log mutável):** O sistema NÃO PODE armazenar consentimentos em tabela mutável (que pode ser editada/deletada por engenheiro com acesso ao banco). Log é append-only, criptografado, com hash de integridade.

- **P-008:** O sistema NÃO PODE adicionar finalidade nova fora das 8 do ADR-0013 sem decisão formal de produto + revisão jurídica. Conjunto é fechado no MVP.

- **P-009:** O sistema NÃO PODE permitir que coordenador, voluntário ou desenvolvedor com acesso administrativo edite ou apague registros de consentimento — apenas append (revogação cria novo registro de revogação).

## 3. Limites

- **L-001 (Performance):** Aceite de consentimento ≤ 2s p95.
- **L-002 (Auditoria — RNF 6.3):** Log imutável de ativação e revogação, retido conforme ADR-0008.
- **L-003 (Retenção do consentimento):** Indefinida (ADR-0008) — defesa LGPD em incidente exige histórico longo.
- **L-004 (Visibilidade):** Painel "Meus consentimentos" visível apenas à própria Pessoa e ao DPO/diretoria para auditoria.

## 4. Critérios de pronto, do ponto de vista do dono do intent

- **D-001 (gate compliance LGPD — BLOQUEANTE GLOBAL):** Antes desta USP ir para produção:
  - (a) **D-001 do PRD (DPO designado)** confirmado por escrito;
  - (b) **D-002 do PRD (cada um dos 8 termos por finalidade)** revisado e aprovado pelo jurídico, com versão registrada no sistema;
  - (c) **Matriz de cascata de revogação** (E-004) decidida com DPO + jurídico;
  - (d) **Critério minor/major** (E-005) decidido com DPO + jurídico;
  - (e) **Decisão sobre revogação reversível** (P-006) acordada.
  
  Sem qualquer uma dessas 5 peças, esta USP **não vai para produção**. Esta USP é pedra angular — sem ela funcionando, **todas as outras USPs que dependem de consentimento ficam em violação LGPD silenciosa**.

- **D-002:** Uma Pessoa real, em ensaio, ativa 3 papéis em sequência (candidato → prestador → cliente); cada aceite acontece **intercalado** com o fluxo da finalidade correspondente, não em sequência de modais.

- **D-003:** A Pessoa abre painel "Meus consentimentos" e vê os 3 consentimentos vigentes com nome humano ("Candidatura a vagas"), descrição, base legal, versão, data — sem códigos ou jargão.

- **D-004:** A Pessoa revoga finalidade 2 (candidatura). Sistema pede confirmação dupla com texto "isso vai cancelar suas N candidaturas ativas e desativar seu papel candidato — confirme se tem certeza". Após confirmação, papel é desativado, candidaturas canceladas, e-mail enviado às empresas afetadas. Outros consentimentos permanecem.

- **D-005:** Em teste de log imutável: engenheiro com acesso ao banco tenta apagar um registro de consentimento; operação é negada pela infraestrutura (append-only enforçado fora da aplicação) **ou** apagar não remove o histórico cripto-hash (verificável por integridade).

- **D-006:** Em teste de mudança major: jurídico atualiza termo da finalidade 7 (provedor IA muda); todas as Pessoas com consentimento vigente recebem solicitação de re-aceite no próximo login; quem não aceita tem papel desativado até aceitar.

- **D-007:** A AS abre auditoria do consentimento de uma Pessoa específica e vê histórico completo: aceites, revogações, re-aceites — com versões, datas, IPs.

- **D-008:** Em teste de cascata: revogação da finalidade 6 (atendimento social) desativa edição de ficha social mas **mantém histórico** visível à AS com marcação "finalidade revogada em DD/MM/AAAA" (alinhado com USP-039/P-006).
