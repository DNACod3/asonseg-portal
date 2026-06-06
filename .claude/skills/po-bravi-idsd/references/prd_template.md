# Template do PRD (Product Requirements Document)

Esqueleto completo do PRD da Bravi. Cada seção tem propósito; **não pular** — se não há informação, declarar a lacuna ("a definir na Fase 0 — ver Pergunta em Aberto Q-007").

PRD enxuto é regra, não exceção. Se uma seção está inflando para mais de 2 páginas, provavelmente precisa virar referência separada (ADR, anexo, glossário). PRD que ninguém lê não serve para nada.

---

## 0. Cabeçalho

```
PRD — [Nome do Projeto]
Cliente: [Nome do cliente]
Versão: vX.Y (data)
Autor: [PO responsável]
Status: Draft | Em revisão | Aprovado
```

Sem `[NOVO v1.2]` no corpo. Versão é única, no cabeçalho. Histórico fica em `CHANGELOG.md`.

---

## 1. Visão Geral

**Objetivo: 1 página.** Quem só lê isso deve sair com a decisão clara.

### 1.1 Problema de negócio
Uma frase: que dor concreta o projeto resolve. Não é a solução, é a dor.

### 1.2 Solução proposta (alto nível)
2-3 frases. Sem detalhe técnico. Linguagem de negócio.

### 1.3 Público-alvo
Quem usa e quem se beneficia. Detalhe vai na seção 2.

### 1.4 Resultado esperado
Métrica-âncora com baseline e meta. Se não tem baseline ainda, dizer.

---

## 2. Personas

Papel, não pessoa. Cada persona em bloco curto:

```
### Persona: Analista Comercial
- Perfil: profissional sênior, 5+ anos de experiência em vendas B2B
- Necessidades: aprovar pedidos rapidamente, ter visibilidade do pipeline
- Frustrações: hoje precisa abrir 4 sistemas para fechar 1 pedido
- Volume: ~30 pedidos/dia por analista, time de 8 analistas
- Acesso: web desktop em horário comercial, eventualmente mobile
```

Persona sem volume e contexto de uso não serve para dimensionar — sempre incluir.

---

## 3. Escopo

### 3.1 In Scope

Lista clara do que entra. Curto, em frases ou bullets de no máximo 2 linhas cada.

### 3.2 Out of Scope

**Sempre tabela com coluna "por quê":**

| Fora do escopo desta versão | Por quê |
|---|---|
| App mobile nativo | Não há base de usuários mobile que justifique investimento na V1 |
| Integração com sistema legado Z | Z está em sunset; integrar gera dívida |
| Multi-idioma | Cliente atual opera só no Brasil; adicionar em V2 se expandir |

Sem "por quê" preenchido a tabela perde a função de defender escopo em review.

### 3.3 Premissas

Coisas que **assumimos verdadeiras** mas não validamos. Cada premissa é um risco se errada:

> Premissa: volume estimado em 800 transações/mês, baseado em dados de 2025 fornecidos por [stakeholder] em [data]. Variação sazonal não modelada — validar na Fase 0.

### 3.4 Restrições

- Tecnológicas (stack mandatório, cloud específica, integração obrigatória)
- Regulatórias (LGPD, normas setoriais, certificações)
- Orçamentárias (faixa)
- De prazo (deadline rígido vs. flexível, motivo)

---

## 4. Métricas e Critérios de Sucesso

**Sempre tabela com baseline e meta:**

| Métrica | Baseline (atual) | Meta (fim do trimestre) |
|---|---|---|
| Tempo médio de aprovação de pedido | 4–7 dias | < 1 dia |
| % de pedidos com retrabalho | ~22% | < 5% |
| Capacidade liberada por analista | n/a | +2h/dia |
| NPS dos usuários internos | A definir (medir Fase 0) | > 50 |

Se uma baseline ainda não foi medida, registrar "a definir" e adicionar como dependência na seção 7 com owner.

---

## 5. Requisitos Funcionais

### 5.1 Estrutura

Agrupar User Stories por **épicos** (capacidades de negócio, não telas):

```
### Épico 1: Cadastro e Manutenção de Catálogo

US-001, US-002, US-003

### Épico 2: Fluxo de Pedido

US-004, US-005, US-006, US-007
```

### 5.2 Formato de User Story

```
US-001: Cadastrar produto no catálogo
Como analista de produto,
quero cadastrar um novo produto com dados fiscais completos,
para que ele esteja disponível para venda imediatamente após validação.

Prioridade: Must

Critérios de Aceitação (EARS):
- AC-001-1: WHEN o analista submete o formulário com todos os campos obrigatórios preenchidos, the system SHALL persistir o produto e exibir confirmação em até 2 segundos.
- AC-001-2: IF qualquer campo obrigatório estiver vazio, THEN the system SHALL impedir o submit e destacar visualmente os campos faltantes.
- AC-001-3: WHEN o produto é salvo, the system SHALL gerar um SKU único seguindo o padrão [XX-NNNNN].
- AC-001-4: WHILE o produto está em status "rascunho", the system SHALL permitir edição irrestrita ao analista que o criou.

Notas: depende de ADR-0003 (regra de geração de SKU). Bloqueada por dependência D-002 (acesso ao serviço de validação fiscal).
```

**Pontos críticos:**
- Prioridade vai aqui, **uma única vez** no documento todo
- Cada AC em EARS, com `SHALL`
- Cada AC vira 1 caso de teste — se não dá pra derivar teste, AC não está em EARS
- Notas referenciam ADRs e dependências por ID, **nunca duplicam o conteúdo**

Detalhes de EARS em `ears_user_stories.md`.

---

## 6. Requisitos Não-Funcionais

Em prosa curta ou bullets, conforme volume. Tópicos esperados:

- **Performance**: tempos de resposta esperados (p95/p99), throughput
- **Disponibilidade**: SLA alvo (99,5% / 99,9% / etc.) e janela de manutenção
- **Segurança**: autenticação, autorização, criptografia em trânsito/repouso, auditoria
- **Escalabilidade**: volume esperado V1 vs. previsto em 12 meses
- **Acessibilidade**: WCAG AA é o default; subir/descer com justificativa
- **Observabilidade**: logs, métricas, traces — o que o time precisa para operar
- **Compliance**: LGPD, normas setoriais aplicáveis

Cada NFR mensurável vira um requisito EARS na seção 5 quando aplicável. NFR genérico ("rápido") não vale — número ou nada.

---

## 7. Dependências

**Sempre tabela com status e owner:**

| Dependência | Status | Owner | Observações |
|---|---|---|---|
| API de NF-e do fornecedor X | Aguardando | Cliente — fiscal | Bloqueia US-007, US-009 |
| Decisão sobre integração com ERP Y | Em discussão | Cliente — TI | Definir até início Fase 0 |
| Acesso ao ambiente de homologação | Disponível | Cliente — DevOps | Liberado em 2026-03-10 |
| Validação jurídica do fluxo de aceite digital | A iniciar | Cliente — jurídico | Necessário para US-012 |
| Definição de baseline da métrica "tempo de aprovação" | A definir | Bravi PO | Medir na Fase 0 |

Sem owner e status nominais a tabela não coordena squads — vira lista de boas intenções.

---

## 8. Equipe e Modelo de Entrega

Seção específica da Bravi — Squad as a Service. Cobre o que é decisão de delivery (squad sizing, papéis, ritmo). **Pricing fica em `business-model.md`.**

### 8.1 Composição da squad

| Papel | Alocação | Responsabilidade principal |
|---|---|---|
| Tech Lead | 100% | Decisões técnicas, code review, integração com cliente técnico |
| Dev Pleno x2 | 100% | Implementação de features |
| Dev Júnior | 100% | Implementação assistida |
| PO (Bravi) | 50% | Refinamento, validação com cliente |
| QA | 50% | Plano de teste, automação, exploratórios |
| DevOps | 25% | CI/CD, ambientes, observabilidade |

Adaptar pelos tamanhos reais. **Sempre incluir alocação percentual** — sem isso, o cliente subdimensiona expectativa.

### 8.2 Ritmo e cerimônias

- Sprints de [1/2] semanas
- Daily: [horário, formato]
- Refinamento: [frequência]
- Review com cliente: [frequência]
- Retro interna: [frequência]

### 8.3 Modelo de contratação

Squad as a Service — contratação por capacidade de squad por mês, escopo gerenciado por backlog priorizado conjuntamente. Detalhes comerciais em `business-model.md`.

### 8.4 Critérios de pronto

- Definição de Pronto (DoD) padrão Bravi se aplica (testes, code review, deploy em homologação validado pelo PO)
- Customizações específicas deste projeto: [listar]

---

## 9. Backlog Priorizado (MoSCoW)

**Apenas índice — não re-listar conteúdo das US:**

```
Must Have:   US-001, US-003, US-004, US-007, US-012
Should Have: US-002, US-005, US-009, US-014
Could Have:  US-008, US-010, US-015
Won't Have (este release): US-011, US-013
```

Quem precisa do detalhe da US vai na seção 5. Sem duplicação = sem drift quando a prioridade muda.

---

## 10. Decisões Registradas

Apenas **índice** de ADRs — os ADRs ficam em `decisions/`:

```
- ADR-0001: Modelo de autenticação (SSO corporativo)
- ADR-0002: Estrutura de catálogo (hierarquia plana vs. árvore)
- ADR-0003: Regra de geração de SKU
- ADR-0004: Escopo de emissão de NF (NF-e vs. NFS-e na V1)
```

Cada ADR em arquivo próprio com seção de alternativas consideradas. Template em `adr_template.md`.

---

## 11. Glossário do Domínio

Tabela alimentada conforme novos termos surgem na conversa. Termos do domínio do cliente, não termos técnicos genéricos.

| Termo | Definição | Notas |
|---|---|---|
| SKU | Identificador único de variação de produto | Padrão XX-NNNNN, ver ADR-0003 |
| Pedido em rascunho | Pedido criado mas não submetido a aprovação | Pode ser editado livremente; não conta no pipeline |
| Aprovação dupla | Pedidos acima de R$ X exigem 2 aprovadores | Regra do cliente, ver ADR-0006 |

---

## 12. Perguntas em Aberto

Tabela de perguntas que ainda precisam de resposta. Cada uma com prazo e owner:

| ID | Pergunta | Owner (cliente) | Prazo | Impacto se não respondida |
|---|---|---|---|---|
| Q-001 | Qual ERP atual será integrado? | TI | Fase 0 | Bloqueia US-009 |
| Q-002 | Política de retenção de logs por LGPD? | Compliance | Pré-deploy | Define NFR de armazenamento |
| Q-003 | Quem aprova pedidos acima de R$ 50k? | Comercial | Fase 0 | Define regra de US-007 |

**Nenhum entregável é finalizado com perguntas críticas em aberto.** Se o cliente respondeu "definir durante o projeto", a resposta é "definir durante o projeto" — explicitamente registrada, não vazia.

---

## 13. Riscos de Negócio

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Cliente fiscal não responder a tempo sobre regras de NF | Média | Alto | Iniciar conversa na Fase 0, listar regras críticas em ADR |
| Volume real significativamente diferente da premissa | Baixa | Médio | Validar via amostragem na Fase 0; redimensionar squad se necessário |
| Mudança de regulação LGPD durante o projeto | Baixa | Alto | Acompanhamento de jurídico, escopo flexível em features de privacidade |

Riscos técnicos (arquitetura, integração) ficam com o Arquiteto — não duplicar aqui.

---

## Anexo A — Histórico de mudanças

PRD **não** carrega histórico inline. Ver `CHANGELOG.md` na raiz do projeto.

---

## Checklist final antes de gerar `.docx`

- [ ] Versão e data no cabeçalho atualizadas
- [ ] Toda US tem AC em EARS testável e prioridade MoSCoW
- [ ] Toda métrica tem baseline (ou "a definir" + dependência registrada)
- [ ] Toda dependência tem owner e status
- [ ] Out-of-scope tem coluna "por quê" preenchida
- [ ] Decisões viraram ADRs em `decisions/`
- [ ] Nenhum pricing/tier no documento (foi para `business-model.md` se houver)
- [ ] Nenhuma anotação `[NOVO]` `⚠️` no corpo
- [ ] Perguntas em aberto têm owner e prazo
- [ ] Glossário inclui todos os termos novos surgidos nas últimas rodadas
