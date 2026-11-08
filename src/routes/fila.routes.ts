import { Router } from "express";
import { body, param, query } from "express-validator";
import { filaAdminController } from "../controllers/FilaAdminController";
import { validarRequisicao } from "../middlewares/validarRequisicao";
import { exigirAdmin } from "../services/AuthService";

const router = Router();

const validarTipoFilaParam = param("tipoFila")
  .isString()
  .custom((valor) => ["COMUM", "PREFERENCIAL"].includes(String(valor).trim().toUpperCase()))
  .withMessage("tipoFila na URL deve ser 'comum' ou 'preferencial'");

/**
 * GET /filas/proporcao e GET /fila/proporcao
 * RESTful canônico: Consulta de estado de serviço informando o algoritmo de proporção dinâmica
 * (1:1 quando preferencial <= 25%, 3:1 quando <= 50%, 5:1 quando > 50%).
 */
router.get(
  "/proporcao",
  [
    query("escopo")
      .optional()
      .isIn(["mock", "real"])
      .withMessage("escopo opcional deve ser 'mock' ou 'real'"),
  ],
  validarRequisicao,
  filaAdminController.proporcao.bind(filaAdminController),
);

/**
 * 8. EXIBIR OS ELEMENTOS PRESENTES NA ESTRUTURA (`fila.exibir()`)
 * RESTful canônico: GET /filas/:tipoFila/elementos lista todos os itens da coleção.
 * Compatibilidade: GET /filas/:tipoFila
 */
router.get(
  ["/:tipoFila/elementos", "/:tipoFila"],
  [validarTipoFilaParam],
  validarRequisicao,
  filaAdminController.exibir.bind(filaAdminController),
);

/**
 * 1. INSERIR ELEMENTOS SEGUINDO FIFO (`fila.enfileirar()`)
 * RESTful canônico: POST /filas/:tipoFila/elementos cria um novo item no final da fila.
 * Compatibilidade: POST /filas/:tipoFila/enfileirar
 * Restrito ao administrador em Modo Mock (para não violar a integridade da fila oficial).
 */
router.post(
  ["/:tipoFila/elementos", "/:tipoFila/enfileirar"],
  exigirAdmin,
  [
    validarTipoFilaParam,
    body("nome").optional().isString().withMessage("nome deve ser texto"),
    body("idUsuario").optional().isInt({ min: 1 }).withMessage("idUsuario deve ser inteiro positivo"),
  ],
  validarRequisicao,
  filaAdminController.enfileirar.bind(filaAdminController),
);

/**
 * 2. REMOVER ELEMENTOS SEGUINDO FIFO (`fila.desenfileirar()`)
 * RESTful canônico: DELETE /filas/:tipoFila/elementos/frente ou DELETE /filas/:tipoFila/elementos/primeiro
 * Compatibilidade: POST /filas/:tipoFila/desenfileirar
 * Restrito ao administrador em Modo Mock.
 */
router.delete(
  ["/:tipoFila/elementos/frente", "/:tipoFila/elementos/primeiro"],
  exigirAdmin,
  [validarTipoFilaParam],
  validarRequisicao,
  filaAdminController.desenfileirar.bind(filaAdminController),
);

router.post(
  "/:tipoFila/desenfileirar",
  exigirAdmin,
  [validarTipoFilaParam],
  validarRequisicao,
  filaAdminController.desenfileirar.bind(filaAdminController),
);

/**
 * 3. ACESSAR O PRIMEIRO ELEMENTO / FRENTE DA FILA (`fila.primeiro()`)
 * RESTful canônico: GET /filas/:tipoFila/elementos/primeiro inspeciona a frente da fila.
 * Compatibilidade: GET /filas/:tipoFila/primeiro
 */
router.get(
  ["/:tipoFila/elementos/primeiro", "/:tipoFila/primeiro"],
  [validarTipoFilaParam],
  validarRequisicao,
  filaAdminController.primeiro.bind(filaAdminController),
);

/**
 * 4. VERIFICAR SE A ESTRUTURA ESTÁ VAZIA (`fila.estaVazia()`)
 * RESTful canônico: GET /filas/:tipoFila/status informa metadados de ocupação e tamanho.
 * Compatibilidade: GET /filas/:tipoFila/vazia
 */
router.get(
  ["/:tipoFila/status", "/:tipoFila/vazia"],
  [validarTipoFilaParam],
  validarRequisicao,
  filaAdminController.estaVazia.bind(filaAdminController),
);

/**
 * 5. VERIFICAR A POSIÇÃO DE UM ELEMENTO NA ESTRUTURA (`fila.posicaoDe()`)
 * RESTful canônico: GET /filas/:tipoFila/elementos/:idUsuario/posicao ou GET /filas/:tipoFila/posicoes?idUsuario=int
 * Compatibilidade: GET /filas/:tipoFila/posicao?idUsuario=int
 */
router.get(
  "/:tipoFila/elementos/:idUsuario/posicao",
  [
    validarTipoFilaParam,
    param("idUsuario").isInt({ min: 1 }).withMessage("idUsuario no parâmetro deve ser inteiro positivo"),
  ],
  validarRequisicao,
  filaAdminController.posicaoDe.bind(filaAdminController),
);

router.get(
  ["/:tipoFila/posicoes", "/:tipoFila/posicao"],
  [
    validarTipoFilaParam,
    query("idUsuario").isInt({ min: 1 }).withMessage("idUsuario deve ser um inteiro positivo"),
  ],
  validarRequisicao,
  filaAdminController.posicaoDe.bind(filaAdminController),
);

/**
 * 7. INVERTER A ORDEM DOS ELEMENTOS DA ESTRUTURA (`fila.inverter()`)
 * RESTful canônico: POST /filas/:tipoFila/inversao ou PATCH /filas/:tipoFila/ordem expressam mutação da ordem.
 * Compatibilidade: POST /filas/:tipoFila/inverter
 * Restrito ao administrador em Modo Mock.
 */
router.post(
  ["/:tipoFila/inversao", "/:tipoFila/inverter"],
  exigirAdmin,
  [validarTipoFilaParam],
  validarRequisicao,
  filaAdminController.inverter.bind(filaAdminController),
);

router.patch(
  "/:tipoFila/ordem",
  exigirAdmin,
  [validarTipoFilaParam],
  validarRequisicao,
  filaAdminController.inverter.bind(filaAdminController),
);

/**
 * 6. LIMPAR OS ELEMENTOS DA ESTRUTURA (`fila.limpar()`)
 * RESTful canônico: DELETE /filas/:tipoFila/elementos remove todos os elementos da coleção.
 * Compatibilidade: DELETE /filas/:tipoFila
 * Restrito ao administrador em Modo Mock.
 */
router.delete(
  ["/:tipoFila/elementos", "/:tipoFila"],
  exigirAdmin,
  [validarTipoFilaParam],
  validarRequisicao,
  filaAdminController.limpar.bind(filaAdminController),
);

export default router;
