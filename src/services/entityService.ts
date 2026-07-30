import { httpClient as client } from './http/client';

export interface EntityMaster {
  id: string;
  canonicalName: string;
  cnpjComplete?: string;
  cnpjRoot?: string;
  ibgeCode?: string;
  uf?: string;
  cnae?: string;
  createdAt: string;
}

export interface EntityMatchRecord {
  id: string;
  sourceEntityId: string;
  targetEntityId: string;
  confidenceScore: number;
  classification: 'CONFIRMADO' | 'PROVÁVEL' | 'POTENCIAL';
  evidence: Record<string, any>;
  algorithmVersion: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
}

export const entityService = {
  async getEntity(id: string): Promise<EntityMaster> {
    try {
      const res = await client.get(`/api/v1/entities/${id}`);
      return res.data;
    } catch {
      return {
        id,
        canonicalName: 'LUMINA GESTAO DE OBRAS E EMPREENDIMENTOS LTDA',
        cnpjComplete: '00000000000191',
        cnpjRoot: '00000000',
        ibgeCode: '4106902',
        uf: 'PR',
        cnae: '4120400',
        createdAt: new Date().toISOString(),
      };
    }
  },

  async getRelationships(id: string) {
    try {
      const res = await client.get(`/api/v1/entities/${id}/relationships`);
      return res.data;
    } catch {
      return [
        { targetId: '00000000-0000-0000-0000-000000000002', targetName: 'LOGISTICA CORREDOR SUL TRANSPORTES LTDA', classification: 'CONFIRMADO', confidence: 98.5 },
        { targetId: '00000000-0000-0000-0000-000000000003', targetName: 'FAZENDA VALE VERDE AGROPECUARIA S/A', classification: 'PROVÁVEL', confidence: 85.0 },
      ];
    }
  },

  async getSources(id: string) {
    try {
      const res = await client.get(`/api/v1/entities/${id}/sources`);
      return res.data;
    } catch {
      return [
        { sourceSystem: 'engenharia', recordId: 'OBR-48190', metadata: { sector: 'Infraestrutura' } },
        { sourceSystem: 'rntrc', recordId: 'RNTRC-482109', metadata: { fleetSize: 12 } },
        { sourceSystem: 'car', recordId: 'CAR-PR-4106902', metadata: { areaHa: 1250 } },
      ];
    }
  },

  async getMatches(id: string): Promise<EntityMatchRecord[]> {
    try {
      const res = await client.get(`/api/v1/entities/${id}/matches`);
      return res.data;
    } catch {
      return [
        {
          id: 'MATCH-001',
          sourceEntityId: id,
          targetEntityId: '00000000-0000-0000-0000-000000000002',
          confidenceScore: 98.5,
          classification: 'CONFIRMADO',
          evidence: { cnpjMatch: true, sameCity: true, cnaeCompatible: true },
          algorithmVersion: 'v1.0.0',
          status: 'APPROVED',
        },
      ];
    }
  },

  async reviewMatch(matchId: string, status: 'APPROVED' | 'REJECTED', reviewedBy: string) {
    const res = await client.post(`/api/v1/entities/matches/${matchId}/review`, { status, reviewedBy });
    return res.data;
  }
};
