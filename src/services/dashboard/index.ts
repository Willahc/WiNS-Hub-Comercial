import { httpClient } from '../http/client';
import { adaptLegacyOpportunity } from '../adapters';

export const dashboardService = {
  getKpis: async () => {
    const res = await httpClient.get('/dashboard/kpis');
    return res.data;
  },

  getTimeline: async () => {
    const res = await httpClient.get('/dashboard/timeline');
    return res.data;
  },

  getFeaturedEvent: async () => {
    const res = await httpClient.get('/dashboard/featured');
    return res.data;
  },

  getVerticalImpacts: async () => {
    const res = await httpClient.get('/dashboard/impacts');
    return res.data;
  },

  getOpportunities: async () => {
    const res = await httpClient.get('/oportunidades');
    return res.data.items ? res.data.items.map(adaptLegacyOpportunity) : (res.data.map ? res.data.map(adaptLegacyOpportunity) : []);
  }
};
