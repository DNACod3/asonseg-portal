# ADR-0005 (Técnico) — Storage de arquivos sensíveis em Supabase Storage com URLs assinadas

- **Status:** Aceito — Reescrito para Release 1 (Portal MVP) em 2026-05-22
- **Data:** 2026-05-22
- **Decisores:** Bravi Arquiteto/Tech Lead, Bravi PO
- **Tags:** storage | seguranca | lgpd | conteudo-publico

## Contexto e Problema

O Portal MVP precisa armazenar três classes de arquivos enviados pelos usuários:

1. **CVs de candidatos** (PDF, DOC, DOCX) — até 5MB cada (AC-040-1). Estimativa: ~500 candidatos × 1MB médio = ~500MB no primeiro ano. Sensibilidade alta — contém dados pessoais (CPF, telefone, endereço, histórico profissional). Acesso por empresas autorizadas após candidatura. Também alimenta a extração via LLM (ADR-T-0012) — payload do CV é enviado a provedor externo, então tratamento de privacidade tem que ser consistente.

2. **Fotos de prestadores** (JPG, PNG) — até 2MB cada. Estimativa: ~150 prestadores × 200KB médio = ~30MB. Sensibilidade média — fotos são públicas no perfil do prestador no portal (AC-031). Não precisam de URL assinada para visualização pública, mas armazenamento ainda precisa ser controlado (substituição, exclusão).

3. **Termos de consentimento digitalizados** (PDF, JPG, PNG) — até 10MB. Volume relevante apenas no Release 2 (Frente 4). Pode entrar no MVP se a operação social mínima começar antes do go-live do Release 2.

Visibilidade dos arquivos varia: CV é privado (URL assinada com TTL curto), foto de prestador é pública (URL direta do bucket público), termo é privado (URL assinada com TTL curto).

D-008 da Frente 4 (tamanho máximo do termo) foi resolvida em 10MB. Para o Portal, AC-040-1 já define 5MB para o CV. Para foto, definimos 2MB neste ADR.

## Drivers de Decisão

- Custo mínimo (ADR-0010 de negócio)
- Confidencialidade dos arquivos privados (CV, termo) — não pode haver URL pública que vaze
- Auditabilidade do acesso (quem viu CV de quem, e quando)
- Suporte simultâneo a buckets privados e públicos no mesmo provedor
- Foto pública precisa ter URL estável (para o navegador cachear e para SEO futuro), enquanto CV/termo precisam de URL volátil

## Opções Consideradas

### Opção A — Tudo em bucket privado, fotos servidas via proxy server-side

**Descrição:** todos os arquivos em buckets privados; foto de prestador é servida via Server Action / Route Handler que lê do storage e devolve no response.

- **Prós:** controle total; uniformidade
- **Contras:** foto sai do servidor a cada visualização (consumo de bandwidth Vercel); sem cache pelo navegador; lento e caro

### Opção B — Bucket privado para CV e termo (URLs assinadas), bucket público para foto (escolhida)

**Descrição:** dois bucket types com tratamento diferente:
- **Privado:** `cvs`, `consent-terms` — acesso via URL assinada gerada server-side após verificação de permissão; TTL 5 minutos
- **Público:** `provider-photos` — URL direta do CDN do Supabase (público no nível do bucket); UUID no nome do arquivo evita listagem por bruteforce

- **Prós:** foto cacheada pelo CDN (bandwidth controlado); CV/termo continuam protegidos por URL assinada; mesmo provedor; cada classe de arquivo tratada conforme sua sensibilidade
- **Contras:** dois modelos de acesso para o time conhecer; URL pública da foto é "indelével" (mesmo após substituir, browsers e CDN podem cachear a antiga por algum tempo — aceitável para foto)

### Opção C — Object storage externo dedicado por classe de arquivo

**Descrição:** CV em Backblaze B2, foto em Cloudflare R2, etc.

- **Prós:** otimização fina por classe
- **Contras:** mais de um provedor, mais de um secret, mais SDK; ganho marginal no porte ASONSEG

## Decisão

Adotamos a **Opção B — Bucket privado para CV/termo + bucket público para foto**, com a seguinte configuração:

### Buckets

| Bucket | Visibilidade | Tipo de arquivo | Tamanho máx | TTL signed URL | Path |
|---|---|---|---|---|---|
| `cvs` | Privado | PDF, DOC, DOCX | 5 MB | 5 min | `cvs/{person_id}/{uuid}.{ext}` |
| `consent-terms` | Privado | PDF, JPG, PNG | 10 MB | 5 min | `consent-terms/{person_id}/{purpose}/{uuid}.{ext}` |
| `provider-photos` | Público | JPG, PNG | 2 MB | n/a (URL direta) | `provider-photos/{person_id}/{uuid}.{ext}` |

### Padrões de operação

**Upload (todos os buckets):**
- Realizado via **Server Action**, nunca diretamente do cliente para o storage
- Server Action valida MIME real (via lib `file-type`) — não confiar em extensão nem em Content-Type do cliente
- Verifica permissão antes do upload
- Após upload, persiste path na tabela correspondente (`candidate_profiles.cv_storage_path`, `provider_profiles.photo_storage_path`, `consent_terms.storage_path`)
- Registra evento de upload no audit_log

**Download/visualização — bucket privado:**
- Cliente solicita via Server Action (ex.: `getCVDownloadUrl(candidatePersonId, viewerContext)`)
- Server Action verifica permissão de visibilidade (ADR-T-0010 + visibilidade conservadora ADR-0017 de negócio):
  - CV completo: empresa pode ver **apenas se houver candidatura ativa** do candidato a uma vaga da empresa
  - Termo: apenas AS, diretoria ou DPO
- Gera URL assinada com TTL **5 minutos** via `supabase.storage.from(bucket).createSignedUrl(path, 300)`
- Registra `CV_VIEWED_BY_EMPLOYER` ou `CONSENT_TERM_ACCESSED` no audit_log

**Visualização — bucket público (foto):**
- URL direta do CDN, montada no client a partir do `photo_storage_path` persistido
- Sem audit log de visualização (foto é pública por contrato)
- Substituição: novo upload com novo UUID + soft delete do path antigo

### Exclusão e substituição

- **Soft delete** na tabela (coluna `deleted_at` ou flag de status); objeto físico no Storage removido por job semanal após 30 dias de tolerância
- Substituição de CV (candidato faz upload novo): novo UUID; CV anterior fica soft-deleted; alimentação automática da extração via LLM (ADR-T-0012) é refeita
- Substituição de foto: idem, mas observar que URL pública anterior pode estar cacheada por horas em CDNs e navegadores

### Política de retenção do storage

- **CV ativo:** retido enquanto o candidato tiver perfil ativo (sem prazo automático no MVP)
- **CV de candidato inativado:** mantido em soft delete por **180 dias** após inativação para suportar reivindicação ou auditoria — depois purge físico
- **Termo de consentimento:** retenção indefinida enquanto a Pessoa existir (ADR-0013 de negócio, finalidade ativa)
- **Termo de consentimento revogado:** retido por **5 anos** após revogação para fins de comprovação legal (LGPD art. 7º §5)
- **Foto de prestador:** mantida enquanto serviço ativo; soft delete após inativação do perfil; purge físico em 90 dias

### Não-uso de policies do Supabase Storage

Coerente com ADR-0003 (técnico) — autorização aplicacional sem RLS — **não usamos policies de Storage do Supabase**. Acesso é sempre mediado por Server Action que verifica permissão antes de gerar URL assinada (privado) ou consultar path persistido (público).

## Consequências

**Positivas:**
- Custo zero adicional no MVP (cabe nos Free tiers)
- CV e termo permanecem protegidos por URL volátil + audit log
- Foto de prestador é servida via CDN sem custar bandwidth da Vercel
- Backup do storage é coberto pelo ADR-0006 (sync diário do bucket privado; foto pública também sincronizada como precaução)
- Substituição/exclusão tem política de retenção definida — não fica indefinido

**Negativas (trade-offs aceitos):**
- URL pública de foto pode persistir em caches por algum tempo após substituição — aceitável para foto de prestador
- Dois modelos de acesso para o time absorver (mitigado pela centralização em helpers e pelo project-guideline)

**Neutras / a monitorar:**
- Se volume de CV exceder ~50GB, custo de storage no Supabase Pro sobe (US$ 0,021/GB acima do limite) — projeção atual: longe disso
- Foto pública pode virar superfície de ataque por upload de imagem maliciosa (XSS via SVG, p.ex.) — formato whitelist (JPG, PNG apenas) descarta SVG; validação MIME real reforça

## Riscos e Mitigações

**Risco 1 — URL assinada de CV é encaminhada por engano** (empresa compartilha o link com outra pessoa). **Mitigação:** TTL 5 minutos limita janela; cada geração de URL gera audit log com IP da empresa que solicitou.

**Risco 2 — Upload de arquivo malicioso disfarçado** (executável renomeado, PDF com payload). **Mitigação:** validação MIME real via `file-type` server-side; whitelist explícita. Antivírus ativo está fora do escopo do MVP — risco residual aceito pelo baixo volume e público controlado.

**Risco 3 — Foto pública pode ser indexada por buscadores futuramente** (quando SEO entrar em V2). **Mitigação:** path inclui UUID (não enumerável); resposta do bucket público pode receber header `X-Robots-Tag: noindex` para imagens individuais se necessário (decidir junto com SEO em V2).

**Risco 4 — Inconsistência entre tabela e storage após restore parcial** (banco restaurado apontando para arquivos que não existem). **Mitigação:** procedimento de restore (runbook do ADR-0006) prevê restore de storage **antes** do banco.

## Referências

- PRD MVP Portal §3.1 (in-scope), AC-009-2, AC-031, AC-040-1, USP-040, USP-043
- ADR-0003 (técnico) — autorização aplicacional sem RLS
- ADR-0004 (técnico) — audit log
- ADR-0006 (técnico) — backup duplo
- ADR-T-0010 — visibilidade conservadora (referenciado)
- ADR-T-0012 — integração com LLM (alimenta-se do CV armazenado)
- LGPD art. 7º §5 (retenção pós-revogação)
- Lentes do arquiteto: Custo, Data Flow & Ownership, Fail-Fast & Blast Radius
