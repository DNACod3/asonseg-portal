# Expectations — USP-035: Prestador ver manifestações de interesse

**Origem:** AC-035-1 do PRD v0.3, ajustado e estendido.

## 1. Cenários de sucesso testáveis

- **E-001:** WHEN o prestador (PF ou Pessoa-responsável ativa da Empresa que publicou o serviço) abre seu painel, the system SHALL listar manifestações ativas (não canceladas) com nome do cliente, contato (e-mail e telefone), data e serviço referenciado.

- **E-002:** The system SHALL permitir ao prestador marcar manifestação como "lida" (sem outras flags de status — gerenciamento amplo fica para V2).

  *Ajuste:* AC do PRD não cobre marcação; vem do F2 do intent (mitigação leve enquanto status amplo não existe).

- **E-003:** WHEN o prestador tem manifestações sem responder há ≥ N dias, the system SHALL enviar lembrete por e-mail "você tem N manifestações sem resposta".
  ✅ RESOLVIDO (dono do intent): N = 7 dias sem resposta dispara o lembrete por e-mail; envio único, sem repetição (tunável).

  *Ajuste:* AC do PRD não cobre lembrete; vem do F1 do intent.

## 2. Proibições (must-not)

- **P-001 (toca F1 — manifestações sem resposta):** O sistema NÃO PODE deixar prestador acumular manifestações indefinidamente sem qualquer lembrete. Confiança no portal depende de resposta.

- **P-002 (toca F2 — sem controle do prestador):** O sistema NÃO PODE expor lista grande de manifestações sem **ao menos** marcação "lida/não lida". Gerenciamento de status amplo (vista/em contato/declinada/convertida) fica fora do MVP por decisão consciente.

- **P-003:** O sistema NÃO PODE permitir acesso à lista por Pessoa diferente do prestador PF ou sem vínculo "responsável" ativo da Empresa dona do serviço.

- **P-004:** O sistema NÃO PODE exibir manifestações canceladas na lista ativa — preservadas em auditoria.

- **P-005:** O sistema NÃO PODE expor dados de manifestações de **outros prestadores** por consulta mal isolada.

## 3. Limites

- **L-001 (Performance):** Lista ≤ 2s p95 para até 100 manifestações.
- **L-002 (Auditoria):** Acesso à lista registrado em log (quem viu, quando).
- **L-003 (Lembrete):** E-mail "manifestações sem resposta" entregue ao SMTP em ≤ 24h após limiar.

## 4. Critérios de pronto, do ponto de vista do dono do intent

- **D-001:** Prestador PF, em ensaio, abre o painel com 5 manifestações de clientes diferentes; vê nome+contato+data+serviço; marca 2 como "lidas"; lista atualiza.

- **D-002:** Em teste de manifestações sem resposta: prestador com ≥ N manifestações há ≥ M dias recebe e-mail lembrete.

- **D-003:** Em teste de permissão: Pessoa sem vínculo de responsável tenta abrir manifestações de Empresa alheia; é bloqueada.

- **D-004:** A AS abre auditoria de manifestações e confere histórico completo (data, cliente, contato revelado, serviço).
