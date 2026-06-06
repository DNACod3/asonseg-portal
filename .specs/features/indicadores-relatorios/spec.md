# Indicadores e Relatórios Specification

## Problem Statement

A ASONSEG precisa demonstrar publicamente que o portal tem atividade real (vagas, candidatos, empresas) para motivar a participação de visitantes anônimos, e precisa fornecer à coordenação e à diretoria relatórios operacionais para acompanhamento da operação e prestação de contas institucional. Hoje, no MVP em fase de documentação, não há nenhuma camada de indicadores em tempo real na home pública nem qualquer relatório operacional exportável; sem isso, o portal não evidencia tração para o público nem oferece insumos de governança para o sponsor. Adicionalmente, há a necessidade de tracking básico das métricas funcionais MP1–MP10 para monitoramento de sucesso e dimensionamento operacional.

## Goals

- [ ] Exibir na home pública, em tempo real (cache curto admitido), os indicadores de vagas ativas, candidatos ativos e empresas verificadas.
- [ ] Garantir que a home pública carregue em ≤ 1.5s no p95, com estratégia de cache curto / ISR + revalidação on-demand.
- [ ] Disponibilizar relatórios operacionais filtráveis (vagas por período/status, candidaturas por período, serviços por período/categoria, encaminhamentos, fila de moderação) para usuários autorizados (coordenador, diretoria).
- [ ] Permitir exportação dos relatórios em CSV (≤ 10s p95, janela mensal) e PDF (≤ 20s p95).
- [ ] Suportar o tracking básico das métricas funcionais MP1–MP10 via queries Postgres.
- [ ] Restringir o acesso aos relatórios operacionais apenas a papéis autorizados, com auditoria de acesso quando aplicável.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Dashboard público embutido em site institucional | Integração ativa com o site institucional planejada para V2; no MVP os indicadores agregados ficam na home pública do portal e na exportação CSV/PDF. |
| SEO técnico avançado da home pública | Otimização técnica de SEO fora do escopo do MVP; planejado para V2. |
| Definição de metas concretas (números absolutos) para MP1–MP10 | Dependência D-004 / QP-007 — a definir com o sponsor ASONSEG no início do projeto; aqui apenas o tracking das métricas é coberto. |
| Refinamento detalhado de filtros e agrupamentos dos relatórios | Estrutura mínima viável no MVP; detalhamento refinado durante as sprints (Fase 0 — questão aberta). |

## User Stories

### P1: Home pública com indicadores em tempo real ⭐ MVP

**User Story**: Como visitante anônimo, quero ver na home do portal o número atual de vagas ativas, candidatos ativos e empresas verificadas para que eu perceba que o portal tem atividade e seja motivado a participar.

**Why P1**: Prioridade Must no PRD (USP-041, Épico 11). A percepção de atividade real é decisiva para conversão de visitantes em participantes (candidatos, empresas, prestadores); sem indicadores visíveis, a home não evidencia tração e compromete a adoção do portal.

**Acceptance Criteria**:
1. QUANDO o visitante anônimo acessa a home ENTÃO o sistema DEVE exibir o total de vagas com status "ativo" (MP4 — vagas publicadas e aprovadas/ativas).
2. QUANDO o visitante anônimo acessa a home ENTÃO o sistema DEVE exibir o total de candidatos com perfil "ativo" (MP1 — candidatos com perfil ativo moderado).
3. QUANDO o visitante anônimo acessa a home ENTÃO o sistema DEVE exibir o total de Empresas "verificadas" (MP2 — empresas verificadas com ao menos 1 vaga aprovada).
4. QUANDO os dados de origem (vagas, candidatos, empresas) mudam ENTÃO o sistema DEVE atualizar os indicadores em tempo real, sendo admitido cache curto (ISR 10min + revalidação on-demand), conforme política definida pelo Arquiteto.
5. QUANDO o visitante anônimo acessa a home ENTÃO o sistema DEVE renderizar a página com os indicadores em ≤ 1.5s no p95.

**Independent Test**: Acessar a home como visitante anônimo (sem sessão) e verificar que os três indicadores (vagas ativas, candidatos ativos, empresas verificadas) são exibidos com valores coerentes com o estado do banco; criar/aprovar uma nova vaga e confirmar que o indicador é atualizado após a revalidação; medir o tempo de carga da home e confirmar ≤ 1.5s no p95.

### P1: Relatórios operacionais do Portal ⭐ MVP

**User Story**: Como coordenador ou membro da diretoria, quero consultar relatórios básicos do portal (vagas por período/status, candidaturas por período, serviços por período/categoria, encaminhamentos, fila de moderação) para que eu acompanhe a operação e a prestação de contas institucional.

**Why P1**: Prioridade Must no PRD (USP-042, Épico 11). Os relatórios são o principal insumo de governança e prestação de contas institucional do MVP e permitem o monitoramento das métricas funcionais (incluindo MP10 para dimensionar a moderação).

**Acceptance Criteria**:
1. QUANDO um usuário autorizado (coordenador, diretoria) acessa um relatório ENTÃO o sistema DEVE exibir uma lista filtrável por período, status e categoria.
2. QUANDO um usuário não autorizado tenta acessar um relatório operacional ENTÃO o sistema DEVE negar o acesso.
3. QUANDO o usuário autorizado solicita um relatório de vagas ENTÃO o sistema DEVE apresentar os dados por período e status (MP4 — vagas publicadas e aprovadas).
4. QUANDO o usuário autorizado solicita um relatório de candidaturas ENTÃO o sistema DEVE apresentar os dados por período (MP6 — candidaturas realizadas).
5. QUANDO o usuário autorizado solicita um relatório de serviços ENTÃO o sistema DEVE apresentar os dados por período e categoria (MP5 — serviços publicados e aprovados; MP7 — manifestações de interesse em serviços).
6. QUANDO o usuário autorizado solicita um relatório de encaminhamentos ENTÃO o sistema DEVE apresentar os dados de encaminhamentos ASONSEG (MP8 — encaminhamentos criados; MP9 — % de encaminhamentos com resultado positivo/contratado).
7. QUANDO o usuário autorizado solicita o relatório de fila de moderação ENTÃO o sistema DEVE apresentar os dados da fila e do tempo de moderação (MP10 — tempo médio de moderação envio → decisão; MP3 — prestadores ativos com ao menos 1 serviço aprovado).
8. QUANDO o usuário autorizado solicita a exportação de um relatório em CSV ENTÃO o sistema DEVE gerar o arquivo CSV em ≤ 10s no p95 para janela mensal.
9. QUANDO o usuário autorizado solicita a exportação de um relatório em PDF ENTÃO o sistema DEVE gerar o arquivo PDF em ≤ 20s no p95.

**Independent Test**: Autenticar como coordenador, acessar cada relatório (vagas, candidaturas, serviços, encaminhamentos, fila de moderação), aplicar filtros de período/status/categoria e verificar que a lista é filtrada corretamente; exportar um relatório de janela mensal em CSV e em PDF, validando o conteúdo e medindo os tempos (≤ 10s CSV, ≤ 20s PDF no p95); tentar acessar como usuário sem permissão e confirmar a negação de acesso.

## Edge Cases

- QUANDO não há nenhuma vaga ativa, candidato ativo ou empresa verificada (estado inicial / baseline 0) ENTÃO o sistema DEVE exibir o valor zero nos indicadores da home sem erro.
- QUANDO a query de indicadores da home falha ou o cache está indisponível ENTÃO o sistema DEVE manter a home carregável dentro do limite de performance, exibindo o último valor em cache ou um estado de fallback sem quebrar a página.
- QUANDO um relatório é solicitado para um período sem dados ENTÃO o sistema DEVE exibir lista vazia e permitir a exportação de um arquivo CSV/PDF vazio (apenas cabeçalhos) sem erro.
- QUANDO a exportação CSV de janela mensal excede 10s ou a PDF excede 20s ENTÃO o sistema DEVE registrar o desvio de performance para monitoramento (NFR de performance).
- QUANDO um usuário não autorizado tenta exportar um relatório ENTÃO o sistema DEVE negar a operação e não gerar arquivo.
- QUANDO indicadores e MP9 ainda não têm resultados registrados (— no baseline) ENTÃO o sistema DEVE tratar a ausência de dados sem exibir percentual indevido (ex.: "—" ou 0).

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| REL-01 | USP-041 | Design | Pending |
| REL-02 | USP-041 | Design | Pending |
| REL-03 | USP-041 | Design | Pending |
| REL-04 | USP-042 | Design | Pending |
| REL-05 | USP-042 | Design | Pending |
| REL-06 | USP-042 | Design | Pending |

## Success Criteria

- [ ] A home pública exibe, para visitantes anônimos, vagas ativas (MP4), candidatos ativos (MP1) e empresas verificadas (MP2), atualizados em tempo real com cache curto.
- [ ] A home pública carrega em ≤ 1.5s no p95.
- [ ] Coordenador e diretoria acessam relatórios filtráveis por período, status e categoria para vagas, candidaturas, serviços, encaminhamentos e fila de moderação.
- [ ] Exportação CSV ocorre em ≤ 10s p95 (janela mensal) e PDF em ≤ 20s p95.
- [ ] Acesso aos relatórios é restrito a papéis autorizados.
- [ ] As métricas funcionais MP1–MP10 são apuráveis via queries Postgres a partir dos relatórios e indicadores.
