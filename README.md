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
