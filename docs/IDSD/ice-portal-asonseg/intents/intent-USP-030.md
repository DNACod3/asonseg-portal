# Intent — USP-030: Buscar serviços (pública)

**Origem:** PRD v0.3 §5.2, USP-030.
**Dono do intent:** Coordenador da área Portal Empregabilidade.

## 1. Descrição

Qualquer pessoa (anônima ou autenticada) acessa lista de serviços com filtros (categoria, faixa de preço, região, disponibilidade) e busca textual. Outcome: visitante encontra serviços ativos (moderados — ADR-0015) de prestadores PF ou Empresas; lista é a porta de entrada para a contratação de serviços comunitários via Portal.

## 2. Restrições

- Apenas serviços com status "ativo" (AC-030-1).
- Ordenação por data de publicação descendente (AC-030-1).
- Filtros aplicam-se em conjunto (AC-030-2).
- Busca textual case-insensitive sem acentos em título + descrição + categoria (AC-030-3).
- Nome do prestador (PF) ou Empresa exibido publicamente (ADR-0017 — exceção consciente: "nome do prestador é público; sem isso não há comércio").
- Contato (telefone/e-mail) do prestador **não** exibido aqui — fica para após manifestação de interesse (USP-033).

## 3. Cenários de fracasso (de resultado)

**F1. Nome do prestador PF público + descrição revelando vizinhança/horário fixo permite fingerprinting de identidade.**
"Maria Silva — manicure — atende em domicílio em Vila Nova, Londrina — terças 14h-18h" — combinação de campos permite identificar a Pessoa fisicamente. Anônimo pode compilar dados pessoais sem autenticar.

✅ ACEITO (ADR-0017): o nome do prestador é público (sem isso não há comércio). ✅ RESOLVIDO residual (dono do intent): a UI de preenchimento avisa o prestador sobre a exposição pública do nome.

**F2. Sem ordenação por relevância, prestador novo é sempre invisível depois que a base cresce.**
Mesma F2 do USP-021: ordenação por mais recente prejudica prestador que entrou cedo no portal. Quem chegou primeiro some.

✅ ACEITO (ADR-0017): relevância semântica fica para V2. ✅ RESOLVIDO residual (dono do intent): rotação leve dos top N (ex.: 10) a cada carregamento (anti-bias entre prestadores). Impacto técnico: mínimo (ORDER BY com seed).

**F3. Filtros não casam com a realidade da comunidade ASONSEG.**
Filtro "faixa de preço" pode ser irrelevante em serviços que cobrem por orçamento (pintura, reforma); "região" pode ser muito amplo para serviços de bairro. Filtros mal calibrados produzem resultado pobre.

✅ RESOLVIDO (dono do intent): slider livre para preço + granularidade de região = bairro. Impacto técnico: nenhum estrutural; o catálogo de regiões (D-007 / Fase 0) deve cobrir nível de bairro.

**F4. Serviço inativo (prestador desativou o papel ou revogou consentimento — USP-043) ainda aparece na lista por janela de cache.**
Cf. F4 do USP-021. Visitante manifesta interesse em serviço que já não existe.

✅ RESOLVIDO (ADR-0025 / ADR-0026): `requireActiveConsent` on-read + filtro de status garantem consistência mesmo com job de invalidação atrasado; serviço com consentimento revogado some on-read.

## 4. Cenários de sucesso

**Nível operacional:**
- Visitante busca "manicure" em "Centro, Londrina" → lista mostra prestadores PF e Empresas ativos.
- Clica em um → USP-031 (detalhe).

**Nível agregado:**
- Sem MP direta — função de descoberta serve à MP7 (manifestações).
- Aumenta uso comunitário do portal (prestadores são frequentemente da comunidade da ASONSEG).

## 5. Conexões

**USPs upstream:** USP-016 (serviço aprovado).

**USPs downstream:** USP-031 (detalhe), USP-033 (manifestação de interesse).

**ADRs aplicáveis:** ADR-0015 (lista mostra só conteúdo moderado), ADR-0017 (visibilidade — nome público, contato oculto).

**Métricas tocadas:** — (suporte para MP7).

**Riscos relacionados:** RP-009 (tráfego anônimo). Risco proposto: fingerprinting de identidade do prestador PF.

**Dependências:** —

**Q-abertas:** —
