# Expectations — USP-022: Ver detalhe da vaga

**Origem:** AC-022-1 a AC-022-3 do PRD v0.3, ajustados e estendidos.

## 1. Cenários de sucesso testáveis

- **E-001:** WHEN o visitante anônimo abre o detalhe de uma vaga, the system SHALL exibir todos os dados da vaga (descrição, requisitos, benefícios, salário, regime, local, validade) com a Empresa anonimizada por setor (ADR-0017) **em toda a página, API e metadados**.

- **E-002:** WHEN a Pessoa autenticada com papel candidato ativo abre o detalhe, the system SHALL exibir nome real da Empresa e botão "candidatar-se".

- **E-003:** The system SHALL exibir contador de candidaturas ("N pessoas se candidataram") apenas a partir de um limiar mínimo, para evitar efeito psicológico inverso quando N é baixo.
  ✅ RESOLVIDO (dono do intent): contador aparece a partir de N = 3 candidaturas (tunável).

  *Ajuste do AC-022-3:* explicita o limiar mínimo (toca F1 do intent).

- **E-004:** WHEN Pessoa autenticada sem papel candidato ativo abre o detalhe, the system SHALL exibir CTA claro "Ativar perfil candidato" linkando para USP-009.

  *Ajuste:* AC do PRD não cobre esse caso; vem do F3 do intent.

- **E-005:** WHEN a vaga não está em status "ativo" (foi pausada, arquivada, expirada, rebaixada via re-verificação de Empresa), the system SHALL exibir mensagem clara "Vaga encerrada / temporariamente indisponível" e CTA para outras vagas — não erro técnico, não candidatura silenciosa.

## 2. Proibições (must-not)

- **P-001 (toca F1 — contador baixo afasta):** O sistema NÃO PODE exibir contador com N = 0, 1 ou 2 candidatos. Exibição só a partir do limiar acordado.

- **P-002 (toca F2 — Empresa vaza via metadados):** O sistema NÃO PODE expor nome real da Empresa para anônimo em **nenhum** canal técnico: HTML visível, JSON da API, meta tags Open Graph/Twitter Card, JSON-LD, schema.org markup, alt de imagem, URL canônica. Sanitização na camada de serialização.

- **P-003 (toca F3 — autenticado sem papel sem CTA):** O sistema NÃO PODE deixar Pessoa autenticada sem papel candidato olhando a vaga sem caminho claro para ativar o papel. Sem CTA é fricção que perde candidato real.

- **P-004 (toca F4 — vaga de Empresa rebaixada):** O sistema NÃO PODE manter vaga acessível com sinais contraditórios quando a Empresa foi rebaixada para "não verificada" via USP-015. Vaga sai do ar (alinhado com USP-021/P-005 e USP-020/P-002).

- **P-005:** O sistema NÃO PODE permitir candidatura (USP-025) a partir do detalhe quando a vaga não está em status "ativo".

## 3. Limites

- **L-001 (Performance):** Carregamento do detalhe ≤ 2s p95.
- **L-002 (Cache):** Detalhe cacheável em janela curta — alinhado com USP-021/L-004.
- **L-003 (Rate limiting):** Acesso público com rate limiting por IP.

## 4. Critérios de pronto, do ponto de vista do dono do intent

- **D-001:** Visitante anônimo, em ensaio, abre o detalhe de uma vaga e a Empresa aparece como "Empresa do setor de Comércio Varejista" (ou similar) em todos os campos. Validado por inspeção do HTML + JSON + metadados.

- **D-002:** Em ensaio, Pessoa autenticada como candidato abre o detalhe e clica em "candidatar-se" — fluxo USP-025 dispara sem fricção. Total ≤ 30 segundos do clique inicial.

- **D-003:** Em ensaio, Pessoa autenticada como prestador (sem papel candidato) abre o detalhe e vê CTA "Ative seu perfil candidato" — clicando, vai para USP-009.

- **D-004:** Em teste de vaga pausada/expirada: link direto exibe mensagem clara, sem botão de candidatar, com CTA para lista de vagas (USP-021).

- **D-005:** Em ensaio com vaga que tem 0 candidaturas: contador **não aparece**. Em ensaio com vaga que tem 7 candidaturas: contador aparece "7 pessoas se candidataram".
