# ADR-0017: Visibilidade conservadora de dados pessoais entre papéis

**Status:** Aceito — Aplicável ao Release 1 (MVP Portal Empregabilidade e Serviços)
**Data:** 2026-05-22
**Decisores:** Sponsor ASONSEG (diretor a designar), Bravi PO
**US/Épicos impactados:** USP-021 a USP-022, USP-025, USP-027, USP-028, USP-030 a USP-031, USP-033
**Tags:** lgpd | autorização | privacidade | regra de negócio

## Contexto

O Portal opera num cenário em que múltiplos papéis observam dados uns dos outros, mas em níveis muito diferentes de "necessidade legítima de saber":

- Visitante anônimo vê vagas e serviços (público).
- Candidato logado quer ver vagas (pode candidatar-se).
- Empresa-responsável logada quer ver candidatos (para contratar).
- Cliente de serviço logado quer ver prestadores (para contratar).
- Prestador logado quer ver clientes que manifestaram interesse.

Existe risco real de "vazamento" de dados pessoais entre esses papéis se a visibilidade for permissiva. Empresa pode coletar contato de candidato sem intenção real de contratar; cliente pode "minerar" dados de prestadores; visitante anônimo pode mapear empresas que estão contratando para uso indevido.

A LGPD exige princípio de minimização: o titular dos dados só deve ter seus dados expostos na medida necessária para cumprir a finalidade legítima.

## Decisão

**Adotar modelo conservador de visibilidade: dados pessoais ficam ocultos por padrão e só são revelados após autenticação + ação afirmativa específica.**

**Matriz de visibilidade aprovada (referência: §2.2 da elicitação, Bloco 2):**

**Vaga pública:**
- **Visitante anônimo:** título, área, descrição, requisitos, benefícios. Empresa anonimizada ("Empresa do setor de varejo").
- **Pessoa autenticada:** acima + nome da Empresa.

**Candidato na busca da Empresa (autenticada):**
- Empresa-responsável logada vê: primeiro nome do candidato + cidade/região + área de interesse principal + escolaridade + qualificações resumidas.
- **Não vê:** CPF, e-mail, telefone, endereço completo, CV completo, data de nascimento.
- **Vê dados completos apenas após o candidato candidatar-se a uma vaga da Empresa** (USP-025, AC-025-1).

**Serviço público:**
- Anônimo e autenticado veem: título, categoria, descrição, faixa de preço, **nome do prestador (público — é o que vende o serviço)**, região, fotos, disponibilidade.
- **Contato (telefone, e-mail) do prestador oculto** até cliente cadastrado manifestar interesse (USP-033, AC-033-1).

**Prestador (perfil público):**
- Anônimo e autenticado veem: nome, foto, categorias, região de atuação, descrição.
- **Sem contato** até cliente manifestar interesse.

**Cliente que manifestou interesse (visto pelo prestador):**
- Prestador logado vê: nome do cliente, contato (telefone, e-mail), data da manifestação, serviço referenciado (USP-035).

**Ficha social e dados sensíveis (escopo interno ASONSEG):**
- Apenas assistente social e diretoria têm acesso (USP-036, AC-036-3).
- Coordenador não vê ficha social — apenas operações da sua área.
- Voluntário comum não vê visão consolidada da Pessoa.

**Regras transversais:**

1. **Princípio da minimização:** sempre que possível, ocultar campos. Quando necessário expor, expor o mínimo.
2. **Princípio da ação afirmativa:** revelação de dados sensíveis (contato, CV completo) só após uma ação explícita do titular (candidatura, manifestação de interesse).
3. **Princípio da reciprocidade no marketplace:** quando uma das partes age (candidatura, manifestação), a outra parte recebe o contato — não há "ver sem ser visto".
4. **Princípio da rastreabilidade:** todo acesso a dados sensíveis fica em log de auditoria (futuro — pode evoluir em V2).

## Alternativas Consideradas

**Alternativa A — Visibilidade aberta (descartada):** dados pessoais visíveis livremente para qualquer usuário autenticado. Por que não escolhida: violação clara da LGPD; risco de mineração de dados; perda de confiança da comunidade.

**Alternativa B — Visibilidade conservadora padrão + opção de exposição pelo titular (descartada para o MVP):** cada Pessoa configura no próprio cadastro quais campos são públicos. Por que não escolhida para o MVP: adiciona complexidade de UI; usuário muitas vezes não sabe avaliar implicações; melhor começar conservador e flexibilizar com cuidado em V2.

**Alternativa C — Visibilidade conservadora pura, com ação afirmativa para revelação (escolhida):** modelo descrito acima.

**Alternativa D — Mensagens internas no sistema antes da revelação (descartada):** candidato e empresa trocam mensagens dentro do portal sem revelar contatos; só revelam após N mensagens ou aceite mútuo. Por que não escolhida: complexidade técnica (sistema de mensageria); UX ruim para o público da ASONSEG (baixo letramento); contradiz a decisão de Bloco 6 (candidatura silenciosa com revelação).

## Consequências

**Positivas:**

- LGPD com minimização aplicada.
- Risco de mineração indevida de dados reduzido.
- Comunidade percebe o portal como seguro.
- Coerente com o termo de responsabilidade e com a moderação de empresa-fantasma (ADR-0015).

**Negativas / Trade-offs:**

- UX um pouco mais "sem contato" — empresa vê candidato e não pode entrar em contato proativamente. Mitigação: candidato pode candidatar-se; empresa pode publicar vaga para atrair candidatura.
- Anonimização da empresa na vaga pública pode reduzir taxa de cliques de candidato curioso. Mitigação: tradeoff aceito conscientemente.
- Necessidade de implementar lógica de visibilidade por papel em vários pontos do sistema — esforço de desenvolvimento real.
- "Nome do prestador é público" foi destacado pelo PO durante a elicitação como exceção consciente (sem isso não há comércio); decisão confirmada pelo cliente.

**Implicações em outras decisões:**

- USP-021 (Buscar vagas), USP-022 (Detalhe vaga), USP-027 (Lista de candidatos), USP-028 (Busca de candidatos), USP-031 (Detalhe serviço), USP-033 (Manifestação interesse): todas implementam essas regras de visibilidade.
- Cada papel tem matriz de visibilidade explícita no PRD.
- Tabela detalhada de visibilidade no Glossário/Apêndice do PRD seria útil em sprints de design.

## Referências

- LGPD (Lei 13.709/2018), arts. 6º (princípios), 7º, 18.
- PRD MVP Portal, §2.2 (visibilidade), USP-021 a USP-033.
- Bloco 2 da elicitação (matriz de visibilidade).
