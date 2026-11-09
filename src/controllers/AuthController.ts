import type { Request, Response } from "express";
import { NaoAutorizadoError } from "../errors";
import { authService, tokenDaRequisicao } from "../services/AuthService";

export class AuthController {
  constructor(private readonly auth: typeof authService = authService) {}

  /**
   * POST /auth/login e POST /api/v1/auth/login
   * Realiza login administrativo gerando token de autorização Bearer.
   */
  public async login(req: Request, res: Response): Promise<void> {
    const loginOuNome = req.body?.nome ?? req.body?.login;
    const sessao = await this.auth.login(loginOuNome, req.body?.senha);
    if (!sessao) {
      throw new NaoAutorizadoError("Nome ou senha incorretos");
    }
    res.status(200).json(sessao);
  }

  /**
   * GET /auth/me e GET /api/v1/auth/me
   * Inspeciona sessão do administrador autenticado.
   */
  public me(req: Request, res: Response): void {
    const admin = this.auth.verificar(tokenDaRequisicao(req));
    if (!admin) {
      throw new NaoAutorizadoError("Sessão expirada");
    }
    res.status(200).json({ nome: admin.nome, expiraEm: new Date(admin.exp).toISOString() });
  }
}

export const authController = new AuthController(authService);
