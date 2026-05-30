# Expectations — USP-044: Notificações por e-mail em eventos do portal

**Origem:** AC-044-1 a AC-044-8 do PRD v0.3, ajustados e estendidos.

## 1. Cenários de sucesso testáveis

- **E-001:** WHEN cada um dos 8 eventos cobertos ocorre (boas-vindas USP-001, recuperação de senha USP-005, decisão de moderação USP-016, confirmação de candidatura USP-025, manifestação de interesse USP-033, encaminhamento USP-037, expiração próxima USP-024, lembrete de CV após N dias), the system SHALL disparar e-mail correspondente **após confirmação da transação** (post-commit, via fila assíncrona se necessário).

  *Ajuste:* AC do PRD não explicita post-commit; vem do F3 do intent (e-mail antes da transação completar).

- **E-002:** The system SHALL enviar e-mails com autenticação SPF/DKIM/DMARC configurada adequadamente, monitorar bounce rate e spam complaint via provedor SMTP, e alertar operacionalmente quando taxas ultrapassam limiar.
  ✅ RESOLVIDO (ADR-0019 / TD §8.3 + decisão PO 2026-05-29): bounce rate / spam complaint + quota SMTP ≥ 80% monitorados (monitoramento de bounce/spam INCLUÍDO no MVP); os limiares concretos são parâmetros tunáveis.

  *Ajuste:* AC do PRD não cobre autenticação; vem do F1 do intent.

- **E-003:** The system SHALL aplicar **minimização** no corpo dos e-mails — apenas dados estritamente necessários para a comunicação. Templates revisados por DPO + designer (ADR-0017).

- **E-004:** The system SHALL incluir link de "preferências de notificação" no rodapé de e-mails opcionais (lembrete de CV, expiração próxima quando configurada como opcional), permitindo unsubscribe granular por categoria.

  *Ajuste:* AC do PRD não cobre unsubscribe; vem do F4 do intent + boas práticas LGPD.

- **E-005:** WHEN o volume mensal de envio se aproxima do limite do plano SMTP contratado, the system SHALL alertar operacionalmente o coordenador + Arquiteto.

  *Ajuste:* AC do PRD não cobre; vem do F6 do intent (quota estourada).

- **E-006:** The system SHALL parametrizar o N de inatividade para lembrete de CV (AC-044-8), com default 180 dias, ajustável pela diretoria sem deploy.

## 2. Proibições (must-not)

- **P-001 (toca F1 — e-mail em spam):** O sistema NÃO PODE enviar e-mails sem SPF/DKIM/DMARC configurados. Sem autenticação, e-mails caem em spam e usuários perdem notificações críticas (confirmação de candidatura, expiração de vaga).

- **P-002 (toca F2 — PII no corpo):** O sistema NÃO PODE incluir, no corpo do e-mail, dados pessoais de terceiros além do estritamente necessário. Ex.: e-mail de confirmação de candidatura não inclui contato de outros candidatos; e-mail de encaminhamento não revela ficha social.

- **P-003 (toca F3 — e-mail antes do commit):** O sistema NÃO PODE disparar e-mail antes da confirmação da transação correspondente. Usuário não pode receber "candidatura confirmada" quando a candidatura nem foi persistida.

- **P-004 (toca F4 — sem unsubscribe):** O sistema NÃO PODE enviar lembretes opcionais (CV desatualizado, expiração quando aplicável) sem opção de unsubscribe granular. Spam percebido erode confiança e viola boa prática LGPD.

- **P-005 (toca F5 — phishing-friendly):** O sistema NÃO PODE construir links em e-mails de recuperação de senha (USP-005) com domínio diferente do canônico da ASONSEG, nem com parâmetros que facilitem spoofing visual. URL precisa ser claramente reconhecível como da ASONSEG.

- **P-006 (toca F6 — quota estourada silenciosa):** O sistema NÃO PODE deixar a quota do SMTP esgotar sem alerta prévio (≥ 80% do limite mensal). Plano de upgrade pré-aprovado ou backup SMTP.

- **P-007:** O sistema NÃO PODE enviar e-mail correspondente a evento que falhou após o commit (transação revertida) — fila assíncrona precisa cancelar/ignorar mensagens órfãs.

- **P-008:** O sistema NÃO PODE armazenar conteúdo do e-mail em log sem aplicar minimização — corpo pode conter PII; não pode ser logado em texto claro.

## 3. Limites

- **L-001 (Latência):** E-mail disparado em ≤ 60s após confirmação do evento.
- **L-002 (Quota):** Alerta a ≥ 80% do limite mensal do plano SMTP.
- **L-003 (Bounce/Spam):** Alerta operacional quando taxas ultrapassam limiar acordado.
- **L-004 (Retenção do envio):** Log de envio (metadado: destinatário, evento, status SMTP, sem corpo) retido conforme ADR-0008.

## 4. Critérios de pronto, do ponto de vista do dono do intent

- **D-001 (gate operacional):** Antes desta USP ir para produção, **SPF/DKIM/DMARC configurados** no domínio + provedor SMTP escolhido (ADR-0010 — custo mínimo) com plano de quota dimensionado para volume estimado. Validado por engenheiro Bravi + sponsor.

- **D-002 (gate jurídico):** Antes desta USP ir para produção, os **8 templates de e-mail** foram revisados pelo DPO + jurídico quanto a minimização de PII no corpo. Sem revisão, F2 fica desprotegido.

- **D-003:** Em ensaio dos 8 eventos: cada um dispara e-mail correspondente em ≤ 60s; corpo passa pelo crivo de minimização; link no rodapé permite unsubscribe (quando aplicável).

- **D-004:** Em teste de transação falha: candidatura USP-025 falha após começar; sistema **não envia** o e-mail de confirmação (fila assíncrona cancelou a mensagem órfã).

- **D-005:** Em teste de spam: e-mails enviados para caixas Gmail/Outlook/Yahoo de teste **não caem em spam** (validado por inspeção da caixa).

- **D-006:** A coordenadora abre painel operacional e vê: nº de e-mails enviados por mês, bounce rate, spam complaint rate, quota restante. Alerta visível quando ≥ 80% da quota.

- **D-007:** Em teste de unsubscribe: candidato clica em "preferências" no rodapé de lembrete de CV; desabilita aquela categoria; não recebe mais lembretes desse tipo; ainda recebe e-mails críticos (recuperação de senha, decisão de moderação).

- **D-008:** A diretoria, em ensaio, altera o parâmetro de N dias do lembrete de CV de 180 para 90 (sem deploy); novo valor passa a valer para os lembretes seguintes.
