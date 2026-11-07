import { Router } from "express";
import { body } from "express-validator";
import { votoController } from "../controllers/VotoController";
import { validarRequisicao } from "../middlewares/validarRequisicao";

const router = Router();

router.post(
  "/voto",
  [
    body("idUsuario").isInt({ min: 1 }).withMessage("idUsuario deve ser um inteiro positivo").toInt(),
    body("idCandidato").isInt({ min: 1 }).withMessage("idCandidato deve ser um inteiro positivo").toInt(),
  ],
  validarRequisicao,
  votoController.votar.bind(votoController)
);

export default router;
