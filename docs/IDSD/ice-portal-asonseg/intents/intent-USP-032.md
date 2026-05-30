# Intent — USP-032: Editar serviço (pausar, arquivar)

**Origem:** PRD v0.3 §5.2, USP-032.
**Dono do intent:** Coordenador da área Portal Empregabilidade.

## 1. Descrição

Prestador (PF ou via Empresa-responsável) edita seu serviço, pausa temporariamente ou arquiva quando deixa de oferecer. Outcome: serviço reflete fielmente o momento atual do prestador; edição de conteúdo volta à moderação (preserva qualidade — ADR-0015); pausar é leve, sem nova moderação. Diferente de vaga, serviço não tem expiração automática — fica ativo até o prestador agir (decisão consciente do PRD).

## 2. Restrições

- Edição de conteúdo → status "rascunho" → nova moderação (AC-032-1).
- Pausar → "pausado" (oculta da busca, não exige re-moderação para reativar) (AC-032-2).
- Arquivar → "arquivado" terminal (AC-032-3).
- Operação restrita ao prestador (PF) ou Pessoa-responsável ativa da Empresa.
- Sem expiração automática (out-of-scope explícito — Notas USP-032).

## 3. Cenários de fracasso (de resultado)

**F1. Serviço ativo por anos sem revisão — prestador esqueceu mas está nominalmente "ativo".**
Sem expiração automática, prestador que abandonou a atividade deixa serviço no ar. Visitante manifesta interesse, ninguém responde. Erosão de confiança no portal.

✅ RESOLVIDO (dono do intent): mecanismo manual no MVP (coordenador roda revisão quando necessário); job automático fica para V2.

**F2. Pausa ad eternum: prestador pausa mas nunca despausa nem arquiva — lista de "meus serviços" enche-se de pausados.**
Cf. F1. Estado terminal real é "arquivado" — pausar é temporário, mas sistema não impõe limite. Pausados antigos viram lixo no painel do prestador.

✅ RESOLVIDO (dono do intent): sim — lembrete por e-mail ao prestador "seu serviço está pausado há 30 dias — deseja arquivar?" (N tunável). Impacto técnico: mínimo (e-mail via outbox + job leve).

**F3. Edição rebaixa serviço com manifestações de interesse ativas — clientes ficam órfãos.**
Análogo a F4 do USP-023. Cliente manifestou interesse em serviço A (preço X, descrição Y); prestador edita; serviço vai para rascunho. Quando reaparece, valor/descrição mudaram. Cliente já tem o contato (USP-033 revelou) — segue por canal externo, mas o consentimento foi sobre o serviço antigo.

✅ RESOLVIDO (dono do intent): sem notificação aos clientes na edição (coerente com USP-023); manifestações seguem sem atrito. Impacto técnico: nenhum.

## 4. Cenários de sucesso

**Nível operacional:**
- Prestador corrige campo errado → edita → rascunho → submete → moderação → ativa.
- Prestador em viagem pausa → reativa ao voltar sem re-moderação.
- Prestador encerra atividade → arquiva → some do portal.

**Nível agregado:**
- Manutenção da fidelidade da lista — coerência com ADR-0015.

## 5. Conexões

**USPs upstream:** USP-029 (serviço existe).

**USPs downstream:** USP-016 (re-moderação após edição).

**ADRs aplicáveis:** ADR-0015 (edição volta a moderação).

**Métricas tocadas:** —

**Riscos relacionados:** Risco proposto: serviço fantasma (ativo mas abandonado) sem mecanismo de higiene automática.

**Dependências:** —

**Q-abertas:** —
