import { randomBytes, timingSafeEqual } from "node:crypto";
import { EventEmitter } from "node:events";
import { env } from "../config/env";
import type { Fila } from "../domain/fila/Fila";
import { FilaComum } from "../domain/fila/FilaComum";
import { FilaFactory } from "../domain/fila/FilaFactory";
import { FilaPreferencial } from "../domain/fila/FilaPreferencial";
import { GerenciadorFilas } from "../domain/fila/GerenciadorFilas";
import { TipoFila } from "../domain/usuario/TipoFila";
import { Usuario, type UsuarioJSON } from "../domain/usuario/Usuario";
import { Voto, type VotoJSON } from "../domain/voto/Voto";
import { CandidatoRepository } from "../repository/CandidatoRepository";
import { UsuarioRepository } from "../repository/UsuarioRepository";
import { AppError, ProibidoError } from "../errors";
import { VotoRepository, type ContagemCandidato } from "../repository/VotoRepository";

/** Erro de regra de negócio da fila (400): a mensagem pode ser mostrada ao usuário. */
export class FilaError extends AppError {
  readonly statusCode = 400;
  readonly code = "REGRA_DA_FILA";
}

/** Usuário como aparece no estado: com quantas pessoas tem à frente até a cabine. */
export interface UsuarioNaFila extends UsuarioJSON {
  aFrente: number;
}

export interface FilaEstado {
  preferencial: UsuarioNaFila[];
  comum: UsuarioNaFila[];
  /** Quem está na cabine é quem pode votar agora. */
  naCabine: UsuarioJSON | null;
  ultimosChamados: UsuarioJSON[];
  atualizadoEm: string;
}

export interface PosicaoAtual {
  id: number;
  nome: string;
  senha: number;
  tipoFila: TipoFila;
  posicaoNaFila: number;
  aFrente: number;
  podeVotar: boolean;
}

export interface ResultadoVoto {
  voto: VotoJSON;
  resultado: ContagemCandidato[];
  /** Quanto o servidor levou para processar a requisição de voto. */
  tempoProcessamentoMs: number;
}

/** Usuário recém-criado: é a única vez que a chave sai do servidor. */
export type UsuarioComChave = UsuarioJSON & { chave: string };

const MAX_ULTIMOS_CHAMADOS = 5;
const TAMANHO_MAX_NOME = 150;
const PRENOMES = [
  "Maria", "João", "Ana", "José", "Pedro", "Juliana", "Antônio", "Lucas", "Fernanda", "Gabriel",
  "Beatriz", "Carlos", "Larissa", "Rafael", "Camila", "Paulo", "Letícia", "Mateus", "Patrícia", "Bruno",
  "Aline", "Felipe", "Vanessa", "Gustavo", "Renata", "Diego", "Sandra", "Thiago", "Helena", "Marcos",
];
const SOBRENOMES = [
  "Silva", "Souza", "Oliveira", "Santos", "Pereira", "Costa", "Ferreira", "Almeida", "Rodrigues", "Lima",
  "Gomes", "Ribeiro", "Martins", "Carvalho", "Araújo", "Barbosa", "Rocha", "Dias", "Moreira", "Nunes",
];

/**
 * Nomes distintos para as pessoas de demonstração. As duas filas sempre recebem gente:
 * 1 em cada 3 vai para a preferencial (30 → 10 preferenciais e 20 comuns), intercalados
 * na ordem de chegada.
 */
function gerarMocks(qtd: number): Array<[string, TipoFila]> {
  const usados = new Set<string>();
  const mocks: Array<[string, TipoFila]> = [];
  while (mocks.length < qtd) {
    const nome =
      PRENOMES[Math.floor(Math.random() * PRENOMES.length)] +
      " " +
      SOBRENOMES[Math.floor(Math.random() * SOBRENOMES.length)];
    if (usados.has(nome) && usados.size < PRENOMES.length * SOBRENOMES.length) continue;
    usados.add(nome);
    mocks.push([nome, mocks.length % 3 === 1 ? TipoFila.Preferencial : TipoFila.Comum]);
  }
  return mocks;
}

/**
 * Mantém as duas filas (FilaPreferencial e FilaComum, sobre DoublyLinkedList) em memória
 * e espelha no MySQL quem está aguardando, para sobreviver a um restart do servidor.
 *
 * Regras:
 * - a sequência entre preferencial e comum é decidida pelo GerenciadorFilas
 *   (a preferencial passa 1, 3 ou 5 vezes seguidas conforme o tamanho dela
 *   em relação à comum; depois chama 1 da comum);
 * - só uma pessoa ocupa a cabine por vez;
 * - o administrador chama o próximo com proximoAVotar() (ou, com CHAMADA_AUTOMATICA=true,
 *   ele é chamado sozinho assim que a cabine fica livre);
 * - quando alguém sai da fila, a posição de quem estava atrás é decrementada.
 *
 * Eventos: "mudou" (estado novo) e "proximo" (quem pode votar agora).
 */
export class FilaService extends EventEmitter {
  private readonly filaPreferencial = new FilaPreferencial();
  private readonly filaComum = new FilaComum();
  private readonly filaFactory = new FilaFactory(this.filaPreferencial, this.filaComum);
  private readonly gerenciador = new GerenciadorFilas(this.filaFactory);
  private readonly proximaSenha: Record<TipoFila, number> = {
    [TipoFila.Preferencial]: 1,
    [TipoFila.Comum]: 1,
  };
  private naCabine: Usuario | null = null;
  private ultimosChamados: Usuario[] = [];
  private atualizadoEm = new Date();
  private votoMock: ReturnType<typeof setTimeout> | null = null;

  /** Serializa as operações para a lista em memória e o banco nunca divergirem. */
  private execucao: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly repo = new UsuarioRepository(),
    private readonly votos = new VotoRepository(),
    private readonly candidatos = new CandidatoRepository(),
  ) {
    super();
  }

  private exclusivo<T>(fn: () => Promise<T>): Promise<T> {
    const resultado = this.execucao.then(fn);
    this.execucao = resultado.catch(() => undefined);
    return resultado;
  }

  /** Recarrega do banco quem estava aguardando quando o servidor caiu. */
  carregar(): Promise<void> {
    return this.exclusivo(async () => {
      const usuarios = await this.repo.listarTodos();
      for (const fila of this.filas) fila.limpar();
      this.gerenciador.zerarContagem();
      for (const usuario of usuarios) {
        this.filaFactory.filaDe(usuario).enfileirar(usuario);
        this.proximaSenha[usuario.tipoFila] = Math.max(
          this.proximaSenha[usuario.tipoFila],
          usuario.senha + 1,
        );
      }
      for (const fila of this.filas) fila.ordenar();
      this.tocar();
    });
  }

  get totalAguardando(): number {
    return this.filaPreferencial.tamanho + this.filaComum.tamanho;
  }

  entrar(nome: unknown, tipoFila: unknown): Promise<UsuarioComChave> {
    const nomeLimpo = typeof nome === "string" ? nome.trim() : "";
    if (!nomeLimpo) throw new FilaError("Informe o nome");
    if (nomeLimpo.length > TAMANHO_MAX_NOME) {
      throw new FilaError(`O nome pode ter no máximo ${TAMANHO_MAX_NOME} caracteres`);
    }
    if (tipoFila !== TipoFila.Preferencial && tipoFila !== TipoFila.Comum) {
      throw new FilaError("Tipo de fila inválido");
    }

    return this.exclusivo(async () => {
      const usuario = await this.inserirNaFila(nomeLimpo, tipoFila, false);
      this.tocar();
      await this.chamarSeAutomatico();
      return { ...usuario.toJSON(), chave: usuario.chave };
    });
  }

  /** Enche a fila com pessoas de demonstração. Elas votam sozinhas quando são chamadas. */
  popularMock(qtd = env.MOCK_QTD): Promise<UsuarioJSON[]> {
    return this.exclusivo(async () => {
      const inseridos: Usuario[] = [];
      for (const [nome, tipo] of gerarMocks(qtd)) {
        inseridos.push(await this.inserirNaFila(nome, tipo, true));
      }
      this.tocar();
      await this.chamarSeAutomatico();
      return inseridos.map((u) => u.toJSON());
    });
  }

  /**
   * Chama o próximo para a cabine, na sequência do GerenciadorFilas.
   * Avisa todos (evento "proximo") quem pode votar agora.
   */
  proximoAVotar(): Promise<Usuario> {
    return this.exclusivo(async () => {
      if (this.naCabine) {
        throw new FilaError(`A cabine está ocupada por ${this.naCabine.nome}`);
      }
      const proximo = await this.chamarSeLivre();
      if (!proximo) throw new FilaError("Não há ninguém aguardando");
      return proximo;
    });
  }

  /** Libera a cabine sem voto (ex.: eleitor foi embora). */
  liberarCabine(): Promise<void> {
    return this.exclusivo(async () => {
      if (!this.naCabine) throw new FilaError("A cabine já está livre");
      this.esvaziarCabine();
      this.tocar();
      await this.chamarSeAutomatico();
    });
  }

  /**
   * Registra o voto de quem está na cabine e tira a pessoa da cabine.
   * A cabine fica livre até o administrador chamar o próximo.
   */
  votar(usuarioId: unknown, chave: unknown, candidatoId: unknown): Promise<ResultadoVoto> {
    const inicio = performance.now();
    if (typeof usuarioId !== "number" || !Number.isInteger(usuarioId)) throw new FilaError("Usuário inválido");
    if (typeof candidatoId !== "number" || !Number.isInteger(candidatoId)) throw new FilaError("Candidato inválido");

    return this.exclusivo(async () => {
      const eleitor = this.naCabine;
      if (!eleitor || eleitor.id !== usuarioId) {
        throw new FilaError("Não é a sua vez de votar");
      }
      if (!chaveConfere(eleitor.chave, chave)) throw new FilaError("Ticket inválido");
      return this.registrarVoto(eleitor, candidatoId, inicio);
    });
  }

  /**
   * Voto pela API /api/v1 (sem a chave do ticket): vale para quem está na cabine ou,
   * com a cabine livre, para quem é o próximo a votar (é chamado e vota na hora).
   */
  votarPelaApi(usuarioId: number, candidatoId: number): Promise<ResultadoVoto> {
    const inicio = performance.now();
    return this.exclusivo(async () => {
      let eleitor = this.naCabine;
      if (!eleitor && this.gerenciador.proximoAVotar()?.id === usuarioId) {
        eleitor = await this.chamarSeLivre();
      }
      if (!eleitor || eleitor.id !== usuarioId) {
        throw new ProibidoError("Ainda não é a vez deste usuário votar");
      }
      return this.registrarVoto(eleitor, candidatoId, inicio);
    });
  }

  /** Quem o GerenciadorFilas chamaria agora (sem tirar da fila). */
  proximoDaVez(): UsuarioJSON | null {
    return this.gerenciador.proximoAVotar()?.toJSON() ?? null;
  }

  /** Um usuário que está aguardando ou na cabine, com a posição atual. */
  buscar(id: number): UsuarioNaFila | null {
    const estado = this.estado();
    if (estado.naCabine?.id === id) return { ...estado.naCabine, aFrente: 0 };
    return [...estado.preferencial, ...estado.comum].find((u) => u.id === id) ?? null;
  }

  private async registrarVoto(eleitor: Usuario, candidatoId: number, inicio: number): Promise<ResultadoVoto> {
      const candidatos = await this.candidatos.listar();
      const candidato = candidatos.find((c) => c.id === candidatoId);
      if (!candidato) throw new FilaError("Candidato inválido");

      const voto = new Voto(
        eleitor.nome,
        eleitor.senha,
        eleitor.tipoFila,
        candidato.id,
        eleitor.entrouEm,
        eleitor.chamadoEm ?? new Date(),
        new Date(),
      );
      await this.votos.inserir(voto);
      voto.candidatoNome = candidato.nome;

      this.esvaziarCabine();
      this.tocar();
      this.emit("voto", voto.toJSON());
      await this.chamarSeAutomatico();

      const resultado = await this.votos.contagem();
      return {
        voto: voto.toJSON(),
        resultado,
        tempoProcessamentoMs: Math.round((performance.now() - inicio) * 10) / 10,
      };
  }

  /**
   * Tira alguém da fila (desistência ou admin). Quem estava atrás anda uma posição.
   * Se `chave` vier, ela precisa conferir (é o próprio eleitor saindo).
   */
  remover(id: unknown, chave?: unknown): Promise<UsuarioJSON> {
    if (typeof id !== "number" || !Number.isInteger(id)) {
      throw new FilaError("Id inválido");
    }
    return this.exclusivo(async () => {
      for (const fila of this.filas) {
        const indice = fila.posicaoDe(this.alvo(id));
        if (indice === -1) continue;
        const usuario = fila.elementoEm(indice)!;
        if (chave !== undefined && !chaveConfere(usuario.chave, chave)) {
          throw new FilaError("Ticket inválido");
        }
        await this.tirarDaFila(fila, indice);
        this.tocar();
        return usuario.toJSON();
      }
      throw new FilaError("Essa pessoa não está mais na fila");
    });
  }

  /**
   * Recomeça do zero: esvazia as duas filas e a cabine, apaga os votos e o histórico
   * de chamados, volta as senhas para P001/C001 e enche a fila de novo com mocks.
   */
  reiniciar(qtd = env.MOCK_QTD): Promise<FilaEstado> {
    return this.exclusivo(async () => {
      this.esvaziarCabine();
      await this.repo.limpar();
      await this.votos.limpar();
      for (const fila of this.filas) fila.limpar();
      this.gerenciador.zerarContagem();
      this.proximaSenha[TipoFila.Preferencial] = 1;
      this.proximaSenha[TipoFila.Comum] = 1;
      this.ultimosChamados = [];

      for (const [nome, tipo] of gerarMocks(qtd)) {
        await this.inserirNaFila(nome, tipo, true);
      }
      this.tocar();
      this.emit("voto", null); // resultado zerado: os clientes buscam /resultados de novo
      return this.estado();
    });
  }

  resultado(): Promise<ContagemCandidato[]> {
    return this.votos.contagem();
  }

  relatorio(): Promise<VotoJSON[]> {
    return this.votos.listar().then((v) => v.map((x) => x.toJSON()));
  }

  estado(): FilaEstado {
    // "À frente" segue a ordem real de chamada do GerenciadorFilas (com a alternância
    // entre preferencial e comum), mais 1 se a cabine estiver ocupada.
    const ocupada = this.naCabine ? 1 : 0;
    const ordem = new Map(this.gerenciador.ordemDeChamada().map((u, i) => [u.id, i]));
    const comAFrente = (fila: Fila<Usuario>): UsuarioNaFila[] =>
      fila.paraArray().map((u) => ({ ...u.toJSON(), aFrente: ocupada + (ordem.get(u.id) ?? 0) }));
    const pref = comAFrente(this.filaPreferencial);
    const comum = comAFrente(this.filaComum);
    return {
      preferencial: pref,
      comum,
      naCabine: this.naCabine?.toJSON() ?? null,
      ultimosChamados: this.ultimosChamados.map((u) => u.toJSON()),
      atualizadoEm: this.atualizadoEm.toISOString(),
    };
  }

  /** Posição atual de todos que estão na fila e quem pode votar. */
  posicoes(): { podeVotar: UsuarioJSON | null; fila: PosicaoAtual[] } {
    const estado = this.estado();
    const linha = (u: UsuarioNaFila): PosicaoAtual => ({
      id: u.id!,
      nome: u.nome,
      senha: u.senha,
      tipoFila: u.tipoFila,
      posicaoNaFila: u.posicaoNaFila,
      aFrente: u.aFrente,
      podeVotar: false,
    });
    const fila = [...estado.preferencial, ...estado.comum].sort((a, b) => a.aFrente - b.aFrente).map(linha);
    if (estado.naCabine) {
      fila.unshift({ ...linha({ ...estado.naCabine, aFrente: 0 }), posicaoNaFila: 0, podeVotar: true });
    }
    return { podeVotar: estado.naCabine, fila };
  }

  // ---------------------------------------------------------------- internos
  // Os métodos abaixo assumem que já estão dentro de exclusivo().

  private async inserirNaFila(nome: string, tipoFila: TipoFila, mock: boolean): Promise<Usuario> {
    const fila = this.filaFactory.filaPorTipo(tipoFila);
    const usuario = new Usuario(
      nome,
      this.proximaSenha[tipoFila],
      fila.tamanho + 1,
      tipoFila,
      new Date(),
      randomBytes(16).toString("hex"),
      mock,
    );
    await this.repo.inserir(usuario);
    this.proximaSenha[tipoFila]++;
    fila.enfileirar(usuario);
    return usuario;
  }

  /** Remove o elemento `indice` da fila e decrementa a posição de quem estava atrás. */
  private async tirarDaFila(fila: Fila<Usuario>, indice: number): Promise<Usuario> {
    const usuario = fila.elementoEm(indice)!;
    await this.repo.remover(usuario.id!);
    await this.repo.decrementarPosicoes(usuario.tipoFila, usuario.posicaoNaFila);
    fila.removerEm(indice);
    for (let i = indice; i < fila.tamanho; i++) {
      fila.elementoEm(i)!.posicaoNaFila--;
    }
    return usuario;
  }

  /** Só chama sozinho quando CHAMADA_AUTOMATICA=true; senão espera o administrador. */
  private chamarSeAutomatico(): Promise<Usuario | null> {
    return env.CHAMADA_AUTOMATICA ? this.chamarSeLivre() : Promise.resolve(null);
  }

  /** Se a cabine está livre e tem alguém esperando, chama quem o GerenciadorFilas indicar. */
  private async chamarSeLivre(): Promise<Usuario | null> {
    if (this.naCabine) return null;
    const escolhido = this.gerenciador.proximoAVotar();
    if (!escolhido) return null;

    const proximo = await this.tirarDaFila(this.filaFactory.filaDe(escolhido), 0);
    this.gerenciador.registrarChamada(proximo);
    proximo.chamadoEm = new Date();
    proximo.posicaoNaFila = 0; // 0 = na cabine
    this.naCabine = proximo;
    this.ultimosChamados = [proximo, ...this.ultimosChamados].slice(0, MAX_ULTIMOS_CHAMADOS);
    this.tocar();
    this.emit("proximo", proximo.toJSON());

    if (proximo.mock) this.agendarVotoMock(proximo);
    return proximo;
  }

  /** Pessoa de demonstração: vota num candidato aleatório depois de alguns segundos. */
  private agendarVotoMock(usuario: Usuario): void {
    const espera = env.MOCK_VOTO_MS * (0.6 + Math.random() * 0.8);
    this.votoMock = setTimeout(() => {
      this.votoMock = null;
      const candidatoId = Math.random() < 0.5 ? 1 : 2;
      this.votar(usuario.id, usuario.chave, candidatoId).catch((err) => {
        if (!(err instanceof FilaError)) console.error("Falha no voto do mock:", err);
      });
    }, espera);
  }

  private esvaziarCabine(): void {
    if (this.votoMock) clearTimeout(this.votoMock);
    this.votoMock = null;
    this.naCabine = null;
  }

  private alvo(id: number): Usuario {
    return new Usuario("", 0, 0, TipoFila.Comum, new Date(), "", false, id);
  }

  private get filas(): Fila<Usuario>[] {
    return [this.filaPreferencial, this.filaComum];
  }

  private tocar(): void {
    this.atualizadoEm = new Date();
    this.emit("mudou", this.estado());
  }
}

function chaveConfere(esperada: string, recebida: unknown): boolean {
  if (typeof recebida !== "string" || recebida.length !== esperada.length) return false;
  return timingSafeEqual(Buffer.from(esperada), Buffer.from(recebida));
}

export const filaService = new FilaService();
