# Intent — USP-028: Empresa buscar candidatos (busca ativa)

**Origem:** PRD v0.3 §5.2, USP-028.
**Dono do intent:** Coordenador da área Portal Empregabilidade.

## 1. Descrição

Pessoa-responsável de uma Empresa, em vez de esperar candidaturas, busca ativamente candidatos no portal aplicando filtros (área de interesse, escolaridade, disponibilidade, localização) e texto livre. Lista mostra resumo do candidato sem dados sensíveis (ADR-0017). Empresa não consegue contato direto — para revelar contato, candidato precisa candidatar-se a uma vaga da Empresa (princípio da reciprocidade). Outcome: Empresa descobre talentos que ainda não candidataram a uma vaga específica e pode "publicar vaga para atraí-los"; candidato continua protegido até decidir candidatar-se.

## 2. Restrições

- Acesso restrito a Pessoa-responsável ativa de Empresa (ADR-0014).
- Lista mostra candidatos com status "ativo" (perfil moderado) (AC-028-1).
- Filtros aplicam-se em conjunto (AC-028-2).
- Cada item mostra apenas: primeiro nome, cidade/região, área de interesse principal, escolaridade, qualificações resumidas (AC-028-3) — ADR-0017 princípio da minimização.
- Sistema **oculta** CPF, contato completo, endereço, CV até candidato candidatar-se a uma vaga da Empresa (AC-028-4, ADR-0017).
- Ordenação padrão: data de cadastro (AC-028-1).

## 3. Cenários de fracasso (de resultado)

**F1. Empresa usa busca como ferramenta de mineração — coleta perfis sem real intenção de contratar.**
Empresa cria conta, publica uma vaga genérica (ou nem isso), e usa a busca de candidatos sistematicamente para mapear talentos da região. Mesmo sem ver contato, dados resumidos (primeiro nome + cidade + área + escolaridade) já são úteis para extração off-system (LinkedIn, etc.). Risco previsto no ADR-0017 ao se decidir pela busca ativa no MVP.

✅ RESOLVIDO (dono do intent): sim — a busca ativa exige pelo menos uma vaga ativa da Empresa (proporcionalidade LGPD da finalidade 2). Impacto técnico: nenhum estrutural — pré-condição na action de busca.

**F2. Resumo das qualificações vaza dados pessoais inesperados.**
"Qualificações resumidas" é texto livre escrito pelo próprio candidato. Pode conter nome completo, idade, endereço, nome de empresa anterior — coisas que ADR-0017 quer ocultar. Sistema "esconde" os campos formais de contato mas o texto livre pode burlar a separação.

✅ RESOLVIDO (ADR-0028): sanitizer automático (regex e-mail/telefone/CPF/RG) nas superfícies de busca + aviso ao autor no preenchimento; moderação humana complementa o sanitizer.

**F3. Sem ordenação por relevância nem paginação inteligente, Empresa não acha quem procura quando a base cresce.**
Mesma F2 do USP-021 análoga: ordenação por "mais recente" não ajuda Empresa que busca skill específica. Empresa frustra-se e abandona a feature.

✅ ACEITO (dono do intent): match exato + filtros são suficientes para o MVP (volume baixo, ADR-0019); relevância semântica fica para V2.

**F4. Candidato vê seu perfil "exposto" para empresas sem ter agido — sentimento de surveillance.**
Princípio ADR-0017 é "reveal após ação afirmativa". Mas o resumo (nome, cidade, área, escolaridade, qualificações) já está visível para qualquer empresa-responsável logada sem ação afirmativa do candidato. Candidato pode achar que "ativou perfil para candidatar-se" e não para "ser buscado".

❓ Consentimento "candidatura a vagas" (finalidade 2 do ADR-0013) cobre explicitamente o aparecimento em busca ativa de empresas? Ou precisa de finalidade separada? (dono do intent — jurídico + DPO) → D-001, D-002

## 4. Cenários de sucesso

**Nível operacional:**
- Empresa busca por "vendas + Londrina + ensino médio" → vê 8 candidatos com dados resumidos.
- Empresa publica vaga atraente para essa região/perfil → candidato vê (USP-021) e candidata-se → contato revelado.

**Nível agregado:**
- Aumenta probabilidade de match — funil de candidatura ativa, não só passiva.

## 5. Conexões

**USPs upstream:** USP-009 (candidatos com perfil ativo), USP-012 (Empresa autenticada).

**USPs downstream:** USP-020/USP-021 (Empresa pode publicar vaga para atrair candidato encontrado), USP-025 (candidato finalmente candidata-se).

**ADRs aplicáveis:** ADR-0014 (acesso por Pessoa-responsável), ADR-0017 (visibilidade conservadora — campos sensíveis ocultos até candidatura).

**Métricas tocadas:** —

**Riscos relacionados:** Risco proposto: mineração de dados de candidatos (registrado na matriz). Risco proposto: texto livre de qualificações vaza PII apesar da matriz de visibilidade.

**Dependências:** D-001, D-002 (consentimento cobrindo busca ativa).

**Q-abertas:** —
