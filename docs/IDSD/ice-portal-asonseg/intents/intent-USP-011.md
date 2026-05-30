# Intent — USP-011: Cadastro de cliente de serviço (papel)

**Origem:** PRD v0.3 §5.2, USP-011.
**Dono do intent:** Sponsor + diretoria (LGPD).

## 1. Descrição

Papel cliente é o "mais leve" — ativado automaticamente na primeira manifestação de interesse (USP-033) sem formulário extra. Outcome: qualquer Pessoa autenticada pode ser cliente sem fricção, e a finalidade "contratação de serviço" (finalidade 4 do ADR-0013) é coletada no momento da manifestação.

## 2. Restrições

- Ativação automática sem formulário adicional.
- Consentimento da finalidade 4 obrigatório no momento da ativação (que coincide com a primeira manifestação de USP-033).
- Auditoria do papel ativado (mesmo via automática).

## 3. Cenários de fracasso (de resultado)

**F1. Papel cliente ativo sem consentimento da finalidade 4 persistido por bug de atomicidade.**
A primeira manifestação (USP-033) consegue ocorrer porque o papel foi ativado, mas o consentimento da finalidade 4 não foi persistido. Pessoa começa a contratar serviços sem base legal documentada.

✅ RESOLVIDO parte técnica (ADR-0020 / TD §4.4): ativação do papel cliente + consentimento da finalidade 4 + manifestação rodam numa transação Prisma única (ativação automática dentro de `services.manifestarInteresse`); e-mail via outbox pós-commit. A UX exibe explicitamente o termo da finalidade 4 antes do clique final (scroll-to-accept, igual à USP-006).

**F2. UX do "papel ativado automaticamente" não comunica ao usuário que está aceitando termo.**
Pessoa clica em "entrar em contato com prestador" achando que é um ato simples; sistema ativa o papel cliente e persiste consentimento sem que ela perceba que aceitou um termo. LGPD problemático — consentimento precisa ser informado.

✅ RESOLVIDO (dono do intent): sim — o termo da finalidade 4 é exibido explicitamente antes do clique final de manifestar (scroll-to-accept, igual à USP-006). Impacto técnico: nenhum (UI). A redação do termo permanece com jurídico (D-002).

## 4. Cenários de sucesso

**Nível operacional:**
- Pessoa clica em "entrar em contato com prestador" no detalhe do serviço (USP-031).
- Se ainda não tem papel cliente, sistema mostra termo curto da finalidade 4, pede aceite, ativa papel e prossegue para revelar o contato — fluxo em ≤ 30s sem interrupção real.

**Nível agregado:**
- Vetor de MP7 (manifestações de interesse).

## 5. Conexões

**USPs upstream:**
- USP-001 ou USP-006.
- USP-043 (finalidade 4).

**USPs downstream:**
- USP-033.

**ADRs aplicáveis:** ADR-0011, ADR-0013.

**Métricas tocadas:** MP7 (vetor).

**Riscos relacionados:** RP-003.

**Dependências:** D-002.

**Q-abertas:** —
