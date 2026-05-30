# Intent — USP-034: Cancelar manifestação de interesse

**Origem:** PRD v0.3 §5.2, USP-034.
**Dono do intent:** Coordenador da área Portal Empregabilidade.

## 1. Descrição

Cliente cancela uma manifestação de interesse que fez (não quer mais contratar, mudou de ideia, encontrou alternativa). Outcome: manifestação muda para "cancelada"; lista pessoal de manifestações ativas do cliente reflete realidade. Prioridade Should — função de autonomia, não bloqueante.

## 2. Restrições

- Cancelar marca manifestação como "cancelada" (AC-034-1).
- Operação restrita ao próprio cliente.
- Prioridade Should — operação suplementar.

## 3. Cenários de fracasso (de resultado)

**F1. Contato do prestador continua visível ao cliente mesmo após cancelamento — incoerência LGPD.**
Cf. F3 do USP-026 análogo. ADR-0017: ação afirmativa revelou; cancelamento reverte ação afirmativa, mas visibilidade já foi exercida (cliente já viu contato). Pode ser que o cliente queira "esquecer" tudo.

✅ RESOLVIDO (dono do intent / cf. USP-026): o contato some das manifestações ativas em ambos os painéis; o histórico que cada lado já viu permanece — apenas novos acessos são bloqueados. Impacto técnico: nenhum (view model on-read).

**F2. Prestador continua tentando contato — cancelamento não notifica.**
Cliente cancelou, mas prestador já tinha o contato e continua tentando. Análogo a F1 do USP-026 com papéis invertidos.

✅ RESOLVIDO (dono do intent / cf. USP-026): não — cancelamento silencioso; prestador percebe ao recarregar.

## 4. Cenários de sucesso

**Nível operacional:**
- Cliente abre suas manifestações ativas → cancela uma → some da lista do prestador (USP-035).

**Nível agregado:**
- Sem MP direta.

## 5. Conexões

**USPs upstream:** USP-033 (manifestação existe).

**USPs downstream:** —

**ADRs aplicáveis:** ADR-0017 (visibilidade — questão aberta sobre revogação).

**Métricas tocadas:** —

**Riscos relacionados:** Risco proposto: visibilidade não revogada após cancelamento (LGPD).

**Dependências:** —

**Q-abertas:** —
