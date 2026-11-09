export interface PartidoJSON {
  nome: string;
  digito: string;
}

export class Partido {
  public readonly nome: string;
  public readonly digito: string;

  constructor(nome: string, digito: string) {
    if (!/^\d{2}$/.test(digito)) {
      throw new Error(`Dígito do partido deve ter exatamente 2 dígitos numéricos: "${digito}"`);
    }
    this.nome = nome;
    this.digito = digito;
  }

  public toJSON(): PartidoJSON {
    return { nome: this.nome, digito: this.digito };
  }
}
