# Intent — USP-016: Moderar rascunho (vaga, CV ou serviço)

**Origem:** PRD v0.3 §5.2, USP-016.
**Dono do intent:** Coordenador da área Portal Empregabilidade (julga "pronto") + diretoria (define padrão de qualidade).

## 1. Descrição

O coordenador da área Portal Empregabilidade (ou voluntário com permissão delegada via USP-008) revisa rascunhos de vaga, CV/perfil de candidato e serviço enfileirados em "em moderação". Decisão: aprovar (status vira "ativo", conteúdo visível), devolver para ajustes com motivo textual obrigatório (status vira "aguardando ajustes"), ou rejeitar definitivamente com motivo textual (status vira "rejeitado"). Autor é notificado por e-mail (USP-044) em qualquer um dos três caminhos.

Esta USP é o **gate qualitativo** do portal — diferencial declarado do MVP (ADR-0015). É também o ponto onde **três riscos críticos se concentram**: RP-004 (carga inviabilizando operação), RP-005 (empresa-fantasma escapa — combina com USP-017) e RP-010 (sem fluxo formal de denúncia, moderação pré-publicação é a única defesa proativa).

## 2. Restrições

- Fila ordenada por data de envio (AC-016-1).
- Motivo textual obrigatório em "devolver" e "rejeitar" (AC-016-3, AC-016-4).
- Sem SLA formal no MVP — coordenador processa conforme capacidade.
- Permissão delegável via USP-008 (itens 1, 2, 3 do catálogo do Portal).
- Auditoria imutável da decisão (autor, motivo, momento, conteúdo afetado).
- E-mail ao autor em qualquer decisão (USP-044).

## 3. Cenários de fracasso (de resultado)

**F1. Fila acumula e moderação não dá conta — autores frustrados desistem.**
Materialização de RP-004. Sem SLA formal e sem alerta de fila crescendo, coordenador perde a régua. Conteúdo aprovável fica "em moderação" por dias/semanas. Métrica MP10 acompanha o sintoma mas não a causa — é preciso alerta operacional.

✅ RESOLVIDO (dono do intent): alerta ao coordenador quando a fila tem >10 itens pendentes OU um item há >48h em fila (limiares tunáveis). Impacto técnico: nenhum (observabilidade — TD §8.3).

**F2. Empresa-fantasma é aprovada na primeira vaga porque coordenador não inspeciona dados da Empresa.**
Materialização de RP-005. USP-017 prevê inspeção, mas se a UI do moderador na USP-016 não diferenciar claramente "Empresa não verificada — primeira vaga" e a checklist de verificação não estiver pronta (entregável Fase 0), coordenador trata como vaga rotineira.

**F3. Motivo textual vazio ou genérico em "devolver para ajustes" — autor não consegue corrigir.**
AC-016-3 exige motivo, mas sem conteúdo mínimo. Coordenador apressado digita "ajustar" ou "—"; autor recebe e-mail sem saber o que fazer; refaz o submit sem entender o erro, volta para a fila e cria loop.

✅ RESOLVIDO (dono do intent): motivo de devolução ≥ 20 caracteres em texto livre + lista opcional de motivos comuns.

**F4. Conteúdo problemático aprovado por erro humano e descoberto depois — moderador não tem como reverter rapidamente.**
USP-018 (inativar conteúdo já publicado) é o escape válve, mas se a UI não conectar "vaga moderada por X em data Y" à USP-018, demora a achar e reagir. RP-010 materializa.

**F5. Voluntário com permissão delegada modera conteúdo da própria Empresa (conflito de interesse).**
Voluntário que também tem papel empresa-responsável publica vaga e ele mesmo modera. Sem grade de proteção, conflito de interesse não é detectado.

✅ RESOLVIDO (ADR-0024): sim — a fila de moderação exclui itens cujo autor é o moderador (autor≠moderador garantido na query).

**F6. Decisão de moderação é tomada via API direta, fora da UI, e log de auditoria não captura adequadamente.**
Operação programática bypass — moderador "aprova em massa" via script. Auditoria fica incompleta; coordenador real perde controle.

## 4. Cenários de sucesso

**Nível operacional:**
- Coordenador (ou voluntário delegado) abre fila, processa em ordem.
- Cada item moderado: decisão tomada em ≤ 5 min para vaga simples / ≤ 10 min para vaga com Empresa não-verificada (precisa inspecionar Empresa via USP-017).
- Autor recebe e-mail em < 5 min após decisão.
- ✅ RESOLVIDO (proposta — ratificação do sponsor): MP10 (tempo médio envio→decisão) ≤ 72h.

**Nível agregado:**
- MP10 (tempo médio de moderação) — saúde operacional.
- ✅ RESOLVIDO (dono do intent): métrica instrumentada = % de aprovação na 1ª revisão.
- ✅ RESOLVIDO (dono do intent): métrica instrumentada = nº de devoluções por motivo (top 3).

## 5. Conexões

**USPs upstream:**
- USP-008 (permissão delegada para o voluntário ou direto para o coordenador).
- USP-020 (vaga em moderação), USP-009 (CV em moderação), USP-029 (serviço em moderação).

**USPs downstream:**
- USP-017 (validação da Empresa quando é primeira vaga).
- USP-018 (escape válve pós-publicação).
- USP-021, USP-028, USP-030 (conteúdo aprovado vira visível).
- USP-044 (e-mail ao autor).

**ADRs aplicáveis:**
- ADR-0001 (estendido — permissões delegáveis do Portal)
- ADR-0015 (moderação humana pré-publicação)

**Métricas tocadas:** MP10.

**Riscos relacionados:** RP-004, RP-005, RP-010.

**Dependências:** D-006 (catálogo final de permissões).

**Q-abertas:** —
