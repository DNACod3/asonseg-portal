# Intent — USP-026: Cancelar candidatura

**Origem:** PRD v0.3 §5.2, USP-026.
**Dono do intent:** Coordenador da área Portal Empregabilidade (representando o direito do candidato sobre as candidaturas).

## 1. Descrição

Candidato consegue desfazer uma candidatura que fez (mudou de ideia, encontrou outro trabalho, vaga não bate). Outcome: candidatura sai da lista da Empresa imediatamente; candidato fica liberado para candidatar-se novamente à mesma vaga no futuro se quiser. Permitir cancelamento é parte do direito de autonomia sobre os próprios dados/intenções — não é só conveniência.

## 2. Restrições

- Cancelar marca a candidatura como "cancelada" (AC-026-1).
- Após cancelada, candidato pode re-candidatar à mesma vaga (AC-026-2).
- Cancelamento oculta candidatura da lista da Empresa (USP-027).
- Operação restrita ao próprio candidato.

## 3. Cenários de fracasso (de resultado)

**F1. Empresa não é avisada do cancelamento e continua tentando contato — candidato fica em situação constrangedora.**
Empresa salvou contato do candidato logo após USP-025; cancelamento esconde da lista mas Empresa já tem o contato no histórico/CRM dela. Continua ligando ou enviando e-mail. Candidato cancelou e perdeu o controle.

✅ RESOLVIDO (dono do intent): não — cancelamento remove silenciosamente; Empresa percebe ao recarregar a lista. Impacto técnico: nenhum.

**F2. Cancelar e re-candidatar permite candidato "subir" na lista da Empresa por timestamp atualizado.**
AC-027-3 mostra "data e hora da candidatura". Re-candidatar gera novo timestamp → candidato aparece "mais recente" para a Empresa. Ataque trivial para destacar-se artificialmente.

✅ RESOLVIDO (TD §4.5 / matriz): preserva o timestamp da 1ª candidatura (`applications` com UNIQUE parcial + status); anti-manipulação de ranking.

**F3. Contato do candidato continua visível à Empresa mesmo após cancelamento — porque "visibilidade" foi disparada pela ação afirmativa (ADR-0017) e não é revogada pelo cancelamento.**
Princípio do ADR-0017 é "ação afirmativa revela". Cancelamento é ação inversa, mas não está claro se "des-revela". Empresa continua tendo contato no painel mesmo após candidato cancelar.

✅ RESOLVIDO (dono do intent): o candidato some da lista (novos acessos bloqueados), mas o histórico que a Empresa já viu (CV baixado, anotações) permanece — a Empresa não 'perde' o que já consultou. Impacto técnico: nenhum (view model on-read filtra apenas novos acessos).

## 4. Cenários de sucesso

**Nível operacional:**
- Candidato abre suas candidaturas ativas → cancela uma → some da lista da Empresa.
- Candidato muda de ideia depois → candidata-se de novo (AC-026-2 viabiliza).

**Nível agregado:**
- Sem MP direta — função de autonomia do candidato sobre sua participação.

## 5. Conexões

**USPs upstream:** USP-025 (candidatura existe).

**USPs downstream:** USP-025 (re-candidatura permitida).

**ADRs aplicáveis:** ADR-0017 (visibilidade — questão aberta sobre revogação após cancelamento).

**Métricas tocadas:** —

**Riscos relacionados:** Risco proposto: re-candidatura usada para "subir" na lista. Risco proposto: contato continua exposto mesmo após cancelamento (LGPD).

**Dependências:** —

**Q-abertas:** —
