# Intent — USP-010: Cadastro de prestador de serviço (papel)

**Origem:** PRD v0.3 §5.2, USP-010.
**Dono do intent:** Sponsor + diretoria (LGPD).

## 1. Descrição

Uma Pessoa autenticada ativa o papel prestador de serviço PF. Outcome: papel ativo imediatamente (sem moderação do papel, conforme ADR-0015); fica apta a publicar serviços em nome próprio (USP-029). Pode informar dados fiscais opcionais (CNPJ MEI próprio) sem que isso mude o tipo de cadastro — não vira "PJ" no sistema; PJ é Empresa via USP-012.

## 2. Restrições

- Ativação imediata, sem moderação do papel (ADR-0015 — moderação é do conteúdo, não do papel).
- Consentimento da finalidade "oferta de serviço" (finalidade 3 do ADR-0013) obrigatório antes da ativação.
- CNPJ MEI opcional, não muda o tipo de cadastro do prestador.
- Para publicar em nome de Empresa, prestador deve cadastrar Empresa via USP-012 (não há fluxo automático aqui).

## 3. Cenários de fracasso (de resultado)

**F1. ~~Prestador PF informa CNPJ MEI e o sistema confunde com Empresa.~~ (REVISTO 2026-06-10 — ADR-0031)**

> **Decisão do dono do intent (2026-06-10):** a premissa original de F1 foi **revertida**. O CNPJ MEI **passa a residir em `companies`** (não mais como atributo da Pessoa/papel). Quem tem MEI é Empresa MEI, cadastrada via **fluxo USP-012**; a USP-010 ativa só o papel prestador PF + perfil (foto/descrição/região, **sem** CNPJ). Declarar MEI **redireciona** ao fluxo da USP-012 (cria `Company type=MEI` + responsável). O regime tributário vira enum em `companies` (`CompanyType`: MEI/Simples/Lucro Presumido/Lucro Real/S/A). Consequência consciente: deixa de existir "prestador PF com MEI declarado" como conceito distinto de Empresa MEI; a antiga preocupação de confusão na busca (F1/P-002) torna-se sem objeto. Blast radius: USP-010/012/027/030. Ver **ADR-0031**.

> _Texto original (superseded):_ "AC-010-2 diz 'sem que isso afete o tipo de cadastro'… o CNPJ MEI declarado pelo prestador PF é atributo da Pessoa/papel (não entra na tabela `companies`)." — **não vale mais**.

**F2. Papel ativado sem consentimento da finalidade 3 persistido.**
Mesmo padrão de USP-006/F1 — transação atomicidade.

**F3. Pessoa com papel cliente (USP-011) ativa papel prestador e os dois entram em conflito de UX: a mesma Pessoa contrata serviço e oferece serviço, ficando confusa sobre qual é qual.**
Sem fronteira clara nas telas — Pessoa cadastra "serviço meu" achando que está manifestando interesse em serviço de outro, ou vice-versa.

✅ RESOLVIDO (dono do intent): sim — copy explícita "agora você oferece serviço" na ativação do papel prestador. Impacto técnico: nenhum (UI).

## 4. Cenários de sucesso

**Nível operacional:**
- Pessoa ativa papel prestador em ≤ 60 segundos.
- Próximo passo (publicar primeiro serviço) está claro.

**Nível agregado:**
- MP3 (prestadores ativos com ≥ 1 serviço aprovado) — esta USP é vetor de entrada, mas a confirmação vem com a aprovação do primeiro serviço (USP-016 + USP-029).

## 5. Conexões

**USPs upstream:**
- USP-001 ou USP-006.
- USP-043 (finalidade 3).

**USPs downstream:**
- USP-029.

**ADRs aplicáveis:**
- ADR-0011, ADR-0013, ADR-0015 (papel não é moderado; conteúdo é).

**Métricas tocadas:** MP3 (vetor).

**Riscos relacionados:** RP-003.

**Dependências:** D-002.

**Q-abertas:** —
