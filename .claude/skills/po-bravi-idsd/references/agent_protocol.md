# Protocolo Inter-Agente

Quando outro agente (Arquiteto, Tech Lead, PM, QA, DevOps) faz pergunta sobre o PRD, o PO responde em **JSON estruturado**. Este formato existe para que respostas sejam processáveis automaticamente (validação de cobertura, geração de FAQ, alimentação de outro agente).

## Quando este modo se aplica

Acione o modo inter-agente quando:
- O usuário do skill é um outro agente (não o cliente humano)
- O input traz uma lista de perguntas (numeradas, em JSON, ou em formato `Q-NNN`)
- A pergunta é sobre regra de negócio, escopo, prioridade, definição de termo, validação de entrega
- O input vem com cabeçalho identificando o agente remetente

Quando **não** acionar (manter modo conversacional):
- Cliente humano fazendo perguntas em linguagem natural
- Pedido de geração de PRD/ADR/business-model
- Refino de US ou AC durante elicitação

## Schema de resposta

Cada pergunta recebida produz **uma resposta JSON**:

```json
{
  "question_id": "ARQ-Q-001",
  "status": "answered | inferred | needs_client",
  "answer": "Texto direto da resposta. Quando inferida, marcar com 'INFERIDO — validar com cliente'.",
  "confidence": "high | medium | low",
  "source": "client_conversation | prd_section_X | adr_NNNN | inferred | unknown",
  "client_question": "Se status=needs_client: pergunta formatada para enviar ao cliente humano. Caso contrário, null.",
  "impact_note": "Se relevante: impacto desta resposta em outras US/ADRs/decisões. Caso contrário, null."
}
```

### Significado de `status`

- **`answered`**: você tem a resposta direta na conversa com o cliente, no PRD, ou em ADR registrado. Confiança alta.
- **`inferred`**: você não tem resposta explícita, mas pode derivar com segurança a partir do contexto. **Sempre marcar para o agente saber que precisa validar com cliente em algum momento.**
- **`needs_client`**: você não tem resposta nem condições de inferir com segurança. Precisa consultar o cliente humano. Formule a pergunta no campo `client_question`.

### Significado de `source`

- **`client_conversation`**: cliente disse explicitamente em conversa de elicitação. Sempre que possível, citar trecho ou turno.
- **`prd_section_X`**: PRD da versão atual, seção X (ex: `prd_section_5_US-007`).
- **`adr_NNNN`**: registro de decisão ADR-NNNN.
- **`inferred`**: derivado de contexto, sem fonte explícita.
- **`unknown`**: não há fonte; combina com status `needs_client`.

## Formato de batch (várias perguntas em uma rodada)

Quando o agente manda múltiplas perguntas juntas, responder em array, na mesma ordem:

```json
{
  "responses": [
    { "question_id": "ARQ-Q-001", "status": "answered", ... },
    { "question_id": "ARQ-Q-002", "status": "inferred", ... },
    { "question_id": "ARQ-Q-003", "status": "needs_client", ... }
  ],
  "summary": {
    "answered_count": 1,
    "inferred_count": 1,
    "needs_client_count": 1,
    "new_decisions": [
      "Confirmado em ARQ-Q-001 que volume esperado de transações é 800/mês (já registrado no PRD seção 4)"
    ],
    "client_questions_pending": [
      "Q-NOVO-1: Qual o comportamento esperado quando o serviço de NF-e está indisponível por mais de 1h?"
    ]
  }
}
```

O campo `summary` é obrigatório quando há mais de 1 pergunta. Serve como TL;DR para o agente que recebe.

## Exemplos

### Exemplo 1: Pergunta respondível direto

**Pergunta do Arquiteto:**
> ARQ-Q-001: O volume de pedidos esperado no primeiro ano é de quanto? Preciso dimensionar a infra.

**Resposta:**

```json
{
  "question_id": "ARQ-Q-001",
  "status": "answered",
  "answer": "Volume esperado: 800 pedidos/mês no primeiro ano, com pico sazonal de até 1.500/mês em novembro/dezembro. Premissa baseada em dados de 2025 fornecidos pelo cliente em 2026-02-20.",
  "confidence": "high",
  "source": "prd_section_3.3",
  "client_question": null,
  "impact_note": "Esta premissa está registrada como dependência D-005 — baseline a ser validada na Fase 0 via amostragem."
}
```

### Exemplo 2: Pergunta com inferência

**Pergunta do Arquiteto:**
> ARQ-Q-002: Posso assumir que a autenticação será via OAuth corporativo? O cliente mencionou que usa Microsoft 365.

**Resposta:**

```json
{
  "question_id": "ARQ-Q-002",
  "status": "inferred",
  "answer": "INFERIDO — validar com cliente. O cliente mencionou uso de Microsoft 365 mas não há decisão explícita registrada sobre o mecanismo de autenticação. Inferência: SSO via Azure AD/Entra ID é a opção mais provável dado o stack do cliente, mas precisa confirmação formal antes de virar requisito.",
  "confidence": "medium",
  "source": "inferred",
  "client_question": "Qual mecanismo de autenticação será usado? Opções discutidas implicitamente: (a) SSO via Azure AD/Entra ID dado o uso de Microsoft 365 no cliente, (b) autenticação local com usuário/senha, (c) integração com outro IdP. Esta decisão impacta segurança, UX de login e escopo de US-014.",
  "impact_note": "Se confirmado SSO, US-014 muda e abre dependência D-008 (configuração de app no Azure AD do cliente)."
}
```

### Exemplo 3: Pergunta sem resposta (consulta ao cliente)

**Pergunta do Arquiteto:**
> ARQ-Q-003: O que o sistema deve fazer se o serviço de NF-e da SEFAZ estiver indisponível por mais de 1h durante uma emissão?

**Resposta:**

```json
{
  "question_id": "ARQ-Q-003",
  "status": "needs_client",
  "answer": "Não há regra de negócio definida para indisponibilidade prolongada do serviço de NF-e. AC-007-4 cobre apenas o caso de indisponibilidade momentânea (enfileirar e notificar). Precisa de decisão do cliente.",
  "confidence": "low",
  "source": "unknown",
  "client_question": "Em caso de indisponibilidade do serviço de NF-e da SEFAZ por mais de 1h durante uma emissão, o que o sistema deve fazer? Opções a considerar: (a) manter a transação em fila indefinidamente e notificar a cada N minutos, (b) cancelar automaticamente após X horas e exigir reemissão manual, (c) emitir em modo contingência conforme legislação fiscal, (d) outro. Esta decisão afeta a US-007 e provavelmente exige novo ADR.",
  "impact_note": "A resposta pode gerar nova US (modo contingência) ou novo AC em US-007. Sugiro tratar como ADR após decisão."
}
```

## Regras críticas

1. **Nunca inventar regra de negócio** para parecer que sabe. `needs_client` é resposta perfeitamente aceitável — palpite virando regra silenciosa é o pior caso.

2. **Sempre marcar inferências como inferências.** Mesmo quando a inferência é óbvia, o agente que recebe precisa saber que aquilo não foi confirmado.

3. **Quando o Arquiteto traz opções (A, B, C) e você sabe a preferência do cliente**, responda diretamente justificando com base na fonte. Se você **não** sabe, repasse as opções ao cliente como contexto na `client_question`.

4. **Toda resposta precisa de âncora** — `source` deve apontar para algo concreto (US, seção do PRD, ADR, turno da conversa com cliente). Sem âncora, é opinião — e isso vai como `inferred` com `confidence: low`.

5. **`impact_note` é onde você protege o projeto.** Se a resposta vai impactar outras US, ADRs ou desbloquear/bloquear algo, escreva. O agente que recebe não consegue inferir isso sozinho — esse é o valor do PO no loop.

6. **Resposta enviada não substitui registro no PRD.** Se a rodada gerou decisão nova (cliente respondeu uma `needs_client`), abrir ADR e/ou atualizar PRD na mesma sessão, com referência cruzada.

## Anti-padrões

### Responder sem fonte

❌
```json
{ "answer": "Sim, o sistema deve fazer X.", "confidence": "high", "source": "unknown" }
```

Se a fonte é `unknown`, a resposta não pode ser `answered`. Deve ser `needs_client` ou `inferred` (com `confidence: low`).

### Confiança alta em inferência

❌
```json
{ "status": "inferred", "confidence": "high" }
```

Inferência alta confiança é contradição. Inferência por definição não foi confirmada — confiança média é o teto.

### `client_question` genérica

❌ `"client_question": "Como o sistema deve se comportar nessa situação?"`

A pergunta precisa ser **acionável**: contexto, opções discutidas (se houver), impacto da resposta. Cliente respondendo "sim" ou "não" para pergunta genérica não resolve.

### Esquecer o `impact_note` quando relevante

Toda resposta que abre/fecha uma porta para outras US ou decisões precisa do `impact_note`. Sem isso, o agente que recebe vai descobrir o impacto sozinho — geralmente tarde, geralmente caro.
