# Taxonomia EARS → tipo de fact

EARS (Easy Approach to Requirements Syntax) tem cinco padrões. Reconhecê-los é o que permite
gerar o fact certo automaticamente. Os ACs do PRD do Portal usam todos eles. Esta tabela é o
mapa de decisão.

## Os cinco padrões

### 1. Event-driven — `WHEN <gatilho> THE SYSTEM SHALL <resposta>`
Comportamento disparado por um evento/ação do usuário. É o **happy path** por excelência.
> AC-001-1: WHEN o visitante submete o auto-cadastro com nome, CPF válido, e-mail e senha, the system SHALL persistir a Pessoa, criar a credencial e ativar o(s) papel(éis).

- **Fact:** cenário Gherkin `Cenário: ...` (sem outline) + teste de integração happy path.
- O `WHEN` vira o `Quando`; o `SHALL` vira o(s) `Então`. Múltiplos efeitos no SHALL → múltiplos `E` no `Então` (persistir + criar credencial + ativar papel + auditar).

### 2. Unwanted behavior — `IF <condição> THEN THE SYSTEM SHALL <resposta>`
Tratamento de condição indesejada/erro. É **borda/erro**.
> AC-001-2: IF o e-mail informado já está em uso, THEN the system SHALL bloquear o cadastro e informar o conflito.

- **Fact:** cenário de erro + teste que verifica o `ActionResult` `{ ok: false, error }` correto.
- Vários `IF` distintos (e-mail duplicado, CPF duplicado, CPF inválido) = **vários cenários** ou um `Esquema do Cenário` (Scenario Outline) com `Exemplos`. Prefira outline quando só muda o dado de entrada e a mensagem; cenários separados quando a lógica difere.

### 3. State-driven — `WHERE <estado/feature ativa> THE SYSTEM SHALL <resposta>`
Comportamento que só vale sob um estado/configuração. Precisa de **pré-condição**.
> AC-002-2: WHERE a assistente social marca "Pessoa sem documento — exceção", the system SHALL exigir justificativa obrigatória.

- **Fact:** cenário com `Dado` que estabelece o estado (ou `Contexto:`/Background se compartilhado). O `WHERE` vira o `Dado`.

### 4. Continuous — `WHILE <estado> THE SYSTEM SHALL <resposta>`
Comportamento contínuo enquanto o sistema está num estado. Frequentemente um **invariante**.
> AC-004-4: WHILE o usuário está autenticado, the system SHALL encerrar a sessão após 12h de inatividade.
> AC-007-2: WHILE a Pessoa está inativa, the system SHALL preservar todo o histórico.

- **Fact:** cenário com estado mantido + assertion sobre o invariante. Se o invariante vale sobre um conjunto de entradas (ex.: "qualquer CPF válido sempre passa no dígito verificador"), é forte candidato a **property-based test** (`fast-check`).

### 5. Ubiquitous — `THE SYSTEM SHALL <requisito>` (sem cláusula condicional)
Requisito sempre verdadeiro, independente de evento ou estado.
> AC-001-5: The system SHALL exigir validação CAPTCHA no auto-cadastro.
> AC-001-7: The system SHALL armazenar senhas com hash bcrypt.

- **Fact:** assertion incondicional, ou um **schema Zod** quando é regra de fronteira (formato de input), ou verificação no teste de integração (ex.: senha persistida não é plaintext).

## Combinações

ACs reais combinam cláusulas. Trate na ordem: `WHILE`/`WHERE` (pré-condições) → `WHEN` (gatilho)
→ `IF` (desvio) → `SHALL` (resposta).
> AC do guia: WHEN candidato submete CV PDF até 5MB / IF consentimento CV_AI_EXTRACTION ativo / THE SYSTEM SHALL extrair campos em até 30s.

Vira: `Dado` consentimento ativo (o IF como pré-condição satisfeita) → `Quando` submete CV →
`Então` extrai em ≤30s. **E** um cenário-irmão para o caminho do IF negado (consentimento ausente
→ erro `CONSENT_REQUIRED`), que normalmente é outro AC no mesmo PRD.

## Como decidir o tipo de fact (árvore rápida)

1. O AC fala de visibilidade de dado entre papéis diferentes? → **View Model tipado** + teste de View Model.
2. O AC define formato/limite de input (tamanho, obrigatoriedade, dígito verificador)? → **Schema Zod** (+ teste do schema).
3. O AC depende de LLM (cv-extraction)? → **métrica de eval suite** no `baseline.json` (não teste determinístico).
4. O AC é um invariante sobre muitas entradas? → **property-based** (`fast-check`).
5. O AC é um dos Top 8 fluxos críticos (architecture-document Seção 6)? → também **E2E Playwright**.
6. Caso geral (regra de negócio, Server Action, fluxo entre módulos) → **teste unit/integration Vitest**.

Um mesmo AC pode gerar **mais de um fact** (ex.: schema Zod + teste de integração). A latência
(`em até 30s`) de um AC LLM, por exemplo, vira métrica de eval (`latency_p95`), não assertion de
teste de integração.

## O que NÃO é fact aceitável (Seção 23.2)

- "Será coberto por teste manual" / "validação visual em homologação"
- "Garantido pelo TypeScript" (só vale se o tipo é gerado de schema versionado)
- "Comportamento padrão do framework" (precisa de teste que ancora a expectativa)

Se um AC só puder ser coberto por um desses, marque-o como **lacuna** — é bloqueio de Kickoff Gate.
