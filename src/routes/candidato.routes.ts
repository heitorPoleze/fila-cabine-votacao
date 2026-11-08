import { Router } from "express";
import { param } from "express-validator";
import { candidatoController } from "../controllers/CandidatoController";
import { validarRequisicao } from "../middlewares/validarRequisicao";

const router = Router();

/**
 * GET /api/v1/candidatos
 * RESTful canônico: Lista a coleção de recursos de candidatos participantes do pleito.
 * Retorna Status 200 com array SEM contagem total de votos:
 * `[{ id: int, nome: string, partido: { nome: string, digito: string } | null, urlFoto: string | null }, ...]`.
 * O candidato especial "Anular" (id 1) possui `partido: null` e `urlFoto: null`.
 */
router.get(
  "/candidatos",
  candidatoController.listar.bind(candidatoController),
);

/**
 * GET /api/v1/candidatos/:id
 * RESTful canônico: Inspeciona um recurso individual da coleção de candidatos por seu identificador único.
 * Retorna Status 200 com dados do candidato ou 404 se não existir.
 */
router.get(
  "/candidatos/:id",
  [
    param("id")
      .isInt({ min: 1 })
      .withMessage("id do candidato deve ser um inteiro positivo"),
  ],
  validarRequisicao,
  candidatoController.buscarPorId.bind(candidatoController),
);

/**
 * GET /api/v1/resultado e GET /api/v1/resultados
 * RESTful canônico: GET /api/v1/resultados (substantivo no plural padronizado).
 * Compatibilidade: GET /api/v1/resultado (especificação direta do prompt).
 * Retorna Status 200 com a apuração eleitoral contendo `qtdVotosTotal`:
 * `[{ id: int, nome: string, partido: { nome: string, digito: string } | null, urlFoto: string | null, qtdVotosTotal: int }, ...]`.
 */
router.get(
  ["/resultado", "/resultados"],
  candidatoController.resultado.bind(candidatoController),
);

export default router;
