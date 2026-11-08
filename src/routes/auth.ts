import { Router } from "express";
import { authController } from "../controllers/AuthController";

const auth = Router();

/**
 * POST /auth/login e POST /api/v1/auth/login
 * Autenticação administrativa com retorno de sessão e token Bearer.
 */
auth.post("/login", authController.login.bind(authController));

/**
 * GET /auth/me e GET /api/v1/auth/me
 * Valida a integridade e expiração do token de sessão administrativa.
 */
auth.get("/me", authController.me.bind(authController));

export default auth;
