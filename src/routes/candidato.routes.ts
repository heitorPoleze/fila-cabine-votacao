import { Router } from "express";
import { candidatoController } from "../controllers/CandidatoController";

const router = Router();

router.get(
  "/candidatos",
  candidatoController.listar.bind(candidatoController)
);

router.get(
  "/resultado",
  candidatoController.resultado.bind(candidatoController)
);

export default router;
