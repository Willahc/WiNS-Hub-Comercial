import { httpClient } from '../http/client';
import { adaptLegacyEvent } from '../adapters';
import type { Event } from '../../types';

export const eventsService = {
  getEvents: async (): Promise<Event[]> => {
    const res = await httpClient.get('/eventos');
    return res.data.map(adaptLegacyEvent);
  },

  getEventById: async (id: string): Promise<Event | undefined> => {
    const res = await httpClient.get(`/engenharia/obras/${id}`);
    return adaptLegacyEvent(res.data);
  }
};
