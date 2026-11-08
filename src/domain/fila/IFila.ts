import type { IComparable } from "./IComparable";

/**
 * Contrato estrito do TAD Fila (FIFO — First In, First Out), contemplando
 * exclusivamente as 8 funcionalidades exigidas nos critérios da disciplina:
 *  1. Inserir elemento (FIFO)          → enfileirar
 *  2. Remover elemento (FIFO)          → desenfileirar
 *  3. Acessar frente da fila           → primeiro
 *  4. Verificar se está vazia          → estaVazia
 *  5. Verificar posição de elemento    → posicaoDe
 *  6. Limpar estrutura                 → limpar
 *  7. Inverter ordem dos elementos     → inverter
 *  8. Exibir elementos presentes       → exibir
 */
export interface IFila<T extends IComparable> extends BarreiraMetodosNaoFila {
  enfileirar(elemento: T): void;
  desenfileirar(): T | undefined;
  primeiro(): T | undefined;
  estaVazia(): boolean;
  posicaoDe(elemento: T): number;
  limpar(): void;
  inverter(): void;
  exibir(): string;
  readonly tamanho: number;
}

/**
 * Barreira em tempo de compilação: impede que Fila ou qualquer subclasse
 * (FilaComum, FilaPreferencial, etc.) implemente ou exponha métodos de Lista
 * ou Pilha (acesso aleatório, inserção/remoção arbitrária, ordenação, LIFO).
 */
export interface BarreiraMetodosNaoFila {
  readonly push?: never;
  readonly pop?: never;
  readonly shift?: never;
  readonly unshift?: never;
  readonly insert?: never;
  readonly removeAt?: never;
  readonly remove?: never;
  readonly getElementAt?: never;
  readonly findIndex?: never;
  readonly sort?: never;
  readonly clear?: never;
  readonly reverse?: never;
  readonly elementoEm?: never;
  readonly inserirEm?: never;
  readonly removerEm?: never;
  readonly ordenar?: never;
  readonly empilhar?: never;
  readonly desempilhar?: never;
  readonly topo?: never;
}

/** Lista de membros permitidos nos protótipos da hierarquia de Fila em tempo de execução. */
export const MEMBROS_PERMITIDOS_FILA = new Set<string>([
  "constructor",
  "enfileirar",
  "desenfileirar",
  "primeiro",
  "tamanho",
  "estaVazia",
  "posicaoDe",
  "limpar",
  "inverter",
  "exibir",
  "qtdVotosAnteriores",
]);
