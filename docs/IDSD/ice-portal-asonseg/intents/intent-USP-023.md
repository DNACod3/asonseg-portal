# Intent — USP-023: Editar vaga (pausar, arquivar, renovar)

**Origem:** PRD v0.3 §5.2, USP-023.
**Dono do intent:** Coordenador da área Portal Empregabilidade.

## 1. Descrição

Pessoa-responsável da Empresa precisa gerenciar uma vaga já no ar: editar conteúdo, pausar temporariamente, arquivar quando o recrutamento acaba, ou prorrogar validade quando precisa mais tempo. Outcome: estado da vaga reflete fielmente o momento do recrutamento real; vaga arquivada não atrapalha quem está vendo lista; vaga editada vai para nova moderação (preserva controle de qualidade); pausar/prorrogar são operações leves que não passam por nova moderação.

## 2. Restrições

- Editar conteúdo (qualquer campo informativo) → volta a "rascunho" e exige nova moderação antes de voltar a "ativo" (AC-023-1).
- Pausar → "pausado" (oculta da busca, não exige re-moderação para reativar) (AC-023-2).
- Arquivar → "arquivado" (terminal) (AC-023-3).
- Prorrogar validade só altera a data; vaga continua "ativa" sem re-moderação (AC-023-4). Decisão consciente: prorrogação é metadata, não muda conteúdo.
- Operações restritas à Pessoa-responsável ativa da Empresa dona da vaga (ADR-0014).

## 3. Cenários de fracasso (de resultado)

**F1. "Editar" virou ferramenta para empurrar vaga aprovada de volta ao topo da lista renovando data de publicação.**
Empresa-responsável "edita" um caractere irrelevante, vaga volta para rascunho, é re-moderada, e a data de publicação atualiza — vaga ressurge no topo. Comportamento que pode ser usado para subir vagas indevidamente.

✅ RESOLVIDO (ADR-0024): preserva-se a published_at original em re-aprovação (anti-manipulação de ranking).

**F2. Prorrogação infinita transforma vaga em "evergreen" desatualizada — desvio do RP-005 análogo.**
Sem teto, responsável pode prorrogar 10 vezes em sequência e a vaga vira poluição na lista. Mesmo F5 do USP-020 (validade longa demais) reaparece via prorrogação sucessiva.

✅ RESOLVIDO (dono do intent): prorrogação livre — sem limite e sem alerta. Impacto técnico: nenhum.

**F3. Vaga pausada some da busca mas continua acessível por link direto — candidatos chegam de e-mail antigo e se confundem.**
Pausada = oculta da busca, mas o detalhe (USP-022) ainda pode ser carregado por URL salva. Candidato vê página normal e tenta candidatar-se; sistema bloqueia silenciosamente ou comporta-se de forma inconsistente.

✅ RESOLVIDO (dono do intent): o detalhe da vaga pausada exibe "vaga temporariamente pausada" (não redireciona). Impacto técnico: nenhum (UI).

**F4. Editar vaga ativa rebaixa para rascunho, mas candidaturas em andamento ficam órfãs.**
Vaga tem 12 candidaturas ativas; responsável edita e vai para rascunho. Candidatos não são avisados. Quando vaga volta a ativa, candidaturas continuam — mas o conteúdo da vaga mudou; candidato candidatou-se a vaga A, agora a descrição é vaga B.

✅ RESOLVIDO (dono do intent): candidaturas seguem sem atrito — sem notificação aos candidatos na re-moderação por edição; sem re-confirmação. Impacto técnico: nenhum.

## 4. Cenários de sucesso

**Nível operacional:**
- Responsável corrige campo errado → edita → rascunho → submete → coordenador modera → ativa de novo.
- Responsável pausa porque ficou sem capacidade interna de processar candidaturas → vaga some da busca; despausa quando volta a ter tempo.
- Responsável prorroga validade em 30 dias quando o recrutamento ainda está em curso → ajuste rápido sem fricção.
- Arquivar quando o cargo é preenchido → vaga sai do ar permanentemente.

**Nível agregado:**
- Lista pública mantém-se "viva" e relevante — apoia conversão saudável do funil.

## 5. Conexões

**USPs upstream:** USP-020 (vaga existe).

**USPs downstream:** USP-016 (re-moderação após edição).

**ADRs aplicáveis:** ADR-0015 (edição de conteúdo volta a moderação — preserva curadoria).

**Métricas tocadas:** —

**Riscos relacionados:** Risco proposto: prorrogação infinita gerando vaga evergreen. Risco proposto: data de publicação manipulada via "edição cosmética + re-moderação".

**Dependências:** —

**Q-abertas:** —
