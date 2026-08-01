import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Filter, ShieldAlert } from 'lucide-react';
import AgroPageShell from '../components/AgroPageShell';
import { BrazilUfSelect } from '../components/territorial/BrazilUfSelect';
import { httpClient } from '../services/http/client';
import { AGRO_API } from './agroApiEndpoints';
import {
  isMotorOportunidadesReal,
  isRetryableError,
  REQUIRED_REAL_OPPORTUNITY_FIELDS,
} from './agroOportunidadesContract';

const CATEGORIAS_API = [
  'Insumos Agrícolas & Fertilizantes',
  'Armazenagem & Silos Rurais',
  'Genética & Nutrição Animal',
  'Frete & Logística de Escoamento',
  'Máquinas, Tratores & Irrigação',
];

const STATUS_API = ['Identificada', 'Em Análise', 'Abordagem Inicial', 'Proposta Enviada'];

/**
 * Fila Comercial & Oportunidades Calculadas — política fail-closed.
 * Rota: /agro/oportunidades
 * Endpoint: GET /agro/oportunidades/calculadas
 *
 * Nenhum card é renderizado enquanto cada oportunidade não satisfizer o
 * contrato de dado real (id persistido, entidade Agro, evidência, fonte,
 * data de cálculo, versão do algoritmo, decisor classificado e limitações).
 * O conjunto anteriormente retornado pelo endpoint continha dados
 * ilustrativos não persistidos e está desativado.
 */
export default function AgroOportunidadesApproved() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);
  const [uf, setUf] = useState(searchParams.get('uf') || '');
  const [category, setCategory] = useState(searchParams.get('categoria') || '');
  const [status, setStatus] = useState(searchParams.get('status') || '');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = { min_score: 70 };
      if (uf) params.uf = uf;
      if (category) params.categoria = category;
      const res = await httpClient.get(AGRO_API.oportunidadesCalculadas, { params });
      setItems(res.data?.oportunidades || []);
    } catch (err: any) {
      setError(err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [uf, category]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => {
    const p: Record<string, string> = {};
    if (uf) p.uf = uf;
    if (category) p.categoria = category;
    if (status) p.status = status;
    setSearchParams(p, { replace: true });
  }, [uf, category, status, setSearchParams]);

  const motorReal = isMotorOportunidadesReal(items);
  const filteredItems = status
    ? items.filter((o: any) => o.status === status)
    : items;
  const empty = !loading && !error && motorReal && items.length === 0;
  const emptyFiltered = !loading && !error && motorReal && items.length > 0 && filteredItems.length === 0;

  const errorMessage = error ? (error?.userMessage || error?.message || 'Falha ao carregar oportunidades') : null;
  const retryable = isRetryableError(error);

  return (
    <AgroPageShell
      title={motorReal ? 'Fila Comercial & Oportunidades' : 'Motor de Oportunidades Agro em validação'}
      subtitle={
        motorReal
          ? (items.length > 0 ? `${filteredItems.length} oportunidades priorizadas pelo motor comercial` : 'Oportunidades calculadas a partir de dados reais')
          : 'Dados ilustrativos não persistidos foram desativados até a conclusão do motor baseado em evidências reais.'
      }
      loading={loading}
      error={errorMessage}
      errorRetryable={retryable}
      onRetry={loadData}
      empty={empty}
      emptyMessage="Nenhuma oportunidade calculada no recorte atual. Isso pode ser um resultado legítimo — o motor comercial só gera oportunidades quando há evidência suficiente."
      statusBadge={motorReal ? undefined : 'Em validação'}
    >
      {/* Filtros */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8, padding: 12, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <BrazilUfSelect value={uf} onChange={v => setUf(v)} showAllLabel="Todas as UFs" />
        <select value={category} onChange={e => setCategory(e.target.value)}
          style={{ background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', color: '#F8FAFC', padding: '7px 12px', borderRadius: 6, fontSize: 12 }}>
          <option value="">Todas as categorias</option>
          {CATEGORIAS_API.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={status} onChange={e => setStatus(e.target.value)}
          style={{ background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', color: '#F8FAFC', padding: '7px 12px', borderRadius: 6, fontSize: 12 }}>
          <option value="">Todos os status</option>
          {STATUS_API.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={loadData} style={{ background: '#22C55E', color: '#FFF', border: 'none', padding: '7px 16px', borderRadius: 6, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Filter size={12} /> Filtrar
        </button>
      </div>

      {!loading && !error && !motorReal && (
        <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.35)', borderRadius: 10, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ShieldAlert size={22} color="#F59E0B" style={{ flexShrink: 0 }} />
            <strong style={{ color: '#F8FAFC', fontSize: 15 }}>
              As oportunidades comerciais ainda não estão disponíveis para uso.
            </strong>
          </div>
          <p style={{ fontSize: 12, color: '#CBD5E1', margin: 0, lineHeight: 1.6 }}>
            O conjunto anteriormente apresentado continha dados ilustrativos não persistidos e foi
            desativado até a conclusão do motor baseado em evidências reais.
          </p>
          <div style={{ fontSize: 11, color: '#94A3B8', lineHeight: 1.6 }}>
            <strong style={{ color: '#F59E0B' }}>Contrato de reativação do motor:</strong> cada oportunidade precisará de{' '}
            {REQUIRED_REAL_OPPORTUNITY_FIELDS.join(', ').replace(/,([^,]*)$/, ' e$1')}.
          </div>
        </div>
      )}

      {!loading && !error && motorReal && emptyFiltered && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8, padding: 16, fontSize: 12, color: '#94A3B8' }}>
          Nenhuma oportunidade com o status selecionado no recorte atual.
        </div>
      )}

      {!loading && !error && motorReal && filteredItems.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>
          {filteredItems.map((opp: any, idx: number) => (
            <div key={idx} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 4, background: 'rgba(59,130,246,0.15)', color: '#3B82F6' }}>{opp.categoria || 'Não categorizado'}</span>
                <span style={{ fontSize: 12, fontWeight: 800, background: 'rgba(34,197,94,0.15)', color: '#22C55E', padding: '2px 8px', borderRadius: 4 }}>Score: {opp.composicao_score?.total ?? '—'}</span>
              </div>
              <strong style={{ fontSize: 15, color: '#F8FAFC' }}>{opp.titulo || 'Oportunidade sem título'}</strong>
              <div style={{ fontSize: 12, color: '#CBD5E1', background: '#0B132B', padding: 10, borderRadius: 6 }}>
                <strong>Entidade Agro:</strong> {opp.entidade_agro || '—'}<br />
                <strong>CAR:</strong> {opp.codigo_car || '—'} · <strong>CNPJ:</strong> {opp.cnpj || '—'}
              </div>
              {opp.evidencia && <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}><strong>Evidência:</strong> {opp.evidencia}</p>}
              <div style={{ fontSize: 11, color: '#64748B' }}>
                <strong>Fonte:</strong> {opp.fonte || '—'} · <strong>Regra:</strong> {opp.regra_geracao || '—'}<br />
                <strong>Calculado em:</strong> {opp.data_calculo || '—'} · <strong>Algoritmo:</strong> {opp.versao_algoritmo || '—'}
              </div>
              {opp.decisor && (
                <div style={{ fontSize: 11, color: '#94A3B8', borderTop: '1px solid #1E293B', paddingTop: 8 }}>
                  <strong>Decisor ({opp.decisor.classificacao || 'sugerido'}):</strong> {opp.decisor.nome || '—'}
                </div>
              )}
              {opp.limitacoes && <p style={{ fontSize: 11, color: '#F59E0B', margin: 0 }}><strong>Limitações:</strong> {opp.limitacoes}</p>}
            </div>
          ))}
        </div>
      )}
    </AgroPageShell>
  );
}
