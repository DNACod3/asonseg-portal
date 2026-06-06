# Template do Business Model (Documento Comercial)

Documento à parte do PRD. **Nunca misture pricing/tiers/mecânica de cobrança no PRD funcional.** Os dois mudam em ciclos diferentes — acoplá-los trava a revisão dos dois.

## O que vai aqui

- Pricing (valores, modelos de cobrança)
- Tiers/planos comerciais
- Pacotes
- Política de upgrade/downgrade
- Descontos e exceções
- Mecânica de faturamento (frequência, condições de pagamento)
- Política de cancelamento e refund

## O que NÃO vai aqui (vai no PRD)

- Squad sizing — decisão de delivery, fica no PRD seção 8
- Modelo de contratação Squad as a Service — base contratual fica no PRD seção 8; valores ficam aqui
- DoD e processos de entrega
- SLA técnico

## Quando criar

Crie o `business-model.docx` apenas se houver decisão comercial concreta a registrar. Se o projeto é interno do cliente sem componente comercial (SaaS interno, automação operacional), pode não existir.

Para projetos da Bravi como entregadora de Squad as a Service, este documento captura **como o cliente paga pela squad** — não o que a squad entrega.

Para produtos SaaS que o cliente vai vender ao mercado, captura **como o cliente cobra dos clientes dele**.

---

## Template

```markdown
# Business Model — [Nome do Projeto]

**Cliente:** [Nome]
**Versão:** vX.Y (data)
**Status:** Draft | Em negociação | Aprovado
**Documento companheiro:** prd.docx vX.Y

## 1. Contexto

Frase curta sobre o que este documento cobre e por que existe separado do PRD.

## 2. Modelo de Cobrança

Qual é o modelo principal:
- Por capacidade de squad (Squad as a Service)
- Por entrega/marco
- Por usuário/seat (SaaS)
- Por consumo/uso (SaaS metered)
- Misto

Explicar em 1-2 parágrafos por que este modelo se ajusta ao caso.

## 3. Tiers / Pacotes

Se aplicável, descrever os planos:

| Plano | Para quem | Inclui | Não inclui | Preço |
|---|---|---|---|---|
| Starter | Cliente pequeno, < N usuários | Features X, Y, Z | A, B | R$ N/mês |
| Pro | Cliente médio, N-M usuários | Tudo do Starter + W | A | R$ M/mês |
| Enterprise | Cliente grande, > M usuários | Tudo do Pro + A, B | — | Sob consulta |

**Para Squad as a Service:**

| Tamanho de squad | Composição | Capacidade aproximada | Valor mensal |
|---|---|---|---|
| Squad S | 1 TL + 2 Devs + 0,5 QA | ~X story points/sprint | R$ N |
| Squad M | 1 TL + 3 Devs + 1 QA + 0,5 PO | ~Y story points/sprint | R$ M |
| Squad L | 1 TL + 4 Devs + 1 QA + 1 PO + 0,5 DevOps | ~Z story points/sprint | R$ K |

Custos detalhados (composição + alocação) ficam aqui. **Composição da squad real para o projeto fica no PRD** seção 8, referenciando este documento.

## 4. Condições Comerciais

- **Vigência mínima:** N meses
- **Aviso prévio para cancelamento:** N dias
- **Reajuste:** índice e periodicidade
- **Forma de pagamento:** boleto/PIX/transferência, dia do mês
- **Multa por inadimplência:** percentual e prazos
- **Despesas extras:** o que está incluso, o que é cobrado à parte (deslocamento, treinamento, etc.)

## 5. Política de Upgrades, Downgrades e Mudança de Escopo

Como o cliente pode crescer/diminuir o serviço:

- Aumento de squad: prazo de provisionamento, valor
- Redução de squad: prazo de aviso, valor
- Mudança entre tiers: regra de transição
- Adição de capacidades fora do contrato base: como tratar

## 6. Descontos e Exceções

Se houver:
- Desconto por contrato anual vs. mensal
- Desconto de fidelidade
- Casos especiais negociados (com referência a aprovação)

## 7. Cancelamento e Encerramento

- Como cancelar (formal)
- Período de transição (entrega de artefatos, documentação, knowledge transfer)
- Política de propriedade intelectual sobre o produzido
- Garantia pós-encerramento, se houver

## 8. Histórico de Negociação

Tabela curta com datas e acordos relevantes:

| Data | Decisão | Quem |
|---|---|---|
| 2026-02-15 | Acordado modelo Squad M com vigência inicial de 6 meses | Diretor comercial cliente + CRO Bravi |
| 2026-03-01 | Aprovado adicional de 0,5 DevOps a partir do mês 3 | Sponsor cliente + Bravi CTO |

## 9. Aprovação

Sem assinatura do contrato formal, este documento é apenas registro de entendimento. Contrato formal jurídico tem precedência em caso de divergência.

| Papel | Pessoa | Data | Status |
|---|---|---|---|
| Sponsor cliente | [nome] | YYYY-MM-DD | Aprovado verbal/escrito |
| Bravi comercial | [nome] | YYYY-MM-DD | Aprovado |
```

---

## Boas práticas

1. **Sempre referenciar a versão do PRD** que este documento acompanha. Se PRD muda escopo significativamente, business model precisa ser revisado.

2. **Quando cliente pedir mudança de pricing/condição**, atualizar aqui — **nunca** no PRD. Mudança de pricing não deve forçar revisão do documento funcional.

3. **Mantenha histórico de negociação** — é o equivalente do CHANGELOG para comercial. Útil em disputa futura.

4. **Não inclua valores que ainda não foram acordados.** Se está em discussão, deixe "em negociação" ou cite a faixa. Documento comercial com número errado vira fonte de fricção.

5. **Para projetos sem componente comercial** (automação interna, projeto pago apenas pela squad já alocada), este documento pode ser tão simples quanto uma página única confirmando que o projeto está dentro do contrato de squad vigente. Não force estrutura.
