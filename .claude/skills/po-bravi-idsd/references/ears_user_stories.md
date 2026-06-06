# EARS para User Stories e Critérios de Aceitação

EARS (Easy Approach to Requirements Syntax) é o formato obrigatório para critérios de aceitação no PRD da Bravi. A escolha não é estética — é operacional: cada AC em EARS mapeia direto para 1 caso de teste, sem interpretação intermediária.

## Por que EARS

Antes de EARS, AC típico era assim:
> "O sistema deve cadastrar produtos corretamente."

Problemas:
- "Corretamente" é subjetivo — quem define?
- Não diz o que acontece em caso de erro
- Não diz quando o comportamento se aplica
- Impossível derivar caso de teste sem inventar

Com EARS:
> WHEN o analista submete o formulário com campos obrigatórios preenchidos, the system SHALL persistir o produto e exibir confirmação em até 2 segundos.

Agora temos: trigger explícito, comportamento normativo (`SHALL`), condição de sucesso mensurável. Caso de teste sai direto.

## Os 5 padrões

EARS tem cinco padrões. **Use o que se aplica** — não force o mesmo padrão em todos.

### 1. Ubiquitous (sempre ativo)

```
The system SHALL [requirement].
```

Para comportamento que vale sempre, sem trigger específico.

**Exemplos:**
- The system SHALL armazenar senhas usando hash bcrypt com cost factor mínimo 12.
- The system SHALL registrar em log de auditoria toda alteração de pedido.

### 2. Event-driven (reação a evento)

```
WHEN [trigger], the system SHALL [requirement].
```

Para comportamento desencadeado por evento ou ação do usuário.

**Exemplos:**
- WHEN o usuário clica em "Aprovar pedido", the system SHALL alterar o status para "Aprovado" e disparar notificação ao solicitante.
- WHEN um pagamento é confirmado pela operadora, the system SHALL atualizar o status do pedido para "Pago" em até 30 segundos.

### 3. State-driven (durante um estado)

```
WHILE [state], the system SHALL [requirement].
```

Para comportamento que vale enquanto o sistema está em determinado estado.

**Exemplos:**
- WHILE o pedido está em status "rascunho", the system SHALL permitir edição irrestrita ao analista que o criou.
- WHILE o usuário não tiver completado o cadastro de dados fiscais, the system SHALL exibir banner persistente solicitando completar o cadastro.

### 4. Unwanted behavior (tratamento de erro/exceção)

```
IF [unwanted condition], THEN the system SHALL [response].
```

Para tratamento de erro, validação ou condição que precisa ser bloqueada.

**Exemplos:**
- IF qualquer campo obrigatório estiver vazio, THEN the system SHALL impedir o submit e destacar visualmente os campos faltantes.
- IF o token de autenticação expirar durante uma operação, THEN the system SHALL preservar o estado da operação e solicitar re-autenticação.
- IF o serviço de NF-e estiver indisponível, THEN the system SHALL enfileirar a emissão e notificar o usuário sobre o atraso.

### 5. Optional feature (comportamento condicional)

```
WHERE [feature/flag/config], the system SHALL [requirement].
```

Para comportamento dependente de configuração, flag ou tipo de cliente.

**Exemplos:**
- WHERE o cliente tem plano Premium habilitado, the system SHALL permitir export de relatórios em formato Excel.
- WHERE o modo "aprovação dupla" está ativo para o cliente, the system SHALL exigir confirmação de dois aprovadores distintos para pedidos acima do limite configurado.

## Formato completo de User Story

```
US-001: Cadastrar produto no catálogo
Como analista de produto,
quero cadastrar um novo produto com dados fiscais completos,
para que ele esteja disponível para venda imediatamente após validação.

Prioridade: Must

Critérios de Aceitação (EARS):
- AC-001-1: WHEN o analista submete o formulário com todos os campos obrigatórios preenchidos, the system SHALL persistir o produto e exibir confirmação em até 2 segundos.
- AC-001-2: IF qualquer campo obrigatório estiver vazio, THEN the system SHALL impedir o submit e destacar visualmente os campos faltantes.
- AC-001-3: WHEN o produto é salvo, the system SHALL gerar SKU único seguindo o padrão definido em ADR-0003.
- AC-001-4: WHILE o produto está em status "rascunho", the system SHALL permitir edição irrestrita ao analista que o criou.
- AC-001-5: WHERE o cliente tem integração fiscal habilitada, the system SHALL submeter os dados do produto ao serviço de validação fiscal antes da publicação.

Notas: depende de ADR-0003 (regra de SKU). Bloqueada por dependência D-002 (acesso ao serviço fiscal). Métrica afetada: "tempo médio de cadastro de produto".
```

**Estrutura obrigatória:**

1. **ID** (`US-NNN`) — sequencial, único no projeto
2. **Título** — verbo no início, ação concreta
3. **Frase em formato "Como X, quero Y, para Z"** — persona, ação, valor
4. **Prioridade MoSCoW** — uma única vez no documento todo, aqui
5. **ACs em EARS** — IDs `AC-NNN-M` para referência cruzada
6. **Notas** — dependências, ADRs relacionados, métricas impactadas

## Anti-padrões (não fazer)

### AC fora de EARS

❌ "O sistema deve cadastrar produtos rapidamente."
✅ AC-NNN-X: WHEN o usuário submete o cadastro, the system SHALL retornar confirmação em menos de 2 segundos no p95.

### AC com múltiplos comportamentos misturados

❌ AC-001-1: WHEN o usuário clica em salvar, the system SHALL validar os campos, persistir o produto, gerar o SKU, disparar webhook e atualizar o cache.

Quebrar em ACs separados — cada um é um caso de teste:

✅
- AC-001-1: WHEN o usuário submete o formulário, the system SHALL validar campos obrigatórios.
- AC-001-2: WHEN a validação passa, the system SHALL persistir o produto e gerar SKU conforme ADR-0003.
- AC-001-3: WHEN o produto é persistido com sucesso, the system SHALL disparar webhook `product.created` para o ERP.

### "Should" no lugar de "shall"

❌ The system should display a message.
✅ The system SHALL display a message.

`SHALL` é normativo, mandatório. `Should` em EARS sugere recomendação, não obrigação. Cuidado especial em projetos bilíngues — em português, mantemos a partícula em inglês (`SHALL`) por ser o padrão consagrado do EARS, mesmo que o resto do AC esteja em português.

### AC subjetivo

❌ AC-NNN: WHEN o usuário clica em buscar, the system SHALL retornar resultados relevantes.

"Relevantes" segundo quem? Trocar por critério mensurável:

✅ AC-NNN: WHEN o usuário busca por SKU exato, the system SHALL retornar o produto correspondente em até 500ms no p95, ou mensagem "nenhum resultado" se não encontrar.

### Prioridade no AC, não na US

❌ AC-NNN: (Must) WHEN o usuário...

A prioridade é da US inteira, não de ACs individuais. Se uma US tem ACs com prioridades diferentes, são US diferentes — quebre.

## Checklist do AC

Antes de fechar um AC, verificar:

- [ ] Usa um dos 5 padrões EARS
- [ ] Usa `SHALL` (não should, must, will)
- [ ] Tem condição de sucesso mensurável (tempo, formato, comportamento específico)
- [ ] Trata o caminho de erro/exceção em AC próprio (IF/THEN)
- [ ] Não mistura múltiplos comportamentos em um único AC
- [ ] É derivável como caso de teste sem informação extra

Se um AC falha em algum item, refatore antes de incluir no PRD.

## EARS cobre fracasso de entrada — fracasso de resultado vai pra outro lugar

Distinção crítica quando o projeto também gera artefatos ICE:

| Tipo de fracasso | Forma | Onde vive |
|---|---|---|
| **De entrada** (validação) | "campo inválido", "saldo insuficiente", "formato errado" | EARS `IF…THEN` no PRD (esta referência) |
| **De resultado** (mundo) | "no mundo, X aconteceu apesar de tudo ter passado validação" | Must-not no `expectations-US-NNN.md` (ver `expectations_template.md`) |

EARS `IF…THEN` resolve o primeiro. Não tente forçar o segundo em EARS — vira critério vago tipo "IF empresa for fantasma, THEN não aprovar", que não é testável.

**Exemplo da distinção:**

- ✅ EARS no PRD: `AC-017-3: IF o coordenador identifica inconsistência nos dados da Empresa, THEN the system SHALL permitir rejeitar a vaga com motivo.`
- ✅ Must-not no expectations file: `P-002: O sistema NÃO PODE marcar uma Empresa como verificada sem que a checklist de verificação esteja registrada como cumprida pelo moderador.`

Os dois cobrem o mesmo risco (empresa-fantasma, RP-005) por ângulos complementares: o EARS define o caminho de rejeição quando o moderador *percebe* o problema; o must-not define o que o sistema *não permite estruturalmente*, mesmo se o moderador for negligente.

Se o projeto não gera camada ICE (ver SKILL.md "Quando NÃO gerar a camada ICE"), o fracasso de resultado fica capturado em §13 (Riscos) do PRD e a mitigação fica narrativa — aceitável para projetos pequenos, insuficiente para os complexos.
