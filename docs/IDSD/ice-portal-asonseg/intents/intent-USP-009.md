# Intent — USP-009: Cadastro de candidato (papel)

**Origem:** PRD v0.3 §5.2, USP-009.
**Dono do intent:** Sponsor + diretoria (LGPD) + coordenador da área Portal (qualidade do perfil aprovado).

## 1. Descrição

Uma Pessoa autenticada ativa o papel candidato preenchendo dados pessoais, qualificações, escolaridade, áreas de interesse e (opcionalmente) anexando currículo em PDF/DOC/DOCX. Quando anexa CV, a extração automática via IA generativa (USP-040) pré-preenche os campos estruturados para validação. Após o candidato enviar o perfil para moderação (USP-016), o coordenador da área Portal revisa e aprova, devolve para ajustes ou rejeita. Outcome aprovado: candidato visível na busca de empresas (USP-028) e apto a se candidatar (USP-025).

USP de alta concentração de risco — toca 5 ADRs (0011, 0013, 0015, 0017, 0018), 3 riscos (RP-003, RP-007, RP-008) e depende de provedor de IA com Zero Data Retention.

## 2. Restrições

- Escolaridade, área de interesse principal e telefone são campos obrigatórios para envio à moderação (AC-009-1).
- CV opcional (PDF/DOC/DOCX até 5MB).
- Extração de CV via IA generativa quando anexado — best effort (ADR-0018 + USP-040).
- Consentimento da finalidade "candidatura a vagas" (finalidade 2 do ADR-0013) obrigatório antes da ativação do papel.
- Consentimento da finalidade "extração via IA" (finalidade 7) obrigatório se houver upload de CV.
- Status do perfil/CV passa por: rascunho → em moderação → ativo / aguardando ajustes / rejeitado.
- Acesso ao CV armazenado é restrito (USP-027 — empresa vê apenas após candidatura).
- Auditoria do papel ativado e da transição de status.

## 3. Cenários de fracasso (de resultado)

**F1. Candidato com perfil aprovado, mas qualificações foram extraídas pela IA e ele "confirmou sem revisar" — dados errados aparecem para Empresa.**
Materialização de RP-007. AC-040-4 exige confirmação explícita, mas se a UI não diferenciar campos "extraídos automaticamente" dos "preenchidos manualmente", e o texto for tão genérico que candidato com baixo letramento clica em qualquer botão pra terminar, o resultado é candidato apresentado para empresa com qualificações que não confirmam a realidade. Empresa entra em contato esperando algo que não tem, reputação da ASONSEG queda.

**F2. CV enviado a provedor LLM sem Zero Data Retention contratado — dado pessoal vaza fora do escopo LGPD.**
Materialização de RP-008. Provedor escolhido não tem ZDR contratualmente, ou tem ZDR mas configuração específica do projeto não está ativada, ou ZDR foi quebrado em troca contratual e ninguém atualizou o projeto. CV (dado pessoal completo, frequentemente com endereço, telefone, histórico profissional) fica em treinamento ou em log do provedor.

✅ RESOLVIDO (parte técnica) (ADR-0027 / ADR-0019): provedor = **Anthropic Claude (Haiku) com Zero Data Retention**, acoplado via porta `CVExtractor` + adapter, atrás de feature flag que só liga com ZDR configurado (senão preenchimento manual). ❓ PENDENTE (negócio — **bloqueante de produção**): termo de consentimento da finalidade 7 nomeando o provedor (D-002, diretoria + jurídico) e confirmação D-008 / QP-002.

**F3. Termo de consentimento da finalidade "candidatura a vagas" não cobre adequadamente exposição do CV a empresas terceiras.**
Termo é redigido pensando só em "consentimento de candidatura" mas não explicita que CV completo será visível para a Empresa após a candidatura (USP-025/AC-025-1). LGPD exige finalidade clara — falha aqui expõe a ASONSEG.

❓ Termo está sendo redigido com detalhe ou genérico? (dono do intent — diretoria + jurídico, via D-002)

**F4. Candidato anexa CV em formato corrompido ou com macro maliciosa.**
Validação de arquivo é superficial — apenas extensão e tamanho. Macro/script embutido no DOC chega ao processamento, ou ao moderador (USP-016) que abre o arquivo numa máquina interna.

✅ RESOLVIDO (ADR-0028): validação de upload por magic bytes + antivírus/parser-sem-macro **antes** do storage; CV armazenado em storage **privado** com URL assinada de validade curta.

**F5. Perfil aprovado fica visível na busca antes da extração da IA ter completado, com campos vazios estranhos.**
Race condition: a transição para "ativo" acontece antes do retorno da extração da IA. Empresa vê candidato com campos vazios e interpreta como perfil incompleto.

**F6. Pessoa sem credencial (USP-002) tenta ativar papel candidato e o sistema permite.**
Bug: a ativação de papel candidato é executada via API que aceita Pessoa sem credencial — Pessoa que não loga termina com perfil "ativo" que ela mesma não consegue revisar ou candidatar. Inconsistência.

## 4. Cenários de sucesso

**Nível operacional:**
- Pessoa preenche dados, anexa CV (opcional), envia para moderação em ≤ 5 minutos.
- Extração da IA pré-preenche campos com clareza visual sobre o que veio da IA vs. o que é preenchimento manual.
- Após aprovação pelo coordenador, candidato aparece na busca de empresas e é notificado por e-mail (USP-044).
- ✅ RESOLVIDO (dono do intent): cadastro completo ≤ 5 min com CV / ≤ 10 min sem CV.
- ✅ RESOLVIDO (dono do intent / coordenador): taxa de aprovação na 1ª revisão ≥ 70%.

**Nível agregado:**
- MP1 (candidatos com perfil ativo).
- ✅ RESOLVIDO (ADR-0027 / TD §8.2): telemetria de uso/custo da extração de CV instrumentada — métrica "% de candidatos que usaram extração da IA" derivável da telemetria.

## 5. Conexões

**USPs upstream:**
- USP-001 ou USP-006 — Pessoa autenticada com papel candidato ativo.
- USP-043 — consentimentos finalidades 2 e 7 persistidos.
- USP-040 — extração de CV.

**USPs downstream:**
- USP-016 — moderação do perfil.
- USP-025 — só candidata-se quem está aprovado.
- USP-027 — empresa vê dados completos após candidatura.
- USP-028 — empresa vê candidato resumido (campos sensíveis ocultos — ADR-0017).
- USP-037 — encaminhamento ativa este papel automaticamente.

**ADRs aplicáveis:**
- ADR-0011 (Pessoa fundamental — papel social)
- ADR-0013 (Consentimentos — finalidades 2 e 7)
- ADR-0015 (Moderação humana — perfil passa por gate do coordenador)
- ADR-0017 (Visibilidade conservadora — dados sensíveis só após candidatura)
- ADR-0018 (Extração de CV via IA generativa)

**Métricas tocadas:** MP1.

**Riscos relacionados:** RP-003, RP-007, RP-008.

**Dependências:** D-002 (termos), D-008 (provedor IA).

**Q-abertas:** QP-002.
