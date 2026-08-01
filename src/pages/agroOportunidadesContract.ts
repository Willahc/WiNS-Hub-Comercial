// Contrato fail-closed do Radar de Sinais e Oportunidades Agro.
// O motor expõe explicitamente seu status via /agro/oportunidades/status.
// Lista vazia NÃO implica motor ativo: a ativação só é reconhecida quando o
// status explícito do motor indica ACTIVE.
export const ENGINE_STATUSES = ['NOT_IMPLEMENTED', 'VALIDATION', 'ACTIVE', 'DEGRADED', 'UNAVAILABLE'] as const;

export const REQUIRED_REAL_SIGNAL_FIELDS = [
  'signal_id',
  'stage',
  'signal_type',
  'entity_type',
  'entity_id',
  'municipio',
  'uf',
  'priority',
  'classification',
  'evidence_summary',
  'metrics',
  'rule',
  'sources',
  'limitations',
  'next_step',
] as const;

export const FORBIDDEN_FABRICATED_SIGNAL_FIELDS = [
  'score',
  'min_score',
  'composicao_score',
  'decisor',
  'contato',
  'telefone',
  'email',
  'cnpj',
  'codigo_car',
] as const;

export function isSignalReal(signal: any): boolean {
  if (!signal || typeof signal !== 'object') return false;
  return REQUIRED_REAL_SIGNAL_FIELDS.every((f) => {
    const v = signal[f];
    return v !== null && v !== undefined && v !== '';
  });
}

export function hasNoFabricatedFields(signal: any): boolean {
  if (!signal || typeof signal !== 'object') return false;
  return FORBIDDEN_FABRICATED_SIGNAL_FIELDS.every((f) => {
    const v = signal[f];
    return v === null || v === undefined || v === '';
  });
}

export function isEngineStatusExplicit(status: any): boolean {
  return (
    !!status &&
    typeof status === 'object' &&
    typeof status.engine_status === 'string' &&
    ENGINE_STATUSES.includes(status.engine_status as any)
  );
}

export function isEngineActive(status: any): boolean {
  return isEngineStatusExplicit(status) && status.engine_status === 'ACTIVE';
}

/**
 * Deprecado (compatibilidade com o dashboard Agro).
 * Semântica nova: lista vazia NÃO implica motor real — apenas itens que
 * satisfazem o contrato de sinal territorial e não contêm campos fabricados
 * (score, decisor, contato, CAR/CNPJ) tornam o conjunto válido.
 */
export function isMotorOportunidadesReal(items: any[] | undefined | null): boolean {
  if (!Array.isArray(items)) return false;
  return items.length > 0 && items.every((o) => isSignalReal(o) && hasNoFabricatedFields(o));
}

export function isRetryableError(err: any): boolean {
  if (!err) return false;
  if (err.response) {
    const status = err.response.status;
    return status >= 500 && status <= 599;
  }
  return true;
}
