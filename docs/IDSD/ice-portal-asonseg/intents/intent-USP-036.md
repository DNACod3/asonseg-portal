# Intent — USP-036: Cadastrar ficha socioeconômica da Pessoa

**Origem:** PRD v0.3 §5.2, USP-036.
**Dono do intent:** Assistente social (representa o atendimento social institucional).

## 1. Descrição

Assistente social acessa o cadastro social de uma Pessoa e registra dados socioeconômicos mínimos: renda aproximada, benefício social recebido, situação de moradia, composição familiar declarada (texto/número — ADR-0012 deixou Família estruturada para o Release 2). Outcome: ASONSEG mantém ficha social mínima viva para que a Pessoa possa ser encaminhada (USP-037), aparecer na visão consolidada (USP-039) e ser tratada como beneficiária social no fluxo institucional. Acesso a esses dados é restrito a AS e diretoria (ADR-0017).

## 2. Restrições

- Campos: renda aproximada, benefício social recebido, situação de moradia, composição familiar declarada (texto/número) (AC-036-1).
- Sem entidade Família estruturada — composição é declarativa (ADR-0012, Notas USP-036). Família vai para Release 2.
- Edição permitida a qualquer momento, com log de alterações (AC-036-2).
- **Acesso impedido a qualquer Pessoa sem papel AS ou diretoria** (AC-036-3, ADR-0017 — coordenador NÃO vê ficha social; voluntário NÃO vê).
- Consentimento "atendimento social" (finalidade 6 do ADR-0013) precisa estar ativo. Termo precisa estar revisado juridicamente (D-002).
- DPO designado (D-001) — exigido para tratar dado sensível (situação socioeconômica de pessoa vulnerável).
- Criptografia em repouso (RNF 6.3) — dado sensível.

## 3. Cenários de fracasso (de resultado)

**F1. Sem DPO designado, ficha social é cadastrada e dado sensível flui sem responsável institucional pela LGPD.**
D-001 bloqueante para go-live mas operacionalmente, se sistema vai para produção sem DPO formal, a ASONSEG armazena dado sensível sem encarregado — exposição jurídica direta. RP-002 explícito.

✅ RESOLVIDO (compliance LGPD): D-001 resolvida — DPO = diretora Angélica; USP-036 só vai a produção após D-002 (termo da finalidade 6) aprovado.

**F2. Termo da finalidade 6 não está revisado juridicamente, mas AS cadastra mesmo assim por urgência operacional.**
RP-003. Pessoa chega para atendimento, AS abre ficha social, cadastra. Termo "antigo" da ASONSEG não cobre finalidades específicas do ADR-0013. Consentimento é frágil.

✅ RESOLVIDO parte técnica (ADR-0025 / runbook-consent-gate): sim — `requireActiveConsent(pessoa, finalidade 6)` bloqueia escrita/leitura quando o consentimento não está ativo. ❓ Redação do termo da finalidade 6 permanece com jurídico (D-002).

**F3. Coordenador ou voluntário consegue ver ficha social por bug de visibilidade ou má separação de permissões.**
AC-036-3 é uma regra; precisa estar implementada com rigor em todo lugar onde dado social aparece (USP-039 visão consolidada, USP-042 relatórios). Bug deixa coordenador ver sem permissão → vazamento institucional.

✅ RESOLVIDO (ADR-0022 / TD §6.4): guard centralizado (`requirePermission` + checagem de papel AS/diretoria) aplicado inclusive no serializer da visão consolidada (USP-039); anonimização/recorte na montagem do View Model, nunca no template; testes "papel X não vê campo Y" obrigatórios por View Model.

**F4. Edição da ficha social sem justificativa textual obrigatória dificulta auditoria retroativa.**
AC-036-2 exige log das alterações — mas log estruturado (autor, data, valor antes/depois) sem campo "motivo da alteração" reduz utilidade da auditoria. AS muda renda de "1-2 SM" para "3-4 SM" — log mostra a mudança mas não explica.

✅ RESOLVIDO (dono do intent): sim — justificativa textual obrigatória (≥ 20 caracteres) em cada edição da ficha social; trilha de auditoria via ADR-0023. Impacto técnico: nenhum (campo `motivo` registrado por `withAudit`).

**F5. Composição familiar como texto livre/número fica inconsistente entre AS diferentes, prejudica USP-039 e USP-042.**
"3 filhos", "esposo + 3 crianças", "ela mora com a mãe" — três AS diferentes registram diferente. Relatório agregado fica impreciso.

✅ RESOLVIDO (dono do intent): semi-estruturada (qtd. crianças / adultos / idosos como campos numéricos) + observação textual opcional — reduz o problema antes de 'Família estruturada' (R2). Impacto técnico: mínimo (campos extras em ficha_social).

**F6. Pessoa em situação de vulnerabilidade extrema chega sem CPF e ficha social é criada com identificação fraca.**
USP-002 trata cadastro excepcional sem CPF; ficha social pode ser cadastrada antes de o CPF ser obtido. Risco de duplicidade quando o CPF chega depois.

✅ RESOLVIDO (TD §4.5): vinculação Pessoa↔ficha_social via ID interno; a reconciliação preserva a ficha automaticamente (sem perda nem duplicação).

## 4. Cenários de sucesso

**Nível operacional:**
- AS abre cadastro da Pessoa → confirma consentimento finalidade 6 da Pessoa (USP-043) → preenche campos socioeconômicos → salva → log registra autor + data + campos.
- AS edita posteriormente quando situação muda (Pessoa conseguiu trabalho, renda mudou) → novo log.
- Pessoa aparece em USP-039 (visão consolidada) com ficha social visível a AS/diretoria, oculta a outros.
- Pessoa pode ser encaminhada (USP-037) com base na situação registrada.

**Nível agregado:**
- Sem MP direta — ficha social é instrumento de gestão social, não vetor de métrica do funil.
- ADR-0012 entrega o que precisa para o MVP (ficha mínima vinculada à Pessoa, sem Família estruturada).

## 5. Conexões

**USPs upstream:** USP-001 ou USP-002 (Pessoa existe), USP-043 (consentimento finalidade 6).

**USPs downstream:** USP-037 (encaminhamento usa base social), USP-039 (visão consolidada inclui ficha social), USP-042 (relatório agregado eventual).

**ADRs aplicáveis:** ADR-0011 (Pessoa é entidade fundamental), ADR-0012 (Beneficiário é papel social da Pessoa; sem Família estruturada no MVP), ADR-0013 (consentimento finalidade 6), ADR-0017 (acesso restrito a AS/diretoria).

**Métricas tocadas:** — (instrumento, não métrica do funil).

**Riscos relacionados:** RP-002 (DPO), RP-003 (termo finalidade 6).

**Dependências:** D-001 (DPO), D-002 (termo finalidade 6).

**Q-abertas:** —
