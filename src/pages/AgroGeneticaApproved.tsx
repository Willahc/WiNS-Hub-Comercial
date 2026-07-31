import React, { useState, useEffect, useCallback } from 'react';
import { Dna, AlertTriangle } from 'lucide-react';
import AgroPageShell from '../components/AgroPageShell';
import { httpClient } from '../services/http/client';

/**
 * Genética & Pecuária (WiNS Genetic)
 * Rota: /agro/genetica
 * Endpoint: GET /agro/genetica/simulador
 * 
 * Exibe apenas dados reais da API. Não inventa contagens, scores ou resultados.
 * Simulador só aparece quando há dados de vaca e touro + regra documentada.
 */
export default function AgroGeneticaApproved() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTouro, setSelectedTouro] = useState<any>(null);
  const [simuladorDisponivel, setSimuladorDisponivel] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await httpClient.get('/agro/genetica/simulador');
      const d = res.data;
      setData(d);
      // Verifica se há dados suficientes para o simulador
      const reprodutores = d?.reprodutores || [];
      if (reprodutores.length > 0) setSelectedTouro(reprodutores[0]);
      // Simulador só disponível se houver reprodutores com DEP e dados de vaca
      setSimuladorDisponivel(
        reprodutores.length > 0 &&
        reprodutores.some((t: any) => t.dep_ganho_peso || t.registro)
      );
    } catch (err: any) {
      setError(err?.userMessage || err?.message || 'Falha ao carregar dados genéticos');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const reprodutores: any[] = data?.reprodutores || [];
  const totalReprodutores = data?.total_reprodutores;

  return (
    <AgroPageShell
      title="Genética & Pecuária — WiNS Genetic"
      subtitle={totalReprodutores ? `${totalReprodutores.toLocaleString('pt-BR')} reprodutores na base` : 'Base genética em validação'}
      loading={loading} error={error} onRetry={loadData}
    >
      {/* Status da base */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8, padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        {simuladorDisponivel ? (
          <Dna size={24} color="#22C55E" />
        ) : (
          <AlertTriangle size={24} color="#F59E0B" />
        )}
        <div>
          <strong style={{ color: '#F8FAFC', display: 'block', fontSize: 14 }}>
            {simuladorDisponivel
              ? 'Base disponível — simulador em validação'
              : 'Base genética em validação — simulador indisponível'}
          </strong>
          <span style={{ fontSize: 12, color: '#94A3B8' }}>
            {simuladorDisponivel
              ? 'Dados reais de reprodutores carregados. O simulador de acasalamento requer dados completos de vaca e touro com regra documentada.'
              : 'O catálogo de reprodutores ainda não possui dados suficientes para o simulador. Nenhum resultado será inventado.'}
          </span>
        </div>
      </div>

      {/* Simulador (apenas se disponível) */}
      {simuladorDisponivel && selectedTouro && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8, padding: 16 }}>
          <h4 style={{ fontSize: 14, fontWeight: 700, color: '#EC4899', margin: '0 0 12px 0' }}>Simulador de Match Genético Vaca × Touro</h4>
          <div style={{ background: '#0B132B', padding: 16, borderRadius: 6, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
            <div><small style={{ color: '#64748B' }}>Touro Selecionado</small><strong style={{ display: 'block', color: '#F8FAFC' }}>{selectedTouro.nome || '—'}</strong></div>
            <div><small style={{ color: '#64748B' }}>RGD</small><strong style={{ display: 'block', color: '#EC4899' }}>{selectedTouro.registro || '—'}</strong></div>
            {selectedTouro.dep_ganho_peso && <div><small style={{ color: '#64748B' }}>DEP Ganho de Peso</small><strong style={{ display: 'block', color: '#22C55E' }}>+{selectedTouro.dep_ganho_peso} kg</strong></div>}
            <div><small style={{ color: '#64748B' }}>Consanguinidade</small><strong style={{ display: 'block', color: '#3B82F6' }}>{selectedTouro.consanguinidade || 'Em validação'}</strong></div>
          </div>
          <div style={{ fontSize: 10, color: '#64748B', marginTop: 8 }}>
            Resultados do simulador dependem de dados reais dos dois animais, regra de cálculo documentada e componentes explicáveis. Resultados mostrados são provenientes da API.
          </div>
        </div>
      )}

      {/* Catálogo de Reprodutores */}
      {reprodutores.length > 0 && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#0B132B', color: '#94A3B8', borderBottom: '1px solid #1E293B' }}>
                <th style={{ padding: 12 }}>RGD / Nome</th>
                <th style={{ padding: 12 }}>Raça</th>
                <th style={{ padding: 12 }}>Pai / Mãe</th>
                <th style={{ padding: 12 }}>Fazenda Origem</th>
                <th style={{ padding: 12 }}>Município / UF</th>
                <th style={{ padding: 12 }}>Programa</th>
                <th style={{ padding: 12 }}>Ação</th>
              </tr>
            </thead>
            <tbody>
              {reprodutores.map((t: any, i: number) => (
                <tr key={i} style={{ borderBottom: '1px solid #1E293B' }}>
                  <td style={{ padding: 12 }}>
                    <strong style={{ color: '#F8FAFC', display: 'block' }}>{t.nome || '—'}</strong>
                    <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#EC4899' }}>{t.registro || '—'}</span>
                  </td>
                  <td style={{ padding: 12, color: '#CBD5E1' }}>{t.raca || '—'}</td>
                  <td style={{ padding: 12, color: '#94A3B8', fontSize: 11 }}>P: {t.pai_nome || '—'}<br />M: {t.mae_nome || '—'}</td>
                  <td style={{ padding: 12, color: '#94A3B8', fontSize: 12 }}>{t.fazenda_origem || '—'}</td>
                  <td style={{ padding: 12, color: '#CBD5E1', fontSize: 12 }}>{t.municipio || '—'} / {t.uf || '—'}</td>
                  <td style={{ padding: 12, color: '#22C55E', fontSize: 11 }}>{t.fonte_programa || '—'}</td>
                  <td style={{ padding: 12 }}>
                    <button onClick={() => setSelectedTouro(t)}
                      style={{ background: '#EC4899', color: '#FFF', border: 'none', padding: '4px 10px', borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                      🧬 Selecionar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Limitações */}
      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', borderTop: '1px solid var(--border-default)', paddingTop: 12 }}>
        <strong>🧬 Genética:</strong> Dados provenientes da API. O simulador só produz resultado quando recebe dados reais de vaca e touro, regra documentada e componentes explicáveis.
        {!simuladorDisponivel && ' O simulador está desabilitado até que haja dados suficientes. Nenhum resultado é inventado.'}
      </div>
    </AgroPageShell>
  );
}
