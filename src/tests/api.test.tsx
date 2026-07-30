import { describe, it, expect, vi, beforeEach } from 'vitest';
import { httpClient } from '../services/http/client';
import { eventsService } from '../services/events';
import { adaptLegacyEvent, adaptLegacyCompany, adaptLegacyOpportunity, adaptLegacyIndicator } from '../services/adapters';

describe('WiNS Hub — Suíte Completa de Testes da Camada de API e Resiliência (Sprint 2A)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    delete process.env.WINS_FORCE_PROD_MODE;
  });

  // 1. Testes de Sucesso de Chamadas e Retornos
  it('deve retornar dados adaptados com sucesso do eventsService', async () => {
    const rawEvents = [
      { id: 10, name: 'Obra Rodoviária BR-116', category: 'Obra', severity: 'ALTA', start_date: '2026-07-20', location: 'Lajeado, RS' }
    ];
    
    vi.spyOn(httpClient, 'get').mockResolvedValue({ data: rawEvents });

    const data = await eventsService.getEvents();
    expect(data.length).toBe(1);
    expect(data[0].id).toBe('10');
    expect(data[0].titulo).toBe('Obra Rodoviária BR-116');
    expect(data[0].severidade).toBe('alta');
  });

  // 2. Testes de Erros HTTP (401, 403, 404, 500)
  it('deve lançar exceção no caso de erro 401 Unauthorized em produção', async () => {
    vi.spyOn(httpClient, 'get').mockRejectedValue({
      response: { status: 401, data: 'Unauthorized' }
    });

    // Em produção (DEV = false), deve repassar o erro
    process.env.WINS_FORCE_PROD_MODE = 'true';
    await expect(eventsService.getEvents()).rejects.toBeDefined();
  });

  it('deve lançar exceção no caso de erro 403 Forbidden em produção', async () => {
    vi.spyOn(httpClient, 'get').mockRejectedValue({
      response: { status: 403, data: 'Forbidden' }
    });

    process.env.WINS_FORCE_PROD_MODE = 'true';
    await expect(eventsService.getEvents()).rejects.toBeDefined();
  });

  it('deve lançar exceção no caso de erro 404 Not Found em produção', async () => {
    vi.spyOn(httpClient, 'get').mockRejectedValue({
      response: { status: 404, data: 'Not Found' }
    });

    process.env.WINS_FORCE_PROD_MODE = 'true';
    await expect(eventsService.getEvents()).rejects.toBeDefined();
  });

  it('deve lançar exceção no caso de erro 500 Server Error em produção', async () => {
    vi.spyOn(httpClient, 'get').mockRejectedValue({
      response: { status: 500, data: 'Server Error' }
    });

    process.env.WINS_FORCE_PROD_MODE = 'true';
    await expect(eventsService.getEvents()).rejects.toBeDefined();
  });

  // 3. Teste de falha sem substituição de dados
  it('deve propagar a falha de API sem retornar dados locais', async () => {
    vi.spyOn(httpClient, 'get').mockRejectedValue(new Error('Network Error'));
    
    // Simula ambiente de desenvolvimento
    delete process.env.WINS_FORCE_PROD_MODE;
    
    await expect(eventsService.getEvents()).rejects.toThrow('Network Error');
  });

  // 4. Teste de Resposta Vazia e Parcial
  it('deve tratar resposta vazia retornando array vazio adaptado', async () => {
    vi.spyOn(httpClient, 'get').mockResolvedValue({ data: [] });
    const data = await eventsService.getEvents();
    expect(data.length).toBe(0);
  });

  it('deve preencher valores default ao receber resposta parcial/incompleta do legado', () => {
    const rawPartialEvent = { id: 42 }; // Faltam campos cruciais
    const adapted = adaptLegacyEvent(rawPartialEvent);
    
    expect(adapted.id).toBe('42');
    expect(adapted.titulo).toBe('Sem título');
    expect(adapted.tipo).toBe('Outros');
    expect(adapted.severidade).toBe('media');
  });

  // 5. Testes de Adapters e Validação de Contrato
  it('deve mapear corretamente os contratos no adaptLegacyIndicator', () => {
    const raw = { municipality: 'Lajeado, RS', active_beds: 15, coverage_rate: '84%' };
    const adapted = adaptLegacyIndicator(raw);
    
    expect(adapted.municipio).toBe('Lajeado, RS');
    expect(adapted.leitos).toBe(15);
    expect(adapted.coberturaESF).toBe('84%');
    expect(adapted.hospitais).toBe(0); // default
  });

  it('deve mapear corretamente os contratos no adaptLegacyOpportunity', () => {
    const raw = { opportunity_id: 'opp_99', match_score: 95, product: 'Silos de Grãos', estimated_value: 'R$ 3M' };
    const adapted = adaptLegacyOpportunity(raw);
    
    expect(adapted.id).toBe('opp_99');
    expect(adapted.score).toBe(95);
    expect(adapted.demanda).toBe('Silos de Grãos');
    expect(adapted.valor).toBe('R$ 3M');
    expect(adapted.stage).toBe('identificada'); // default
  });

  it('deve mapear corretamente os contratos no adaptLegacyCompany', () => {
    const raw = { tax_id: '123', corporate_name: 'Firma A', wins_score: 87 };
    const adapted = adaptLegacyCompany(raw);
    
    expect(adapted.cnpj).toBe('123');
    expect(adapted.nome).toBe('Firma A');
    expect(adapted.score).toBe(87);
    expect(adapted.status).toBe('Ativa'); // default
  });

  // 6. Teste de Timeout
  it('deve simular timeout de requisição que estoura o limite do httpClient', async () => {
    const err = new Error('timeout of 10000ms exceeded');
    vi.spyOn(httpClient, 'get').mockRejectedValue(err);
    
    process.env.WINS_FORCE_PROD_MODE = 'true';
    await expect(eventsService.getEvents()).rejects.toThrow('timeout');
  });
});
