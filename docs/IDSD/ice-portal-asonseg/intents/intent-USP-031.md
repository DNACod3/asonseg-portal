# Intent — USP-031: Ver detalhe do serviço

**Origem:** PRD v0.3 §5.2, USP-031.
**Dono do intent:** Coordenador da área Portal Empregabilidade.

## 1. Descrição

Visitante (anônimo ou autenticado) abre um serviço vindo da lista (USP-030) e vê descrição completa, fotos, categoria, valor, região, disponibilidade e nome do prestador (PF ou Empresa). Contato (telefone/e-mail) fica oculto até manifestação de interesse autenticada (USP-033). Outcome: visitante tem informação suficiente para decidir contratar; quem decide, manifesta interesse e o contato é revelado.

## 2. Restrições

- Anônimo e autenticado veem: nome do prestador, categorias, descrição, fotos, valor, região e disponibilidade (AC-031-1).
- Telefone e e-mail do prestador **ocultos** até manifestação de interesse autenticada (AC-031-2, ADR-0017).
- Manifestação de interesse autenticada revela o contato (AC-031-3 → USP-033).

## 3. Cenários de fracasso (de resultado)

**F1. Contato vaza por canal lateral: descrição livre / fotos com texto contendo telefone ou e-mail.**
Prestador, pensando em facilitar contato, escreve telefone na descrição ou inclui foto com cartão de visita. Visitante anônimo vê o contato sem manifestar interesse. ADR-0017 burlado pelo conteúdo livre do prestador.

✅ RESOLVIDO (ADR-0028): defesa em duas camadas — sanitizer automático (regex e-mail/telefone/CPF/RG) no texto livre no submit + aviso ao autor, e verificação humana na moderação (USP-016); fotos = inspeção humana, sem OCR no MVP.

**F2. Visitante anônimo abre detalhe e o serviço descontextualiza-se (sem CTA claro para contratar).**
Anônimo vê serviço, mas o CTA "manifestar interesse" exige login. Sem mensagem clara explicando "crie conta para contratar", anônimo sai sem agir.

✅ RESOLVIDO (dono do intent): sim — detalhe para anônimo exibe CTA "Criar conta para contratar". Impacto técnico: nenhum (UI).

**F3. Serviço inativo (pausado, arquivado) acessível por link direto sem mensagem clara.**
Cf. F4 do USP-022 / F4 do USP-024. URL salva ou compartilhada leva visitante a serviço já fora do ar; experiência confusa.

✅ RESOLVIDO (dono do intent): sim — detalhe de serviço inativo exibe estado "Serviço não está mais disponível". Impacto técnico: nenhum (UI).

## 4. Cenários de sucesso

**Nível operacional:**
- Anônimo abre detalhe → vê tudo exceto contato → cria conta → autentica → manifesta interesse → contato revelado (USP-033).
- Autenticado abre detalhe → manifesta interesse → contato revelado.

**Nível agregado:**
- Conversão visita → manifestação acontece aqui — diferencial de UX direto.

## 5. Conexões

**USPs upstream:** USP-030 (chega da lista) ou link direto.

**USPs downstream:** USP-033 (manifestar interesse).

**ADRs aplicáveis:** ADR-0017 (contato oculto até ação afirmativa).

**Métricas tocadas:** — (suporte MP7).

**Riscos relacionados:** RP-009 (volume tráfego anônimo). Risco proposto: contato vaza via descrição/foto.

**Dependências:** —

**Q-abertas:** —
