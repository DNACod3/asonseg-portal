# Intent — USP-019: Sugerir nova categoria de serviço ou área de vaga

**Origem:** PRD v0.3 §5.2, USP-019.
**Dono do intent:** Diretoria (decide aceitar nova categoria/área).

## 1. Descrição

Quando Pessoa publicando vaga (USP-020) ou serviço (USP-029) não encontra categoria/área que sirva, escolhe "Outro / sugerir nova" e digita texto livre. Outcome: sugestão é enfileirada com o submit; diretoria (ou usuário com permissão item 7 do catálogo via USP-008) aprova ou rejeita. Se aprovada, vira categoria/área padronizada.

## 2. Restrições

- Texto livre (AC-019-1).
- Enfileirado junto com o conteúdo para moderação (AC-019-2).
- Aprovação adiciona ao catálogo padronizado (AC-019-3).
- Prioridade Should — não Must.

## 3. Cenários de fracasso (de resultado)

**F1. Sugestão duplicada (semelhante a categoria existente) cria poluição no catálogo.**
Pessoa escreve "Serv. de Limpeza" quando já existe "Limpeza"; diretoria aprova sem perceber. Catálogo enche de duplicatas similares.

✅ RESOLVIDO (dono do intent): sem auto-sugestão de similaridade no MVP — a aprovação humana da sugestão filtra duplicatas (coerente com USP-020). Impacto técnico: nenhum.

**F2. Sugestão fora de padrão (ofensiva, sem sentido) entra na fila e ofende moderador.**
Texto livre sem mínimo de qualidade. Anti-padrão de UX que abre vetor de spam de sugestões.

**F3. Conteúdo (vaga ou serviço) fica bloqueado esperando aprovação da nova categoria.**
Vaga publicada com sugestão de categoria nova — fica em status "em moderação" até diretoria aprovar categoria. Diretoria não acessa o sistema com frequência; vaga envelhece.

✅ RESOLVIDO (dono do intent): sim — conteúdo pode ser aprovado com categoria provisória "Outro" e recategorizado na aprovação da sugestão. Impacto técnico: nenhum (catalogs já tem status pendente|ativo).

## 4. Cenários de sucesso

**Nível operacional:**
- Pessoa sugere nova categoria, conteúdo é submetido com a sugestão.
- Diretoria revisa sugestão em ≤ 7 dias, aprova ou rejeita.
- Aprovação adiciona ao catálogo; conteúdo é recategorizado e segue para moderação normal.

**Nível agregado:**
- Sem métrica MP direta.

## 5. Conexões

**USPs upstream:** USP-020, USP-029.

**USPs downstream:** USP-008 (permissão de aprovar).

**ADRs aplicáveis:** ADR-0010.

**Métricas tocadas:** —

**Riscos relacionados:** Risco proposto: catálogo poluído por sugestões.

**Dependências:** D-007.

**Q-abertas:** —
