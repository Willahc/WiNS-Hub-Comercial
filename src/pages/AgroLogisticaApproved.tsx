import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Truck, AlertTriangle } from 'lucide-react';
import AgroPageShell from '../components/AgroPageShell';
import { BrazilUfSelect } from '../components/territorial/BrazilUfSelect';
import { httpClient } from '../services/http/client';

function fmt(n: number): string { return new Intl.NumberFormat('pt-BR').format(n); }

/**
 * Integração Agro–Logística
 * Rota: /agro/logistica
 * Endpoint: GET /agro/logistica/correlacao
 */
export default function AgroLogisticaApproved() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uf, setUf] = useState(searchParams.get('uf') || '');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = {};
      if (uf) params.uf = uf;
      const res = await httpClient.get('/agro/logistica/correlacao', { params });
      setData(res.data);
    } catch (err: any) {
      setError(err?.userMessage || err?.message || 'Falha ao carregar dados logísticos');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [uf]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => {
    const p: Record<string, string> = {};
    if (uf) p.uf = uf;
    setSearchParams(p, { replace: true });
  }, [uf, setSearchParams]);

  return (
    <AgroPageShell
      title="Integração Agro–Logística"
      subtitle="Correlação entre imóveis rurais, transportadores RNTRC, armazéns e corredores logísticos. Geografia indica POTENCIAL — não CONFIRMADO."
      loading={loading} error={error} onRetry={loadData}
    >
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8, padding: 12, display: 'flex', gap: 10 }}>
        <BrazilUfSelect value={uf} onChange={v => setUf(v)} showAllLabel="Todas as UFs" />
      </div>

      {data && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          {data.transportadores_rntrc_disponiveis !== undefined && (
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8, padding: 16 }}>
              <h4 style={{ fontSize: 13, fontWeight: 700, color: '#F59E0B', margin: 0 }}>Transportadores RNTRC</h4>
              <span style={{ fontSize: 24, fontWeight: 800, color: '#F8FAFC' }}>{fmt(data.transportadores_rntrc_disponiveis)}</span>
              <span style={{ fontSize: 11, color: '#94A3B8', display: 'block', marginTop: 4 }}>Empresas ativas de Transporte Rodoviário de Cargas</span>
            </div>
          )}

          {data.armazens_conab_proximos !== undefined && (
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8, padding: 16 }}>
              <h4 style={{ fontSize: 13, fontWeight: 700, color: '#3B82F6', margin: 0 }}>Armazéns CONAB</h4>
              <span style={{ fontSize: 24, fontWeight: 800, color: '#F8FAFC' }}>{fmt(data.armazens_conab_proximos)}</span>
              <span style={{ fontSize: 11, color: '#94A3B8', display: 'block', marginTop: 4 }}>Unidades de Armazenamento de Grãos</span>
            </div>
          )}

          {data.caminhao_vazio_oportunidades !== undefined ? (
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8, padding: 16 }}>
              <h4 style={{ fontSize: 13, fontWeight: 700, color: '#22C55E', margin: 0 }}>Frete Retorno (Caminhão Vazio)</h4>
              <span style={{ fontSize: 24, fontWeight: 800, color: '#F8FAFC' }}>{data.caminhao_vazio_oportunidades === 0 ? 'Sem dados' : fmt(data.caminhao_vazio_oportunidades)}</span>
              <span style={{ fontSize: 11, color: '#94A3B8', display: 'block', marginTop: 4 }}>Oportunidades de aproveitamento de retorno</span>
            </div>
          ) : (
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8, padding: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={14} color="#64748B" />
              <span style={{ fontSize: 12, color: '#64748B' }}>Caminhão Vazio: dados ainda não disponíveis na base atual.</span>
            </div>
          )}
        </div>
      )}

      {/* Tabela de correlações detalhadas */}
      {data?.correlacoes && data.correlacoes.length > 0 && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#0B132B', color: '#94A3B8', borderBottom: '1px solid #1E293B' }}>
                <th style={{ padding: 12 }}>Propriedade</th>
                <th style={{ padding: 12 }}>Transportador</th>
                <th style={{ padding: 12 }}>RNTRC</th>
                <th style={{ padding: 12 }}>Armazém</th>
                <th style={{ padding: 12 }}>Distância</th>
                <th style={{ padding: 12 }}>Força</th>
                <th style={{ padding: 12 }}>Evidência</th>
              </tr>
            </thead>
            <tbody>
              {(data.correlacoes as any[]).map((c: any, i: number) => (
                <tr key={i} style={{ borderBottom: '1px solid #1E293B' }}>
                  <td style={{ padding: 12, color: '#F8FAFC', fontSize: 12 }}>{c.propriedade || '—'}</td>
                  <td style={{ padding: 12, color: '#CBD5E1', fontSize: 12 }}>{c.transportador || '—'}</td>
                  <td style={{ padding: 12, color: '#94A3B8', fontSize: 11 }}>{c.rntrc || '—'}</td>
                  <td style={{ padding: 12, color: '#CBD5E1', fontSize: 12 }}>{c.armazem || '—'}</td>
                  <td style={{ padding: 12, color: '#22C55E', fontSize: 12 }}>{c.distancia_km ? `${c.distancia_km} km` : '—'}</td>
                  <td style={{ padding: 12 }}><span style={{ fontSize: 10, fontWeight: 700, color: (c.score || 0) >= 70 ? '#22C55E' : '#F59E0B' }}>{c.score !== undefined ? `${Math.round(c.score)}/100` : '—'}</span></td>
                  <td style={{ padding: 12, color: '#64748B', fontSize: 11 }}>{c.evidencia || 'Geografia = POTENCIAL'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', borderTop: '1px solid var(--border-default)', paddingTop: 12 }}>
        ⚠️ Geografia gera POTENCIAL, não CONFIRMADO. Proximidade espacial entre propriedade e transportador NÃO comprova relação comercial.
      </div>
    </AgroPageShell>
  );
}
