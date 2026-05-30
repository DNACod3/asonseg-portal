# Expectations — USP-040: Extração automática de CV via IA generativa

**Origem:** AC-040-1 a AC-040-5 do PRD v0.3, ajustados e estendidos.

## 1. Cenários de sucesso testáveis

- **E-001:** WHEN o candidato faz upload do CV (PDF, DOC ou DOCX até 5MB) **com consentimento ativo da finalidade 7** (extração via IA — termo cobre nome do provedor e política ZDR), the system SHALL invocar o serviço de IA generativa para extrair campos pré-definidos (escolaridade, área de formação, experiência, habilidades, cursos) — sem extrair campos sensíveis adicionais.

  *Ajuste do AC-040-1:* explicita gate de consentimento + limitação aos campos pré-definidos (toca F6 do intent).

- **E-002:** WHEN a extração retorna, the system SHALL pré-preencher os campos do formulário com **flag visual destacada** ("preenchido pela IA — revise") em cada campo, exigindo confirmação **explícita por campo** ou por bloco com revisão visual evidente.

  *Ajuste do AC-040-2 + AC-040-4:* explicita confirmação granular (toca F1 do intent + RP-007).

- **E-003:** IF a extração falha ou retorna vazia, THEN the system SHALL exibir mensagem informativa não-disruptiva ("não conseguimos preencher automaticamente — preencha manualmente abaixo") e deixar os campos vazios.

  *Ajuste do AC-040-3:* explicita mensagem mínima (toca F4 do intent — sem mensagem nenhuma confunde candidato).

- **E-004:** The system SHALL exigir confirmação explícita do candidato antes de salvar os dados extraídos (AC-040-4). Sem confirmação granular, perfil não pode ir para moderação (USP-009).

- **E-005:** The system SHALL armazenar o arquivo original do CV vinculado ao candidato, com retenção conforme ADR-0008 + finalidade 7.

- **E-006:** WHEN a extração leva > tempo aceitável (latência), the system SHALL operar em modo assíncrono — candidato pode preencher manualmente enquanto a extração roda; quando terminar, sistema oferece "queremos sugerir preenchimento?".
  ✅ RESOLVIDO (ADR-0027 / project-guideline §14.1): extração assíncrona com limiar de latência ≤ 30s p95.

  *Ajuste:* AC do PRD não cobre assincronia; vem do F7 do intent.

## 2. Proibições (must-not)

- **P-001 (toca F1 — confirmação vazia):** O sistema NÃO PODE aceitar confirmação global em botão único sobre **todos** os campos extraídos. Confirmação é por campo ou por bloco com scroll-to-confirm — defesa contra "confirmar sem revisar".

- **P-002 (toca F2 — provedor sem ZDR):** O sistema NÃO PODE enviar CV (ou trecho dele) a provedor de IA generativa sem **Zero Data Retention contratualmente garantido e configurado no projeto**. Sem ZDR ativo, a extração não acontece — candidato preenche manualmente.

- **P-003 (toca F3 — termo genérico):** O sistema NÃO PODE usar termo de consentimento da finalidade 7 que não mencione **nome do provedor LLM específico** e a política de ZDR. Mudança de provedor implica novo aceite dos candidatos.

- **P-004 (toca F4 — sem feedback em falha):** O sistema NÃO PODE deixar candidato confuso vendo formulário vazio após upload — mensagem amigável é obrigatória.

- **P-005 (toca F5 — custo descontrolado):** O sistema NÃO PODE deixar o uso da API LLM sem instrumentação (nº de extrações/mês, custo/extração) e sem limite operacional por candidato/dia.
  ✅ RESOLVIDO (ADR-0027 / ADR-0029): limite por candidato/dia instrumentado e ajustável (parâmetro tunável), com telemetria de uso/custo.

- **P-006 (toca F6 — extração de campos sensíveis):** O sistema NÃO PODE persistir, no formulário ou no perfil, campos extraídos que não estavam no escopo pré-definido (CPF, RG, foto, estado civil, religião) — prompt da LLM restringe extração + validação no retorno descarta extras.

- **P-007:** O sistema NÃO PODE permitir extração em CV de Pessoa que não tem consentimento ativo da finalidade 7. Sem consentimento, upload do CV é armazenado mas extração não acontece.

## 3. Limites

- **L-001 (Latência):** Extração ≤ 30s p95 (RNF 6.1). Cauda longa tratada com assincronia.
- **L-002 (Tamanho):** CV ≤ 5MB, formatos PDF/DOC/DOCX.
- **L-003 (Custo):** Limite por candidato/dia + alerta operacional quando custo/mês ultrapassa N.
- **L-004 (Auditoria):** Cada extração registrada (candidato, provedor, custo, latência, sucesso/falha) para observabilidade e controle de custo.
- **L-005 (Retenção do CV):** Conforme ADR-0008 + finalidade 7.

## 4. Critérios de pronto, do ponto de vista do dono do intent

- **D-001 (gate compliance LGPD — BLOQUEANTE):** Antes desta USP ir para produção:
  - (a) **D-001 do PRD (DPO)** designado;
  - (b) **D-008 / QP-002 (provedor LLM)** decidido com **ZDR contratualmente garantido** e configurado;
  - (c) **D-002 do PRD (termo da finalidade 7)** aprovado pelo jurídico mencionando provedor + ZDR.
  
  Sem qualquer uma das três peças, esta USP **não vai para produção** — RP-007 + RP-008 inaceitáveis. Alternativa: USP-009 funciona com preenchimento 100% manual até ZDR estar pronto.

- **D-002:** Um candidato real, em ensaio, faz upload de CV; sistema extrai e pré-preenche em ≤ 30s; candidato vê flag visual em cada campo extraído; confirma campo a campo; submete para moderação.

- **D-003:** Em teste de extração mal-feita: candidato com letramento digital limitado tenta enviar sem revisar; sistema bloqueia com mensagem clara exigindo confirmação granular.

- **D-004:** Em teste de falha da IA (provedor offline): upload do CV é armazenado, formulário fica vazio com mensagem amigável, candidato preenche manualmente sem fricção.

- **D-005:** Em teste de campos sensíveis: CV preparado com "Estado civil: solteiro" + "Foto" + "CPF: ..."; sistema **não persiste** esses campos no perfil estruturado.

- **D-006:** A coordenadora abre painel de custo da IA e vê nº de extrações + custo do mês + alerta se passou do limite.

- **D-007:** Em teste de latência alta: extração leva > limiar; candidato vê fluxo assíncrono (preenche manualmente; sugestão oferecida quando termina).
