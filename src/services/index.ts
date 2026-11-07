import { UsuarioRepository } from "../repository/UsuarioRepository";
import { CandidatoRepository } from "../repository/CandidatoRepository";
import { UsuarioServices } from "./UsuarioServices";
import { CandidatoServices } from "./CandidatoServices";
import { FilaPreferencial } from "../domain/fila/FilaPreferencial";
import { FilaComum } from "../domain/fila/FilaComum";
import { FilaFactory } from "../domain/fila/FilaFactory";
import { GerenciadorFilas } from "../domain/fila/GerenciadorFilas";

const filaPreferencial = new FilaPreferencial();
const filaComum = new FilaComum();
const filaFactory = new FilaFactory(filaPreferencial, filaComum);
const gerenciadorFilas = new GerenciadorFilas(filaFactory);

export const usuarioServices = new UsuarioServices(new UsuarioRepository(), filaFactory, gerenciadorFilas);
export const candidatoServices = new CandidatoServices(new CandidatoRepository());
