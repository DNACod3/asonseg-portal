# Intent — USP-043: Consentimentos LGPD por finalidade

**Origem:** PRD v0.3 §5.2, USP-043.
**Dono do intent:** Diretoria (responsável legal pela LGPD na ASONSEG). DPO (a designar — D-001) operacionaliza.

## 1. Descrição

Sistema gerencia consentimentos LGPD por finalidade (ADR-0013) — não um termo único, mas múltiplos consentimentos vinculados às 8 finalidades previstas no MVP (cadastro, candidatura, oferta de serviço, contratação de serviço, representação de Empresa, atendimento social, extração de CV via IA, encaminhamento institucional). Cada vez que Pessoa ativa um papel ou usa uma funcionalidade vinculada a uma finalidade nova, o termo dessa finalidade é exibido e aceite explícito é exigido. Pessoa pode visualizar todos os consentimentos vigentes e revogar individualmente — revogação desativa o papel/funcionalidade vinculada sem afetar outras. Outcome: ASONSEG materializa o princípio LGPD da granularidade do consentimento; Pessoa tem controle real sobre as finalidades de uso dos seus dados; risco jurídico institucional cai.

## 2. Restrições

- Sistema exibe o termo específico da finalidade e exige aceite explícito antes de prosseguir (AC-043-1).
- Persistência mínima por consentimento: titular, finalidade, versão do termo, data/hora, IP (AC-043-2).
- Pessoa consulta consentimentos vigentes em painel próprio (AC-043-3).
- Revogação individual desativa papel/funcionalidade vinculada à finalidade revogada sem afetar outras (AC-043-4).
- Sem capacidade legal/operacional de revogar consentimentos antes do go-live se os termos não foram revisados juridicamente — D-002 bloqueante.
- DPO designado (D-001) — exigido para operação LGPD em produção.
- Conjunto de 8 finalidades fechado no MVP (ADR-0013). Adicionar finalidade nova fora desse conjunto exige decisão formal de produto + jurídica.

## 3. Cenários de fracasso (de resultado)

**F1. Termo da finalidade X não foi revisado juridicamente, sistema vai a produção sem ele.**
RP-003 explícito. Equipe técnica entrega USP-043 funcional, mas ASONSEG não conseguiu finalizar a redação jurídica de uma ou mais das 8 finalidades. Sistema em produção pede aceite de termo "rascunho" ou genérico — consentimento juridicamente frágil.

✅ RESOLVIDO parte técnica (ADR-0025 / runbook-consent-gate): sim — o sistema bloqueia ativação de papel/funcionalidade sem consentimento ativo da finalidade (`requireActiveConsent` on-read). ❓ Aprovação jurídica de cada um dos 8 termos permanece gate D-002 (jurídico).

**F2. Pessoa revoga consentimento da finalidade mas papel continua ativo por bug — funcionalidade segue operando.**
AC-043-4 obriga desativação cascateada. Mas implementação tem que cobrir todos os caminhos: candidato revoga finalidade 2 → candidaturas ativas? Continuam? São canceladas? Empresa é notificada?

✅ RESOLVIDO — MECANISMO (ADR-0025): matriz declarativa finalidade→efeitos + `requireActiveConsent` on-read em toda operação ligada à finalidade + registro de revogação append-only (ADR-0023), tudo em transação (ADR-0020); sem janela de "papel ativo com consentimento revogado". ❓ SEMÂNTICA (gate de negócio — preservado): o destino concreto de candidaturas/manifestações ativas (cancela? esconde? mantém histórico bloqueando novas?) e a notificação à Empresa são definidos pela DPO (Angélica) + jurídico antes da USP-043 — basta preencher a matriz, sem mudança estrutural. (cf. F6 do USP-039)

**F3. Versão do termo é alterada sem que Pessoas existentes saibam — aceite vigente refere-se a versão antiga.**
ASONSEG atualiza termo da finalidade 7 (mudança de provedor LLM, por exemplo). Pessoas que aceitaram a versão antiga continuam consentindo com versão antiga. Está OK juridicamente? Ou exige re-aceite?

✅ RESOLVIDO parte técnica (ADR-0025): mecanismo de versionamento implementado — versão+data+IP em cada aceite; mudança "major" dispara re-aceite. ❓ Classificação caso a caso (minor vs major) permanece com a DPO (Angélica) + jurídico.

**F4. UX de aceite múltiplo (ao ativar 3 papéis em sequência, Pessoa vê 3 modais) gera fadiga e clique automático.**
ADR-0013 antecipou isso. Pessoa ativa candidato → modal finalidade 2; ativa prestador → modal finalidade 3; ativa cliente → modal finalidade 4. Três OKs sem leitura. Consentimento formal sem informação real.

✅ RESOLVIDO (dono do intent): aceite CONTEXTUAL — cada aceite aparece no momento da ação que precisa daquela finalidade (cf. ADR-0013); textos curtos, cada aceite visualmente separado. Impacto técnico: nenhum (UX por fluxo).

**F5. Painel de consentimentos vigentes (AC-043-3) não inclui base legal — Pessoa não entende por que precisa consentir.**
LGPD obriga transparência sobre base legal. Painel mostra "Você consentiu com Finalidade 6 em 12/03/2025"; Pessoa não sabe o que é finalidade 6 nem por que importa.

✅ RESOLVIDO (dono do intent): painel de consentimentos exibe nome humano da finalidade + descrição curta + base legal LGPD (transparência máxima). Impacto técnico: nenhum (conteúdo do termo).

**F6. Revogação não tem confirmação dupla e Pessoa revoga acidentalmente — perde papel/funcionalidade sem entender.**
AC-043-4 desativa imediatamente. Pessoa "limpa lista" achando que é só "ocultar"; perde candidaturas e papel candidato. Frustração + LGPD: Pessoa pode reaver? Re-consentir restaura papel imediatamente?

✅ RESOLVIDO (dono do intent): revogação pede confirmação ÚNICA ("tem certeza?"); Pessoa pode reativar dando novo aceite (sem re-cadastrar o papel) — preferível sob LGPD. Impacto técnico: nenhum (ADR-0023 + ADR-0025 cobrem).

**F7. Auditoria do consentimento é critical-path para LGPD; sem log imutável, defesa jurídica fica frágil.**
AC-043-2 exige persistência de titular+finalidade+versão+data+IP. RNF 6.3 exige log imutável para "ativação/revogação de consentimento". Se a implementação grava em tabela mutável (que pode ser editada/deletada), defesa LGPD vira frágil em incidente.

✅ RESOLVIDO (ADR-0023 / TD §4.5 §7.2): `consents` append-only **forçado no DB** (`REVOKE UPDATE,DELETE`) + **hash de integridade encadeado** + cripto em repouso; revogação = novo INSERT.

## 4. Cenários de sucesso

**Nível operacional:**
- Pessoa cria conta → consentimento finalidade 1 (cadastro/autenticação) exibido + aceito.
- Pessoa ativa papel candidato (USP-009) → consentimento finalidade 2 exibido + aceito.
- Pessoa ativa papel prestador (USP-010) → finalidade 3.
- Pessoa acessa painel "Meus consentimentos" → vê todos os vigentes + opção de revogar individualmente.
- Pessoa revoga finalidade 3 → papel prestador desativado; serviços passam para arquivado; consentimentos 1, 2 continuam ativos.

**Nível agregado:**
- ASONSEG tem trilha auditável para cada Pessoa: o que consentiu, quando, em qual versão do termo.
- Diferencial institucional vs portais que usam termo único genérico.

## 5. Conexões

**USPs upstream:** — (ponto de origem — transversal).

**USPs downstream:** USP-001 (cadastro), USP-006 (login), USP-009 (papel candidato), USP-010 (prestador), USP-011 (cliente), USP-012 (empresa-responsável), USP-025 (candidatura), USP-033 (manifestação), USP-036 (ficha social), USP-037 (encaminhamento), USP-040 (extração via IA).

**ADRs aplicáveis:** ADR-0008 (retenção do registro de consentimento — log imutável), ADR-0013 (consentimentos por finalidade — pedra angular).

**Métricas tocadas:** — (transversal, instrumento LGPD).

**Riscos relacionados:** RP-002 (DPO designado é pré-requisito), RP-003 (termos por finalidade revisados juridicamente são pré-requisito).

**Dependências:** D-001 (DPO), D-002 (termos das 8 finalidades revisados).

**Q-abertas:** —
