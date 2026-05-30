# Expectations — USP-038: Registrar resultado do encaminhamento manualmente

**Origem:** AC-038-1 do PRD v0.3, ajustado e estendido.

## 1. Cenários de sucesso testáveis

- **E-001:** WHEN o usuário autorizado (AS, coordenador, diretoria — ou voluntário com permissão item 8 do catálogo USP-008) registra resultado em um encaminhamento, the system SHALL persistir resultado (enum: contratado, não selecionado, em análise, sem resposta) + observação textual obrigatória contendo **fonte da informação** (Pessoa, Empresa, terceiro) + data — como **novo registro de versão**, não sobrescrita.

  *Ajuste do AC-038-1:* explicita fonte da informação + versionamento (toca F2 e F4 do intent).

- **E-002:** The system SHALL enviar lembrete por e-mail (USP-044) ao encaminhador quando o encaminhamento estiver há ≥ N dias sem resultado registrado.
  ✅ RESOLVIDO (dono do intent): N = 30 dias (tunável).

  *Ajuste:* AC do PRD não cobre lembrete; vem do F1 do intent (viés de registro).

- **E-003:** The system SHALL exibir, no painel da coordenadora, indicador "% de encaminhamentos sem resultado registrado" — sinal operacional para combater viés de registro.

## 2. Proibições (must-not)

- **P-001 (toca F1 — viés de registro):** O sistema NÃO PODE deixar de cobrar registro de resultado dos encaminhamentos. Lembrete por e-mail + indicador agregado no painel da coordenadora são defesas obrigatórias contra MP9 inflada.

- **P-002 (toca F2 — fonte oculta):** O sistema NÃO PODE aceitar registro de resultado sem fonte da informação declarada. Observação textual precisa especificar "Pessoa relatou", "Empresa confirmou", "Terceiro informou" ou equivalente.

- **P-003 (toca F4 — sobrescrita):** O sistema NÃO PODE sobrescrever um resultado anteriormente registrado. Cada atualização cria nova versão, preservando todo o histórico de transições para auditoria.

- **P-004:** O sistema NÃO PODE permitir registro de resultado por usuário sem permissão item 8 do catálogo (ou superior — AS, coordenador, diretoria).

- **P-005:** O sistema NÃO PODE apagar resultados de encaminhamentos registrados — preservados para MP9 e prestação de contas (ADR-0008).

## 3. Limites

- **L-001 (Performance):** Submit ≤ 2s p95.
- **L-002 (Versionamento):** Cada atualização cria nova linha. Histórico completo retido.
- **L-003 (Lembrete):** Entregue ao SMTP em ≤ 24h após o limiar.

## 4. Critérios de pronto, do ponto de vista do dono do intent

- **D-001:** A AS, em ensaio, registra resultado "contratado" para um encaminhamento, com observação informando a fonte. O encaminhamento aparece atualizado em USP-039 (visão consolidada).

- **D-002:** Em ensaio de atualização: AS muda resultado de "em análise" para "contratado"; sistema cria nova versão (não sobrescreve); auditoria mostra as duas linhas com data e responsável.

- **D-003:** Em teste de lembrete: encaminhamento sem resultado há ≥ N dias dispara e-mail ao encaminhador.

- **D-004:** A coordenadora abre painel operacional e vê indicador "% de encaminhamentos sem resultado registrado" para o trimestre — uso para combater viés de registro.

- **D-005:** Em teste de bypass: tentativa de chamada direta à API registrando resultado sem fonte é rejeitada com erro determinístico exigindo o campo.
