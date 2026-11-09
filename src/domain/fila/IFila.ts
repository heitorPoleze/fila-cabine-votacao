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
export interface IFila<T extends IComparable> {
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