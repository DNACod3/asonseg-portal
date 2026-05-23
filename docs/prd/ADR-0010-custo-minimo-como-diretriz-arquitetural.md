# ADR-0010: Custo mínimo como diretriz arquitetural (decisão técnica delegada)

**Status:** Aceito
**Data:** 2026-05-19
**Decisores:** Sponsor ASONSEG (diretor a designar), Bravi PO
**US/Épicos impactados:** todo o escopo do MVP; §3.4 e §6 do PRD
**Tags:** escopo | regra-de-negocio

## Contexto

A ASONSEG é uma organização sem fins lucrativos com recursos limitados. O orçamento aprovado para o MVP é R$ 50.000 (em revisão — escopo levantado é maior). Mesmo após eventual ampliação, o custo total de propriedade do sistema (TCO) **continuará sendo um critério dominante**, não apenas o custo de desenvolvimento inicial.

A ASONSEG **não impôs restrição tecnológica específica** (sem stack mandatório, sem cloud específica, sem certificação obrigatória além de LGPD). A decisão deliberada do cliente foi **delegar a escolha técnica à Bravi** com a diretriz de "ser o mais barato possível dentro do que atende a operação".

O PO da Bravi não toma decisão técnica (arquitetura, stack, cloud, framework) — essas são responsabilidade do **Arquiteto/Tech Lead**. Este ADR registra a **diretriz arquitetural de produto** que orienta a decisão técnica, sem decidir a tecnologia.

## Decisão

A diretriz arquitetural dominante para o MVP é **otimização para custo operacional mínimo**, condicionada a atender os requisitos funcionais e não-funcionais definidos no PRD (em especial: LGPD, auditoria imutável, disponibilidade 99% no horário operacional, ~200 famílias / 1.500 beneficiários / 80 voluntários / centenas de movimentações/mês).

Implicações práticas que orientam o Arquiteto/Tech Lead:

1. **Hospedagem barata por padrão** — preferir provedores e tiers de baixo custo, evitando serviços managed caros quando alternativa equivalente serve.
2. **Stack maduro e gratuito** — preferir frameworks/linguagens open-source com baixa curva de operação.
3. **Infraestrutura enxuta** — evitar microsserviços, mensageria pesada, múltiplas bases — o volume não justifica.
4. **Operação simples** — preferir soluções que minimizem custo recorrente de DevOps/SRE.
5. **Aceitar trade-offs de performance** quando o custo de evitá-los é alto — o volume permite generosidade.

**Restrição absoluta:** custo mínimo **não pode** comprometer requisitos não-funcionais críticos:

- Criptografia em repouso para dados pessoais sensíveis (LGPD).
- Log imutável de auditoria.
- HTTPS em toda comunicação.
- Backup adequado para o porte e a criticidade (perda de cadastro de família = irreparável).
- Conformidade LGPD operacional (resposta a titulares, controle de acesso).

A escolha concreta de stack, cloud, frameworks e arquitetura é **competência do Arquiteto/Tech Lead da Bravi** e será registrada em ADRs técnicos próprios — fora do escopo deste ADR de produto.

## Alternativas Consideradas

### Alternativa A: Custo mínimo como diretriz dominante (escolhida)

Como descrito em §Decisão.

Prós:
- Reflete a realidade orçamentária da ASONSEG.
- Mantém o sistema sustentável a longo prazo (TCO baixo).
- Compatível com porte e maturidade da operação.

Contras:
- Pode levar a soluções menos elegantes ou com mais "manual labor" operacional.
- Performance e escalabilidade futuras podem exigir investimento adicional.

**Por que escolhida:** o cliente fez a escolha explícita e a ASONSEG não tem alternativa financeira no horizonte de planejamento atual.

### Alternativa B: Stack "best of breed" sem restrição de custo

Descrição: escolher tecnologias e provedores priorizando qualidade, manutenibilidade e escalabilidade de longo prazo, mesmo com custo recorrente maior.

Prós:
- Sistema mais robusto e escalável.
- Menor risco de retrabalho em ampliações futuras.
- Operação mais simples a longo prazo.

Contras:
- Custo operacional incompatível com o caixa da ASONSEG.
- Pagar por capacidade que não será usada (volume baixo).

**Por que não escolhida:** desproporcional à realidade financeira da ONG.

### Alternativa C: Stack definida pelo cliente

Descrição: cliente especificaria a stack (linguagem, banco, cloud) e a Bravi implementaria sobre ela.

Prós:
- Garante alinhamento com algum sistema interno pré-existente.
- Cliente tem controle direto sobre infra.

Contras:
- Cliente declarou explicitamente **não ter** restrição tecnológica nem stack preferido.
- Forçar uma escolha sem informação interna é arbitrário.

**Por que não escolhida:** não se aplica — cliente delegou a escolha.

## Consequências

**Positivas:**
- Bravi tem liberdade para arquitetar com foco em custo total de propriedade.
- ASONSEG mantém sustentabilidade operacional do sistema a longo prazo.
- Decisões técnicas concretas ficam com quem tem expertise (Arquiteto/Tech Lead).

**Negativas / Trade-offs:**
- Risco de a decisão técnica final priorizar custo em detrimento de qualidade de execução em algum ponto — Bravi PO deve acompanhar com o Tech Lead e escalar se a relação custo-benefício ficar comprometida em algum RNF.
- Trade-offs operacionais (manutenções fora de horário, ausência de auto-scaling, backup mais espaçado) podem ser aceitos — desde que dentro dos limites do SLA declarado (§6.2).
- Crescimento futuro do volume pode exigir redimensionamento — V2.

**Implicações em outras decisões:**
- ADR-0003 (cadastro nominal + LGPD): custo mínimo **não pode** comprometer criptografia em repouso, log imutável e controle de acesso por papel.
- ADR-0007 (log imutável de auditoria): mantém-se como requisito absoluto.
- Decisões técnicas (banco de dados, cloud, autenticação, frameworks) ficam para ADRs técnicos do Arquiteto.
- Estimativa fina (D-010) deve refletir o uso da diretriz para apresentar cenários realistas à diretoria ASONSEG.

## Referências

- §3.4 do PRD (Restrições — orçamento e tecnológicas)
- §6 do PRD (Requisitos Não-Funcionais)
- ADR-0003 (LGPD), ADR-0007 (auditoria) — restrições absolutas
- Sessão de elicitação 2026-05-19, "não existe restrição, mas é uma ONG e precisa ser o mais barato possível"
