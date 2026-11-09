import { randomBytes, timingSafeEqual } from "node:crypto";
import { EventEmitter } from "node:events";
import { env } from "../config/env";
import { LogAuditoria, type OperacaoAuditoria } from "../domain/auditoria/LogAuditoria";
import type { DispositivoIdentificado } from "../domain/dispositivo/Dispositivo";
import type { Fila } from "../domain/fila/Fila";
import { FilaComum } from "../domain/fila/FilaComum";
import { FilaFactory } from "../domain/fila/FilaFactory";
import { FilaPreferencial } from "../domain/fila/FilaPreferencial";
import {
  GerenciadorFilas,
  listarElementosFifo,
  type ResumoProporcaoFila,
} from "../domain/fila/GerenciadorFilas";
import { TipoFila } from "../domain/usuario/TipoFila";
import { Usuario, type UsuarioJSON } from "../domain/usuario/Usuario";
import { Voto, type VotoJSON } from "../domain/voto/Voto";
import {
  AppError,
  JaVotouError,
  NaoEncontradoError,
  ProibidoError,
  RequisicaoInvalidaError,
} from "../errors";
import { CandidatoRepository } from "../repository/CandidatoRepository";
import { DispositivoRepository } from "../repository/DispositivoRepository";
import { LogAuditoriaRepository } from "../repository/LogAuditoriaRepository";
import { LogRequisicaoRepository } from "../repository/LogRequisicaoRepository";
import { UsuarioRepository } from "../repository/UsuarioRepository";
import { VotoRepository, type ContagemCandidato } from "../repository/VotoRepository";

/** Erro de regra de negócio da fila (400): a mensagem pode ser mostrada ao usuário. */
export class FilaError extends AppError {
  readonly statusCode = 400;
  readonly code = "REGRA_DA_FILA";
}

/** Usuário como aparece no estado: com quantas pessoas tem à frente e posição global (1-based). */
export interface UsuarioNaFila extends UsuarioJSON {
  aFrente: number;
  posicaoGlobal: number;
}

export interface FilaEstado {
  modoMock: boolean;
  proporcao: ResumoProporcaoFila;
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
  posicaoGlobal: number;
  aFrente: number;
  podeVotar: boolean;
}

export interface ResultadoVoto {
  voto: VotoJSON;
  resultado: ContagemCandidato[];
  tempoProcessamentoMs: number;
}

export interface OpcoesPopularMock {
  qtd?: number;
  qtdPreferencial?: number;
  qtdComum?: number;
  limparAntes?: boolean;
}

/** Usuário recém-criado: é a única vez que a chave sai do servidor. */
export type UsuarioComChave = UsuarioJSON & {
  chave: string;
  posicaoGlobal: number;
  aFrente: number;
};

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

function nomeAleatorio(usados?: Set<string>): string {
  for (let tentativa = 0; tentativa < 50; tentativa++) {
    const nome =
      PRENOMES[Math.floor(Math.random() * PRENOMES.length)] +
      " " +
      SOBRENOMES[Math.floor(Math.random() * SOBRENOMES.length)];
    if (!usados || !usados.has(nome)) {
      usados?.add(nome);
      return nome;
    }
  }
  return `Eleitor Demo ${Math.floor(1000 + Math.random() * 9000)}`;
}

function gerarMocks(opcoes: OpcoesPopularMock): Array<[string, TipoFila]> {
  const usados = new Set<string>();
  const mocks: Array<[string, TipoFila]> = [];

  if (opcoes.qtdPreferencial !== undefined || opcoes.qtdComum !== undefined) {
    const p = Math.max(0, Math.trunc(opcoes.qtdPreferencial ?? 0));
    const c = Math.max(0, Math.trunc(opcoes.qtdComum ?? 0));
    let ip = 0;
    let ic = 0;
    while (ip < p || ic < c) {
      if (ic < c) {
        mocks.push([nomeAleatorio(usados), TipoFila.Comum]);
        ic++;
      }
      if (ip < p) {
        mocks.push([nomeAleatorio(usados), TipoFila.Preferencial]);
        ip++;
      }
    }
    return mocks;
  }

  const qtd = Math.max(0, Math.trunc(opcoes.qtd ?? env.MOCK_QTD));
  while (mocks.length < qtd) {
    mocks.push([
      nomeAleatorio(usados),
      mocks.length % 3 === 1 ? TipoFila.Preferencial : TipoFila.Comum,
    ]);
  }
  return mocks;
}

function criarDispositivoMock(): DispositivoIdentificado {
  const sufixo = randomBytes(6).toString("hex");
  return {
    dispositivoId: `mock-${sufixo}`.padEnd(64, "0"),
    tokenUuid: `mock-token-${sufixo}`,
    ip: "127.0.0.254",
    mac: null,
    nomeDispositivo: "Simulador Mock (Admin Demo)",
    userAgent: "MockSimulator/1.0",
    fingerprint: `mock-fp-${sufixo}`.padEnd(64, "0"),
  };
}

/**
 * Isola um contexto completo de filas (FilaPreferencial, FilaComum, FilaFactory e GerenciadorFilas).
 * Mantemos duas instâncias totalmente independentes:
 * - `real`: eleitores em dispositivos reais e apuração oficial;
 * - `mock`: demonstração pelo administrador dos métodos da Fila e proporções sem afetar a fila real.
 */
class ContextoFila {
  readonly filaPreferencial = new FilaPreferencial();
  readonly filaComum = new FilaComum();
  readonly filaFactory = new FilaFactory(this.filaPreferencial, this.filaComum);
  readonly gerenciador = new GerenciadorFilas(this.filaFactory);
  readonly proximaSenha: Record<TipoFila, number> = {
    [TipoFila.Preferencial]: 1,
    [TipoFila.Comum]: 1,
  };
  naCabine: Usuario | null = null;
  ultimosChamados: Usuario[] = [];

  constructor(public readonly ehMock: boolean) {}

  public get filas(): Fila<Usuario>[] {
    return [this.filaPreferencial, this.filaComum];
  }

  public get totalAguardando(): number {
    return this.filaPreferencial.tamanho + this.filaComum.tamanho;
  }

  public resetarMemoria(): void {
    this.naCabine = null;
    this.ultimosChamados = [];
    this.filaPreferencial.limpar();
    this.filaComum.limpar();
    this.gerenciador.zerarContagem();
    this.proximaSenha[TipoFila.Preferencial] = 1;
    this.proximaSenha[TipoFila.Comum] = 1;
  }
}

export class FilaService extends EventEmitter {
  private readonly real = new ContextoFila(false);
  private readonly mock = new ContextoFila(true);
  private _modoMock: boolean = env.SEED_MOCK;
  private atualizadoEm = new Date();
  private votoMock: ReturnType<typeof setTimeout> | null = null;

  /** Serializa operações assíncronas para manter memória e MySQL consistentes. */
  private execucao: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly repo = new UsuarioRepository(),
    private readonly votos = new VotoRepository(),
    private readonly candidatos = new CandidatoRepository(),
    private readonly dispositivos = new DispositivoRepository(),
    private readonly auditoria = new LogAuditoriaRepository(),
    private readonly requisicoes = new LogRequisicaoRepository(),
  ) {
    super();
  }

  public get modoMock(): boolean {
    return this._modoMock;
  }

  private get contextoAtivo(): ContextoFila {
    return this._modoMock ? this.mock : this.real;
  }

  private exclusivo<T>(fn: () => Promise<T>): Promise<T> {
    const resultado = this.execucao.then(fn);
    this.execucao = resultado.catch(() => undefined);
    return resultado;
  }

  /** Recarrega do banco quem estava aguardando quando o servidor reiniciou (separando real e mock). */
  public carregar(): Promise<void> {
    return this.exclusivo(async () => {
      const [usuariosReais, usuariosMock] = await Promise.all([
        this.repo.listarPorMock(false),
        this.repo.listarPorMock(true),
      ]);

      this.real.resetarMemoria();
      for (const u of usuariosReais) {
        this.real.filaFactory.filaDe(u).enfileirar(u);
        this.real.proximaSenha[u.tipoFila] = Math.max(
          this.real.proximaSenha[u.tipoFila],
          u.senha + 1,
        );
      }

      this.mock.resetarMemoria();
      for (const u of usuariosMock) {
        this.mock.filaFactory.filaDe(u).enfileirar(u);
        this.mock.proximaSenha[u.tipoFila] = Math.max(
          this.mock.proximaSenha[u.tipoFila],
          u.senha + 1,
        );
      }

      this.tocar();
    });
  }

  public get totalAguardando(): number {
    return this.contextoAtivo.totalAguardando;
  }

  public get totalAguardandoMock(): number {
    return this.mock.totalAguardando;
  }

  public get totalAguardandoReal(): number {
    return this.real.totalAguardando;
  }

  // =========================================================================
  // FLUXO DO ELEITOR REAL (Dispositivos Reais — /api/v1 e WebSocket)
  // =========================================================================

  /**
   * Cadastra um eleitor real na fila oficial (`this.real`), validando os dados
   * do dispositivo para bloquear mais de 1 voto pelo mesmo aparelho/navegador.
   */
  public async entrar(
    nome: unknown,
    tipoFila: unknown,
    dispositivo?: DispositivoIdentificado,
    tempoRequisicaoMs?: number,
  ): Promise<UsuarioComChave> {
    const inicio = performance.now();
    const nomeLimpo = typeof nome === "string" ? nome.trim() : "";
    if (!nomeLimpo) throw new FilaError("Informe o nome");
    if (nomeLimpo.length > TAMANHO_MAX_NOME) {
      throw new FilaError(`O nome pode ter no máximo ${TAMANHO_MAX_NOME} caracteres`);
    }
    if (tipoFila !== TipoFila.Preferencial && tipoFila !== TipoFila.Comum) {
      throw new FilaError("Tipo de fila inválido");
    }

    return this.exclusivo(async () => {
      let dispositivoEfetivo = dispositivo;
      if (dispositivo) {
        const regDispositivo = await this.dispositivos.buscarPorIdentificacao(dispositivo);
        if (regDispositivo?.votoConcluido) {
          await this.registrarLog({
            operacao: "BLOQUEIO_DUPLICIDADE",
            usuarioId: null,
            eleitorNome: nomeLimpo,
            tipoFila,
            dispositivo,
            tempoRequisicaoMs:
              tempoRequisicaoMs ?? Math.round((performance.now() - inicio) * 100) / 100,
            detalhes: "Tentativa de novo cadastro bloqueada: dispositivo já concluiu votação.",
          });
          throw new JaVotouError(
            regDispositivo.usuarioVotanteId ?? undefined,
            "Este dispositivo já concluiu o voto e não pode votar mais de uma vez",
          );
        }
        const salvo = await this.dispositivos.registrarOuAtualizarAcesso(
          dispositivo,
          nomeLimpo,
          tipoFila,
        );
        dispositivoEfetivo = { ...dispositivo, dispositivoId: salvo.dispositivoId };
      }

      const usuario = await this.inserirNoContexto(
        this.real,
        nomeLimpo,
        tipoFila,
        dispositivoEfetivo,
      );
      await this.registrarLog({
        operacao: "CADASTRO_FILA",
        usuarioId: usuario.id ?? null,
        eleitorNome: usuario.nome,
        tipoFila: usuario.tipoFila,
        dispositivo: dispositivoEfetivo,
        entrouNaFilaEm: usuario.entrouEm,
        tempoRequisicaoMs:
          tempoRequisicaoMs ?? Math.round((performance.now() - inicio) * 100) / 100,
        detalhes: `Inserido na fila ${usuario.tipoFila} (posição na subfila: ${usuario.posicaoNaFila})`,
      });

      await this.chamarSeAutomatico(this.real);
      if (!this._modoMock) this.tocar();

      const naFila = this.buscarNoContexto(this.real, usuario.id!);
      const aFrente = naFila?.aFrente ?? 0;
      const posicaoGlobal = naFila?.posicaoGlobal ?? 1;

      return {
        ...usuario.toJSON(),
        chave: usuario.chave,
        aFrente,
        posicaoGlobal,
      };
    });
  }

  /** Consulta posição do eleitor na fila real (`1` = primeiro a votar / na cabine). */
  public buscarReal(id: number): UsuarioNaFila | null {
    return this.buscarNoContexto(this.real, id);
  }

  /** Consulta posição no contexto atualmente ativo (painel). */
  public buscar(id: number): UsuarioNaFila | null {
    return this.buscarNoContexto(this.contextoAtivo, id) ?? this.buscarNoContexto(this.real, id);
  }

  /** Quem é o próximo na fila real segundo a proporção do GerenciadorFilas. */
  public proximoDaVez(): UsuarioJSON | null {
    return this.real.gerenciador.proximoAVotar()?.toJSON() ?? null;
  }

  /**
   * Voto pela API oficial `/api/v1/voto`:
   *  - 404 se o candidato não existir;
   *  - 409 se o usuário já votou ou se o dispositivo já registrou voto;
   *  - 404 se o usuário não existir;
   *  - 403 se o usuário não for o 1º da fila geral (respeitando proporção 1:1 / 3:1 / 5:1);
   *  - 201 registra o voto, remove o eleitor da fila/cabine e trava o dispositivo.
   */
  public votarPelaApi(
    usuarioId: number,
    candidatoId: number,
    dispositivoRequisicao?: DispositivoIdentificado,
    tempoRequisicaoMs?: number,
  ): Promise<ResultadoVoto> {
    const inicio = performance.now();
    return this.exclusivo(async () => {
      const listaCandidatos = await this.candidatos.listar(false);
      const candidato = listaCandidatos.find((c) => c.id === candidatoId);
      if (!candidato) {
        throw new NaoEncontradoError("Candidato", candidatoId);
      }

      if (await this.votos.usuarioJaVotou(usuarioId)) {
        await this.registrarLog({
          operacao: "BLOQUEIO_DUPLICIDADE",
          usuarioId,
          eleitorNome: null,
          tipoFila: null,
          dispositivo: dispositivoRequisicao,
          candidatoId,
          candidatoNome: candidato.nome,
          tempoRequisicaoMs:
            tempoRequisicaoMs ?? Math.round((performance.now() - inicio) * 100) / 100,
          detalhes: `Tentativa de voto repetido bloqueada para idUsuario=${usuarioId}`,
        });
        throw new JaVotouError(usuarioId);
      }

      const usuarioLocalizado = this.encontrarInstanciaNoContexto(this.real, usuarioId);
      if (!usuarioLocalizado) {
        throw new NaoEncontradoError("Usuário", usuarioId);
      }

      // Trava de voto único por dispositivo (impede inclusive múltiplas abas abertas antes do voto)
      if (usuarioLocalizado.dispositivoId) {
        const dispSalvo = await this.dispositivos.buscarPorDispositivoId(
          usuarioLocalizado.dispositivoId,
        );
        if (dispSalvo?.votoConcluido) {
          await this.removerUsuarioRealBloqueado(usuarioId);
          await this.registrarLog({
            operacao: "BLOQUEIO_DUPLICIDADE",
            usuarioId,
            eleitorNome: usuarioLocalizado.nome,
            tipoFila: usuarioLocalizado.tipoFila,
            dispositivo: dispositivoRequisicao,
            candidatoId,
            candidatoNome: candidato.nome,
            entrouNaFilaEm: usuarioLocalizado.entrouEm,
            tempoRequisicaoMs:
              tempoRequisicaoMs ?? Math.round((performance.now() - inicio) * 100) / 100,
            detalhes: "Dispositivo associado ao usuário já havia concluído um voto.",
          });
          throw new JaVotouError(
            usuarioId,
            "Este dispositivo já concluiu um voto e não pode votar mais de uma vez",
          );
        }
      }
      if (dispositivoRequisicao) {
        const dispReq = await this.dispositivos.buscarPorIdentificacao(dispositivoRequisicao);
        if (dispReq?.votoConcluido) {
          await this.removerUsuarioRealBloqueado(usuarioId);
          await this.registrarLog({
            operacao: "BLOQUEIO_DUPLICIDADE",
            usuarioId,
            eleitorNome: usuarioLocalizado.nome,
            tipoFila: usuarioLocalizado.tipoFila,
            dispositivo: dispositivoRequisicao,
            candidatoId,
            candidatoNome: candidato.nome,
            entrouNaFilaEm: usuarioLocalizado.entrouEm,
            tempoRequisicaoMs:
              tempoRequisicaoMs ?? Math.round((performance.now() - inicio) * 100) / 100,
            detalhes: "Dispositivo da requisição já havia concluído um voto.",
          });
          throw new JaVotouError(
            usuarioId,
            "Este dispositivo já concluiu um voto e não pode votar mais de uma vez",
          );
        }
      }

      let eleitor = this.real.naCabine;
      if (!eleitor && this.real.gerenciador.proximoAVotar()?.id === usuarioId) {
        eleitor = await this.chamarSeLivre(this.real);
      }

      if (!eleitor || eleitor.id !== usuarioId) {
        throw new ProibidoError("Usuário não é o primeiro da fila");
      }

      return this.registrarVotoNoContexto(
        this.real,
        eleitor,
        candidato.id,
        candidato.nome,
        inicio,
        dispositivoRequisicao,
        tempoRequisicaoMs,
      );
    });
  }

  /** Voto com ticket/chave (usado pela cabine WebSocket/REST `/votos`). */
  public votar(
    usuarioId: unknown,
    chave: unknown,
    candidatoId: unknown,
    dispositivoRequisicao?: DispositivoIdentificado,
    tempoRequisicaoMs?: number,
  ): Promise<ResultadoVoto> {
    const inicio = performance.now();
    if (typeof usuarioId !== "number" || !Number.isInteger(usuarioId)) {
      throw new FilaError("Usuário inválido");
    }
    if (typeof candidatoId !== "number" || !Number.isInteger(candidatoId)) {
      throw new FilaError("Candidato inválido");
    }

    return this.exclusivo(async () => {
      const ctx = this.mock.naCabine?.id === usuarioId ? this.mock : this.real;
      const eleitor = ctx.naCabine;
      if (!eleitor || eleitor.id !== usuarioId) {
        throw new FilaError("Não é a sua vez de votar");
      }
      if (!chaveConfere(eleitor.chave, chave)) {
        throw new FilaError("Ticket inválido");
      }

      if (!ctx.ehMock) {
        if (eleitor.dispositivoId) {
          const disp = await this.dispositivos.buscarPorDispositivoId(eleitor.dispositivoId);
          if (disp?.votoConcluido) {
            ctx.naCabine = null;
            this.tocar();
            throw new JaVotouError(
              usuarioId,
              "Este dispositivo já concluiu um voto e não pode votar mais de uma vez",
            );
          }
        }
      }

      const listaCandidatos = await this.candidatos.listar(ctx.ehMock);
      const candidato = listaCandidatos.find((c) => c.id === candidatoId);
      if (!candidato) throw new NaoEncontradoError("Candidato", candidatoId);

      return this.registrarVotoNoContexto(
        ctx,
        eleitor,
        candidato.id,
        candidato.nome,
        inicio,
        dispositivoRequisicao,
        tempoRequisicaoMs,
      );
    });
  }

  /**
   * Ativa o modo Mock e opcionalmente popula as filas de demonstração.
   * Não altera absolutamente nada na fila real (`this.real`).
   */
  public popularMock(qtdOuOpcoes: number | OpcoesPopularMock = env.MOCK_QTD): Promise<UsuarioJSON[]> {
    const opcoes: OpcoesPopularMock =
      typeof qtdOuOpcoes === "number" ? { qtd: qtdOuOpcoes } : qtdOuOpcoes;

    return this.exclusivo(async () => {
      this._modoMock = true;

      if (opcoes.limparAntes) {
        this.cancelarTimerMock();
        await this.repo.limparPorMock(true);
        await this.votos.limparPorMock(true);
        await this.auditoria.limparPorMock(true);
        this.mock.resetarMemoria();
      }

      const inseridos: Usuario[] = [];
      for (const [nome, tipo] of gerarMocks(opcoes)) {
        inseridos.push(
          await this.inserirNoContexto(this.mock, nome, tipo, criarDispositivoMock()),
        );
      }

      this.tocar();
      await this.chamarSeAutomatico(this.mock);
      return inseridos.map((u) => u.toJSON());
    });
  }

  /**
   * Desabilita o modo Mock, limpa todos os usuários/votos/timers de demonstração
   * e retorna imediatamente ao estado intacto da fila real (`this.real`).
   */
  public desativarMock(): Promise<{
    modoMock: boolean;
    mensagem: string;
    filaReal: FilaEstado;
  }> {
    return this.exclusivo(async () => {
      this.cancelarTimerMock();
      this._modoMock = false;
      this.mock.resetarMemoria();
      await this.repo.limparPorMock(true);
      await this.votos.limparPorMock(true);
      await this.auditoria.limparPorMock(true);

      this.tocar();
      this.emit("voto", null);

      return {
        modoMock: false,
        mensagem:
          "Modo mock desabilitado com sucesso. As filas reais e os votos oficiais permaneceram intactos.",
        filaReal: this.estadoDoContexto(this.real),
      };
    });
  }

  public statusMock() {
    return {
      modoMock: this._modoMock,
      mock: {
        preferencial: this.mock.filaPreferencial.tamanho,
        comum: this.mock.filaComum.tamanho,
        naCabine: this.mock.naCabine?.toJSON() ?? null,
        proporcao: this.mock.gerenciador.resumoProporcao(),
      },
      real: {
        preferencial: this.real.filaPreferencial.tamanho,
        comum: this.real.filaComum.tamanho,
        naCabine: this.real.naCabine?.toJSON() ?? null,
        proporcao: this.real.gerenciador.resumoProporcao(),
      },
    };
  }

  private resolverContextoLeituraDemo(escopo?: string): ContextoFila {
    if (escopo === "real") return this.real;
    if (escopo === "mock") return this.mock;
    return this._modoMock ? this.mock : this.mock;
  }

  private garantirApenasMockNaMutacaoDemo(escopo?: string): void {
    if (escopo === "real") {
      throw new ProibidoError(
        "Operações de demonstração da estrutura de dados só podem alterar a fila Mock, preservando a fila real",
      );
    }
    this._modoMock = true;
  }

  /** 1. Critério: Inserir elementos (comportamento FIFO — `fila.enfileirar`) */
  public demoEnfileirar(
    tipoFila: TipoFila,
    opcoes?: { nome?: string; idUsuario?: number; escopo?: string },
  ): Promise<{
    metodoExecutado: "enfileirar";
    modoMock: boolean;
    tipoFila: TipoFila;
    usuario: UsuarioJSON;
    posicaoNaSubfila: number;
    tamanhoAtual: number;
    proporcao: ResumoProporcaoFila;
  }> {
    return this.exclusivo(async () => {
      this.garantirApenasMockNaMutacaoDemo(opcoes?.escopo);
      const fila = this.mock.filaFactory.filaPorTipo(tipoFila);

      if (opcoes?.idUsuario !== undefined) {
        const alvo = this.alvo(opcoes.idUsuario);
        if (fila.posicaoDe(alvo) >= 0) {
          throw new RequisicaoInvalidaError(
            `O usuário ${opcoes.idUsuario} já está enfileirado na fila ${tipoFila}`,
          );
        }
      }

      const nome =
        opcoes?.nome && opcoes.nome.trim().length > 0
          ? opcoes.nome.trim()
          : opcoes?.idUsuario !== undefined
            ? `Eleitor Mock #${opcoes.idUsuario}`
            : nomeAleatorio();

      const usuario = await this.inserirNoContexto(
        this.mock,
        nome,
        tipoFila,
        criarDispositivoMock(),
      );
      this.tocar();

      return {
        metodoExecutado: "enfileirar",
        modoMock: this._modoMock,
        tipoFila,
        usuario: usuario.toJSON(),
        posicaoNaSubfila: fila.posicaoDe(usuario) + 1,
        tamanhoAtual: fila.tamanho,
        proporcao: this.mock.gerenciador.resumoProporcao(),
      };
    });
  }

  /** 2. Critério: Remover elementos (comportamento FIFO — `fila.desenfileirar`) */
  public demoDesenfileirar(
    tipoFila: TipoFila,
    escopo?: string,
  ): Promise<{
    metodoExecutado: "desenfileirar";
    modoMock: boolean;
    tipoFila: TipoFila;
    removido: UsuarioJSON;
    tamanhoAtual: number;
    proporcao: ResumoProporcaoFila;
  }> {
    return this.exclusivo(async () => {
      this.garantirApenasMockNaMutacaoDemo(escopo);
      const fila = this.mock.filaFactory.filaPorTipo(tipoFila);

      const removido = fila.desenfileirar();
      if (!removido) {
        throw new NaoEncontradoError("Elemento na fila", tipoFila);
      }

      if (removido.id !== undefined) {
        await this.repo.remover(removido.id);
        await this.repo.decrementarPosicoes(tipoFila, removido.posicaoNaFila, true);
      }
      const restantes = listarElementosFifo(fila);
      for (let i = 0; i < restantes.length; i++) {
        restantes[i].posicaoNaFila = i + 1;
      }

      this.tocar();
      return {
        metodoExecutado: "desenfileirar",
        modoMock: this._modoMock,
        tipoFila,
        removido: removido.toJSON(),
        tamanhoAtual: fila.tamanho,
        proporcao: this.mock.gerenciador.resumoProporcao(),
      };
    });
  }

  /** 3. Critério: Acessar o primeiro elemento da estrutura (`fila.primeiro`) */
  public demoPrimeiro(tipoFila: TipoFila, escopo?: string) {
    const ctx = this.resolverContextoLeituraDemo(escopo);
    const fila = ctx.filaFactory.filaPorTipo(tipoFila);
    const primeiro = fila.primeiro();
    return {
      metodoExecutado: "primeiro" as const,
      escopo: ctx.ehMock ? "mock" : "real",
      tipoFila,
      vazia: fila.estaVazia(),
      primeiro: primeiro?.toJSON() ?? null,
    };
  }

  /** 4. Critério: Verificar se a estrutura está vazia (`fila.estaVazia`) */
  public demoEstaVazia(tipoFila: TipoFila, escopo?: string) {
    const ctx = this.resolverContextoLeituraDemo(escopo);
    const fila = ctx.filaFactory.filaPorTipo(tipoFila);
    return {
      metodoExecutado: "estaVazia" as const,
      escopo: ctx.ehMock ? "mock" : "real",
      tipoFila,
      vazia: fila.estaVazia(),
      tamanho: fila.tamanho,
    };
  }

  /** 5. Critério: Verificar a posição de um elemento na estrutura (`fila.posicaoDe`) */
  public demoPosicaoDe(tipoFila: TipoFila, idUsuario: number, escopo?: string) {
    const ctx = this.resolverContextoLeituraDemo(escopo);
    const fila = ctx.filaFactory.filaPorTipo(tipoFila);
    const indice = fila.posicaoDe(this.alvo(idUsuario));
    if (indice < 0) {
      throw new NaoEncontradoError("Usuário na fila", idUsuario);
    }
    return {
      metodoExecutado: "posicaoDe" as const,
      escopo: ctx.ehMock ? "mock" : "real",
      idUsuario,
      tipoFila,
      posicaoFila: indice + 1,
    };
  }

  /** 6. Critério: Limpar os elementos da estrutura (`fila.limpar`) */
  public demoLimpar(
    tipoFila: TipoFila,
    escopo?: string,
  ): Promise<{
    metodoExecutado: "limpar";
    modoMock: boolean;
    tipoFila: TipoFila;
    vazia: boolean;
    tamanhoAtual: number;
    exibicao: string;
    proporcao: ResumoProporcaoFila;
  }> {
    return this.exclusivo(async () => {
      this.garantirApenasMockNaMutacaoDemo(escopo);
      const fila = this.mock.filaFactory.filaPorTipo(tipoFila);
      const atuais = listarElementosFifo(fila);

      fila.limpar();
      fila.qtdVotosAnteriores = 0;

      for (const u of atuais) {
        if (u.id !== undefined) await this.repo.remover(u.id);
      }

      this.tocar();
      return {
        metodoExecutado: "limpar",
        modoMock: this._modoMock,
        tipoFila,
        vazia: fila.estaVazia(),
        tamanhoAtual: fila.tamanho,
        exibicao: fila.exibir(),
        proporcao: this.mock.gerenciador.resumoProporcao(),
      };
    });
  }

  /** 7. Critério: Inverter a ordem dos elementos da estrutura (`fila.inverter`) */
  public demoInverter(
    tipoFila: TipoFila,
    escopo?: string,
  ): Promise<{
    metodoExecutado: "inverter";
    modoMock: boolean;
    tipoFila: TipoFila;
    tamanhoAtual: number;
    exibicao: string;
    elementos: UsuarioJSON[];
  }> {
    return this.exclusivo(async () => {
      this.garantirApenasMockNaMutacaoDemo(escopo);
      const fila = this.mock.filaFactory.filaPorTipo(tipoFila);

      fila.inverter();

      const invertidos = listarElementosFifo(fila);
      for (let i = 0; i < invertidos.length; i++) {
        invertidos[i].posicaoNaFila = i + 1;
      }
      await this.repo.sincronizarPosicoes(invertidos);

      this.tocar();
      return {
        metodoExecutado: "inverter",
        modoMock: this._modoMock,
        tipoFila,
        tamanhoAtual: fila.tamanho,
        exibicao: fila.exibir(),
        elementos: invertidos.map((u) => u.toJSON()),
      };
    });
  }

  /** 8. Critério: Exibir os elementos presentes na estrutura (`fila.exibir`) */
  public demoExibir(tipoFila: TipoFila, escopo?: string) {
    const ctx = this.resolverContextoLeituraDemo(escopo);
    const fila = ctx.filaFactory.filaPorTipo(tipoFila);
    const elementos = listarElementosFifo(fila).map((u) => u.toJSON());
    return {
      metodoExecutado: "exibir" as const,
      escopo: ctx.ehMock ? "mock" : "real",
      modoMock: this._modoMock,
      tipoFila,
      vazia: fila.estaVazia(),
      tamanho: fila.tamanho,
      exibicao: fila.exibir(),
      elementos,
      proporcao: ctx.gerenciador.resumoProporcao(),
    };
  }

  /** Resumo dinâmico da proporção atual (funciona para `real` e para `mock`). */
  public consultarProporcao(escopo?: string) {
    const ctx =
      escopo === "real"
        ? this.real
        : escopo === "mock"
          ? this.mock
          : this.contextoAtivo;
    return {
      escopo: ctx.ehMock ? "mock" : "real",
      modoMockAtivo: this._modoMock,
      proporcao: ctx.gerenciador.resumoProporcao(),
      proximoAVotar: ctx.gerenciador.proximoAVotar()?.toJSON() ?? null,
      ordemPrevistaChamada: ctx.gerenciador.ordemDeChamada().map((u, idx) => ({
        posicaoGlobal: idx + 1 + (ctx.naCabine ? 1 : 0),
        id: u.id,
        nome: u.nome,
        tipoFila: u.tipoFila,
        posicaoNaSubfila: u.posicaoNaFila,
      })),
    };
  }

  // =========================================================================
  // CONTROLES GERAIS DO PAINEL / WEBSOCKET (operam sobre o contexto ativo)
  // =========================================================================

  public proximoAVotar(): Promise<Usuario> {
    return this.exclusivo(async () => {
      const ctx = this.contextoAtivo;
      if (ctx.naCabine) {
        throw new FilaError(`A cabine está ocupada por ${ctx.naCabine.nome}`);
      }
      const proximo = await this.chamarSeLivre(ctx);
      if (!proximo) throw new FilaError("Não há ninguém aguardando");
      return proximo;
    });
  }

  public liberarCabine(): Promise<void> {
    return this.exclusivo(async () => {
      const ctx = this.contextoAtivo;
      if (!ctx.naCabine) throw new FilaError("A cabine já está livre");
      if (ctx.ehMock) this.cancelarTimerMock();
      ctx.naCabine = null;
      this.tocar();
      await this.chamarSeAutomatico(ctx);
    });
  }

  /**
   * Remove alguém da fila (desistência pelo próprio eleitor com `chave`, ou remoção pelo admin).
   */
  public remover(id: unknown, chave?: unknown, tempoRequisicaoMs?: number): Promise<UsuarioJSON> {
    if (typeof id !== "number" || !Number.isInteger(id)) {
      throw new FilaError("Id inválido");
    }
    return this.exclusivo(async () => {
      const contextos = chave !== undefined ? [this.real, this.mock] : [this.contextoAtivo];
      for (const ctx of contextos) {
        for (const fila of ctx.filas) {
          const indice = fila.posicaoDe(this.alvo(id));
          if (indice === -1) continue;

          const snapshot = listarElementosFifo(fila);
          const alvoUsuario = snapshot[indice]!;
          if (chave !== undefined && !chaveConfere(alvoUsuario.chave, chave)) {
            throw new FilaError("Ticket inválido");
          }

          await this.retirarPorIdFifo(ctx, fila, id);
          await this.registrarLog({
            operacao: "SAIDA_FILA",
            usuarioId: alvoUsuario.id ?? null,
            eleitorNome: alvoUsuario.nome,
            tipoFila: alvoUsuario.tipoFila,
            entrouNaFilaEm: alvoUsuario.entrouEm,
            tempoRequisicaoMs,
            mock: ctx.ehMock,
            detalhes:
              chave !== undefined ? "Desistência pelo eleitor" : "Removido pelo administrador",
          });
          this.tocar();
          return alvoUsuario.toJSON();
        }
      }
      throw new FilaError("Essa pessoa não está mais na fila");
    });
  }

  /**
   * Reinicia o contexto atual:
   * - Se estiver em modo Mock, reinicia apenas o Mock (preservando a eleição real!);
   * - Se `escopo === "real"`, reinicia a eleição oficial (limpa fila real, votos reais e dispositivos).
   */
  public reiniciar(qtd = env.MOCK_QTD, escopo?: "mock" | "real"): Promise<FilaEstado> {
    return this.exclusivo(async () => {
      const reiniciarReal = escopo === "real";
      if (reiniciarReal) {
        this._modoMock = false;
        this.real.resetarMemoria();
        await this.repo.limparPorMock(false);
        await this.votos.limparPorMock(false);
        await this.auditoria.limparPorMock(false);
        await this.requisicoes.limpar();
        await this.dispositivos.limpar();
        this.tocar();
        this.emit("voto", null);
        return this.estado();
      }

      this.cancelarTimerMock();
      this._modoMock = true;
      this.mock.resetarMemoria();
      await this.repo.limparPorMock(true);
      await this.votos.limparPorMock(true);
      await this.auditoria.limparPorMock(true);

      for (const [nome, tipo] of gerarMocks({ qtd })) {
        await this.inserirNoContexto(this.mock, nome, tipo, criarDispositivoMock());
      }
      this.tocar();
      this.emit("voto", null);
      return this.estado();
    });
  }

  public resultado(): Promise<ContagemCandidato[]> {
    return this.votos.contagem(this._modoMock);
  }

  public resultadoOficial(): Promise<ContagemCandidato[]> {
    return this.votos.contagem(false);
  }

  public async relatorio(escopo?: "real" | "mock"): Promise<VotoJSON[]> {
    const usarMock = escopo === "mock" ? true : escopo === "real" ? false : this._modoMock;
    return this.votos.listar(usarMock).then((v) => v.map((x) => x.toJSON()));
  }

  /**
   * Relatório completo de Logs e Métricas Acadêmicas:
   * 1. Quantidade de votos absoluta de cada um dos candidatos (`qtdVotosAbsolutaPorCandidato`);
   * 2. Em quem o usuário votou, horário e tempo que levou para votar (`votosDetalhados`);
   * 3. Tempo de espera em cada requisição HTTP (`requisicoes`);
   * 4. Quanto tempo levou desde que entrou na fila até chegar na cabine (`tempoNaFilaAteCabineMs`).
   */
  async listarLogsAuditoria(limite = 200, escopo?: "real" | "mock") {
    const usarMock = escopo === "mock";
    const [contagem, listaVotos, eventos, listaReq, resumoReq] = await Promise.all([
      this.votos.contagem(usarMock),
      this.votos.listar(usarMock, limite),
      this.auditoria.listar(limite, usarMock),
      this.requisicoes.listar(limite),
      this.requisicoes.resumo(),
    ]);

    return {
      escopo: usarMock ? ("mock" as const) : ("real" as const),
      geradoEm: new Date().toISOString(),
      qtdVotosAbsolutaPorCandidato: contagem.map((c) => ({
        idCandidato: c.candidatoId,
        nome: c.nome,
        partido: c.partido,
        urlFoto: c.urlFoto,
        qtdVotosAbsoluta: c.votos,
      })),
      votosDetalhados: listaVotos.map((v) => {
        const json = v.toJSON();
        return {
          id: json.id,
          usuarioId: json.usuarioId,
          usuarioNome: json.usuarioNome,
          senha: json.senha,
          tipoFila: json.tipoFila,
          quemVotou: {
            idCandidato: json.candidatoId,
            nomeCandidato: json.candidatoNome ?? null,
          },
          horarioVoto: json.votouEm,
          entrouNaFilaEm: json.entrouNaFilaEm,
          chegouNaCabineEm: json.chamadoEm,
          tempoNaFilaAteCabineMs: json.tempoNaFilaMs,
          tempoNaFilaAteCabineFormatado: json.tempoNaFilaFormatado,
          tempoParaVotarMs: json.tempoParaVotarMs,
          tempoParaVotarFormatado: json.tempoParaVotarFormatado,
          tempoEsperaRequisicaoMs: json.tempoRequisicaoMs,
          tempoEsperaRequisicaoFormatado: json.tempoRequisicaoFormatado,
          dispositivo: {
            dispositivoId: json.dispositivoId,
            ip: json.ip,
            mac: json.mac,
            nomeDispositivo: json.nomeDispositivo,
            fingerprint: json.fingerprint,
          },
        };
      }),
      requisicoes: {
        ...resumoReq,
        itens: listaReq.map((r) => r.toJSON()),
      },
      eventosAuditoria: eventos.map((l) => l.toJSON()),
    };
  }

  public estado(): FilaEstado {
    return this.estadoDoContexto(this.contextoAtivo);
  }

  public estadoReal(): FilaEstado {
    return this.estadoDoContexto(this.real);
  }

  public posicoes(): { podeVotar: UsuarioJSON | null; fila: PosicaoAtual[] } {
    const estado = this.estado();
    const linha = (u: UsuarioNaFila): PosicaoAtual => ({
      id: u.id!,
      nome: u.nome,
      senha: u.senha,
      tipoFila: u.tipoFila,
      posicaoNaFila: u.posicaoNaFila,
      posicaoGlobal: u.posicaoGlobal,
      aFrente: u.aFrente,
      podeVotar: false,
    });
    const fila = [...estado.preferencial, ...estado.comum]
      .sort((a, b) => a.aFrente - b.aFrente)
      .map(linha);
    if (estado.naCabine) {
      fila.unshift({
        ...linha({ ...estado.naCabine, aFrente: 0, posicaoGlobal: 1 }),
        posicaoNaFila: 1,
        posicaoGlobal: 1,
        podeVotar: true,
      });
    }
    return { podeVotar: estado.naCabine, fila };
  }

  private estadoDoContexto(ctx: ContextoFila): FilaEstado {
    const ocupada = ctx.naCabine ? 1 : 0;
    const ordem = new Map(ctx.gerenciador.ordemDeChamada().map((u, i) => [u.id, i]));
    const comAFrente = (fila: Fila<Usuario>): UsuarioNaFila[] =>
      listarElementosFifo(fila).map((u) => {
        const aFrente = ocupada + (ordem.get(u.id) ?? 0);
        return {
          ...u.toJSON(),
          aFrente,
          posicaoGlobal: aFrente + 1,
        };
      });

    return {
      modoMock: ctx.ehMock,
      proporcao: ctx.gerenciador.resumoProporcao(),
      preferencial: comAFrente(ctx.filaPreferencial),
      comum: comAFrente(ctx.filaComum),
      naCabine: ctx.naCabine?.toJSON() ?? null,
      ultimosChamados: ctx.ultimosChamados.map((u) => u.toJSON()),
      atualizadoEm: this.atualizadoEm.toISOString(),
    };
  }

  private buscarNoContexto(ctx: ContextoFila, id: number): UsuarioNaFila | null {
    const est = this.estadoDoContexto(ctx);
    if (est.naCabine?.id === id) {
      return { ...est.naCabine, aFrente: 0, posicaoGlobal: 1 };
    }
    return [...est.preferencial, ...est.comum].find((u) => u.id === id) ?? null;
  }

  private encontrarInstanciaNoContexto(ctx: ContextoFila, id: number): Usuario | null {
    if (ctx.naCabine?.id === id) return ctx.naCabine;
    for (const fila of ctx.filas) {
      const encontrado = listarElementosFifo(fila).find((u) => u.id === id);
      if (encontrado) return encontrado;
    }
    return null;
  }

  private async removerUsuarioRealBloqueado(id: number): Promise<void> {
    if (this.real.naCabine?.id === id) {
      this.real.naCabine = null;
      return;
    }
    for (const fila of this.real.filas) {
      if (fila.posicaoDe(this.alvo(id)) >= 0) {
        await this.retirarPorIdFifo(this.real, fila, id);
        return;
      }
    }
  }

  private async inserirNoContexto(
    ctx: ContextoFila,
    nome: string,
    tipoFila: TipoFila,
    dispositivo?: DispositivoIdentificado,
  ): Promise<Usuario> {
    const fila = ctx.filaFactory.filaPorTipo(tipoFila);
    const usuario = new Usuario(
      nome,
      ctx.proximaSenha[tipoFila],
      fila.tamanho + 1,
      tipoFila,
      new Date(),
      randomBytes(16).toString("hex"),
      ctx.ehMock,
      undefined,
      dispositivo,
    );
    await this.repo.inserir(usuario);

    // Se o banco foi resetado externamente (AUTO_INCREMENT voltou para 1) enquanto o servidor estava rodando,
    // limpa qualquer estado residual em memória (ex.: eleitor antigo preso em naCabine) antes de enfileirar.
    if (!ctx.ehMock && usuario.id === 1 && (ctx.naCabine !== null || ctx.totalAguardando > 0)) {
      ctx.resetarMemoria();
      usuario.senha = 1;
      usuario.posicaoNaFila = 1;
    }

    ctx.proximaSenha[tipoFila] = Math.max(ctx.proximaSenha[tipoFila], usuario.senha) + 1;
    fila.enfileirar(usuario);
    return usuario;
  }

  /**
   * Remove a frente da fila usando estritamente `fila.desenfileirar()` (FIFO)
   * e atualiza as posições de quem permanece aguardando.
   */
  private async desenfileirarFrente(ctx: ContextoFila, fila: Fila<Usuario>): Promise<Usuario> {
    const usuario = fila.desenfileirar()!;
    await this.repo.remover(usuario.id!);
    await this.repo.decrementarPosicoes(usuario.tipoFila, usuario.posicaoNaFila, ctx.ehMock);

    const restantes = listarElementosFifo(fila);
    for (let i = 0; i < restantes.length; i++) {
      restantes[i].posicaoNaFila = i + 1;
    }
    return usuario;
  }

  /**
   * Remove um usuário específico rotacionando a Fila exclusivamente com
   * `desenfileirar()` e `enfileirar()` (100% compatível com o TAD Fila).
   */
  private async retirarPorIdFifo(
    ctx: ContextoFila,
    fila: Fila<Usuario>,
    id: number,
  ): Promise<Usuario | null> {
    const total = fila.tamanho;
    let removido: Usuario | null = null;
    let novaPosicao = 1;

    for (let i = 0; i < total; i++) {
      const atual = fila.desenfileirar()!;
      if (atual.id === id && !removido) {
        removido = atual;
      } else {
        atual.posicaoNaFila = novaPosicao++;
        fila.enfileirar(atual);
      }
    }

    if (removido?.id !== undefined) {
      await this.repo.remover(removido.id);
      await this.repo.decrementarPosicoes(removido.tipoFila, removido.posicaoNaFila, ctx.ehMock);
    }
    return removido;
  }

  private async chamarSeAutomatico(ctx: ContextoFila): Promise<Usuario | null> {
    if (env.CHAMADA_AUTOMATICA) {
      return this.chamarSeLivre(ctx);
    }
    await this.sincronizarPrimeiroDaVez(ctx);
    return null;
  }

  /**
   * Quando a chamada é manual (`CHAMADA_AUTOMATICA=false`) e a cabine está livre,
   * registra `chamadoEm` no eleitor que ocupa a 1ª posição global (`proximoAVotar`)
   * para medir com precisão quanto tempo levou até chegar à vez/cabine e quanto
   * tempo levou para confirmar o voto em `POST /api/v1/voto`.
   */
  private async sincronizarPrimeiroDaVez(ctx: ContextoFila): Promise<void> {
    if (ctx.naCabine) return;
    const primeiro = ctx.gerenciador.proximoAVotar();
    for (const fila of ctx.filas) {
      for (const u of listarElementosFifo(fila)) {
        if (primeiro && u.id === primeiro.id) {
          if (!u.chamadoEm) {
            u.chamadoEm = new Date();
            if (u.id !== undefined) await this.repo.atualizarChamadoEm(u.id, u.chamadoEm);
          }
        } else if (u.chamadoEm !== null) {
          u.chamadoEm = null;
          if (u.id !== undefined) await this.repo.atualizarChamadoEm(u.id, null);
        }
      }
    }
  }

  private async chamarSeLivre(ctx: ContextoFila): Promise<Usuario | null> {
    if (ctx.naCabine) return null;
    const escolhido = ctx.gerenciador.proximoAVotar();
    if (!escolhido) return null;

    const proximo = await this.desenfileirarFrente(ctx, ctx.filaFactory.filaDe(escolhido));
    ctx.gerenciador.registrarChamada(proximo);
    const chamadoEm = proximo.chamadoEm ?? new Date();
    proximo.chamadoEm = chamadoEm;
    proximo.posicaoNaFila = 1; // 1 = primeiro/na cabine
    ctx.naCabine = proximo;
    ctx.ultimosChamados = [proximo, ...ctx.ultimosChamados].slice(0, MAX_ULTIMOS_CHAMADOS);

    const tempoNaFilaMs = Math.max(0, chamadoEm.getTime() - proximo.entrouEm.getTime());
    await this.registrarLog({
      operacao: "CHAMADA_CABINE",
      usuarioId: proximo.id ?? null,
      eleitorNome: proximo.nome,
      tipoFila: proximo.tipoFila,
      dispositivo: {
        dispositivoId: proximo.dispositivoId ?? "",
        tokenUuid: null,
        ip: proximo.ip ?? "0.0.0.0",
        mac: proximo.mac,
        nomeDispositivo: proximo.nomeDispositivo ?? "Dispositivo Web",
        userAgent: null,
        fingerprint: proximo.fingerprint ?? "",
      },
      entrouNaFilaEm: proximo.entrouEm,
      chamadoEm,
      tempoNaFilaMs,
      mock: ctx.ehMock,
      detalhes: `Chamado para a cabine segundo proporção (${ctx.gerenciador.resumoProporcao().razaoAtendimento}) após aguardar ${tempoNaFilaMs}ms na fila`,
    });

    if (ctx === this.contextoAtivo) {
      this.tocar();
      this.emit("proximo", proximo.toJSON());
    }

    if (ctx.ehMock && proximo.mock) {
      this.agendarVotoMock(proximo);
    }
    return proximo;
  }

  private async registrarVotoNoContexto(
    ctx: ContextoFila,
    eleitor: Usuario,
    candidatoId: number,
    candidatoNome: string,
    inicio: number,
    dispositivoRequisicao?: DispositivoIdentificado,
    tempoRequisicaoMs?: number,
  ): Promise<ResultadoVoto> {
    const votouEm = new Date();
    const chamadoEm = eleitor.chamadoEm ?? votouEm;
    const ipFinal = eleitor.ip ?? dispositivoRequisicao?.ip ?? null;
    const macFinal = eleitor.mac ?? dispositivoRequisicao?.mac ?? null;
    const nomeDispFinal = eleitor.nomeDispositivo ?? dispositivoRequisicao?.nomeDispositivo ?? null;
    const fpFinal = eleitor.fingerprint ?? dispositivoRequisicao?.fingerprint ?? null;
    const dispIdFinal = eleitor.dispositivoId ?? dispositivoRequisicao?.dispositivoId ?? null;
    const tempoReqFinal =
      tempoRequisicaoMs ?? Math.round((performance.now() - inicio) * 100) / 100;

    const voto = new Voto(
      eleitor.nome,
      eleitor.senha,
      eleitor.tipoFila,
      candidatoId,
      eleitor.entrouEm,
      chamadoEm,
      votouEm,
      undefined,
      candidatoNome,
      eleitor.id ?? null,
      ipFinal,
      macFinal,
      nomeDispFinal,
      fpFinal,
      dispIdFinal,
      ctx.ehMock,
      tempoReqFinal,
    );
    await this.votos.inserir(voto);

    if (!ctx.ehMock && dispIdFinal && eleitor.id !== undefined) {
      await this.dispositivos.marcarVotoConcluido(
        dispIdFinal,
        eleitor.id,
        votouEm,
        dispositivoRequisicao?.tokenUuid,
      );
    }

    await this.registrarLog({
      operacao: "VOTO_COMPUTADO",
      usuarioId: eleitor.id ?? null,
      eleitorNome: eleitor.nome,
      tipoFila: eleitor.tipoFila,
      dispositivo: {
        dispositivoId: dispIdFinal ?? "",
        tokenUuid: dispositivoRequisicao?.tokenUuid ?? null,
        ip: ipFinal ?? "0.0.0.0",
        mac: macFinal,
        nomeDispositivo: nomeDispFinal ?? "Dispositivo Web",
        userAgent: dispositivoRequisicao?.userAgent ?? null,
        fingerprint: fpFinal ?? "",
      },
      candidatoId,
      candidatoNome,
      entrouNaFilaEm: eleitor.entrouEm,
      chamadoEm,
      votouEm,
      tempoNaFilaMs: voto.tempoNaFilaMs,
      tempoParaVotarMs: voto.tempoParaVotarMs,
      tempoRequisicaoMs: tempoReqFinal,
      mock: ctx.ehMock,
      detalhes: ctx.ehMock
        ? `Voto de demonstração computado em "${candidatoNome}" (tempoNaFila=${voto.tempoNaFilaMs}ms, tempoParaVotar=${voto.tempoParaVotarMs}ms)`
        : `Voto oficial computado em "${candidatoNome}" (tempoNaFila=${voto.tempoNaFilaMs}ms, tempoParaVotar=${voto.tempoParaVotarMs}ms) e dispositivo bloqueado para novos votos.`,
    });

    if (ctx.ehMock) this.cancelarTimerMock();
    ctx.naCabine = null;

    if (ctx === this.contextoAtivo) {
      this.tocar();
      this.emit("voto", voto.toJSON());
    }
    await this.chamarSeAutomatico(ctx);

    const resultado = await this.votos.contagem(ctx.ehMock);
    return {
      voto: voto.toJSON(),
      resultado,
      tempoProcessamentoMs: Math.round((performance.now() - inicio) * 100) / 100,
    };
  }

  private agendarVotoMock(usuario: Usuario): void {
    this.cancelarTimerMock();
    const espera = env.MOCK_VOTO_MS * (0.6 + Math.random() * 0.8);
    this.votoMock = setTimeout(() => {
      this.votoMock = null;
      if (!this._modoMock || this.mock.naCabine?.id !== usuario.id) return;
      // 10% Anular (id 1), 45% Candidato 2, 45% Candidato 3
      const sorteio = Math.random();
      const candidatoId = sorteio < 0.1 ? 1 : sorteio < 0.55 ? 2 : 3;
      this.votar(usuario.id, usuario.chave, candidatoId).catch((err) => {
        if (!(err instanceof AppError)) console.error("Falha no voto do mock:", err);
      });
    }, espera);
  }

  private cancelarTimerMock(): void {
    if (this.votoMock) clearTimeout(this.votoMock);
    this.votoMock = null;
  }

  private async registrarLog(dados: {
    operacao: OperacaoAuditoria;
    usuarioId: number | null;
    eleitorNome: string | null;
    tipoFila: TipoFila | null;
    dispositivo?: DispositivoIdentificado;
    candidatoId?: number | null;
    candidatoNome?: string | null;
    detalhes?: string | null;
    entrouNaFilaEm?: Date | null;
    chamadoEm?: Date | null;
    votouEm?: Date | null;
    tempoNaFilaMs?: number | null;
    tempoParaVotarMs?: number | null;
    tempoRequisicaoMs?: number | null;
    mock?: boolean;
  }): Promise<void> {
    const log = new LogAuditoria(
      dados.operacao,
      new Date(),
      dados.usuarioId,
      dados.eleitorNome,
      dados.tipoFila,
      dados.dispositivo?.ip ?? null,
      dados.dispositivo?.mac ?? null,
      dados.dispositivo?.nomeDispositivo ?? null,
      dados.dispositivo?.fingerprint ?? null,
      dados.dispositivo?.dispositivoId || null,
      dados.candidatoId ?? null,
      dados.candidatoNome ?? null,
      dados.detalhes ?? null,
      dados.entrouNaFilaEm ?? null,
      dados.chamadoEm ?? null,
      dados.votouEm ?? null,
      dados.tempoNaFilaMs ?? null,
      dados.tempoParaVotarMs ?? null,
      dados.tempoRequisicaoMs ?? null,
      dados.mock ?? false,
    );
    await this.auditoria.registrar(log);
  }

  private alvo(id: number): Usuario {
    return new Usuario("", 0, 0, TipoFila.Comum, new Date(), "", false, id);
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
