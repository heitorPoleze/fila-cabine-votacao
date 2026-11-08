import { Router } from "express";
import { candidatoController } from "../controllers/CandidatoController";
import adminRoutes from "./admin.routes";
import auth from "./auth";
import candidatoRoutes from "./candidato.routes";
import dispositivoRoutes from "./dispositivo.routes";
import fila from "./fila";
import filaV1Routes from "./fila.routes";
import logsRoutes from "./logs.routes";
import usuarioRoutes from "./usuario.routes";
import votoRoutes from "./voto.routes";
import votos from "./votos";

const routes = Router();

// ============================================================================
// 1. ROTAS LEGADAS / PAINEL ADMINISTRATIVO E TEMPO REAL NA RAIZ
// Compatibilidade total com o front e painéis existentes:
// /fila, /votos, /resultados, /candidatos, /auth, /dispositivo e /api/logs
// ============================================================================
routes.use("/auth", auth);
routes.use("/fila", fila);
routes.use("/votos", votos);
routes.use("/dispositivo", dispositivoRoutes);
routes.use("/api/logs", logsRoutes);

// Rotas raiz para front legado delegando diretamente para controllers
routes.get("/candidatos", candidatoController.listar.bind(candidatoController));
routes.get("/resultados", candidatoController.resultado.bind(candidatoController));
routes.get("/resultado", candidatoController.resultado.bind(candidatoController));

// ============================================================================
// 2. API RESTful PADRONIZADA EM /api/v1
// Suporta a convenção canônica REST (substantivos no plural, métodos HTTP semânticos)
// e os aliases de retrocompatibilidade especificados no projeto.
// ============================================================================
const baseUrl = "/api/v1";

// Autenticação administrativa
routes.use(`${baseUrl}/auth`, auth);

// Eleitores na fila
routes.use(`${baseUrl}/usuarios`, usuarioRoutes);

// Métodos estruturais do TAD Fila e Proporção Dinâmica (plural canônico e singular)
routes.use(`${baseUrl}/filas`, filaV1Routes);
routes.use(`${baseUrl}/fila`, filaV1Routes);

// Painel administrativo (Modo Mock, chamadas e auditoria)
routes.use(`${baseUrl}/admin`, adminRoutes);

// Trava e metadados de identificação do dispositivo (plural canônico e singular)
routes.use(`${baseUrl}/dispositivos`, dispositivoRoutes);
routes.use(`${baseUrl}/dispositivo`, dispositivoRoutes);

// Logs consolidados de auditoria e métricas
routes.use(`${baseUrl}/logs`, logsRoutes);

// Votos e Candidatos (candidatos, resultados e votos oficiais)
routes.use(baseUrl, votoRoutes);
routes.use(baseUrl, candidatoRoutes);

export default routes;
