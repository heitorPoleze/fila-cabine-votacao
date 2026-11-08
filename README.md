# fila-cabine-votacao

Atividade de fila da disciplina Estrutura de Dados em TypeScript.

API em Express + MySQL (`mysql2`).

## Requisitos

- MySQL 8.0.16+ (o `CHECK` do dígito do partido depende disso)

## Setup

```bash
npm install
cp .env.example .env   # preenche DB_USER / DB_PASSWORD
npm run db:migrate     # cria o banco DB_NAME e as tabelas (opcional)
npx nodemon            # ou npm run dev
```

O servidor também executa o `schema.sql` toda vez que sobe (`src/database/schema.ts`):
cria o banco e qualquer tabela que falte, então uma tabela nova no schema não derruba o servidor.
O arquivo é idempotente (`CREATE TABLE IF NOT EXISTS` / `INSERT IGNORE`).


## Estrutura

```
src/
  config/       env e pool do MySQL
  database/     schema.sql + migrate.ts
  domain/       models e a fila (DoublyLinkedList)
  repository/   acesso ao banco
  services/     regras de negócio
  controllers/  handlers HTTP
  routes/       rotas do Express
```

## Convenções

- **Banco em `snake_case`, JSON em `camelCase`.** Os models fazem a conversão: `fromRow()` lê a linha do banco e `toJSON()` monta o JSON de saída.
- `CandidatoRow` espera `partido_nome` e `partido_digito`, então as queries de candidato precisam de `JOIN` com `partido` e desses aliases.
- Mudou um model? Atualize o `schema.sql` no mesmo commit. Como não há versionamento de migrações, para alterar uma tabela que já existe é preciso dropá-la ou rodar um `ALTER` manual.

## Administrador padrão

Ao subir, o servidor cria na tabela `administrador` o admin padrão do sistema, se ele ainda não existir:
**login `admin`, senha `admin`** (dá para trocar com `ADMIN_USER` / `ADMIN_PASSWORD` no `.env`).
A senha fica guardada só como hash (scrypt).

## Fila em tempo real (WebSocket)

O servidor abre um WebSocket em `ws://localhost:<PORT>/ws` (código em `src/controllers/filaSocket.ts`).
As filas ficam em memória numa `DoublyLinkedList` (`src/services/FilaService.ts`), e quem está aguardando também é gravado na tabela `usuario`, então a fila volta depois de um restart.

Regras:
- a fila preferencial é sempre chamada antes da comum, e só uma pessoa ocupa a cabine por vez;
- o **administrador chama** cada pessoa para a cabine (`proximoAVotar()`, botão "Chamar próximo" / `POST /fila/proximo`). Depois do voto a cabine fica livre até o admin chamar o próximo. Com `CHAMADA_AUTOMATICA=true` o próximo é chamado sozinho;
- quando alguém sai da fila, a posição (`posicaoNaFila`) de quem estava atrás é decrementada (memória e banco). `senha` é o número fixo do ticket;
- ao subir com a fila vazia, o servidor enche a fila com **30 pessoas mock** (`SEED_MOCK=true`, `MOCK_QTD=30`): 1 em cada 3 na preferencial (10 preferenciais e 20 comuns). Quando o admin chama uma delas, ela vota sozinha em A ou B depois de ~`MOCK_VOTO_MS` (3 s).

| Cliente → servidor | payload | efeito |
| --- | --- | --- |
| `fila:entrar` | `{ nome, tipoFila }` | entra na fila e devolve o usuário com a `chave` do ticket |
| `fila:remover` | `{ id, chave }` | o próprio eleitor sai da fila |
| `fila:estado` | – | devolve o estado atual |

| Servidor → todos | payload | quando |
| --- | --- | --- |
| `fila:estado` | filas (cada um com `posicaoNaFila` e `aFrente`), `naCabine` | a cada mudança |
| `fila:proximo` | usuário | alguém foi chamado: é quem pode votar |
| `voto:novo` | voto | alguém votou |

Toda mensagem do cliente leva um `requestId`, e o servidor responde com `{ type: "resposta", requestId, ok, data | erro }`.

## API REST

| Método e rota | Acesso | O que faz |
| --- | --- | --- |
| `POST /auth/login` `{ nome, senha }` | público | login do admin (tabela `administrador`), devolve token |
| `GET /auth/me` | token | confere o token |
| `GET /fila` | público | estado completo |
| `GET /fila/posicoes` | público | posição atual de todos e quem pode votar |
| `POST /fila` `{ nome, tipoFila }` | público | entra na fila |
| `POST /fila/proximo` | admin | `proximoAVotar()` |
| `POST /fila/liberar` | admin | libera a cabine sem voto |
| `POST /fila/reiniciar` | admin | recomeça do zero: esvazia filas e cabine, apaga os votos, senhas voltam a P001/C001 e enche a fila de novo |
| `POST /fila/mock` | admin | coloca mais `MOCK_QTD` (30) pessoas mock na fila |
| `DELETE /fila/:id` | admin | tira alguém da fila |
| `GET /candidatos` | público | candidatos A e B |
| `POST /votos` `{ usuarioId, chave, candidatoId }` | quem está na cabine | registra o voto, libera a cabine e a fila anda |
| `GET /resultados` | público | resultados parciais: array dos candidatos com o total de votos de cada um |
| `GET /votos/resultado` | público | mesmo conteúdo de `/resultados` |
| `GET /votos` | admin | relatório: quem votou em quem, horário, tempo para votar e tempo na fila |

Rotas de admin pedem `Authorization: Bearer <token>`. Toda resposta traz o header `X-Tempo-Processamento` (ms).
