# Intent — USP-003: Reivindicar credencial de Pessoa pré-cadastrada

**Origem:** PRD v0.3 §5.2, USP-003.
**Dono do intent:** Diretoria + AS (definem o processo de verificação).

## 1. Descrição

Uma Pessoa que foi cadastrada pela AS no sistema (USP-002), ou um familiar autorizado, quer ativar uma credencial de acesso (e-mail e senha) para essa Pessoa pré-cadastrada, mediante verificação de identidade conforme processo definido pela ASONSEG. O outcome é uma Pessoa que já existia no sistema sem login passa a ter credencial ativa e pode usar o portal diretamente, sem que isso crie uma nova Pessoa duplicada.

Esta USP é o ponto de junção entre o cadastro institucional (USP-002) e o auto-serviço (USP-001 em diante). É também a USP mais sensível em termos de **risco de sequestro de identidade**: se a verificação for fraca, uma terceira pessoa consegue ativar credencial em nome de outra que está no sistema da ASONSEG.

## 2. Restrições

- Verificação de identidade obrigatória antes da ativação da credencial.
- Processo de verificação definido pela ASONSEG — não é decisão técnica.
  ✅ RESOLVIDO (diretoria / AS — D-011): verificação manual pela AS via canal seguro (telefone/videochamada) antes de confirmar a reivindicação. Impacto técnico: nenhum — processo manual; o sistema mantém iniciar/confirmarReivindicacao com gate de permissão.
- A reivindicação não cria nova Pessoa — vincula credencial à Pessoa que já existe.
- Consentimentos LGPD (USP-043) das finalidades dos papéis ativados precisam ser coletados eletronicamente neste momento (a Pessoa que tinha aceite em papel passa a ter aceite eletrônico).
- Permissão de aprovar reivindicação consta no catálogo do Portal (USP-008): "reivindicação de credencial" (item 9 do catálogo conforme Glossário).
- Auditoria imutável obrigatória (quem solicitou, quem verificou, quando, por qual meio).

## 3. Cenários de fracasso (de resultado)

**F1. Sequestro de identidade por verificação fraca ou contornável.**
O processo de verificação aceitado é insuficiente — terceiro com acesso a informações básicas da Pessoa-alvo (nome, CPF se conhecido, endereço da família) consegue reivindicar credencial e passa a operar como ela no portal. Caso crítico: terceiro reivindica credencial de Pessoa que está sendo encaminhada pela AS para vagas — e começa a se candidatar a tudo, deturpando MP9.

✅ RESOLVIDO (D-011): processo = verificação manual pela AS via canal seguro (tel/vídeo); deixa de ser bloqueante de produção.

**F2. Reivindicação cria nova Pessoa (duplicação) em vez de vincular à existente.**
Bug de matching: a Pessoa pré-cadastrada não é localizada (talvez por exceção de CPF, talvez por digitação diferente do nome), e o sistema cria uma Pessoa nova com a credencial. Resultado: duas Pessoas para a mesma pessoa real — visão consolidada (USP-039) parte ao meio.

**F3. Solicitação de reivindicação fica pendente indefinidamente sem prazo nem follow-up.**
Pessoa solicita, ninguém na ASONSEG vê a fila ou processa. Solicitação envelhece. Pessoa desiste — perde-se a oportunidade de ativar credencial e a Pessoa fica sem acesso eternamente. Sem fluxo de notificação claro, escapa.

✅ RESOLVIDO (dono do intent): notifica AS + coordenador; SLA ≤ 7 dias entre solicitação e ativação.

**F4. Aceite eletrônico de consentimentos da reivindicação não fica vinculado à Pessoa correta.**
A reivindicação aceita os termos, mas o consentimento é gravado em outra Pessoa (a Pessoa "antiga" sem credencial fica sem consentimento eletrônico; a Pessoa "nova" com credencial fica sem histórico anterior). Auditoria LGPD vira inconsistente.

**F5. Verificação aceita por meio não autorizado (ex.: voluntário comum aprova quando só AS deveria).**
Permissão delegada errada, ou bypass por usuário com privilégio inadequado, faz com que reivindicação seja aprovada sem o processo correto.

## 4. Cenários de sucesso

**Nível operacional:**
- Pessoa pré-cadastrada (ou familiar autorizado) solicita reivindicação informando dados identificadores.
- AS/coordenador recebe notificação da solicitação pendente.
- Verificação de identidade acontece pelo meio definido (a definir — D-011/QP-001).
- Após verificação positiva, credencial é ativada — Pessoa loga na próxima tentativa com e-mail e senha definidos.
- Pessoa "antiga" sem credencial e a nova credencial são a **mesma Pessoa** no banco (não duplicação).
- ✅ RESOLVIDO (dono do intent): meta ≤ 7 dias entre solicitação e ativação.

**Nível agregado:**
- Sem métrica MP direta no PRD.
- ✅ RESOLVIDO (dono do intent): métrica = % de pré-cadastradas pela AS que reivindicam credencial em 6 meses.

## 5. Conexões

**USPs upstream:**
- USP-002 — Pessoa precisa ter sido pré-cadastrada pela AS.

**USPs downstream:**
- USP-004 — Pessoa logada com credencial recém-ativada.
- USP-006 — pode ativar papel adicional depois.
- USP-043 — consentimentos eletrônicos das finalidades dos papéis ativados.

**ADRs aplicáveis:**
- ADR-0010 (Custo mínimo — verificação por carta tem custo postal)
- ADR-0011 (Pessoa fundamental — reivindicação não duplica)
- ADR-0017 (Visibilidade conservadora — solicitação pendente é visível só a quem aprova)

**Métricas tocadas:** —

**Riscos relacionados:** Risco proposto: sequestro de identidade. Risco proposto: solicitação pendente indefinida.

**Dependências:** D-011 (meios de verificação).

**Q-abertas:** QP-001.
