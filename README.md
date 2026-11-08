# fila-cabine-votacao

## O que é o projeto

- Backend acadêmico desenvolvido em **TypeScript**, **Node.js (Express)**, **MySQL (`mysql2`)** e **WebSockets (`ws`)** para a disciplina de **Estrutura de Dados**.
- Implementa um **Sistema de Fila com Prioridade para Cabine de Votação**, gerenciando de forma integrada filas **Preferencial** e **Comum**, apuração de votos e auditoria completa.

## O que o sistema faz

- **Estrutura de Dados Fila (FIFO) pura sobre Lista Duplamente Encadeada (`DoublyLinkedList`):** implementa todas as operações mínimas da Fila (`enfileirar`, `desenfileirar`, `primeiro`, `estaVazia`, `posicaoDe`, `limpar`, `inverter` e `exibir`) com barreira estrita em tempo de compilação e execução que bloqueia métodos alheios ao TAD Fila.
- **Proporção dinâmica de atendimento (`GerenciadorFilas`):** alterna automaticamente as chamadas entre fila Preferencial e fila Comum nas razões **1:1** (preferenciais ≤ 25% dos comuns), **3:1** (≤ 50%) e **5:1** (> 50%), tanto para dispositivos reais quanto para simulação.
- **Demonstração administrativa isolada em Modo Mock:** permite ao administrador demonstrar todas as operações da estrutura de dados Fila e simular votações em uma instância separada, sem afetar a fila real nem os votos oficiais ao desabilitar o mock.
- **Identificação de dispositivo e trava de voto único:** captura metadados do cliente (IP, endereço MAC na rede local quando disponível, nome do dispositivo, fingerprint e token UUID), persistindo-os no banco e impedindo que o mesmo usuário ou dispositivo vote mais de uma vez.
- **Sincronização em tempo real:** transmite atualizações de estado das filas, chamadas para a cabine e apuração de votos via WebSocket.
- **Logs e métricas de auditoria:** registra no banco de dados a quantidade absoluta de votos de cada candidato, em quem o eleitor votou, o horário do voto, o tempo que levou para votar na cabine, o tempo de espera em cada requisição e o tempo desde a entrada na fila até a chegada à cabine.

## Comandos de configuração e execução

### Pré-requisitos

- **Node.js** 20+
- **MySQL** 8.0.16+

### Configuração do ambiente e banco de dados

```bash
# 1. Instalar as dependências do projeto
npm install

# 2. Criar o arquivo de variáveis de ambiente e preencher DB_HOST, DB_PORT, DB_USER, DB_PASSWORD e DB_NAME
cp .env.example .env

# 3. Criar/sincronizar o banco de dados e todas as tabelas no MySQL
npm run db:migrate

# 4. Gerar/sincronizar o collection do postman
npm run postman:import
```

### Execução e verificação

```bash
# Executar em modo de desenvolvimento (com recarregamento automático)
npm run dev

# Executar em modo normal
npm start

# Validar tipagem TypeScript
npm run typecheck
```

## Rotas e Postman

As rotas da API do eleitor ficam em `/api/v1` (o front e o painel do admin usam também `/fila`, `/votos`, `/resultados` e `/auth`, na mesma fila). A collection do Postman está em `postman/fila-cabine-votacao.postman_collection.json`.

**Para usar:** no Postman, **Import** → arraste o arquivo.

> Mudou, criou ou removeu uma rota? Atualize a collection no mesmo commit.

> Mudou um model? Atualize o `schema.sql` no mesmo commit. Como não há versionamento de migrações, para alterar uma tabela que já existe é preciso dropá-la ou rodar um `ALTER` manual.

## Estrutura

```
postman/
src/
  config/
  database/
  domain/
  repository/
  services/
  controllers/
  routes/
  middlewares/
```