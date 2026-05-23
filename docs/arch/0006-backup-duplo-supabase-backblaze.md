# ADR-0006 (Técnico) — Estratégia de backup duplo: Supabase nativo + dump externo em Backblaze B2

- **Status:** Aceito — Estendido ao Release 1 (Portal MVP) em 2026-05-22
- **Data:** 2026-05-22
- **Decisores:** Bravi Arquiteto/Tech Lead, Bravi PO
- **Tags:** infra | backup | continuidade | custo

## Nota de extensão — Release 1 (Portal MVP)

Decisão **inteiramente válida sem alteração**. RPO 24h, RTO 2-4h, retenção 30 dias rolling, backup duplo (Supabase nativo + dump externo em Backblaze B2 via GitHub Actions cron), criptografia AES-256-CBC com openssl, drill de restore obrigatório na Fase 0.

A única expansão é no **escopo do sync de storage**: o bucket Supabase agora cobre não só termos digitalizados (Frente 4 — Release 2) mas também:
- **CVs de candidatos** (PDF/DOC/DOCX até 5MB cada) — bucket `cvs`
- **Fotos de prestadores** (JPG/PNG) — bucket `provider-photos`

Todos cobertos pelo mesmo workflow de `rclone sync` diário para o destino B2. Crescimento estimado: ~500 candidatos × 1MB médio = ~500MB de CVs no primeiro ano, ainda confortável no Free tier do Supabase (1GB) e barato no B2.

Os 4 riscos e mitigações originais (passphrase, drill, conta GitHub, conta B2) permanecem.

---

## Contexto e Problema

ADR-0010 de negócio reconhece que "perda de cadastro de família = irreparável" — o histórico institucional de atendimento (vínculos temporais, indicações, entregas, vendas, audit log) é insubstituível.

O cliente respondeu na Rodada 1 de perguntas arquiteturais pela **Opção A — backup diário com retenção 30 dias** (RPO ~24h, RTO ~2-4h) como postura aceitável, descartando a Opção B (PITR contínuo) e a Opção C (semanal).

Era necessário decidir como implementar essa postura sobre a plataforma escolhida (Vercel + Supabase, ADR-0002) e cobrir não apenas o banco mas também o storage de termos digitalizados (ADR-0005).

## Drivers de Decisão

- **RPO alvo:** 24 horas
- **RTO alvo:** 2-4 horas para restore completo
- **Retenção:** 30 dias rolling
- **Custo:** mínimo (ADR-0010)
- **Cobertura:** banco Postgres + bucket de storage
- **Independência:** backup precisa sobreviver a uma indisponibilidade total do provedor Supabase

## Opções Consideradas

### Opção A — Confiar exclusivamente no backup nativo do Supabase

**Descrição:** usar apenas o sistema de backup integrado do Supabase. Free tier oferece "daily backups" (mas com retenção curta e sem PITR); Pro tier oferece 7 dias de backup com PITR opcional pago.

- **Prós:** zero esforço de configuração; integrado ao painel
- **Contras:** se o projeto Supabase for deletado por engano, se a conta for suspensa, ou se a região tiver incidente prolongado, **o backup vai junto**; retenção do Free tier é curta (menos que 30 dias)
- **Custo:** US$ 0 no Free; incluso no Pro

### Opção B — Backup nativo do Supabase + dump externo diário em Backblaze B2 (escolhida)

**Descrição:** dois mecanismos:
1. **Backup nativo do Supabase** — retenção curta do provedor, restore rápido via painel quando aplicável
2. **Dump externo diário** — cron job (Vercel Cron ou GitHub Actions scheduled) que executa `pg_dump` da base, criptografa, e envia para bucket Backblaze B2 com retenção 30 dias

  Para o storage de termos: sync diário do bucket Supabase para Backblaze B2 (mesma estratégia).

- **Prós:** **independência total** entre os dois backups; sobrevive a remoção acidental do projeto Supabase, suspensão da conta, incidente regional prolongado; Backblaze B2 é S3-compatible (interoperabilidade); retenção rolling 30 dias explícita
- **Contras:** mais um secret (B2 API key); mais um cron para monitorar; mais um item de operação
- **Custo:** ~US$ 1-3/mês (banco dump ~50-200MB + termos ~200MB-1GB no horizonte de 6-12 meses)

### Opção C — Backup duplicado em mesma região AWS (Supabase nativo + dump em S3 sa-east-1)

**Descrição:** semelhante à Opção B mas com destino em S3 da AWS São Paulo.

- **Prós:** alta confiabilidade da AWS; mesma região
- **Contras:** ambos os backups vivem na infraestrutura AWS sa-east-1 — incidente regional afeta os dois; AWS é mais caro que Backblaze; mais um lock-in
- **Custo:** US$ 3-5/mês

## Decisão

Adotamos a **Opção B — backup duplo Supabase nativo + dump externo em Backblaze B2**.

**Arquitetura concreta:**

### 1. Backup nativo do Supabase
- Mantemos o backup automático do plano em uso (Free: daily snapshots com retenção curta; Pro: 7 dias de daily backups + PITR opcional)
- Não é monitorado proativamente — confiamos no provedor

### 2. Dump externo diário

**Tecnologia:** GitHub Actions com cron schedule diário às 03:00 BRT.

**Por que GitHub Actions e não Vercel Cron:** o job de dump precisa rodar `pg_dump` (binário nativo) e operações com arquivos grandes — ambiente de container do GitHub Actions é mais adequado que o runtime serverless da Vercel. Custo: GitHub Actions Free tier cobre folgadamente (job dura ~2-5 min/dia).

**Pseudo-fluxo:**
```yaml
# .github/workflows/backup.yml (esqueleto)
schedule: '0 6 * * *'  # 03:00 BRT = 06:00 UTC
steps:
  - install postgresql-client
  - pg_dump $SUPABASE_DB_URL --format=custom --no-owner > backup.dump
  - openssl enc -aes-256-cbc -salt -in backup.dump -out backup.dump.enc -pass env:BACKUP_PASSPHRASE
  - rclone copy backup.dump.enc b2:asonseg-backup/db/YYYY-MM-DD/
  - rclone delete --min-age 30d b2:asonseg-backup/db/  # retenção rolling
```

**Backup do storage (termos digitalizados):**
```yaml
# segunda step no mesmo workflow
  - rclone sync supabase-storage:consent-terms b2:asonseg-backup/storage/YYYY-MM-DD/ --backup-dir b2:asonseg-backup/storage/archive/YYYY-MM-DD/
  - rclone delete --min-age 30d b2:asonseg-backup/storage/
```

### 3. Criptografia em repouso no backup
- Dump do banco é criptografado com `openssl enc -aes-256-cbc` antes do upload — passphrase em GitHub secret, fora do repo
- Bucket Backblaze B2 tem encryption-at-rest nativa adicional (defesa em profundidade)

### 4. Monitoramento
- Job do GitHub Actions com `if: failure()` envia notificação para canal definido na Fase 0 (Slack ou e-mail da Bravi)
- Verificação semanal manual nas primeiras 4 semanas; depois, mensal — Tech Lead

### 5. Procedimento de restore (documentado em runbook separado, fora deste ADR)
- **RTO esperado:** 2-4 horas em incidente normal; 4-8 horas em desastre completo (provedor Supabase indisponível, precisa reprovisionar projeto novo)
- Restore documentado em `docs/architecture/runbooks/disaster-recovery.md` (a ser gerado durante a Fase 0)

### 6. Ambiente staging
- **Staging NÃO tem backup externo**. Backup nativo do Supabase Free cobre staging suficientemente — perda total de staging é recuperável com setup automatizado em poucas horas.

## Consequências

**Positivas:**
- **RPO real ~24h**, **RTO ~2-4h** atendem o requisito declarado pelo cliente
- Cenário catastrófico (perda do projeto Supabase inteiro) tem backup externo independente
- Backblaze B2 é o object storage mais barato do mercado (US$ 0,006/GB/mês — uma ordem de grandeza abaixo de AWS S3 standard)
- Estratégia de dump + sync via rclone é portável — mesma rotina funciona se mudarmos provedor de storage no futuro
- GitHub Actions free tier cobre o trabalho sem custo adicional

**Negativas (trade-offs aceitos):**
- RPO de 24h significa que até 24h de dados podem ser perdidos em desastre — ASONSEG aceitou explicitamente
- Mais uma rotina para monitorar — mitigado por alerta de falha automatizado
- Restore manual é trabalho de plantão (não é automatizado) — aceitável dado a baixa probabilidade de incidente

**Neutras / a monitorar:**
- Se o tamanho do dump ultrapassar 1GB, custo de armazenamento + transferência sobe — reavaliar política de retenção ou compressão adicional
- Se RTO de 2-4h ficar inaceitável após algum incidente, reavaliar PITR pago (~US$ 25/mês adicional no Supabase)

## Riscos e Mitigações

**Risco 1 — Passphrase de criptografia perdida torna o backup inútil.** **Mitigação:** passphrase armazenada em pelo menos **dois locais separados**: GitHub Secret (operacional) + cofre de senhas pessoal do Tech Lead/Arquiteto (recovery). Procedimento documentado.

**Risco 2 — Backup nunca foi testado e descobre-se que está quebrado quando precisa.** **Mitigação:** **drill de restore obrigatório** na Fase 0 antes do go-live, restaurando o dump em um Postgres local e validando integridade dos dados; repetir a cada 6 meses.

**Risco 3 — Conta GitHub da Bravi suspensa interrompe os jobs.** **Mitigação:** o backup nativo do Supabase continua funcionando como primeira linha; alerta de falha do workflow notifica imediatamente.

**Risco 4 — Conta Backblaze B2 suspensa ou bucket deletado.** **Mitigação:** alerta de falha do `rclone copy` notifica; backup nativo do Supabase cobre o gap enquanto a Bravi resolve.

## Referências

- PRD §6.2 (Disponibilidade)
- PRD §6.3 (Segurança)
- ADR-0010 de negócio (Custo mínimo — perda de cadastro de família é irreparável)
- ADR-0002 (técnico) — Vercel + Supabase
- ADR-0005 (técnico) — Storage de termos
- Lentes do arquiteto: Fail-Fast & Blast Radius, Custo, Data Flow & Ownership
