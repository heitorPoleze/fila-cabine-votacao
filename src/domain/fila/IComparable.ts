export interface IComparable{
    /**
     * Deve Comparar a instancia this com outro objeto da mesma classe passado como parâmetro,
     * retornando true se forem iguais ou false caso contrário.
     * @param other é um objeto da mesma classe a ser comparado.
     * @returns Um valor booleano indicando se a instância this é igual ao parâmetro.
     */
    equals(other: IComparable): boolean;

    /**
     * Deve Comparar a instancia this com outro objeto da mesma classe passado como parâmetro,
     * retornando um valor negativo se a instância this for menor que o parâmetro,
     * zero se forem iguais ou um valor positivo se a instância this for maior que o parâmetro.
     *
     * @param other é um objeto da mesma classe a ser comparado.
     * @returns Um valor negativo se a instância this for menor que o parâmetro,
     * zero se forem iguais ou um valor positivo se a instância this for maior que o parâmetro.
     */
    compareTo(other: IComparable): number;
}