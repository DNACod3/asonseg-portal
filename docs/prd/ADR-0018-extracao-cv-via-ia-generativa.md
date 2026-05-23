# ADR-0018: Extração de CV via IA generativa (best effort, validação humana obrigatória)

**Status:** Aceito — Aplicável ao Release 1 (MVP Portal Empregabilidade e Serviços)
**Data:** 2026-05-22
**Decisores:** Sponsor ASONSEG (diretor a designar), Bravi PO
**US/Épicos impactados:** USP-009, USP-040, USP-043
**Tags:** ia | integração | lgpd | ux | decisão técnica delegada

## Contexto

O cadastro completo de candidato exige preenchimento de vários campos (escolaridade, área de formação, experiência profissional, habilidades, cursos). Para candidatos com perfil mais alto (com CV em PDF já bem estruturado), digitar tudo de novo é desestímulo significativo ao cadastro. Para candidatos com baixo letramento digital, mesmo seguir o formulário pode ser complexo.

A ASONSEG decidiu durante a elicitação que o sistema deve **extrair automaticamente os campos do CV** quando o candidato anexar o arquivo, pré-preenchendo o formulário. O candidato então revisa, ajusta e confirma.

Tecnologias possíveis:

- **Parser estruturado de PDF/DOC** (lib pdf-parse + regras heurísticas) — funciona bem para formato padrão, mal para CVs criativos.
- **OCR + regras** — para CVs escaneados/imagem; complexo.
- **IA generativa (LLM)** — robusta, lida com variedade de formatos; custo recorrente por uso.
- **Híbrido** (parser tenta primeiro, IA fallback).

O cliente decidiu por IA generativa direto (Bloco 5 da elicitação). Implica em três decisões interligadas: tecnológica (LLM), de UX (validação humana) e de LGPD (envio de dados pessoais a terceiro).

## Decisão

**Implementar extração automática de CV via IA generativa (LLM) com validação humana obrigatória do candidato antes de salvar.**

**Especificação técnica:**

1. **Trigger:** upload de CV (PDF, DOC ou DOCX até 5MB) no cadastro/perfil do candidato.
2. **Processamento:** sistema envia o texto extraído do arquivo (ou o arquivo) a um provedor LLM externo que retorna campos estruturados.
3. **Campos extraídos:** escolaridade, área de formação, experiência profissional (texto), habilidades e cursos (texto), área de interesse principal (mapeada para o catálogo).
4. **Apresentação:** sistema pré-preenche o formulário com os valores extraídos, com indicação visual clara de que foram extraídos automaticamente e que precisam ser revisados.
5. **Validação humana obrigatória:** candidato precisa confirmar explicitamente cada campo ou ajustá-lo. Sistema impede salvar sem essa confirmação (AC-040-4).
6. **Best effort:** se extração falha ou retorna vazia, formulário fica vazio para preenchimento manual. Falha não é erro disruptivo, apenas continua o fluxo normal (AC-040-3).
7. **Persistência:** arquivo original do CV permanece armazenado vinculado ao candidato (AC-040-5).

**Provedor LLM — decisão delegada ao Arquiteto/Tech Lead (Q-aberta QP-002):**

Critérios obrigatórios:

- **Zero Data Retention (ZDR)** preferencial — provedor não pode reter o conteúdo do CV após o processamento. Provedores que oferecem ZDR formal: Anthropic, OpenAI Enterprise, AWS Bedrock (alguns modelos), Google Vertex AI (alguns modelos).
- **Custo coerente com diretriz de custo mínimo** (ADR-0010 estendido).
- **Latência aceitável** (≤ 30s p95 conforme RNF 6.1) — pode ser implementado de forma assíncrona com feedback visual de progresso.
- **Suporte a português brasileiro nativo.**

**Termo de consentimento específico (finalidade 7 do ADR-0013):**

- Candidato precisa consentir explicitamente que o CV será enviado a provedor LLM externo com finalidade de extração estruturada.
- Termo precisa mencionar o nome do provedor (transparência ao titular).
- Termo precisa explicar que provedor opera sob ZDR (se aplicável) ou explicar política de retenção, se aplicável.

## Alternativas Consideradas

**Alternativa A — Parser estruturado puro (regras + pdf-parse) (descartada):** sem IA, apenas parsing de PDF/DOC com regras heurísticas. Por que não escolhida: falha em CVs com layout variado; manutenção das regras complexa; experiência inconsistente.

**Alternativa B — IA generativa direta (escolhida):** modelo descrito acima.

**Alternativa C — IA generativa com validação humana opcional (descartada):** sistema preenche automaticamente e candidato pode ignorar revisão. Por que não escolhida: IA pode errar; expor dados errados ao mercado prejudica candidato e empresa; LGPD exige exatidão do dado pessoal — validação obrigatória protege isso.

**Alternativa D — Sem extração automática, apenas formulário manual (descartada):** simplificação radical. Por que não escolhida: cliente identificou como funcionalidade desejada; ganho real de UX para candidatos com CV pronto.

**Alternativa E — Híbrido (parser tenta primeiro, IA fallback) (não escolhida para MVP, candidato a V2):** poderia reduzir custo recorrente da IA. Por que não escolhida no MVP: complexidade dupla de implementação; ganho marginal em volume baixo da ASONSEG; preferência por solução robusta direto. Avaliar para V2 conforme volume e custo se confirmem.

## Consequências

**Positivas:**

- UX significativamente melhor para candidatos com CV em PDF.
- Robustez frente a variedade de formatos de CV.
- Validação humana obrigatória protege exatidão LGPD do dado pessoal.

**Negativas / Trade-offs:**

- **Custo recorrente** por uso de API LLM. Em volume baixo (ASONSEG), trivial. Em escala, precisa monitorar.
- **Dependência de provedor externo** — se LLM falha ou está fora, extração não funciona (degradação graciosa para preenchimento manual).
- **Implicações LGPD não-triviais:**
  - CV passa por provedor de terceiros (mesmo com ZDR, é um terceiro).
  - Termo precisa cobrir explicitamente.
  - Provedor precisa ter ZDR — escolha técnica não é livre, tem critério de conformidade.
  - Cliente da ASONSEG (titular do dado) precisa ser informado.
- **Latência:** processamento de IA pode demorar 5-30s — UX precisa ter feedback de progresso.
- **Risco RP-007:** candidato valida sem revisar de fato, dados extraídos ruins entram no sistema. Mitigação: UI enfatiza revisão; texto de instrução claro; talvez highlight visual em campos "extraídos automaticamente".
- **Risco RP-008:** uso de LLM com retenção inadequada afeta LGPD. Mitigação: critério ZDR obrigatório.

**Implicações em outras decisões:**

- ADR-0013 (Consentimentos por finalidade) — finalidade 7 específica para essa funcionalidade.
- Dependência D-008 (escolha do provedor) — decisão técnica do Arquiteto.
- Dependência D-002 (termos jurídicos) — termo específico precisa cobrir uso de IA.
- Riscos RP-007 e RP-008 registrados no PRD.

## Referências

- ADR-0013 (Consentimentos LGPD por finalidade).
- PRD MVP Portal, USP-040 (Extração de CV via IA), §6.7 (LGPD), §13 (RP-007, RP-008).
- Bloco 5 da elicitação.
- LGPD, art. 7º (consentimento) e art. 8º (consentimento específico para dados sensíveis ou compartilhamento).
