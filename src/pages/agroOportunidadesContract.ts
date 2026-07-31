export const REQUIRED_REAL_OPPORTUNITY_FIELDS = [
  'id',
  'entidade_agro',
  'codigo_car',
  'cnpj',
  'evidencia',
  'regra_geracao',
  'composicao_score',
  'fonte',
  'data_calculo',
  'versao_algoritmo',
  'decisor',
  'limitacoes',
] as const;

export function isMotorOportunidadesReal(items: any[] | undefined | null): boolean {
  if (!Array.isArray(items)) return false;
  if (items.length === 0) return true;
  return items.every((o) => {
    if (!o || typeof o !== 'object') return false;
    return REQUIRED_REAL_OPPORTUNITY_FIELDS.every((f) => {
      const v = o[f];
      return v !== null && v !== undefined && v !== '';
    });
  });
}

export function isRetryableError(err: any): boolean {
  if (!err) return false;
  if (err.response) {
    const status = err.response.status;
    return status >= 500 && status <= 599;
  }
  return true;
}
