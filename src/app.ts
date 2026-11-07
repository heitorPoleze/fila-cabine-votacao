import express, { type NextFunction, type Request, type Response } from "express";
import routes from "./routes";
import { AppError } from "./errors";

const app = express();

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
