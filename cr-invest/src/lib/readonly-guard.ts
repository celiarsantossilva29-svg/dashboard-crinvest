/**
 * Guarda de segurança: garante que integrações externas usem apenas GET.
 * Importe e chame assertReadOnly("GET") no início de toda função de integração.
 */
export function assertReadOnly(method: string): void {
  if (method.toUpperCase() !== "GET") {
    throw new Error(
      `[READONLY GUARD] Operação bloqueada: método "${method}" não é permitido. ` +
        `Este sistema é somente leitura em relação a sistemas externos. ` +
        `Apenas métodos GET são autorizados nas integrações.`
    );
  }
}
