# PRD — Sistema de Gestão de Estoque, Distribuição e Vendas
## Release 2 (V2) — Frente 4 (Estoque, Logística e Fitoterápicos)
### Ação Social Nossa Senhora de Guadalupe (ASONSEG)

| Campo | Valor |
|---|---|
| Cliente | ASONSEG |
| Versão | v0.2 — 22/05/2026 |
| Autor | Bravi Software — PO |
| Status | **Reposicionado para Release 2 (V2)** — MVP redefinido para Portal Empregabilidade e Serviços (PRD próprio) |

---

> ## ⚠ AVISO — Mudança de posicionamento (v0.2)
>
> **Decisão da diretoria ASONSEG em 22/05/2026:** o **Portal Empregabilidade e Serviços** passa a ser o MVP do projeto, e a **Frente 4** (este documento) é reposicionada para o **Release 2 (V2)**. Esta decisão se baseia em dois pontos: (i) a gestão de beneficiários e atendimentos já funciona manualmente há um bom tempo e pode continuar assim por um período adicional; (ii) o portal de vagas e serviços ainda não existe e foi identificado como prioridade institucional para iniciar imediatamente.
>
> **Decisão complementar (Cenário 1 — identidade unificada plena):** toda a fundação compartilhada do sistema (Pessoa como entidade fundamental, papéis compostos, autenticação unificada, autorização, consentimentos LGPD por finalidade, auditoria, encaminhamento de beneficiário para vaga e visão consolidada) é modelada **já no MVP do portal**, mesmo que algumas funcionalidades sociais só sejam ativadas no Release 2. Isso reduz drasticamente o custo de evolução para a Frente 4 quando ela for desenvolvida.
>
> **Status dos artefatos atuais:** este PRD permanece válido como referência do escopo da Frente 4 — agora rotulado Release 2. Os ADRs ADR-0001 a ADR-0010 continuam aplicáveis ao Release 2. Adaptações específicas (em especial ADR-0002 sobre modelo de Beneficiário, e ADR-0003 sobre consentimentos LGPD) serão consolidadas em ADRs novos a serem produzidos junto com o PRD do MVP do Portal — onde a refatoração de Beneficiário para papel da Pessoa será formalmente decidida.
>
> **Próximos passos do projeto:** (1) elicitação completa do Portal Empregabilidade e Serviços; (2) produção do PRD do MVP do Portal; (3) estimativa fina pelo Tech Lead da Bravi sobre o novo MVP; (4) decisão de orçamento com a diretoria; (5) execução do Release 1 (Portal); (6) reativação deste PRD para execução do Release 2 (Frente 4).

---

## 1. Visão Geral

### 1.1 Problema de negócio

A operação atual da Frente 4 da ASONSEG (estoque, logística e fitoterápicos) é gerida em papel e em planilhas isoladas, o que causa perdas reais e recorrentes: itens vencidos por falta de controle, doações não rastreadas, dificuldade ou impossibilidade de prestar contas a doadores e à própria comunidade, falta de controle das vendas de fitoterápicos nas capelas (o estoque dos itens produzidos é parcialmente controlado, mas a venda não é), e ausência de visão consolidada do que cada família atendida recebeu ao longo do tempo. Prestar essas informações é, segundo a própria ASONSEG, uma obrigação institucional.

### 1.2 Solução proposta (alto nível)

Sistema web responsivo e PWA, online-only, que digitaliza o ciclo completo da Frente 4: cadastro de beneficiários e famílias, triagem e fila de espera, entrada de doações, controle de estoque por múltiplos locais físicos, distribuição de cestas básicas e de itens não-cesta via indicação social, transferência entre locais, vendas em capelas com forma de pagamento dinheiro ou PIX, fechamento de caixa com conciliação dupla, e relatórios com exportação CSV/PDF cobrindo uso interno, prestação de contas e transparência pública (via republicação manual dos artefatos no site institucional).

### 1.3 Público-alvo

Quatro perfis distintos de usuário do sistema: voluntários (~80 pessoas, operação de campo); coordenadores de área (gestão das frentes, com possibilidade de delegação granular de permissões); assistente social (cadastro de beneficiários/famílias, triagem, indicações de necessidade); diretoria (visão consolidada, prestação de contas, parametrização). Beneficiários (~1.500 cadastrados) e ~200 famílias ativas são o público-alvo institucional, mas não são usuários diretos do sistema. Fiéis das 5 capelas são o público comprador de fitoterápicos e roupas de bazar — também não-usuários do sistema.

### 1.4 Resultado esperado

O MVP deve substituir os controles em papel/planilha, reduzir perdas por vencimento e por falta de controle, dar à diretoria capacidade de prestar contas em curto tempo (minutos em vez de horas/dias), e fornecer rastreabilidade individual completa por beneficiário e família. Métricas detalhadas com baseline e meta na §4.

---

## 2. Personas

### 2.1 Voluntário
- **Perfil:** pessoa da comunidade, não-profissional de TI, atuante em uma ou mais áreas (cesta básica, fitoterápicos, roupas, etc.).
- **Necessidades:** registrar entradas de doação e saídas (cesta, itens não-cesta, vendas) rapidamente, no momento da operação, em dispositivo próprio.
- **Frustrações:** hoje depende de caderno e planilhas; não consegue confirmar facilmente se uma família já recebeu cesta no mês; perde tempo organizando informações depois.
- **Volume estimado:** ~80 voluntários no total da ASONSEG; subconjunto efetivamente operando sistema a ser dimensionado.
- **Acesso:** PWA em celular pessoal + computador da matriz; necessidade de internet (sem requisito offline); login com e-mail e senha individual.

### 2.2 Coordenador de área
- **Perfil:** voluntário sênior responsável por uma frente (cesta básica, fitoterápicos, roupas, etc.); ponto de gestão operacional da área.
- **Necessidades:** cadastrar e gerenciar voluntários da área; delegar permissões administrativas específicas; validar itens pendentes; configurar parâmetros operacionais; corrigir registros incluindo de meses anteriores; gerar relatórios da área.
- **Frustrações:** falta de visão consolidada; dependência de outros voluntários para entender o estado da operação; relatórios manuais demorados.
- **Acesso:** web e PWA; opera principalmente na matriz; gestão de capela aplicável apenas ao coordenador de produção de fito.

### 2.3 Assistente social
- **Perfil:** profissional ou voluntário com formação em serviço social; responsável pelo cadastro, triagem e acompanhamento de beneficiários e famílias.
- **Necessidades:** cadastrar beneficiários e famílias com dados sensíveis; triar; classificar prioridade e tamanho de cesta; criar indicações de necessidade; promover/inativar/reativar famílias; consultar histórico consolidado.
- **Frustrações:** dificuldade de consolidar histórico de atendimento por família; risco de duplicidade entre famílias e beneficiários; falta de visibilidade sobre indicações não atendidas.
- **Acesso:** web em horário comercial estendido; é a única persona com visão completa dos dados sensíveis (LGPD).

### 2.4 Diretoria
- **Perfil:** dirigentes da ASONSEG; responsabilidade institucional, prestação de contas, decisões estratégicas.
- **Necessidades:** visão consolidada do sistema; relatórios de transparência; configuração de parâmetros globais (limite de famílias, locais, categorias); designação de DPO.
- **Frustrações:** incapacidade atual de responder rapidamente a doadores e parceiros; falta de números agregados confiáveis.
- **Acesso:** web; uso esporádico mas de alto valor; também ponto de escalação para conformidade LGPD.

---

## 3. Escopo

### 3.1 In Scope

- Autenticação individual (e-mail/senha), troca de senha no primeiro acesso, recuperação por e-mail.
- Modelo de papéis (voluntário, coordenador, assistente social, diretoria) com delegação granular de permissões administrativas.
- Catálogo de itens com categoria (alimento, remédio, fitoterápico, roupa, higiene, médico-hospitalar) e regra de validade obrigatória por categoria.
- Criação de item "pendente" pelo voluntário durante o registro de entrada, com validação posterior pelo coordenador.
- Múltiplos locais de estoque (matriz – estoque social, matriz – produção de fito, 5 capelas) com transferência entre locais.
- Beneficiário e família como entidades separadas, com vínculo histórico temporal (data início/fim), oito tipos de vínculo, e regras de exclusividade exceto guarda compartilhada.
- Cadastro completo de beneficiário e família (dados pessoais, contato, socioeconômicos, termo de consentimento).
- Visões diferenciadas por papel: voluntário vê apenas nome do responsável e bairro; assistente social/diretoria vê tudo.
- Triagem da assistente social com classificação manual de prioridade (alta/média/baixa) e tamanho de cesta padrão.
- Fila de espera de cesta básica ordenada por prioridade, com capacidade global configurável; promoção manual; reativação volta para a fila.
- Seis tipos de inativação de família com motivo + observação obrigatória.
- Configuração de tamanhos de cesta e composição mensal por tamanho; entrega de cesta baixa estoque automaticamente conforme composição configurada.
- Bloqueio de "1 cesta por mês civil" com possibilidade de override por usuário com permissão delegada, mediante justificativa.
- Indicação de necessidade (categoria + tipo + descrição + validade) como pré-requisito para saída não-cesta; múltiplas ativas com unicidade por (sujeito, categoria, tipo).
- Saída de itens não-cesta livre (sem frequência), exigindo indicação ativa; aviso (não bloqueante) quando categoria do item diverge da categoria da indicação.
- Venda em capelas (fito e roupa em bazar) em registro mínimo: item, quantidade, valor, vendedor, local, forma de pagamento (dinheiro/PIX) e identificação do pagador (PIX).
- Fechamento de caixa flexível por vendedor com conciliação dupla (vendedor declara → coordenador confirma) e tratamento de divergência via pendência resolvida com justificativa.
- Conciliação venda-a-venda dos PIX contra extrato bancário (manual).
- Edição/exclusão de registros com janela mensal: voluntário corrige o próprio dentro do mês civil corrente; coordenador da área e diretoria corrigem qualquer registro em qualquer período, com justificativa.
- Auditoria imutável de todas as alterações (autor, data/hora, valores antes/depois, justificativa).
- 16 relatórios cobrindo estoque, distribuição social, financeiro, gestão e transparência, com exportação CSV/PDF.
- Conformidade LGPD: retenção indefinida com base institucional, registro de termo de consentimento, direito de acesso atendido sob demanda, controle de acesso por papel.
- PWA + web responsivo, online-only; disponibilidade até 21h cobrindo missas vespertinas/noturnas.

### 3.2 Out of Scope

| Fora do escopo desta versão | Por quê |
|---|---|
| Triagem/aprovação de voluntário no sistema | Triagem acontece offline na ASONSEG; sistema apenas registra usuário já aprovado. |
| Captura de doador no registro de doação (nome, identificação, contato) | Nível mínimo de cadastro definido pelo cliente; rastreabilidade institucional do doador fora do escopo do MVP. |
| Valor estimado da doação, foto da nota fiscal, observações na entrada | Nível mínimo de cadastro; avaliação financeira da doação fica fora do MVP. |
| Origem/campanha da doação | Nível mínimo de cadastro. |
| Composição familiar manual obrigatória | Composição derivada automaticamente das datas de nascimento dos vínculos ativos; campo manual existe apenas como fallback. |
| Assinatura/confirmação física do beneficiário na entrega | Registro do voluntário basta; sem assinatura digital ou física. |
| Recibo físico ou digital ao beneficiário ou comprador | Operação atual não emite recibo; MVP mantém prática. |
| Múltiplos itens em uma única venda | Cada item vendido = uma transação; mais simples e compatível com o caderno atual. |
| Desconto e observações na venda | Nível mínimo; sem flexibilização de preço. |
| Cartão de crédito/débito como forma de pagamento | Apenas dinheiro e PIX; meios eletrônicos exigiriam integração de adquirência. |
| Integração técnica com banco para conciliação PIX automática | Aumenta complexidade técnica e custo; conciliação manual venda-a-venda é viável. |
| Upload de extrato bancário para conciliação assistida | Mesma justificativa anterior; candidato a V2 conforme volume. |
| Produção de fitoterápico (controle de matéria-prima, ordens de produção, custo) | Pastoral da Saúde mantém controle paralelo atual; sistema registra apenas entrada do produto final pronto. Ver ADR-0009. |
| Bazar com mecânica de evento próprio (abertura/fechamento, lote, preço promocional) | Bazar usa a mecânica genérica de venda no MVP; eventos com mecânica própria ficam para V2. |
| API de dados públicos para o site institucional | Exposição via CSV/PDF + republicação manual no site é suficiente para o estágio atual. |
| Geração de relatório institucional com template customizado da ASONSEG | Não existe template institucional pré-existente; layout padrão básico cobre o MVP. |
| Dashboard público embutido no site institucional | Acoplamento com a Frente 1 (site) fora do escopo desta Frente 4. |
| Integração ativa com redes sociais (postagem automática) | Publicação manual via cópia/colagem dos números exportados. |
| Portal do beneficiário (login próprio para consulta de dados) | Aumenta complexidade e superfície de segurança; direito de acesso atendido sob demanda. |
| Função "exportar dados deste titular" específica de LGPD | Atendimento manual pela assistente social/diretoria via consulta do sistema. |
| Critérios estruturados de prioridade de família | Atribuição manual livre da assistente social no MVP; estruturação fica para V2. |
| Cálculo automático do tamanho da cesta pela composição familiar | Decisão manual da assistente social na triagem. |
| Promoção automática da fila de espera quando vaga abre | Promoção sempre manual pela assistente social. |
| Limite global variável conforme estoque disponível | Parâmetro configurável simples; sem regra automática vinculada ao estoque. |
| App mobile nativo | PWA + web responsivo cobrem; nativo aumenta custo de manutenção. |
| Modo offline | Operação online-only; ambiente da ASONSEG tem conectividade adequada. |

### 3.3 Premissas

- Volume estimado: ~200 famílias ativas, ~1.500 beneficiários cadastrados, ~80 voluntários, centenas de movimentações de estoque por mês. Validar na Fase 0.
- Termo de consentimento institucional já existe na ASONSEG e cobre as finalidades de tratamento exigidas pelo sistema. Sujeito a revisão por jurídico.
- Voluntários têm celular próprio com câmera e internet, e a matriz tem computador disponível para uso.
- Conectividade na matriz e nas capelas é suficiente para operação online (sem necessidade de modo offline).
- Chave PIX institucional única, com extrato bancário acessível à tesouraria/diretoria para conciliação.
- ASONSEG tem capacidade interna (assistente social ou diretoria) de realizar triagens, encerrar indicações e operar os fluxos administrativos do sistema.

### 3.4 Restrições

- **Tecnológicas:** nenhuma restrição imposta pela ASONSEG. Diretriz arquitetural dominante: *custo operacional mínimo* (organização sem fins lucrativos). Decisão de stack delegada ao Arquiteto/Tech Lead da Bravi. Ver ADR-0010.
- **Regulatórias:** LGPD (Lei 13.709/2018). Dados sensíveis de famílias em situação de vulnerabilidade exigem base legal documentada, controle de acesso por papel, log de auditoria e termo de consentimento registrado.
- **Orçamentárias:** R$ 50.000 inicialmente aprovados pela diretoria, em revisão (modalidade escopo fechado, preço fixo). Escopo levantado neste PRD é maior que essa faixa — ver §13 (Riscos) e a sequência acordada de fatiamento com base na estimativa fina do Tech Lead.
- **De prazo:** "O mais breve possível", sem data dura. Sem evento ou edital com data crítica vinculado ao go-live.

---

## 4. Métricas e Critérios de Sucesso

Metas avaliadas em 6 meses pós go-live. Baselines marcadas como "A definir — Fase 0" entram em §7 como dependência da Fase 0 (medição inicial pela ASONSEG).

| Métrica | Baseline (atual) | Meta (6 meses pós go-live) |
|---|---|---|
| M1 — % de doações registradas no sistema (vs. perdidas/não rastreadas) | A definir — Fase 0 (estimativa atual: < 50%) | > 95% |
| M2 — % de saídas de estoque registradas (cesta + não-cesta + vendas) | A definir — Fase 0 | > 95% |
| M3 — Tempo médio para responder "essa família já recebeu cesta este mês?" | A definir — Fase 0 (estimativa: minutos a horas) | < 30 segundos |
| M4 — Tempo médio para gerar relatório de prestação de contas mensal | A definir — Fase 0 (estimativa: horas a dias) | < 1 hora |
| M5 — % de vendas de fito conciliadas com caixa físico | Próximo de 0% (caderno atual) | > 95% |
| M6 — Divergência média no fechamento de caixa | A definir — Fase 0 | < R$ 5 por fechamento |
| M7 — % de famílias ativas com cadastro completo | A definir — Fase 0 | > 90% |
| M8 — % de indicações de necessidade vencidas sem nenhum atendimento | A definir — Fase 0 | < 10% das criadas |

---

## 5. Requisitos Funcionais

Critérios de aceitação no padrão EARS (Easy Approach to Requirements Syntax) com a partícula normativa SHALL preservada em inglês conforme padrão consagrado. Cada AC é derivável como caso de teste.

### 5.1 Estrutura por épicos

| Épico | User Stories |
|---|---|
| Épico 1 — Identidade, Acesso e Permissões | US-001 a US-007 |
| Épico 2 — Catálogo, Categorias e Locais de Estoque | US-008 a US-011 |
| Épico 3 — Beneficiário e Família | US-012 a US-018 |
| Épico 4 — Triagem e Fila de Espera | US-019 a US-023 |
| Épico 5 — Entrada de Estoque | US-024, US-025 |
| Épico 6 — Composição Mensal de Cesta | US-026, US-027 |
| Épico 7 — Entrega de Cesta Básica | US-028 |
| Épico 8 — Indicação de Necessidade e Entrega Não-Cesta | US-029, US-030, US-031 |
| Épico 9 — Transferência entre Locais | US-032 |
| Épico 10 — Venda e Fechamento de Caixa | US-033 a US-038 |
| Épico 11 — Auditoria e Correções | US-039 a US-041 |
| Épico 12 — Relatórios e Exportação | US-042 a US-056 |
| Épico 13 — Conformidade LGPD | US-057 |

### 5.2 User Stories


#### Épico 1 — Identidade, Acesso e Permissões

##### US-001: Cadastrar voluntário no sistema

*Como* **coordenador de área**, *quero* cadastrar um voluntário previamente triado pela ASONSEG, definindo nome, e-mail, áreas de atuação e papel, *para que* o voluntário possa acessar o sistema com identidade individual e escopo correto.

**Prioridade:** Must

**Critérios de Aceitação (EARS):**

- **AC-001-1:** WHEN o coordenador submete o formulário de cadastro de voluntário com nome, e-mail, papel e ao menos uma área de atuação preenchidos, the system SHALL persistir o usuário e enviar e-mail de boas-vindas com credencial inicial e link para troca de senha.
- **AC-001-2:** IF o e-mail informado já estiver cadastrado, THEN the system SHALL impedir o cadastro e exibir mensagem identificando o conflito.
- **AC-001-3:** IF qualquer campo obrigatório estiver vazio, THEN the system SHALL impedir o submit e destacar visualmente os campos faltantes.
- **AC-001-4:** WHERE o usuário cadastrado é do papel "voluntário", the system SHALL exigir ao menos uma área de atuação selecionada.
- **AC-001-5:** WHEN o cadastro é concluído com sucesso, the system SHALL registrar log de auditoria contendo quem cadastrou, quando, e os atributos atribuídos.

*Notas:* Triagem do voluntário acontece offline na ASONSEG (out-of-scope). Sistema apenas registra usuário já aprovado. Ver ADR-0001.

##### US-002: Autenticar no sistema com e-mail e senha

*Como* **usuário (qualquer papel)**, *quero* fazer login no sistema usando meu e-mail e senha, *para que* eu possa acessar as funcionalidades correspondentes às minhas permissões.

**Prioridade:** Must

**Critérios de Aceitação (EARS):**

- **AC-002-1:** WHEN o usuário submete e-mail e senha corretos, the system SHALL autenticar e redirecionar à tela inicial correspondente ao seu papel em até 2 segundos.
- **AC-002-2:** IF e-mail ou senha estiverem incorretos, THEN the system SHALL exibir mensagem genérica "credenciais inválidas" sem revelar qual dos dois está errado.
- **AC-002-3:** IF o usuário falhar a autenticação 5 vezes consecutivas em 15 minutos, THEN the system SHALL bloquear novas tentativas por 15 minutos e registrar evento de segurança.
- **AC-002-4:** The system SHALL armazenar senhas usando hash bcrypt (ou equivalente reconhecido) com cost factor mínimo recomendado pelo padrão da indústria vigente.
- **AC-002-5:** WHILE o usuário estiver autenticado, the system SHALL encerrar a sessão automaticamente após 12 horas de inatividade.

##### US-003: Trocar senha no primeiro acesso

*Como* **voluntário recém-cadastrado**, *quero* ser obrigado a definir uma nova senha pessoal no primeiro acesso, *para que* a credencial inicial entregue pelo coordenador deixe de ser válida.

**Prioridade:** Must

**Critérios de Aceitação (EARS):**

- **AC-003-1:** WHEN o usuário autentica pela primeira vez com a credencial inicial, the system SHALL redirecioná-lo à tela de troca de senha e bloquear acesso a outras funcionalidades até a troca.
- **AC-003-2:** IF a nova senha não atender ao critério mínimo de segurança (mínimo 8 caracteres, com letras e números), THEN the system SHALL impedir o salvamento e exibir os requisitos.
- **AC-003-3:** WHEN a troca de senha é concluída com sucesso, the system SHALL invalidar a credencial inicial e liberar o acesso normal.

##### US-004: Recuperar senha esquecida

*Como* **usuário**, *quero* solicitar um link de redefinição de senha enviado ao meu e-mail cadastrado, *para que* eu possa recuperar acesso sem depender de intervenção administrativa.

**Prioridade:** Must

**Critérios de Aceitação (EARS):**

- **AC-004-1:** WHEN o usuário solicita recuperação informando um e-mail cadastrado, the system SHALL enviar e-mail contendo link de redefinição válido por 24 horas.
- **AC-004-2:** IF o e-mail informado não estiver cadastrado, THEN the system SHALL exibir mensagem genérica de confirmação de envio sem revelar a inexistência do cadastro.
- **AC-004-3:** WHEN o usuário acessa o link válido e define nova senha, the system SHALL atualizar a senha, invalidar o link e registrar o evento em log.
- **AC-004-4:** IF o link estiver expirado ou já utilizado, THEN the system SHALL exibir mensagem clara e oferecer nova solicitação.

##### US-005: Inativar voluntário desligado

*Como* **coordenador de área**, *quero* marcar um voluntário como inativo, registrando data e motivo, *para que* ele deixe de ter acesso ao sistema sem perda do histórico de operações realizadas.

**Prioridade:** Must

**Critérios de Aceitação (EARS):**

- **AC-005-1:** WHEN o coordenador inativa um voluntário, the system SHALL impedir novos logins desse usuário a partir do momento da inativação.
- **AC-005-2:** WHILE o usuário está inativo, the system SHALL preservar todo o histórico de operações realizadas por ele, mantendo a rastreabilidade.
- **AC-005-3:** IF o coordenador tentar inativar voluntário com tarefas pendentes (ex.: fechamentos abertos), THEN the system SHALL exibir alerta listando as pendências e exigir confirmação explícita.

##### US-006: Configurar permissões delegadas a voluntário

*Como* **coordenador de área**, *quero* conceder ou revogar permissões administrativas específicas a um voluntário da minha área, *para que* eu possa distribuir tarefas operacionais sem promover o voluntário a coordenador.

**Prioridade:** Must

**Critérios de Aceitação (EARS):**

- **AC-006-1:** WHEN o coordenador concede uma permissão delegável a um voluntário, the system SHALL aplicar a permissão imediatamente e registrar log com quem delegou, para quem, qual permissão e quando.
- **AC-006-2:** WHILE o voluntário tem uma permissão delegada ativa, the system SHALL exibir as funcionalidades correspondentes a essa permissão.
- **AC-006-3:** WHEN o coordenador revoga uma permissão delegada, the system SHALL remover o acesso à funcionalidade no próximo carregamento de página e registrar log.
- **AC-006-4:** WHERE o catálogo de permissões delegáveis (ver Glossário) está definido, the system SHALL apresentá-lo como lista finita; permissões fora do catálogo não são delegáveis.

*Notas:* Catálogo inicial em §11 (Glossário). Lista sujeita a revisão na Fase 0. Ver ADR-0001.

##### US-007: Configurar limite global de famílias ativas

*Como* **membro da diretoria ou assistente social**, *quero* ajustar o número máximo de famílias ativas em cesta básica, *para que* o sistema bloqueie a ativação acima da capacidade operacional definida.

**Prioridade:** Must

**Critérios de Aceitação (EARS):**

- **AC-007-1:** WHEN a diretoria ou assistente social altera o limite global, the system SHALL aplicar o novo valor imediatamente e registrar log com valor anterior, novo valor, responsável e data.
- **AC-007-2:** IF o novo limite for menor que o número atual de famílias ativas, THEN the system SHALL aceitar a alteração, mas impedir a ativação de novas famílias até que o número atual fique abaixo do limite.
- **AC-007-3:** IF um usuário sem papel de diretoria ou assistente social tentar alterar o limite, THEN the system SHALL bloquear a operação.


#### Épico 2 — Catálogo, Categorias e Locais de Estoque

##### US-008: Cadastrar categoria de item

*Como* **membro da diretoria**, *quero* cadastrar categorias de item (alimento, remédio, fitoterápico, roupa, higiene, médico-hospitalar) e marcar quais exigem validade obrigatória, *para que* os itens cadastrados sejam classificados consistentemente.

**Prioridade:** Must

**Critérios de Aceitação (EARS):**

- **AC-008-1:** WHEN a diretoria submete uma nova categoria, the system SHALL persistir nome, descrição e flag "exige validade obrigatória".
- **AC-008-2:** IF o nome da categoria já existir, THEN the system SHALL impedir a duplicação.

*Notas:* Lista inicial pré-carregada no sistema: alimento, remédio, fitoterápico, roupa, higiene, médico-hospitalar.

##### US-009: Cadastrar item no catálogo

*Como* **coordenador de área (ou voluntário com permissão delegada)**, *quero* cadastrar um novo item informando nome, categoria e unidade de medida padrão, *para que* o item esteja disponível para registro de entradas, saídas, vendas e transferências.

**Prioridade:** Must

**Critérios de Aceitação (EARS):**

- **AC-009-1:** WHEN o coordenador (ou voluntário delegado) cadastra um item com nome, categoria e unidade de medida, the system SHALL persistir o item com status "ativo".
- **AC-009-2:** IF o nome do item já existir no catálogo (comparação case-insensitive ignorando espaços extras), THEN the system SHALL impedir a duplicação e sugerir o item existente.

##### US-010: Criar item pendente durante registro de entrada

*Como* **voluntário**, *quero* criar um item novo no catálogo quando registro uma entrada de doação de produto ainda não cadastrado, *para que* eu não fique bloqueado esperando o coordenador cadastrar.

**Prioridade:** Must

**Critérios de Aceitação (EARS):**

- **AC-010-1:** WHEN o voluntário registra entrada de doação e o item não consta do catálogo, the system SHALL permitir criar um item novo informando nome, categoria sugerida e unidade.
- **AC-010-2:** WHEN o item é criado nesse contexto, the system SHALL persistir o item com status "pendente" e a entrada da doação como vinculada a esse item.
- **AC-010-3:** WHILE o item está pendente, the system SHALL permitir entradas/saídas, mas exibir indicação visual "pendente de validação" em todas as telas.
- **AC-010-4:** WHEN o coordenador (ou delegado) valida o item pendente, the system SHALL alterar o status para "ativo" e registrar log.
- **AC-010-5:** IF o coordenador identificar duplicidade ao validar (item pendente já existe ativo), THEN the system SHALL permitir mesclar os itens, transferindo histórico do pendente para o ativo.

##### US-011: Cadastrar local de estoque

*Como* **membro da diretoria**, *quero* cadastrar locais de estoque (matriz - estoque social, matriz - estoque da produção, capelas), *para que* todas as movimentações de estoque sejam vinculadas a um local específico.

**Prioridade:** Must

**Critérios de Aceitação (EARS):**

- **AC-011-1:** WHEN a diretoria cadastra um local com nome, tipo (central/satélite) e área(s) suportada(s), the system SHALL persistir o local com status "ativo".
- **AC-011-2:** IF o nome do local já existir, THEN the system SHALL impedir duplicação.
- **AC-011-3:** WHEN um local é inativado, the system SHALL preservar todo o histórico de movimentações e impedir novas entradas/saídas/transferências para esse local.

*Notas:* Locais previstos no MVP: matriz - estoque social, matriz - estoque da produção, capela 1, capela 2, capela 3, capela 4, capela 5. Ver ADR-0004.


#### Épico 3 — Beneficiário e Família

##### US-012: Cadastrar beneficiário

*Como* **assistente social ou diretoria**, *quero* cadastrar um beneficiário com nome completo, CPF, data de nascimento, telefone e registro do termo de consentimento, *para que* ele possa receber atendimentos da ASONSEG com rastreabilidade individual.

**Prioridade:** Must

**Critérios de Aceitação (EARS):**

- **AC-012-1:** WHEN a assistente social submete cadastro com nome, CPF, data de nascimento e data do termo de consentimento, the system SHALL persistir o beneficiário com status "ativo".
- **AC-012-2:** IF o CPF informado já existir cadastrado, THEN the system SHALL impedir a duplicação e abrir o cadastro existente para edição.
- **AC-012-3:** IF o CPF for inválido (dígito verificador incorreto), THEN the system SHALL bloquear o cadastro.
- **AC-012-4:** WHERE há documento de termo digitalizado anexo, the system SHALL armazenar o arquivo (PDF ou imagem) vinculado ao beneficiário com tamanho máximo a ser definido na Fase 0.
- **AC-012-5:** IF o usuário não tem papel de assistente social ou diretoria, THEN the system SHALL impedir o acesso à tela de cadastro de beneficiário.

*Notas:* Termo de consentimento existe na ASONSEG (offline). Sistema apenas registra data e opcionalmente o arquivo digitalizado. Ver ADR-0003 e ADR-0008.

##### US-013: Cadastrar família

*Como* **assistente social ou diretoria**, *quero* cadastrar uma família com responsável (beneficiário maior de idade), endereço, bairro, renda aproximada, benefício social e situação de moradia, *para que* a família passe a existir como unidade de atendimento de cesta básica.

**Prioridade:** Must

**Critérios de Aceitação (EARS):**

- **AC-013-1:** WHEN a assistente social submete o cadastro de família com responsável referenciado, endereço, bairro e dados socioeconômicos preenchidos, the system SHALL persistir a família com status inicial "em triagem".
- **AC-013-2:** IF o beneficiário referenciado como responsável tiver menos de 18 anos na data atual, THEN the system SHALL bloquear o cadastro.
- **AC-013-3:** IF o beneficiário referenciado como responsável já for responsável de outra família ativa, THEN the system SHALL bloquear o cadastro.
- **AC-013-4:** WHEN a família é criada, the system SHALL criar automaticamente o vínculo do responsável com tipo "Responsável" e data início = hoje.

##### US-014: Vincular beneficiário a família

*Como* **assistente social**, *quero* vincular um beneficiário existente a uma família, escolhendo o tipo de vínculo (cônjuge, filho, filho em guarda compartilhada, enteado, pai/mãe dependente, outro parente, agregado), *para que* a composição da família reflita a realidade da residência.

**Prioridade:** Must

**Critérios de Aceitação (EARS):**

- **AC-014-1:** WHEN a assistente social cria o vínculo informando beneficiário, família e tipo, the system SHALL persistir o vínculo com data início = hoje (editável) e data fim nula.
- **AC-014-2:** IF o beneficiário já estiver com vínculo ativo em outra família e o tipo escolhido NÃO for "Filho(a) em guarda compartilhada", THEN the system SHALL bloquear o vínculo e exibir a família ativa atual.
- **AC-014-3:** WHERE o tipo é "Filho(a) em guarda compartilhada", the system SHALL permitir o segundo vínculo ativo simultaneamente.
- **AC-014-4:** IF o tipo escolhido for "Responsável" e a família já tem responsável ativo, THEN the system SHALL bloquear a operação.

*Notas:* Ver ADR-0002 (modelo beneficiário/família com histórico temporal).

##### US-015: Encerrar vínculo de beneficiário com família

*Como* **assistente social**, *quero* encerrar o vínculo de um beneficiário com uma família registrando a data de saída e o motivo, *para que* o histórico da família reflita corretamente a mudança de composição.

**Prioridade:** Must

**Critérios de Aceitação (EARS):**

- **AC-015-1:** WHEN a assistente social encerra um vínculo, the system SHALL persistir a data fim e impedir alterações posteriores nesse vínculo.
- **AC-015-2:** IF o vínculo encerrado for o do responsável, THEN the system SHALL exigir indicação de um novo responsável da família antes de confirmar.
- **AC-015-3:** WHEN um vínculo é encerrado, the system SHALL preservar todo o histórico de atendimentos prestados ao beneficiário enquanto o vínculo esteve ativo.

##### US-016: Consultar beneficiário (visão completa)

*Como* **assistente social ou diretoria**, *quero* consultar o cadastro completo de um beneficiário, incluindo dados sensíveis, vínculos familiares (ativos e históricos) e histórico de atendimentos, *para que* eu possa avaliar a situação social e tomar decisões de atendimento.

**Prioridade:** Must

**Critérios de Aceitação (EARS):**

- **AC-016-1:** WHEN o usuário com papel autorizado abre o cadastro do beneficiário, the system SHALL exibir todos os dados, vínculos atuais e históricos, e histórico completo de atendimentos.
- **AC-016-2:** IF o usuário não tem papel de assistente social ou diretoria, THEN the system SHALL bloquear o acesso à visão completa.

##### US-017: Consultar beneficiário (visão restrita do voluntário)

*Como* **voluntário com acesso ao estoque**, *quero* buscar um beneficiário pelo nome do responsável e ver apenas nome e bairro/comunidade, *para que* eu possa identificar corretamente o destinatário de uma entrega sem acessar dados sensíveis.

**Prioridade:** Must

**Critérios de Aceitação (EARS):**

- **AC-017-1:** WHEN o voluntário consulta um beneficiário pelo nome, the system SHALL retornar apenas: nome do responsável, bairro/comunidade e código interno.
- **AC-017-2:** The system SHALL ocultar do voluntário CPF, telefone, data de nascimento, endereço completo, renda, benefício social, situação de moradia e composição familiar detalhada.

*Notas:* Ver ADR-0003.

##### US-018: Consultar família com histórico consolidado

*Como* **assistente social ou diretoria**, *quero* consultar uma família e ver consolidado: composição atual, composição histórica, cestas recebidas pela família e tudo que cada membro vinculado recebeu individualmente (enquanto vinculado), *para que* eu tenha visão completa do atendimento prestado ao núcleo.

**Prioridade:** Must

**Critérios de Aceitação (EARS):**

- **AC-018-1:** WHEN o usuário consulta uma família, the system SHALL exibir composição atual (vínculos ativos) com classificação por faixa etária derivada das datas de nascimento.
- **AC-018-2:** WHEN o usuário solicita histórico, the system SHALL exibir as cestas recebidas pela família e, para cada membro vinculado, as entregas individuais recebidas no período em que o vínculo esteve ativo.
- **AC-018-3:** WHERE a família tem campo "composição manual de fallback" preenchido e nem todos os membros estão cadastrados, the system SHALL exibir indicação visual diferenciando dado derivado de dado declarado.


#### Épico 4 — Triagem e Fila de Espera

##### US-019: Realizar triagem de família

*Como* **assistente social**, *quero* definir se uma família é habilitada para receber cesta básica, sua prioridade (alta/média/baixa) e o tamanho de cesta padrão, *para que* a família entre ativa ou na fila de espera conforme a capacidade do programa.

**Prioridade:** Must

**Critérios de Aceitação (EARS):**

- **AC-019-1:** WHEN a assistente social conclui a triagem habilitando a família para cesta, prioridade e tamanho, the system SHALL avaliar o número atual de famílias ativas vs. limite configurado.
- **AC-019-2:** WHERE há vaga disponível, the system SHALL alterar o status da família para "ativa".
- **AC-019-3:** WHERE não há vaga disponível, the system SHALL alterar o status da família para "em fila" com a prioridade definida.
- **AC-019-4:** IF a assistente social tenta concluir triagem sem definir tamanho de cesta quando a família foi habilitada para cesta, THEN the system SHALL bloquear o submit.
- **AC-019-5:** WHEN a triagem é concluída, the system SHALL registrar log com responsável pela triagem, data, prioridade e tamanho atribuídos.

##### US-020: Consultar fila de espera de cesta básica

*Como* **assistente social**, *quero* visualizar a fila de espera ordenada por prioridade (alta, média, baixa) e dentro de cada nível por data de entrada na fila, *para que* eu possa decidir quais famílias promover quando houver vaga.

**Prioridade:** Must

**Critérios de Aceitação (EARS):**

- **AC-020-1:** WHEN a assistente social acessa a fila de espera, the system SHALL listar famílias em status "em fila" ordenadas por prioridade decrescente e, dentro da mesma prioridade, por data de entrada na fila.
- **AC-020-2:** The system SHALL exibir, para cada família na fila: nome do responsável, bairro, prioridade, tamanho de cesta definido, data de entrada na fila e tempo de espera.

##### US-021: Promover família da fila para ativa

*Como* **assistente social**, *quero* promover manualmente uma família da fila para ativa, *para que* ela passe a receber cesta básica respeitando a capacidade.

**Prioridade:** Must

**Critérios de Aceitação (EARS):**

- **AC-021-1:** WHEN a assistente social promove uma família, the system SHALL verificar se há vaga disponível conforme o limite global configurado.
- **AC-021-2:** IF não há vaga disponível, THEN the system SHALL bloquear a promoção e exibir o número atual de ativas e o limite configurado.
- **AC-021-3:** WHEN a promoção é confirmada, the system SHALL alterar o status para "ativa" e registrar log com responsável, data e família afetada.

*Notas:* Sem promoção automática quando vaga abre — sempre manual pela assistente social.

##### US-022: Inativar família ativa

*Como* **assistente social**, *quero* inativar uma família registrando o motivo (desligamento voluntário, melhoria de situação, suspensão temporária, exclusão, óbito do responsável) e observação detalhada, *para que* a família deixe de receber cesta e o histórico mantenha o contexto da saída.

**Prioridade:** Must

**Critérios de Aceitação (EARS):**

- **AC-022-1:** WHEN a assistente social submete a inativação com motivo selecionado e observação preenchida, the system SHALL alterar o status para "inativa" e registrar a saída no histórico.
- **AC-022-2:** IF o campo de observação estiver vazio, THEN the system SHALL bloquear o submit.
- **AC-022-3:** WHEN o motivo é "óbito do responsável", the system SHALL exigir designação de novo responsável ou desligamento da família completa.
- **AC-022-4:** WHEN uma família é inativada, the system SHALL liberar uma vaga no contador de famílias ativas.

##### US-023: Reativar família inativa

*Como* **assistente social**, *quero* reativar uma família anteriormente inativada, atribuindo nova prioridade e tamanho de cesta, *para que* ela retorne à fila de espera preservando o histórico anterior.

**Prioridade:** Must

**Critérios de Aceitação (EARS):**

- **AC-023-1:** WHEN a assistente social reativa uma família, the system SHALL alterar o status para "em fila" com a nova prioridade atribuída.
- **AC-023-2:** The system SHALL preservar o histórico completo de atendimentos anterior à inativação.
- **AC-023-3:** WHEN a reativação é concluída, the system SHALL registrar log da operação.

*Notas:* Reativação sempre vai para fila, não direto para ativa. Ver ADR-0002.


#### Épico 5 — Entrada de Estoque

##### US-024: Registrar entrada de doação

*Como* **voluntário**, *quero* registrar a entrada de uma doação informando item, quantidade, validade (quando aplicável), lote (opcional) e local de destino, *para que* o estoque reflita a disponibilidade real do material recebido.

**Prioridade:** Must

**Critérios de Aceitação (EARS):**

- **AC-024-1:** WHEN o voluntário submete a entrada com item, quantidade e local válidos, the system SHALL persistir a movimentação, incrementar o saldo do item no local e registrar data, hora e voluntário responsável automaticamente.
- **AC-024-2:** WHERE a categoria do item exige validade obrigatória, the system SHALL bloquear o submit sem o preenchimento da validade.
- **AC-024-3:** IF a quantidade informada for menor ou igual a zero, THEN the system SHALL bloquear o submit.
- **AC-024-4:** IF o item informado não consta do catálogo, THEN the system SHALL oferecer o fluxo de cadastro de item pendente (ver US-010).
- **AC-024-5:** WHERE o voluntário tem acesso a múltiplas áreas, the system SHALL permitir selecionar o local de destino entre os locais permitidos para essas áreas.

##### US-025: Consultar saldo de estoque

*Como* **qualquer usuário com acesso ao estoque**, *quero* consultar o saldo atual por item, categoria e local, *para que* eu saiba o que está disponível para distribuição, transferência ou venda.

**Prioridade:** Must

**Critérios de Aceitação (EARS):**

- **AC-025-1:** WHEN o usuário acessa a tela de saldo, the system SHALL exibir tabela com item, categoria, local, saldo atual, validade mais próxima (quando aplicável) e indicador de pendência (item pendente de validação).
- **AC-025-2:** The system SHALL permitir filtrar por local, categoria, item e exibir somatório consolidado.
- **AC-025-3:** WHERE o voluntário consulta, the system SHALL restringir a visualização aos locais a que tem acesso.


#### Épico 6 — Composição Mensal de Cesta

##### US-026: Cadastrar tamanhos de cesta

*Como* **coordenador de cesta básica (ou voluntário delegado)**, *quero* cadastrar os tamanhos de cesta disponíveis (ex.: pequena, média, grande), *para que* as composições mensais e os atendimentos possam referenciar esses tamanhos.

**Prioridade:** Must

**Critérios de Aceitação (EARS):**

- **AC-026-1:** WHEN o coordenador cadastra um tamanho com nome e ordem, the system SHALL persistir o registro com status "ativo".
- **AC-026-2:** IF o nome do tamanho já existir, THEN the system SHALL impedir duplicação.

##### US-027: Configurar composição mensal de cesta

*Como* **coordenador de cesta básica (ou voluntário delegado)**, *quero* definir, para cada tamanho de cesta e mês de referência, a lista de itens com quantidades padrão, *para que* as entregas baixem automaticamente os itens corretos do estoque.

**Prioridade:** Must

**Critérios de Aceitação (EARS):**

- **AC-027-1:** WHEN o coordenador submete a composição de um tamanho para um mês, the system SHALL persistir a lista de itens e quantidades, vinculada ao par (tamanho, mês de referência).
- **AC-027-2:** IF já existe composição para o mesmo par (tamanho, mês), THEN the system SHALL permitir substituição com confirmação explícita e registro em log.
- **AC-027-3:** WHEN o mês corrente está iniciado e não há composição configurada para algum tamanho ativo, the system SHALL exibir alerta visível para o coordenador.


#### Épico 7 — Entrega de Cesta Básica

##### US-028: Registrar entrega de cesta básica

*Como* **voluntário**, *quero* registrar a entrega de uma cesta para uma família ativa, selecionando-a, confirmando o tamanho padrão e adicionando itens extras opcionais, *para que* o estoque baixe automaticamente e o histórico da família seja atualizado.

**Prioridade:** Must

**Critérios de Aceitação (EARS):**

- **AC-028-1:** WHEN o voluntário registra uma entrega para uma família ativa, the system SHALL recuperar a composição configurada para o tamanho padrão da família no mês corrente e exibi-la para confirmação.
- **AC-028-2:** WHEN a entrega é confirmada, the system SHALL baixar do estoque do local da entrega cada item da composição com sua quantidade, mais quaisquer itens extras informados.
- **AC-028-3:** IF não há composição configurada para o tamanho/mês corrente, THEN the system SHALL bloquear a entrega e orientar a configuração da composição.
- **AC-028-4:** IF o estoque não tem saldo suficiente para algum item da composição, THEN the system SHALL bloquear a entrega e listar os itens faltantes.
- **AC-028-5:** IF a família já recebeu cesta no mês civil corrente, THEN the system SHALL bloquear a entrega com mensagem identificando a data da última entrega.
- **AC-028-6:** WHERE o usuário tem permissão de "autorizar entrega excepcional de cesta", the system SHALL permitir override mediante justificativa textual obrigatória, marcando o registro como "entrega excepcional".
- **AC-028-7:** IF a família tentar receber cesta mas estiver com status diferente de "ativa", THEN the system SHALL bloquear a entrega.

*Notas:* Frequência: 1 cesta por mês civil. Mês civil considerado timezone América/São_Paulo. Ver ADR-0001 (delegação de override).


#### Épico 8 — Indicação de Necessidade e Entrega Não-Cesta

##### US-029: Registrar indicação de necessidade

*Como* **assistente social**, *quero* registrar uma indicação de necessidade para um beneficiário ou família, com categoria, tipo, descrição textual e data de validade, *para que* voluntários possam realizar entregas vinculadas a essa indicação.

**Prioridade:** Must

**Critérios de Aceitação (EARS):**

- **AC-029-1:** WHEN a assistente social submete a indicação com beneficiário OU família, categoria, tipo, descrição e validade, the system SHALL persistir a indicação com status "ativa".
- **AC-029-2:** IF já existe indicação ativa com o mesmo sujeito, mesma categoria e mesmo tipo, THEN the system SHALL bloquear a criação e exibir a indicação existente.
- **AC-029-3:** WHEN a data de validade é atingida, the system SHALL alterar automaticamente o status da indicação para "vencida".
- **AC-029-4:** IF a data de validade informada for anterior à data de hoje, THEN the system SHALL bloquear o submit.

*Notas:* Tipos: atendimento regular, emergencial, campanha sazonal. Categorias: roupa, fitoterápico, remédio, higiene, médico-hospitalar. Ver ADR-0005.

##### US-030: Encerrar indicação manualmente

*Como* **assistente social, coordenador, diretoria ou voluntário com permissão delegada**, *quero* encerrar uma indicação antes da validade, registrando justificativa, *para que* indicações concluídas não fiquem na lista ativa do voluntário.

**Prioridade:** Must

**Critérios de Aceitação (EARS):**

- **AC-030-1:** WHEN o usuário autorizado encerra a indicação informando justificativa, the system SHALL alterar o status para "encerrada" e registrar log com responsável e justificativa.
- **AC-030-2:** IF a justificativa estiver vazia, THEN the system SHALL bloquear o submit.

##### US-031: Registrar entrega de item não-cesta

*Como* **voluntário**, *quero* registrar a entrega de um item (roupa, fitoterápico, remédio, higiene, médico-hospitalar) para um beneficiário, vinculando a uma indicação ativa, *para que* o estoque baixe corretamente e a entrega seja rastreável.

**Prioridade:** Must

**Critérios de Aceitação (EARS):**

- **AC-031-1:** WHEN o voluntário seleciona um beneficiário com indicação ativa e registra entrega de item, the system SHALL exibir as indicações ativas e permitir escolher a qual a entrega se vincula.
- **AC-031-2:** WHEN a entrega é confirmada, the system SHALL baixar a quantidade do estoque do local de saída e registrar data, hora, voluntário, item, quantidade, indicação vinculada e beneficiário.
- **AC-031-3:** WHERE o item escolhido pertence a categoria diferente da categoria da indicação selecionada, the system SHALL exibir aviso de inconsistência e solicitar confirmação explícita, sem bloquear.
- **AC-031-4:** IF o beneficiário não tem indicação ativa, THEN the system SHALL bloquear o registro e orientar acionar a assistente social.
- **AC-031-5:** IF não há saldo suficiente no estoque, THEN the system SHALL bloquear o submit.


#### Épico 9 — Transferência entre Locais

##### US-032: Transferir estoque entre locais

*Como* **coordenador (ou voluntário delegado)**, *quero* transferir itens entre dois locais (ex.: matriz - produção → capela 1), *para que* o estoque dos pontos de venda seja abastecido a partir da matriz.

**Prioridade:** Must

**Critérios de Aceitação (EARS):**

- **AC-032-1:** WHEN o coordenador submete uma transferência com local origem, local destino, item e quantidade, the system SHALL baixar do estoque origem e creditar no estoque destino atomicamente.
- **AC-032-2:** IF o saldo do item no local origem for insuficiente, THEN the system SHALL bloquear a operação.
- **AC-032-3:** IF origem e destino forem o mesmo local, THEN the system SHALL bloquear a operação.
- **AC-032-4:** WHEN a transferência é concluída, the system SHALL registrar uma movimentação tipo "transferência" referenciada por ID único, com origem, destino, item, quantidade, data, hora e responsável.


#### Épico 10 — Venda e Fechamento de Caixa

##### US-033: Definir preço de venda do item

*Como* **coordenador da produção de fito (ou voluntário delegado para roupa/bazar)**, *quero* cadastrar e atualizar o preço unitário de venda dos itens vendidos nas capelas, *para que* o registro de venda use o preço correto sem digitação manual.

**Prioridade:** Must

**Critérios de Aceitação (EARS):**

- **AC-033-1:** WHEN o coordenador cadastra/atualiza o preço de um item, the system SHALL persistir o preço corrente vinculado ao item.
- **AC-033-2:** The system SHALL preservar o histórico de preços (preço usado em vendas passadas não pode mudar retroativamente).

##### US-034: Registrar venda em capela

*Como* **voluntário vendedor**, *quero* registrar a venda de um item informando quantidade, forma de pagamento (dinheiro ou PIX) e, em PIX, o nome de quem fez a transferência, *para que* as vendas saiam do caderno e o estoque/caixa fique controlado.

**Prioridade:** Must

**Critérios de Aceitação (EARS):**

- **AC-034-1:** WHEN o vendedor submete uma venda com item, quantidade e forma de pagamento, the system SHALL persistir o registro com valor unitário corrente do item, valor total calculado, data/hora, vendedor e local (capela atual) automáticos.
- **AC-034-2:** WHERE a forma de pagamento é PIX, the system SHALL exigir preenchimento do campo "identificação do pagador" (texto livre).
- **AC-034-3:** WHEN a venda é confirmada, the system SHALL baixar a quantidade vendida do saldo do item no local da capela.
- **AC-034-4:** IF o saldo do item no local for insuficiente, THEN the system SHALL bloquear o submit.
- **AC-034-5:** IF o item não tem preço cadastrado, THEN the system SHALL bloquear o submit e orientar acionar o coordenador da produção.

*Notas:* Cada venda = 1 item. Sem múltiplos itens por transação no MVP.

##### US-035: Fechar caixa de vendas (vendedor)

*Como* **voluntário vendedor**, *quero* fechar o caixa das minhas vendas declarando o valor em dinheiro que estou entregando ao coordenador, *para que* haja conferência e prestação de contas dos valores recebidos.

**Prioridade:** Must

**Critérios de Aceitação (EARS):**

- **AC-035-1:** WHEN o vendedor inicia o fechamento, the system SHALL exibir total esperado em dinheiro e total em PIX desde o último fechamento desse vendedor.
- **AC-035-2:** WHEN o vendedor declara o valor em dinheiro e confirma, the system SHALL criar o fechamento com status "entregue, aguardando confirmação".
- **AC-035-3:** IF o valor declarado for diferente do esperado, THEN the system SHALL exigir justificativa textual obrigatória.
- **AC-035-4:** WHILE há um fechamento aberto desse vendedor aguardando confirmação, the system SHALL impedir a abertura de outro fechamento pelo mesmo vendedor.

##### US-036: Confirmar recebimento do caixa (coordenador)

*Como* **coordenador da produção de fito**, *quero* confirmar o recebimento físico do dinheiro entregue pelo vendedor, *para que* o fechamento seja conciliado ou marcado como divergente.

**Prioridade:** Must

**Critérios de Aceitação (EARS):**

- **AC-036-1:** WHEN o coordenador acessa fechamentos pendentes, the system SHALL listar todos com status "entregue, aguardando confirmação" com vendedor, data, valor declarado e total esperado.
- **AC-036-2:** WHEN o coordenador confirma o valor recebido idêntico ao declarado, the system SHALL marcar o fechamento como "conciliado".
- **AC-036-3:** IF o valor confirmado diverge do declarado, THEN the system SHALL exigir justificativa textual e marcar o fechamento como "divergente — aguardando resolução".

##### US-037: Resolver divergência de fechamento de caixa

*Como* **coordenador, diretoria ou voluntário com permissão delegada**, *quero* registrar a resolução de uma divergência de fechamento informando justificativa final, *para que* o fechamento seja finalizado e a auditoria preserve o registro do tratamento.

**Prioridade:** Must

**Critérios de Aceitação (EARS):**

- **AC-037-1:** WHEN o usuário autorizado registra resolução com justificativa preenchida, the system SHALL marcar o fechamento como "conciliado com divergência resolvida" e registrar log.
- **AC-037-2:** IF a justificativa estiver vazia, THEN the system SHALL bloquear o submit.

##### US-038: Conciliar venda PIX com extrato bancário

*Como* **coordenador, diretoria ou voluntário com permissão delegada**, *quero* marcar cada venda PIX como confirmada no extrato bancário ou como divergente, *para que* o controle de recebimentos PIX seja confiável.

**Prioridade:** Must

**Critérios de Aceitação (EARS):**

- **AC-038-1:** WHEN o usuário acessa vendas PIX pendentes de conciliação, the system SHALL listar venda a venda com vendedor, data, valor e identificação do pagador.
- **AC-038-2:** WHEN o usuário marca uma venda como confirmada no extrato, the system SHALL alterar o status da venda para "PIX conciliado" e registrar log.
- **AC-038-3:** WHEN o usuário marca uma venda como divergente, the system SHALL exigir justificativa textual e alterar o status para "PIX divergente — aguardando resolução".


#### Épico 11 — Auditoria e Correções

##### US-039: Editar ou excluir registro próprio dentro do mês corrente

*Como* **voluntário**, *quero* editar ou excluir registros (entradas, saídas, vendas) que eu mesmo criei dentro do mês civil corrente, *para que* eu possa corrigir enganos operacionais sem depender do coordenador.

**Prioridade:** Must

**Critérios de Aceitação (EARS):**

- **AC-039-1:** WHILE a data do registro estiver dentro do mês civil corrente, the system SHALL permitir ao voluntário criador editar ou excluir o próprio registro.
- **AC-039-2:** WHEN a virada do mês civil ocorre (timezone América/São_Paulo), the system SHALL impedir o voluntário de editar/excluir registros do mês anterior.
- **AC-039-3:** WHEN uma edição ou exclusão é realizada, the system SHALL gravar log imutável contendo: registro afetado, valores antes e depois, autor, data/hora.
- **AC-039-4:** WHEN uma exclusão é realizada, the system SHALL marcar o registro como excluído e reverter o efeito da movimentação no estoque/caixa correspondente.

*Notas:* Ver ADR-0007.

##### US-040: Editar ou excluir registros de meses anteriores

*Como* **coordenador da área ou diretoria**, *quero* editar ou excluir registros de qualquer voluntário da minha área (ou geral, para diretoria), inclusive em meses anteriores ao corrente, *para que* erros descobertos retroativamente possam ser corrigidos com supervisão.

**Prioridade:** Must

**Critérios de Aceitação (EARS):**

- **AC-040-1:** WHEN o coordenador edita/exclui um registro da sua área (de qualquer voluntário, de qualquer período), the system SHALL exigir justificativa textual obrigatória.
- **AC-040-2:** The system SHALL gravar log imutável com responsável, data/hora, justificativa e valores antes/depois.
- **AC-040-3:** WHEN a alteração afeta um período já consolidado em relatório, the system SHALL exibir alerta de impacto antes de confirmar.

##### US-041: Consultar log de alterações de registro

*Como* **coordenador ou diretoria**, *quero* consultar o histórico de edições e exclusões de qualquer registro, *para que* eu possa auditar o que foi alterado, por quem e por quê.

**Prioridade:** Must

**Critérios de Aceitação (EARS):**

- **AC-041-1:** WHEN o usuário autorizado acessa o histórico de um registro, the system SHALL exibir todas as alterações em ordem cronológica com autor, data/hora, valores antes/depois e justificativa (quando aplicável).


#### Épico 12 — Relatórios e Exportação

##### US-042: Relatório de saldo de estoque

*Como* **coordenador, diretoria, assistente social**, *quero* consultar e exportar o saldo atual de estoque com filtros por local, categoria e item, *para que* eu tenha visibilidade do estoque para gestão e prestação de contas.

**Prioridade:** Must

**Critérios de Aceitação (EARS):**

- **AC-042-1:** WHEN o usuário aplica filtros e gera o relatório, the system SHALL exibir tabela com local, categoria, item, saldo atual, validade mais próxima e indicador de pendência.
- **AC-042-2:** WHEN o usuário solicita exportação, the system SHALL gerar arquivo CSV ou PDF conforme escolha.

*Notas:* Detalhamento de filtros/agrupamentos a refinar na Fase 0.

##### US-043: Relatório de entradas de doação

*Como* **coordenador, diretoria**, *quero* consultar entradas de doação no período com filtros por categoria, local, item e voluntário, *para que* eu possa demonstrar o que foi arrecadado.

**Prioridade:** Must

**Critérios de Aceitação (EARS):**

- **AC-043-1:** WHEN o usuário gera o relatório, the system SHALL apresentar lista paginada com data, item, quantidade, unidade, validade, lote, voluntário e local.
- **AC-043-2:** WHEN o usuário solicita exportação CSV/PDF, the system SHALL gerar o arquivo correspondente.

*Notas:* Detalhamento de filtros/agrupamentos a refinar na Fase 0.

##### US-044: Relatório de distribuição social

*Como* **coordenador, diretoria, assistente social**, *quero* consultar saídas de distribuição social (cestas + itens não-cesta) com filtros por período, categoria, local e tipo (cesta/não-cesta), *para que* eu possa demonstrar o que foi distribuído e a quem.

**Prioridade:** Must

**Critérios de Aceitação (EARS):**

- **AC-044-1:** WHEN o usuário gera o relatório, the system SHALL apresentar lista com data, tipo de saída, beneficiário/família, item, quantidade, voluntário e local.
- **AC-044-2:** WHEN o usuário solicita exportação CSV/PDF, the system SHALL gerar o arquivo correspondente.
- **AC-044-3:** WHERE o usuário consultando não tem papel de assistente social/diretoria, the system SHALL ocultar dados sensíveis do beneficiário/família (exibir apenas nome do responsável e bairro).

*Notas:* Detalhamento de filtros/agrupamentos a refinar na Fase 0.

##### US-045: Relatório de vendas

*Como* **coordenador da produção, diretoria**, *quero* consultar vendas por capela, vendedor, período, forma de pagamento, categoria e item, *para que* eu tenha visibilidade do faturamento das capelas.

**Prioridade:** Must

**Critérios de Aceitação (EARS):**

- **AC-045-1:** WHEN o usuário gera o relatório, the system SHALL apresentar lista com data, capela, vendedor, item, quantidade, valor unitário, valor total, forma de pagamento e identificação do pagador (PIX).
- **AC-045-2:** WHEN o usuário solicita exportação CSV/PDF, the system SHALL gerar o arquivo correspondente.

*Notas:* Detalhamento de filtros/agrupamentos a refinar na Fase 0.

##### US-046: Relatório de transferências entre locais

*Como* **coordenador, diretoria**, *quero* consultar transferências entre locais com filtros por período, local origem, local destino e item, *para que* eu acompanhe o abastecimento dos pontos satélites.

**Prioridade:** Should

**Critérios de Aceitação (EARS):**

- **AC-046-1:** WHEN o usuário gera o relatório, the system SHALL apresentar lista com data, origem, destino, item, quantidade e responsável.
- **AC-046-2:** WHEN o usuário solicita exportação CSV/PDF, the system SHALL gerar o arquivo correspondente.

##### US-047: Relatório de itens próximos do vencimento

*Como* **coordenador, voluntário**, *quero* consultar itens com validade dentro de uma janela configurável (ex.: próximos 30 dias), *para que* eu possa priorizar a distribuição de itens próximos do vencimento e reduzir perdas.

**Prioridade:** Must

**Critérios de Aceitação (EARS):**

- **AC-047-1:** WHEN o usuário acessa o relatório, the system SHALL listar itens com validade igual ou anterior à data corrente + janela configurada, exibindo item, local, lote (quando houver), validade e quantidade.
- **AC-047-2:** WHEN o usuário solicita exportação CSV/PDF, the system SHALL gerar o arquivo correspondente.

##### US-048: Relatório de itens pendentes de validação

*Como* **coordenador**, *quero* consultar itens com status "pendente" criados por voluntários durante registro de entrada, *para que* eu possa validar/padronizar o catálogo periodicamente.

**Prioridade:** Must

**Critérios de Aceitação (EARS):**

- **AC-048-1:** WHEN o coordenador acessa o relatório, the system SHALL listar itens pendentes com data de criação, voluntário criador, categoria sugerida e número de movimentações já vinculadas.

##### US-049: Relatório de famílias por status

*Como* **assistente social, diretoria**, *quero* consultar famílias filtradas por status (ativa, em fila, inativa), *para que* eu tenha visão de capacidade e demanda.

**Prioridade:** Must

**Critérios de Aceitação (EARS):**

- **AC-049-1:** WHEN o usuário gera o relatório, the system SHALL apresentar lista de famílias com nome do responsável, bairro, tamanho de cesta, prioridade (se em fila), data de entrada/saída do status atual e composição derivada.
- **AC-049-2:** WHEN o usuário solicita exportação CSV/PDF, the system SHALL gerar o arquivo correspondente.

##### US-050: Relatório de histórico de atendimento por família

*Como* **assistente social, diretoria**, *quero* consultar o histórico consolidado de uma família — cestas recebidas pela família + entregas individuais de cada membro vinculado durante o período de vínculo, *para que* eu tenha visão integral do atendimento prestado.

**Prioridade:** Must

**Critérios de Aceitação (EARS):**

- **AC-050-1:** WHEN o usuário acessa o histórico, the system SHALL apresentar timeline cronológica de cestas recebidas e entregas individuais dos membros vinculados respeitando o período de vínculo.
- **AC-050-2:** WHEN o usuário solicita exportação CSV/PDF, the system SHALL gerar o arquivo correspondente.

##### US-051: Relatório de histórico de atendimento por beneficiário

*Como* **assistente social, diretoria**, *quero* consultar tudo que um beneficiário recebeu individualmente, *para que* eu acompanhe o atendimento prestado à pessoa.

**Prioridade:** Must

**Critérios de Aceitação (EARS):**

- **AC-051-1:** WHEN o usuário acessa o histórico, the system SHALL apresentar timeline de entregas individuais com data, item, quantidade, indicação vinculada e voluntário responsável.

##### US-052: Relatório de indicações de necessidade

*Como* **assistente social, diretoria**, *quero* consultar indicações por status (ativa, vencida, encerrada), categoria, tipo e período, *para que* eu acompanhe a gestão de indicações.

**Prioridade:** Must

**Critérios de Aceitação (EARS):**

- **AC-052-1:** WHEN o usuário gera o relatório, the system SHALL listar indicações com sujeito (beneficiário/família), categoria, tipo, descrição, validade, status e número de entregas vinculadas.

##### US-053: Relatório de indicações vencidas sem entrega

*Como* **assistente social, diretoria**, *quero* consultar indicações que venceram sem nenhuma entrega vinculada, *para que* eu identifique necessidades não atendidas.

**Prioridade:** Should

**Critérios de Aceitação (EARS):**

- **AC-053-1:** WHEN o usuário acessa o relatório, the system SHALL listar indicações com status "vencida" e zero entregas vinculadas, com sujeito, descrição, categoria, tipo e data de vencimento.

##### US-054: Relatório de fechamentos de caixa por status

*Como* **coordenador da produção, diretoria**, *quero* consultar fechamentos de caixa por status (aberto, entregue, conciliado, divergente), *para que* eu acompanhe a prestação de contas das capelas.

**Prioridade:** Must

**Critérios de Aceitação (EARS):**

- **AC-054-1:** WHEN o usuário gera o relatório, the system SHALL listar fechamentos com vendedor, data, capela, valor declarado, valor confirmado, status e tempo desde a abertura.

##### US-055: Relatório de conciliação PIX

*Como* **coordenador da produção, diretoria**, *quero* consultar vendas PIX pendentes de conciliação no extrato, *para que* eu possa concluir a conciliação periodicamente.

**Prioridade:** Must

**Critérios de Aceitação (EARS):**

- **AC-055-1:** WHEN o usuário acessa o relatório, the system SHALL listar vendas PIX com status "pendente de conciliação" ou "PIX divergente", com data, valor, identificação do pagador e vendedor.

##### US-056: Indicadores agregados de transparência

*Como* **diretoria**, *quero* consultar indicadores agregados (total de cestas distribuídas, total de famílias atendidas, total de pessoas, total arrecadado, total distribuído) por mês, trimestre e ano, *para que* eu tenha dados para prestação de contas institucional e publicação no site.

**Prioridade:** Must

**Critérios de Aceitação (EARS):**

- **AC-056-1:** WHEN o usuário acessa o painel de indicadores, the system SHALL exibir os totais para os períodos solicitados.
- **AC-056-2:** WHEN o usuário solicita exportação CSV/PDF, the system SHALL gerar o arquivo correspondente.

*Notas:* Detalhamento dos indicadores a refinar na Fase 0.


#### Épico 13 — Conformidade LGPD

##### US-057: Registrar termo de consentimento do beneficiário

*Como* **assistente social**, *quero* registrar a data do termo de consentimento assinado pelo beneficiário (ou responsável legal, se menor) e opcionalmente anexar o documento digitalizado, *para que* o sistema documente a base legal do tratamento de dados pessoais.

**Prioridade:** Must

**Critérios de Aceitação (EARS):**

- **AC-057-1:** WHEN a assistente social informa data do termo (e opcionalmente arquivo), the system SHALL persistir essa informação vinculada ao beneficiário.
- **AC-057-2:** WHERE a data do termo não está informada, the system SHALL bloquear o cadastro de novas entregas para o beneficiário.

*Notas:* Ver ADR-0008.

---

## 6. Requisitos Não-Funcionais

### 6.1 Performance
- Tempo de resposta de operações interativas (login, registro de movimentação, consulta simples) ≤ 2 segundos no p95, considerando volume estimado da ASONSEG.
- Geração de relatórios com exportação CSV ≤ 10 segundos no p95 para janelas mensais; PDFs ≤ 20 segundos no p95.

### 6.2 Disponibilidade
- Disponibilidade alvo de 99% no horário operacional (8h às 21h, todos os dias, timezone América/São_Paulo).
- Janela de manutenção: 21h às 8h do dia seguinte, com aviso prévio quando aplicável.
- Sem requisito 24/7; operação fora do horário operacional é tolerada.

### 6.3 Segurança
- Autenticação por e-mail e senha individual com bloqueio temporário após 5 tentativas inválidas em 15 minutos.
- Senhas armazenadas com hash bcrypt (ou equivalente atual) com cost factor mínimo recomendado pelo padrão da indústria vigente.
- Autorização por papel + permissões delegáveis (catálogo finito definido no Glossário §11).
- Comunicação cliente-servidor sempre via TLS (HTTPS).
- Criptografia em repouso para dados pessoais sensíveis (CPF, dados socioeconômicos, termo digitalizado) conforme decisão arquitetural posterior.
- Log imutável de auditoria para: autenticação, alteração de permissão, edição/exclusão de registro, mudança de status de família/beneficiário/indicação, resolução de divergência, configuração de parâmetro global.

### 6.4 Escalabilidade
- Volume estimado V1: 200 famílias ativas, 1.500 beneficiários, 80 voluntários, centenas de movimentações/mês — volume baixo do ponto de vista técnico; arquitetura padrão atende.
- Sem expectativa de crescimento abrupto nos primeiros 12 meses.

### 6.5 Acessibilidade
- Conformidade WCAG 2.1 nível AA como diretriz. Critérios específicos a serem priorizados na implementação pelo time de design.
- Interface PWA otimizada para celular Android e iOS recentes.

### 6.6 Observabilidade
- Logs estruturados de eventos críticos (autenticação, operação de estoque, fechamento de caixa, conciliação, edição/exclusão de registro).
- Monitoramento de erros (frontend e backend) com alerta a um canal definido na Fase 0.

### 6.7 Compliance — LGPD
- Base legal: consentimento documentado (termo registrado por beneficiário ou responsável legal) e legítimo interesse institucional para histórico de prestação de contas.
- Retenção indefinida de dados pessoais com finalidade de histórico institucional (ver ADR-0008).
- Direito de acesso (art. 19 LGPD) atendido sob demanda pela assistente social/diretoria via consulta ao sistema, em até 15 dias da solicitação.
- Encarregado pelo Tratamento de Dados (DPO) — papel a ser designado a um diretor antes do go-live (ver §7 Dependências).

### 6.8 Localização
- Idioma: português brasileiro.
- Fuso horário: América/São_Paulo (UTC-3 sem horário de verão).
- Formato monetário: BRL (R$); formato de data: DD/MM/AAAA.

---

## 7. Dependências

| Dependência | Status | Owner | Observações |
|---|---|---|---|
| D-001 — Designação formal do DPO (Encarregado LGPD) | A iniciar | Diretoria ASONSEG | Bloqueante para go-live. Deve ser um diretor. |
| D-002 — Revisão jurídica do termo de consentimento atual | A iniciar | Diretoria ASONSEG + jurídico | Confirmar cobertura de retenção indefinida e finalidade institucional. Bloqueante para go-live. |
| D-003 — Designação do sponsor/ponto de contato pelo projeto | A definir | Diretoria ASONSEG | Um diretor com agenda disponível. Bloqueante para kickoff. |
| D-004 — Medição inicial das baselines de M1 a M8 | A iniciar | Bravi PO + coordenação ASONSEG | Necessário durante Fase 0 para validar metas. |
| D-005 — Refinamento dos filtros e agrupamentos de cada relatório | A iniciar | Bravi PO + diretoria ASONSEG | Itera durante sprints; estrutura mínima viável é o que entra no MVP. |
| D-006 — Revisão final da lista de permissões delegáveis | A iniciar | Bravi PO + coordenadores ASONSEG | Lista inicial em §11 (Glossário). Refinar na Fase 0. |
| D-007 — Definição do default de validade de indicação (30/60/90 dias) | A definir | Assistente social ASONSEG | Não bloqueante. Pode ser definido na Fase 0. |
| D-008 — Definição do tamanho máximo de arquivo (termo digitalizado) | A definir | Bravi Arquiteto | Decisão técnica a ser tomada no detalhamento de arquitetura. |
| D-009 — Chave PIX institucional única e acesso ao extrato bancário | Pressuposto | Diretoria/tesouraria ASONSEG | Pré-requisito operacional do fluxo de venda PIX. |
| D-010 — Estimativa fina do Tech Lead com cenários de orçamento | A iniciar | Bravi Tech Lead | Pré-requisito para decisão de fatiamento e nova rodada com diretoria ASONSEG sobre orçamento. |

---

## 8. Equipe e Modelo de Entrega

### 8.1 Modelo de contratação

Modalidade contratada: escopo fechado, preço fixo (R$ 50.000 inicialmente aprovado, em revisão). O modelo Squad as a Service padrão da Bravi não se aplica diretamente neste projeto, mas a composição de squad abaixo é a referência para a estimativa fina.

### 8.2 Composição da squad (referência para estimativa)

| Papel | Alocação | Responsabilidade principal |
|---|---|---|
| Tech Lead / Arquiteto | A definir | Decisão arquitetural, code review, integração com cliente técnico, estimativa fina. |
| Desenvolvedor Pleno | A definir | Implementação de features. |
| Desenvolvedor Pleno | A definir | Implementação de features. |
| QA | A definir | Plano de teste, automação básica, exploratório. |
| UI/UX Designer | A definir | Telas críticas (registro de venda, entrega, triagem). |
| Bravi PO | A definir | Refinamento, validação com cliente, gestão de backlog. |
| DevOps | A definir | Configuração de infra mínima, CI/CD básico, observabilidade. |

Alocações reais serão definidas pelo Tech Lead na estimativa fina, considerando a diretriz de custo mínimo (§3.4).

### 8.3 Ritmo e cerimônias (proposta inicial)
- Sprints de 2 semanas.
- Daily interna da Bravi (15 min).
- Refinamento semanal de backlog com PO.
- Review com cliente a cada sprint (1h).
- Retro interna a cada sprint.

### 8.4 Critérios de Pronto (DoD)
- Código revisado por outro desenvolvedor (code review).
- Testes automatizados de fluxo crítico cobrindo os ACs principais da US.
- Deploy validado em ambiente de homologação.
- Aprovação do PO da Bravi (e do sponsor da ASONSEG quando aplicável) antes de marcar como pronto.
- Log de auditoria validado quando a US envolve operação rastreável.

---

## 9. Backlog Priorizado (MoSCoW)

Índice por bucket. Detalhe e prioridade individual no metadado da US (§5.2).

- **Must Have:** US-001, US-002, US-003, US-004, US-005, US-006, US-007, US-008, US-009, US-010, US-011, US-012, US-013, US-014, US-015, US-016, US-017, US-018, US-019, US-020, US-021, US-022, US-023, US-024, US-025, US-026, US-027, US-028, US-029, US-030, US-031, US-032, US-033, US-034, US-035, US-036, US-037, US-038, US-039, US-040, US-041, US-042, US-043, US-044, US-045, US-047, US-048, US-049, US-050, US-051, US-052, US-054, US-055, US-056, US-057
- **Should Have:** US-046, US-053
- **Could Have:** —
- **Won't Have (este release):** —

> **Observação importante:** a priorização atual considera o escopo levantado integralmente, sem fatiar. A maior parte das US está classificada como Must porque sustenta o ciclo operacional ponta-a-ponta. O fatiamento real do MVP em função do orçamento aprovado será feito após a estimativa fina do Tech Lead, gerando ADR específico de escopo do MVP fatiado.

---

## 10. Decisões Registradas

Cada ADR em arquivo próprio dentro de `decisions/`.

- ADR-0001 — Modelo de permissões com delegação granular (papel + permissões delegáveis adicionais)
- ADR-0002 — Beneficiário e família como entidades separadas com vínculo histórico temporal
- ADR-0003 — Cadastro nominal de famílias atendidas e implicações LGPD (Modelo 1)
- ADR-0004 — Múltiplos locais de estoque como conceito estrutural do sistema
- ADR-0005 — Indicação de necessidade como pré-requisito para saída não-cesta (modelo aberto com unicidade por categoria + tipo)
- ADR-0006 — Estoque único de fitoterápico com classificação de saída (doação vs venda)
- ADR-0007 — Edição/exclusão de registros com janela mensal e escalação para coordenador
- ADR-0008 — Retenção indefinida de dados pessoais e direito de acesso sob demanda
- ADR-0009 — Produção de fitoterápico fora do escopo do MVP
- ADR-0010 — Restrição de custo como diretriz arquitetural (decisão técnica delegada ao Arquiteto/Tech Lead)

---

## 11. Glossário do Domínio

| Termo | Definição |
|---|---|
| Área | Unidade organizacional da ASONSEG operada por um coordenador (ex.: cesta básica, fitoterápicos, roupas). Voluntário tem acesso a uma ou mais áreas. |
| Beneficiário | Pessoa individual cadastrada na ASONSEG, recebedora de atendimentos. Identificada por CPF. Pode estar vinculada a uma família (ou mais, em caso de guarda compartilhada). |
| Capela | Unidade física vinculada à igreja parceira da ASONSEG; ponto de venda de fitoterápicos (e bazar de roupa) ao fim das missas. 5 capelas no MVP. |
| Categoria de item | Natureza física do item: alimento, remédio, fitoterápico, roupa, higiene, médico-hospitalar. |
| Cesta básica | Conjunto de itens definido por composição mensal por tamanho. Entregue à família via responsável; 1 cesta por mês civil por família, com possibilidade de override autorizado. |
| Composição mensal de cesta | Configuração que define, para cada tamanho de cesta e mês de referência, a lista de itens e quantidades padrão. Mantida pelo coordenador de cesta básica. |
| Conciliação PIX | Operação venda-a-venda de marcar uma venda PIX como confirmada (ou divergente) no extrato bancário. |
| DPO (Encarregado pelo Tratamento de Dados) | Papel exigido pela LGPD (art. 41). Designado a um diretor da ASONSEG antes do go-live. |
| Entrega excepcional | Entrega de cesta a uma família que já recebeu no mês civil corrente, autorizada por usuário com permissão delegada para override, com justificativa textual obrigatória. |
| Família | Agrupamento de beneficiários com um responsável (beneficiário maior de idade, único). Endereço, bairro e dados socioeconômicos pertencem à família. Recebe cesta básica. |
| Fechamento de caixa | Operação iniciada pelo vendedor para entregar o dinheiro físico das vendas. Confere conciliação dupla com o coordenador. Pode gerar pendência de resolução em caso de divergência. |
| Fila de espera | Conjunto de famílias em status "em fila" ordenadas por prioridade (alta > média > baixa) e, dentro do mesmo nível, por data de entrada na fila. |
| Indicação de necessidade | Autorização emitida pela assistente social para um beneficiário/família receber itens não-cesta. Tem categoria, tipo, descrição textual e validade. Múltiplas ativas com unicidade por (sujeito, categoria, tipo). |
| Item pendente | Item criado por voluntário durante registro de entrada que aguarda validação do coordenador. Operável (permite movimentação) com indicação visual de pendência. |
| Local de estoque | Ponto físico de armazenagem com saldo próprio. Locais previstos: matriz – estoque social, matriz – produção de fito, capela 1 a 5. |
| Mês civil | Mês calendário em timezone América/São_Paulo. Usado para regra de "1 cesta por mês" e janela de edição/exclusão pelo voluntário. |
| Permissão delegável | Permissão administrativa que o coordenador pode conceder a voluntários da sua área individualmente. Catálogo finito no MVP: (1) cadastrar voluntário na área; (2) configurar composição mensal de cestas; (3) validar/aprovar item pendente; (4) configurar parâmetros operacionais da área; (5) inativar/excluir entrada de estoque incorreta; (6) gerar relatórios da área; (7) autorizar entrega excepcional de cesta; (8) encerrar indicação de necessidade; (9) resolver divergência de fechamento de caixa; (10) conciliar PIX com extrato bancário. |
| Prioridade da família | Classificação manual (alta, média, baixa) atribuída pela assistente social na triagem. Sem critério estruturado no MVP. |
| Produtor (de fitoterápico) | Voluntário da Pastoral da Saúde que produz, embala e precifica fitoterápicos. Tem acesso ao estoque "matriz – produção de fito". Produção em si é fora do escopo do MVP — apenas a entrada do produto pronto é registrada. |
| Responsável da família | Beneficiário maior de idade, único responsável pela família. Recebe a cesta básica. Não pode ser responsável de mais de uma família simultaneamente. |
| Status da família | Cadastrada / em triagem / em fila / ativa / inativa / desligada. |
| Status da indicação | Ativa / vencida / encerrada. |
| Tamanho de cesta | Configuração que define um perfil de cesta (ex.: pequena, média, grande). Cada tamanho tem composição mensal própria. A família tem tamanho padrão definido pela assistente social na triagem. |
| Tipo de inativação de família | Desligamento voluntário / desligamento por melhoria de situação / suspensão temporária / exclusão / óbito do responsável. |
| Tipo de indicação | Atendimento regular / emergencial / campanha sazonal. |
| Tipo de vínculo (beneficiário ↔ família) | Responsável / cônjuge ou companheiro(a) / filho(a) / filho(a) em guarda compartilhada / enteado(a) / pai ou mãe (idoso dependente) / outro parente / agregado. |
| Transferência entre locais | Movimentação atômica que baixa do estoque origem e credita no estoque destino. Usada para abastecer capelas a partir da matriz. |
| Vendedor (em capela) | Voluntário da Pastoral da Saúde que opera vendas em uma ou mais capelas. Faz fechamento de caixa para entregar o dinheiro ao coordenador da produção. |
| Vínculo beneficiário ↔ família | Relação N:N com data de início, data de fim (nula se ativo) e tipo. Permite reconstruir composição histórica. |

---

## 12. Perguntas em Aberto

| ID | Pergunta | Owner (cliente) | Prazo | Impacto se não respondida |
|---|---|---|---|---|
| Q-001 | Tipos de indicação são lista fixa ou configurável pela diretoria? | Diretoria ASONSEG | Fase 0 | Default proposto: lista fixa no MVP. Configurável vira candidato a V2. |
| Q-002 | Default de validade sugerido para nova indicação (30, 60 ou 90 dias)? | Assistente social ASONSEG | Fase 0 | Não bloqueia geração do PRD. |
| Q-003 | Catálogo final de permissões delegáveis | Coordenadores ASONSEG | Fase 0 | Lista inicial no Glossário, sujeita a revisão. |
| Q-004 | Detalhamento de filtros e agrupamentos por relatório (16 relatórios) | Bravi PO + diretoria ASONSEG | Sprints iniciais | MVP entrega estrutura mínima viável; refinamento iterativo. |
| Q-005 | Tamanho máximo de arquivo permitido para upload de termo digitalizado | Bravi Arquiteto | Fase 0 | Decisão técnica. |
| Q-006 | Encerramento de indicação por qualquer coordenador ou só o coordenador da área da categoria? | Diretoria ASONSEG + assistente social | Fase 0 | Default proposto: qualquer coordenador (mais flexível). |
| Q-007 | Confirmação se override de cesta também aparece em fluxo de "entrega excepcional" pela assistente social, ou se essa permissão é apenas do coordenador e voluntários delegados | Bravi PO + ASONSEG | Sprints iniciais | Não bloqueia geração do PRD. |
| Q-008 | Política de retenção de logs de auditoria (não dados pessoais — apenas logs operacionais) | Diretoria ASONSEG + Bravi Arquiteto | Pré go-live | Decisão técnica + compliance. |

---

## 13. Riscos de Negócio

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| R-001 — Escopo levantado é maior que orçamento aprovado (R$ 50k) | Alta | Alto | Estimativa fina do Tech Lead em sequência; nova rodada de orçamento com diretoria ASONSEG (Rota B já em andamento); ADR de fatiamento do MVP em função do valor aprovado. |
| R-002 — Sponsor não designado a tempo do kickoff | Média | Alto | Dependência D-003 marcada como bloqueante; aguardar designação antes de iniciar squad. |
| R-003 — DPO não designado a tempo do go-live | Média | Alto | Dependência D-001 marcada como bloqueante de go-live; acompanhamento próximo pelo Bravi PO. |
| R-004 — Termo de consentimento atual da ASONSEG não cobre as finalidades exigidas | Média | Alto | Dependência D-002; revisão jurídica em paralelo ao desenvolvimento. |
| R-005 — Voluntários têm baixa adesão ao registro no sistema (manter prática do caderno) | Média | Médio | UX simples e rápida em campo; treinamento e apoio dos coordenadores; medição em M1/M2 e ajuste reativo. |
| R-006 — Volume real superior ao estimado | Baixa | Médio | Validar na Fase 0 com amostragem; arquitetura escolhida deve permitir escalar verticalmente sem reescrita. |
| R-007 — Indicação "livre" gera entregas mal direcionadas | Média | Médio | Modelo escolhido conscientemente pela ASONSEG (ADR-0005); monitorar M8 e revisitar em V2 se necessário. |
| R-008 — Edição de registro em mês corrente pelo voluntário gera manipulação indevida | Baixa | Médio | Log imutável de alteração; relatórios pós-virada de mês imutáveis; alertas para coordenador em casos de alta frequência de edição. |
| R-009 — PIX informado livre (texto) dificulta conciliação em volume alto | Baixa | Médio | Volume baixo na ASONSEG; revisar em V2 se ficar gargalo. |

---

## Anexo A — Histórico de mudanças

Histórico mantido em `CHANGELOG.md` no repositório do projeto. Este PRD reflete sempre o estado atual; mudanças entre versões consultáveis no CHANGELOG.
