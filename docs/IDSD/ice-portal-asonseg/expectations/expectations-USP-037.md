# Expectations — USP-037: Encaminhar Pessoa para vaga

**Origem:** AC-037-1 a AC-037-7 do PRD v0.3, ajustados e estendidos.

## 1. Cenários de sucesso testáveis

- **E-001:** WHEN o usuário autorizado (AS, coordenador, ou voluntário com permissão item 6 do catálogo USP-008) submete encaminhamento com Pessoa + vaga, the system SHALL — em transação única — persistir o encaminhamento, ativar papel candidato se ainda não ativo, gerar candidatura com badge "Candidato encaminhado pela ASONSEG", enviar e-mail informativo à Pessoa (USP-044/AC-044-6) com motivo (quando informado), gravar log com encaminhador + data/hora.

  *Ajuste dos AC-037-1, 037-2, 037-5:* explicita atomicidade dos 4 efeitos (toca F7 do intent).

- **E-002:** WHERE a Pessoa não tem CV anexo, the system SHALL exigir resumo profissional textual obrigatório com **conteúdo mínimo significativo** (≥ N caracteres).
  ✅ RESOLVIDO (dono do intent): resumo profissional ≥ 50 caracteres.

  *Ajuste do AC-037-3:* explicita conteúdo mínimo (toca F4 do intent).

- **E-003:** The system SHALL persistir motivo do encaminhamento como campo opcional (AC-037-4), **e exibir o motivo no e-mail à Pessoa** quando informado.

- **E-004:** The system SHALL permitir múltiplos encaminhamentos da mesma Pessoa para vagas diferentes (AC-037-6).

- **E-005:** IF a vaga não está com status "ativo", THEN the system SHALL bloquear o encaminhamento com mensagem clara — "esta vaga voltou para moderação enquanto você preenchia; deseja salvar como rascunho?".

  *Ajuste do AC-037-7:* explicita feedback claro (toca F6 do intent).

- **E-006:** WHEN o encaminhador tenta encaminhar a mesma Pessoa para N+ vagas similares em janela curta, the system SHALL alertar "Pessoa X já foi encaminhada para N vagas similares — deseja continuar?".
  ✅ RESOLVIDO (dono do intent): sem controle automático de encaminhamentos repetidos no MVP — treinamento + amostragem trimestral cobrem.

  *Ajuste:* AC do PRD não cobre alerta; vem do F5 do intent (spray and pray).

## 2. Proibições (must-not)

- **P-001 (toca F1 — sem aceite prévio mas termo não cobre):** O sistema NÃO PODE permitir encaminhamento em produção sem que o termo da finalidade 8 (ADR-0013) **explicite** que a ASONSEG pode encaminhar a Pessoa para vagas sem confirmação caso a caso (mediante consentimento amplo no aceite inicial). Sem essa cláusula, RP-003 + ADR-0016 ficam em conflito.

- **P-002 (toca F2 — perfil incompatível):** O sistema NÃO PODE permitir encaminhamento sem que o encaminhador veja, antes do submit, **a vaga + a Pessoa + a ficha social (se AS) ou perfil candidato (se outros)** em painel comparativo claro. Mitiga decisão impulsiva.

- **P-003 (toca F3 — Pessoa surpreendida):** O sistema NÃO PODE enviar e-mail informativo padrão genérico. Template precisa incluir: "Você foi encaminhada pela ASONSEG via [encaminhador] para a vaga [nome]. Motivo: [motivo se informado]. Se isso foi um engano, entre em contato com a AS." Texto revisado pela diretoria + AS.
  ❓ Texto final a aprovar com jurídico + AS. (dono do intent)

- **P-004 (toca F4 — resumo profissional vazio):** O sistema NÃO PODE aceitar resumo profissional vazio, com caractere único, ou texto manifestamente genérico ("ela quer trabalhar", "—", "x").

- **P-005 (toca F5 — spray and pray):** O sistema NÃO PODE deixar encaminhador disparar N+ encaminhamentos da mesma Pessoa sem alerta. Cf. E-006.

- **P-006 (toca F7 — atomicidade):** O sistema NÃO PODE deixar o encaminhamento em estado parcial. Falha em qualquer efeito (encaminhamento, ativação de papel, candidatura, e-mail) aborta o conjunto — exceto retry específico para e-mail.

- **P-007 (toca F8 — permissão sem revisão):** O sistema NÃO PODE deixar permissão "Encaminhar Pessoa para vaga" delegada sem auditoria periódica. Coordenador + diretoria revisam trimestralmente quem tem (decisão operacional, mas o sistema pode fornecer relatório).

- **P-008:** O sistema NÃO PODE permitir encaminhamento sem consentimento ativo da finalidade 8 da Pessoa.

## 3. Limites

- **L-001 (Performance):** Submit ≤ 3s p95.
- **L-002 (E-mail):** Informativo à Pessoa entregue ao SMTP em ≤ 60s.
- **L-003 (Resumo profissional):** ≥ N caracteres significativos quando sem CV.
- **L-004 (Auditoria):** Log imutável (encaminhador, Pessoa, vaga, motivo, data/hora) retido conforme ADR-0008.

## 4. Critérios de pronto, do ponto de vista do dono do intent

- **D-001 (gate compliance LGPD — BLOQUEANTE):** Antes desta USP ir para produção, **D-001 (DPO designado)** e **D-002 do PRD (termo da finalidade 8 cobrindo encaminhamento sem aceite prévio caso a caso)** estão confirmados por escrito. Sem isso, a USP **não vai para produção** — RP-002 + RP-003 inaceitáveis.

- **D-002 (gate operacional):** Antes desta USP entregar valor pleno, o **treinamento textual ao encaminhador** (material escrito para garantir qualidade do encaminhamento — ADR-0016) está aplicado, e o sistema apresenta o material como tooltip/link no fluxo.

- **D-003:** A AS, em ensaio: encaminha uma Pessoa real para uma vaga real em ≤ 5 min; o encaminhamento aparece em USP-027 (lista de candidatos) com badge ASONSEG; a Pessoa recebe e-mail informativo com motivo + nome do encaminhador + frase "se foi engano, contate a AS".

- **D-004:** Em teste de vaga rebaixada durante o preenchimento: sistema oferece "salvar como rascunho" sem erro técnico ou perda de dados.

- **D-005:** Em teste de spray and pray: encaminhador tenta encaminhar Pessoa X para 5ª vaga similar em uma semana; sistema alerta antes do submit.

- **D-006:** A coordenadora abre relatório trimestral de quem tem permissão "Encaminhar" delegada e revisa.

- **D-007:** Em teste de bypass: tentativa de chamada direta à API encaminhando Pessoa sem consentimento da finalidade 8 é rejeitada.
