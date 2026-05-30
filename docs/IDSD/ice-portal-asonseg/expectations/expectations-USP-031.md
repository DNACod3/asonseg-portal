# Expectations — USP-031: Ver detalhe do serviço

**Origem:** AC-031-1 a AC-031-3 do PRD v0.3, ajustados e estendidos.

## 1. Cenários de sucesso testáveis

- **E-001:** WHEN o visitante (anônimo ou autenticado) abre o detalhe, the system SHALL exibir nome do prestador (PF) ou Empresa, categorias, descrição, fotos, valor, unidade, região e disponibilidade.

- **E-002:** The system SHALL ocultar telefone e e-mail do prestador até manifestação de interesse autenticada (USP-033).

- **E-003:** WHEN a Pessoa autenticada manifesta interesse (USP-033), the system SHALL exibir o contato do prestador.

- **E-004:** WHEN o visitante anônimo abre o detalhe, the system SHALL exibir CTA claro "Crie sua conta para contratar este serviço" linkando para USP-001.

  *Ajuste:* AC do PRD não cobre CTA para anônimo; vem do F2 do intent.

- **E-005:** WHEN o serviço está pausado, arquivado ou tem prestador com papel desativado, the system SHALL exibir mensagem clara "Serviço não está mais disponível" + CTA para lista (USP-030), sem botão de manifestar interesse.

  *Ajuste:* AC do PRD não cobre estados não-ativos; vem do F3 do intent.

## 2. Proibições (must-not)

- **P-001 (toca F1 — contato vaza no texto livre):** O sistema NÃO PODE exibir contato (telefone/e-mail) escondido em descrição livre ou em texto sobre fotos. Sanitização automática (regex para telefone/e-mail) + moderador (USP-016) verifica.
  ✅ RESOLVIDO (ADR-0028): fotos passam apenas por inspeção humana na moderação no MVP (sem OCR/remoção automática); regex de PII cobre o texto livre.

- **P-002 (toca F2 — anônimo sem CTA):** O sistema NÃO PODE deixar visitante anônimo no detalhe sem caminho claro para "criar conta para contratar".

- **P-003 (toca F3 — link direto a serviço inativo):** O sistema NÃO PODE renderizar detalhe completo de serviço pausado/arquivado/com prestador desativado como se estivesse ativo. Mensagem clara + bloqueio de manifestar.

- **P-004:** O sistema NÃO PODE permitir manifestar interesse (USP-033) se o serviço não estiver em status "ativo".

- **P-005:** O sistema NÃO PODE expor, em metadados (OG, JSON-LD), contato do prestador — ADR-0017 aplica-se a todos os canais técnicos.

## 3. Limites

- **L-001 (Performance):** Carregamento do detalhe ≤ 2s p95.
- **L-002 (Cache):** Detalhe cacheável em janela curta.
- **L-003 (Rate limiting):** Acesso público com rate limiting.

## 4. Critérios de pronto, do ponto de vista do dono do intent

- **D-001:** Visitante anônimo, em ensaio, abre o detalhe de um serviço e vê fotos + nome do prestador + valor + região, **sem** contato (telefone/e-mail). CTA "Crie conta para contratar" visível.

- **D-002:** Visitante autenticado, em ensaio, clica em "entrar em contato"; USP-033 dispara; contato do prestador é revelado na sequência. Total ≤ 30s.

- **D-003:** Em teste de contato vazado no texto livre: prestador escreve "Telefone: 11 99999" na descrição; sistema sanitiza ou bloqueia na moderação. Validado por engenheiro + sponsor.

- **D-004:** Em teste de link a serviço pausado: link direto exibe mensagem clara + CTA para lista.

- **D-005:** A coordenadora inspeciona metadados (OG, JSON-LD) de um detalhe de serviço e confere que **contato não aparece** em nenhum canal técnico.
