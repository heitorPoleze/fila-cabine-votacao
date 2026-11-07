import { Router } from "express";
import { body, query } from "express-validator";
import { usuarioController } from "../controllers/UsuarioController";
import { TipoFila } from "../domain/usuario/TipoFila";
import { validarRequisicao } from "../middlewares/validarRequisicao";

const router = Router();

router.post(
  "/",
  [
    body("nome").isString().withMessage("Nome deve ser um texto").bail().trim().notEmpty().withMessage("Nome obrigatório"),
    body("tipoFila").isIn(Object.values(TipoFila)).withMessage(`Tipo de fila inválido (use ${Object.values(TipoFila).join(" ou ")})`),
  ],
  validarRequisicao,
  usuarioController.criar.bind(usuarioController)
);

router.post(
  "/logout",
  [
    body("idUsuario").isInt({ min: 1 }).withMessage("idUsuario deve ser um inteiro positivo").toInt(),
  ],
  validarRequisicao,
  usuarioController.logout.bind(usuarioController)
);

router.get(
  "/posicao-na-fila",
  [
    query("idUsuario").isInt({ min: 1 }).withMessage("idUsuario deve ser um inteiro positivo"),
  ],
  validarRequisicao,
  usuarioController.lugarNaFila.bind(usuarioController)
);

export default router;
