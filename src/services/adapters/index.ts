import type { Event, Company, Opportunity, Indicator } from '../../types';

// Adapts legacy payload to Event contract
export function adaptLegacyEvent(raw: any): Event {
  return {
    id: String(raw.id || raw.event_id || ''),
    titulo: String(raw.titulo || raw.name || raw.title || 'Sem título'),
    tipo: String(raw.tipo || raw.category || 'Outros'),
    severidade: (raw.severidade || raw.severity || 'media').toLowerCase() as any,
    dataInicio: String(raw.dataInicio || raw.start_date || raw.date || ''),
    dataFim: raw.dataFim || raw.end_date || null,
    local: String(raw.local || raw.location || ''),
    valor: String(raw.valor || raw.estimated_loss || raw.value || ''),
    verticais: Array.isArray(raw.verticais) ? raw.verticais.map((v: string) => v.toLowerCase() as any) : [],
    status: raw.status || 'Identificado',
    relevancia: Number(raw.relevancia || raw.relevance || 50),
    confianca: Number(raw.confianca || raw.confidence || 50),
    description: String(raw.description || raw.desc || '')
  };
}

// Adapts legacy payload to Company contract
export function adaptLegacyCompany(raw: any): Company {
  return {
    cnpj: String(raw.cnpj || raw.tax_id || ''),
    nome: String(raw.nome || raw.corporate_name || raw.name || ''),
    cidade: String(raw.cidade || raw.city || ''),
    uf: String(raw.uf || raw.state || ''),
    setor: String(raw.setor || raw.industry || ''),
    receita: String(raw.receita || raw.annual_revenue || 'R$ 0'),
    funcionarios: Number(raw.funcionarios || raw.employee_count || 0),
    status: raw.status === 'Inativa' ? 'Inativa' : 'Ativa',
    verticais: Array.isArray(raw.verticais) ? raw.verticais : [],
    score: Number(raw.score || raw.wins_score || 50)
  };
}

// Adapts legacy payload to Opportunity contract
export function adaptLegacyOpportunity(raw: any): Opportunity {
  return {
    id: String(raw.id || raw.opportunity_id || ''),
    score: Number(raw.score || raw.match_score || 50),
    demanda: String(raw.demanda || raw.product || raw.title || ''),
    valor: String(raw.valor || raw.estimated_value || ''),
    justification: String(raw.justification || raw.reason || ''),
    local: String(raw.local || raw.location || ''),
    stage: (raw.stage || 'identificada').toLowerCase() as any,
    cnpjAssociado: raw.cnpjAssociado || raw.company_cnpj || undefined,
    eventOriginId: raw.eventOriginId || raw.event_id || undefined
  };
}

// Adapts legacy payload to Indicator contract
export function adaptLegacyIndicator(raw: any): Indicator {
  return {
    municipio: String(raw.municipio || raw.municipality || ''),
    leitos: Number(raw.leitos || raw.active_beds || 0),
    medicos: Number(raw.medicos || raw.registered_doctors || 0),
    coberturaESF: String(raw.coberturaESF || raw.coverage_rate || '0%'),
    hospitais: Number(raw.hospitais || raw.hospital_count || 0)
  };
}
