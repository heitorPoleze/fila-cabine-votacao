import express, { type NextFunction, type Request, type Response } from "express";
import routes from "./routes";

const app = express();

app.use(express.json());
app.use(routes);



app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Rota não encontrada" });
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Erro interno do servidor" });
});

export default app;
