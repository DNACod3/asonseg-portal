# ADR-0028 — Sanitização de PII em texto livre e validação de upload

- **Status:** Accepted
- **Data:** 2026-05-28
- **Decisores:** Arquiteto Bravi, Tech Lead
- **Tags:** segurança, privacidade, LGPD

## Contexto e Problema

Conteúdo livre (descrições, qualificações, fotos, CV) é vetor de vazamento de PII e de conteúdo malicioso. Os intents marcam `(arquitetural-estrutural)`: USP-031/F1 "moderador verifica telefone/e-mail na descrição e fotos? Ou sistema sanitiza no submit?". Os must-not estruturais:

- USP-028/P-002: qualificações na busca ativa não podem exibir PII óbvia (e-mail/telefone/CPF/RG) — sanitização + aviso ao candidato.
- USP-031/P-001: contato escondido em descrição/fotos do serviço deve ser sanitizado (regex) + verificado na moderação.
- USP-009/P-004: upload de CV exige **validação de conteúdo** (não só extensão/tamanho); macro/script rejeitado/sanitizado **antes** do storage e do moderador.
- USP-009/P-007: CV em storage **privado** (não bucket público) — acessível só conforme USP-027.
- USP-040/P-006: whitelist de campos do retorno do LLM (já em ADR-0027).
- USP-044/P-002/P-008: e-mail não vaza PII de terceiros; corpo não é logado em claro.

## Drivers de Decisão

- Defesa em duas camadas (automática + humana) — nenhuma sozinha basta.
- Minimização LGPD; contato só revelado por ação afirmativa (ADR-0017).
- Upload seguro antes de chegar a qualquer leitor.

## Opções Consideradas

### Opção A — Sanitização automática (regex/whitelist) + validação de upload (magic bytes/AV) + storage privado + verificação na moderação
- **Descrição:** (1) Texto livre passa por um **sanitizer** (regex para e-mail/telefone/CPF/RG) que mascara/sinaliza padrões de contato antes de exibir em superfícies públicas/de busca, com aviso ao autor no preenchimento. (2) Upload valida **tipo real por magic bytes**, tamanho, e roda checagem de conteúdo (parser que ignora macro / AV) **antes do storage**. (3) Arquivos em **Supabase Storage privado** com **URL assinada** de curta duração, liberada conforme o View Model (ADR-0022). (4) O moderador (ADR-0024) faz a verificação humana final de fotos/descrição. (5) Templates de e-mail minimizam PII; log de envio guarda só metadados (ADR-0023).
- **Prós:** Cobre vazamento por texto e upload; defesa em profundidade; alinhado a ADR-0017/0022.
- **Contras:** Regex de PII tem falsos positivos/negativos — por isso a moderação humana complementa, não substitui.

### Opção B — Só moderação humana
- **Contras:** Não escala e falha em superfícies sem moderação (busca ativa); viola USP-028/P-002. Rejeitada.

### Opção C — Só sanitização automática
- **Contras:** Regex não pega tudo (contato em foto, ofuscação); precisa do humano. Rejeitada como única camada.

## Decisão

Adotamos a **Opção A** (defesa em profundidade): **sanitizer automático** de PII em texto livre + **validação de upload por magic bytes/AV** + **storage privado com URL assinada** + **verificação humana na moderação**. A whitelist do retorno do LLM (ADR-0027) e a minimização de e-mail (ADR-0023) completam o conjunto.

## Consequências

**Positivas:**
- Vazamento de contato por texto/foto e upload malicioso mitigados em duas camadas.
- CV nunca em bucket público; acesso só por URL assinada conforme papel.

**Negativas (trade-offs aceitos):**
- Falsos positivos do sanitizer podem mascarar texto legítimo — ajustável; o autor é avisado.
- AV/parsing de upload adiciona latência no anexo do CV — aceitável.

**Neutras / a monitorar:**
- Calibrar regex e regras de AV conforme incidentes; logar tentativas bloqueadas.

## Referências

- ADR-0017 (negócio), ADR-0022 (View Models), ADR-0024 (moderação), ADR-0027 (whitelist LLM), `runbook-view-model-visibility`.
- USPs servidas: USP-009, USP-021, USP-022, USP-028, USP-029, USP-031, USP-040, USP-044.
