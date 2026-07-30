import { httpClient as client } from './http/client';

export interface AuditRecommendation {
  id: string;
  recommendedTarget: string;
  targetVertical: 'engenharia' | 'agro' | 'logistica' | 'saude';
  recommendationType: string;
  rationale: string;
  underlyingData: string;
  confidence: number;
  classification: 'CONFIRMADO' | 'PROVÁVEL' | 'POTENCIAL';
  sourceSystem: string;
  algorithmVersion: string;
  generatedAt: string;
  expiresAt: string;
}

export const recommendationService = {
  async getObraRecommendations(obraId: string): Promise<AuditRecommendation[]> {
    const res = await client.get(`/api/v1/recommendations/obra/${obraId}`);
    return res.data;
  },

  async getEmpresaRecommendations(empresaId: string): Promise<AuditRecommendation[]> {
    const res = await client.get(`/api/v1/recommendations/empresa/${empresaId}`);
    return res.data;
  },

  async getMunicipioRecommendations(ibgeCode: string): Promise<AuditRecommendation[]> {
    const res = await client.get(`/api/v1/recommendations/municipio/${ibgeCode}`);
    return res.data;
  },

  async getExplanation(recId: string) {
    const res = await client.get(`/api/v1/recommendations/${recId}/explanation`);
    return res.data;
  }
};
