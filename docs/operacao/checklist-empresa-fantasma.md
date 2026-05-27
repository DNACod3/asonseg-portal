# Checklist de validação de empresa-fantasma (moderação)

**Origem:** US #111 (sub-task #115) — Fase 0.
**Status:** v1.0 (MVP).
**Aplica-se a:** moderação de cadastros de **Empresa** (`Company`) antes de liberar a publicação de vagas.

## Objetivo

Dar ao moderador critérios **verificáveis** para aprovar ou rejeitar uma empresa, reduzindo o risco de "empresas-fantasma" (cadastros falsos, golpes de vaga, captura indevida de dados de candidatos). Cada critério tem uma **ação recomendada**.

## Como usar

1. Percorra os critérios na ordem (eliminatórios primeiro).
2. Marque cada item como **OK / Atenção / Reprovado**.
3. Aplique a regra de decisão ao final.
4. Registre a justificativa na transição de moderação (`transitionContent`) — o histórico fica no audit log.

---

## A. Critérios eliminatórios (qualquer "Reprovado" → rejeitar)

| # | Critério | Como verificar | Ação se falhar |
|---|---|---|---|
| A1 | **CNPJ válido e ativo** | Consultar situação cadastral na Receita Federal (ou base pública equivalente). Situação deve ser "ATIVA". | Rejeitar — CNPJ inexistente, inativo, baixado ou suspenso. |
| A2 | **Razão social compatível com o CNPJ** | A razão social/nome fantasia informado bate com o registro da Receita. | Rejeitar se divergência total/inexplicável. |
| A3 | **Coerência razão social × atividade (CNAE) × vaga** | A atividade econômica registrada é compatível com o tipo de vaga anunciada. | Atenção/Rejeitar se a vaga é totalmente incompatível com o ramo (ex.: comércio de roupas anunciando "operador de criptomoedas"). |
| A4 | **Sem cobrança ao candidato** | A vaga/empresa não pede pagamento, depósito, compra de kit ou "taxa de cadastro" ao candidato. | Rejeitar imediatamente — sinal forte de golpe. |

---

## B. Critérios de presença e contato verificável

| # | Critério | Como verificar | Ação se falhar |
|---|---|---|---|
| B1 | **Contato verificável** | Telefone e/ou e-mail corporativo respondem; e-mail preferencialmente em domínio próprio (não só Gmail/Hotmail). | Atenção — exigir confirmação adicional. |
| B2 | **Endereço plausível** | Endereço informado existe e é compatível com a região atendida ou com a sede declarada. | Atenção se endereço inexistente/genérico. |
| B3 | **Presença digital mínima** | Site, rede social ativa, ou registro em diretórios locais. Histórico coerente (não criado "ontem"). | Atenção — ausência total de presença é sinal de risco. |
| B4 | **Responsável identificável** | Existe pessoa de contato com nome e papel na empresa. | Atenção se anônimo/evasivo. |

---

## C. Sinais de fraude (red flags)

Cada sinal abaixo aumenta o risco. **Dois ou mais** → reprovar ou exigir diligência adicional.

- [ ] Promessa de salário muito acima do mercado para a função.
- [ ] Urgência artificial ("vagas só hoje", "contratação imediata sem entrevista").
- [ ] Pedido de dados sensíveis no primeiro contato (CPF completo, foto de documento, dados bancários, senha).
- [ ] Comunicação apenas por app de mensagem com número pessoal, fugindo dos canais do portal.
- [ ] Erros grosseiros de português/empresa, descrição genérica copiada.
- [ ] CNPJ recém-aberto sem qualquer presença ou histórico.
- [ ] Mesma pessoa/telefone vinculada a múltiplas empresas distintas.
- [ ] Domínio de e-mail criado há poucos dias.

---

## Regra de decisão

| Situação | Decisão |
|---|---|
| Algum critério **A (eliminatório)** reprovado | **Rejeitar** (`REJECTED`) com justificativa. |
| Todos os **A** OK, **0–1** sinais de C, **B** sem pendência grave | **Aprovar** (`APPROVED`). |
| Todos os **A** OK, mas **B com pendência** ou **1 sinal de C** | **Pendência** — solicitar informação/documento adicional antes de decidir. |
| **2 ou mais** sinais de C | **Rejeitar** ou diligência aprofundada antes de aprovar. |

> Toda decisão (aprovar/rejeitar/pendência) é registrada via `transitionContent()` do módulo `moderation`, com justificativa obrigatória, e fica no audit log (append-only). Ver [project-guideline](../arch/project-guideline.md) e ADRs de moderação/empresa.
