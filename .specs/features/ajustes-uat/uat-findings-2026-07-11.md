# UAT completo de execução — Achados consolidados (2026-07-11)

> Execução autônoma de teste visual e de fluxo sobre build de produção local (Supabase CLI + seed de volume #290),
> cobrindo todos os perfis (anônimo, candidato, empresa/responsável, prestador, cliente, assistente social,
> coordenador, voluntário, diretoria) e todos os fluxos das Fases 1–7, validados contra as specs por USP
> (`.specs/features/**/spec.md`), PRD, ADRs e o protótipo (`docs/prototipo/index.html`).
> 8 testadores independentes + smoke do orquestrador. Evidências (screenshots/SQL) arquivadas no scratchpad da sessão.
>
> **Regra de triagem** (premissas da execução): achado só entra se ancorado em AC/spec/PRD/protótipo ou se for
> defeito objetivo. Itens resolvíveis **sem alterar arquitetura nem premissas técnicas** → **Fase 8** (executável).
> Itens que exigem decisão humana (produto/DPO/reconciliação de specs) → **Fase 9** (não despachável pelo loop).

## O que está SÓLIDO (vereditos OK — amostra)

- Home fiel ao protótipo (hero, seções, CTAs, dark mode, mobile, active-state); PII/anonimização pública impecável
  (cards, JSON-LD, payload Flight); estados PAUSED/EXPIRED/INATIVADA sem vazamento; RBAC de borda e 404 anti-enumeração.
- USP-017 (validação de Empresa na 1ª vaga) ponta a ponta: checklist gate, rejeição com contador, verificação atômica
  com snapshot e auditoria. USP-013/014 vínculos com histórico e bloqueio do último responsável.
- USP-033/034/035 (manifestações) com atomicidade consent+papel+interesse+auditoria+outbox. USP-005 reset de senha
  com uso único. USP-043 painel de consentimentos com histórico append-only e gating de CTA. USP-036/037/038/039
  (ficha/encaminhamento/resultado/visão consolidada) com auditoria completa. USP-042 exports com watermark LGPD,
  checkbox de ciência, RBAC stripped por papel e `REPORT_EXPORTED`.
- FSM de moderação sob concorrência (dupla aprovação → erro de transição, 1 só audit). Anti-enumeração em login,
  recuperação e reivindicação.

## Achados — FASE 8 (corrigíveis sem mudar arquitetura/premissas)

| ID | Sev | Achado (âncora) | Correção mínima | Unidade |
|----|-----|------------------|-----------------|---------|
| ORQ-1 | P0 | Pós-login (e pós-troca de senha) redireciona a `/inicio`, rota inexistente → 404. Spec USP-004 fixa `/inicio` como destino; a página nunca foi criada por nenhuma USP | Criar rota `(app)/inicio` — hub autenticado mínimo, data-driven por papéis ativos da Pessoa (links às áreas já existentes: /candidato, /empresa, /prestador, /moderacao, /encaminhamentos, /relatorios, /consentimentos, /perfil) | USP-049 |
| AUTH-1 | P1 | Pós-aceite do consentimento do cadastro redireciona a `/app/perfil/candidato/novo` e `/app/perfil` (prefixo `/app/` não existe; route group não vira URL) → 404 no fim do fluxo de entrada (USP-001 E-002) | Corrigir `NEXT_STEP_BY_ROLE`/`consentimento/page.tsx` para rotas reais (`/candidato`, `/prestador`, `/perfil`) | USP-049 |
| AUTH-3 | P1→P2 | Não existe logout em nenhuma tela (sessão 12h sem encerramento voluntário; público-alvo usa computador compartilhado). Defeito objetivo de segurança/uso; sem AC contrário | Ação `signOut` + botão "Sair" no hub/perfil | USP-049 |
| AUTH-4/CAND-4/SVC-5 | P2 | `/perfil` é placeholder com texto de dev; titular não vê a própria PII em lugar nenhum | Tela mínima real: dados da Pessoa (View Model do titular) + papéis + links (consentimentos, papéis) | USP-049 |
| PUB-1 | P1 | `RATE_LIMIT_DISABLED=1` vira `false` silencioso (`env.ts` só aceita `'true'`); prefetch RSC consome bucket anônimo 10/min → navegação real recebe 429; resposta 429 de navegação é JSON cru | Parse aceita `true/1` e falha ruidoso em valor desconhecido; excluir prefetch RSC (`Next-Router-Prefetch`/`_rsc` de `<Link>`) da contagem; 429 de documento → página PT-BR com casca | USP-050 |
| PUB-2 | P1 | GET/prefetch de `/cadastro` consome cota `registration` 3/15min → CTA "Cadastrar" vira dead-end por 15min (cota foi dimensionada p/ submissões — TD §8) | Cota `registration` só em mutação (POST/Server Action), não em GET/prefetch | USP-050 |
| SOC-1 | P1 | `/cadastro-assistido` (fluxo interno autenticado da AS) cai no mesmo bucket `registration` (`startsWith('/cadastro')`) | Restringir o matcher ao `/cadastro` público | USP-050 |
| ORQ-2 | P1 | CSP sem `unsafe-eval` quebra hidratação no dev-mode (login inoperante em `npm run dev`) | `'unsafe-eval'` no script-src apenas quando `NODE_ENV=development` | USP-051 |
| ORQ-3 | P1 | LoginForm sem `method`/`action`: submit pré-hidratação faz GET com `?senha=...` na URL (vaza credencial em histórico/logs; reproduzível em rede lenta) | Bloquear fallback GET (method POST inerte/`action` segura ou submit desabilitado até hidratar) — nos forms de credencial | USP-051 |
| EMP-1 | P1 | "Enviar para moderação" com validade vazia: `RangeError: Invalid time value` no client aborta a renderização dos erros → botão parece morto (USP-020 AC2/AC4) | Tratar string vazia antes do parse de data no schema/refine | USP-051 |
| EMP-6 | P3 | Validação de data via tooltip nativo do navegador em inglês (min/max nativos suprimem Zod PT-BR) | `noValidate`/remover atributos nativos; Zod PT-BR assume | USP-051 |
| CAND-5 | P1 | Upload de CV >1MB derruba a página ("Application error") — `serverActions.bodySizeLimit` default 1MB < 5MB do CVE-01; até CV válido 1–5MB falha | `bodySizeLimit: '6mb'` + validação client de tamanho com mensagem PT-BR | USP-051 |
| AUTH-7 | P3 | `/trocar-senha` acessível fora do 1º acesso com texto "Este é seu primeiro acesso" | Texto/confinamento condicional a `primeiroAcesso` | USP-051 |
| CAND-1 | P1 | Salvar cadastro de candidato APAGA campos que o form não exibe (`skills_text`, `courses_text`, `education_area`, `availability` → NULL) — destrói dados confirmados do CV (CVE-04); causa: update com `?? null` | Update omite campos não enviados (ou form os exibe) | USP-052 |
| CAND-2 | P1 | Pós-save UI afirma "perfil em rascunho" com perfil ACTIVE e oferece ação que falha (retorno hardcoded `'DRAFT'` em `activate-candidate-role.ts`) | Retornar/exibir o status real (a questão de produto "editar ACTIVE re-modera?" → Fase 9 H-5) | USP-052 |
| CAND-3 | P2 | `/candidato` nunca carrega o perfil existente (form sempre vazio — edição às cegas, vetor do CAND-1) | Carregar perfil no server component → `defaultValues` | USP-052 |
| CAND-6 | P1 | USP-040 beco sem saída: nenhuma UI concede o termo `CV_AI_EXTRACTION` (CAD-05 manda registrar o consentimento quando houver anexo; termo existe em `legal/consent-terms/`) | Gate de aceite no `CvUploadForm` (padrão LgpdBox + grantConsent já existente) | USP-052 |
| CAND-7 | P1 | Revogar `JOB_APPLICATION` não aplica a cascata declarada em `consents/domain/revocation-cascade.ts` (candidaturas ativas seguem no pipeline do empregador; perfil segue encontrável em busca ativa) | Implementar os `artifactEffects` declarados na própria política do domínio (ENCERRAR+MARCAR candidaturas; OCULTAR da busca), na mesma tx da revogação | USP-053 |
| EMP-2 | P1 | Rascunho de vaga órfão: painel não oferece editar/submeter p/ DRAFT/AWAITING_ADJUSTMENTS (spec USP-023 AC1 manda "editar/submeter"); `submitJobForModeration` já existe | Ligar ações no view/UI; permitir edição de DRAFT reusando o JobForm | USP-054 |
| MOD-3 | P1 | AWAITING_ADJUSTMENTS é beco sem saída p/ autor: motivo da devolução invisível e sem reenvio (E-003 + FSM preveem) | Exibir motivo no painel do autor + ação ajustar/reenviar (transição já declarada na FSM) | USP-054 |
| EMP-3 | P1 | Pausar/arquivar/editar não revalidam cache público (`next-cache-invalidation.ts` só revalida to∈{ACTIVE,INATIVADA}); vaga pausada segue listada; `revalidate=1800` diverge do ISR 10min documentado (ADR-0013/CLAUDE.md) | Revalidar também quando `from === ACTIVE`; alinhar `revalidate` a 600s conforme docs | USP-054 |
| MOD-5 | P2 | "Válida até" exibida com -1 dia (DATE date-only convertido UTC→America/Sao_Paulo) | Formatar DATE sem conversão de fuso | USP-054 |
| MOD-2 | P1 | Pessoa já responsável não cadastra 2ª Empresa: `create-company.ts` cria consent incondicional → unique violation → "erro interno" genérico | Verificar consentimento ativo antes de criar (reusar) | USP-055 |
| EMP-4 | P2 | Form de editar Empresa: radios de Tipo só exibem 2 dos 5 valores do enum `CompanyType` (SA fica sem seleção visível) | Exibir as 5 opções com rótulos PT-BR (enum já estabelecido pela decisão USP-010/MEI) | USP-055 |
| EMP-8 | P3 | "Dados inválidos." genérico p/ CPF mal formatado na busca de responsável | Mensagem Zod específica no campo | USP-055 |
| MOD-1 | P1 | CVs IN_MODERATION nunca aparecem na fila (`moderation-queue.ts` lê CV só do fixture store vazio; E-001 da USP-016 exige CV na fila; adapter por ContentKind é o padrão do container) | Adapter de fila para `CANDIDATE_PROFILE` lendo `candidate_profiles` | USP-056 |
| MOD-6 | P3 | Justificativa "aaaaaaaa…" aceita como significativa (P-003 exige caracteres significativos) | Reforçar heurística (mín. de caracteres distintos/palavras) | USP-056 |
| MOD-7 | P3 | Fila habilita ações de tipos que o voluntário não pode moderar (backend nega certo; atrito) | Desabilitar/ocultar ações por permissão delegada | USP-056 |
| MOD-8 | P3 | Rejeição de sugestão de categoria em 1 clique, sem confirmação nem motivo opcional (spec prevê motivo → `audit.justification`) | Diálogo de confirmação + campo de motivo opcional | USP-056 |
| REL-1/MOD-4 | P1 | E-mails de decisão de moderação (NOT-03/04/05 — ACs 3–5 da spec USP-044 + E-001 das expectations) não implementados; container usa `StubModerationNotification` no-op | Templates + enqueue no outbox dentro da tx de `transitionContent()` (padrão outbox já existente); substituir o stub | USP-057 |
| REL-2 | P2 | Relatório R3 exibe categoria como UUID cru (tela + CSV/PDF) | Join/select do nome da categoria | USP-058 |
| REL-3 | P3 | Enums em inglês nas tabelas/exports (IN_MODERATION, NO_INCOME, OWNED…) | Mapa de rótulos PT-BR na apresentação/CSV | USP-058 |
| REL-5 | P2 | UI dos relatórios só filtra por período; AC-042-1 promete status e categoria (backend já aceita `?status=`/`?categoryId=`) | Selects no form GET do `report-view` | USP-058 |
| PUB-3/SOC-3 | P2 | 404 default do Next em inglês, sem casca (rota inexistente, negações por papel, pós-login) | `app/not-found.tsx` PT-BR com casca pública | USP-059 |
| PUB-4 | P3 | Favicon 404; nenhum `<link rel=icon>` | Favicon (identidade "A" ASONSEG do protótipo) | USP-059 |
| AUTH-2 | P2 | `/termos` e `/privacidade` linkados no cadastro → 404 (âncora LGPD morta; conteúdo final é do jurídico — D-002) | Páginas com casca e aviso "documento em elaboração" PT-BR (sem inventar conteúdo jurídico); conteúdo real segue gated no jurídico | USP-059 |
| AUTH-6/EMP-7 | P3 | Termos de consentimento renderizados como Markdown cru (`# …`, `**…**`) em papeis/consentimentos/cadastro de empresa | Renderizar Markdown no `LgpdBox`/visualizador de termo | USP-059 |
| SOC-4 | P2 | Visão consolidada exibe enum cru "CANDIDATE"/"ATIVO" (mapa `ROLE_LABELS` PT-BR já existe em `pessoas/[id]`) | Reusar rótulos no painel consolidado | USP-059 |
| SOC-6 | P3 | Literal do badge diverge: código "Candidato encaminhado pela ASONSEG" (épico AC-037-5) vs spec USP-037 "Encaminhado pela ASONSEG" | Alinhar a spec ao literal do épico (docs-only) | USP-059 |
| PUB-6/SVC-3 | P3 | Taxonomia de fixtures de int-tests ativa no DB dev ("Busca Int Área", "Centro Int Submit"…) visível em filtros públicos; ~33 "Pessoa-XXXX" no select de /permissoes | Cleanup das fixtures nos int tests (taxonomia/pessoas) + guarda no seed | USP-060 |
| AUTH-8 | P3 | Senha do seed `12345678` viola a política do produto ("ao menos uma letra") | Trocar `FIXED_PASSWORD` do seed p/ valor válido documentado | USP-060 |
| AUTH-9/REL-4 | P2 | Ambiente local sem entrega de e-mail: adapter Resend com key dummy + `CRON_SECRET` ausente (cron 503 fail-closed correto) → nenhum AC de e-mail é verificável visualmente | Adapter `EmailSender` SMTP dev-only (Mailpit) selecionado por env + `CRON_SECRET` no `.env.local`/docs (porta já existe; zero mudança em produção) | USP-060 |

## Achados — FASE 9 (exigem avaliação humana; NÃO despachar pelo loop)

| ID | Achado | Decisão pendente |
|----|--------|------------------|
| H-1 (PUB-5) | Indicador "Vagas ativas" (20) diverge da lista pública (19): contador segue E-001 literal (`status=ACTIVE`), lista aplica gate `company.isVerified` | Dono decide: indicador adota o gate público ou mantém E-001 literal |
| H-2 (PUB-7) | Footer mantém "Publicar Vaga/Cadastrar Empresa (em breve)" enquanto a home linka os mesmos rótulos a rotas reais | Reconciliar A-07 (USP-046) × NAV-04 (USP-048) |
| H-3 (SOC-2, EMP-5) | Área autenticada sem navegação/app-shell e sem busca/lista de Pessoas p/ AS: fluxo do Épico 9 só navegável por UUID/URL direta; USP-049 mitiga com o hub, mas a descoberta de Pessoa (busca por nome/CPF) tem nota de privacidade (ADR-0014) | PO+DPO: escopo e View Model da busca de Pessoas; app-shell logado completo |
| H-4 (AUTH-5) | Header público mostra "Entrar/Cadastrar" para usuário logado (consequência da casca ISR sem sessão — CASCA-MN-01) | Design: header client-side por cookie × manter casca estática |
| H-5 (CAND-2b) | Editar perfil/conteúdo ACTIVE deve rebaixar para re-moderação? Nenhuma spec cobre edição pós-aprovação de CV | PO define a regra (hoje: dado preservado, sem re-moderação) |
| H-6 (SVC-6) | `/perfil/papeis` oferece self-service do papel Cliente; spec USP-011 diz que não deve haver UI de cadastro de cliente (fricção zero) — conflito com USP-006 (papel adicional genérico) | Reconciliar as duas specs (manter ou ocultar Cliente no papeis) |
| H-7 (MOD-9) | Detalhe público de vaga inativada responde 200 "Vaga encerrada" (spec do teste negativo fala null/404; sem vazamento; UX/SEO melhor) | Confirmar comportamento e ajustar spec ou rota |
| H-8 | Divergências seed×roteiro de UAT (apenas 3 coordenadores; sem usuário `primeiroAcesso=true` para testar 1º acesso e2e) | Decidir ampliação do seed de validação |

## Limitações de ambiente registradas (não são bugs de produto)
- Extração de CV via IA: `PROVIDER_ERROR` local (sem chave Anthropic) — fallback CVE-05 validado OK.
- Entrega de e-mail fim-a-fim intestável até USP-060 (adapter dev) — enfileiramento no outbox validado em todos os fluxos.
- Fluxos de corrida (409 concorrentes) cobertos por testes de integração, não por UI.

## Cobertura
Perfis exercitados: anônimo, candidato (05/06/10/11/21/23), cliente (05/10), prestador (05/07), empresa/responsável (05/06/07 + candidato20), assistente social (01), coordenador (01/02/03), voluntário (01), diretoria (01). Fluxos por USP: 001–045 exceto os marcados "não testado" nos relatórios individuais (arquivados no scratchpad da sessão de UAT).
