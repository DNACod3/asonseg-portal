# Intent — USP-042: Relatórios operacionais do Portal

**Origem:** PRD v0.3 §5.2, USP-042.
**Dono do intent:** Coordenador da área Portal Empregabilidade (uso operacional) e Diretoria (prestação de contas institucional).

## 1. Descrição

Coordenador e diretoria consultam relatórios básicos do Portal: vagas por período/status, candidaturas por período, serviços por período/categoria, encaminhamentos (USP-037 + USP-038), fila de moderação (USP-016 — MP10). Outcome: ASONSEG acompanha a operação do Portal, prestação de contas institucional para doadores/parceiros, identificação precoce de problemas (ex.: gargalo na moderação, baixa conversão de encaminhamento, vagas sem candidatos). Exportação em CSV e PDF disponível.

## 2. Restrições

- Filtros: período, status, categoria (AC-042-1).
- Exportação CSV (≤ 10s p95 para janela mensal — RNF 6.1) e PDF (≤ 20s p95) (AC-042-2).
- Estrutura mínima viável no MVP — detalhamento de filtros/agrupamentos refinado durante sprints (D-005 + QP-005).
- Acesso restrito a coordenador (escopo da própria área) e diretoria (escopo geral).
- Dado sensível (ficha social) NÃO aparece em relatórios disponíveis ao coordenador — ADR-0017. Diretoria + AS podem ter relatórios separados com dado sensível, mas com restrição.
- DPO designado (D-001) — relatórios com dado pessoal exigem encarregado.

## 3. Cenários de fracasso (de resultado)

**F1. Relatório com dado pessoal exportado em CSV é compartilhado por canal não-criptografado.**
Coordenador exporta lista de candidaturas com nome e contato, envia por e-mail ou Slack para diretoria. CSV em trânsito sem criptografia → vazamento.

✅ RESOLVIDO (dono do intent — D-001 resolvida): sim — CSVs exportados carregam cabeçalho "Dados pessoais — uso restrito" + nome do exportador + data; orientação textual sobre manuseio compõe o treinamento operacional do coordenador. Impacto técnico: nenhum (template do export).

**F2. Sem DPO designado, relatórios com dado pessoal em uso operacional violam LGPD.**
RP-002. Coordenador roda relatório semanal; diretoria roda mensal. Sem encarregado formal, ASONSEG opera tratamento de dado pessoal sem responsável institucional.

✅ RESOLVIDO (compliance LGPD): D-001 resolvida (DPO = Angélica); agregados sem PII liberados desde o início; relatórios com PII após D-002 (termos das finalidades 6/8) aprovado.

**F3. Estrutura mínima do MVP gera relatórios que não respondem perguntas reais — coordenador improvisa em planilhas paralelas.**
QP-005 explícito. Sem detalhamento (filtros, agrupamentos, métricas calculadas), coordenador exporta CSV cru e abre no Excel para fazer pivot. Fricção. Recurso usado de forma incompleta.

❓ Diretoria valida cedo (primeiros sprints) quais 3-5 relatórios são prioritários e quais filtros mínimos eles precisam? (dono do intent — diretoria + coordenador) → D-005, QP-005

**F4. Relatório de encaminhamentos com MP9 inflada (cf. F1 do USP-038) leva diretoria a decisão estratégica baseada em métrica enviesada.**
Encadeamento do viés de registro. Diretoria vê "85% de contratação dos encaminhamentos" e amplia a permissão para mais voluntários encaminharem. Métrica é frágil; consequência operacional é real.

✅ RESOLVIDO (dono do intent): sim — taxa de "sem resultado registrado" exibida lado a lado com taxa de sucesso (transparência sobre limites do dado).

**F5. Performance de exportação em janela longa (ex.: 1 ano) excede RNF 6.1 — coordenador desiste.**
Janela mensal cabe em ≤ 10s; janela anual com joins pode demorar minutos. Sem paginação ou pre-agregação, exportar relatório anual trava.

✅ RESOLVIDO (project-guideline §14.2 + decisão PO 2026-05-29): pré-agregação para relatórios de janela longa; **SEM limite de janela no MVP** (volume baixo) — o limite fica como parâmetro tunável. Export CSV ≤ 10s / PDF ≤ 20s p95 (§14.1).

**F6. Relatório de "fila de moderação" expõe inadvertidamente o conteúdo em rascunho para usuário não-autorizado.**
USP-018 trata visibilidade de rascunho. Relatório agregando "vagas em moderação" pode listar título + autor; se acessível a voluntário sem permissão de moderar, vaza conteúdo pré-publicação.

✅ RESOLVIDO (ADR-0022 + ADR-0001 estendido): sim — visibilidade do relatório de fila por papel/permissão delegada (coordenador + Pessoa com permissão "moderar").

## 4. Cenários de sucesso

**Nível operacional:**
- Coordenador roda relatório mensal de vagas (publicadas, ativas, expiradas, % aprovadas na moderação) → identifica que tempo de moderação subiu → aciona mais voluntários delegados.
- Diretoria roda relatório trimestral de encaminhamentos (MP8 + MP9) para prestação de contas a doador parceiro → exporta PDF.
- AS roda relatório de Pessoas com ficha social cadastrada por região para planejamento de ação social.

**Nível agregado:**
- **MP1–MP10** consolidados em relatórios. Função de "ver o todo do Portal".

## 5. Conexões

**USPs upstream:** todas as USPs operacionais (USP-016, USP-020, USP-025, USP-029, USP-033, USP-036, USP-037, USP-038, etc.).

**USPs downstream:** — (ponto final de consumo).

**ADRs aplicáveis:** ADR-0008 (retenção indefinida sustenta relatórios históricos), ADR-0017 (visibilidade por papel mantida nos relatórios).

**Métricas tocadas:** MP1, MP4, MP5, MP6, MP7, MP8, MP9, MP10 (consolidação para gestão e prestação de contas).

**Riscos relacionados:** RP-002 (DPO). Risco proposto: CSV exportado compartilhado por canal não-seguro. Risco proposto: MP9 inflada (encadeamento do viés de USP-038).

**Dependências:** D-001 (DPO), D-005 (relatórios prioritários definidos).

**Q-abertas:** QP-005 (quais relatórios prioritários e quais filtros mínimos).
