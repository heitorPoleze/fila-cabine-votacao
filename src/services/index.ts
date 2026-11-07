import { DoublyLinkedList } from "../domain/fila/DoublyLinkedList";
import type { Usuario } from "../domain/usuario/Usuario";
import { UsuarioRepository } from "../repository/UsuarioRepository";
import { CandidatoRepository } from "../repository/CandidatoRepository";
import { UsuarioServices } from "./UsuarioServices";
import { CandidatoServices } from "./CandidatoServices";

const fila = new DoublyLinkedList<Usuario>();

export const usuarioServices = new UsuarioServices(new UsuarioRepository(), fila);
export const candidatoServices = new CandidatoServices(new CandidatoRepository());
