# Intent — USP-039: Visão consolidada da Pessoa

**Origem:** PRD v0.3 §5.2, USP-039.
**Dono do intent:** Assistente social (uso primário) e diretoria (uso de gestão).

## 1. Descrição

Usuário autorizado (AS, diretoria; coordenador com escopo restrito) abre a ficha de uma Pessoa e vê em painel único: dados pessoais, papéis ativos, ficha socioeconômica (USP-036), candidaturas ativas e históricas (USP-025/USP-026), encaminhamentos (USP-037 + USP-038), serviços oferecidos (USP-029), manifestações de interesse (USP-033), e papéis organizacionais na ASONSEG (USP-008). Outcome: AS/diretoria têm visão integral da relação da Pessoa com a ASONSEG — materialização concreta da decisão Cenário 1 (identidade unificada plena) registrada no CHANGELOG v0.2 e no ADR-0011. Sem esta tela, o investimento estrutural da fundação compartilhada fica invisível à operação.

## 2. Restrições

- Lista todas as dimensões da Pessoa em painel único (AC-039-1).
- Visibilidade por papel rigorosa (AC-039-2):
  - **AS e diretoria:** ficha social + tudo.
  - **Coordenador:** apenas dados operacionais relevantes à sua área (sem ficha social — ADR-0017).
  - **Voluntário comum:** não acessa esta visão.
- Dado sensível (ficha social) acessível apenas a AS e diretoria (ADR-0017, AC-036-3).
- Acesso registrado em log imutável (RNF 6.3) — quem viu, quando.
- DPO designado (D-001) — exigido para qualquer fluxo que consolide dado sensível.

## 3. Cenários de fracasso (de resultado)

**F1. Visão consolidada exposta acidentalmente a usuário não autorizado por bug de visibilidade.**
Coordenador com permissão delegada errada cai na tela e vê tudo, inclusive ficha social. Voluntário com URL direta consegue acessar. Risco institucional grave — vazamento de dado sensível interno.

✅ RESOLVIDO (ADR-0022 + ADR-0030): guard centralizado por papel/permissão, revalidado por request na rota autenticada; testes de visibilidade por papel ("papel X não vê campo Y / não acessa a tela") obrigatórios (TD §6.4).

**F2. Sem DPO designado, visão consolidada com dado sensível em uso operacional viola LGPD.**
RP-002 explícito. AS/diretoria usam a tela em dia a dia; LGPD exige encarregado para tratar dado sensível em volume.

✅ RESOLVIDO (compliance LGPD): D-001 resolvida — DPO = diretora Angélica; USP-039 só vai a produção após D-002 (termos das finalidades 6 e 8) aprovado.

**F3. Coordenador da área Portal Empregabilidade vê visão "restrita" mas ela ainda revela informação suficiente para inferir situação social.**
AC-039-2 dá ao coordenador "dados operacionais relevantes à sua área" — candidaturas, encaminhamentos. Quando coordenador olha uma Pessoa que tem N encaminhamentos e nenhuma candidatura espontânea, infere "essa pessoa é beneficiária social". A inferência expõe sem revelar diretamente.

✅ RESOLVIDO (dono do intent): o coordenador vê encaminhamentos COM badge "encaminhada via ASONSEG" (transparência prioritária). Nota: risco residual de inferência indireta — a ser confirmado com DPO (Angélica). Impacto técnico: nenhum.

**F4. Performance: consolidação cruza muitas tabelas; abrir ficha de Pessoa "popular" (com 30 candidaturas, 10 encaminhamentos, 5 serviços) demora demais.**
Sem otimização, USP-039 vira gargalo. AS desiste de usar; instrumento de gestão é abandonado.

✅ RESOLVIDO (ADR-0022 / project-guideline §14.1): visão consolidada roda em rota autenticada `force-dynamic` (sem cache), montada via View Model `viewPersonConsolidated`; volume baixo dispensa pré-agregação/cache.

**F5. Visão consolidada "convida" a AS a usar dados de candidatura/serviço para fins sociais sem ter consentimento adequado.**
ADR-0017 e ADR-0013 segregam finalidades: dado de candidatura foi consentido para finalidade 2 (candidatura); ficha social para finalidade 6 (atendimento social). Cruzá-los numa única tela pode levar AS a usar candidatura para decisão social (ex.: "ela não está procurando emprego — não é vulnerável") sem que a Pessoa tenha consentido com esse cruzamento.

❓ Termo da finalidade 6 cobre explicitamente cruzamento de dados sociais com dados públicos do portal? Ou cruzamento é uso interno legítimo sem necessidade de consentimento adicional? (dono do intent — jurídico + DPO)

**F6. Pessoa solicita revogação de uma finalidade (USP-043, ADR-0013) — visão consolidada continua mostrando o histórico daquela finalidade.**
Pessoa revoga consentimento da finalidade 3 (oferta de serviço). Papel prestador é desativado, mas serviços históricos ficam no histórico da Pessoa. Visão consolidada continua mostrando. LGPD: dado da finalidade revogada deve ser anonimizado ou removido?

✅ RESOLVIDO (ADR-0025 + ADR-0008): histórico preservado com marcação "finalidade revogada em DD/MM/AAAA"; revogação desativa uso, não apaga. Interpretação confirmada via ADR-0025.

## 4. Cenários de sucesso

**Nível operacional:**
- AS abre ficha da Pessoa Maria → vê papéis ativos (candidata + cliente + beneficiária social) + ficha social + 3 candidaturas históricas + 2 encaminhamentos com resultado → decide próximo passo do atendimento social.
- Diretoria abre visão de Pessoa específica para prestação de contas a doador → exporta painel.
- Coordenador da área Portal Empregabilidade não vê esta visão por padrão (visão restrita) — não acessa ficha social.

**Nível agregado:**
- Sem MP direta — instrumento de gestão. Mas materializa o ROI estrutural da decisão Cenário 1 (CHANGELOG v0.2) e do ADR-0011.

## 5. Conexões

**USPs upstream:** USP-001/USP-002 (Pessoa), USP-009 (papel candidato), USP-010 (prestador), USP-011 (cliente), USP-012/USP-013 (empresa-responsável), USP-025/USP-026 (candidaturas), USP-029 (serviços), USP-033 (manifestações), USP-036 (ficha social), USP-037 (encaminhamentos), USP-038 (resultados).

**USPs downstream:** — (ponto final de consumo).

**ADRs aplicáveis:** ADR-0008 (retenção indefinida — visão histórica sustentada), ADR-0011 (Pessoa unificada — visão consolidada é a justificativa concreta), ADR-0016 (encaminhamento é parte do que se consolida), ADR-0017 (visibilidade por papel — coordenador vê parcial, voluntário não vê).

**Métricas tocadas:** — (instrumento, não vetor de métrica).

**Riscos relacionados:** RP-002 (DPO — sem ele, fluxo de dado sensível desconfortável). Risco proposto: visão consolidada exposta acidentalmente a não-autorizado (registrado na matriz). Risco proposto: inferência indireta de situação social via dados operacionais visíveis ao coordenador.

**Dependências:** D-001 (DPO designado).

**Q-abertas:** —
