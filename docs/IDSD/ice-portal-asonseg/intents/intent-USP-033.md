# Intent — USP-033: Manifestar interesse em serviço

**Origem:** PRD v0.3 §5.2, USP-033.
**Dono do intent:** Coordenador da área Portal Empregabilidade.

## 1. Descrição

Pessoa autenticada clica em "entrar em contato" em um serviço ativo. Outcome: papel "cliente de serviço" é ativado automaticamente se ainda não estiver (papel mais leve — ADR-0011); manifestação é persistida; contato do prestador é revelado ao cliente; e-mail é enviado ao prestador avisando do interesse (USP-044). Reciprocidade do ADR-0017: ação afirmativa do cliente revela contato do prestador, e também identifica o cliente para o prestador (USP-035).

## 2. Restrições

- Pessoa precisa estar autenticada (USP-001).
- Serviço precisa estar ativo (USP-029 + USP-016 aprovou).
- Papel "cliente de serviço" é ativado automaticamente na primeira manifestação se ainda não ativo (AC-033-2, ADR-0011 — papel mais leve).
- Consentimento "contratação de serviço" (finalidade 4 do ADR-0013) precisa estar ativo — exibido na ativação automática do papel se for primeira vez.
- Múltiplas manifestações simultâneas em serviços diferentes permitidas (AC-033-3).
- Manifestação persiste + contato do prestador revelado ao cliente + e-mail ao prestador (AC-033-1, AC-031-3).

## 3. Cenários de fracasso (de resultado)

**F1. Ativação automática do papel cliente cria consentimento sem o cliente perceber.**
AC-033-2 ativa o papel "sem formulário adicional". Mas ADR-0013 exige consentimento explícito da finalidade 4 antes da ativação. Tensão real: cliente clica "entrar em contato" e o termo precisa aparecer — se for "modal rápido" e o cliente clicar OK sem ler, consentimento existe formalmente mas não materialmente.

✅ RESOLVIDO (dono do intent / cf. USP-011): sim — modal de consentimento da finalidade 4 exibido explicitamente antes de revelar o contato (scroll-to-accept, igual à USP-006/USP-011). Impacto técnico: nenhum (UI). ❓ Redação do termo permanece com jurídico (D-002).

**F2. Cliente clica "manifestar interesse" em N serviços para coletar contatos sem real intenção — funil de spam.**
Sem limite, cliente abre 20 serviços e manifesta interesse em todos para acumular contatos. Prestadores recebem e-mail e perdem tempo respondendo a cliente sem interesse real.

✅ RESOLVIDO (dono do intent): alerta operacional ao coordenador quando >10 manifestações/semana de um mesmo cliente (tunável, ADR-0029); sem bloqueio individual cliente↔prestador no MVP (V2). Impacto técnico: nenhum (observabilidade — TD §8.3).

**F3. Prestador recebe contato do cliente que manifestou interesse mas, ao tentar responder, descobre dados desatualizados.**
Cliente cadastrou-se com e-mail antigo; usa raramente. Prestador responde, e-mail não chega. Manifestação fica sem fechamento e prestador frustra-se com o portal.

✅ ACEITO (dono do intent): gestão do e-mail do cliente fica fora do sistema.

**F4. Atomicidade falha: persistir manifestação + ativar papel + enviar e-mail + revelar contato.**
Cf. F5 do USP-025 — múltiplos efeitos colaterais em uma operação. Falha parcial deixa estado quebrado.

✅ RESOLVIDO (ADR-0020): ativação do papel cliente + consentimento + manifestação + auditoria numa transação Prisma (`withAudit` na mesma transação); e-mail ao prestador via `outbox` pós-commit com retry (sem órfão em rollback).

**F5. Cliente cancela manifestação (USP-034) mas prestador já tem o contato.**
ADR-0017 não fala sobre revogar visibilidade após cancelamento (cf. F3 do USP-026). Prestador continua contatando cliente que cancelou.

✅ RESOLVIDO (dono do intent / cf. USP-026): o contato some das manifestações ativas, mas o histórico que o prestador já viu permanece — apenas novos acessos são bloqueados. Impacto técnico: nenhum (view model on-read).

## 4. Cenários de sucesso

**Nível operacional:**
- Pessoa autenticada abre detalhe de serviço → clica "entrar em contato" → (se for primeira vez) confirma consentimento finalidade 4 → papel cliente ativado → contato do prestador revelado → e-mail ao prestador.
- Cliente entra em contato externamente (telefone/WhatsApp) e contrata o serviço.
- Prestador vê manifestação em painel (USP-035) com nome do cliente, contato, data e serviço referenciado.

**Nível agregado:**
- **MP7** — número de manifestações de interesse. Métrica do funil de serviços.

## 5. Conexões

**USPs upstream:** USP-001 ou USP-006 (autenticação), USP-011 (papel cliente ativado automaticamente), USP-030/USP-031 (descobriu serviço), USP-043 (consentimento finalidade 4).

**USPs downstream:** USP-034 (cancelar), USP-035 (prestador vê), USP-044 (e-mail ao prestador).

**ADRs aplicáveis:** ADR-0011 (cliente é papel leve, ativação automática), ADR-0013 (consentimento finalidade 4), ADR-0017 (visibilidade recíproca).

**Métricas tocadas:** MP7 (manifestações).

**Riscos relacionados:** RP-003 (consentimento finalidade 4 precisa estar coberto pelo termo). Risco proposto: manifestação em massa para coletar contatos.

**Dependências:** D-002 (termo da finalidade 4).

**Q-abertas:** —
