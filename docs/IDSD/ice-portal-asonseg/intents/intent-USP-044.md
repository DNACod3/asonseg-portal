# Intent — USP-044: Notificações por e-mail em eventos do portal

**Origem:** PRD v0.3 §5.2, USP-044.
**Dono do intent:** Coordenador da área Portal Empregabilidade (operacionaliza a comunicação automática).

## 1. Descrição

Sistema dispara e-mails automaticamente em eventos relevantes do portal: boas-vindas (USP-001), recuperação de senha (USP-005), decisão de moderação (USP-016), confirmação de candidatura (USP-025), manifestação de interesse (USP-033), encaminhamento criado (USP-037), proximidade de expiração de vaga (USP-024), lembrete de CV desatualizado (USP-009 após N dias). Outcome: usuários informados em momentos críticos sem precisar acessar o portal proativamente; engajamento e retorno ao portal incentivados; canal único de notificação no MVP (sem WhatsApp ou push — decisão consciente).

## 2. Restrições

- 8 eventos cobertos (AC-044-1 a AC-044-8).
- N de inatividade para lembrete de CV: default 180 dias, parametrizável pela diretoria (AC-044-8).
- Provedor SMTP definido pelo Arquiteto sob diretriz de custo mínimo (ADR-0010).
- Conteúdo de cada e-mail precisa respeitar visibilidade conservadora (ADR-0017) — não vazar dado pessoal de terceiros no corpo.
- E-mails podem cair em spam — política técnica de autenticação (SPF/DKIM/DMARC) definida pelo Arquiteto.

## 3. Cenários de fracasso (de resultado)

**F1. E-mail cai em spam; usuário perde notificação crítica (ex.: candidatura confirmada, expiração de vaga).**
Risco proposto na matriz. Sem SPF/DKIM/DMARC configurado adequadamente, e-mails da ASONSEG ficam suspeitos. Empresa perde aviso de expiração de vaga (AC-044-7); candidato não recebe confirmação (AC-044-4).

✅ RESOLVIDO (ADR-0019): autenticação de envio via SMTP gerenciado (Resend/SES — SPF/DKIM/DMARC no setup de domínio, Fase 0). Monitoramento de bounce rate / spam complaint **INCLUÍDO no MVP** (decisão PO 2026-05-29): via dashboards/webhooks do provedor + alerta por limiar, complementando o alerta de quota ≥ 80% (TD §8.3).

**F2. Corpo do e-mail vaza dado pessoal de terceiros.**
E-mail "Você foi encaminhada pela ASONSEG para vaga X na Empresa Y" pode conter nome do encaminhador (AS). E-mail de confirmação de candidatura pode conter nome da Empresa. Pessoa encaminha e-mail externamente; dados vazam.

✅ RESOLVIDO parte técnica (ADR-0028): templates de e-mail minimizados (sem PII de terceiros além do necessário; corpo não logado em claro). ❓ Revisão final dos templates pela DPO (Angélica) + designer antes do go-live. (dono do intent — DPO + designer)

**F3. E-mail de evento Y dispara antes do registro do evento Y consolidar — usuário recebe notificação de algo que falhou.**
USP-025 dispara e-mail antes da transação completar; transação falha; e-mail já saiu. Candidato recebe "candidatura confirmada" mas Empresa não vê.

✅ RESOLVIDO (ADR-0020): e-mail enfileirado na tabela `outbox` **dentro da transação** e despachado por worker pós-commit com retry/idempotência; rollback faz a linha de outbox sumir (sem e-mail órfão).

**F4. Usuário não consegue desabilitar e-mails de uma categoria — recebe lembretes sobre CV que não quer atualizar (AC-044-8).**
AC-044-8 manda lembrete de CV desatualizado a cada 180 dias. Pessoa pode achar intrusivo. Sem opção de unsubscribe, vira spam percebido.

✅ RESOLVIDO (dono do intent): sim — opt-out GRANULAR por tipo de e-mail informativo (lembrete de CV, vagas similares, etc.) configurável no perfil; transacionais críticos (confirmação de candidatura, reset de senha) sempre enviados. Coerente com LGPD + boas práticas. Impacto técnico: mínimo (preferências em `persons` + filtro no worker do outbox). (dono do intent — DPO + designer)

**F5. E-mail de recuperação de senha (AC-044-2) pode ser usado em ataque de phishing (link clicável).**
Atacante envia e-mail clone com link malicioso. Usuário não distingue. Reuso da identidade visual da ASONSEG em e-mails legítimos pode treinar o usuário a clicar em qualquer e-mail "da ASONSEG".

✅ RESOLVIDO (ADR-0019 + ADR-0028): SPF/DKIM/DMARC do provedor gerenciado (setup de domínio, Fase 0) + corpo minimizado sem PII de terceiros e nunca logado em claro (ADR-0028) + uso de URL canônica do portal nos links.

**F6. Volume de e-mails cresce inesperadamente e estoura quota do provedor SMTP gratuito (ADR-0010 estressado).**
Free tiers de SMTP têm limites mensais. Volume sobe; e-mails param de ser entregues no fim do mês. Usuários ficam sem notificação justamente quando portal está mais ativo.

✅ RESOLVIDO (ADR-0019 / TD §8.3): alerta de quota SMTP ≥ 80%; plano de upgrade pré-aprovado pela diretoria (operacional). Impacto técnico: nenhum estrutural. (dono do intent — coordenador + Arquiteto)

## 4. Cenários de sucesso

**Nível operacional:**
- Eventos disparados acontecem com latência baixa (segundos) → usuário recebe e-mail relevante → engajamento de retorno ao portal.
- Empresa avisada 3 dias antes da expiração → prorroga vaga sem perder candidatos no funil.
- Candidato recebe lembrete após 180 dias → atualiza CV ou ignora sem fricção.

**Nível agregado:**
- Sem MP direta — instrumento transversal de comunicação.

## 5. Conexões

**USPs upstream:** USP-001 (boas-vindas), USP-005 (recuperação de senha), USP-016 (decisão de moderação), USP-025 (confirmação candidatura), USP-033 (manifestação), USP-037 (encaminhamento), USP-024 (expiração próxima), USP-009 (lembrete de CV desatualizado).

**USPs downstream:** — (canal de saída).

**ADRs aplicáveis:** ADR-0010 (custo do provedor SMTP — escolha técnica).

**Métricas tocadas:** — (transversal).

**Riscos relacionados:** Risco proposto: e-mails caem em spam (mitigado por SPF/DKIM/DMARC). Risco proposto: vazamento de dado pessoal em corpo de e-mail. Risco proposto: quota de SMTP estourada.

**Dependências:** —

**Q-abertas:** —
