# Intent — USP-007: Inativar Pessoa (desligamento de voluntário ou pedido do titular)

**Origem:** PRD v0.3 §5.2, USP-007.
**Dono do intent:** Coordenador da área (voluntário desligado) + diretoria (qualquer Pessoa) + DPO (pedido do titular sob LGPD).

## 1. Descrição

Um usuário autorizado marca uma Pessoa como inativa. Outcome: Pessoa perde o acesso (não consegue novos logins), seu histórico operacional é preservado integralmente para auditoria e prestação de contas (ADR-0008 estendido), e — se ela era único responsável de uma Empresa — o sistema obriga designação de outro responsável antes de concluir.

Esta USP cobre três cenários muito diferentes em uma única operação:
1. Desligamento de voluntário (coordenador inativa).
2. Pedido do titular sob LGPD (DPO/diretoria inativa, sob direito de revogação — mesmo princípio do ADR-0013, finalidade revogada → papel desativado).
3. Pessoa pública pediu desligamento (diretoria).

## 2. Restrições

- Inativação não exclui — histórico preservado (ADR-0008).
- Login bloqueado a partir da inativação (efeito imediato no próximo login; sessões ativas tratadas por revalidação de status por request ≤30s — ADR-0030).
- Empresa não pode ficar sem responsável ativo (AC-007-3 + ADR-0014).
- Auditoria imutável (quem inativou, motivo, quando).
- Consentimentos LGPD permanecem registrados (não são apagados — ADR-0013 + ADR-0008).

## 3. Cenários de fracasso (de resultado)

**F1. Sessão ativa da Pessoa inativada continua válida até expirar.**
Mesma menção da USP-004/F4: verificação de status é só no login. Pessoa inativada por motivo grave permanece operando por horas.

✅ RESOLVIDO (ADR-0030): revalidação de status (e permissões/vínculos) a cada request autenticado, com cache opcional de janela curta (≤30s) — a inativação fica efetiva na próxima requisição sem precisar invalidar a sessão ativamente. Custo de uma consulta leve por request, aceitável no volume (ADR-0010). `session_epoch` invalida sessões no reset de senha.

**F2. Empresa fica órfã por bypass da regra de sucessão.**
AC-007-3 exige designação de outro responsável antes de inativar, mas há caminho alternativo (ex.: inativar Pessoa sem passar pela tela de gestão da Empresa). Empresa termina sem responsável ativo, contradiz ADR-0014.

**F3. Histórico operacional da Pessoa some da visão consolidada após inativação por bug de filtro.**
USP-039 filtra Pessoas inativas implicitamente; histórico desaparece. AS perde acesso ao que foi feito. ADR-0008 quebra.

**F4. Pedido LGPD do titular vira "esquecimento" total mas dados permanecem por finalidade institucional sem comunicação clara.**
Titular pede desligamento (achando que é direito de eliminação). Sistema inativa mas mantém dados (correto conforme ADR-0008 + base institucional). Mas o titular não é informado claramente da diferença. ASONSEG fica vulnerável a reclamação na ANPD.

✅ DECIDIDO (dono do intent): a UX comunica claramente "seu histórico fica preservado por finalidade institucional; seu acesso está desativado; consentimentos suspensos". ❓ Texto jurídico final a validar com jurídico/DPO (D-003).

**F5. Inativação por engano sem caminho de reversão claro.**
Coordenador inativa Pessoa errada. Sem fluxo de "reativar Pessoa" definido, fica difícil corrigir.

✅ RESOLVIDO: reativação formalizada como USP-045 (fluxo inverso da USP-007 — ADR-0030); a refletir no PRD v0.4.

## 4. Cenários de sucesso

**Nível operacional:**
- Usuário autorizado inativa Pessoa em ≤ 30 segundos.
- Sistema bloqueia operação se Pessoa é único responsável de Empresa, com mensagem clara.
- Pessoa inativada não consegue novo login.
- Histórico preservado, visível para AS/diretoria/coordenador (conforme visibilidade).

**Nível agregado:**
- Sem métrica MP direta.

## 5. Conexões

**USPs upstream:** —

**USPs downstream:**
- USP-004 (bloqueio de login)
- USP-008 (revogação de permissões delegadas — desligamento de voluntário)
- USP-014 (sucessão de responsável)

**ADRs aplicáveis:**
- ADR-0008 (retenção do histórico)
- ADR-0011 (Pessoa fundamental — operação opera sobre a entidade)

**Métricas tocadas:** —

**Riscos relacionados:** Risco proposto: Empresa órfã. Risco proposto: sessão ativa pós-inativação.

**Dependências:** D-001 (DPO precisa estar designado para autorizar inativação a pedido LGPD do titular).

**Q-abertas:** —
