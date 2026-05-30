# Intent — USP-021: Buscar vagas (pública)

**Origem:** PRD v0.3 §5.2, USP-021.
**Dono do intent:** Coordenador da área Portal Empregabilidade (responsável pela experiência de descoberta de vagas para a comunidade).

## 1. Descrição

Qualquer pessoa — anônima ou autenticada — entra na listagem de vagas e usa filtros (área, escolaridade, tipo de contrato, regime, faixa de salário, região) e busca textual para encontrar vagas que interessam. Outcome desejado: visitante vê apenas vagas com status "ativo" (não expiradas, não pausadas, não em moderação), ordenadas por mais recentes; aplicar filtro reduz lista coerentemente; visitante anônimo vê Empresa anonimizada por setor (ADR-0017) e autenticado vê o nome real. Lista é a porta de entrada do funil: serviço de descoberta tem que funcionar bem ou ninguém candidata.

## 2. Restrições

- Só vagas com status "ativo" aparecem (AC-021-1). Vagas "em moderação", "pausada", "arquivada", "expirada" e "rascunho" ficam fora.
- Ordenação padrão = data de publicação descendente (AC-021-1). Sem ordenação por relevância no MVP (decisão registrada no CHANGELOG v0.3).
- Múltiplos filtros aplicam-se em conjunto (AND lógico) (AC-021-2).
- Busca textual = match case-insensitive sem acentos (AC-021-3), aplicada a título + descrição + requisitos (decisão MVP — semântica fica para V2).
- Anônimo: nome da Empresa anonimizado para "Empresa do setor de X" (AC-021-4, ADR-0017). Autenticado: nome real (AC-021-5).
- Performance: ≤ 2s p95 no volume estimado (RNF 6.1).
- Tráfego anônimo pode picar (RNF 6.4) — RP-009 cobre.

## 3. Cenários de fracasso (de resultado)

**F1. Visitante anônimo vê dados de Empresa em vaga via efeito colateral.**
Anonimização da Empresa é uma regra de view; se a descrição da vaga repete o nome da empresa ("Trabalhe na ACME Ltda."), anonimização cosmética falha. Visitante anônimo vê o nome via campo descrição.

✅ RESOLVIDO (ADR-0022 + ADR-0028): sanitização/anonimização do nome da Empresa acontece no serializer/View Model anônimo (cobre HTML/JSON/SEO/OG); a moderação humana complementa identificando casos sutis.

**F2. Lista cresce e visitante não encontra a vaga que existe.**
Sem ordenação por relevância e sem paginação inteligente, vaga recém-publicada empurra antigas para baixo. Visitante que entra hoje vê 50 vagas "ativas" e não consegue filtrar coerentemente. Conversão de visita → candidatura cai sem sinal claro.

✅ RESOLVIDO (dono do intent): expectativa de <30 vagas ativas simultâneas no 1º ano (volume baixo, ADR-0019); reavaliar relevância em V2 se ultrapassar.

**F3. Busca textual sem acentos não encontra vaga com termo regional/técnico específico.**
Candidato busca "Atendente de Padaria" e a vaga foi cadastrada como "Padeiro/Atendente" — match exato (mesmo case-insensitive e sem acentos) não pega. Vaga existe e fica invisível para quem deveria encontrá-la.

✅ RESOLVIDO (decisão PO 2026-05-29 / TD §3.2): busca semântica/stemming/FTS ficam **fora do MVP → V2**; o MVP usa busca por filtros estruturados (match case-insensitive sem acentos sobre título + descrição + requisitos).

**F4. Vaga expirada continua aparecendo no resultado por janela de cache ou job atrasado.**
USP-024 expira por timezone — se job falha ou rodar com atraso, vaga vencida aparece na busca; candidato candidata-se a algo que já fechou.

✅ RESOLVIDO (ADR-0026 / TD §8.3): expiração via filtro on-read + Vercel Cron, com alerta de heartbeat caso o job de expiração não rode (RNF 6.6).

**F5. Filtros mal projetados deixam visitante perdido.**
6 filtros simultâneos (área, escolaridade, contrato, regime, salário, região) podem ser overkill para usuário com baixo letramento digital — público da ASONSEG (RNF 6.5). Visitante que abre a página vê painel cheio e sai sem usar.

✅ RESOLVIDO (dono do intent): 2-3 filtros prioritários visíveis por padrão (área + regime/local), resto expansível sob pedido. Impacto técnico: nenhum (UI).

## 4. Cenários de sucesso

**Nível operacional:**
- Visitante anônimo abre lista, vê N vagas ativas, anonimizadas por Empresa.
- Aplica 1-2 filtros (ex.: área = "vendas" + região = "Londrina") e a lista reduz coerentemente.
- Clica em uma vaga → USP-022 (detalhe).
- Pessoa autenticada navega a lista vê o nome real das Empresas.

**Nível agregado:**
- Sem métrica MP direta — função de descoberta serve às métricas downstream (MP6 candidaturas).
- ADR-0015 entrega valor: candidato sente curadoria da plataforma (vagas estão visivelmente ativas, recentes, moderadas).

## 5. Conexões

**USPs upstream:** USP-016 (moderação aprovou), USP-024 (expiração silenciosa).

**USPs downstream:** USP-022 (detalhe), USP-025 (candidatura).

**ADRs aplicáveis:** ADR-0015 (lista mostra só conteúdo moderado), ADR-0017 (visibilidade conservadora — anonimização anônimo vs autenticado).

**Métricas tocadas:** — (suporte para MP6).

**Riscos relacionados:** RP-009 (volume de tráfego público anônimo). Risco proposto: nome da Empresa vaza no campo descrição apesar de anonimização cosmética.

**Dependências:** —

**Q-abertas:** —
