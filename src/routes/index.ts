import { Router } from "express";
import { CandidatoRepository } from "../repository/CandidatoRepository";
import { filaService } from "../services/FilaService";
import auth from "./auth";
import candidatoRoutes from "./candidato.routes";
import fila from "./fila";
import usuarioRoutes from "./usuario.routes";
import votoRoutes from "./voto.routes";
import votos from "./votos";

const routes = Router();
const candidatos = new CandidatoRepository();

// ---- API usada pelo front (Next) e pelo painel do administrador
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

// ---- API REST /api/v1 (collection do Postman em postman/). Usa a mesma fila.
const baseUrl = "/api/v1";
routes.use(`${baseUrl}/usuarios`, usuarioRoutes);
routes.use(`${baseUrl}`, votoRoutes, candidatoRoutes);

export default routes;
