# Runbook — View Model e visibilidade por papel

**Tipo:** padrão de implementação reutilizável
**Usado por:** USP-002, 013, 021, 022, 027, 028, 030, 031, 035, 036, 039, 041, 042
**ADRs relacionados:** ADR-0022 (View Models), ADR-0017 (negócio), ADR-0028 (sanitização)
**Referência no TD:** §4.2 (componentes), §7.3 (PII)

## Quando usar

Sempre que uma Pessoa (ou visitante anônimo) lê dados de **outra** Pessoa/Empresa: busca de vagas/serviços/candidatos, detalhe, lista de candidatos/manifestações, visão consolidada, ficha social, relatórios. Também na anonimização da Empresa para anônimo.

## Quando NÃO usar

Quando a Pessoa lê os **próprios** dados (aí o acesso direto ao Prisma é OK). Para escrita (use `runbook-server-action`).

## O padrão (passo a passo)

```ts
// modules/<dominio>/views/<recurso>-for-<papel>.view.ts
export function viewCandidateForEmployer(c: Candidate): CandidateEmployerView {
  // monta SÓ os campos permitidos para o papel; nada de entidade crua
  return {
    primeiroNome: c.nome.split(' ')[0],
    cidade: c.cidade, areaInteresse: c.areaPrincipal,
    escolaridade: c.escolaridade, qualificacoes: sanitizePII(c.resumo),
    // ❌ NÃO inclui cpf, email, telefone, endereço, cv — só após candidatura
  }
}
```

Regras:
1. **Toda leitura cross-Pessoa retorna um View Model**, nunca a entidade Prisma.
2. O recorte de campos e a **anonimização acontecem ao montar o View Model** (servidor), antes de qualquer renderer/serializer.
3. Campos sensíveis sociais (ficha social) só entram nos View Models de AS/diretoria, atrás de `requirePermission`.
4. Revelação de contato é condicionada a evento (candidatura/manifestação) — reciprocidade.

## Pontos de atenção (gotchas)

- **Anonimização NÃO é no template** — o nome da Empresa não pode vazar por JSON da API, meta tags OG/Twitter, JSON-LD, schema.org, alt de imagem ou URL canônica. Faça no View Model/serializer (USP-021/P-001, USP-022/P-002).
- **Isolamento de query** — a lista de candidatos de uma vaga não pode trazer dados de candidatos de outra; filtre por escopo (`WHERE` da Empresa/serviço do solicitante) para evitar cross-leakage (USP-027/P-006, USP-035/P-005).
- **Ficha social tem guard centralizado** — coordenador e voluntário NÃO veem, inclusive no JSON serializado da visão consolidada (USP-036/P-003, USP-039/P-001). Aplique o guard no serializer, não só na tela.
- **Anti-inferência** — o View Model do coordenador não pode deixar inferir situação social (ex.: badge "encaminhada" que revela que a Pessoa é beneficiária — USP-039/P-003).
- **Nome do prestador é público** (exceção consciente do ADR-0017) — mas o contato fica oculto até manifestação.
- **Teste por papel é obrigatório** — cada View Model tem teste "papel X NÃO vê campo Y".

## Verificação

- [ ] Leitura cross-Pessoa passa por View Model (nunca entidade crua)
- [ ] Anonimização/recorte no View Model/serializer (cobre API/SEO/OG/JSON-LD)
- [ ] Query isolada por escopo (sem cross-leakage)
- [ ] Ficha social só em View Models de AS/diretoria (guard centralizado)
- [ ] Sem inferência indireta de situação social
- [ ] Contato revelado só após ação afirmativa
- [ ] Teste "papel X não vê campo Y" presente

## Referências

- ADR-0022, ADR-0017, ADR-0028; project-guideline §8.1, §11.2
- TD §4.2, §7.3
- USPs servidas: ver cabeçalho
