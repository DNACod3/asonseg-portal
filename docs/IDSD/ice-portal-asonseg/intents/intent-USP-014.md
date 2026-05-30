# Intent — USP-014: Remover responsável de uma Empresa

**Origem:** PRD v0.3 §5.2, USP-014.
**Dono do intent:** Sponsor + diretoria.

## 1. Descrição

Uma Pessoa-responsável remove o próprio vínculo ou o de outro responsável da Empresa. Outcome: vínculo encerrado (preservado no histórico para auditoria — AC-014-3); Pessoa removida deixa de operar em nome da Empresa; sistema bloqueia se a remoção deixaria a Empresa sem nenhum responsável ativo (AC-014-2 + ADR-0014).

## 2. Restrições

- Empresa sempre tem ao menos um responsável ativo (ADR-0014).
- Histórico preservado.
- E-mail à Pessoa removida (AC-014-1).
- Auditoria imutável.

## 3. Cenários de fracasso (de resultado)

**F1. Empresa fica órfã por bypass da regra de "≥ 1 responsável ativo".**
AC-014-2 protege a regra, mas há vetor lateral via USP-007 (inativar Pessoa) ou via API direta. Quebra ADR-0014.

✅ RESOLVIDO (ADR-0030 / TD §4.4): sim — `inativarPessoa` tem pré-condição "não é único responsável ativo de Empresa"; a invariante ≥1 responsável ativo (ADR-0014) é checada em **todas** as rotas que removem vínculo/papel, incluindo USP-007 (inativação de Pessoa).

**F2. Pessoa removida continua tendo dados da Empresa em sessão ativa.**
Cache local ou sessão da Pessoa removida ainda exibe a Empresa nos seus painéis. Em casos sensíveis (responsável removido por motivo grave), exposição de informação corporativa por janela de horas.

**F3. Histórico de vínculo encerrado some por filtro implícito em consultas futuras.**
Auditoria precisa enxergar vínculos passados (AC-014-3). Se as consultas filtram só vínculos ativos por default, prestação de contas perde informação.

## 4. Cenários de sucesso

**Nível operacional:**
- Responsável remove vínculo em ≤ 30s.
- Sistema bloqueia com mensagem clara quando deixaria Empresa sem responsável.
- Pessoa removida recebe e-mail.
- Histórico mostra vínculo encerrado com data fim.

**Nível agregado:**
- Sem métrica MP direta.

## 5. Conexões

**USPs upstream:**
- USP-012, USP-013.

**USPs downstream:**
- USP-007 (sucessão de responsável quando Pessoa inativada).

**ADRs aplicáveis:** ADR-0014.

**Métricas tocadas:** —

**Riscos relacionados:** Risco proposto: Empresa órfã.

**Dependências:** —

**Q-abertas:** —
