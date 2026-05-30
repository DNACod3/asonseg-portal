# ADR-0015: Moderação humana pré-publicação como diferencial do Portal

**Status:** Aceito — Aplicável ao Release 1 (MVP Portal Empregabilidade e Serviços)
**Data:** 2026-05-22
**Decisores:** Sponsor ASONSEG (diretor a designar), Bravi PO
**US/Épicos impactados:** USP-009, USP-016 a USP-019, USP-020, USP-023, USP-029
**Tags:** fluxo de negócio | qualidade | operação | diferencial institucional

## Contexto

Em portais de empregos e marketplaces de serviços comuns no Brasil (LinkedIn, Catho, GetNinjas, etc.), o modelo dominante é "publicação livre + moderação reativa": o usuário publica, o conteúdo entra ao vivo imediatamente, e a plataforma só age depois de denúncia ou descoberta de problema. Modelo escalável, mas com qualidade volátil.

A ASONSEG, durante a elicitação, definiu que o Portal Empregabilidade e Serviços é uma área da ASONSEG (assim como Cesta Básica, Fito ou Bazar), e que o padrão de operação dessas áreas é controle qualitativo por moderação humana. Aplicar esse padrão ao portal traz:

- Coerência operacional com as outras áreas da ASONSEG.
- Diferencial qualitativo perceptível pelos usuários ("aqui as vagas são verificadas").
- Defesa anti-fraude embutida (golpes em vagas, empresas-fantasma, serviços ilegais).
- Trade-off de velocidade de publicação (conteúdo não fica ao vivo imediatamente) e custo operacional (alguém precisa moderar).

## Decisão

**Toda vaga, perfil de candidato/CV e serviço passa por moderação humana antes de ficar visível no portal.**

**Quem modera:**

- Coordenador da área "Portal Empregabilidade" (papel organizacional da ASONSEG, conforme catálogo de áreas).
- Voluntários com a permissão delegável correspondente (moderar vaga / moderar CV / moderar serviço — ver Glossário do PRD).

O modelo segue exatamente o mesmo padrão das outras áreas da ASONSEG (cesta básica, fito, bazar) já estabelecido no ADR-0001 (delegação granular de permissões).

**O que é moderado:**

- **Vaga** publicada por Pessoa-responsável de Empresa.
- **Perfil/CV** ativado por candidato (perfil pronto para aparecer na busca de empresas).
- **Serviço** publicado por prestador (PF ou em nome de Empresa).
- **Validação manual da Empresa** na primeira vaga publicada — coordenador inspeciona dados da Empresa junto com a vaga (USP-017).

**O que NÃO é moderado:**

- **Cadastro de Pessoa** em si — auto-cadastro público é direto, sem moderação. A moderação se aplica ao conteúdo que a Pessoa publica nos papéis ativados (ADR-0011).
- **Cadastro de Empresa** em si — Empresa nasce no portal sem moderação prévia, marcada como "não verificada"; verificação acontece na primeira vaga (USP-017).
- **Candidatura** a vaga — silenciosa, sem moderação (USP-025).
- **Manifestação de interesse** em serviço — silenciosa, sem moderação (USP-033).
- **Encaminhamento** — feito por usuário ASONSEG autorizado, dispensa moderação (USP-037).

**Fluxo de moderação:**

1. Autor cria rascunho → status "rascunho".
2. Autor envia para moderação → status "em moderação".
3. Coordenador (ou voluntário delegado) revisa:
   - **Aprova** → status "ativo", e-mail ao autor.
   - **Devolve para ajustes** com motivo textual obrigatório → status "aguardando ajustes", e-mail ao autor.
   - **Rejeita definitivamente** com motivo textual → status "rejeitado", e-mail ao autor.
4. Após "ativo", autor pode pausar, arquivar ou editar (que volta a "rascunho" e exige nova moderação).
5. Coordenador pode inativar conteúdo já ativo (USP-018) — escape válve para problemas descobertos após publicação, dado que não há fluxo formal de denúncia no MVP.

**Sem SLA formal no MVP** — coordenador processa fila conforme capacidade. Métrica MP10 (tempo médio de moderação) acompanha desempenho operacional.

## Alternativas Consideradas

**Alternativa A — Sem moderação (publicação livre) (descartada):** modelo padrão dos portais comerciais. Por que não escolhida: perde o diferencial qualitativo da ASONSEG; expõe a comunidade a golpes (empresa-fantasma, vagas falsas); contradiz o padrão operacional da ASONSEG (todas as outras áreas têm coordenação).

**Alternativa B — Moderação reativa por denúncia (descartada):** publicação livre + sistema de denúncia para acionar moderador depois. Por que não escolhida: já decidido no Bloco 11 da elicitação que MVP não tem sistema de denúncia; depende de usuários denunciarem (raramente acontece a tempo); danos já ocorreram quando a denúncia chega.

**Alternativa C — Moderação humana pré-publicação (escolhida):** modelo descrito acima.

**Alternativa D — Moderação automatizada por IA + revisão humana de exceções (descartada para o MVP):** usar LLM para classificar rascunhos e revisão humana apenas para casos duvidosos. Por que não escolhida: aumenta complexidade técnica; custo recorrente de API; risco de falso negativo (LLM aprova conteúdo problemático); MVP enxuto prefere abordagem simples e auditável. Candidato a V2.

## Consequências

**Positivas:**

- Diferencial qualitativo perceptível pelos usuários.
- Defesa anti-fraude embutida (empresa-fantasma, golpe em vaga, serviço ilegal).
- Coerência operacional com outras áreas da ASONSEG.
- Permite que a ASONSEG funcione como "curadora" no relacionamento com a comunidade.
- Auditoria clara — toda publicação tem um moderador responsável registrado.

**Negativas / Trade-offs:**

- **Velocidade de publicação:** conteúdo demora a aparecer (depende da capacidade do moderador). Sem SLA formal — risco se volume crescer sem capacidade proporcional. Mitigação: monitorar MP10; coordenador pode delegar a voluntários conforme demanda.
- **Carga operacional para a ASONSEG:** alguém precisa dedicar tempo regular à moderação. Mitigação: modelo de área + voluntários delegados (ADR-0001 estendido) distribui a carga.
- **Risco do MVP:** se a equipe de moderação não estiver pronta no go-live, conteúdo aprovável fica em fila e usuários ficam frustrados. Registrado como Risco RP-004.
- **Edição após aprovação rebaixa para rascunho** — usuário pode achar burocrático precisar passar pela moderação de novo. Mitigação: comunicação clara no fluxo.

**Implicações em outras decisões:**

- Catálogo de permissões delegáveis (ADR-0001 estendido) inclui as 9 permissões específicas do Portal (Glossário do PRD).
- USP-018 (inativar conteúdo publicado) é a "escape válve" para problemas descobertos pós-publicação, dado a ausência de fluxo formal de denúncia.
- MP10 (tempo médio de moderação) é métrica direta de saúde operacional.

## Referências

- ADR-0001 (Delegação granular de permissões — modelo estendido).
- PRD MVP Portal, USP-016 a USP-019 (Moderação), §13 (RP-004).
- Bloco 3 e Bloco 11 da elicitação (decisões sobre moderação e ausência de denúncia).
