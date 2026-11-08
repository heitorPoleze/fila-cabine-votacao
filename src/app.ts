import express, { type NextFunction, type Request, type Response } from "express";
import { env } from "./config/env";
import routes from "./routes";
import { AppError } from "./errors";

const app = express();

// CORS: o front (Next, porta 3000) chama a API em outra porta.
app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader("Access-Control-Allow-Origin", env.CORS_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Expose-Headers", "X-Tempo-Processamento");
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

// Tempo que o servidor levou para responder cada requisição.
app.use((_req: Request, res: Response, next: NextFunction) => {
  const inicio = performance.now();
  const writeHead = res.writeHead.bind(res);
  res.writeHead = ((...args: Parameters<Response["writeHead"]>) => {
    res.setHeader("X-Tempo-Processamento", (performance.now() - inicio).toFixed(1));
    return writeHead(...args);
  }) as Response["writeHead"];
  next();
});

app.use(express.json());
app.use(routes);

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Rota não encontrada" });
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    if (err.statusCode >= 500) console.error(err);
    res.status(err.statusCode).json(err.toJSON());
  } else {
    console.error(err);
    res.status(500).json({ error: "ERRO_INTERNO", message: "Erro interno do servidor" });
  }
});

export default app;
