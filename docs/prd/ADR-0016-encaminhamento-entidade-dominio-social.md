# ADR-0016: Encaminhamento como entidade do domínio social

**Status:** Aceito — Aplicável ao Release 1 (MVP Portal Empregabilidade e Serviços)
**Data:** 2026-05-22
**Decisores:** Sponsor ASONSEG (diretor a designar), Bravi PO
**US/Épicos impactados:** USP-037, USP-038, USP-039, USP-008
**Tags:** modelagem | fluxo de negócio | diferencial institucional

## Contexto

O Portal Empregabilidade e Serviços precisa diferenciar-se de portais comerciais comuns. Um dos diferenciais identificados durante a elicitação é a capacidade da ASONSEG de exercer ativamente seu papel institucional de ponte entre comunidade atendida e mercado de trabalho — não apenas hospedar vagas, mas direcionar pessoas para oportunidades.

Concretamente: a assistente social (e, com permissão delegada, coordenador e voluntário) conhece pessoas em situação de vulnerabilidade que provavelmente não chegariam às vagas sozinhas, seja por desconhecimento do portal, baixa literacia digital, ou falta de habilidade em "se vender" para empresas. O encaminhamento institucional é o mecanismo formal pelo qual a ASONSEG indica essas pessoas para empresas.

Esse mecanismo precisa:

- Conectar Pessoa (qualquer pessoa cadastrada no portal, não apenas beneficiários sociais) a uma vaga ativa.
- Ser visível para a empresa como sinal de respaldo institucional (badge).
- Ativar o papel candidato automaticamente quando necessário.
- Funcionar mesmo quando a Pessoa não tem CV anexo (resumo textual da AS supre).
- Permitir múltiplos encaminhamentos da mesma Pessoa para vagas distintas.
- Ser auditável.
- Permitir registro de resultado posterior (manual) para que a ASONSEG saiba se o encaminhamento gerou contratação.

## Decisão

**Encaminhamento é uma entidade própria do domínio do sistema, distinta de candidatura.**

**Modelagem:**

- **Encaminhamento** — entidade com atributos:
  - Pessoa encaminhada (referência a Pessoa)
  - Vaga referenciada (referência a Vaga, com restrição "ativa" no momento da criação)
  - Encaminhador (Pessoa autor do encaminhamento — AS, coordenador, ou voluntário com permissão delegada)
  - Data e hora
  - Motivo / justificativa (texto livre, opcional)
  - Resumo profissional (texto livre, obrigatório se a Pessoa encaminhada não tiver CV anexo)
  - Resultado (enum opcional: contratado, não selecionado, em análise, sem resposta) — preenchido manualmente quando souber
  - Observação sobre resultado (texto livre)

**Relação com Candidatura:**

- Encaminhamento **gera uma candidatura** à vaga, automaticamente (USP-037, AC-037-5).
- Candidatura gerada por encaminhamento é marcada com flag "via_encaminhamento" e referencia o encaminhamento.
- Empresa vê a candidatura na lista normal (USP-027), com badge visível "Candidato encaminhado pela ASONSEG" (AC-027-2).
- Demais regras da candidatura (cancelamento, recandidatura) aplicam-se igualmente.

**Quem pode encaminhar:**

- Assistente social
- Coordenador da área
- Voluntário com a permissão delegável "Encaminhar Pessoa para vaga" (extensão do catálogo do ADR-0001).

**Regras estruturais:**

1. Encaminhamento ativa o papel candidato da Pessoa encaminhada automaticamente, se ainda não estiver ativo (USP-037, AC-037-2).
2. Se a Pessoa não tem CV anexo, resumo profissional textual é obrigatório no encaminhamento (AC-037-3).
3. Múltiplos encaminhamentos da mesma Pessoa para vagas diferentes: permitido.
4. Vaga precisa estar com status "ativo" no momento do encaminhamento (AC-037-7).
5. **Sem aceite prévio do beneficiário** — AS encaminha direto; Pessoa recebe e-mail informativo (decidido em Bloco 6 da elicitação).
6. **Encaminhamento pode partir de qualquer Pessoa cadastrada** no portal — não exige que seja beneficiária social. AS pode encaminhar candidato que se cadastrou diretamente no portal e que ela conhece (USP-037 + decisão Bloco 7).
7. Resultado pode ser registrado manualmente por usuário autorizado (USP-038), de forma opcional e a qualquer momento.

## Alternativas Consideradas

**Alternativa A — Encaminhamento como atributo da Candidatura (descartada):** candidatura tem um campo opcional "origem do encaminhamento". Por que não escolhida: encaminhamento não é só "como nasceu a candidatura"; é entidade institucional autônoma com regras próprias (resumo profissional para Pessoa sem CV, permissão específica para criar, resultado independente). Misturar com candidatura empobrece o conceito.

**Alternativa B — Encaminhamento como entidade própria (escolhida):** modelo descrito acima.

**Alternativa C — Encaminhamento exige aceite prévio do beneficiário (descartada):** Pessoa precisaria aceitar antes de virar candidata efetiva. Por que não escolhida: público-alvo do encaminhamento muitas vezes é digitalmente menos engajado (sem e-mail ativo, sem checar regularmente); fluxo de aceite atrasaria ou inviabilizaria o encaminhamento; AS já tem relação direta de confiança com a Pessoa e termo de consentimento social cobre. Decisão direta de Bloco 6 da elicitação.

**Alternativa D — Encaminhamento invisível para a empresa (descartada):** empresa não saberia que o candidato veio por encaminhamento. Por que não escolhida: badge visível é justamente o que dá valor de marca à ASONSEG; empresa-parceira valoriza a "curadoria" da ONG.

## Consequências

**Positivas:**

- Diferencial institucional materializado em fluxo concreto.
- Rastreabilidade do impacto social do portal (MP8 — encaminhamentos criados; MP9 — % de encaminhamentos contratados).
- Empresa percebe valor agregado da ASONSEG (badge).
- Modelo flexível — funciona com Pessoa sem CV, sem ter sido beneficiária formal, e em múltiplas vagas.

**Negativas / Trade-offs:**

- **Sem medição automática de resultado** (decisão de Bloco 7) — depende de registro manual. Mitigação: comunicar empresas-parceiras que o feedback de contratação é importante; AS pode acompanhar diretamente.
- **Sem aceite prévio do beneficiário** — risco LGPD se o termo de consentimento social não cobrir encaminhamento para vaga. Mitigação: D-002 ampliada — termo precisa cobrir explicitamente essa finalidade (ADR-0013, finalidade 8).
- Empresa pode questionar a qualidade do encaminhamento se receber candidato muito divergente do perfil; isso pode prejudicar reputação institucional. Mitigação: encaminhador deve usar bom senso; treinamento textual no fluxo.

**Implicações em outras decisões:**

- ADR-0013 (Consentimentos por finalidade) precisa cobrir "encaminhamento institucional para vaga" como finalidade própria do termo de consentimento social.
- ADR-0001 (Permissões delegáveis) estendido com "Encaminhar Pessoa para vaga".
- USP-039 (Visão consolidada da Pessoa) inclui encaminhamentos como uma das dimensões exibidas.

## Referências

- ADR-0001 (Permissões delegáveis).
- ADR-0013 (Consentimentos LGPD por finalidade — finalidade 8).
- PRD MVP Portal, USP-037 (Encaminhar), USP-038 (Resultado), USP-039 (Visão consolidada).
- Blocos 6 e 7 da elicitação.
