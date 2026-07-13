# Contas de teste do seed de validação

> **Ambiente:** apenas **dev** e **staging** — este seed nunca roda em produção.
> Gerado por `prisma/seeds/bulk.ts` (via `npm run db:seed` / `npm run db:seed:staging`).
> Idempotente: os e-mails, senhas e funções abaixo são estáveis a cada re-execução.

## Credenciais

- **Senha (todas as contas):** `asonseg2026`
- **Domínio dos e-mails:** `@seed.asonseg.dev` (fictício — nenhum e-mail é enviado)
- **Total de contas login-áveis:** 112

Para logar: `/login` com o e-mail da tabela e a senha `asonseg2026`.

> **Nota (HYG-12):** o Supabase Auth reusa a credencial por e-mail em re-execuções
> idempotentes do seed — contas já existentes **não** têm a senha reaplicada. Se
> você semeou o banco antes desta mudança (senha antiga `12345678`), rode
> `supabase db reset` (ou recrie os usuários de Auth) e reaplique o seed para
> propagar a nova senha às contas pré-existentes.

## Coordenador(a) (3)

Papel interno. Possui **todas** as permissões delegáveis (moderação de vaga/CV/serviço, validação de 1ª vaga, encaminhamento, aprovação de categorias/credenciais etc.).

| E-mail (login) | Nome | Função |
|---|---|---|
| `coordenador01@seed.asonseg.dev` | Ana Souza | Coordenador(a) |
| `coordenador02@seed.asonseg.dev` | Bruno Pereira | Coordenador(a) |
| `coordenador03@seed.asonseg.dev` | Carla Almeida | Coordenador(a) |

## Assistente Social (3)

Papel interno. Faz **cadastro assistido**, **encaminhamentos** e edita **fichas socioeconômicas**.

| E-mail (login) | Nome | Função |
|---|---|---|
| `assistente01@seed.asonseg.dev` | Daniel Araújo | Assistente Social |
| `assistente02@seed.asonseg.dev` | Eduarda Gomes | Assistente Social |
| `assistente03@seed.asonseg.dev` | Felipe Ribeiro | Assistente Social |

## Diretoria (3)

Papel interno (diretoria) — visão institucional/relatórios.

| E-mail (login) | Nome | Função |
|---|---|---|
| `diretoria01@seed.asonseg.dev` | Gabriela Cardoso | Diretoria |
| `diretoria02@seed.asonseg.dev` | Henrique Correia | Diretoria |
| `diretoria03@seed.asonseg.dev` | Isabela Silva | Diretoria |

## Voluntário(a) (3)

Papel interno. Recebem permissões **delegadas** pelo coordenador (moderar vaga + moderar serviço).

| E-mail (login) | Nome | Função |
|---|---|---|
| `voluntario01@seed.asonseg.dev` | João Santos | Voluntário(a) |
| `voluntario02@seed.asonseg.dev` | Larissa Rodrigues | Voluntário(a) |
| `voluntario03@seed.asonseg.dev` | Marcos Lima | Voluntário(a) |

## Responsável por Empresa (empregador) (25)

Empregador. Cada conta é responsável pela Empresa **"Guadalupe NN"** correspondente (empresa06/12/18/24 ficam **não verificadas** — validam a regra "empresa não verificada não aparece na busca"). Publicam e gerenciam vagas.

| E-mail (login) | Nome | Função |
|---|---|---|
| `empresa01@seed.asonseg.dev` | Natália Carvalho | Responsável por Empresa (empregador) |
| `empresa02@seed.asonseg.dev` | Otávio Rocha | Responsável por Empresa (empregador) |
| `empresa03@seed.asonseg.dev` | Paula Monteiro | Responsável por Empresa (empregador) |
| `empresa04@seed.asonseg.dev` | Rafael Teixeira | Responsável por Empresa (empregador) |
| `empresa05@seed.asonseg.dev` | Sabrina Moraes | Responsável por Empresa (empregador) |
| `empresa06@seed.asonseg.dev` | Thiago Oliveira | Responsável por Empresa (empregador) |
| `empresa07@seed.asonseg.dev` | Vanessa Costa | Responsável por Empresa (empregador) |
| `empresa08@seed.asonseg.dev` | William Nascimento | Responsável por Empresa (empregador) |
| `empresa09@seed.asonseg.dev` | Beatriz Fernandes | Responsável por Empresa (empregador) |
| `empresa10@seed.asonseg.dev` | Caio Martins | Responsável por Empresa (empregador) |
| `empresa11@seed.asonseg.dev` | Débora Alves | Responsável por Empresa (empregador) |
| `empresa12@seed.asonseg.dev` | Elias Barbosa | Responsável por Empresa (empregador) |
| `empresa13@seed.asonseg.dev` | Fernanda Dias | Responsável por Empresa (empregador) |
| `empresa14@seed.asonseg.dev` | Gustavo Souza | Responsável por Empresa (empregador) |
| `empresa15@seed.asonseg.dev` | Helena Pereira | Responsável por Empresa (empregador) |
| `empresa16@seed.asonseg.dev` | Juliana Almeida | Responsável por Empresa (empregador) |
| `empresa17@seed.asonseg.dev` | Kléber Araújo | Responsável por Empresa (empregador) |
| `empresa18@seed.asonseg.dev` | Letícia Gomes | Responsável por Empresa (empregador) |
| `empresa19@seed.asonseg.dev` | Ana Ribeiro | Responsável por Empresa (empregador) |
| `empresa20@seed.asonseg.dev` | Bruno Cardoso | Responsável por Empresa (empregador) |
| `empresa21@seed.asonseg.dev` | Carla Correia | Responsável por Empresa (empregador) |
| `empresa22@seed.asonseg.dev` | Daniel Silva | Responsável por Empresa (empregador) |
| `empresa23@seed.asonseg.dev` | Eduarda Santos | Responsável por Empresa (empregador) |
| `empresa24@seed.asonseg.dev` | Felipe Rodrigues | Responsável por Empresa (empregador) |
| `empresa25@seed.asonseg.dev` | Gabriela Lima | Responsável por Empresa (empregador) |

## Candidato(a) (25)

Busca emprego. Possui **perfil de candidato** (a maioria ACTIVE → aparece na busca ativa), **candidaturas** e **ficha socioeconômica**.

| E-mail (login) | Nome | Função |
|---|---|---|
| `candidato01@seed.asonseg.dev` | Henrique Carvalho | Candidato(a) |
| `candidato02@seed.asonseg.dev` | Isabela Rocha | Candidato(a) |
| `candidato03@seed.asonseg.dev` | João Monteiro | Candidato(a) |
| `candidato04@seed.asonseg.dev` | Larissa Teixeira | Candidato(a) |
| `candidato05@seed.asonseg.dev` | Marcos Moraes | Candidato(a) |
| `candidato06@seed.asonseg.dev` | Natália Oliveira | Candidato(a) |
| `candidato07@seed.asonseg.dev` | Otávio Costa | Candidato(a) |
| `candidato08@seed.asonseg.dev` | Paula Nascimento | Candidato(a) |
| `candidato09@seed.asonseg.dev` | Rafael Fernandes | Candidato(a) |
| `candidato10@seed.asonseg.dev` | Sabrina Martins | Candidato(a) |
| `candidato11@seed.asonseg.dev` | Thiago Alves | Candidato(a) |
| `candidato12@seed.asonseg.dev` | Vanessa Barbosa | Candidato(a) |
| `candidato13@seed.asonseg.dev` | William Dias | Candidato(a) |
| `candidato14@seed.asonseg.dev` | Beatriz Souza | Candidato(a) |
| `candidato15@seed.asonseg.dev` | Caio Pereira | Candidato(a) |
| `candidato16@seed.asonseg.dev` | Débora Almeida | Candidato(a) |
| `candidato17@seed.asonseg.dev` | Elias Araújo | Candidato(a) |
| `candidato18@seed.asonseg.dev` | Fernanda Gomes | Candidato(a) |
| `candidato19@seed.asonseg.dev` | Gustavo Ribeiro | Candidato(a) |
| `candidato20@seed.asonseg.dev` | Helena Cardoso | Candidato(a) |
| `candidato21@seed.asonseg.dev` | Juliana Correia | Candidato(a) |
| `candidato22@seed.asonseg.dev` | Kléber Silva | Candidato(a) |
| `candidato23@seed.asonseg.dev` | Letícia Santos | Candidato(a) |
| `candidato24@seed.asonseg.dev` | Ana Rodrigues | Candidato(a) |
| `candidato25@seed.asonseg.dev` | Bruno Lima | Candidato(a) |

## Prestador(a) de Serviço (25)

Oferece serviços. Possui **perfil de prestador** e **serviços** publicados (vários estados de moderação).

| E-mail (login) | Nome | Função |
|---|---|---|
| `prestador01@seed.asonseg.dev` | Carla Carvalho | Prestador(a) de Serviço |
| `prestador02@seed.asonseg.dev` | Daniel Rocha | Prestador(a) de Serviço |
| `prestador03@seed.asonseg.dev` | Eduarda Monteiro | Prestador(a) de Serviço |
| `prestador04@seed.asonseg.dev` | Felipe Teixeira | Prestador(a) de Serviço |
| `prestador05@seed.asonseg.dev` | Gabriela Moraes | Prestador(a) de Serviço |
| `prestador06@seed.asonseg.dev` | Henrique Oliveira | Prestador(a) de Serviço |
| `prestador07@seed.asonseg.dev` | Isabela Costa | Prestador(a) de Serviço |
| `prestador08@seed.asonseg.dev` | João Nascimento | Prestador(a) de Serviço |
| `prestador09@seed.asonseg.dev` | Larissa Fernandes | Prestador(a) de Serviço |
| `prestador10@seed.asonseg.dev` | Marcos Martins | Prestador(a) de Serviço |
| `prestador11@seed.asonseg.dev` | Natália Alves | Prestador(a) de Serviço |
| `prestador12@seed.asonseg.dev` | Otávio Barbosa | Prestador(a) de Serviço |
| `prestador13@seed.asonseg.dev` | Paula Dias | Prestador(a) de Serviço |
| `prestador14@seed.asonseg.dev` | Rafael Souza | Prestador(a) de Serviço |
| `prestador15@seed.asonseg.dev` | Sabrina Pereira | Prestador(a) de Serviço |
| `prestador16@seed.asonseg.dev` | Thiago Almeida | Prestador(a) de Serviço |
| `prestador17@seed.asonseg.dev` | Vanessa Araújo | Prestador(a) de Serviço |
| `prestador18@seed.asonseg.dev` | William Gomes | Prestador(a) de Serviço |
| `prestador19@seed.asonseg.dev` | Beatriz Ribeiro | Prestador(a) de Serviço |
| `prestador20@seed.asonseg.dev` | Caio Cardoso | Prestador(a) de Serviço |
| `prestador21@seed.asonseg.dev` | Débora Correia | Prestador(a) de Serviço |
| `prestador22@seed.asonseg.dev` | Elias Silva | Prestador(a) de Serviço |
| `prestador23@seed.asonseg.dev` | Fernanda Santos | Prestador(a) de Serviço |
| `prestador24@seed.asonseg.dev` | Gustavo Rodrigues | Prestador(a) de Serviço |
| `prestador25@seed.asonseg.dev` | Helena Lima | Prestador(a) de Serviço |

## Cliente (25)

Contrata serviços. Possui **perfil de cliente** e **manifestações de interesse** em serviços.

| E-mail (login) | Nome | Função |
|---|---|---|
| `cliente01@seed.asonseg.dev` | Juliana Carvalho | Cliente |
| `cliente02@seed.asonseg.dev` | Kléber Rocha | Cliente |
| `cliente03@seed.asonseg.dev` | Letícia Monteiro | Cliente |
| `cliente04@seed.asonseg.dev` | Ana Teixeira | Cliente |
| `cliente05@seed.asonseg.dev` | Bruno Moraes | Cliente |
| `cliente06@seed.asonseg.dev` | Carla Oliveira | Cliente |
| `cliente07@seed.asonseg.dev` | Daniel Costa | Cliente |
| `cliente08@seed.asonseg.dev` | Eduarda Nascimento | Cliente |
| `cliente09@seed.asonseg.dev` | Felipe Fernandes | Cliente |
| `cliente10@seed.asonseg.dev` | Gabriela Martins | Cliente |
| `cliente11@seed.asonseg.dev` | Henrique Alves | Cliente |
| `cliente12@seed.asonseg.dev` | Isabela Barbosa | Cliente |
| `cliente13@seed.asonseg.dev` | João Dias | Cliente |
| `cliente14@seed.asonseg.dev` | Larissa Souza | Cliente |
| `cliente15@seed.asonseg.dev` | Marcos Pereira | Cliente |
| `cliente16@seed.asonseg.dev` | Natália Almeida | Cliente |
| `cliente17@seed.asonseg.dev` | Otávio Araújo | Cliente |
| `cliente18@seed.asonseg.dev` | Paula Gomes | Cliente |
| `cliente19@seed.asonseg.dev` | Rafael Ribeiro | Cliente |
| `cliente20@seed.asonseg.dev` | Sabrina Cardoso | Cliente |
| `cliente21@seed.asonseg.dev` | Thiago Correia | Cliente |
| `cliente22@seed.asonseg.dev` | Vanessa Silva | Cliente |
| `cliente23@seed.asonseg.dev` | William Santos | Cliente |
| `cliente24@seed.asonseg.dev` | Beatriz Rodrigues | Cliente |
| `cliente25@seed.asonseg.dev` | Caio Lima | Cliente |

## Pessoas pré-cadastradas (sem login)

Além das contas acima, o seed cria **20 pessoas pré-cadastradas SEM credencial** (não logam), cada uma com uma **reivindicação de credencial PENDENTE** — servem para validar a fila de aprovação de credencial da Assistente Social. E-mails solicitados no padrão `claimNN@seed.asonseg.dev`.

---

_Documento gerado a partir do banco semeado. Para regenerar após mudar `prisma/seeds/bulk.ts`, rode o seed e recrie este arquivo._
