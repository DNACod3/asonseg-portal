# ADR-0013: Consentimentos LGPD por finalidade (extensão do ADR-0003)

**Status:** Aceito — Aplicável ao Release 1 (MVP Portal Empregabilidade e Serviços)
**Data:** 2026-05-22
**Decisores:** Sponsor ASONSEG (diretor a designar), Bravi PO
**US/Épicos impactados:** USP-001, USP-009 a USP-012, USP-040, USP-043
**Tags:** lgpd | conformidade | dados pessoais | extensão de ADR

## Contexto

O ADR-0003 (PRD da Frente 4) trata da LGPD sob a perspectiva de um único universo de titulares: beneficiários sociais cadastrados pela ASONSEG, com finalidade institucional ampla. Modelo de "consentimento único" (um termo, uma assinatura, base legal de legítimo interesse + consentimento documentado).

Com a chegada do Portal e a identidade unificada (ADR-0011), o universo de titulares cresceu significativamente:

- **Candidato** — dados pessoais com finalidade de intermediação de oportunidades de trabalho; dados profissionais (CV, experiência, habilidades) que serão expostos a empresas terceiras.
- **Empresa-responsável** — dados pessoais com finalidade de representação institucional de uma empresa.
- **Prestador de serviço** — dados pessoais com finalidade de oferta comercial de serviço, expostos a clientes terceiros.
- **Cliente de serviço** — dados pessoais com finalidade de contratação de serviços.
- **Beneficiário social** — finalidade institucional de atendimento social, conforme ADR-0003.
- **Pessoa com CV processado por IA generativa** — finalidade adicional de extração automática via provedor LLM externo.

Cada uma dessas finalidades tem base legal própria, riscos próprios e implicações distintas. Aplicar um único termo genérico cobre mal, expõe a ASONSEG juridicamente, e não dá controle real ao titular sobre o que está autorizando.

## Decisão

**Adotar modelo de consentimentos múltiplos por finalidade.** Cada Pessoa pode ter um ou mais consentimentos ativos, cada um vinculado a uma finalidade específica.

**Finalidades previstas no MVP:**

1. **Cadastro e autenticação no portal** — dados pessoais básicos (nome, e-mail, CPF, contato). Base legal: execução de relacionamento contratual (acesso à plataforma).
2. **Candidatura a vagas** — dados profissionais (CV, qualificações) compartilhados com empresas. Base legal: consentimento explícito + legítimo interesse.
3. **Oferta de serviço** — dados pessoais/profissionais (nome, foto, descrição, contato) expostos publicamente para clientes. Base legal: consentimento explícito.
4. **Contratação de serviço (cliente)** — dados de contato compartilhados com prestadores. Base legal: consentimento explícito + execução contratual.
5. **Representação de empresa** — dados pessoais como ponto de contato corporativo. Base legal: legítimo interesse + consentimento explícito.
6. **Atendimento social (beneficiário)** — dados sensíveis (situação socioeconômica, vulnerabilidade). Base legal: consentimento explícito + finalidade institucional ASONSEG (conforme ADR-0003).
7. **Extração automática de CV via IA generativa** — envio do CV a provedor LLM externo para extração estruturada de campos. Base legal: consentimento explícito específico (envio a terceiro com finalidade de processamento automatizado).
8. **Encaminhamento institucional para vaga** — uso dos dados sociais para indicar Pessoa para empresa terceira. Base legal: consentimento explícito do beneficiário no momento do cadastro social + legítimo interesse institucional.

**Para cada consentimento, o sistema persiste:**

- Titular (Pessoa)
- Finalidade (uma das acima)
- Versão do termo aceita (string identificadora do documento jurídico vigente)
- Data e hora do aceite
- IP do aceite
- Status (ativo / revogado)

**Operações suportadas:**

- **Ativação:** no momento de ativação do papel ou funcionalidade vinculada à finalidade, sistema exibe o termo específico daquela finalidade e exige aceite explícito.
- **Visualização:** Pessoa pode consultar todos os seus consentimentos vigentes em painel próprio.
- **Revogação individual:** Pessoa pode revogar um consentimento específico; sistema desativa o papel/funcionalidade vinculada à finalidade revogada sem afetar outros consentimentos (USP-043, AC-043-4).

## Alternativas Consideradas

**Alternativa A — Consentimento único genérico (descartada):** manter o modelo do ADR-0003 estendido com cláusulas para cada finalidade. Por que não escolhida: termo único fica longo e ilegível; titular não tem controle granular; revogação de uma finalidade exigiria revogar o todo; expõe a ASONSEG a questionamentos sobre real informação ao titular.

**Alternativa B — Consentimentos por finalidade com revogação individual (escolhida):** modelo descrito acima. Coerente com diretrizes da ANPD e práticas modernas de LGPD (ex.: princípio da granularidade e proporcionalidade no consentimento).

**Alternativa C — Sem consentimentos formais, apenas base legal "legítimo interesse" (descartada):** declarar que a operação ASONSEG é de legítimo interesse institucional e dispensar consentimentos explícitos. Por que não escolhida: legítimo interesse não cobre todas as finalidades (ex.: compartilhamento de CV com empresa terceira para fins comerciais); LGPD exige avaliação caso a caso; risco jurídico elevado; reduz transparência ao titular.

## Consequências

**Positivas:**

- Conformidade LGPD substancialmente mais robusta para cada categoria de titular.
- Titular tem controle granular sobre suas finalidades.
- Revogação individual permite atender direitos do titular sem desligar a Pessoa completamente.
- Bases legais ficam claras e auditáveis.
- ASONSEG fica menos exposta juridicamente.

**Negativas / Trade-offs:**

- Complexidade técnica maior — não basta uma flag "aceitou termos"; precisa de tabela de consentimentos com vários atributos por registro.
- UX mais complexa — usuário precisa entender por que está "consentindo de novo" ao ativar um novo papel. Mitigação: textos curtos e claros, mostrar apenas a finalidade nova no momento.
- Dependência de produção de múltiplos termos jurídicos pela ASONSEG antes do go-live (Dependência D-002 ampliada).
- Cuidado especial com a finalidade 7 (IA generativa) — provedor LLM precisa ter Zero Data Retention; termo precisa cobrir explicitamente esse envio a terceiro.

**Implicações em outras decisões:**

- ADR-0003 fica estendido (não revogado) por este ADR. Para beneficiários sociais, finalidade 6 (atendimento social) implementa o que estava no ADR-0003.
- Dependência D-002 (revisão jurídica do termo) cresce em escopo: agora são múltiplos termos.
- ADR-0018 (extração de CV via IA) referencia a finalidade 7 como pré-requisito.

## Referências

- ADR-0003 (PRD Frente 4 — Cadastro nominal e implicações LGPD).
- ADR-0011 (Pessoa como entidade fundamental).
- ADR-0018 (Extração de CV via IA generativa).
- PRD MVP Portal, USP-043 (Consentimentos LGPD por finalidade), §6.7 (Compliance LGPD).
- LGPD (Lei 13.709/2018), arts. 7º, 8º, 9º, 18.
- CHANGELOG v0.2 — decisão Cenário 1.
