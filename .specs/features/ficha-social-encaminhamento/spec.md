# Ficha Social, Encaminhamento e Visão Consolidada Specification

## Problem Statement

A ASONSEG precisa registrar e acompanhar a dimensão social das Pessoas atendidas e
intermediar institucionalmente sua inserção no mercado de trabalho. Hoje não há um
registro estruturado da situação socioeconômica da Pessoa, nem um mecanismo formal
para que a assistente social (AS), coordenadores ou voluntários delegados encaminhem
uma Pessoa para uma vaga em nome da instituição, registrem o resultado desse
encaminhamento e enxerguem, num único painel, toda a relação da Pessoa com a ASONSEG.

A ficha socioeconômica contém **dados pessoais sensíveis** (renda, benefício social,
moradia, composição familiar). Esses dados exigem **criptografia em repouso** e
**acesso restrito** apenas à assistente social e à diretoria, com log de toda
alteração e acesso, em conformidade com a LGPD.

## Goals

- [ ] Permitir que a assistente social cadastre e edite a ficha socioeconômica mínima da Pessoa (renda aproximada, benefício social, situação de moradia, composição familiar declarada).
- [ ] Garantir que dados socioeconômicos sejam tratados como sensíveis: criptografia em repouso, acesso restrito a AS/diretoria e log de alterações.
- [ ] Permitir que AS, coordenador ou voluntário com permissão delegada encaminhe uma Pessoa para uma vaga ativa, ativando o papel candidato automaticamente e gerando candidatura vinculada com badge institucional.
- [ ] Exigir resumo profissional textual quando a Pessoa não possui CV anexo.
- [ ] Permitir o registro manual do resultado do encaminhamento (contratado, não selecionado, em análise, sem resposta).
- [ ] Oferecer à AS e à diretoria uma visão consolidada da Pessoa em painel único, respeitando visibilidade por papel via View Model.

## Out of Scope

| Feature | Reason |
|---|---|
| Entidade Família estruturada (vínculos familiares modelados) | Fora do MVP — Release 2 (ADR-0012). No MVP há apenas composição familiar declarada como texto/número. |
| Triagem / classificação social automatizada da Pessoa | Não faz parte do MVP; ficha é registro declarado mantido manualmente pela AS. |
| Atualização automática do resultado do encaminhamento via integração com a Empresa | Resultado é registrado manualmente quando a AS souber por canal externo (USP-038). |
| Aceite prévio explícito da Pessoa antes do encaminhamento | Encaminhamento institucional usa aceite tácito (SOCIAL_REFERRAL_TO_JOB); Pessoa recebe apenas e-mail informativo. |

## User Stories

### P1: Cadastrar ficha socioeconômica da Pessoa ⭐ MVP

**User Story**: Como assistente social, quero cadastrar dados socioeconômicos da Pessoa (renda aproximada, benefício social recebido, situação de moradia, composição familiar simplificada) para que eu mantenha o registro social mínimo para encaminhamento e acompanhamento.

**Why P1**: Prioridade Must no PRD. É o registro social mínimo que habilita o acompanhamento institucional e dá contexto à decisão de encaminhamento.

**Acceptance Criteria**:
1. QUANDO a assistente social acessa o cadastro social de uma Pessoa ENTÃO o sistema DEVE exibir os campos: renda aproximada, benefício social recebido, situação de moradia e composição familiar declarada (texto/número).
2. QUANDO a assistente social edita a ficha a qualquer momento ENTÃO o sistema DEVE persistir a alteração e registrar log das alterações (incluindo autor e data).
3. QUANDO uma Pessoa sem papel de assistente social ou diretoria tenta acessar os dados sociais ENTÃO o sistema DEVE impedir o acesso.
4. QUANDO a ficha socioeconômica é persistida ENTÃO o sistema DEVE armazená-la com criptografia em repouso por se tratar de dado pessoal sensível.

**Independent Test**: Logado como assistente social, abrir o cadastro social de uma Pessoa, preencher os quatro campos, salvar e reabrir confirmando a persistência e o registro de log; em seguida, logar como voluntário comum e confirmar que o acesso aos dados sociais é negado.

### P1: Encaminhar Pessoa para vaga ⭐ MVP

**User Story**: Como assistente social, coordenador ou voluntário com permissão delegada, quero encaminhar uma Pessoa já cadastrada para uma vaga ativa para que a Empresa receba a recomendação institucional da ASONSEG.

**Why P1**: Prioridade Must no PRD. É a ação central do épico e a fonte da métrica MP8 (encaminhamentos criados).

**Acceptance Criteria**:
1. QUANDO o usuário autorizado submete um encaminhamento com Pessoa e vaga selecionadas ENTÃO o sistema DEVE persistir o encaminhamento.
2. QUANDO a Pessoa não tem papel candidato ativo ENTÃO o sistema DEVE ativar o papel candidato automaticamente, com aceite tácito SOCIAL_REFERRAL_TO_JOB.
3. QUANDO a Pessoa não tem CV anexo ENTÃO o sistema DEVE exigir resumo profissional textual obrigatório como parte do encaminhamento.
4. QUANDO o usuário informa o motivo do encaminhamento ENTÃO o sistema DEVE persistir o motivo como campo opcional.
5. QUANDO o encaminhamento é persistido ENTÃO o sistema DEVE gerar candidatura à vaga vinculada ao encaminhamento, com badge "Candidato encaminhado pela ASONSEG", e enviar e-mail informativo à Pessoa encaminhada.
6. QUANDO o usuário encaminha a mesma Pessoa para vagas diferentes ENTÃO o sistema DEVE permitir múltiplos encaminhamentos.
7. QUANDO a vaga selecionada não está com status "ativo" ENTÃO o sistema DEVE bloquear o encaminhamento.

**Independent Test**: Logado como assistente social, encaminhar uma Pessoa sem CV para uma vaga ativa; confirmar que o sistema exige o resumo profissional, ativa o papel candidato, cria a candidatura com o badge institucional e dispara o e-mail informativo; repetir contra uma vaga inativa e confirmar o bloqueio.

### P1: Registrar resultado do encaminhamento manualmente ⭐ MVP

**User Story**: Como assistente social ou usuário autorizado, quero registrar manualmente o resultado de um encaminhamento (contratado, não selecionado, em análise, sem resposta) quando souber por canal externo para que a ASONSEG acompanhe o impacto institucional do encaminhamento.

**Why P1**: Prioridade Must no PRD. Alimenta a métrica MP9 (% de encaminhamentos com resultado positivo).

**Acceptance Criteria**:
1. QUANDO o usuário autorizado registra o resultado em um encaminhamento ENTÃO o sistema DEVE persistir o resultado, a observação textual e a data do registro.
2. QUANDO o usuário seleciona o resultado ENTÃO o sistema DEVE restringir os valores a HIRED, NOT_SELECTED, UNDER_REVIEW ou NO_RESPONSE (enum ReferralResult).
3. QUANDO o resultado é registrado ENTÃO o sistema DEVE persistir o autor do registro (resultRegisteredBy) e a data (resultRegisteredAt).

**Independent Test**: Logado como usuário autorizado, abrir um encaminhamento existente, selecionar o resultado "contratado" (HIRED) com observação, salvar e reabrir confirmando a persistência do resultado, observação, autor e data.

### P1: Visão consolidada da Pessoa ⭐ MVP

**User Story**: Como assistente social ou diretoria, quero abrir a ficha de uma Pessoa e ver dados pessoais, papéis ativos, ficha socioeconômica, candidaturas ativas e históricas, encaminhamentos, serviços oferecidos, manifestações de interesse e papéis organizacionais na ASONSEG para que eu tenha visão integral da relação da Pessoa com a ASONSEG.

**Why P1**: Prioridade Must no PRD. Consolida todas as dimensões da Pessoa para subsidiar o acompanhamento social e a tomada de decisão.

**Acceptance Criteria**:
1. QUANDO o usuário autorizado abre a ficha consolidada ENTÃO o sistema DEVE exibir todas as dimensões da Pessoa em painel único (dados pessoais, papéis ativos, ficha socioeconômica, candidaturas ativas e históricas, encaminhamentos, serviços oferecidos, manifestações de interesse e papéis organizacionais).
2. QUANDO um voluntário comum tenta acessar a visão consolidada ENTÃO o sistema DEVE negar o acesso.
3. QUANDO um coordenador acessa a visão consolidada ENTÃO o sistema DEVE exibir apenas os dados operacionais relevantes à sua área, respeitando a visibilidade por papel.
4. QUANDO os dados da Pessoa são montados para exibição ENTÃO o sistema DEVE fazê-lo via View Model `viewPersonForSocialAssistant`, controlando a visibilidade dos campos por papel do visualizador.

**Independent Test**: Logado como assistente social, abrir a ficha consolidada de uma Pessoa com encaminhamentos, candidaturas e ficha social e confirmar que todas as dimensões aparecem no painel único; logar como voluntário comum e confirmar negação de acesso; logar como coordenador e confirmar acesso restrito aos dados operacionais da sua área.

## Edge Cases

- QUANDO a Pessoa não possui CV anexo e o resumo profissional não é informado no encaminhamento ENTÃO o sistema DEVE bloquear a submissão e exigir o resumo profissional.
- QUANDO a Pessoa não possui credencial (cadastro sem e-mail/senha feito pela AS) ENTÃO o sistema DEVE permitir que ela seja referenciada em ficha social e encaminhamentos, mas DEVE manter o e-mail informativo do encaminhamento sem efeito quando não houver e-mail.
- QUANDO a vaga muda de status "ativo" para inativo após a seleção mas antes da submissão ENTÃO o sistema DEVE revalidar o status no momento da persistência e bloquear o encaminhamento.
- QUANDO o usuário tenta editar a ficha socioeconômica de uma Pessoa inativa ENTÃO o sistema DEVE preservar o histórico social e manter a restrição de acesso por papel.
- QUANDO a composição familiar é informada ENTÃO o sistema DEVE aceitá-la apenas como texto/número declarado, sem vincular a entidade Família estruturada.
- QUANDO um coordenador tenta acessar a ficha socioeconômica (dado sensível) fora do escopo de AS/diretoria ENTÃO o sistema DEVE omitir esses campos no View Model.

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
|---|---|---|---|
| SOC-01 | USP-036 | Design | Pending |
| SOC-02 | USP-036 | Design | Pending |
| SOC-03 | USP-037 | Design | Pending |
| SOC-04 | USP-037 | Design | Pending |
| SOC-05 | USP-038 | Design | Pending |
| SOC-06 | USP-039 | Design | Pending |

## Success Criteria

- [ ] Assistente social consegue cadastrar, editar e visualizar a ficha socioeconômica, e qualquer Pessoa sem papel AS/diretoria tem o acesso negado, com log de alterações registrado.
- [ ] Dados socioeconômicos armazenados com criptografia em repouso e acesso restrito (LGPD).
- [ ] Encaminhamento ativa o papel candidato automaticamente (aceite tácito SOCIAL_REFERRAL_TO_JOB), cria candidatura vinculada com badge "Candidato encaminhado pela ASONSEG" e dispara e-mail informativo à Pessoa.
- [ ] Encaminhamento exige resumo profissional quando não há CV e é bloqueado quando a vaga não está ativa.
- [ ] Resultado do encaminhamento registrável manualmente entre HIRED / NOT_SELECTED / UNDER_REVIEW / NO_RESPONSE, com observação, autor e data.
- [ ] Visão consolidada da Pessoa disponível via View Model `viewPersonForSocialAssistant` apenas para AS/diretoria, com coordenador limitado a dados operacionais da sua área.
- [ ] MP8 (nº de encaminhamentos ASONSEG criados) mensurável a partir dos encaminhamentos persistidos.
- [ ] MP9 (% de encaminhamentos com resultado registrado positivo — contratado/HIRED) mensurável a partir dos resultados registrados.
