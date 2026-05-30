# ADR-0008: Retenção indefinida de dados pessoais e direito de acesso sob demanda

**Status:** Aceito (com alertas registrados)
**Data:** 2026-05-19
**Decisores:** Sponsor ASONSEG (diretor a designar), Bravi PO
**US/Épicos impactados:** US-012, US-013, US-016, US-057; §6.7 do PRD
**Tags:** conformidade | dados

## Contexto

A ASONSEG presta contas institucionalmente sobre o atendimento prestado a beneficiários e famílias ao longo do tempo. Histórico de atendimento (cestas, itens não-cesta, indicações) é relevante para:

- Editais e parceiros institucionais que avaliam impacto longitudinal.
- Mensuração da efetividade do trabalho social.
- Continuidade de atendimento (beneficiário que volta após anos).

Sob a LGPD (Lei 13.709/2018), há duas obrigações que conflitam parcialmente com retenção indefinida:

- **Art. 15 e 16** — dados pessoais devem ser eliminados após o término do tratamento, com exceções (obrigação legal, exercício regular de direitos, transferência a terceiro, anonimização para uso exclusivo do controlador).
- **Art. 19** — titular tem direito de obter seus dados em formato simplificado ou completo, em até 15 dias.

Para o MVP, três pontos precisavam ser decididos:

1. Por quanto tempo o sistema retém dados após desligamento/inativação?
2. Como o sistema atende ao direito de acesso do titular?
3. Quem é o DPO/Encarregado pelo Tratamento de Dados?

## Decisão

**Sobre retenção (ponto 1):** adotamos **retenção indefinida** de dados pessoais e do histórico de atendimento, ancorada na **finalidade de histórico institucional e prestação de contas longitudinal**. Famílias e beneficiários desligados continuam consultáveis no sistema.

A base legal será **declarada de forma explícita no termo de consentimento atual da ASONSEG**, condicionada à revisão jurídica (Dependência D-002). Se o termo atual ainda não menciona explicitamente essa finalidade e retenção indefinida, a ASONSEG deve revisar antes do go-live.

**Sobre direito de acesso (ponto 2):** atendimento **sob demanda, manual, fora do sistema** — assistente social ou diretoria, ao receber a solicitação do titular, gera o relatório consultando o sistema e entrega em até 15 dias. **Não há função "exportar dados deste titular" específica no MVP** (out-of-scope §3.2).

**Sobre DPO (ponto 3):** o papel de **Encarregado pelo Tratamento de Dados (LGPD art. 41)** deve ser designado a **um diretor da ASONSEG antes do go-live**. Hoje não há DPO formal. Registrado como Dependência **D-001** bloqueante.

## Alternativas Consideradas

### Sobre retenção

#### Alternativa A: Retenção indefinida (escolhida)

Como descrito em §Decisão.

Prós:
- Histórico institucional preservado para sempre.
- Mantém continuidade do atendimento (beneficiário pode voltar anos depois e o histórico ajuda).
- Compatível com prática institucional declarada de ONG madura.

Contras:
- Pode ser questionada sob LGPD se a finalidade não estiver bem documentada no termo.
- Aumenta o volume armazenado ao longo dos anos.
- Risco residual de vazamento aumenta com o tempo de retenção.

**Por que escolhida:** cliente fez a escolha consciente; finalidade institucional é defensável se documentada no termo.

#### Alternativa B: Retenção por prazo definido (ex.: 5 anos após desligamento)

Descrição: após N anos do desligamento, anonimizar os dados pessoais e manter apenas dados agregados.

Prós:
- Alinhamento mais conservador com o princípio LGPD da retenção limitada à finalidade.
- Reduz o volume de dados pessoais sob risco ao longo do tempo.

Contras:
- Perda de histórico nominal para casos de retorno ao programa.
- Exige processo automatizado de anonimização (custo de desenvolvimento).
- Limita a profundidade de relatórios longitudinais.

**Por que não escolhida:** cliente quer preservar histórico nominal sempre.

#### Alternativa C: Retenção indefinida com exclusão sob solicitação

Descrição: retenção indefinida como default, mas titular pode solicitar exclusão (direito de eliminação) a qualquer momento.

Prós:
- Combina preservação institucional com respeito à autodeterminação do titular.

Contras:
- Exige fluxo de exclusão suportado pelo sistema (out-of-scope §3.2).
- Exclusão de família ativa quebra integridade de relatórios passados.

**Por que não escolhida no MVP:** complexidade adicional. Direito de eliminação pode ser atendido sob demanda, fora do sistema (anonimizando o registro manualmente sob solicitação justificada). Avaliar evolução em V2.

### Sobre direito de acesso

#### Alternativa A: Sob demanda, manual (escolhida)

Como descrito em §Decisão.

Prós:
- Zero custo de desenvolvimento.
- Volume baixo de solicitações esperado para ONG do porte da ASONSEG.

Contras:
- Depende de disciplina operacional para atender em 15 dias.
- Não escala se o volume crescer muito.

**Por que escolhida:** equilíbrio razoável para o MVP. Risco operacional registrado.

#### Alternativa B: Função "exportar dados deste titular" no sistema

Descrição: tela onde assistente social/diretoria seleciona um beneficiário e exporta PDF com todos os dados e histórico.

Prós:
- Atendimento padronizado e mais rápido.
- Auditável.

Contras:
- Custo de desenvolvimento extra.

**Por que não escolhida no MVP:** ficou em out-of-scope; pode ser construída em V2 se volume justificar.

#### Alternativa C: Portal do beneficiário (login próprio para consulta)

Descrição: beneficiário logaria no sistema e consultaria seus próprios dados.

Prós:
- Forma mais ativa de exercer o direito de acesso.

Contras:
- Custo alto de desenvolvimento e operação.
- Superfície de segurança ampliada.
- Volume de uso real baixo.

**Por que não escolhida:** desproporcional ao porte e maturidade. Out-of-scope §3.2.

## Consequências

**Positivas:**
- Histórico institucional preservado para prestação de contas longitudinal.
- Modelo de retenção alinhado com a prática operacional declarada.
- Direito de acesso atendido sem custo extra de desenvolvimento.
- DPO formalmente designado dá maturidade institucional para LGPD.

**Negativas / Trade-offs:**
- Termo de consentimento atual da ASONSEG **precisa ser revisado** para incluir explicitamente a finalidade de "histórico institucional com retenção indefinida". Bloqueante de go-live (D-002).
- Sem função no sistema para o direito de acesso, depende de disciplina operacional para o prazo de 15 dias.
- Volume armazenado cresce ao longo dos anos — Q-008 (Perguntas em Aberto) trata logs operacionais; dados pessoais ficam.
- Risco residual de vazamento cresce com o tempo de retenção — mitigado por criptografia em repouso, controle de acesso por papel, log de auditoria (§6.3 e §6.7 do PRD).

**Implicações em outras decisões:**
- ADR-0003 (cadastro nominal): conjunto de salvaguardas (acesso por papel, termo, auditoria) ganha relevância ainda maior pela retenção indefinida.
- Dependências D-001 (DPO) e D-002 (termo jurídico) são bloqueantes de go-live.
- US-057 (registro de termo) materializa o controle de termo.

## Referências

- US-012, US-013, US-016, US-057
- §6.7 do PRD (Compliance — LGPD)
- §7 do PRD (Dependências D-001, D-002)
- LGPD — Lei 13.709/2018, arts. 15, 16, 19, 41
- Sessão de elicitação 2026-05-19, respostas (a)/(a) para retenção e direito de acesso
