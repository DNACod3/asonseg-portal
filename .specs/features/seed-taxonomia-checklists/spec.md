# Seed de taxonomia e checklists — Specification (stub)

> Stub gerado pela skill-tdad para ancorar os facts. A US canônica é o **issue #111**
> (Épico #4 — Fase 0). Facts em `tests/`.

## User Story (issue #111)

Como time de produto/operação, quero a taxonomia inicial (regiões, áreas de vaga,
categorias de serviço) semeada e o checklist de validação de empresa-fantasma documentado,
para que vagas/serviços e a moderação tenham dados de referência desde o início.

**Prioridade:** P1 (Must) · **Origem:** Fase 0 — Setup (infra)

## Critérios de aceite (verbatim do issue)

- **AC-111-1:** QUANDO `npm run db:seed` é executado ENTÃO as tabelas `regions`, `job_areas`
  e `service_categories` DEVEM ser populadas com os valores iniciais (idempotente — re-rodar
  não duplica).
- **AC-111-2:** QUANDO o checklist de empresa-fantasma é necessário ENTÃO DEVE existir
  documento com os critérios verificáveis para a moderação aprovar/rejeitar empresas.

## Fontes da verdade consultadas

- PRD §11 Glossário (Região = bairro/cidade, dado mestre da diretoria — bairros de
  Florianópolis no MVP; Categoria/Área = lista pré-cadastrada); §3.3 premissas (linha 103/106);
  D-007 e QP-010 (lista inicial vem do protótipo, refinada com a diretoria — **pendente**);
  RP-005 (empresa-fantasma → checklist do coordenador é entregável de Fase 0).
- USP-017 (validar Empresa na primeira vaga) — critérios que o checklist precisa cobrir:
  dados da Empresa (CNPJ, razão social, endereço), decisão aprovar/rejeitar com motivo.
- technical-design §schema — tabelas `regions` (name, city_name, state, is_active),
  `job_areas` / `service_categories` (name único, is_suggestion default false).

## Natureza desta US (importante para os facts)

US de **infraestrutura/seed**: não há Server Action, permissão, consentimento, View Model,
LLM nem fluxo de usuário ponta-a-ponta. Logo, os casos obrigatórios de Server Action (§12) e
o E2E Playwright **não se aplicam** (justificado na matriz). Os facts são: teste de integração
do seed (idempotência) e teste estrutural do documento de checklist.
