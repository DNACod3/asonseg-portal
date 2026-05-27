# Taxonomia inicial — Regiões, Áreas de vaga e Categorias de serviço

**Origem:** US #111 (sub-task #115) — Fase 0.
**Status:** v1.0 (MVP).
**Fonte do seed:** este documento é a fonte canônica para `prisma/seed.ts` (sub-task #113). Toda alteração nas listas abaixo deve ser refletida no seed e vice-versa.

## Convenções

- **Idempotência:** o seed faz `upsert` por `name` (campo `@unique`). Renomear um item cria um novo registro — para renomear, faça via migração/moderação, não no seed.
- **Itens iniciais** entram com `isSuggestion = false` (já aprovados). Áreas/categorias sugeridas por usuários entram depois com `isSuggestion = true` e passam por moderação.
- **Regiões** representam os bairros atendidos (norte da Ilha de Florianópolis) mais a opção abrangente "Toda Florianópolis".
- Datas (`createdAt`, `approvedAt`) usam `timestamptz` (UTC), default do schema.

---

## 1. Regiões (`Region`)

Bairros do norte da Ilha de Florianópolis atendidos pela ASONSEG (Paróquia Nossa Senhora de Guadalupe, Canasvieiras), além da opção abrangente.

| Nome (`name`) | `cityName` | `state` | `isActive` |
|---|---|---|---|
| Canasvieiras | Florianópolis | SC | true |
| Jurerê | Florianópolis | SC | true |
| Ingleses | Florianópolis | SC | true |
| Cachoeira do Bom Jesus | Florianópolis | SC | true |
| Ponta das Canas | Florianópolis | SC | true |
| Praia Brava | Florianópolis | SC | true |
| Vargem do Bom Jesus | Florianópolis | SC | true |
| Santinho | Florianópolis | SC | true |
| Daniela | Florianópolis | SC | true |
| Toda Florianópolis | Florianópolis | SC | true |

> "Toda Florianópolis" é usada por vagas/serviços sem restrição de bairro (ex.: home office, atendimento em toda a cidade).

---

## 2. Áreas de vaga (`JobArea`)

Áreas profissionais iniciais para classificação de vagas (e área de interesse do candidato). Todas aprovadas (`isSuggestion = false`).

| Nome (`name`) |
|---|
| Administrativa |
| Comércio e Vendas |
| Alimentação e Gastronomia |
| Turismo e Hotelaria |
| Saúde |
| Limpeza e Conservação |
| Construção e Reformas |
| Logística e Transporte |
| Beleza e Estética |
| Educação |
| Tecnologia |
| Serviços Gerais |

> Áreas observadas no protótipo (Administrativa, Comércio, Alimentação/Gastronomia, Turismo, Saúde, Logística, Tecnologia) foram consolidadas e ampliadas para o perfil de empregabilidade da comunidade local.

---

## 3. Categorias de serviço (`ServiceCategory`)

Categorias iniciais para o catálogo de serviços de autônomos/prestadores. Todas aprovadas (`isSuggestion = false`).

| Nome (`name`) |
|---|
| Serviços Domésticos |
| Reparos e Manutenção |
| Área Externa e Jardinagem |
| Beleza e Bem-estar |
| Aulas e Reforço |
| Cuidados (idosos, crianças, pets) |
| Eventos e Buffet |
| Tecnologia e Informática |
| Costura e Confecção |
| Transporte e Fretes |

> Categorias observadas no protótipo (Serviços Domésticos, Reparos e Manutenção, Área Externa, Aulas e Reforço, Tecnologia) foram mantidas e complementadas com cuidados, beleza, eventos, costura e transporte — atividades recorrentes no público da ONG.

---

## Manutenção

- Para **adicionar** um item: incluir na tabela acima e no `prisma/seed.ts`, rodar `npm run db:seed` (idempotente).
- Para **inativar** uma região: setar `isActive = false` (não apagar — preserva integridade referencial de vagas/serviços já vinculados).
- Para **aprovar** uma sugestão de área/categoria: fluxo de moderação (não pelo seed).
