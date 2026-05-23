# ADR-0003: Cadastro nominal de famílias atendidas e implicações LGPD

**Status:** Aceito
**Data:** 2026-05-19
**Decisores:** Sponsor ASONSEG (diretor a designar), Bravi PO
**US/Épicos impactados:** US-012, US-013, US-016, US-017, US-018, US-028, US-031, US-049, US-050, US-057
**Tags:** regra-de-negocio | dados | conformidade

## Contexto

Toda saída de cesta básica ou item não-cesta no MVP é nominalmente vinculada a uma família ou beneficiário individual. O cliente fez a escolha explícita pelo **Modelo 1 — família cadastrada com histórico individual** ao invés de modelos com menor exposição de dados:

- Modelo 2 (cadastro mínimo, sem dado sensível): perderia situação socioeconômica e CPF.
- Modelo 3 (saída agregada, sem identificar família): perderia totalmente a rastreabilidade individual e a capacidade de evitar duplicidade.

O Modelo 1 traz visibilidade longitudinal completa (essencial para prestação de contas e atendimento social) ao custo de armazenar **dados pessoais sensíveis** sob a LGPD (Lei 13.709/2018 — situação socioeconômica de família vulnerável caracteriza dado sensível pelos efeitos discriminatórios potenciais; CPF é dado pessoal forte).

A decisão precisava sair antes da modelagem do cadastro de família (US-013) e antes de qualquer entrega ser implementada, porque define todas as regras de visibilidade e segurança que permeiam o sistema.

## Decisão

Adotamos **Modelo 1 — cadastro nominal completo de beneficiários e famílias**, com as seguintes salvaguardas obrigatórias para mitigar o risco de exposição:

1. **Acesso a dados sensíveis restrito por papel:**
   - **Cadastro e visualização completa** (CPF, telefone, data de nascimento, endereço completo, renda, benefício social, situação de moradia, composição detalhada): apenas **assistente social** e **diretoria**.
   - **Coordenador de área e voluntário comum: não acessam** essas informações.
   - **Voluntário com acesso ao estoque** vê apenas o mínimo necessário para registrar entrega: **nome do responsável + bairro/comunidade + código interno**. Os demais campos ficam ocultos (US-017).

2. **Termo de consentimento obrigatório:**
   - Termo já existe institucionalmente na ASONSEG (sujeito a revisão jurídica — Dependência D-002).
   - Sistema registra a data de assinatura e, opcionalmente, anexa o documento digitalizado.
   - Família sem termo registrado não pode receber entrega (US-057).

3. **Designação de DPO:**
   - Encarregado pelo Tratamento de Dados (LGPD art. 41) a ser designado a um diretor antes do go-live (Dependência D-001).

4. **Direito de acesso (LGPD art. 19):**
   - Atendido **sob demanda**, pela assistente social ou diretoria, via consulta ao sistema — em até 15 dias da solicitação do titular (ver ADR-0008).

5. **Auditoria imutável:**
   - Acesso a dados pessoais sensíveis e alterações em cadastros registram log inalterável (autor, data/hora, ação).

## Alternativas Consideradas

### Alternativa A: Modelo 1 (escolhido) — cadastro completo nominal

Como descrito em §Decisão.

Prós:
- Rastreabilidade longitudinal completa por família e beneficiário.
- Capacidade real de evitar duplicidade e de avaliar a situação social.
- Prestação de contas detalhada para doadores institucionais e editais.
- Atendimento social mais eficaz pela assistente social.

Contras:
- Maior superfície de risco LGPD.
- Esforço adicional de cadastro (mais campos).
- Necessidade de termo de consentimento robusto.
- Auditoria, criptografia e logs ficam não-negociáveis.

**Por que escolhida:** cliente fez a escolha explícita pelo Modelo 1, ciente das implicações. A ASONSEG já tem o termo institucional e cultura de acompanhamento social que sustentam o modelo.

### Alternativa B: Modelo 2 — identificação mínima sem dado sensível

Descrição: cadastrar apenas nome do responsável + identificador interno + bairro, sem CPF, sem renda, sem situação de moradia.

Prós:
- Exposição LGPD muito menor (dado pessoal "leve" apenas).
- Cadastro mais rápido.
- Risco operacional reduzido em vazamento eventual.

Contras:
- Perde-se a possibilidade de avaliação socioeconômica.
- Risco de duplicidade aumenta (sem CPF como chave forte).
- Prestação de contas a doadores institucionais que exigem dados socioeconômicos fica comprometida.

**Por que não escolhida:** cliente quer apoio à decisão social (triagem por prioridade considera renda implicitamente) e capacidade de prestar contas detalhada. Modelo 2 fica limitado demais.

### Alternativa C: Modelo 3 — saída agregada anônima

Descrição: sistema registra apenas "saiu 1 cesta hoje" sem identificar quem recebeu. Famílias não são cadastradas no sistema.

Prós:
- Zero risco LGPD.
- Simplicidade máxima do MVP.

Contras:
- **Não atende** as principais dores identificadas (saber se família X já recebeu cesta no mês, prestar contas individual, evitar duplicidade).
- Perde-se completamente a capacidade de atendimento social.

**Por que não escolhida:** falha grosseira nos requisitos centrais do projeto.

## Consequências

**Positivas:**
- Operação social ganha base de dados estruturada e auditável.
- Prestação de contas vira possível em minutos em vez de dias.
- Modelo respeita LGPD por design (consentimento, minimização de acesso, auditoria).
- Voluntários têm exatamente o mínimo necessário para operar — risco distribuído.

**Negativas / Trade-offs:**
- Necessidade absoluta de termo de consentimento robusto (D-002 é bloqueante de go-live).
- DPO precisa estar designado antes do go-live (D-001 é bloqueante).
- Necessidade de criptografia em repouso para dados sensíveis (delegada ao Arquiteto — ADR-0010).
- Modelo expõe a ASONSEG a obrigações operacionais sob LGPD que antes não existiam formalmente (resposta a titular em 15 dias, manutenção do termo, etc.).
- Risco residual: se vazar, o impacto institucional é alto. Mitigado por segregação de acesso e auditoria.

**Implicações em outras decisões:**
- ADR-0002 (modelo beneficiário/família) deriva desta — cada vínculo é mais um dado pessoal a proteger.
- ADR-0008 (retenção indefinida + direito de acesso sob demanda) materializa a posição LGPD.
- ADR-0010 (custo mínimo) precisa equilibrar com requisitos de segurança aplicacional (criptografia, logs imutáveis) — não é "barato a qualquer custo".

## Referências

- US-012, US-013, US-016, US-017 (cadastro e visibilidade)
- US-057 (termo de consentimento)
- LGPD — Lei 13.709/2018, art. 5º (II — dado sensível), art. 6º (minimização), art. 19 (acesso do titular), art. 41 (DPO)
- §6.7 do PRD (Compliance — LGPD)
- §7 do PRD (Dependências D-001, D-002)
- Sessão de elicitação 2026-05-19, decisão pelo Modelo 1
