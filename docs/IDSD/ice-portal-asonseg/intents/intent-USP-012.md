# Intent — USP-012: Cadastro de Empresa (pela Pessoa que se torna responsável)

**Origem:** PRD v0.3 §5.2, USP-012.
**Dono do intent:** Sponsor + diretoria + coordenador (anti-fraude na primeira vaga).

## 1. Descrição

Uma Pessoa autenticada cadastra uma Empresa (CNPJ regular ou MEI), informando razão social, nome fantasia, setor, descrição e endereço. Outcome: Empresa persistida no sistema com vínculo automático de Pessoa↔Empresa tipo "responsável" (a quem cadastrou), marcada como "não verificada" até a primeira vaga ser aprovada — momento em que o coordenador faz a verificação manual (USP-017). Empresa não tem login próprio (ADR-0014); todas as operações em nome dela são feitas pela(s) Pessoa(s)-responsável(eis), com rastreabilidade individual.

USP de alta concentração de risco — porta de entrada do **vetor RP-005 (empresa-fantasma)**. Validação por dígito de CNPJ não basta — é o coordenador que filtra na USP-017.

## 2. Restrições

- CNPJ obrigatório, validado por dígito verificador (AC-012-2).
- CNPJ único no portal — se já existe, o sistema oferece o fluxo "solicitar inclusão como responsável" notificando os responsáveis atuais (AC-012-3).
- Empresa nasce marcada como "não verificada".
- Vínculo Pessoa↔Empresa tipo "responsável" criado automaticamente (ADR-0014).
- Consentimento da finalidade "representação de empresa" (finalidade 5 do ADR-0013) obrigatório.

## 3. Cenários de fracasso (de resultado)

**F1. Empresa-fantasma cadastrada com CNPJ válido (dígito ok) mas sem existência real.**
Entrada do vetor RP-005. CNPJ por dígito é trivialmente gerável; sem consulta à Receita (out-of-scope explicitamente — §3.2), a defesa fica toda na USP-017 (coordenador inspeciona dados ao moderar a primeira vaga). Falha de USP-017 → empresa-fantasma aprovada → vaga visível na busca.

❓ Lista de verificação ("checklist") do coordenador para inspeção da Empresa na primeira vaga ainda é entregável de Fase 0. Sem ela, USP-017 fica subjetiva. (dono do intent — coordenador + Bravi PO)

**F2. CNPJ já existente: fluxo de "solicitar inclusão como responsável" abre vetor de aquisição hostil.**
AC-012-3 abre fluxo de inclusão. Pessoa terceira solicita "incluir-me como responsável" da Empresa X que já existe; responsáveis atuais não veem a notificação a tempo (e-mail spam, conta abandonada) ou alguém aprova por engano. Pessoa terceira passa a publicar vagas em nome da Empresa.

✅ RESOLVIDO (dono do intent): o(s) responsável(is) atual(is) aprova(m); prazo de 7 dias; sem resposta → expira NEGADO (Empresa não muda) — protege contra aquisição hostil (RP-005). Impacto técnico mínimo: tabela simples de solicitação + e-mail via outbox; não afeta os ADRs.

**F3. Pessoa que cadastrou Empresa pode editar CNPJ depois (USP-015) e contornar o gate de verificação inicial.**
USP-015/AC-015-2 prevê re-verificação ao editar CNPJ — mas se houver bypass, Empresa "verificada" continua verificada com CNPJ novo não inspecionado. RP-005 vetor pós-verificação.

**F4. Vínculo Pessoa↔Empresa criado mas papel "empresa-responsável" não ativado na Pessoa, ou vice-versa.**
Atomicidade quebrada — Pessoa fica com Empresa associada mas sem o papel ativo (não vê o link "publicar vaga"), ou papel ativo sem Empresa (vê o link mas não tem onde publicar).

✅ RESOLVIDO (ADR-0020 / TD §4.4): as 4 escritas (criar Empresa + vínculo + ativar papel empresa-responsável + consentimento finalidade 5) rodam numa transação Prisma única em `companies.cadastrarEmpresa` — falha em qualquer ponta aborta tudo. CNPJ duplicado → 409 determinístico (ADR-0021).

**F5. Dados pessoais da Pessoa-responsável vazam acidentalmente na exposição pública da Empresa.**
Na home, na busca de serviços, ou no detalhe da Empresa, o sistema exibe inadvertidamente nome do responsável quando deveria mostrar só dados corporativos. Quebra ADR-0017 (visibilidade conservadora).

## 4. Cenários de sucesso

**Nível operacional:**
- Pessoa cadastra Empresa em ≤ 3 minutos com dados básicos.
- Sistema bloqueia CNPJ inválido (dígito) e CNPJ duplicado.
- Empresa fica visível para a Pessoa-responsável publicar primeira vaga (USP-020).
- Empresa não aparece na home pública nem como "verificada" até USP-017 aprovar.

**Nível agregado:**
- MP2 (Empresas verificadas) — esta USP é entrada; confirmação só com USP-017.

## 5. Conexões

**USPs upstream:**
- USP-001 ou USP-006 (papel empresa-responsável ativo).
- USP-043 (finalidade 5).

**USPs downstream:**
- USP-013, USP-014, USP-015 (gestão de vínculos).
- USP-017 (verificação manual na primeira vaga).
- USP-020 (publicar vaga em nome da Empresa).
- USP-027 (lista de candidatos da vaga).
- USP-029 (publicar serviço em nome da Empresa).

**ADRs aplicáveis:**
- ADR-0011, ADR-0013 (finalidade 5), ADR-0014 (Empresa sem login N:N).

**Métricas tocadas:** MP2 (vetor).

**Riscos relacionados:** RP-005 (entrada — defesa principal em USP-017).

**Dependências:** D-002.

**Q-abertas:** —
