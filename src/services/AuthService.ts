import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env";
import { Administrador } from "../domain/administrador/Administrador";
import { NaoAutorizadoError } from "../errors";
import { AdministradorRepository } from "../repository/AdministradorRepository";

const admins = new AdministradorRepository();

const VALIDADE_MS = 12 * 60 * 60 * 1000; // 12h

interface Payload {
  nome: string;
  exp: number;
}

function assinar(dados: string): string {
  return createHmac("sha256", env.AUTH_SECRET).update(dados).digest("base64url");
}

function iguais(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/**
 * Login do administrador: confere login e senha na tabela `administrador`.
 * O token é assinado com HMAC, mantendo validade mesmo após restart do servidor.
 */
export const authService = {
  /** Cria o admin padrão do sistema (admin / admin por padrão) se ele ainda não existe. */
  async garantirAdminPadrao(): Promise<boolean> {
    if (await admins.buscarPorLogin(env.ADMIN_USER)) return false;
    await admins.inserir(Administrador.criar(env.ADMIN_USER, env.ADMIN_PASSWORD));
    return true;
  },

  async login(
    nome: unknown,
    senha: unknown,
  ): Promise<{ token: string; nome: string; expiraEm: string } | null> {
    if (typeof nome !== "string" || typeof senha !== "string") return null;
    const admin = await admins.buscarPorLogin(nome.trim());
    if (!admin || !admin.confereSenha(senha)) return null;

    const payload: Payload = { nome: admin.login, exp: Date.now() + VALIDADE_MS };
    const dados = Buffer.from(JSON.stringify(payload)).toString("base64url");
    return {
      token: `${dados}.${assinar(dados)}`,
      nome: admin.login,
      expiraEm: new Date(payload.exp).toISOString(),
    };
  },

  verificar(token: string | undefined): Payload | null {
    if (!token) return null;
    const [dados, assinatura] = token.split(".");
    if (!dados || !assinatura || !iguais(assinatura, assinar(dados))) return null;
    try {
      const payload = JSON.parse(Buffer.from(dados, "base64url").toString()) as Payload;
      return payload.exp > Date.now() ? payload : null;
    } catch {
      return null;
    }
  },
};

export function tokenDaRequisicao(req: Request): string | undefined {
  const header = req.headers.authorization;
  return header?.startsWith("Bearer ") ? header.slice(7) : undefined;
}

/** Middleware: só deixa passar quem mandou um token de admin válido. */
export function exigirAdmin(req: Request, res: Response, next: NextFunction): void {
  const admin = authService.verificar(tokenDaRequisicao(req));
  if (!admin) {
    throw new NaoAutorizadoError("Faça login como administrador");
  }
  res.locals.admin = admin;
  next();
}
