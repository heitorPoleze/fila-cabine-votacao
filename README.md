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

**Para usar:** no Postman, **Import** → arraste o arquivo.

> **Mudou, criou ou removeu uma rota? Atualize a collection no mesmo commit.**

> Mudou um model? Atualize o `schema.sql` no mesmo commit. Como não há versionamento de migrações, para alterar uma tabela que já existe é preciso dropá-la ou rodar um `ALTER` manual.
## Estrutura

```
src/
  config/       
  database/     
  domain/       
  repository/   
  services/     
  controllers/  
  routes/       
  middlewares/  
postman/       
```
