# Intent — USP-008: Configurar permissões delegadas a voluntário no portal

**Origem:** PRD v0.3 §5.2, USP-008. Estende catálogo do ADR-0001.
**Dono do intent:** Coordenador da área Portal Empregabilidade.

## 1. Descrição

O coordenador da área Portal Empregabilidade concede ou revoga permissões administrativas específicas (moderar vagas, moderar CVs, moderar serviços, validar Empresa, encaminhar Pessoa, inativar conteúdo, aprovar sugestão de categoria, registrar resultado de encaminhamento, aprovar reivindicação de credencial) a voluntários da sua área. O outcome é que tarefas operacionais ficam distribuídas entre voluntários de confiança sem precisar promovê-los a coordenadores (princípio do ADR-0001).

Esta USP é o **mecanismo de escala** do MVP — sem ela, a moderação (USP-016) e o encaminhamento (USP-037) ficam centralizados no coordenador, criando o gargalo que RP-004 nomeia.

## 2. Restrições

- Catálogo finito de permissões delegáveis do Portal (estende ADR-0001):
  1. Moderar vaga
  2. Moderar CV/perfil de candidato
  3. Moderar serviço
  4. Validar Empresa na primeira vaga
  5. Inativar conteúdo publicado
  6. Encaminhar Pessoa para vaga
  7. Aprovar sugestão de nova categoria/área
  8. Registrar resultado de encaminhamento
  9. Aprovar reivindicação de credencial
- Concessão e revogação registradas em log imutável.
- Aplicação imediata da concessão; revogação no próximo carregamento (AC-008-1, AC-008-2).
- ✅ RESOLVIDO parte técnica (ADR-0030 / TD §4.5): o MECANISMO está definido — enum fechado com namespace `portal:` (modelo fechado, ADR-0001 estendido). ❓ O CONTEÚDO final do catálogo permanece gate de negócio (D-006 / QP-006, Fase 0).

## 3. Cenários de fracasso (de resultado)

**F1. Voluntário com permissão revogada continua exercendo a permissão por sessão ativa.**
AC-008-2 fala em "próximo carregamento" — mas se o voluntário tem aba aberta, ele continua moderando até recarregar. Em caso de revogação por motivo grave (perdeu confiança), isso pode causar dano.

✅ RESOLVIDO parte técnica (ADR-0030): revogação de permissão vale no próximo carregamento (janela ≤30s acordada); reativação de Pessoa zera grants. a UI informa a janela curta de propagação ao coordenador (sem gating). Impacto técnico: nenhum.

**F2. Permissão concedida a voluntário que não devia.**
Coordenador concede por engano permissão de "inativar conteúdo publicado" a voluntário novo que ainda não tem maturidade — voluntário começa a inativar coisas erradas. Sem grade de proteção (ex.: confirmação extra para permissões mais sensíveis), o erro é fácil.

✅ RESOLVIDO (dono do intent): nenhuma confirmação extra no MVP — concessão direta e uniforme para todas as permissões.

**F3. Permissão fora do catálogo é concedida por bypass de UI.**
Bug ou chamada direta de API permite conceder permissão que não consta no catálogo. Quebra ADR-0001 ("modelo fechado").

**F4. Voluntário inativado (USP-007) mantém permissões "delegadas" no histórico, e quando reativado volta com tudo.**
Reativação automática de permissões esquecidas — voluntário desligado por motivo grave volta meses depois (reativado por engano) e instantaneamente tem moderação ativa de novo.

✅ RESOLVIDO (ADR-0030 / USP-045): reativação de Pessoa volta **do zero** — não restaura nenhuma permissão delegada antiga (grants zerados); voltam a ser concedidas explicitamente se necessário. Coerente com a F1 resolvida acima.

**F5. Catálogo do Portal entra em conflito com catálogo da Frente 4 (no Release 2) sem aviso.**
A ADR-0001 fala em modelo estendido. Quando Release 2 entrar, é possível que duas permissões com mesmo nome ou ID conflitem. Risco de Release 2 — não bloqueia MVP, mas precisa estar na nota.

## 4. Cenários de sucesso

**Nível operacional:**
- Coordenador concede/revoga permissão em ≤ 30 segundos por voluntário.
- Voluntário recebe a permissão e consegue exercer imediatamente (na próxima carga).
- Auditoria mostra histórico completo (quem concedeu, para quem, quando, qual permissão, motivação opcional).
- ✅ RESOLVIDO (dono do intent): motivação textual optativa.

**Nível agregado:**
- Sem métrica MP direta. Saúde operacional (distribuição de carga) acompanhada indireto via MP10.

## 5. Conexões

**USPs upstream:**
- USP-001 (Pessoa existe como voluntário)
- USP-004 (coordenador autenticado)

**USPs downstream:**
- USP-003 (reivindicação de credencial — item 9 do catálogo)
- USP-016 (moderar vaga/CV/serviço — itens 1-3)
- USP-017 (validar Empresa — item 4)
- USP-018 (inativar conteúdo — item 5)
- USP-019 (aprovar sugestão — item 7)
- USP-037 (encaminhar Pessoa — item 6)
- USP-038 (registrar resultado — item 8)

**ADRs aplicáveis:**
- ADR-0001 (estendido — catálogo do Portal)
- ADR-0010 (Custo mínimo)

**Métricas tocadas:** transversal — RP-004 (carga de moderação) é mitigada por esta USP.

**Riscos relacionados:** RP-004.

**Dependências:** D-006 (catálogo final), QP-006.

**Q-abertas:** QP-006.
