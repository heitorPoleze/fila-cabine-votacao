import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import type { IncomingMessage } from "node:http";
import { promisify } from "node:util";
import type { Request } from "express";
import type { DispositivoIdentificado } from "../domain/dispositivo/Dispositivo";
import { DispositivoRepository } from "../repository/DispositivoRepository";

const execFileAsync = promisify(execFile);

const MAC_REGEX = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
const CACHE_ARP_TTL_MS = 5 * 60 * 1000;
const cacheMacPorIp = new Map<string, { mac: string | null; expiraEm: number }>();

function primeiroHeader(valor: string | string[] | undefined): string | null {
  if (!valor) return null;
  const texto = Array.isArray(valor) ? valor[0] : valor;
  const limpo = texto?.split(",")[0]?.trim();
  return limpo ? limpo : null;
}

export function normalizarIp(ipBruto: string | undefined | null): string {
  if (!ipBruto) return "0.0.0.0";
  const ip = ipBruto.trim();
  if (ip === "::1" || ip === "0:0:0:0:0:0:0:1") return "127.0.0.1";
  if (ip.startsWith("::ffff:")) return ip.slice(7);
  return ip;
}

export function extrairIpRequisicao(req: Request): string {
  const ipBruto =
    primeiroHeader(req.headers["x-forwarded-for"]) ??
    primeiroHeader(req.headers["x-real-ip"]) ??
    req.ip ??
    req.socket?.remoteAddress ??
    "0.0.0.0";
  return normalizarIp(ipBruto);
}

function ehIpRedeLocalPrivada(ip: string): boolean {
  if (ip === "127.0.0.1" || ip === "0.0.0.0") return false;
  return (
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)
  );
}

function normalizarMac(macBruto: string | null | undefined): string | null {
  if (!macBruto) return null;
  const limpo = macBruto.trim().replace(/-/g, ":").toUpperCase();
  return MAC_REGEX.test(limpo) ? limpo : null;
}

/**
 * Tenta resolver o endereço MAC na tabela ARP do sistema operacional para dispositivos
 * conectados na mesma rede local (ex.: Wi-Fi da sala de aula). Possui timeout curto e cache.
 */
async function resolverMacRedeLocal(ip: string): Promise<string | null> {
  if (!ehIpRedeLocalPrivada(ip)) return null;

  const emCache = cacheMacPorIp.get(ip);
  if (emCache && emCache.expiraEm > Date.now()) {
    return emCache.mac;
  }

  try {
    const args = process.platform === "win32" ? ["-a", ip] : ["-n", ip];
    const { stdout } = await execFileAsync("arp", args, { timeout: 350, windowsHide: true });
    const match = stdout.match(/([0-9a-fA-F]{2}[:-]){5}[0-9a-fA-F]{2}/);
    const mac = normalizarMac(match?.[0] ?? null);
    cacheMacPorIp.set(ip, { mac, expiraEm: Date.now() + CACHE_ARP_TTL_MS });
    return mac;
  } catch {
    cacheMacPorIp.set(ip, { mac: null, expiraEm: Date.now() + 30_000 });
    return null;
  }
}

/** Extrai um nome amigável do dispositivo e navegador a partir dos headers HTTP. */
export function extrairNomeDispositivo(
  userAgent: string | null,
  secChUaPlatform: string | null,
  nomeExplicito: string | null,
): string {
  if (nomeExplicito && nomeExplicito.trim().length > 0) {
    return nomeExplicito.trim().slice(0, 200);
  }
  if (!userAgent) return "Dispositivo Desconhecido";

  if (/PostmanRuntime/i.test(userAgent)) return userAgent.slice(0, 100);
  if (/insomnia/i.test(userAgent)) return "Insomnia REST Client";
  if (/curl\//i.test(userAgent)) return userAgent.slice(0, 100);

  let so = secChUaPlatform?.replace(/"/g, "").trim() || "";
  if (!so) {
    if (/Android/i.test(userAgent)) {
      const modelo = userAgent.match(/Android\s+[\d.]+;\s*([^;)]+)/i)?.[1]?.trim();
      so = modelo ? `Android (${modelo})` : "Android";
    } else if (/iPhone/i.test(userAgent)) {
      so = "iPhone (iOS)";
    } else if (/iPad/i.test(userAgent)) {
      so = "iPad (iPadOS)";
    } else if (/Windows NT/i.test(userAgent)) {
      so = "Windows";
    } else if (/Mac OS X/i.test(userAgent)) {
      so = "macOS";
    } else if (/Linux/i.test(userAgent)) {
      so = "Linux";
    } else {
      so = "Dispositivo Web";
    }
  }

  let navegador = "Navegador";
  if (/Edg\//i.test(userAgent)) navegador = "Edge";
  else if (/OPR\/|Opera/i.test(userAgent)) navegador = "Opera";
  else if (/Chrome\//i.test(userAgent)) navegador = "Chrome";
  else if (/Firefox\//i.test(userAgent)) navegador = "Firefox";
  else if (/Safari\//i.test(userAgent)) navegador = "Safari";

  return `${so} - ${navegador}`.slice(0, 200);
}

function sha256(conteudo: string): string {
  return createHash("sha256").update(conteudo).digest("hex");
}

export class DispositivoService {
  constructor(private readonly repo = new DispositivoRepository()) {}

  async identificarRequisicao(req: Request): Promise<DispositivoIdentificado> {
    const body = (req.body && typeof req.body === "object" ? req.body : {}) as Record<string, unknown>;

    const ipBruto =
      primeiroHeader(req.headers["x-forwarded-for"]) ??
      primeiroHeader(req.headers["x-real-ip"]) ??
      req.ip ??
      req.socket?.remoteAddress ??
      "0.0.0.0";
    const ip = normalizarIp(ipBruto);

    const macExplicito =
      normalizarMac(primeiroHeader(req.headers["x-device-mac"])) ??
      normalizarMac(typeof body.mac === "string" ? body.mac : null);
    const mac = macExplicito ?? (await resolverMacRedeLocal(ip));

    const query = (req.query && typeof req.query === "object" ? req.query : {}) as Record<string, unknown>;
    const tokenUuidRaw =
      primeiroHeader(req.headers["x-device-token"]) ??
      primeiroHeader(req.headers["x-device-id"]) ??
      (typeof query.token === "string" ? query.token.trim() : null) ??
      (typeof query.dispositivoToken === "string" ? query.dispositivoToken.trim() : null) ??
      (typeof body.dispositivoToken === "string" ? body.dispositivoToken.trim() : null) ??
      (typeof body.tokenDispositivo === "string" ? body.tokenDispositivo.trim() : null);
    const tokenUuid = tokenUuidRaw && tokenUuidRaw.length > 0 ? tokenUuidRaw.slice(0, 100) : null;

    const userAgent = primeiroHeader(req.headers["user-agent"]);
    const secChUa = primeiroHeader(req.headers["sec-ch-ua"]) ?? "";
    const secChUaPlatform = primeiroHeader(req.headers["sec-ch-ua-platform"]);
    const secChUaMobile = primeiroHeader(req.headers["sec-ch-ua-mobile"]) ?? "";
    const acceptLanguage = primeiroHeader(req.headers["accept-language"]) ?? "";
    const clientFp =
      primeiroHeader(req.headers["x-device-fingerprint"]) ??
      (typeof body.fingerprint === "string" ? body.fingerprint.trim() : "");
    const nomeExplicito =
      primeiroHeader(req.headers["x-device-name"]) ??
      (typeof body.nomeDispositivo === "string" ? body.nomeDispositivo : null);

    const nomeDispositivo = extrairNomeDispositivo(userAgent, secChUaPlatform, nomeExplicito);

    const fingerprint = sha256(
      [userAgent ?? "", acceptLanguage, secChUa, secChUaPlatform ?? "", secChUaMobile, clientFp].join("|"),
    );

    const chaveIdentidade = tokenUuid
      ? `token:${tokenUuid}`
      : mac
        ? `mac:${mac}|fp:${fingerprint}`
        : `ip:${ip}|fp:${fingerprint}`;
    const dispositivoId = sha256(chaveIdentidade);

    return {
      dispositivoId,
      tokenUuid,
      ip,
      mac,
      nomeDispositivo,
      userAgent: userAgent ? userAgent.slice(0, 500) : null,
      fingerprint,
    };
  }

  public async identificarUpgradeWs(
    req: IncomingMessage,
    extra?: { tokenUuid?: unknown; fingerprint?: unknown; nomeDispositivo?: unknown; mac?: unknown },
  ): Promise<DispositivoIdentificado> {
    const ipBruto =
      primeiroHeader(req.headers["x-forwarded-for"]) ??
      primeiroHeader(req.headers["x-real-ip"]) ??
      req.socket?.remoteAddress ??
      "0.0.0.0";
    const ip = normalizarIp(ipBruto);

    const macExplicito =
      normalizarMac(primeiroHeader(req.headers["x-device-mac"])) ??
      normalizarMac(typeof extra?.mac === "string" ? extra.mac : null);
    const mac = macExplicito ?? (await resolverMacRedeLocal(ip));

    const tokenUuidRaw =
      primeiroHeader(req.headers["x-device-token"]) ??
      (typeof extra?.tokenUuid === "string" ? extra.tokenUuid.trim() : null);
    const tokenUuid = tokenUuidRaw && tokenUuidRaw.length > 0 ? tokenUuidRaw.slice(0, 100) : null;

    const userAgent = primeiroHeader(req.headers["user-agent"]);
    const secChUa = primeiroHeader(req.headers["sec-ch-ua"]) ?? "";
    const secChUaPlatform = primeiroHeader(req.headers["sec-ch-ua-platform"]);
    const secChUaMobile = primeiroHeader(req.headers["sec-ch-ua-mobile"]) ?? "";
    const acceptLanguage = primeiroHeader(req.headers["accept-language"]) ?? "";
    const clientFp =
      primeiroHeader(req.headers["x-device-fingerprint"]) ??
      (typeof extra?.fingerprint === "string" ? extra.fingerprint.trim() : "");
    const nomeExplicito =
      primeiroHeader(req.headers["x-device-name"]) ??
      (typeof extra?.nomeDispositivo === "string" ? extra.nomeDispositivo : null);

    const nomeDispositivo = extrairNomeDispositivo(userAgent, secChUaPlatform, nomeExplicito);
    const fingerprint = sha256(
      [userAgent ?? "", acceptLanguage, secChUa, secChUaPlatform ?? "", secChUaMobile, clientFp].join("|"),
    );

    const chaveIdentidade = tokenUuid
      ? `token:${tokenUuid}`
      : mac
        ? `mac:${mac}|fp:${fingerprint}`
        : `ip:${ip}|fp:${fingerprint}`;
    const dispositivoId = sha256(chaveIdentidade);

    return {
      dispositivoId,
      tokenUuid,
      ip,
      mac,
      nomeDispositivo,
      userAgent: userAgent ? userAgent.slice(0, 500) : null,
      fingerprint,
    };
  }
  public async consultarStatus(info: DispositivoIdentificado) {
    const registro = await this.repo.buscarPorIdentificacao(info);
    return {
      dispositivoId: info.dispositivoId,
      ip: info.ip,
      mac: registro?.mac ?? info.mac,
      nomeDispositivo: registro?.nomeDispositivo ?? info.nomeDispositivo,
      fingerprint: info.fingerprint,
      jaVotou: registro?.votoConcluido ?? false,
      bloqueadoParaCadastro: registro?.votoConcluido ?? false,
      votouEm: registro?.votouEm?.toISOString() ?? null,
    };
  }

  public async listarDispositivos() {
    return this.repo.listarTodos();
  }
}

export const dispositivoService = new DispositivoService();
