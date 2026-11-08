import { Router } from "express";
import { body } from "express-validator";
import { votoController } from "../controllers/VotoController";
import { capturarDispositivo } from "../middlewares/capturarDispositivo";
import { validarRequisicao } from "../middlewares/validarRequisicao";
import { exigirAdmin } from "../services/AuthService";

const router = Router();

/**
 * POST /api/v1/voto e POST /api/v1/votos
 * RESTful canônico: POST /api/v1/votos (coleção de recursos no plural).
 * Compatibilidade: POST /api/v1/voto (especificação do front/documento).
 * 
 * Regra de Negócio:
 * - O eleitor deve ser o 1º da fila global calculada pelo GerenciadorFilas (proporção dinâmica).
 * - Registra o voto oficial do usuário no candidato informado.
 * - Bloqueia dispositivo/usuário contra votos duplicados (HTTP 409).
 * - Tira o usuário da fila imediatamente após a votação.
 * - Retorna Status 201 com o array totalizador atualizado: `[{ idCandidato: int, qtdVotosTotal: int }, ...]`.
 * - Status 400 (corpo inválido), 403 (não é o primeiro da fila), 404 (usuário ou candidato inexistente), 409 (já votou).
 */
router.post(
  ["/voto", "/votos"],
  [
    body("idUsuario")
      .isInt({ min: 1 })
      .withMessage("idUsuario deve ser um inteiro positivo")
      .toInt(),
    body("idCandidato")
      .isInt({ min: 1 })
      .withMessage("idCandidato deve ser um inteiro positivo")
      .toInt(),
  ],
  validarRequisicao,
  capturarDispositivo,
  votoController.votar.bind(votoController),
);

/**
 * GET /api/v1/votos
 * RESTful canônico: Consulta a coleção de votos registrados para auditoria administrativa.
 * Retorna lista detalhada de votos (quem votou, horário, tempo na fila e dispositivo).
 */
router.get(
  "/votos",
  exigirAdmin,
  votoController.relatorio.bind(votoController),
);

export default router;
