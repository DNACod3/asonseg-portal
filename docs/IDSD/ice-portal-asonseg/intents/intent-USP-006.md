# Intent — USP-006: Ativar papel adicional na Pessoa autenticada

**Origem:** PRD v0.3 §5.2, USP-006.
**Dono do intent:** Sponsor + diretoria (LGPD).

## 1. Descrição

Uma Pessoa já cadastrada e autenticada quer ativar um papel público adicional (candidato passa a também ser prestador; empresa-responsável passa a também ser candidato; etc.). O outcome é o papel novo ativado imediatamente sem etapa de moderação sobre o papel em si (a moderação se aplica ao **conteúdo posteriormente publicado** — vaga, CV, serviço — não ao papel). O sistema pede apenas os campos faltantes para aquela nova função e o consentimento da finalidade correspondente.

Esta USP materializa o princípio do ADR-0011 (papéis compostos) — uma mesma Pessoa pode ser tudo, simultaneamente, e a separação acontece por papel ativo, não por entidades distintas. É também a ponta da finalidade-por-papel do ADR-0013 — ativar candidato sem aceitar o termo da finalidade "candidatura a vagas" é violação silenciosa.

## 2. Restrições

- Apenas campos ainda não preenchidos do papel novo são exigidos (a Pessoa não preenche dados que já existem).
- Ativação imediata do papel — sem moderação do papel em si (ADR-0015).
- Consentimento da finalidade do papel novo precisa ser aceito (ADR-0013) antes do papel virar ativo.
- Auditoria do papel ativado.

## 3. Cenários de fracasso (de resultado)

**F1. Papel ativado sem consentimento da finalidade correspondente persistido.**
Bug na transação faz com que o papel fique ativo mas o consentimento da finalidade não foi persistido (ou foi persistido com finalidade errada). Pessoa começa a usar a função sem base legal documentada.

✅ RESOLVIDO (ADR-0020 / TD §4.3): ativação do papel + persistência do consentimento + `withAudit` ocorrem numa única transação Prisma; e-mail/efeitos via tabela `outbox` despachada pós-commit com retry/idempotência (rollback nunca deixa papel ativo sem consentimento nem gera e-mail órfão).

**F2. Papel ativado por outro Pessoa em nome dela (sequestro de identidade lateral).**
Uma Pessoa autenticada consegue ativar papel em nome de outra Pessoa (por troca de ID na requisição). Outro vetor de takeover indireto.

**F3. Confusão de papéis em fluxo crítico — Pessoa ativa empresa-responsável "sem saber" e passa a publicar vagas em nome de Empresa que ela não pretende representar.**
UX permite ativação de papel empresa-responsável de forma confusa (clica em algo achando que era outra coisa). Pessoa acaba virando responsável de Empresa que não conhece, ou se confundindo no fluxo. Quando combinada com a falta de consentimento bem informado, vira problema LGPD.

✅ RESOLVIDO (dono do intent): o botão "aceitar" habilita somente após o scroll completo do termo; texto claro validado com o público ASONSEG. Impacto técnico: nenhum (camada de UI).

**F4. Termo da finalidade exibido é genérico em vez de específico à finalidade do papel.**
Sistema exibe sempre o mesmo termo (o do cadastro inicial); usuário consente em algo que não cobre a nova finalidade. ADR-0013 fica em letra morta.

## 4. Cenários de sucesso

**Nível operacional:**
- Pessoa autenticada clica em "ativar papel X", vê apenas os campos faltantes, lê o termo específico da finalidade X, aceita, papel ativado.
- Fluxo em ≤ 90 segundos do clique inicial.
- Tela pós-ativação mostra próximo passo do novo papel (publicar primeira vaga, criar primeiro serviço, etc.).

**Nível agregado:**
- MP1 (se papel ativado = candidato), MP2 (empresa-responsável vetor), MP3 (prestador vetor).

## 5. Conexões

**USPs upstream:**
- USP-001 ou USP-002+USP-003 — Pessoa existe e está autenticada.
- USP-043 — consentimento da finalidade nova precisa ser persistido junto.

**USPs downstream:**
- USP-009 (candidato), USP-010 (prestador), USP-011 (cliente, ativado automaticamente em USP-033), USP-012 (empresa-responsável).

**ADRs aplicáveis:**
- ADR-0011 (papéis compostos)
- ADR-0013 (consentimentos por finalidade)
- ADR-0015 (moderação aplica-se ao conteúdo, não ao papel)

**Métricas tocadas:** MP1, MP2, MP3 (entrada lateral).

**Riscos relacionados:** RP-003 (termo da finalidade nova não revisado).

**Dependências:** D-002.

**Q-abertas:** —
