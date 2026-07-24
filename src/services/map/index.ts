import { httpClient } from '../http/client';
import { adaptLegacyIndicator } from '../adapters';
import type { Territory, Indicator } from '../../types';

export const mapService = {
  getTerritories: async (): Promise<Territory[]> => {
    const res = await httpClient.get('/mapa/territories');
    return res.data;
  },

  getIndicators: async (): Promise<Indicator[]> => {
    const res = await httpClient.get('/indicadores');
    return res.data.map(adaptLegacyIndicator);
  }
};
