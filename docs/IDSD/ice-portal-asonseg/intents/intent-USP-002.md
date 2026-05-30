# Intent — USP-002: Cadastro de Pessoa pela assistente social (situação extrema)

**Origem:** PRD v0.3 §5.2, USP-002.
**Dono do intent:** Assistente social (AS) + diretoria (LGPD/política).

## 1. Descrição

A AS, no exercício do seu papel institucional, cadastra no sistema uma Pessoa que não consegue ou não tem condições de fazer o auto-cadastro público (idoso sem celular, beneficiária com baixo letramento digital, pessoa em situação de rua sem documento, etc.). O outcome é uma Pessoa persistida no sistema com nome obrigatório, demais campos opcionais (incluindo CPF), eventualmente sem credencial de acesso (Pessoa não loga), referenciável em encaminhamentos, ficha social e relatórios.

Esta USP é a porta de entrada institucional alternativa à USP-001 — existe porque a missão da ASONSEG inclui pessoas que, sem essa exceção, ficariam de fora do sistema. Tem dois traços particulares importantes: (a) a marca de "exceção de CPF" é uma decisão consciente de derrogação de regra geral, então precisa de justificativa textual obrigatória; (b) é via única que cria Pessoa sem credencial — fluxo que tem que ser explicitamente impedido no auto-cadastro público.

## 2. Restrições

- Nome obrigatório; demais campos opcionais.
- "Pessoa sem documento — exceção" exige justificativa textual obrigatória.
- Marca de exceção de CPF só pode ser criada por AS ou diretoria — nunca pelo auto-cadastro público.
- Pessoa cadastrada sem e-mail/senha existe no sistema mas não pode fazer login.
- Termo de consentimento (papel ficha social/atendimento social — finalidade 6 do ADR-0013) é assinado **em papel ou fora do sistema** no momento do atendimento. O sistema registra a referência ao termo assinado, não captura o aceite eletrônico — porque a Pessoa frequentemente nem tem capacidade digital de aceitar online.
  ✅ DECIDIDO (dono do intent): registrar data + responsável (AS) no sistema; sem upload obrigatório de digitalização no MVP. ❓ Redação jurídica do registro a validar com jurídico (D-002).
- Auditoria imutável obrigatória (responsável, data/hora, dados informados).

## 3. Cenários de fracasso (de resultado)

**F1. Auto-cadastro público consegue marcar exceção de CPF por bug de exposição.**
Bug de UI ou de API permite que o flag "Pessoa sem documento — exceção" seja submetido pelo fluxo público. Modelo desmorona: público começa a se cadastrar sem CPF, perde-se a unicidade que sustenta visão consolidada e auditoria LGPD.

**F2. Pessoa sem credencial consegue logar por algum caminho alternativo.**
Bug de autorização ou função "reativar credencial" sem verificação adequada faz com que Pessoa cadastrada sem credencial consiga acesso. Como o termo dela está em papel fora do sistema, ela age no sistema sem aceite eletrônico vinculado. Quebra ADR-0013.

**F3. Justificativa da exceção de CPF é gravada vazia ou genérica.**
AC-002-2 exige justificativa textual mas não exige conteúdo mínimo. AS aprende a digitar "x" ou "—" para passar a validação. Auditoria LGPD perde valor — não dá pra defender em revisão "por que essa Pessoa existe sem CPF".

✅ RESOLVIDO (dono do intent / AS): justificativa mínima ≥ 20 caracteres em texto livre (sem lista fechada de motivos).

**F4. Pessoa sem CPF acaba sendo encaminhada para vaga (USP-037) e a Empresa recebe candidatura sem CPF.**
Encaminhamento não impede explicitamente CPF nulo — Empresa recebe candidato que não consegue ser identificado formalmente. ✅ RESOLVIDO (dono do intent): alerta + segue — o encaminhamento prossegue, mas alerta AS/coordenador de que a Pessoa não tem CPF formal. Impacto técnico mínimo: pré-condição na action de encaminhar, sem mudança estrutural.

**F5. Cadastro completa sem registrar quem (qual AS) fez a operação.**
Log de auditoria não captura a identidade do operador. Mais tarde, em revisão de qualidade ou questionamento LGPD, fica impossível saber quem cadastrou aquela Pessoa.

**F6. Dado pessoal sensível (situação de moradia, vulnerabilidade) gravado fora dos campos protegidos.**
AS digita informação sensível em "observações livres" ou similar; campo sem o mesmo tratamento de visibilidade restrita dos campos da ficha social. Vazamento por exposição em busca ou relatório errado.

## 4. Cenários de sucesso

**Nível operacional:**
- AS conclui o cadastro de uma Pessoa no atendimento social em ≤ 2 minutos a partir do nome inicial.
- Quando a Pessoa tem CPF, AS digita; quando não tem, marca a exceção e digita justificativa adequada — fluxo claro, sem fricção.
- Pessoa cadastrada aparece imediatamente para ser referenciada em encaminhamentos e ficha social (USP-036/USP-037).
- Log do cadastro inclui a AS responsável e data/hora.

**Nível agregado:**
- Sem métrica MP direta. Indireto via MP8 (encaminhamentos) quando Pessoa criada aqui é encaminhada.
- ✅ RESOLVIDO (dono do intent): métrica de acompanhamento = % de Pessoas cadastradas pela AS que reivindicam credencial posteriormente (instrumentada via reporting).

## 5. Conexões

**USPs upstream:** —

**USPs downstream:**
- USP-003 — Pessoa cadastrada pela AS pode reivindicar credencial depois.
- USP-036 — ficha socioeconômica desta Pessoa.
- USP-037 — pode ser encaminhada para vaga.
- USP-039 — aparece na visão consolidada.

**ADRs aplicáveis:**
- ADR-0010 (Custo mínimo)
- ADR-0011 (Pessoa fundamental — esta é a via "sem login")
- ADR-0017 (Visibilidade conservadora — dados sociais restritos a AS e diretoria)

**Métricas tocadas:** indireto via MP8.

**Riscos relacionados:** RP-002 (DPO — Pessoa sem credencial ainda gera dado pessoal sensível, especialmente quando combinada com USP-036).

**Dependências:** D-001 (DPO), D-002 (termo de atendimento social — finalidade 6 do ADR-0013, em papel para esta via).

**Q-abertas:** —
