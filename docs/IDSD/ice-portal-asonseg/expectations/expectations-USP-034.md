# Expectations — USP-034: Cancelar manifestação de interesse

**Origem:** AC-034-1 do PRD v0.3, ajustado e estendido. Prioridade Should.

## 1. Cenários de sucesso testáveis

- **E-001:** WHEN o cliente cancela uma manifestação ativa, the system SHALL marcá-la como "cancelada" (preservando histórico), ocultá-la da lista do prestador (USP-035) e registrar log.

- **E-002:** WHEN a manifestação é cancelada, the system SHALL enviar e-mail informativo ao prestador avisando o cancelamento.
  ✅ RESOLVIDO (dono do intent / cf. USP-026): sem notificação ao prestador (cancelamento silencioso).

  *Ajuste:* AC do PRD não cobre notificação; vem do F2 do intent (prestador continua tentando contato).

## 2. Proibições (must-not)

- **P-001 (toca F1 — contato do prestador visível ao cliente após cancelamento):** O sistema NÃO PODE manter contato do prestador exposto no painel do cliente após cancelamento, **sem decisão jurídica clara** sobre revogação de visibilidade. Coerência com USP-026/P-003 e USP-033/P-004.
  ✅ RESOLVIDO (dono do intent / cf. USP-026): histórico já visto permanece; apenas novos acessos bloqueados (view model on-read).

- **P-002 (toca F2 — prestador sem aviso):** O sistema NÃO PODE deixar prestador sem informação alguma do cancelamento — ou via e-mail (E-002), ou via badge visual no histórico (manifestação cancelada some da lista ativa mas fica em auditoria).

- **P-003:** O sistema NÃO PODE permitir cancelamento de manifestação de outro cliente.

- **P-004:** O sistema NÃO PODE apagar manifestações canceladas — preservadas para auditoria e MP7.

## 3. Limites

- **L-001 (Performance):** Cancelamento ≤ 1s p95.
- **L-002 (E-mail):** Notificação ao prestador em ≤ 60s.
- **L-003 (Auditoria):** Log retido conforme ADR-0008.

## 4. Critérios de pronto, do ponto de vista do dono do intent

- **D-001 (gate jurídico):** Antes desta USP ir para produção, a diretoria + jurídico decidem por escrito se cancelamento revoga visibilidade do contato do prestador no painel do cliente (e vice-versa). Decisão precisa ser **idêntica** à de USP-026 — coerência LGPD.

- **D-002:** Cliente cancela em ensaio em ≤ 30s. Manifestação some da lista USP-035 do prestador. Prestador recebe notificação acordada.

- **D-003:** Em ensaio: cliente cancela; checa que contato do prestador **não está mais visível** no painel dele (ou está, conforme decisão D-001 acima).

- **D-004:** A coordenadora abre auditoria da manifestação cancelada e vê histórico completo.
