# Expectations — USP-013: Adicionar responsável a uma Empresa

**Origem:** AC-013-1 a AC-013-3 do PRD v0.3, ajustados e estendidos.

## 1. Cenários de sucesso testáveis

- **E-001:** WHEN o responsável atual busca uma Pessoa por CPF ou e-mail e seleciona-a como responsável adicional, the system SHALL criar vínculo Pessoa↔Empresa do tipo "responsável" **e ativar o papel empresa-responsável na Pessoa adicionada** (se ainda não estiver ativo), com captura do consentimento da finalidade 5 no próximo login da Pessoa adicionada.

  *Ajuste do AC-013-1:* explicita ativação do papel + ressalva sobre consentimento (que precisa ser capturado no aceite da Pessoa adicionada — ver P-002).

- **E-002:** IF a Pessoa buscada não está cadastrada no portal, THEN the system SHALL bloquear a operação e orientar que essa Pessoa precisa fazer o auto-cadastro antes (sem convite por e-mail no MVP).

- **E-003:** WHEN o vínculo é criado, the system SHALL enviar e-mail à Pessoa adicionada informando o vínculo, com link para revisar/aceitar.
  ✅ RESOLVIDO (dono do intent): aceite explícito obrigatório — vínculo "pendente" até a Pessoa aceitar.

## 2. Proibições (must-not)

- **P-001 (toca F1 — busca como vetor de descoberta):** O sistema NÃO PODE retornar, na busca por CPF ou e-mail, dados identificadores (nome completo, foto) **antes** da confirmação. Resposta inicial precisa ser binária ("Pessoa encontrada — selecione para adicionar" sem expor nome até a confirmação acontecer no servidor com gate de permissão).
  ✅ RESOLVIDO (dono do intent): resposta binária sem PII até o aceite (ADR-0022).

- **P-002 (toca F2 — adição não consentida):** O sistema NÃO PODE vincular uma Pessoa como responsável de Empresa sem aceite explícito dela. O vínculo nasce como "pendente de aceite"; só vira ativo quando a Pessoa adicionada confirma no painel ou via link de e-mail.
  ✅ RESOLVIDO (dono do intent): aceite explícito obrigatório.

- **P-003 (toca F3 — atomicidade papel/vínculo):** O sistema NÃO PODE criar vínculo sem o papel empresa-responsável correspondente ativo (após o aceite) na Pessoa adicionada. Em todas as combinações, vínculo e papel ficam consistentes.

- **P-004 (toca F4 — vínculo duplicado):** O sistema NÃO PODE criar dois vínculos da mesma Pessoa com a mesma Empresa, nem sob requisições simultâneas. Unique constraint no par (pessoa_id, empresa_id, tipo_vínculo ativo) + 409 determinístico.

- **P-005:** O sistema NÃO PODE permitir busca de Pessoa por CPF/e-mail por usuário que **não seja responsável ativo de Empresa**. Função é restrita ao escopo da Empresa que o solicitante representa.

## 3. Limites

- **L-001 (Performance):** Submit ≤ 2s p95.
- **L-002 (Rate limiting):** Limite de N buscas por CPF/e-mail por responsável por janela, para mitigar enumeração de CPFs.
  ✅ RESOLVIDO (ADR-0029 / ADR-0022): rate limit por rota/identidade anti-enumeração de CPF, com alerta; resposta binária sem PII (ADR-0022). O valor concreto de N é parâmetro tunável.
- **L-003 (Visibilidade):** Dados pessoais da Pessoa-alvo da busca só revelados após aceite dela (ver P-001).

## 4. Critérios de pronto, do ponto de vista do dono do intent

- **D-001 (gate jurídico):** Antes desta USP ir para produção, a diretoria + jurídico decidem por escrito o modelo de aceite (explícito por aceite no painel da Pessoa adicionada vs. notificação a posteriori). Sem decisão, a USP **não vai para produção** — a versão padrão "criação imediata" é vetor LGPD inaceitável.

- **D-002:** Em ensaio: responsável de Empresa adiciona Pessoa pelo CPF. A Pessoa recebe e-mail com link de aceite, abre o link, confirma, e só então passa a ver a Empresa nas suas opções de operação.

- **D-003:** Em teste de descoberta por CPF: 10 buscas alternadas com CPFs cadastrados e não cadastrados não revelam nomes dos cadastrados antes da confirmação. Validado por inspeção do front + sponsor.

- **D-004:** Em teste de race condition: dois responsáveis adicionam a mesma Pessoa simultaneamente; resultado é **um único vínculo** ativo + 409 determinístico no segundo.

- **D-005:** Auditoria mostra histórico completo de adições (quem adicionou, quem aceitou, quando).
