# ADR-0011: Pessoa como entidade fundamental, login único e papéis compostos

**Status:** Aceito — Aplicável ao Release 1 (MVP Portal Empregabilidade e Serviços)
**Data:** 2026-05-22
**Decisores:** Sponsor ASONSEG (diretor a designar), Bravi PO
**US/Épicos impactados:** USP-001 a USP-008, USP-009 a USP-012, USP-039
**Tags:** modelagem | identidade | arquitetura | fundação compartilhada

## Contexto

O projeto ASONSEG evoluiu de "gestão social interna" (PRD original da Frente 4) para "sistema multifacetado" com Portal Empregabilidade e Serviços como MVP e gestão social no Release 2. A diretoria decidiu (Cenário 1 — identidade unificada plena) que toda a fundação compartilhada do sistema deve ser modelada já no MVP do Portal.

A justificativa central: ao final do deploy de todas as aplicações, a gestão da ASONSEG (diretoria, coordenadores e assistente social) precisa ter uma visão única tanto dos benefícios quanto das vagas que o candidato se inscreveu. Para isso, uma mesma pessoa pode acumular livremente múltiplos papéis no sistema:

- Quem oferece um serviço pode ser a pessoa que contrata outro
- Um beneficiário social pode se candidatar a uma vaga
- Um voluntário da ASONSEG pode cadastrar uma vaga (em nome de uma empresa que ele representa)

Não dá para cada um ter um acesso diferente de acordo com o que vai fazer. Adicionalmente, refatorar Beneficiário→Pessoa depois (ao implementar o Release 2) custa muito mais caro que nascer assim — significaria migração de dados, reconciliação de pessoas que existem nos dois sistemas, e refactor profundo.

## Decisão

**Pessoa** é a entidade fundamental do sistema ASONSEG. Toda persona do sistema é uma manifestação de Pessoa com um ou mais papéis ativos.

**Propriedades da Pessoa:**
- Identificada por CPF (com exceção controlada — ver USP-002, AC-002-2)
- E-mail único por Pessoa (quando informado)
- Login único (e-mail + senha) — pode ser opcional para Pessoa cadastrada pela AS em situação extrema
- Acumula livremente múltiplos papéis ativos
- Consentimentos LGPD por finalidade (ver ADR-0013)

**Catálogo de papéis no MVP:**

- **Papéis públicos** (auto-serviço, com moderação humana do conteúdo posteriormente publicado): candidato, prestador de serviço (PF), cliente de serviço, empresa-responsável.
- **Papéis sociais** (atribuídos pela ASONSEG): beneficiário (Release 2 — ver ADR-0012).
- **Papéis organizacionais** (atribuídos pela ASONSEG): voluntário, coordenador de área, assistente social, diretoria.

**Regras estruturais:**

1. Uma Pessoa pode acumular qualquer combinação de papéis simultaneamente.
2. Ativação de um papel adicional (após o cadastro inicial) é auto-serviço — não exige aprovação. O que entra em moderação humana é o **conteúdo** que a Pessoa publica nesse papel (vaga, CV, serviço), não o papel em si.
3. Cliente de serviço é o papel "mais leve" — ativado automaticamente na primeira manifestação de interesse, sem formulário extra.
4. Empresa-responsável é o papel que vincula Pessoa a uma ou mais Empresas (ver ADR-0014).
5. Permissões administrativas internas (moderar, encaminhar, configurar, etc.) seguem o modelo de delegação granular do ADR-0001, com catálogo estendido para o Portal (ver Glossário do PRD).

## Alternativas Consideradas

**Alternativa A — Tipos de usuário separados (descartada):** modelar Candidato, Empresa-responsável, Prestador, Cliente, Voluntário, Coordenador, AS, Diretoria como entidades independentes, cada uma com seu próprio cadastro e login. Vantagem: simples por entidade. Por que não escolhida: cria duplicidade quando uma mesma pessoa exerce múltiplos papéis (cenário comum — voluntário ASONSEG que também busca vaga, beneficiário que oferece serviço); impossibilita visão consolidada da gestão; replicação de dados pessoais.

**Alternativa B — Modelar identidade unificada apenas no Release 2 (descartada):** MVP do Portal usa modelo "tipos separados"; Release 2 refatora para Pessoa unificada. Vantagem: MVP mais barato no curto prazo. Por que não escolhida: refactor de identidade em sistema em produção custa muito mais caro (migração de dados, reconciliação, downtime, risco) que nascer com modelo correto. Decisão estratégica da diretoria registrada.

**Alternativa C — Pessoa com papel único exclusivo (descartada):** uma Pessoa pode ter qualquer papel, mas apenas um por vez (exclusão mútua). Vantagem: lógica de autorização simplificada. Por que não escolhida: contradiz a realidade do uso (uma mesma pessoa precisa de múltiplos papéis simultâneos — ex.: voluntário ASONSEG que representa uma empresa e busca vaga para si).

**Alternativa D — Pessoa unificada com papéis compostos (escolhida):** modelo descrito acima.

## Consequências

**Positivas:**

- Visão consolidada da gestão (AS, coordenador, diretoria) sobre uma mesma Pessoa em todas as suas dimensões (USP-039).
- Reuso de dados pessoais (cadastro único, sem duplicidade).
- Custo de evolução para Release 2 drasticamente menor — Frente 4 chega para "ativar" papéis e funcionalidades sobre Pessoa que já existe.
- Encaminhamento de beneficiário social para vaga (diferencial institucional da ASONSEG) torna-se trivial — opera sobre a mesma entidade Pessoa.
- LGPD com bases mais sólidas (consentimentos por finalidade — ADR-0013) em vez de termo único genérico.

**Negativas / Trade-offs:**

- Custo inicial maior no MVP — modelagem mais cuidadosa, lógica de autorização por papel, separação clara de visibilidade de campos por papel do consultante (ver ADR-0017).
- Complexidade conceitual maior para o time de desenvolvimento — precisa entender que "Pessoa pode ser qualquer coisa".
- Risco de "vazamento" de informações entre papéis se a separação de visibilidade não for rigorosa (mitigado pelo ADR-0017).
- Pode aparecer cenário não previsto onde dois papéis conflitam (ex.: empresa-responsável que também é candidata — pode ela se candidatar a uma vaga da própria empresa?). Tratamento: regras de negócio explícitas conforme casos surgirem.

**Implicações em outras decisões:**

- **ADR-0002 (Beneficiário/família com vínculo temporal):** parcialmente revisado. Beneficiário deixa de ser entidade separada e vira papel social da Pessoa (ver ADR-0012). Família e vínculo histórico temporal permanecem conforme ADR-0002 — apenas que referenciam Pessoa em vez de Beneficiário-como-entidade.
- **ADR-0003 (Cadastro nominal e LGPD):** estendido. Consentimento único do beneficiário vira consentimentos múltiplos por finalidade (ver ADR-0013).
- **ADR-0001 (Permissões delegáveis):** catálogo de permissões estendido com permissões específicas do Portal (ver Glossário do PRD).

## Referências

- PRD MVP Portal Empregabilidade e Serviços, §2 (Personas), §5 (USP-001 a USP-008).
- PRD Frente 4 v0.2 (Release 2), ADR-0001 (modelo de papéis e delegação).
- CHANGELOG v0.2 — decisão da diretoria sobre Cenário 1 (identidade unificada plena).
- ADR-0012 (Beneficiário como papel social da Pessoa).
- ADR-0013 (Consentimentos LGPD por finalidade).
- ADR-0014 (Empresa sem login próprio com Pessoas-responsáveis).
- ADR-0017 (Visibilidade conservadora de dados pessoais entre papéis).
