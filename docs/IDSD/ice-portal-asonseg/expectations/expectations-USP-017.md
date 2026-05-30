# Expectations — USP-017: Validar Empresa na primeira vaga publicada

**Origem:** AC-017-1 a AC-017-3 do PRD v0.3, ajustados e estendidos.

## 1. Cenários de sucesso testáveis

- **E-001:** WHEN o coordenador modera uma vaga cuja Empresa está marcada "não verificada" (primeira vaga ou Empresa rebaixada via USP-015), the system SHALL exibir os dados da Empresa em destaque, com banner explícito "Esta é a primeira vaga desta Empresa (ou Empresa editada após verificação original — verificar manualmente)", e exibir checklist de verificação.

  *Ajuste do AC-017-1:* explicita banner + checklist (sem ela, USP-017 fica subjetiva).

- **E-002:** WHEN o coordenador aprova a vaga, the system SHALL marcar a Empresa como "verificada", registrar log com responsável, data/hora e referência à vaga aprovada que disparou a verificação. Snapshot dos dados da Empresa no momento da verificação é registrado.

  *Ajuste do AC-017-2:* explicita snapshot dos dados (toca F4 — race com USP-015).

- **E-003:** IF o coordenador identifica inconsistência nos dados da Empresa, THEN the system SHALL permitir rejeitar a vaga com motivo textual obrigatório, **incrementar contador de rejeições da Empresa**, manter Empresa "não verificada" e registrar log.

  *Ajuste do AC-017-3:* explicita contador de rejeições (toca F3 — Empresa rejeitada tenta de novo).

- **E-004:** WHEN o coordenador modera uma vaga subsequente da mesma Empresa (Empresa já "verificada"), the system SHALL apresentar a vaga sem o painel de verificação de Empresa, com indicação apenas "Empresa verificada em DD/MM/AAAA por NomeCoordenador".

## 2. Proibições (must-not)

- **P-001 (toca F1 — Empresa-fantasma aprovada):** O sistema NÃO PODE permitir aprovação de vaga de Empresa "não verificada" sem que a checklist de verificação tenha sido apresentada ao moderador e os itens da checklist tenham sido marcados (ou explicitamente dispensados com motivo).
  ✅ RESOLVIDO (dono do intent): checklist interativa (itens a marcar). O conteúdo da checklist permanece entregável de Fase 0.

- **P-002 (toca F2 — verificação confundida com moderação):** O sistema NÃO PODE permitir aprovação da vaga e verificação da Empresa como **uma decisão única indistinguível**. As duas precisam ser visualmente separadas, com confirmação consciente de cada uma.

- **P-003 (toca F3 — histórico de rejeições oculto):** O sistema NÃO PODE deixar de exibir, ao moderador, o histórico de rejeições anteriores dessa Empresa (quantas, quando, por quem, motivos). Empresa "rejeitada N vezes" precisa ser tratamento especial visível.
  ✅ RESOLVIDO (dono do intent): não — histórico de rejeições visível, sem aprovação dupla; o moderador decide sozinho.

- **P-004 (toca F4 — dados antigos na verificação):** O sistema NÃO PODE usar snapshot dos dados da Empresa do momento do rascunho. Verificação é feita sobre os dados **vigentes no momento da moderação** — se Pessoa-responsável editou após o submit, isso fica visível ao moderador.

- **P-005:** O sistema NÃO PODE permitir que Empresa seja marcada "verificada" por nenhuma rota fora desta USP (não há marcação manual via admin, não há API direta, não há marcação automática).

## 3. Limites

- **L-001 (Performance):** Carregamento do painel de verificação ≤ 3s p95.
- **L-002 (Auditoria):** Snapshot dos dados da Empresa no momento da verificação retido por toda a retenção (ADR-0008). Inclui CNPJ, razão social, nome fantasia, endereço, contato no momento.

## 4. Critérios de pronto, do ponto de vista do dono do intent

- **D-001 (gate operacional/qualidade — BLOQUEANTE):** Antes desta USP ir para produção, a **checklist de verificação de Empresa** está validada pelo sponsor + coordenador + Bravi PO **por escrito**, integrada ao sistema, e testada com voluntários da área. Sem checklist objetiva, esta USP **não vai para produção** — RP-005 fica desprotegido.

- **D-002:** A coordenadora, em ensaio com Empresa-fantasma de teste (preparada pela Bravi com dados inconsistentes), rejeita a vaga seguindo a checklist. Sistema mantém Empresa "não verificada", incrementa contador, envia e-mail.

- **D-003:** Em ensaio com Empresa legítima: coordenadora aprova; Empresa fica "verificada"; vaga vira "ativa"; aparece na busca pública (USP-021); aparece na home (USP-041); MP2 incrementa.

- **D-004:** Em teste de bypass: tentativa de chamada direta à API marcando "verificada=true" sem passar por esta USP é rejeitada com erro determinístico.

- **D-005:** A coordenadora visualiza, para uma Empresa rejeitada 3 vezes, o histórico completo de rejeições com motivos e datas, antes de decidir sobre a próxima tentativa.

- **D-006:** A coordenadora confere, em uma vaga de Empresa editada após verificação original (USP-015), que o painel destaca os campos alterados desde a verificação anterior.
