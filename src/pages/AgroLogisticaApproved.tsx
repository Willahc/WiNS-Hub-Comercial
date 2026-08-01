import React, { useState, useEffect, useCallback } from 'react';
import AgroPageShell from '../components/AgroPageShell';
import { BrazilUfSelect } from '../components/territorial/BrazilUfSelect';
import { httpClient } from '../services/http/client';
import { Truck, Warehouse, ShieldAlert } from 'lucide-react';
import { AGRO_API } from './agroApiEndpoints';

function fmt(n: number): string {
  return new Intl.NumberFormat('pt-BR').format(n);
}
function available(value: unknown): string {
  return typeof value === 'number' && Number.isFinite(value) ? fmt(value) : 'Não disponível';
}

/**
 * Agro-Logística (Módulo Interno do Agro 360)
 * Exibe unicamente indicadores de cobertura da base Transportadores RNTRC
 * (ANTT) e Armazéns (CONAB). Os totais são indicadores de cobertura da base,
 * NÃO representam matches, relações comerciais ou capacidade disponível.
 * Isento de referências fora do escopo.
 */
export default function AgroLogisticaApproved() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uf, setUf] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = {};
      if (uf) params.uf = uf;
      const res = await httpClient.get(AGRO_API.logisticaCorrelacao, { params });
      setData(res.data || null);
    } catch (err: any) {
      setError(err?.userMessage || err?.message || 'Falha ao carregar dados de logística agro');
    } finally {
      setLoading(false);
    }
  }, [uf]);

  useEffect(() => { loadData(); }, [loadData]);

  const empty = !loading && !error && !data;

  return (
    <AgroPageShell
      title="Agro-Logística & Escoamento"
      subtitle="Indicadores de cobertura da base: transportadores RNTRC (ANTT) e infraestrutura de armazenagem CONAB"
      loading={loading}
      error={error}
      onRetry={loadData}
      empty={empty}
      emptyMessage="Nenhum dado logístico encontrado no recorte atual."
      statusBadge="Cobertura de base ANTT/CONAB"
    >
      {/* Filtros */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8, padding: 12, display: 'flex', gap: 10, alignItems: 'center' }}>
        <BrazilUfSelect value={uf} onChange={v => setUf(v)} showAllLabel="Todas as UFs" />
        <span style={{ fontSize: 12, color: '#94A3B8' }}>Filtrar por UF da infraestrutura agrícola</span>
      </div>

      {/* Aviso de ressalva semântica */}
      <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: 8, padding: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
        <ShieldAlert size={18} color="#F59E0B" style={{ flexShrink: 0 }} />
        <div style={{ fontSize: 12, color: '#CBD5E1' }}>
          <strong>Nota de Proveniência & Ressalva Técnica:</strong> Proximidade geográfica não comprova relação comercial contratada. Os totais exibidos são indicadores de cobertura da base (ANTT/CONAB), não matches, relações comerciais nem capacidade disponível.
        </div>
      </div>

      {data && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Truck size={18} color="#F59E0B" />
              <h4 style={{ fontSize: 13, fontWeight: 700, color: '#F8FAFC', margin: 0 }}>Transportadores RNTRC — Cobertura da base</h4>
            </div>
            <span style={{ fontSize: 24, fontWeight: 800, color: '#22C55E' }}>
              {available(data.transportadores_rntrc_disponiveis)}
            </span>
            <span style={{ fontSize: 11, color: '#94A3B8', display: 'block', marginTop: 4 }}>
              Indicador de cobertura agregado pela API. Não representa capacidade ou relação comercial.
            </span>
          </div>

          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Warehouse size={18} color="#3B82F6" />
              <h4 style={{ fontSize: 13, fontWeight: 700, color: '#F8FAFC', margin: 0 }}>Armazéns CONAB — Cobertura da base</h4>
            </div>
            <span style={{ fontSize: 24, fontWeight: 800, color: '#3B82F6' }}>
              {available(data.armazens_conab_proximos)}
            </span>
            <span style={{ fontSize: 11, color: '#94A3B8', display: 'block', marginTop: 4 }}>
              Indicador de cobertura agregado pela API. Não representa capacidade ou relação comercial.
            </span>
          </div>
        </div>
      )}

      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', borderTop: '1px solid var(--border-default)', paddingTop: 12 }}>
        <strong>Proveniência Logística:</strong> Agregações de cobertura fornecidas pela API (origem declarada: ANTT/RNTRC e CONAB/SICARM). Totais não devem ser apresentados como matches, relações comerciais ou capacidade disponível.
      </div>
    </AgroPageShell>
  );
}
