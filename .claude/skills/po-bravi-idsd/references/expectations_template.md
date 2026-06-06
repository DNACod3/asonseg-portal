# Template do Expectations file (`expectations-US-NNN.md`)

Cada user story do PRD vira também um arquivo de expectations na pasta `expectations/`. Nome: `expectations-US-NNN.md` (ou `expectations-USP-NNN.md` em projetos com prefixo USP).

## Para que serve

Enquanto o intent file responde "o que se quer", o expectations file responde **"o que conta como pronto"** — no idioma do dono do intent, não no do dev. É o artefato que a esteira de validação (skill de revisão de PR, gate humano antes do merge) consulta pra decidir se a implementação satisfez o que o humano quis.

Ele cobre quatro coisas que o PRD não cobre, ou cobre mal:

1. **Must-do testáveis** (EARS) — o PRD já tem, mas frequentemente ambíguo. Aqui é ajustado.
2. **Must-not** (proibições) — peça nova do método. O que o sistema NÃO PODE permitir, escrito como proibição de resultado.
3. **Limites operacionais por USP** — subset relevante dos NFRs §6 do PRD, ancorado nessa USP.
4. **Critérios de pronto observáveis pelo dono** — substitui o DoD genérico do PRD §8.4 por algo que o sponsor/AS/coordenador checa com os próprios olhos.

## Cabeçalho

```
# Expectations — US-NNN: <título da USP>

**Origem:** AC-NNN-1 a AC-NNN-K do PRD, ajustados e estendidos.
```

## Seção 1 — Cenários de sucesso testáveis

EARS `WHEN…SHALL`, geralmente extraídas/refinadas dos ACs do PRD. Cada E-NNN carrega um **eval stub** — a forma mínima de um teste que o harness consome (não código pronto). Forma:

```
- **E-001:** WHEN <trigger>, the system SHALL <comportamento mensurável>.
  - eval: `given <estado> when <ação> then <resultado observável>` (ou `test-id: <slug>`)
- **E-002:** WHERE <condição>, the system SHALL <comportamento>.
  - eval: `given <estado> when <ação> then <resultado observável>`
```

Quando o AC do PRD precisou de ajuste pra ficar testável, registre no item: "*Ajuste do AC-NNN-X*: <o que mudou e por quê>". Não simplesmente copie o AC — refine.

**Exemplo:**

```
- **E-001:** WHEN o visitante submete nome, CPF válido, e-mail novo, senha que satisfaz a política, CAPTCHA aprovado, ao menos um papel público escolhido e aceite explícito do termo da finalidade desse papel, the system SHALL persistir Pessoa + credencial + papel(éis) + consentimento(s) — com versão, data e IP — em transação única, enviar e-mail de boas-vindas e gravar log de auditoria.

  *Ajuste do AC-001-1*: explicitada a atomicidade da operação e o consentimento como pré-condição.
  - eval: `given visitante com dados válidos e consentimento da finalidade aceito when submete cadastro then existe 1 Pessoa + 1 credencial + N consentimentos versionados na mesma transação, e-mail disparado, log gravado`
```

## Seção 2 — Proibições (must-not)

**A seção mais importante e a que mais diferencia ICE.** Cada proibição é escrita como:

```
- **P-NNN (toca F-X do intent):** O sistema NÃO PODE <ação ou estado inaceitável>.
  - eval (negativo): `given <condição> when <ação> then o sistema REPROVA se <estado proibido observado>`
```

Cada proibição tem:

- **ID** (`P-NNN`)
- **Referência cruzada** ao fracasso F1, F2… do intent file que essa proibição mitiga
- **Texto da proibição** no idioma do dono, começando com "O sistema NÃO PODE"
- **Eval stub negativo** — descreve a condição que, se observada, *reprova*. É isto que torna o fracasso de resultado executável e não só nomeado. Sem eval stub negativo, o P-NNN é boa intenção, não proibição.

Quando uma proibição depende de decisão pendente, marque ❓ inline.

**Exemplos:**

```
- **P-001 (toca F1 — race condition):** O sistema NÃO PODE criar duas Pessoas com mesmo CPF, mesmo sob submits simultâneos. Equivalente em SQL: unique constraint em persons.cpf + 409 determinístico no segundo, nunca 500.
  - eval (negativo): `given 10 submits concorrentes com mesmo CPF when processados then REPROVA se existir mais de 1 Pessoa com aquele CPF, ou se algum retorno for 500 em vez de 409`

- **P-002 (toca F3 — papel sem consentimento):** O sistema NÃO PODE ativar nenhum papel público antes do consentimento da finalidade correspondente estar persistido.
  - eval (negativo): `given papel público pendente sem consentimento persistido when consultado o estado do papel then REPROVA se o papel estiver ativo`

- **P-003:** O sistema NÃO PODE armazenar senha em texto claro nem com algoritmo legado (MD5, SHA-1).
  ❓ Cost factor mínimo do bcrypt em 2026 a definir. (técnico)
  - eval (negativo): `given uma credencial persistida when inspecionado o hash then REPROVA se for texto claro, MD5 ou SHA-1`
```

**Anti-padrões:**

- ❌ "P-001: O sistema NÃO PODE permitir input inválido." → isso é fracasso de entrada, vai em `IF…THEN` do AC.
- ❌ "P-001: O sistema NÃO PODE crashar." → não é proibição de resultado, é qualidade de software.
- ❌ "P-001: O backend NÃO PODE chamar o frontend síncrono." → isso é decisão técnica, vai em ADR técnico.

**Regra**: se a proibição não está no idioma do dono do intent (sponsor, AS, coordenador), refine — ela está vazada da camada técnica.

## Seção 3 — Limites

Performance, segurança, retenção, taxa, custo específicos dessa USP. Subset relevante dos NFRs §6 do PRD ancorado aqui, com IDs `L-NNN`.

```
- **L-001 (Performance):** Tempo de resposta do submit ≤ 2s p95 (§6.1 do PRD).
- **L-002 (Rate limiting):** Máximo N submissões por IP por janela de M minutos.
  ❓ N e M ainda a definir. (técnico)
- **L-003 (Retenção):** Auth_attempts retidos por 90 dias para análise anti-bot.
  ❓ Confirmação com compliance. (dono do intent + jurídico)
```

Critério: limite que se aplica especificamente a essa USP entra aqui. NFR transversal (todas as USPs) fica em §6 do PRD e é referenciado sem ser duplicado.

## Seção 4 — Critérios de pronto, do ponto de vista do dono do intent

Substitui o DoD genérico do PRD §8.4 ("código revisado, deploy validado, aprovação do PO") por critérios **observáveis pelo dono**.

Cada critério é uma observação que o sponsor/AS/coordenador faz com os próprios olhos para considerar a USP fechada. IDs `D-NNN`.

**Forma**:

- Começa com um verbo de observação ("O coordenador consegue…", "Em ensaio com…", "Conferir que…")
- Inclui o sujeito que faz a observação (quem)
- É verificável em produto, não em código

**Exemplo:**

```
- **D-001:** Uma Pessoa real da comunidade (fora do time Bravi), em celular de baixo desempenho, conclui o auto-cadastro do início ao fim em < 3 minutos sem ajuda. Validado com ≥ 3 testes desse tipo.

- **D-002:** Em janela de teste de carga sintética simulando 10 submits simultâneos com mesmo CPF, zero Pessoas duplicadas e mensagem de erro determinística no segundo submit em diante.

- **D-003:** O painel pós-cadastro mostra próximo passo claro para o papel ativado (não cai numa home genérica) — verificado por papel.
```

**Anti-padrões:**

- ❌ "D-001: Testes unitários passam." → DoD técnico, não do dono.
- ❌ "D-001: Code review aprovado." → DoD de processo, não do intent.
- ❌ "D-001: O sistema funciona." → vago demais; não verificável.

**Regra**: cada D-NNN tem que ser uma cena que o dono *vê* acontecer ou *executa* ele mesmo. Se um dev pode passar o teste sem o dono ver, não é critério do dono.

## Quando o expectations file bloqueia a USP em produção

Em pelo menos um caso, o expectations file declara uma USP como **bloqueada em produção mesmo com código pronto**: quando há uma proibição que depende de decisão jurídica/compliance/sponsor ainda em aberto.

Forma:

```
- **D-001 (gate compliance):** Antes desta USP ir para produção, <responsável externo, ex: jurídico via D-002 do PRD> confirma por escrito que <decisão pendente, ex: o modelo de consentimento escolhido cobre ADR-XXXX>. Sem essa confirmação, esta USP **não vai para produção** mesmo que o código esteja pronto.
```

Esse tipo de critério é raro mas decisivo — força o gate humano (revisão por USP antes do merge) a verificar coisa que não está no código.

## Checklist de qualidade

Antes de fechar o expectations file:

- [ ] Cenários de sucesso (E-NNN) são testáveis, ajustes documentados quando saem do AC original
- [ ] Cada E-NNN tem eval stub positivo (given/when/then ou test-id)
- [ ] Cada must-not (P-NNN) é proibição de resultado, no idioma do dono, com âncora explícita a fracasso F-X do intent
- [ ] Cada P-NNN tem eval stub negativo (a condição que reprova) — sem ele, a proibição não é executável
- [ ] Cada limite (L-NNN) é específico à USP, não duplicação de NFR transversal
- [ ] Cada critério de pronto (D-NNN) é observação do dono, não DoD técnico ou de processo
- [ ] Quando há decisão pendente que bloqueia produção, há D-NNN explícito marcando isso como gate
- [ ] ❓ inline classificados (dono / técnico / arquitetural-estrutural)
- [ ] Nenhuma proibição duplica AC do PRD (isso é must-do, não must-not)
