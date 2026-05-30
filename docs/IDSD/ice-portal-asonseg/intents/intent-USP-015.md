# Intent — USP-015: Editar dados da Empresa

**Origem:** PRD v0.3 §5.2, USP-015.
**Dono do intent:** Sponsor + coordenador (anti-fraude pós-verificação).

## 1. Descrição

Uma Pessoa-responsável edita dados cadastrais da Empresa (descrição, endereço, contato, etc.). Outcome: edição persistida; quando a edição alterar CNPJ, razão social ou nome fantasia (campos identitários), a Empresa é rebaixada para "não verificada" e exigirá nova validação manual na próxima vaga publicada (AC-015-2 + ADR-0014).

USP é vetor pós-verificação do RP-005 (empresa-fantasma).

## 2. Restrições

- Edição persistida imediatamente.
- AC-015-2: edição de CNPJ, razão social ou nome fantasia rebaixa "verificada" para false.
- Auditoria imutável da edição (campos antes/depois, responsável, momento).

## 3. Cenários de fracasso (de resultado)

**F1. Pessoa-responsável edita dados identitários e o sistema esquece de rebaixar "verificada".**
Materialização do vetor pós-verificação de RP-005. Empresa originalmente legítima foi verificada na USP-017; agora Pessoa-responsável (a mesma ou outro adicionado) muda CNPJ/razão social para outra Empresa qualquer; sistema mantém "verificada" por bug. Empresa nova fantasma agora aparece como verificada na busca.

**F2. Re-verificação implícita: Pessoa-responsável edita, publica nova vaga, e moderador não vê alerta de "Empresa foi editada — re-verificar".**
AC-015-2 rebaixa para "não verificada", o que reativa USP-017 na próxima vaga. Mas se a UX do moderador (USP-016/017) não destacar **claramente** que esta vaga é de Empresa "voltou a ser não verificada", moderador pode tratar como vaga rotineira e perder a oportunidade de inspecionar a mudança.

✅ RESOLVIDO (dono do intent): sim — a UI do moderador destaca os campos alterados desde a verificação original. Impacto técnico: nenhum (content_transitions já registra o histórico).

**F3. Edição de campos não-identitários (telefone, descrição) é abusada para inserir informação enganosa.**
Empresa verificada com dados originais legítimos; pessoa-responsável edita descrição para conter texto promocional enganoso ou contatos paralelos suspeitos (fora do campo de contato oficial). Sem re-moderação, conteúdo problemático fica ativo.

✅ RESOLVIDO (dono do intent): apenas CNPJ/razão social/nome fantasia rebaixam para "não verificada" (ADR-0024); editar descrição/contato NÃO rebaixa — só re-modera o conteúdo. Impacto técnico: nenhum (comportamento atual do ADR-0024).

## 4. Cenários de sucesso

**Nível operacional:**
- Responsável edita dados em ≤ 2 min.
- Quando edita campos identitários, sistema avisa claramente: "Esta alteração exigirá nova verificação manual na próxima vaga".
- Auditoria registra a alteração.

**Nível agregado:**
- Sem métrica MP direta.

## 5. Conexões

**USPs upstream:**
- USP-012.

**USPs downstream:**
- USP-017 (re-verificação).

**ADRs aplicáveis:** ADR-0014, ADR-0015.

**Métricas tocadas:** —

**Riscos relacionados:** RP-005 (vetor pós-verificação).

**Dependências:** —

**Q-abertas:** —
