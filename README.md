# fila-cabine-votacao

Atividade de fila da disciplina Estrutura de Dados em TypeScript.

API em Express + MySQL (`mysql2`).

## Requisitos

- MySQL 8.0.16+ (o `CHECK` do dígito do partido depende disso)

## Setup

```bash
npm install
cp .env.example .env   # preenche DB_USER / DB_PASSWORD
npm run db:migrate     # cria o banco DB_NAME e as tabelas
npx nodemon            # ou npm run dev
```

## Rotas e Postman

Todas as rotas ficam em `/api/v1`. A collection do Postman com todas elas está em
[`postman/fila-cabine-votacao.postman_collection.json`](postman/fila-cabine-votacao.postman_collection.json).

**Para usar:** no Postman, **Import** → arraste o arquivo. As requests ficam separadas nas pastas Usuários, Voto e Candidatos (Resultado fica em Candidatos).

- `baseUrl` (variável da collection) vale `http://localhost:3000/api/v1`. Mude se usar outra `PORT`.
- **Criar usuário** guarda o `idUsuario` retornado na variável `idUsuario`, que as outras requests já usam.
- `idCandidato` começa em `2` (Lula). Os candidatos iniciais são `1` Anular, `2` Lula e `3` Flávio Bolsonaro.

| Método | Rota | Envia | Resposta |
|---|---|---|---|
| POST | `/usuarios` | `{nome, tipoFila: "PREFERENCIAL" \| "COMUM"}` | `201 {idUsuario, posicaoFila}` |
| GET | `/usuarios/posicao-na-fila?idUsuario=` | query | `200 {idUsuario, posicaoFila}` · 404 |
| POST | `/usuarios/logout` | `{idUsuario}` | `204` · 404 |
| POST | `/voto` | `{idUsuario, idCandidato}` | `201 [{idCandidato, qtdVotosTotal}]` · 403 · 404 · 409 |
| GET | `/candidatos` | — | `200 [{id, nome, partido, urlFoto}]` |
| GET | `/resultado` | — | `200 [{id, nome, partido, urlFoto, qtdVotosTotal}]` |

`posicaoFila` começa em 1 (primeiro da fila = 1). Body ou query inválidos respondem `400 REQUISICAO_INVALIDA`.

> **Mudou, criou ou removeu uma rota? Atualize a collection no mesmo commit.** Faça a alteração no Postman, exporte em
> **Collection v2.1** e sobrescreva o arquivo em `postman/`. Depois, atualize a tabela acima.


## Estrutura

```
src/
  config/       env e pool do MySQL
  database/     schema.sql + migrate.ts
  domain/       models e a fila (DoublyLinkedList)
  repository/   acesso ao banco
  services/     regras de negócio
  controllers/  handlers HTTP
  routes/       rotas do Express (uma por domínio + validação com express-validator)
  middlewares/  middlewares do Express (ex.: validarRequisicao)
postman/        collection do Postman com todas as rotas
```

## Convenções

- **Banco em `snake_case`, JSON em `camelCase`.** Os models fazem a conversão: `fromRow()` lê a linha do banco e `toJSON()` monta o JSON de saída.
- Tabelas no plural: `partidos`, `candidatos` e `usuarios`.
- `CandidatoRow` espera `partido_nome` e `partido_digito`, então as queries de candidato precisam de `LEFT JOIN` com `partidos` e desses aliases. Tem que ser `LEFT`, porque o candidato "Anular" não tem partido.
- Mudou um model? Atualize o `schema.sql` no mesmo commit. Como não há versionamento de migrações, para alterar uma tabela que já existe é preciso dropá-la ou rodar um `ALTER` manual.
