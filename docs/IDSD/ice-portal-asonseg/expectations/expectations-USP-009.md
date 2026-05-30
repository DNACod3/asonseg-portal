# Expectations — USP-009: Cadastro de candidato (papel)

**Origem:** AC-009-1 a AC-009-4 do PRD v0.3, ajustados e estendidos.

## 1. Cenários de sucesso testáveis

- **E-001:** WHEN a Pessoa submete o cadastro com escolaridade, área de interesse principal e telefone preenchidos, the system SHALL ativar o papel candidato com status "rascunho" para o conteúdo do perfil/CV, **com o consentimento da finalidade 2 (candidatura a vagas) persistido** em transação única.

  *Ajuste do AC-009-1:* explicita atomicidade ativação + consentimento da finalidade 2 (ADR-0013).

- **E-002:** WHERE a Pessoa anexa CV (PDF, DOC ou DOCX até 5MB) **com aceite da finalidade 7 (extração via IA)**, the system SHALL invocar extração automática conforme USP-040 e pré-preencher campos estruturados marcados visualmente como "extraídos pela IA — confirme antes de enviar".

  *Ajuste do AC-009-2:* explicita aceite da finalidade 7 + marcação visual dos campos extraídos.

- **E-003:** WHEN o candidato envia o perfil para moderação, the system SHALL alterar status para "em moderação" e enfileirar para o coordenador (USP-016).

- **E-004:** WHEN o perfil é aprovado pelo coordenador, the system SHALL ativar o candidato (visível na busca de empresas USP-028 e apto a candidatar USP-025) e enviar e-mail ao candidato (USP-044).

- **E-005:** WHEN o perfil é devolvido pelo coordenador "aguardando ajustes", the system SHALL retornar o status para rascunho com os comentários do moderador acessíveis ao candidato.

## 2. Proibições (must-not)

- **P-001 (toca F1 — extração não revisada):** O sistema NÃO PODE permitir que o candidato envie para moderação um perfil com campos preenchidos pela IA sem que ele tenha **explicitamente confirmado cada campo extraído**. Um único clique global em "confirmar tudo" não basta para campos extraídos — a confirmação precisa ser por campo ou em bloco com revisão visual evidente.
  ✅ RESOLVIDO (dono do intent): bloco com scroll-to-confirm + destaque nos campos preenchidos pela IA (consistente com USP-040). Impacto técnico: nenhum (UI).

- **P-002 (toca F2 — vazamento via LLM):** O sistema NÃO PODE enviar CV (ou trecho dele) a provedor de IA generativa sem Zero Data Retention contratualmente garantido e configurado no projeto. Sem ZDR ativo, a extração não acontece — o candidato preenche manualmente.

- **P-003 (toca F3 — termo genérico):** O sistema NÃO PODE ativar o papel candidato com termo da finalidade 2 que não explicite que CV completo ficará visível para Empresas após candidatura (USP-025). Termo genérico que omita essa exposição é violação ADR-0013.

- **P-004 (toca F4 — arquivo malicioso):** O sistema NÃO PODE aceitar upload de CV sem validação de conteúdo (não só extensão e tamanho). Arquivos com macro/script executável SHALL ser rejeitados ou sanitizados antes do armazenamento e antes de chegar ao moderador.
  ✅ RESOLVIDO (ADR-0028): validação por magic bytes + antivírus/parser-sem-macro **antes** do storage; storage **privado** + URL assinada curta.

- **P-005 (toca F5 — perfil ativo com IA pendente):** O sistema NÃO PODE transicionar status para "ativo" antes da extração da IA ter retornado (ou falhado com fallback manual). Não há janela em que o perfil esteja visível com campos vazios à espera da IA.

- **P-006 (toca F6 — Pessoa sem credencial vira candidato):** O sistema NÃO PODE ativar o papel candidato em Pessoa que foi cadastrada via USP-002 sem ter reivindicado credencial (USP-003). Candidato precisa logar para revisar perfil — Pessoa sem login não pode ser candidato ativo.

- **P-007:** O sistema NÃO PODE armazenar CV em local com permissão de leitura aberta. CV é dado pessoal restrito — só acessível conforme USP-027 (Empresa após candidatura).

## 3. Limites

- **L-001 (Tamanho de CV):** Máximo 5MB.
- **L-002 (Formatos):** PDF, DOC, DOCX. Outros formatos rejeitados.
- **L-003 (Tempo de extração):** Tempo médio de extração ≤ tempo definido em USP-040.
- **L-004 (Retenção do CV):** Conforme ADR-0008 (retenção por finalidade institucional).
- **L-005 (Visibilidade — ADR-0017):** Dados sensíveis do perfil (telefone, endereço completo, CV) só visíveis para Empresa após candidatura. Na busca pública (USP-028), apenas resumido.

## 4. Critérios de pronto, do ponto de vista do dono do intent

- **D-001 (gate técnico/jurídico — BLOQUEANTE):** Antes desta USP ir para produção, **D-008 / QP-002 (provedor de IA com ZDR)** está decidido, contratado e configurado. **D-002 (termo da finalidade 7)** está aprovado pelo jurídico. Sem essas duas confirmações por escrito, esta USP **não vai para produção** mesmo que o código esteja pronto — RP-008 é inaceitável sem ZDR.

- **D-002:** Um candidato real (fora do time Bravi), em ensaio, conclui cadastro completo com CV em ≤ 5 minutos. Validado em ≥ 3 ensaios, com leituras dos campos extraídos pela IA tendo sido visivelmente confirmadas pelo candidato.

- **D-003:** O coordenador aprova um perfil em ensaio, e o candidato recebe e-mail e aparece na busca de empresas (USP-028) em ≤ 5 minutos.

- **D-004:** Em teste de extração não revisada: candidato tenta enviar para moderação sem confirmar os campos extraídos e o sistema bloqueia com mensagem clara.

- **D-005:** A coordenadora abre um perfil em moderação e consegue distinguir visualmente os campos "extraídos pela IA" dos "preenchidos manualmente".

- **D-006:** Em teste com CV malicioso (arquivo .docx com macro de teste preparado pela Bravi), o sistema rejeita o upload ou sanitiza antes do armazenamento.
