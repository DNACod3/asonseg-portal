# Intent — USP-041: Home pública com indicadores em tempo real

**Origem:** PRD v0.3 §5.2, USP-041.
**Dono do intent:** Diretoria (decide indicadores publicáveis) + Coordenador da área Portal Empregabilidade (operacionaliza).

## 1. Descrição

Visitante anônimo acessa a home do portal e vê: total de vagas ativas, total de candidatos ativos, total de Empresas verificadas. Outcome: visitante percebe que o portal tem atividade real (não está vazio); sinal social motiva participação; transparência institucional opera como argumento de credibilidade. Indicadores são agregados (sem dado pessoal — ADR-0017).

## 2. Restrições

- Exibe contagem de: vagas "ativo", candidatos "ativo", Empresas "verificadas" (AC-041-1).
- Atualização em tempo real com cache curto admitido — política a definir pelo Arquiteto (AC-041-2).
- Performance: ≤ 1.5s p95 (RNF 6.1). Cache crítico — RP-009.
- Dados agregados: não revelam quem é candidato ou qual empresa (ADR-0017 — sem PII).
- Política de exibição mínima (QP-004): se algum indicador estiver em 0 (cold start), home pode mostrar "Em breve" em vez do número (D-012 + QP-004 — decisão pendente).

## 3. Cenários de fracasso (de resultado)

**F1. Indicadores em zero no go-live afastam visitantes ("portal vazio").**
Cold start: dia 1, 0 vagas, 0 candidatos, 0 empresas. Visitante chega, vê "0 vagas ativas", sai. Profecia autorrealizada.

✅ RESOLVIDO (dono do intent — D-012/QP-004): contadores com valor < 5 são substituídos por "Em breve" + texto qualitativo (proteção do lançamento); N = 5 tunável. Impacto técnico: nenhum (UI/serializer).

**F2. Cache muito longo mostra contagem desatualizada — visitante candidata-se a vaga que já não existe.**
Cache de 10 min em hora de pico melhora performance mas mostra "15 vagas ativas" quando real é 12. Pequena divergência aceita; grande divergência fura confiança.

✅ RESOLVIDO (D-012/QP-004 — project-guideline §14.1): TTL **600s** + revalidação on-demand; a revalidação on-demand atualiza os indicadores imediatamente nos eventos relevantes (o 600s é apenas o piso de fallback).

**F3. Tráfego anônimo pica em campanha de divulgação e derruba home.**
RP-009 explícito. Home é a porta de entrada; sem CDN ou cache adequado, é o primeiro ponto a quebrar sob pico.

✅ RESOLVIDO (ADR-0019): ISR + cache curto na Vercel (sem CDN paga no MVP); reavaliar edge/CDN somente se o p95 da busca degradar (ADR-0010 — custo mínimo).

**F4. Indicador "Empresas verificadas" inflado por verificações genéricas (coordenador aprova rapidamente para "encher a home").**
Pressão por números pode levar coordenador a aprovar Empresa sem inspecionar adequadamente (USP-017). Diferencial do ADR-0015 esvaziado.

✅ RESOLVIDO (dono do intent): painel da diretoria acompanha MP4 + MP5 + MP10 + taxa de reprovação (visão integrada de saúde institucional).

## 4. Cenários de sucesso

**Nível operacional:**
- Visitante anônimo abre home → vê "47 vagas ativas | 320 candidatos | 28 empresas verificadas" → entende que o portal está ativo → clica em "ver vagas" (USP-021).

**Nível agregado:**
- Conversão visita → cadastro/candidatura tem suporte direto desse sinal.
- Comunicação institucional ganha número concreto para divulgação ("já são 320 candidatos buscando oportunidades pela ASONSEG").

## 5. Conexões

**USPs upstream:** USP-009 (candidatos ativos), USP-012 + USP-017 (empresas verificadas), USP-020 + USP-016 (vagas ativas).

**USPs downstream:** USP-021 (porta para listagem).

**ADRs aplicáveis:** ADR-0010 (custo mínimo — cache/CDN como estratégia), ADR-0017 (indicadores agregados — sem PII).

**Métricas tocadas:** — (instrumento de comunicação).

**Riscos relacionados:** RP-009 (volume tráfego público anônimo). Risco proposto: contagem inflada artificialmente por verificações rápidas.

**Dependências:** D-012 (política de exibição mínima — QP-004).

**Q-abertas:** QP-004 (política de exibição mínima — se exibir 0 ou "Em breve").
