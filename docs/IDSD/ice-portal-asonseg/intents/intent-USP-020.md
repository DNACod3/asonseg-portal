# Intent — USP-020: Publicar vaga

**Origem:** PRD v0.3 §5.2, USP-020.
**Dono do intent:** Coordenador da área Portal Empregabilidade (representa a ASONSEG na curadoria de vagas que entram no portal).

## 1. Descrição

Pessoa-responsável de uma Empresa (vínculo do ADR-0014) submete uma vaga (título, área, descrição, requisitos, benefícios, salário, regime, local, validade) em nome dessa Empresa. Outcome desejado: vaga entra na fila de moderação humana (USP-016) com todos os campos necessários e referência à Empresa correta; depois de aprovada, fica descobrível por candidatos (USP-021/USP-022/USP-028) e recebe candidaturas (USP-025). Se for a primeira vaga publicada pela Empresa, dispara também a validação manual da própria Empresa (USP-017) — não basta a vaga estar boa; a Empresa precisa existir de fato.

## 2. Restrições

- Pessoa precisa estar autenticada e ser responsável ativa da Empresa selecionada (AC-029-1 análogo — escolher "publicar em nome de Empresa X"). Tentar publicar para Empresa não vinculada é negado.
- Data de validade obrigatória (AC-020-2) e futura (AC-020-3).
- Submissão coloca em status "em moderação" (AC-020-1); só fica ativo após aprovação humana (USP-016, ADR-0015).
- Rascunho permitido sem submissão (AC-020-4) — pode salvar e voltar.
- Se Empresa não está "verificada" (flag do ADR-0014), submissão da primeira vaga **arrasta a Empresa para validação manual** junto (USP-017) — vaga só vai ao ar quando a Empresa também é aprovada.
- Editar campos da Empresa (CNPJ, razão social, nome fantasia) rebaixa "verificada" para false (ADR-0014) — vagas publicadas depois disso passam por nova validação da Empresa.

## 3. Cenários de fracasso (de resultado)

**F1. Empresa-fantasma publica vaga atrativa, recolhe dados de candidatos (golpe).**
Pessoa com CPF válido cadastra Empresa fictícia (CNPJ válido mas sem operação real), publica vaga sedutora, candidatos se candidatam e expõem contato. Empresa-fantasma usa contato para outras finalidades. RP-005 explícito.

✅ RESOLVIDO (ADR-0024): sim — a 1ª vaga só vai a 'ativo' com a Empresa verificada na mesma transação atômica (verificação + aprovação acopladas). F1 mitigado.

**F2. Vaga aprovada na moderação fica desatualizada quando a Empresa muda os dados.**
Empresa aprovada na primeira vaga; depois, responsável edita CNPJ ou razão social (cenário plausível: erro de digitação ou troca de PJ). Vagas ativas ficam vinculadas a Empresa com dados rebaixados. Candidato vê dados antigos da Empresa.

✅ RESOLVIDO (dono do intent): todas as vagas ativas da Empresa saem do ar até a Empresa ser re-verificada (filtro on-read por 'Empresa verificada'). Mais seguro contra RP-005. Impacto técnico: nenhum estrutural.

**F3. Race condition: duas pessoas-responsáveis da mesma Empresa publicam a mesma vaga simultaneamente.**
Dois responsáveis editam rascunho ao mesmo tempo; sistema acaba com duas vagas idênticas em moderação. Coordenador modera as duas separadamente — pode aprovar uma e rejeitar a outra sem perceber duplicidade.

✅ RESOLVIDO (decisão PO 2026-05-29 / ADR-0021 / TD §3.2): o MVP cobre apenas **deduplicação EXATA** via constraint UNIQUE → 409 determinístico (ADR-0021). Detecção fuzzy de similaridade, alerta ao coordenador e lock por rascunho ficam **fora do escopo do MVP (V2)**; busca semântica/FTS também está fora de escopo (TD §3.2).

**F4. Vaga aprovada está bem escrita, mas tem requisito ilegal (idade máxima, exigência de gênero específico, etc.).**
Coordenador modera focando em "vaga existe, faz sentido", e deixa passar requisito discriminatório. Portal ASONSEG fica publicando algo que viola CLT/legislação trabalhista. Risco reputacional para a ONG.

❓ Existe checklist explícito para o coordenador validar conformidade legal mínima na moderação? (dono do intent — coordenador + jurídico)

**F5. Vaga sem data realista de validade (ex.: 5 anos no futuro) fica eternamente "ativa" — polui busca.**
AC-020-3 exige data futura, mas não limita o quão futura. Empresa publica vaga "sempre aberta" com validade em 2030. Candidatos veem vaga estagnada que provavelmente não está mais sendo recrutada.

✅ RESOLVIDO (dono do intent): teto máximo de 180 dias para a data de validade no submit (tunável); renovável via prorrogação (USP-023). Impacto técnico: nenhum (validação Zod).

## 4. Cenários de sucesso

**Nível operacional:**
- Pessoa-responsável de Empresa verificada publica vaga com todos os campos válidos → entra em moderação.
- Coordenador modera (USP-016), aprova → vaga vai ao ar com nome da Empresa visível para autenticados (AC-021-5).
- Candidatos descobrem (USP-021), veem detalhes (USP-022), candidatam-se (USP-025); empresa recebe na lista (USP-027).
- Quando se aproxima a validade, USP-024 dispara aviso de 3 dias antes (AC-024-3); na validade, vaga vai para "expirado" (AC-024-1) e some da busca.

**Nível agregado:**
- **MP4** — número de vagas publicadas e ativas cresce; demonstra que empresas estão usando o portal.
- Demanda do mercado real chega à comunidade ASONSEG via canal institucional confiável (diferencial do ADR-0015).

## 5. Conexões

**USPs upstream:** USP-012 (Empresa cadastrada), USP-013 (Pessoa é responsável da Empresa), USP-001 (Pessoa autenticada).

**USPs downstream:** USP-016 (moderação aprova), USP-017 (validação da Empresa na primeira vaga), USP-021/USP-022 (descoberta pública), USP-023 (editar/pausar/renovar), USP-024 (expiração), USP-025 (candidatura), USP-027 (lista de candidatos), USP-037 (encaminhamento para esta vaga).

**ADRs aplicáveis:** ADR-0014 (Empresa sem login, com Pessoas-responsáveis), ADR-0015 (Moderação humana pré-publicação).

**Métricas tocadas:** MP4 (vagas publicadas/ativas).

**Riscos relacionados:** RP-005 (empresa-fantasma usa vaga como vetor). Risco proposto: vaga com cláusula discriminatória; risco proposto: vaga eternamente válida (sem teto).

**Dependências:** D-007 (catálogo de áreas e categorias do portal precisa estar fechado para o select de "área").

**Q-abertas:** —
