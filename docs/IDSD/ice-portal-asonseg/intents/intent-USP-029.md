# Intent — USP-029: Publicar serviço

**Origem:** PRD v0.3 §5.2, USP-029.
**Dono do intent:** Coordenador da área Portal Empregabilidade.

## 1. Descrição

Pessoa com papel prestador de serviço (PF) OU Pessoa-responsável de uma Empresa publica um serviço (descrição, valor, unidade de cobrança, regiões, disponibilidade, até 3 fotos). Ao iniciar, escolhe explicitamente "publicar como PF" ou "publicar em nome de [Empresa X]" (ADR-0014 — Empresa não tem login próprio). Submissão vai para moderação humana (USP-016, ADR-0015). Outcome: serviço entra na fila moderada; aprovado, fica descobrível (USP-030) por potenciais clientes da comunidade.

## 2. Restrições

- Início do cadastro exige escolha "PF" ou "em nome de Empresa X" (AC-029-1). Lista mostra apenas Empresas em que a Pessoa é responsável ativa.
- Persistência inicial em status "em moderação" (AC-029-2).
- Campos obrigatórios: título, categoria, descrição, valor, unidade (hora/diária/serviço/etc.), região(ões), disponibilidade (dias/horários) (AC-029-3).
- Fotos opcionais — até 3, formatos JPG/PNG/WEBP, ≤5MB cada (AC-029-4).
- Consentimento "oferta de serviço" (finalidade 3 do ADR-0013) precisa estar ativo para a Pessoa.
- Catálogo de categorias precisa estar fechado (D-007); sugestão de nova categoria via USP-019.

## 3. Cenários de fracasso (de resultado)

**F1. Serviço ilegal, fraudulento ou inseguro publicado pelo prestador entra na fila e — se moderador não pega — vai ao ar.**
Prestador publica "empréstimo agiota", "remédio milagroso", "serviço sem alvará". Moderador (coordenador / voluntário delegado) pode deixar passar por falta de checklist específico para serviços. Diferente de uma vaga (que tem critérios de empresa-fantasma claros), serviço tem mil categorias possíveis.

❓ Existe checklist textual para o moderador de serviços (categorias proibidas, palavras-chave bandeira vermelha)? (dono do intent — coordenador + jurídico)

**F2. Prestador PF publica como pessoa mas usa nome/marca de empresa que não tem vínculo formal — confunde quem é responsável legalmente.**
Pessoa cadastra-se como prestador PF, na descrição escreve "Serviços da [Empresa X]" sem ter cadastrado a Empresa no portal. Sistema mostra "prestador: João Silva (PF)" mas descrição vende como empresa. Cliente acha que está contratando empresa, está contratando pessoa.

✅ RESOLVIDO (dono do intent): sim — o moderador remove (ou solicita correção de) menções a "empresa não cadastrada" na descrição, integrado à moderação (USP-016 / ADR-0024).

**F3. Foto enviada contém PII incidental (rosto de terceiros, placa de rua identificável, documentos visíveis).**
Prestador envia foto do seu trabalho contendo rosto de cliente passado, ou número de telefone visível em parede, ou nome de outra pessoa. Foto fica pública (USP-030/USP-031). LGPD da pessoa retratada na foto.

✅ RESOLVIDO parte técnica (ADR-0028): o moderador checa as fotos (inspeção humana; sem OCR/blur no MVP). ❓ A redação do termo cobrindo a responsabilidade do prestador pelo conteúdo das fotos permanece com jurídico (D-002).

**F4. Valor configurado em unidade ambígua confunde clientes.**
"R$ 50" sem unidade é confuso; "por hora", "por diária", "por serviço" mudam tudo. AC-029-3 exige unidade — mas se prestador escolhe errado, sistema não detecta. Cliente entende uma coisa, prestador outra — fricção pós-manifestação de interesse.

✅ RESOLVIDO (dono do intent): enum fechado controlado pelo catálogo (consistente com D-007). Impacto técnico: nenhum.

**F5. Race condition: Pessoa publica simultaneamente como PF e em nome de Empresa — confusão de identidade do publisher.**
Pessoa começa cadastro como PF, depois muda para "em nome de Empresa X". Persistência guarda metade num modo, metade no outro.

✅ RESOLVIDO (ADR-0020 / TD §4.4): `publicarServico(input, comoPFouEmpresa)` captura a escolha PF vs Empresa e faz a publicação numa única transação atômica (sem estado meio-PF-meio-Empresa).

## 4. Cenários de sucesso

**Nível operacional:**
- Prestador PF cadastra serviço → escolhe "publicar como eu" → preenche campos → submete → moderação aprova → ativo.
- Empresa-responsável cadastra serviço em nome da Empresa → escolhe "publicar em nome de Empresa X" → submete → moderação aprova → ativo.
- Serviço descobrível em USP-030 → clientes manifestam interesse (USP-033).

**Nível agregado:**
- **MP5** — número de serviços publicados e ativos. Diferencial do Portal vs portais comerciais de serviço (curadoria).

## 5. Conexões

**USPs upstream:** USP-010 (papel prestador PF) ou USP-012 + USP-013 (responsável de Empresa), USP-043 (consentimento finalidade 3).

**USPs downstream:** USP-016 (moderação), USP-030/USP-031 (descoberta pública), USP-032 (editar/pausar), USP-033 (manifestação de interesse), USP-035 (prestador vê interesses).

**ADRs aplicáveis:** ADR-0014 (Empresa sem login — escolha "PF" vs "em nome de Empresa"), ADR-0015 (moderação humana pré-publicação).

**Métricas tocadas:** MP5 (serviços publicados).

**Riscos relacionados:** Risco proposto: serviço ilegal/fraudulento publicado (mitigado por USP-016). Risco proposto: foto com PII de terceiros. Risco proposto: prestador PF se passa por Empresa não cadastrada.

**Dependências:** D-002 (termo de responsabilidade do prestador), D-007 (catálogo de categorias).

**Q-abertas:** —
