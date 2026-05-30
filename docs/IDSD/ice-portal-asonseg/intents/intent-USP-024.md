# Intent — USP-024: Expiração automática de vaga

**Origem:** PRD v0.3 §5.2, USP-024.
**Dono do intent:** Coordenador da área Portal Empregabilidade (responsável pela higiene da lista de vagas).

## 1. Descrição

Sistema observa, diariamente, a data de validade configurada na vaga (USP-020) e, na data, muda automaticamente o status para "expirado". Vagas expiradas somem da busca pública (USP-021). Três dias antes da expiração, e-mail é enviado à Empresa-responsável avisando. Outcome: lista pública de vagas mantém-se sempre verdadeira; vagas que a Empresa esqueceu de arquivar saem sozinhas; Empresa tem chance de prorrogar antes de perder.

## 2. Restrições

- Mudança de status automática ocorre quando data de validade é atingida no timezone América/São_Paulo (AC-024-1, RNF 6.8).
- Vagas expiradas ocultadas da busca pública (AC-024-2).
- E-mail à Empresa-responsável 3 dias antes da expiração (AC-024-3) — chama USP-044.
- Job/processamento periódico precisa rodar consistentemente; falhas precisam ser visíveis (RNF 6.6).

## 3. Cenários de fracasso (de resultado)

**F1. Job de expiração falha silenciosamente e vagas vencidas permanecem visíveis.**
Job batch ou cron falha (banco indisponível, exception não tratada, cron foi desabilitado por mistake em deploy). Vagas que deveriam ter expirado seguem visíveis e ativas, candidatos se candidatam a vagas mortas.

✅ RESOLVIDO (ADR-0026): defesa em profundidade — filtro on-read (status ativo + validade ≥ now é a fonte da verdade para visibilidade) + Vercel Cron (convergência de estado + heartbeat) + alerta quando o job não registra heartbeat (RNF 6.6).

**F2. Timezone errado faz vaga expirar 3 horas antes ou depois do esperado.**
Vaga configurada para expirar em 31/12 — operação em UTC sem conversão correta para América/São_Paulo expira em horário errado. Confunde Empresa que vê vaga sumir antes do que esperava.

✅ RESOLVIDO (ADR-0026): `timestamptz` UTC no DB; conversão com `date-fns-tz` (America/Sao_Paulo) na fronteira, aplicada tanto na query on-read quanto no job.

**F3. E-mail de 3 dias antes vai para spam ou caixa errada; Empresa perde a janela de prorrogação sem perceber.**
USP-044 dispara e-mail, mas chega na pasta de spam, ou Pessoa-responsável trocou de e-mail e não atualizou cadastro. Vaga expira sem aviso efetivo; Empresa perde candidatos no funil.

✅ RESOLVIDO (dono do intent): sim — badge "expira em N dias" no card da vaga no painel da Empresa, além do e-mail (USP-044). Impacto técnico: nenhum (UI).

**F4. Vaga expirada continua acessível por link direto (URL salva) e candidato tenta agir.**
USP-022 não trata o caso "vaga expirada" claramente — candidato chega por link, vê detalhe sem mensagem, tenta candidatar-se e recebe erro técnico, ou pior, candidatura é registrada.

✅ RESOLVIDO (dono do intent): detalhe de vaga expirada exibe "Vaga encerrada — veja outras vagas" com CTA para a lista (outras = vagas ativas, sem matching fuzzy — coerente com USP-020). Impacto técnico: nenhum (UI).

## 4. Cenários de sucesso

**Nível operacional:**
- Vaga atingiu validade → status "expirado" → some da busca.
- Empresa-responsável recebe e-mail 3 dias antes → tem tempo de prorrogar (USP-023, AC-023-4) se ainda está recrutando.
- Lista pública sempre reflete vagas com validade vigente; candidato não perde tempo com vaga morta.

**Nível agregado:**
- Higiene contínua da lista sem custo manual do coordenador — operação sustentável (ADR-0010).

## 5. Conexões

**USPs upstream:** USP-020 (vaga tem data de validade).

**USPs downstream:** USP-021/USP-022 (vagas expiradas saem da view), USP-044 (e-mail 3 dias antes).

**ADRs aplicáveis:** ADR-0010 (operação automática como diretriz de custo mínimo — evita trabalho manual recorrente), ADR-0015 (mantém o portal moderado sempre coerente).

**Métricas tocadas:** —

**Riscos relacionados:** Risco proposto: job de expiração falha silenciosamente (mitigado por observabilidade — RNF 6.6). Risco proposto: timezone inconsistente.

**Dependências:** —

**Q-abertas:** —
