import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

interface HeaderItem {
  key: string;
  value: string;
}

interface QueryItem {
  key: string;
  value: string;
}

interface UrlObject {
  raw: string;
  host: string[];
  path: string[];
  query?: QueryItem[];
}

interface RequestOptions {
  body?: unknown;
  admin?: boolean;
  headers?: HeaderItem[];
  test?: string[];
}

interface RequestItem {
  name: string;
  request: {
    method: string;
    header: HeaderItem[];
    url: UrlObject;
    body?: {
      mode: "raw";
      raw: string;
      options: {
        raw: {
          language: "json";
        };
      };
    };
  };
  response: never[];
  event?: Array<{
    listen: "test";
    script: {
      type: "text/javascript";
      exec: string[];
    };
  }>;
}

const H = (key: string, value: string): HeaderItem => ({ key, value });

function buildUrl(raw: string): UrlObject {
  const [base = "", qs] = raw.split("?");
  const host = base.startsWith("{{serverUrl}}") ? "{{serverUrl}}" : "{{baseUrl}}";
  const path = base.slice(host.length).split("/").filter(Boolean);
  const urlObj: UrlObject = { raw, host: [host], path };

  if (qs) {
    urlObj.query = qs.split("&").map((pair) => {
      const [key = "", value = ""] = pair.split("=");
      return { key, value };
    });
  }

  return urlObj;
}

function buildRequest(
  name: string,
  method: string,
  rawUrl: string,
  options: RequestOptions = {}
): RequestItem {
  const { body, admin, headers = [], test } = options;
  const header: HeaderItem[] = [];

  if (body !== undefined) {
    header.push(H("Content-Type", "application/json"));
  }
  if (admin) {
    header.push(H("Authorization", "Bearer {{adminToken}}"));
  }
  header.push(...headers);

  const request: RequestItem["request"] = {
    method,
    header,
    url: buildUrl(rawUrl),
  };

  if (body !== undefined) {
    request.body = {
      mode: "raw",
      raw: JSON.stringify(body, null, 2),
      options: {
        raw: {
          language: "json",
        },
      },
    };
  }

  const item: RequestItem = {
    name,
    request,
    response: [],
  };

  if (test) {
    item.event = [
      {
        listen: "test",
        script: {
          type: "text/javascript",
          exec: test,
        },
      },
    ];
  }

  return item;
}

const deviceHeaders: HeaderItem[] = [
  H("X-Device-Token", "{{deviceToken}}"),
  H("X-Device-Name", "Smartphone Sala 01"),
];
const escopoMock = "escopo=mock";

const collection = {
  info: {
    _postman_id: "b3a1c5d2-7e4f-4a68-9c21-5d8e0f7a1b34",
    name: "fila-cabine-votacao",
    description:
      "Rotas da API fila-cabine-votacao. Base: {{baseUrl}} (padrao http://localhost:3000/api/v1). Erros vem como {error, message}.",
    schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
  },
  variable: [
    H("baseUrl", "http://localhost:3000/api/v1"),
    H("serverUrl", "http://localhost:3000"),
    H("adminToken", ""),
    H("idUsuario", "1"),
    H("idCandidato", "2"),
    H("tipoFila", "comum"),
    H("deviceToken", "dispositivo-teste-01"),
  ],
  item: [
    {
      name: "1. Autenticacao Admin",
      item: [
        buildRequest("Login do administrador", "POST", "{{baseUrl}}/auth/login", {
          body: { nome: "admin", senha: "admin" },
          test: [
            "if (pm.response.code === 200) {",
            "  pm.collectionVariables.set('adminToken', pm.response.json().token);",
            "}",
          ],
        }),
        buildRequest("Validar sessao do administrador", "GET", "{{baseUrl}}/auth/me", {
          admin: true,
        }),
      ],
    },
    {
      name: "2. Usuarios e Dispositivo",
      item: [
        buildRequest("Criar usuario (entrar na fila)", "POST", "{{baseUrl}}/usuarios", {
          body: { nome: "Maria Silva", tipoFila: "COMUM" },
          headers: deviceHeaders,
          test: [
            "if (pm.response.code === 201) {",
            "  pm.collectionVariables.set('idUsuario', String(pm.response.json().idUsuario));",
            "}",
          ],
        }),
        buildRequest(
          "Posicao na fila (query param)",
          "GET",
          "{{baseUrl}}/usuarios/posicao-na-fila?idUsuario={{idUsuario}}"
        ),
        buildRequest(
          "Posicao na fila (sub-recurso)",
          "GET",
          "{{baseUrl}}/usuarios/{{idUsuario}}/posicao"
        ),
        buildRequest("Sair da fila (logout)", "POST", "{{baseUrl}}/usuarios/logout", {
          body: { idUsuario: 1 },
        }),
        buildRequest("Sair da fila (DELETE)", "DELETE", "{{baseUrl}}/usuarios/{{idUsuario}}"),
        buildRequest("Status do dispositivo", "GET", "{{baseUrl}}/dispositivos/status", {
          headers: [H("X-Device-Token", "{{deviceToken}}")],
        }),
      ],
    },
    {
      name: "3. Voto e Candidatos",
      item: [
        buildRequest("Registrar voto (voto)", "POST", "{{baseUrl}}/voto", {
          body: { idUsuario: 1, idCandidato: 2 },
          headers: [H("X-Device-Token", "{{deviceToken}}")],
        }),
        buildRequest("Registrar voto (votos)", "POST", "{{baseUrl}}/votos", {
          body: { idUsuario: 1, idCandidato: 2 },
          headers: [H("X-Device-Token", "{{deviceToken}}")],
        }),
        buildRequest("Listar candidatos", "GET", "{{baseUrl}}/candidatos"),
        buildRequest("Buscar candidato por ID", "GET", "{{baseUrl}}/candidatos/{{idCandidato}}"),
        buildRequest("Resultado (resultado)", "GET", "{{baseUrl}}/resultado"),
        buildRequest("Resultado (resultados)", "GET", "{{baseUrl}}/resultados"),
        buildRequest("Relatorio de votos (admin)", "GET", "{{baseUrl}}/votos", { admin: true }),
      ],
    },
    {
      name: "4. Filas - TAD Fila",
      description: "Operacoes da fila. {{tipoFila}} = comum ou preferencial.",
      item: [
        buildRequest("Proporcao dinamica", "GET", `{{baseUrl}}/filas/proporcao?${escopoMock}`),
        buildRequest(
          "Exibir elementos",
          "GET",
          `{{baseUrl}}/filas/{{tipoFila}}/elementos?${escopoMock}`
        ),
        buildRequest(
          "Inserir elemento (enfileirar)",
          "POST",
          "{{baseUrl}}/filas/{{tipoFila}}/elementos",
          {
            body: { nome: "Eleitor Demo" },
            admin: true,
          }
        ),
        buildRequest(
          "Remover elemento (desenfileirar)",
          "DELETE",
          "{{baseUrl}}/filas/{{tipoFila}}/elementos/frente",
          { admin: true }
        ),
        buildRequest(
          "Acessar primeiro",
          "GET",
          `{{baseUrl}}/filas/{{tipoFila}}/elementos/primeiro?${escopoMock}`
        ),
        buildRequest(
          "Status da fila (estaVazia)",
          "GET",
          `{{baseUrl}}/filas/{{tipoFila}}/status?${escopoMock}`
        ),
        buildRequest(
          "Posicao de um elemento",
          "GET",
          `{{baseUrl}}/filas/{{tipoFila}}/elementos/{{idUsuario}}/posicao?${escopoMock}`
        ),
        buildRequest("Inverter fila", "POST", "{{baseUrl}}/filas/{{tipoFila}}/inversao", {
          admin: true,
        }),
        buildRequest("Limpar fila", "DELETE", "{{baseUrl}}/filas/{{tipoFila}}/elementos", {
          admin: true,
        }),
      ],
    },
    {
      name: "5. Admin - Mock, Dispositivos e Logs",
      item: [
        buildRequest("Status do mock", "GET", "{{baseUrl}}/admin/mock", { admin: true }),
        buildRequest("Iniciar mock", "POST", "{{baseUrl}}/admin/mock", {
          body: { qtdPreferencial: 4, qtdComum: 10, limparAntes: true },
          admin: true,
        }),
        buildRequest("Encerrar mock", "DELETE", "{{baseUrl}}/admin/mock", { admin: true }),
        buildRequest("Chamar proximo (mock)", "POST", "{{baseUrl}}/admin/mock/chamadas", {
          admin: true,
        }),
        buildRequest("Listar dispositivos", "GET", "{{baseUrl}}/admin/dispositivos", {
          admin: true,
        }),
        buildRequest(
          "Logs de auditoria (admin)",
          "GET",
          "{{baseUrl}}/admin/logs?limite=100&escopo=real",
          { admin: true }
        ),
        buildRequest(
          "Logs de transparencia",
          "GET",
          "{{serverUrl}}/api/logs?limite=100&escopo=real",
          { admin: true }
        ),
      ],
    },
    {
      name: "6. Painel e Cabine Tempo Real",
      item: [
        buildRequest("Estado das filas e cabine", "GET", "{{serverUrl}}/fila"),
        buildRequest("Posicoes em tempo real", "GET", "{{serverUrl}}/fila/posicoes"),
        buildRequest("Entrar na fila (ticket)", "POST", "{{serverUrl}}/fila", {
          body: { nome: "Joao Souza", tipoFila: "PREFERENCIAL" },
        }),
        buildRequest("Chamar proximo para cabine", "POST", "{{serverUrl}}/fila/proximo", {
          admin: true,
        }),
        buildRequest("Liberar cabine", "POST", "{{serverUrl}}/fila/liberar", { admin: true }),
        buildRequest("Reiniciar fila", "POST", "{{serverUrl}}/fila/reiniciar", { admin: true }),
        buildRequest("Votar na cabine com chave", "POST", "{{serverUrl}}/votos", {
          body: {
            usuarioId: 1,
            chave: "00000000000000000000000000000000",
            candidatoId: 2,
          },
        }),
        buildRequest("Resultado no contexto ativo", "GET", "{{serverUrl}}/votos/resultado"),
      ],
    },
  ],
};

const dir = resolve(process.cwd(), "postman");
mkdirSync(dir, { recursive: true });
const outputPath = resolve(dir, "fila-cabine-votacao.postman_collection.json");
writeFileSync(outputPath, JSON.stringify(collection, null, 2) + "\n", "utf8");
console.log(`Collection Postman v2.1 gerada com sucesso em: ${outputPath}`);
