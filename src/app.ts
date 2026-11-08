import express, { type NextFunction, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { env } from "./config/env";
import { AppError } from "./errors";
import { medirTempoRequisicao } from "./middlewares/tempoRequisicao";
import routes from "./routes";

const app = express();
// Confia no primeiro proxy reverso (ex.: Nginx/Cloudflare/Docker) para resolução correta de IP
app.set("trust proxy", 1);

// ============================================================================
// 1. HEADERS DE SEGURANÇA (HELMET)
// - Proteção contra XSS, Clickjacking, MIME sniffing e vazamento de tecnologia
// ============================================================================
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "ws:", "wss:"],
      },
    },
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginEmbedderPolicy: false,
    xFrameOptions: { action: "deny" },
    xContentTypeOptions: true,
  }),
);

// Bloqueia métodos HTTP inseguros (ex.: TRACE e TRACK contra Cross-Site Tracing)
app.use((req: Request, res: Response, next: NextFunction) => {
  if (["TRACE", "TRACK"].includes(req.method)) {
    res.status(405).json({
      error: "METODO_NAO_PERMITIDO",
      message: "Método HTTP não permitido",
    });
    return;
  }
  next();
});

// ============================================================================
// 2. CONTROLE DE ACESSO (CORS)
// ============================================================================
app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader("Access-Control-Allow-Origin", env.CORS_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Device-Token, X-Device-Id, X-Device-Fingerprint, X-Device-Name, X-Device-Mac",
  );
  res.setHeader("Access-Control-Expose-Headers", "X-Tempo-Processamento");
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

// ============================================================================
// 3. RATE LIMITING (PROTEÇÃO CONTRA BRUTE FORCE, DOS E FLOODING)
// ============================================================================
// Limiter geral para toda a API (1000 requisições por janela de 15 min por IP)
const apiGeralLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 1000,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  validate: { trustProxy: false },
  handler: (_req, res) => {
    res.status(429).json({
      error: "MUITAS_REQUISICOES",
      message: "Limite de requisições excedido. Tente novamente mais tarde.",
    });
  },
});
app.use(apiGeralLimiter);

// Limiter restrito contra ataques de força bruta no login administrativo
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 25,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  validate: { trustProxy: false },
  handler: (_req, res) => {
    res.status(429).json({
      error: "MUITAS_TENTATIVAS_LOGIN",
      message: "Muitas tentativas de login incorretas. Tente novamente em 15 minutos.",
    });
  },
});
app.use(["/auth/login", "/api/v1/auth/login"], authLimiter);

// Limiter contra flooding e concorrência abusiva nos endpoints de votação
const votoLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 150,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  validate: { trustProxy: false },
  handler: (_req, res) => {
    res.status(429).json({
      error: "TAXA_REQUISICOES_EXCEDIDA",
      message: "Taxa de requisições de voto excedida para este cliente. Aguarde alguns instantes.",
    });
  },
});
app.use(["/voto", "/votos", "/api/v1/voto", "/api/v1/votos"], votoLimiter);

// ============================================================================
// 4. PARSERS E MEDIÇÃO DE TEMPO
// ============================================================================
// Cronometra e registra o tempo de espera/processamento de cada requisição HTTP
app.use(medirTempoRequisicao);

// Limita o tamanho do payload JSON em 50KB contra ataques de buffer/payload exhaustion
app.use(express.json({ limit: "50kb" }));
app.use(express.urlencoded({ extended: false, limit: "50kb" }));

// Rotas da aplicação
app.use(routes);

// ============================================================================
// 5. TRATAMENTO DE ERROS E ROTAS NÃO ENCONTRADAS
// ============================================================================
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "NAO_ENCONTRADO", message: "Rota não encontrada" });
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    if (err.statusCode >= 500) console.error(err);
    res.status(err.statusCode).json(err.toJSON());
  } else if ("type" in err && (err as { type?: string }).type === "entity.too.large") {
    res.status(413).json({
      error: "PAYLOAD_MUITO_GRANDE",
      message: "O corpo da requisição excedeu o limite máximo de 50KB",
    });
  } else if (err instanceof SyntaxError && "body" in err) {
    res
      .status(400)
      .json({ error: "REQUISICAO_INVALIDA", message: "JSON inválido no corpo da requisição" });
  } else if ("status" in err && typeof (err as { status?: number }).status === "number") {
    const status = (err as { status: number }).status;
    res.status(status).json({
      error: "REQUISICAO_INVALIDA",
      message: err.message,
    });
  } else {
    console.error(err);
    res.status(500).json({ error: "ERRO_INTERNO", message: "Erro interno do servidor" });
  }
});

export default app;
