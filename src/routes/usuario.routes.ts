import { Router } from "express";
import { body, param, query } from "express-validator";
import { usuarioController } from "../controllers/UsuarioController";
import { TipoFila } from "../domain/usuario/TipoFila";
import { capturarDispositivo } from "../middlewares/capturarDispositivo";
import { validarRequisicao } from "../middlewares/validarRequisicao";

const router = Router();

/**
 * POST /api/v1/usuarios
 * RESTful canônico: Criação de um novo recurso de usuário na coleção de eleitores na fila.
 * Payload de entrada: `{ nome: string, tipoFila: "PREFERENCIAL" | "COMUM" }`.
 * Retorno: Status 201 `{ idUsuario: int, posicaoFila: int }`.
 * Status 400 se o corpo for inválido.
 * Status 409 se o dispositivo ou usuário já tiver votado.
 */
router.post(
  "/",
  [
    body("nome")
      .isString()
      .withMessage("Nome deve ser um texto")
      .bail()
      .trim()
      .notEmpty()
      .withMessage("Nome obrigatório"),
    body("tipoFila")
      .isIn(Object.values(TipoFila))
      .withMessage(`Tipo de fila inválido (use ${Object.values(TipoFila).join(" ou ")})`),
  ],
  validarRequisicao,
  capturarDispositivo,
  usuarioController.criar.bind(usuarioController),
);

/**
 * GET /api/v1/usuarios/posicao-na-fila?idUsuario=int
 * Compatibilidade do Front: Consulta da posição ordinal do usuário na fila (1-based).
 * Retorno: Status 200 `{ idUsuario: int, posicaoFila: int }`.
 * Status 404 se o usuário não existir ou não estiver na fila.
 */
router.get(
  "/posicao-na-fila",
  [
    query("idUsuario")
      .isInt({ min: 1 })
      .withMessage("idUsuario deve ser um inteiro positivo"),
  ],
  validarRequisicao,
  usuarioController.lugarNaFila.bind(usuarioController),
);

/**
 * GET /api/v1/usuarios/:idUsuario/posicao
 * RESTful canônico: Consulta de sub-recurso da posição ordinal do usuário na fila.
 * Retorno: Status 200 `{ idUsuario: int, posicaoFila: int }`.
 * Status 404 se o usuário não existir ou não estiver na fila.
 */
router.get(
  "/:idUsuario/posicao",
  [
    param("idUsuario")
      .isInt({ min: 1 })
      .withMessage("idUsuario no parâmetro deve ser um inteiro positivo"),
  ],
  validarRequisicao,
  usuarioController.lugarNaFila.bind(usuarioController),
);

/**
 * DELETE /api/v1/usuarios/:idUsuario
 * RESTful canônico: Remove o recurso do usuário da fila de votação (desistência voluntária).
 * Retorno: Status 200 `{ idUsuario: int, removido: UsuarioJSON }`.
 * Status 404 se o usuário não for localizado na fila.
 */
router.delete(
  "/:idUsuario",
  [
    param("idUsuario")
      .isInt({ min: 1 })
      .withMessage("idUsuario no parâmetro deve ser um inteiro positivo"),
  ],
  validarRequisicao,
  usuarioController.logout.bind(usuarioController),
);

/**
 * POST /api/v1/usuarios/logout
 * Compatibilidade: Permite ao usuário solicitar saída da fila via corpo JSON `{ idUsuario: int }`.
 * Retorno: Status 200 `{ idUsuario: int, removido: UsuarioJSON }`.
 * Status 404 se não encontrado.
 */
router.post(
  "/logout",
  [
    body("idUsuario")
      .isInt({ min: 1 })
      .withMessage("idUsuario deve ser um inteiro positivo")
      .toInt(),
  ],
  validarRequisicao,
  usuarioController.logout.bind(usuarioController),
);

export default router;
