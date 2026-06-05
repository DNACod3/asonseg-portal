---
version: social-assistance-evidence@v1.0
purpose: SOCIAL_ASSISTANCE
relates_to: social-assistance@v1.0
status: aprovado
approved_by: jurídico/DPO
approved_date: 2026-06-05
gate: D-002 (liberado em 2026-06-05)
legal_basis: LGPD art. 7º, I e art. 11, I (consentimento para dado sensível)
---

# Registro de Evidência de Consentimento — Atendimento Social (Finalidade 6)

> **Status:** **aprovado** pelo jurídico/DPO em 2026-06-05 — **gate D-002 liberado**.
> O modelo de evidência de consentimento em papel para esta via foi confirmado por
> escrito como adequado à LGPD e cobrindo o ADR-0013 (finalidade 6). Quanto à USP-002,
> este gate não bloqueia mais o go-live. Não é carregada pelo `term-loader` (não é um
> termo de aceite eletrônico): é o texto-atestado que materializa a evidência de E-004.

## Texto do atestado

Declaro, na qualidade de assistente social responsável pelo atendimento, que nesta
data colhi presencialmente o consentimento livre, informado e inequívoco do(a)
titular para o tratamento de seus dados pessoais, **inclusive dados sensíveis**, com
a finalidade de atendimento socioassistencial, nos termos do Termo de Consentimento
"Atendimento Social" (referência `social-assistance@v1.0`), com fundamento no
**art. 7º, I** e no **art. 11, I da LGPD**.

O aceite foi firmado em **via física**, assinada pelo(a) titular, a qual permanece
arquivada na sede da ASONSEG e é referenciável por este registro. O(A) titular foi
informado(a) sobre as finalidades do tratamento, a base legal, o caráter facultativo
do consentimento e os direitos do art. 18 da LGPD, incluindo o de **revogá-lo a
qualquer tempo**.

Este registro eletrônico, lavrado de forma imutável no log de auditoria do sistema,
**atesta** a coleta do consentimento em papel e **não substitui** a via física
assinada.

## Campos registrados (bloco `paperConsent` no audit do cadastro — E-004)

O evento de auditoria `PERSON_CREATED_BY_AS` grava, no campo `after`, sem PII:

| Campo | Origem | Cobre o elemento de E-004 |
|---|---|---|
| `purpose` = `SOCIAL_ASSISTANCE` | finalidade 6 (ADR-0013) | — |
| `termVersion` = `social-assistance@v1.0` | `terms-registry` | **referência ao termo** + **versão** |
| `termContentHash` | `terms-registry` (SHA-256 do termo) | fixa o conteúdo aceito |
| `consentChannel` = `PAPER` | constante | canal do aceite |
| `signedOnPaperAt` | informado pela AS (ou data do cadastro) | **data** |
| `actorPersonId` (do evento) | sessão da AS (ADR-0030) | **responsável (AS)** |
| `occurredAt` (do evento) | timestamp imutável | data/hora do registro |

## Aprovação (D-002)

- **2026-06-05** — DPO/jurídico confirmou que (a) este modelo de evidência de
  consentimento em papel cobre a finalidade 6 do ADR-0013 e (b) a marca de exceção
  + justificativa constituem evidência adequada para a LGPD; e **validou a redação**
  do texto do atestado acima. Gate D-002 **liberado**.
