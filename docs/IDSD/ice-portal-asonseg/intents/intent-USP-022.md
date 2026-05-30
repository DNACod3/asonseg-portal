# Intent — USP-022: Ver detalhe da vaga

**Origem:** PRD v0.3 §5.2, USP-022.
**Dono do intent:** Coordenador da área Portal Empregabilidade.

## 1. Descrição

Visitante (anônimo ou autenticado) abre uma vaga vinda da lista (USP-021) e vê descrição completa, requisitos, benefícios, salário, regime, local, validade e — quando autenticado com papel candidato — botão "candidatar-se". Contador "N pessoas se candidataram" dá sinal social. Outcome: visitante tem informação suficiente para decidir se quer candidatar-se; quem decide, candidata sem fricção.

## 2. Restrições

- Anônimo vê todos os dados da vaga, com Empresa anonimizada por setor (AC-022-1, ADR-0017).
- Pessoa autenticada com papel candidato vê nome da Empresa + botão "candidatar-se" (AC-022-2).
- Contador de candidaturas exibido sempre (AC-022-3).
- Detalhe acessível apenas para vagas em status "ativo" (consistência com USP-021); vaga pausada/expirada não deve ser acessível por link direto.

## 3. Cenários de fracasso (de resultado)

**F1. Contador "N candidatos" expõe baixa atratividade da vaga e afasta candidatos.**
Vaga com 0 candidatos parece "fria" para quem chega depois. Efeito psicológico inverte sinal: contador deveria atrair, mas afasta quando está baixo.

✅ RESOLVIDO (dono do intent): contador de candidaturas aparece apenas com ≥ 3 candidaturas (evita expor vagas com 0/1).

**F2. Visitante anônimo abre detalhe via link direto e o sistema vaza Empresa em algum campo (alt de imagem, meta tag, JSON-LD).**
Anonimização aplicada na view principal mas não em metadados (SEO/social cards) ou em payload da API que o frontend consome. Quem inspeciona vê o nome real.

✅ RESOLVIDO (ADR-0022): anonimização da Empresa feita na montagem do View Model/serializer (cobre API/JSON, SEO, OG, JSON-LD e URL canônica), nunca no template do detalhe.

**F3. Pessoa autenticada mas sem papel candidato vê a vaga e não consegue agir — sem caminho claro para ativar o papel.**
Visitante autenticado como prestador-de-serviço (sem candidato ativo) abre vaga atrativa e o botão "candidatar-se" não aparece. UX não explica o que falta.

✅ RESOLVIDO (dono do intent): sim — Pessoa autenticada sem papel candidato vê CTA "Ativar perfil candidato" linkando para USP-009. Impacto técnico: nenhum (UI).

**F4. Vaga vinculada a Empresa rebaixada para "não verificada" (após edição — ADR-0014) permanece acessível e dá sinal contraditório.**
Vaga foi aprovada no passado, mas a Empresa sofreu edição que rebaixou a verificação. Vaga continua acessível enquanto a Empresa entra de novo em validação. Candidato vê vaga "ativa" mas, no fundo, Empresa não está mais verificada.

✅ RESOLVIDO (dono do intent / cf. USP-020): sim — todas as vagas ativas da Empresa saem do ar até a Empresa ser re-verificada (filtro on-read).

## 4. Cenários de sucesso

**Nível operacional:**
- Visitante anônimo abre detalhe → vê dados completos + Empresa anonimizada → decide criar conta para candidatar-se (USP-001).
- Pessoa autenticada candidata clica em "candidatar-se" → USP-025 dispara.

**Nível agregado:**
- Detalhe é onde a conversão acontece — quanto mais clara a vaga, maior a probabilidade de candidatura (MP6 indireto).

## 5. Conexões

**USPs upstream:** USP-021 (chega da lista) ou link direto.

**USPs downstream:** USP-025 (candidatar-se).

**ADRs aplicáveis:** ADR-0015 (vaga moderada), ADR-0017 (visibilidade conservadora).

**Métricas tocadas:** — (suporte MP6).

**Riscos relacionados:** RP-009 (volume tráfego anônimo no detalhe).

**Dependências:** —

**Q-abertas:** —
