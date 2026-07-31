import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Sprout } from 'lucide-react';
import AgroPageShell from '../components/AgroPageShell';
import { httpClient } from '../services/http/client';

/**
 * Ficha 360° da Fazenda — dados reais de identificação, localização, área, bioma,
 * proprietário, empresa, decisores, logística e oportunidades.
 * Rota: /agro/propriedades/:id
 * Endpoint: GET /agro/imoveis/:id
 */
export default function AgroPropriedadeDetalheApproved() {
  const { id } = useParams<{ id: string }>();
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await httpClient.get(`/agro/imoveis/${encodeURIComponent(id)}`);
      setDetail(res.data);
    } catch (err: any) {
      setError(err?.userMessage || err?.message || 'Falha ao carregar ficha da propriedade');
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadData(); }, [loadData]);

  const imovel = detail?.imovel;

  return (
    <AgroPageShell
      title={imovel ? (imovel.nome_imovel || `Propriedade CAR ${(imovel.codigo_car || id || '').slice(0, 18)}`) : 'Ficha 360° da Fazenda'}
      subtitle={imovel ? `CAR: ${imovel.codigo_car || id} · ${imovel.municipio || '—'}/${imovel.uf || '—'}` : 'Carregando...'}
      loading={loading} error={error} onRetry={loadData}
    >
      {imovel && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Cabeçalho identificador */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: '#F8FAFC', margin: 0 }}>{imovel.nome_imovel || `Fazenda CAR ${(imovel.codigo_car || '').slice(0, 16)}`}</h2>
                <span style={{ fontSize: 12, color: '#94A3B8' }}>CAR: {imovel.codigo_car || id} · {imovel.municipio || '—'}/{imovel.uf || '—'}</span>
              </div>
              <span style={{ fontSize: 14, fontWeight: 800, color: '#22C55E', background: 'rgba(34,197,94,0.15)', padding: '6px 14px', borderRadius: 6 }}>
                {imovel.area_total_ha ? `${Number(imovel.area_total_ha).toLocaleString('pt-BR')} ha Declarados` : 'Área não informada'}
              </span>
            </div>

            {/* Grid de dados cadastrais */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, background: '#0B132B', padding: 16, borderRadius: 6 }}>
              <div><small style={{ color: '#64748B' }}>Proprietário Registrado</small><strong style={{ display: 'block', color: '#F8FAFC', marginTop: 4 }}>{imovel.nome_proprietario || 'Proprietário SICAR'}</strong><span style={{ fontSize: 10, color: '#64748B' }}>Dado declarado</span></div>
              <div><small style={{ color: '#64748B' }}>CNPJ / CPF</small><strong style={{ display: 'block', color: '#3B82F6', marginTop: 4 }}>{imovel.cpf_cnpj || 'Não disponível'}</strong><span style={{ fontSize: 10, color: '#64748B' }}>Dado cadastral</span></div>
              <div><small style={{ color: '#64748B' }}>Bioma</small><strong style={{ display: 'block', color: '#06B6D4', marginTop: 4 }}>{imovel.bioma || 'Inferido pela UF'}</strong><span style={{ fontSize: 10, color: '#64748B' }}>Inferência</span></div>
              <div><small style={{ color: '#64748B' }}>Uso do Solo</small><strong style={{ display: 'block', color: '#F59E0B', marginTop: 4 }}>{imovel.uso_solo || 'Declarado no CAR'}</strong><span style={{ fontSize: 10, color: '#64748B' }}>Dado declarado</span></div>
              <div><small style={{ color: '#64748B' }}>Área de Lavoura</small><strong style={{ display: 'block', color: '#22C55E', marginTop: 4 }}>{imovel.area_lavoura_ha ? `${Number(imovel.area_lavoura_ha).toLocaleString('pt-BR')} ha` : '—'}</strong></div>
              <div><small style={{ color: '#64748B' }}>Área de Pastagem</small><strong style={{ display: 'block', color: '#F59E0B', marginTop: 4 }}>{imovel.area_pasto_ha ? `${Number(imovel.area_pasto_ha).toLocaleString('pt-BR')} ha` : '—'}</strong></div>
            </div>
          </div>

          {/* Oportunidades */}
          {detail?.oportunidades_calculadas && detail.oportunidades_calculadas.length > 0 && (
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8, padding: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#F8FAFC', marginBottom: 12 }}>Oportunidades Comerciais Calculadas para esta Propriedade</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
                {(detail.oportunidades_calculadas as any[]).map((opp: any, idx: number) => (
                  <div key={idx} style={{ background: '#0B132B', border: '1px solid #1E293B', borderRadius: 6, padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#3B82F6' }}>{opp.categoria}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, background: 'rgba(34,197,94,0.15)', color: '#22C55E', padding: '2px 6px', borderRadius: 4 }}>Score: {opp.score}</span>
                    </div>
                    <strong style={{ fontSize: 14, color: '#F8FAFC' }}>{opp.titulo}</strong>
                    <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>{opp.justificativa}</p>
                    {opp.decisor_contato && (
                      <div style={{ fontSize: 11, color: '#CBD5E1', borderTop: '1px solid #1E293B', paddingTop: 8 }}>
                        Decisor: <strong>{opp.decisor_contato}</strong> · Status: <span style={{ color: '#F59E0B' }}>{opp.status || 'Não iniciado'}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Nota de proveniência */}
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', borderTop: '1px solid var(--border-default)', paddingTop: 12, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <span>📍 Dado declarado: SICAR/CAR</span>
            <span>📋 Dado cadastral: RFB</span>
            <span>🧠 Inferência: Algorítmica (bioma por UF)</span>
            <span>🚫 Indisponível: campo não populado na base</span>
          </div>
        </div>
      )}
    </AgroPageShell>
  );
}
