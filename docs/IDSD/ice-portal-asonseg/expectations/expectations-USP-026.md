# Expectations — USP-026: Cancelar candidatura

**Origem:** AC-026-1 e AC-026-2 do PRD v0.3, ajustados e estendidos.

## 1. Cenários de sucesso testáveis

- **E-001:** WHEN o candidato cancela uma candidatura ativa, the system SHALL marcá-la como "cancelada" (preservando histórico para auditoria) e ocultá-la da lista da Empresa (USP-027).

- **E-002:** WHEN a candidatura é cancelada, the system SHALL permitir nova candidatura à mesma vaga posteriormente.

- **E-003:** WHEN uma candidatura é cancelada, the system SHALL enviar e-mail informativo à Empresa-responsável avisando que o candidato cancelou — apenas o fato do cancelamento, sem dados pessoais novos.
  ✅ RESOLVIDO (dono do intent): remoção silenciosa, sem e-mail à Empresa.

  *Ajuste:* AC do PRD não cobre notificação; vem do F1 do intent (Empresa continua tentando contato).

- **E-004:** WHEN o candidato re-candidata-se à mesma vaga (após cancelamento prévio), the system SHALL preservar a data/hora da **primeira** candidatura para fins de ordenação na lista da Empresa, registrando separadamente a data da re-candidatura.
  ✅ RESOLVIDO (TD §4.5): re-candidatura preserva o timestamp da 1ª candidatura; status volta a "ativa" (UNIQUE parcial cobre).

  *Ajuste:* defesa contra F2 do intent (subir na lista via timestamp atualizado).

## 2. Proibições (must-not)

- **P-001 (toca F1 — Empresa sem aviso):** O sistema NÃO PODE deixar a Empresa sem informação alguma de que o candidato cancelou — ou via e-mail, ou via badge visual no histórico da candidatura cancelada (mesmo oculta da lista ativa).
  ✅ RESOLVIDO (dono do intent): sem e-mail; o status "cancelada" no histórico é visível à Empresa ao recarregar.

- **P-002 (toca F2 — re-candidatura como ranking):** O sistema NÃO PODE alterar a posição/ordenação do candidato na lista da Empresa por re-candidatura. Re-candidatura preserva o timestamp original para ranking; novo timestamp registrado apenas para log/auditoria.

- **P-003 (toca F3 — contato exposto após cancelamento):** O sistema NÃO PODE permitir que a Empresa continue vendo contato + CV do candidato cancelado **na lista de candidaturas ativas** da vaga. Histórico de auditoria pode preservar internamente; a tela operacional da Empresa esconde.
  ✅ RESOLVIDO (dono do intent): Empresa não perde o histórico do que já viu — apenas novos acessos ao candidato são bloqueados. Impacto técnico: nenhum (view model).

- **P-004:** O sistema NÃO PODE permitir cancelamento de candidatura de outro candidato (operação restrita ao próprio).

- **P-005:** O sistema NÃO PODE apagar candidaturas canceladas — status "cancelada" preserva para auditoria e MP6 (entradas históricas no funil).

## 3. Limites

- **L-001 (Performance):** Cancelamento ≤ 1s p95.
- **L-002 (E-mail):** Notificação à Empresa em ≤ 60s (se aplicável).
- **L-003 (Auditoria):** Log da operação retido conforme ADR-0008.

## 4. Critérios de pronto, do ponto de vista do dono do intent

- **D-001 (gate jurídico):** Antes desta USP ir para produção, a diretoria + jurídico decidem por escrito se cancelamento revoga visibilidade total dos dados do candidato pela Empresa (ou apenas oculta da lista ativa). Sem decisão, falha LGPD por inércia.

- **D-002:** Candidato cancela em ensaio em ≤ 30s. Candidatura some da lista USP-027 da Empresa em ≤ 30s. Empresa recebe notificação acordada.

- **D-003:** Em ensaio: candidato cancela e re-candidata-se 1 hora depois. Empresa vê o candidato na lista, mas posição não foi alterada artificialmente para o topo — preservou timestamp original.

- **D-004:** A coordenadora abre auditoria de uma candidatura cancelada e re-candidatada e vê o histórico completo (data candidatura → data cancelamento → data re-candidatura → cada motivo).

- **D-005:** Em teste de bypass: tentativa de chamada direta à API cancelando candidatura de outro candidato é rejeitada com erro determinístico.
