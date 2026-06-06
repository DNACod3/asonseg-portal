# Template do Intent file (`intent-US-NNN.md`)

Cada user story do PRD vira um arquivo de intent na pasta `intents/`. O nome do arquivo é `intent-US-NNN.md`, com NNN igual ao ID da USP no PRD (ou `intent-USP-NNN.md` quando o projeto usa prefixo USP).

## Por que existe um arquivo separado se o PRD já tem a US

A US do PRD é a apresentação humana — formato "como X, quero Y, para Z" + AC em EARS. Ela é boa pra cliente ler e aprovar, mas mistura quatro coisas que o método ICE quer separadas:

1. O que o usuário quer (intent)
2. O que conta como pronto (expectations)
3. O que limita o como (restrições, NFRs)
4. O que pode acontecer no mundo que é inaceitável (fracasso de resultado)

O arquivo de intent extrai a **dimensão do intent** com as cinco partes que o método pede, deixando expectations para o arquivo irmão (`expectations-US-NNN.md`).

## Cabeçalho

```
# Intent — US-NNN: <título da USP>

**Origem:** PRD <projeto> v<versão> §5.2, US-NNN.
**Dono do intent:** <papel(éis) institucional(is) — sponsor, AS, coordenador, diretoria, jurídico, conforme o caso>
```

O campo "Dono do intent" é obrigatório. Não é "PO" nem "Tech Lead" — é **quem julga se o resultado é aceitável** no idioma do cliente. Se a USP tem múltiplos donos (frequentemente quando cruza LGPD + operação), liste todos.

## 1. Descrição

Prosa curta (2–4 parágrafos) descrevendo o outcome no idioma do dono. Não é o ato ("o usuário clica e o sistema persiste") — é o resultado ("o candidato real, com CPF e e-mail válidos, fica autenticado e pronto pra usar o portal").

Tipicamente inclui:

- O outcome em si
- Por que essa USP existe (sua função no sistema maior)
- Sinalização explícita quando a USP é fundacional/transversal/de alto risco

**Anti-padrão:** repetir a frase "Como X, quero Y, para Z" do PRD. Isso é eco, não descrição.

## 2. Restrições

Lista de condições que limitam o "como". Cada restrição é uma frase curta. Combina:

- Restrições do PRD §3 (premissas, restrições, out-of-scope)
- NFRs específicos da USP (performance, segurança, retenção)
- Decisões de ADRs aplicáveis que constraem essa USP
- Gates de consentimento/LGPD relevantes

Quando uma restrição tem decisão técnica pendente, marque inline com `❓ <pergunta> (técnico)` ou `❓ <pergunta> (arquitetural-estrutural)`.

**Exemplo:**

```
- CPF obrigatório no auto-cadastro público. Exceção só via USP-002 (AS).
- Hash de senha bcrypt ou equivalente vigente (§6.3).
  ❓ Cost factor mínimo em 2026? "Padrão vigente" não é meta verificável. (técnico)
- Consentimento da finalidade do papel aceito antes do papel virar ativo (ADR-0013).
```

## 3. Cenários de fracasso (de resultado)

A seção mais importante e a que mais distingue intent de PRD. Cada fracasso é numerado `F1, F2…` e tem duas partes:

- **Título curto** descrevendo o que acontece no mundo
- **Descrição em prosa** explicando como o fracasso se materializa mesmo quando todos os ACs do PRD passam

Em seguida, ❓ classificados quando há decisão pendente que afeta esse fracasso.

**Critério para incluir um fracasso aqui**: deve ser algo que (a) é inaceitável para o dono do intent, e (b) NÃO está coberto pelas cláusulas `IF…THEN` do AC do PRD. Validação de input não conta — ela vive nas EARS.

**Exemplo (USP-001 do Portal ASONSEG):**

```
**F1. Pessoa duplicada por race condition.**
Dois submits simultâneos com o mesmo CPF e e-mails diferentes; os dois passam pela validação isolada e ambos persistem. CPF deixa de identificar Pessoa unicamente; relatórios contam em dobro.

❓ O PRD diz CPF único (AC-001-3) mas não escreve o comportamento sob concorrência. Unique constraint no banco + 409 no segundo? Lock pessimista? (arquitetural-estrutural) — vira ADR técnico.
```

**Anti-padrão:** "F1. Usuário insere CPF inválido." Isso é fracasso de entrada, já coberto por `IF…THEN` no AC. Não vai aqui.

Cada fracasso F1, F2… deve ter um **must-not correspondente no expectations file**. Se você não consegue escrever a proibição, o fracasso está vago demais — refine.

## 4. Cenários de sucesso

Sucesso em dois níveis:

**Nível operacional (por sessão/transação):**
- O que o dono observaria como "isso funcionou" em uma execução individual.
- Tipicamente envolve tempo, completude, encaminhamento correto.

**Nível agregado (métricas do PRD):**
- Quais métricas (MP1, MP2…) essa USP contribui.
- Se métrica não tem meta absoluta ainda, marque ❓.

**Exemplo:**

```
**Nível operacional:**
- Pessoa real conclui o cadastro em fluxo único e fica autenticada.
- E-mail de boas-vindas chega em < 1 minuto.
- ❓ Meta de tempo total a definir. Proposta: ≤ 3 minutos, ≥ 70% de taxa de conclusão. (dono do intent)

**Nível agregado:**
- MP1, MP2, MP3 começam neste fluxo.
- ❓ Metas absolutas pendentes do sponsor (D-004 / QP-007). (dono do intent)
```

## 5. Conexões

A seção que torna a matriz de conexões viva por USP. Estrutura fixa:

```
**USPs upstream** (precisam existir antes ou em paralelo):
- USP-XXX — <razão da dependência>
- USP-YYY — <razão>

**USPs downstream** (dependem deste intent):
- USP-AAA — <como depende>
- USP-BBB — <como depende>

**ADRs aplicáveis:**
- ADR-NNNN (<título curto>)
- ADR-MMMM (<título curto>)

**Métricas tocadas:** MP1, MP2, …

**Riscos relacionados:** RP-001, RP-005, …

**Dependências:** D-001, D-002, …

**Q-abertas:** QP-003, QP-007, …
```

**Critério de qualidade**: se uma USP referencia um ADR ou um risco, esse ADR/risco precisa também referenciar a USP de volta (na matriz de conexões, lookups inversos). Sem reciprocidade, há erro de mapeamento em um dos dois lados.

## Checklist de qualidade do intent file

Antes de fechar o arquivo:

- [ ] Dono do intent identificado, é pessoa/papel institucional, não "PO"
- [ ] Descrição é sobre outcome no idioma do dono, não eco da US
- [ ] Restrições não duplicam o que já está no §6 do PRD — extraem o que importa pra essa USP
- [ ] Cada fracasso F1, F2… é fracasso de resultado, não de input
- [ ] Cada fracasso tem ❓ classificado quando há decisão pendente
- [ ] Cenários de sucesso distinguem operacional de agregado
- [ ] Conexões cobrem upstream, downstream, ADRs, métricas, riscos, deps, Q-abertas — sem campo vazio sem justificativa
- [ ] Cada conexão é reciprocada na matriz e no arquivo da USP-vínculo

Quando algum item falhar, refine antes de marcar o arquivo como pronto para a fase de revisão pelo dono do intent.
