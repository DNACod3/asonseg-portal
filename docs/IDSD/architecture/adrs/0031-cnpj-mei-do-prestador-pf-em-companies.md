# ADR-0031 — CNPJ MEI do prestador PF reside em `companies` (via fluxo USP-012), com regime tributário em `CompanyType`

- **Status:** Accepted
- **Data:** 2026-06-10
- **Decisores:** Sponsor + diretoria (dono do intent da USP-010); Nei Fassula (Tech Lead)
- **Tags:** data, integration
- **Premissas relacionadas:** ledger `CNPJ MEI do prestador PF (USP-010/F1)` (matriz §3.7) — **revisada** por este ADR
- **Supersedes:** resolução inline da premissa USP-010/F1 (antes: *"CNPJ MEI é atributo da Pessoa/papel, não entra em `companies`"* — TD §4.5 + card USP-010). Reverte os must-not **P-001** e **P-002** da `expectations-USP-010.md`.

## Contexto e Problema

A USP-010 (Cadastro de prestador de serviço PF) previa, no desenho original, que o **CNPJ MEI declarado pelo prestador PF** fosse um **atributo da Pessoa/papel** — explicitamente **fora** da entidade `companies`. Essa decisão (premissa USP-010/F1, marcada "Resolvido") existia para evitar o fracasso F1: confundir um prestador PF que declara MEI com uma Empresa MEI cadastrada via USP-012, e contaminar a busca (USP-027/USP-030).

Na revisão de 2026-06-10, o dono do intent decidiu **reverter** essa premissa: do ponto de vista de negócio, o CNPJ é dado de empresa, e o regime tributário (MEI, Simples, Lucro Presumido, Lucro Real, S/A) é a forma natural de classificar uma empresa — inclusive distinguindo MEI das demais. Manter um "CNPJ MEI solto no perfil PF" cria um segundo lar para dado de CNPJ, divergente da entidade `companies`, que já existe e já tem `type CompanyType`.

A decisão precisa ser registrada porque reverte uma premissa arquitetural-estrutural **com dono (diretoria/LGPD)** e tem blast radius em USP-010, USP-012, USP-027 e USP-030.

## Drivers de Decisão

- **Fonte única de CNPJ.** Todo CNPJ (incl. MEI) vive em `companies`; não há atributo de CNPJ duplicado no perfil PF.
- **Classificação tributária de primeira classe.** Regime tributário como enum em `companies`, útil para Empresas reais (USP-012) e relatórios.
- **Reuso da USP-012.** O fluxo de cadastro de Empresa (com `PersonCompanyGrant` RESPONSIBLE, verificação USP-017) já existe; não duplicar lógica de CNPJ na USP-010.
- **Decisão de negócio do dono do intent** — prevalece sobre a resolução técnica anterior do F1.

## Opções Consideradas

### Opção A — Manter CNPJ MEI como atributo do `ProviderProfile` (status quo / P-001 original)
- **Descrição:** adicionar `cnpjMei` ao `ProviderProfile`; prestador PF continua PF mesmo com MEI declarado; distinguível da Empresa MEI na busca.
- **Prós:** honra F1/P-001/P-002; prestador não vira Empresa; sem toque na USP-012.
- **Contras:** segundo lar para dado de CNPJ; sem classificação tributária rica; diverge do modelo de `companies`.
- **Custo:** baixo (1 campo + validação).

### Opção B — CNPJ MEI em `companies` via fluxo USP-012 + regime tributário em `CompanyType` (ESCOLHIDA)
- **Descrição:** a USP-010 ativa **só** o papel prestador PF + `ProviderProfile` (foto/descrição/região, **sem** `cnpjMei`). Quando o prestador quer operar como MEI, é **redirecionado ao fluxo USP-012**, que cria uma `Company type=MEI` + `PersonCompanyGrant` RESPONSIBLE. O enum `CompanyType` é expandido para regime tributário.
- **Prós:** fonte única de CNPJ; classificação tributária de primeira classe; reusa USP-012; alinhado ao ADR-0014.
- **Contras:** reverte F1/P-001/P-002; "prestador PF com MEI" deixa de ser conceito distinto — passa a ser Empresa MEI; prestador que quer MEI faz 2 passos (ativar papel → cadastrar Empresa).
- **Custo:** médio (migration do enum + ajuste de UX de redirect; lógica de Empresa já existe).

### Opção C — CNPJ MEI criado inline pela própria action da USP-010
- **Descrição:** a action da USP-010 cria `Company type=MEI` + grant na mesma transação, coletando `razaoSocial`/`nomeFantasia`/`setor` no form do prestador.
- **Prós:** um passo só para o usuário.
- **Contras:** duplica o miolo da USP-012; form do prestador incha com campos de Empresa; dois caminhos de criação de Empresa a manter.
- **Custo:** alto (reimplementa parte da USP-012).

## Decisão

Adotamos a **Opção B**. O CNPJ MEI do prestador PF passa a residir em `companies` por meio do **fluxo existente da USP-012** (`Company type=MEI` + `PersonCompanyGrant` RESPONSIBLE). A USP-010 fica restrita a ativar o papel prestador PF + `ProviderProfile` (sem `cnpjMei`); declarar MEI **redireciona** para a USP-012. O enum `CompanyType` é expandido de `{CNPJ_REGULAR, MEI}` para o regime tributário `{MEI, SIMPLES_NACIONAL, LUCRO_PRESUMIDO, LUCRO_REAL, SA}`, com migration mapeando o default `CNPJ_REGULAR` existente para o novo conjunto.

O model `ProviderProfile` do TD §4.5 (sem campo de CNPJ) **permanece correto** — nenhuma alteração de schema no `ProviderProfile`.

## Consequências

**Positivas:**
- Fonte única e autoritativa de CNPJ (`companies`); sem atributo de CNPJ duplicado no perfil PF.
- Regime tributário como classificação de primeira classe, reutilizável por relatórios e pela USP-012.
- Reuso integral do fluxo de Empresa (USP-012, ADR-0014) — sem duplicar lógica.

**Negativas (trade-offs aceitos):**
- Reverte os must-not **P-001** e **P-002** da USP-010 e a resolução do fracasso **F1** — decisão consciente do dono do intent.
- "Prestador PF com MEI" deixa de existir como conceito distinto; quem tem MEI é Empresa MEI (USP-012). A distinção PF-MEI vs Empresa-MEI na busca (antiga P-002) torna-se sem objeto.
- Prestador que deseja MEI percorre dois passos (ativar papel prestador → cadastrar Empresa).
- Migration do enum `CompanyType` precisa mapear registros existentes com default `CNPJ_REGULAR`.

**Neutras / a monitorar:**
- UX do redirect USP-010 → USP-012 deve deixar claro que "ter MEI = cadastrar sua empresa MEI".
- Gate jurídico D-002 (termo `service-offering@v1.0`) permanece inalterado — toca consentimento, não CNPJ.

## Referências

- **USPs servidas:** USP-010 (papel prestador PF, sem CNPJ no perfil), USP-012 (cria Company MEI), USP-027/USP-030 (busca de Empresas passa a englobar MEI declarado).
- ADR-0014 — Empresa sem login próprio, com Pessoas-responsáveis (N:N).
- TD §4.5 — model `ProviderProfile` (inalterado) e `Company`/`CompanyType`.
- `expectations-USP-010.md` (P-001, P-002 revogados; E-002 reescrito), `intent-USP-010.md` (F1 reescrito).
- Matriz §3.7 — ledger de premissas (linha CNPJ MEI do prestador PF revisada).
