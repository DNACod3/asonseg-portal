# Expectations — USP-021: Buscar vagas (pública)

**Origem:** AC-021-1 a AC-021-5 do PRD v0.3, ajustados e estendidos.

## 1. Cenários de sucesso testáveis

- **E-001:** WHEN o visitante acessa a lista de vagas, the system SHALL exibir apenas vagas com status "ativo" — vagas em "em moderação", "pausado", "arquivado", "expirado" ou "rascunho" ficam fora — ordenadas por data de publicação (mais recente primeiro).

- **E-002:** WHEN o visitante aplica múltiplos filtros (área, escolaridade, tipo de contrato, regime, faixa de salário, região), the system SHALL atualizar a lista respeitando **todos os filtros simultaneamente em AND lógico**.

- **E-003:** WHEN o visitante usa busca textual, the system SHALL aplicar match case-insensitive ignorando acentos sobre os campos título, descrição e requisitos.

- **E-004:** WHERE a vaga é visualizada por visitante anônimo, the system SHALL anonimizar o nome da Empresa exibindo apenas o setor (ADR-0017), **em todos os campos** — incluindo título, descrição, requisitos, metadados (SEO/OG), JSON serializado pela API.

  *Ajuste do AC-021-4:* explicita que anonimização aplica-se à camada API/serializer, não apenas ao template visual (toca F1 do intent).

- **E-005:** WHERE a vaga é visualizada por Pessoa autenticada, the system SHALL exibir o nome real da Empresa.

## 2. Proibições (must-not)

- **P-001 (toca F1 — nome da Empresa vaza no conteúdo):** O sistema NÃO PODE exibir nome real da Empresa para visitante anônimo via nenhum vetor — descrição da vaga, requisitos, alt de imagem, meta tags, JSON-LD, payload da API. Anonimização precisa estar na camada de serialização, não apenas no template do front.
  ✅ RESOLVIDO (ADR-0022 + ADR-0028): anonimização no serializer/View Model anônimo + moderação humana complementa.

- **P-002 (toca F2 — visitante perdido):** O sistema NÃO PODE apresentar 6+ filtros como uma única barra horizontal opressiva. Layout precisa esconder filtros secundários por padrão (público com baixo letramento digital — RNF 6.5).
  ✅ RESOLVIDO (dono do intent): área + regime/local prioritários visíveis; resto expansível.

- **P-003 (toca F4 — vaga expirada visível):** O sistema NÃO PODE exibir na busca vaga cuja data de validade já passou, mesmo se o job de expiração (USP-024) atrasou. Verificação on-read precisa garantir consistência independentemente do estado persistido.

- **P-004:** O sistema NÃO PODE expor, em endpoint de busca aberta, dados restritos por ADR-0017 (nome da Empresa para anônimos, dados pessoais de responsáveis, contato direto).

- **P-005:** O sistema NÃO PODE permitir que vaga de Empresa "não verificada" apareça na busca pública.

## 3. Limites

- **L-001 (Performance):** Listagem ≤ 2s p95 no volume estimado (§6.1 do PRD), mesmo durante picos de tráfego anônimo (RP-009).
- **L-002 (Paginação):** Resultado paginado para evitar payload excessivo.
  ✅ RESOLVIDO (project-guideline §7.3): paginação obrigatória via `take`; o tamanho de página é parâmetro tunável.
- **L-003 (Rate limiting):** Endpoint público com rate limiting por IP (RP-009).
- **L-004 (Cache):** Resultado de busca pode ser cacheado em janela curta para suportar picos.
  ✅ RESOLVIDO (ADR-0019 / project-guideline §14.1): ISR + cache curto na busca pública (home TTL 600s) com revalidação on-demand ao publicar/moderar vaga — frescor de vagas recém-publicadas preservado.

## 4. Critérios de pronto, do ponto de vista do dono do intent

- **D-001:** Visitante anônimo, em ensaio, encontra uma vaga específica (preparada pela Bravi com termos distintivos) em ≤ 3 cliques aplicando 1-2 filtros + busca textual. Validado em ≥ 3 ensaios.

- **D-002:** A coordenadora abre a página em modo anônimo (sem login) e confere, em 10 vagas amostradas, que **nenhuma** revela o nome real da Empresa em descrição, requisitos, título ou metadados. Validado por inspeção visual + inspeção de HTML/JSON.

- **D-003:** Em teste de carga sintética simulando 100 visitantes anônimos simultâneos, a lista carrega ≤ 2s p95 (RP-009 mitigado).

- **D-004:** Em teste de vaga expirada por job atrasado: vaga com validade vencida há 2 horas não aparece na busca (verificação on-read).

- **D-005:** A coordenadora valida com 2-3 voluntários da comunidade ASONSEG (público com baixo letramento digital, em celular) que conseguem usar a busca sem ajuda em ≤ 5 min.
