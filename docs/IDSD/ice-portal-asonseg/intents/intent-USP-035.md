# Intent — USP-035: Prestador ver manifestações de interesse

**Origem:** PRD v0.3 §5.2, USP-035.
**Dono do intent:** Coordenador da área Portal Empregabilidade.

## 1. Descrição

Prestador (PF ou Pessoa-responsável de Empresa que publicou serviço em nome da Empresa) abre seu painel e vê lista de pessoas que manifestaram interesse em seu(s) serviço(s) — com nome, contato, data e qual serviço. Outcome: prestador retoma contato fora do sistema (telefone/WhatsApp/e-mail) com clientes que demonstraram interesse, fechando o ciclo da contratação.

## 2. Restrições

- Lista mostra manifestações ativas (canceladas escondidas — consequência de USP-034) (AC-035-1).
- Cada item: nome do cliente, contato (e-mail e telefone), data, serviço referenciado.
- Acesso restrito ao prestador (PF) ou Pessoa-responsável ativa da Empresa que publicou o serviço.

## 3. Cenários de fracasso (de resultado)

**F1. Prestador acumula manifestações sem responder — cliente fica sem retorno.**
Sistema mostra a lista; não cobra ação. Cliente que manifestou interesse pode nunca receber contato do prestador. Erosão de confiança no portal.

✅ RESOLVIDO (dono do intent): sim — lembrete por e-mail ao prestador "você tem manifestações sem responder há 7 dias" (M tunável); métrica de tempo médio de resposta instrumentada (MP7 indireto). Impacto técnico: mínimo (job leve + outbox).

**F2. Lista cresce e prestador perde controle de quem já respondeu.**
Sem flag "respondida"/"convertida"/"declinada", para 30+ manifestações o prestador precisa anotar fora. Análogo a F1 do USP-027 (lista de candidatos sem gerenciamento de status). Mesma decisão de MVP: gerenciamento fica para V2.

✅ ACEITO (dono do intent): status detalhado de manifestação fica para V2. ✅ RESOLVIDO residual (dono do intent): prestador pode marcar manifestação como "lida" (estado leve, sem fluxo de resposta). Impacto técnico: mínimo (campo lido_em em service_interests).

**F3. Prestador deixa de ser ativo (saiu da Empresa, ou Pessoa-responsável removida — USP-014) e manifestações ficam órfãs.**
Análogo a F4 do USP-027. AC-014-2 garante ≥1 responsável ativo na Empresa; outro responsável pode acessar — mas se a Empresa não comunicou internamente, manifestações ficam sem ninguém olhando.

✅ ACEITO (dono do intent): gestão da fila de manifestações pelo prestador é responsabilidade dele — fora do sistema.

## 4. Cenários de sucesso

**Nível operacional:**
- Prestador abre painel → vê N manifestações novas com cliente, contato, data, serviço.
- Contata cliente fora do sistema → fecha contratação.

**Nível agregado:**
- MP7 (indireto) — manifestações desembocam aqui; visibilidade da feature sustenta o uso.

## 5. Conexões

**USPs upstream:** USP-033 (manifestação registrada).

**USPs downstream:** —

**ADRs aplicáveis:** ADR-0017 (visibilidade recíproca — prestador recebeu o contato porque cliente manifestou).

**Métricas tocadas:** MP7 (indireto).

**Riscos relacionados:** Risco proposto: manifestações sem resposta erodem confiança no portal.

**Dependências:** —

**Q-abertas:** —
