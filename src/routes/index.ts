import { Router } from "express";
import { CandidatoRepository } from "../repository/CandidatoRepository";
import { filaService } from "../services/FilaService";
import auth from "./auth";
import fila from "./fila";
import votos from "./votos";

const routes = Router();
const candidatos = new CandidatoRepository();

routes.use("/auth", auth);
routes.use("/fila", fila);
routes.use("/votos", votos);

routes.get("/candidatos", async (_req, res) => {
  res.json(await candidatos.listar());
});

/** Resultados parciais: array dos candidatos com a quantidade total de votos de cada um. */
routes.get("/resultados", async (_req, res) => {
  res.json(await filaService.resultado());
});

export default routes;
