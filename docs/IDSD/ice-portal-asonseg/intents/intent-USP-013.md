# Intent — USP-013: Adicionar responsável a uma Empresa

**Origem:** PRD v0.3 §5.2, USP-013.
**Dono do intent:** Diretoria (LGPD — busca por Pessoa expõe ou não dados?) + sponsor.

## 1. Descrição

Uma Pessoa-responsável atual de uma Empresa adiciona outra Pessoa (que precisa estar pré-cadastrada no portal — sem convite por e-mail no MVP) como responsável adicional. Outcome: vínculo Pessoa↔Empresa tipo "responsável" criado para a nova Pessoa; ela passa a poder operar em nome da Empresa; e-mail informa o vínculo (USP-044).

## 2. Restrições

- Pessoa a ser adicionada precisa estar pré-cadastrada (AC-013-2). Sem convite por e-mail no MVP.
- E-mail informativo enviado à nova Pessoa-responsável (AC-013-3).
- Busca por CPF ou e-mail (AC-013-1).
- Auditoria do vínculo criado.

## 3. Cenários de fracasso (de resultado)

**F1. Busca por CPF revela existência de Pessoa no portal a quem não devia saber.**
AC-013-1 permite buscar por CPF — se o sistema mostra "Pessoa encontrada: João Silva" antes da confirmação de adição, virou vetor de descoberta de quem está cadastrado. Atacante com lista de CPFs descobre quem é Pessoa do portal.

✅ RESOLVIDO (dono do intent): resposta binária "Pessoa encontrada / não encontrada", sem nome nem PII até o aceite — coerente com ADR-0022 + anti-enumeração (ADR-0029). Impacto técnico: nenhum.

**F2. Pessoa é adicionada sem ser informada antes da operação consumar.**
AC-013-3 envia e-mail informativo **depois** da criação. Pessoa pode ser vinculada a Empresa sem sua aprovação prévia. Cenário: ex-funcionário, parente desavisado, ou alguém com CPF/e-mail conhecido vira "responsável" de Empresa que ela não quer representar. LGPD problemática.

✅ RESOLVIDO (dono do intent): sim — aceite explícito obrigatório; o vínculo fica "pendente" até a Pessoa aceitar (LGPD). Impacto técnico mínimo: status "pendente" em company_responsibles (tabela já existe) + e-mail via outbox.

**F3. Pessoa adicionada sem o papel "empresa-responsável" ativo na sua conta.**
Atomicidade quebrada: vínculo criado, mas papel "empresa-responsável" não ativado na Pessoa. Resultado: vínculo existe no banco mas Pessoa não vê a Empresa nem consegue publicar.

**F4. Múltiplas adições simultâneas da mesma Pessoa à mesma Empresa criam vínculos duplicados.**
Race condition na criação de vínculo — se duas Pessoas-responsáveis adicionam a mesma Pessoa simultaneamente, ficam dois vínculos. Não quebra a função mas suja auditoria.

## 4. Cenários de sucesso

**Nível operacional:**
- Responsável atual encontra Pessoa por CPF/e-mail, confirma adição, vínculo criado.
- Pessoa adicionada recebe e-mail informativo em < 1 minuto.
- Após login, Pessoa adicionada vê a Empresa nas suas opções de operação.

**Nível agregado:**
- Sem métrica MP direta.

## 5. Conexões

**USPs upstream:**
- USP-012 — Empresa existe.
- USP-001 — Pessoa-alvo pré-cadastrada.

**USPs downstream:**
- USP-014, USP-020, USP-029.

**ADRs aplicáveis:** ADR-0014, ADR-0017 (cuidado na busca — não vazar existência).

**Métricas tocadas:** —

**Riscos relacionados:** Risco proposto: revelação inadvertida de existência de Pessoa via busca por CPF/e-mail. Risco proposto: adição não consentida.

**Dependências:** —

**Q-abertas:** —
