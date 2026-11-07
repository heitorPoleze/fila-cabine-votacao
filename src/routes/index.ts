import { Router } from "express";
import usuarioRoutes from "./usuario.routes";
import votoRoutes from "./voto.routes";
import candidatoRoutes from "./candidato.routes";

const router = Router();
const baseUrl = "/api/v1";

router.use(`${baseUrl}/usuarios`, usuarioRoutes);
router.use(`${baseUrl}`, votoRoutes, candidatoRoutes);

export default router;
