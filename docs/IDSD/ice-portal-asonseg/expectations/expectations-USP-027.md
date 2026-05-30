# Expectations — USP-027: Empresa ver lista de candidatos da vaga

**Origem:** AC-027-1 a AC-027-3 do PRD v0.3, ajustados e estendidos.

## 1. Cenários de sucesso testáveis

- **E-001:** WHEN a Pessoa-responsável ativa de uma Empresa abre uma vaga sua, the system SHALL listar todas as candidaturas ativas (não canceladas) com nome do candidato, contato (e-mail e telefone), link para CV e data/hora da candidatura.

- **E-002:** WHERE a candidatura veio de encaminhamento institucional (USP-037), the system SHALL exibir badge visível "Candidato encaminhado pela ASONSEG" (ADR-0016).

- **E-003:** The system SHALL exibir flag visual quando o CV do candidato foi pré-preenchido via extração por IA (USP-040), reforçando transparência ao avaliador.

  *Ajuste:* AC do PRD não cobre flag de transparência; vem do F2 do intent.

- **E-004:** WHEN a vaga foi inativada (USP-018) ou expirada (USP-024), the system SHALL continuar permitindo ao responsável visualizar o histórico de candidaturas (com indicação clara do estado da vaga), mas sem novos efeitos colaterais.

## 2. Proibições (must-not)

- **P-001 (toca F1 — sem status causa confusão):** O sistema NÃO PODE deixar de informar à Empresa que o gerenciamento de status (vista/entrevistada/contratada) está fora do escopo MVP. Tela explicita "use seu processo próprio fora do sistema" (decisão consciente do PRD).

- **P-002 (toca F2 — IA-extraído sem flag):** O sistema NÃO PODE exibir CV/perfil pré-preenchido por IA sem flag visual de "preenchimento assistido por IA — sujeito a revisão pelo candidato". Reforça transparência e mitiga RP-008 a jusante.

- **P-003 (toca F3 — badge cria expectativa não cumprida):** O sistema NÃO PODE exibir badge "encaminhado pela ASONSEG" sem que o encaminhamento tenha seguido a diretriz operacional (training ao encaminhador — ADR-0016). Badge depende da qualidade do encaminhamento, não apenas do flag técnico.
  ❓ Treinamento dos encaminhadores aplicado fora do sistema; gate operacional. (dono do intent — coordenador)

- **P-004:** O sistema NÃO PODE permitir acesso à lista por Pessoa sem vínculo "responsável" ativo da Empresa dona da vaga.

- **P-005:** O sistema NÃO PODE exibir candidaturas canceladas na lista ativa — preservadas apenas no histórico de auditoria.

- **P-006:** O sistema NÃO PODE expor, na lista de candidatos, dados de outros candidatos (cross-leakage por consulta mal isolada).

## 3. Limites

- **L-001 (Performance):** Lista carrega ≤ 2s p95 para até 100 candidaturas; paginação acima disso.
- **L-002 (Auditoria):** Acesso registrado em log (quem viu, quando, qual vaga, quantos candidatos listados).
- **L-003 (Visibilidade):** Dados de contato + CV revelados apenas após ação afirmativa do candidato (candidatura USP-025) — coerente com ADR-0017.

## 4. Critérios de pronto, do ponto de vista do dono do intent

- **D-001:** Pessoa-responsável, em ensaio, abre uma vaga com 5 candidaturas (3 diretas + 2 encaminhadas pela ASONSEG); vê 5 itens, 2 com badge institucional, todos com contato + CV; CV de candidato que usou USP-040 tem flag "preenchimento assistido por IA".

- **D-002:** Em teste de permissão: Pessoa-responsável de Empresa A tenta abrir vaga de Empresa B; sistema bloqueia com erro determinístico.

- **D-003:** A coordenadora abre o painel da Empresa e confere o aviso "gerenciamento de status fora do MVP". Sponsor valida.

- **D-004:** Em ensaio de carga: vaga com 80 candidaturas carrega lista em ≤ 2s.

- **D-005 (gate operacional):** Antes desta USP entregar valor pleno, o treinamento dos encaminhadores (matched expectations para o badge — ADR-0016) está aplicado, com material escrito validado pelo coordenador.
