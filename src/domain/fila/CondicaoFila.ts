/** Tamanho atual da fila preferencial em relação ao tamanho atual da fila comum. */
export enum CondicaoFila {
  /** preferencial ≤ 25% da comum */
  PreferencialAte25 = "PREFERENCIAL_ATE_25",
  /** 25% < preferencial ≤ 50% da comum */
  PreferencialAte50 = "PREFERENCIAL_ATE_50",
  /** preferencial > 50% da comum */
  PreferencialMaisQue50 = "PREFERENCIAL_MAIS_QUE_50",
}
