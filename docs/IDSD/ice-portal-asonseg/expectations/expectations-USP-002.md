# Expectations — USP-002: Cadastro de Pessoa pela assistente social (situação extrema)

**Origem:** AC-002-1 a AC-002-5 do PRD v0.3, ajustados e estendidos.

## 1. Cenários de sucesso testáveis

- **E-001:** WHEN a AS submete o cadastro com nome (obrigatório) e demais campos opcionais, the system SHALL persistir a Pessoa, registrar log de auditoria com a AS responsável + data/hora + dados informados.

- **E-002:** WHERE a AS marca o flag "Pessoa sem documento — exceção", the system SHALL exigir justificativa textual com **conteúdo mínimo significativo** e gravar a marca de exceção no cadastro.
  ✅ RESOLVIDO (dono do intent / AS): justificativa mínima ≥ 20 caracteres em texto livre.

- **E-003:** WHEN o cadastro é concluído sem e-mail e sem senha, the system SHALL permitir que a Pessoa seja referenciada em encaminhamentos (USP-037), ficha social (USP-036) e relatórios, e SHALL impedir login dessa Pessoa por qualquer rota.

- **E-004:** WHEN o atendimento ocorre com termo de consentimento assinado em papel, the system SHALL registrar **a evidência da assinatura física**: data, responsável (AS), referência ao termo e versão.
  ✅ DECIDIDO (dono do intent): data + responsável (AS) no sistema, sem upload obrigatório no MVP. ✅ Redação jurídica validada pelo DPO/jurídico (2026-06-05 — D-002 liberado).

- **E-005:** The system SHALL impedir que o fluxo público de USP-001 marque a flag "Pessoa sem documento — exceção" — apenas o fluxo autenticado da AS ou diretoria pode gravar essa marca.

## 2. Proibições (must-not)

- **P-001 (toca F1 — exceção via público):** O sistema NÃO PODE permitir que a marca "Pessoa sem documento — exceção" seja gravada pelo auto-cadastro público (USP-001), nem via API direta sem autenticação de AS ou diretoria. A marca é privilégio institucional.

- **P-002 (toca F2 — Pessoa sem credencial logando):** O sistema NÃO PODE permitir que uma Pessoa cadastrada sem credencial faça login por qualquer rota — direta, "reativação", recuperação de senha, SSO, ou função administrativa que pule a verificação da USP-003.

- **P-003 (toca F3 — justificativa vazia):** O sistema NÃO PODE aceitar justificativa de exceção vazia, com caractere único, espaços em branco, ou texto manifestamente genérico (ex.: "x", "—", "n/a"). A justificativa precisa ter conteúdo mínimo institucionalmente acordado.

- **P-004 (toca F4 — encaminhamento sem CPF):** O sistema NÃO PODE encaminhar (USP-037) Pessoa sem CPF para vaga de Empresa sem **alerta explícito à AS e à coordenadora antes do envio**, registrando a ciência do alerta antes de prosseguir.
  ✅ RESOLVIDO (dono do intent): alerta + segue (alerta AS/coordenador, mas não bloqueia).

- **P-005 (toca F5 — log sem operador):** O sistema NÃO PODE gravar cadastro de Pessoa pela via AS sem registrar a identidade do operador (AS responsável) no log de auditoria.

- **P-006 (toca F6 — dado sensível em campo livre):** O sistema NÃO PODE permitir que dado pessoal sensível (situação de moradia, vulnerabilidade específica, condição de saúde) seja gravado em campos cujo nível de visibilidade não respeite ADR-0017 (restrição a AS e diretoria). Campos livres genéricos sem proteção de visibilidade ficam fora deste fluxo.

- **P-007:** O sistema NÃO PODE exibir, em telas acessíveis a papel que não seja AS ou diretoria, os dados sensíveis dessa Pessoa (mesmo que a Pessoa exista para outros papéis em outras visões).

## 3. Limites

- **L-001 (Performance):** Tempo de resposta do submit ≤ 2s p95 (§6.1 do PRD), mesmo com a AS em conexão de qualidade moderada (atendimento em sede, internet compartilhada).
- **L-002 (Visibilidade):** Dados desta Pessoa quando criada por esta via SHALL aplicar a regra mais restritiva do ADR-0017 — visíveis somente para AS e diretoria por padrão.
- **L-003 (Auditoria):** Log de cadastro (AS responsável + data/hora + dados informados) imutável por toda a retenção (ADR-0008).

## 4. Critérios de pronto, do ponto de vista do dono do intent

- **D-001:** A AS, em ensaio com voluntário simulando atendimento, cadastra uma Pessoa do início ao fim em ≤ 2 minutos. Validado em ≥ 3 ensaios, com pelo menos um deles em modo "Pessoa sem documento — exceção".

- **D-002 (gate jurídico):** Antes desta USP ir para produção, **D-001 do PRD (DPO)** ou parecer jurídico equivalente confirmou por escrito que (a) o modelo de evidência de consentimento em papel para esta via cobre ADR-0013, e (b) o flag de exceção e a justificativa textual constituem evidência adequada para LGPD. Sem essa confirmação, esta USP **não vai para produção** mesmo que o código esteja pronto.
  ✅ LIBERADO (DPO/jurídico, 2026-06-05): modelo de evidência de consentimento em papel aprovado e texto do atestado validado (`legal/consent-terms/social-assistance/evidence-statement-v1.0.md`). Cobre ADR-0013 e constitui evidência adequada para LGPD — gate liberado para go-live.

- **D-003:** A AS abre a Pessoa recém-cadastrada na visão consolidada (USP-039) e confere que ela aparece, com os campos esperados, com a marca de exceção (quando aplicável) e a justificativa exibida.

- **D-004:** Em teste de bypass: tentativa de submeter, via fluxo público (USP-001) ou via chamada direta à API, o flag "Pessoa sem documento — exceção" é rejeitada com erro determinístico e gera log de tentativa indevida.

- **D-005:** A coordenadora abre a Pessoa em uma sessão como papel não-AS e confere que os dados sensíveis **não aparecem** — visibilidade conservadora atendendo ADR-0017.
