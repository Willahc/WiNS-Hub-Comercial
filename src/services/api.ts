import type { Event, Company, Opportunity, Territory, Indicator, VerticalImpact, TimelineItem } from '../types';
import { dashboardService } from './dashboard';
import { eventsService } from './events';
import { mapService } from './map';
import { httpClient } from './http/client';
import { adaptLegacyCompany } from './adapters';

export const winsApi = {
  getKpis: async (): Promise<any[]> => {
    return dashboardService.getKpis();
  },
  
  getTimeline: async (): Promise<TimelineItem[]> => {
    return dashboardService.getTimeline();
  },
  
  getFeaturedEvent: async (): Promise<any> => {
    return dashboardService.getFeaturedEvent();
  },
  
  getVerticalImpacts: async (): Promise<VerticalImpact[]> => {
    return dashboardService.getVerticalImpacts();
  },
  
  getOpportunities: async (): Promise<Opportunity[]> => {
    return dashboardService.getOpportunities();
  },
  
  getEvents: async (): Promise<Event[]> => {
    return eventsService.getEvents();
  },
  
  getEventById: async (id: string): Promise<Event | undefined> => {
    return eventsService.getEventById(id);
  },
  
  getCompanies: async (): Promise<Company[]> => {
    const res = await httpClient.get('/empresas');
    return res.data.map(adaptLegacyCompany);
  },
  
  getCompanyByCnpj: async (cnpj: string): Promise<Company | undefined> => {
    const res = await httpClient.get(`/empresas/${cnpj}`);
    return adaptLegacyCompany(res.data);
  },
  
  getTerritories: async (): Promise<Territory[]> => {
    return mapService.getTerritories();
  },
  
  getIndicators: async (): Promise<Indicator[]> => {
    return mapService.getIndicators();
  }
};
