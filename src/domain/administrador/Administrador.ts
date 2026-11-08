import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { RowDataPacket } from "mysql2/promise";

export interface AdministradorRow extends RowDataPacket {
  id: number;
  login: string;
  senha_hash: string;
}

export interface AdministradorJSON {
  id?: number;
  login: string;
}

/** Administrador do sistema. A senha nunca é guardada em texto: só o hash scrypt (salt:hash). */
export class Administrador {
  constructor(
    public readonly login: string,
    public readonly senhaHash: string,
    public id?: number,
  ) {}

  static criar(login: string, senha: string): Administrador {
    return new Administrador(login, Administrador.gerarHash(senha));
  }

  static fromRow(row: AdministradorRow): Administrador {
    return new Administrador(row.login, row.senha_hash, row.id);
  }

  static gerarHash(senha: string): string {
    const salt = randomBytes(16).toString("hex");
    return `${salt}:${scryptSync(senha, salt, 64).toString("hex")}`;
  }

  confereSenha(senha: string): boolean {
    const [salt, hash] = this.senhaHash.split(":");
    if (!salt || !hash) return false;
    const esperado = Buffer.from(hash, "hex");
    const recebido = scryptSync(senha, salt, esperado.length);
    return timingSafeEqual(esperado, recebido);
  }

  toJSON(): AdministradorJSON {
    return { id: this.id, login: this.login };
  }
}
