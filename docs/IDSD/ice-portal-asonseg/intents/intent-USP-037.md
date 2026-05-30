# Intent — USP-037: Encaminhar Pessoa para vaga

**Origem:** PRD v0.3 §5.2, USP-037.
**Dono do intent:** Assistente social (responsável principal pelo encaminhamento institucional). Coordenador e voluntário delegado (USP-008) também podem operar.

## 1. Descrição

Assistente social, coordenador ou voluntário com permissão delegada (item 7 do catálogo do ADR-0001 estendido) abre uma vaga ativa e encaminha uma Pessoa cadastrada para ela. Outcome: encaminhamento (entidade própria do ADR-0016) é persistido; se a Pessoa ainda não tem papel candidato ativo, sistema ativa o papel automaticamente; uma candidatura é gerada com badge "Candidato encaminhado pela ASONSEG" e visibilidade ao olhar da Empresa (USP-027). Pessoa recebe e-mail informativo. Esse é o **diferencial institucional do Portal** — ponte ativa entre a comunidade atendida e o mercado de trabalho.

## 2. Restrições

- Operador precisa ter papel AS, coordenador ou voluntário com permissão "Encaminhar Pessoa para vaga" delegada via USP-008 (ADR-0001 estendido) (PRD §5, USP-037).
- Pessoa precisa existir (USP-001 ou USP-002).
- Vaga precisa estar em status "ativo" (AC-037-7).
- Se Pessoa não tem papel candidato ativo, sistema ativa automaticamente (AC-037-2). Sem aceite prévio da Pessoa (decidido no ADR-0016 — Bloco 6 da elicitação).
- Se Pessoa não tem CV anexo, resumo profissional textual é obrigatório (AC-037-3, ADR-0016).
- Motivo opcional (AC-037-4).
- Encaminhamento gera candidatura com badge "ASONSEG" (AC-037-5, ADR-0016).
- E-mail informativo à Pessoa encaminhada (AC-037-5, USP-044, AC-044-6).
- Múltiplos encaminhamentos da mesma Pessoa para vagas diferentes permitidos (AC-037-6).
- Consentimento "encaminhamento institucional" (finalidade 8 do ADR-0013) precisa estar ativo para a Pessoa (D-002 — termo precisa cobrir explicitamente).
- DPO designado (D-001) — RP-002.

## 3. Cenários de fracasso (de resultado)

**F1. Sem aceite prévio da Pessoa, encaminhamento expõe identidade dela a empresa sem consentimento atualizado.**
Decisão consciente do ADR-0016: sem aceite prévio (público-alvo é digitalmente menos engajado). Termo da finalidade 8 do ADR-0013 precisa cobrir explicitamente que ASONSEG pode encaminhar sem confirmar a cada vez. Se termo não cobre, encaminhamento expõe sem base legal sólida. RP-003.

✅ RESOLVIDO parcial (compliance LGPD): D-001 resolvida (DPO = Angélica). ❓ Redação do termo da finalidade 8 cobrindo "encaminhamento sem aceite prévio caso a caso" permanece com jurídico (D-002).

**F2. Pessoa encaminhada com perfil incompatível à vaga prejudica a confiança da Empresa no badge ASONSEG.**
Mencionado no ADR-0016 (consequência negativa). Encaminhador usa bom senso, mas erra; Empresa recebe candidato divergente e questiona a "curadoria institucional". RP institucional.

✅ RESOLVIDO (dono do intent): treinamento textual ao encaminhador antes da concessão da permissão; coordenador revisa amostragem trimestral (operacional, fora do sistema).

**F3. Pessoa encaminhada não consulta e-mail e descobre que está candidata só quando empresa contata — surpresa desconfortável.**
Sem aceite prévio. E-mail é informativo (AC-037-5) mas Pessoa pode não checar (público com baixo letramento digital — RNF 6.5). Empresa entra em contato; Pessoa não sabe por quê. Sentimento de "fui usada".

✅ RESOLVIDO parte UX (dono do intent): template explícito "você foi encaminhada por X da ASONSEG porque ..." (motivo do AC-037-4 incluído). ❓ Redação final do texto permanece com jurídico (D-002).

**F4. Encaminhamento sem CV + resumo profissional fraco resulta em rejeição certa da Empresa.**
AC-037-3 obriga resumo profissional se sem CV — mas qualidade do resumo varia. Encaminhador apressado escreve "ela quer trabalhar" e nada mais. Candidatura entra com badge ASONSEG mas substância vazia.

✅ RESOLVIDO (dono do intent): resumo profissional ≥ 50 caracteres validado no submit (tunável); orientação textual no formulário.

**F5. Múltiplos encaminhamentos da mesma Pessoa para muitas vagas similares = "spray and pray" institucional.**
AC-037-6 permite múltiplos. Encaminhador sem critério dispara Pessoa para 10 vagas similares na esperança de pegar uma. Empresa que recebe ASONSEG várias vezes para a mesma pessoa perde respeito pelo badge.

✅ RESOLVIDO (dono do intent): não — sem controle automático no MVP; treinamento + amostragem trimestral do coordenador cobrem. Impacto técnico: nenhum.

**F6. Vaga foi rebaixada para "em moderação" (USP-023 — Empresa editou) entre o momento que o encaminhador a viu e o submit — AC-037-7 bloqueia mas erro pode ser silencioso.**
Encaminhador estava finalizando o formulário; Empresa-responsável editou a vaga. Vaga deixa de estar ativa. Submit do encaminhador é negado por AC-037-7. Trabalho perdido sem feedback claro.

✅ RESOLVIDO (dono do intent): sim — quando a vaga volta a moderação durante o encaminhamento, o sistema avisa e salva o encaminhamento como rascunho. Impacto técnico: nenhum (UI + estado de rascunho).

**F7. Atomicidade: persistir encaminhamento + ativar papel candidato + gerar candidatura + enviar e-mail.**
Quatro efeitos colaterais. Falha parcial em qualquer um deixa estado inconsistente.

✅ RESOLVIDO (ADR-0020 / TD §4.3): ativa papel candidato (se ausente) + encaminhamento + candidatura (via_encaminhamento) + auditoria numa transação Prisma (`withAudit` na mesma transação); e-mail informativo via `outbox` pós-commit com retry.

**F8. Permissão "Encaminhar" delegada a voluntário acabou sendo concedida amplamente sem revisão.**
ADR-0001 estendido — permissão delegável. Coordenador delega para voluntário recém-chegado sem treinamento adequado, e voluntário começa a encaminhar Pessoas indiscriminadamente.

✅ RESOLVIDO (dono do intent): revisão trimestral da permissão "Encaminhar Pessoa" por coordenador + diretoria (operacional).

## 4. Cenários de sucesso

**Nível operacional:**
- AS acompanha Pessoa em atendimento social, identifica vaga compatível, encaminha → candidatura gerada com badge ASONSEG → Empresa vê na lista de candidatos (USP-027) com badge.
- Pessoa recebe e-mail informativo com motivo.
- Empresa contata Pessoa fora do sistema → resultado registrado em USP-038 (manual).

**Nível agregado:**
- **MP8** — número de encaminhamentos criados. Métrica direta do diferencial institucional ADR-0016.
- **MP9** (via USP-038) — % de encaminhamentos contratados. Materializa impacto social do Portal.

## 5. Conexões

**USPs upstream:** USP-001 ou USP-002 (Pessoa existe), USP-020 + USP-016 (vaga ativa), USP-008 (permissão delegada para voluntário), USP-043 (consentimento finalidade 8), USP-036 (ficha social informa o encaminhador, mas não é obrigatória para encaminhar — Pessoa pode ser encaminhada mesmo sem ficha social — ADR-0016 + Bloco 7).

**USPs downstream:** USP-027 (Empresa vê com badge), USP-038 (registrar resultado), USP-039 (visão consolidada inclui encaminhamentos), USP-044 (e-mail informativo).

**ADRs aplicáveis:** ADR-0001 (permissão delegável "Encaminhar"), ADR-0011 (Pessoa unificada — encaminhamento opera sobre Pessoa, beneficiária ou não), ADR-0013 (consentimento finalidade 8), ADR-0016 (encaminhamento como entidade do domínio social), ADR-0017 (visibilidade — badge visível a Empresa após encaminhamento).

**Métricas tocadas:** MP8 (encaminhamentos criados).

**Riscos relacionados:** RP-002 (DPO), RP-003 (termo finalidade 8 cobrindo encaminhamento sem aceite prévio). Risco proposto: badge ASONSEG desgastado por encaminhamentos de baixa qualidade. Risco proposto: permissão "Encaminhar" delegada sem revisão.

**Dependências:** D-001 (DPO), D-002 (termo finalidade 8).

**Q-abertas:** —
