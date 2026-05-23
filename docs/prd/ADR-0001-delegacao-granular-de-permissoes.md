# ADR-0001: Modelo de permissões com delegação granular

**Status:** Aceito
**Data:** 2026-05-19
**Decisores:** Sponsor ASONSEG (diretor a designar), Bravi PO
**US/Épicos impactados:** US-001, US-005, US-006, US-007, US-027, US-028 (override), US-030 (encerramento de indicação), US-032 (transferência), US-037 (resolução de divergência), US-038 (conciliação PIX), US-040 (edição retroativa)
**Tags:** escopo | regra-de-negocio | seguranca

## Contexto

A operação da ASONSEG na Frente 4 é distribuída: cada área (cesta básica, fitoterápicos, roupas, etc.) tem um coordenador que organiza a rotina e, na prática, depende de voluntários de confiança para tarefas administrativas — configurar a composição mensal de cesta, autorizar uma entrega excepcional fora da regra de "1 cesta/mês", aprovar item criado em campo, resolver divergência de fechamento de caixa, conciliar PIX, encerrar indicação cumprida.

Sem um modelo claro de quem pode o quê, surgiriam duas patologias: (1) o coordenador vira gargalo operacional, atrasando tudo, ou (2) voluntários com acesso amplo demais executam ações administrativas que não deveriam. Precisamos de um modelo que respeite a hierarquia, mas dê ao coordenador o instrumento para distribuir responsabilidades específicas a voluntários de sua confiança, sem promovê-los a coordenador.

A decisão precisa fechar antes do início da implementação porque permeia diversas user stories — todas as ações administrativas precisam de uma regra clara de autorização.

## Decisão

Adotamos modelo híbrido: **papel fixo** (voluntário / coordenador de área / assistente social / diretoria) **+ permissões delegáveis adicionais** que o coordenador da área pode conceder ou revogar individualmente a voluntários da sua área.

O conjunto de permissões delegáveis é um **catálogo finito**, definido no Glossário do PRD (§11). O catálogo inicial é:

1. Cadastrar voluntário na área
2. Configurar composição mensal de cestas (área cesta básica)
3. Validar/aprovar item pendente no catálogo
4. Configurar parâmetros operacionais da área
5. Inativar/excluir entrada de estoque incorreta
6. Gerar relatórios da área
7. Autorizar entrega excepcional de cesta fora da frequência permitida
8. Encerrar indicação de necessidade
9. Resolver divergência de fechamento de caixa
10. Conciliar PIX com extrato bancário

A lista é considerada "viva" durante a Fase 0 (sujeita a refinamento), mas o **modelo é fechado**: nenhuma permissão fora do catálogo é delegável.

Toda concessão e revogação é registrada em log imutável de auditoria (quem delegou, para quem, qual permissão, quando).

## Alternativas Consideradas

### Alternativa A: Papéis fixos puros, sem delegação

Descrição: cada papel teria conjunto de permissões fixo. Para delegar uma tarefa administrativa, o coordenador promoveria o voluntário a "coordenador" também (mesmo que apenas para uma área específica).

Prós:
- Modelo trivial de implementar.
- Auditoria simples ("é coordenador ou não é").
- Menos superfície para erro de configuração.

Contras:
- Voluntário promovido a coordenador ganha **todas** as permissões administrativas, não apenas a tarefa que o coordenador queria delegar.
- Risco real de voluntário com poder excessivo (autorizar override de cesta, encerrar indicações, configurar parâmetros) só porque precisava ajudar a configurar uma composição mensal de cesta.
- Operacionalmente, força o coordenador a confiar 100% ou 0% — sem meio-termo.

**Por que não escolhida:** o cliente fez a escolha explícita de querer controle granular ("opção 2 — implementar delegação granular"), reconhecendo o custo extra de complexidade.

### Alternativa B: Permissões totalmente livres (RBAC granular completo)

Descrição: matriz de permissões granulares onde qualquer ação do sistema pode ser concedida individualmente a qualquer usuário.

Prós:
- Flexibilidade máxima.
- Acomoda qualquer evolução futura sem mudança de modelo.

Contras:
- Custo de implementação alto demais para o volume e maturidade da ASONSEG.
- Risco de configurações inconsistentes (voluntário com permissão de "cadastrar família" mas sem "consultar família" — quebra fluxos).
- UI de gestão de permissões fica complexa e propensa a erro do coordenador.

**Por que não escolhida:** custo desproporcional ao porte do MVP. Catálogo finito atende às necessidades reais identificadas na elicitação.

### Alternativa C: Modelo escolhido (papel fixo + catálogo finito de permissões delegáveis)

Descrição: como descrito em §Decisão.

Prós:
- Coordenador pode distribuir tarefas administrativas sem promover voluntário a coordenador.
- Catálogo finito mantém modelo previsível, auditável e fácil de explicar.
- UI de gestão de permissões é simples (checkboxes do catálogo, por voluntário).
- Permite evoluir adicionando ou removendo itens do catálogo sem mudar o modelo.

Contras:
- Maior complexidade que A (papéis puros).
- Catálogo precisa ser mantido em sincronia entre permissões reais do sistema e exposição na UI.
- Maior superfície de configuração — coordenador pode configurar errado.

**Por que escolhida:** equilíbrio entre flexibilidade real necessária pela operação descentralizada da ASONSEG e custo de implementação viável no MVP.

## Consequências

**Positivas:**
- Coordenador tem instrumento legítimo para delegar tarefas operacionais.
- Voluntários de confiança ganham agência sem virar coordenador integral.
- Auditoria por delegação fica preservada.
- Catálogo finito ancora o escopo da segurança aplicacional.

**Negativas / Trade-offs:**
- Esforço de desenvolvimento maior (vs. papéis puros).
- Precisa de UI de gestão de permissões por voluntário (US-006).
- Toda US administrativa precisa documentar se é delegável e como aparece na lista (vide notas das US afetadas).
- O catálogo "sujeito a refinamento na Fase 0" gera risco de retrabalho — Q-003 (Perguntas em Aberto) deve ser fechada cedo.

**Implicações em outras decisões:**
- ADR-0007 (edição/exclusão de registros) referencia este modelo para definir quem corrige o quê.
- Várias US (US-027, US-028, US-030, US-032, US-037, US-038, US-040) referenciam permissões deste catálogo nos critérios de aceitação.

## Referências

- US-001, US-005, US-006, US-007 (modelagem de usuários e permissões)
- US-027, US-028, US-030, US-032, US-037, US-038, US-040 (consumidores de permissões delegáveis)
- §11 do PRD (Glossário — termo "Permissão delegável" e catálogo inicial)
- Sessão de elicitação 2026-05-19, decisão pela Opção 2 (granular)
