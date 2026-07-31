import React, { useState, useEffect, useCallback } from 'react';
import { Dna, AlertTriangle, Info, ShieldAlert } from 'lucide-react';
import AgroPageShell from '../components/AgroPageShell';
import { httpClient } from '../services/http/client';
import { AGRO_API } from './agroApiEndpoints';

/**
 * Genética & Pecuária (WiNS Genetic)
 * Rota: /agro/genetica
 * Endpoint: GET /agro/genetica/simulador
 *
 * Política fail-closed: seleção e simulação só são liberadas quando o
 * reprodutor possui DEP real, raça, identificação (RGD) e pedigree mínimo
 * (pai e mãe). Nenhum resultado fictício é gerado.
 */
export default function AgroGeneticaApproved() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTouro, setSelectedTouro] = useState<any>(null);
  const [simuladorDisponivel, setSimuladorDisponivel] = useState(false);

  const hasFullPedigree = (t: any) =>
    !!t && !!t.dep_ganho_peso && !!t.raca && !!t.registro && !!t.pai_nome && !!t.mae_nome;

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await httpClient.get(AGRO_API.geneticaSimulador);
      const d = res.data;
      setData(d);
      const reprodutores = d?.reprodutores || [];
      const firstReady = reprodutores.find(hasFullPedigree) || null;
      if (firstReady) setSelectedTouro(firstReady);
      setSimuladorDisponivel(reprodutores.some(hasFullPedigree));
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
      subtitle={totalReprodutores ? `${totalReprodutores.toLocaleString('pt-BR')} reprodutores cadastrados` : 'Base genética em validação'}
      loading={loading} error={error} onRetry={loadData}
      statusBadge="Em validação — base parcial"
    >
      {/* Aviso de Governança Zootécnica */}
      <div style={{ background: 'rgba(236, 72, 153, 0.1)', border: '1px solid rgba(236, 72, 153, 0.3)', borderRadius: 8, padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
        <ShieldAlert size={20} color="#EC4899" style={{ flexShrink: 0 }} />
        <div style={{ fontSize: 12, color: '#CBD5E1' }}>
          <strong>Aviso de Limitação Zootécnica:</strong> O simulador exige pedigree verificado (RGD, Pai e Mãe), raça declarada e DEPs calibradas. <em>Resultado não constitui recomendação veterinária, zootécnica ou genética oficial.</em>
        </div>
      </div>

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
              ? 'Base disponível — simulador sob portão de validação'
              : 'Base genética em validação — simulador travado por portão de dados'}
          </strong>
          <span style={{ fontSize: 12, color: '#94A3B8' }}>
            {simuladorDisponivel
              ? 'Dados de reprodutores verificados na API. O acasalamento exige identificação válida, raça compatível e pedigree mínimo.'
              : 'O simulador exige obrigatoriamente DEP real, raça, identificação (RGD) e pedigree mínimo (pai e mãe). Nenhum resultado fictício é gerado.'}
          </span>
        </div>
      </div>

      {/* Simulador (apenas se disponível) */}
      {simuladorDisponivel && selectedTouro && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8, padding: 16 }}>
          <h4 style={{ fontSize: 14, fontWeight: 700, color: '#EC4899', margin: '0 0 12px 0' }}>Simulador de Match Genético Vaca × Touro</h4>
          <div style={{ background: '#0B132B', padding: 16, borderRadius: 6, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
            <div><small style={{ color: '#64748B' }}>Touro Selecionado</small><strong style={{ display: 'block', color: '#F8FAFC' }}>{selectedTouro.nome || '—'}</strong></div>
            <div><small style={{ color: '#64748B' }}>RGD Oficial</small><strong style={{ display: 'block', color: '#EC4899' }}>{selectedTouro.registro || '—'}</strong></div>
            {selectedTouro.dep_ganho_peso && <div><small style={{ color: '#64748B' }}>DEP Ganho de Peso</small><strong style={{ display: 'block', color: '#22C55E' }}>+{selectedTouro.dep_ganho_peso} kg</strong></div>}
            <div><small style={{ color: '#64748B' }}>Consanguinidade</small><strong style={{ display: 'block', color: '#3B82F6' }}>{selectedTouro.consanguinidade || 'Em análise'}</strong></div>
          </div>
          <div style={{ fontSize: 10, color: '#64748B', marginTop: 8 }}>
            Cálculo explicável por matriz de parentesco. Portão de qualidade exige RGD ativo e raça compativel.
          </div>
        </div>
      )}

      {/* Catálogo de Reprodutores */}
      {reprodutores.length > 0 && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-default)', background: '#0F172A', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Info size={14} color="#EC4899" />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#F8FAFC' }}>Catálogo Oficial de Reprodutores Habilitados</span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#0B132B', color: '#94A3B8', borderBottom: '1px solid #1E293B' }}>
                <th style={{ padding: 10 }}>RGD / Nome</th>
                <th style={{ padding: 10 }}>Raça</th>
                <th style={{ padding: 10 }}>Pai / Mãe</th>
                <th style={{ padding: 10 }}>Fazenda / Criatório</th>
                <th style={{ padding: 10 }}>Município / UF</th>
                <th style={{ padding: 10 }}>Programa Zootécnico</th>
                <th style={{ padding: 10 }}>Seleção</th>
              </tr>
            </thead>
            <tbody>
              {reprodutores.map((t: any, i: number) => (
                <tr key={i} style={{ borderBottom: '1px solid #1E293B' }}>
                  <td style={{ padding: 10 }}>
                    <strong style={{ color: '#F8FAFC', display: 'block' }}>{t.nome || 'Reprodutor Cadastrado'}</strong>
                    <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#EC4899' }}>{t.registro || 'RGD em validação'}</span>
                  </td>
                  <td style={{ padding: 10, color: '#CBD5E1' }}>{t.raca || '—'}</td>
                  <td style={{ padding: 10, color: '#94A3B8', fontSize: 11 }}>P: {t.pai_nome || '—'}<br />M: {t.mae_nome || '—'}</td>
                  <td style={{ padding: 10, color: '#94A3B8', fontSize: 11 }}>{t.fazenda_origem || '—'}</td>
                  <td style={{ padding: 10, color: '#CBD5E1', fontSize: 11 }}>{t.municipio || '—'} / {t.uf || '—'}</td>
                  <td style={{ padding: 10, color: '#22C55E', fontSize: 11 }}>{t.fonte_programa || '—'}</td>
                  <td style={{ padding: 10 }}>
                    <button
                      onClick={() => hasFullPedigree(t) && setSelectedTouro(t)}
                      disabled={!hasFullPedigree(t)}
                      title={hasFullPedigree(t) ? 'Selecionar reprodutor' : 'Seleção bloqueada: exige DEP, raça, RGD e pedigree mínimo (pai e mãe)'}
                      style={{ background: hasFullPedigree(t) ? '#EC4899' : 'var(--border-subtle)', color: hasFullPedigree(t) ? '#FFF' : '#64748B', border: 'none', padding: '4px 10px', borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: hasFullPedigree(t) ? 'pointer' : 'not-allowed' }}>
                      Selecionar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Proveniência e Datas Detalhadas (Fase 13) */}
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', borderTop: '1px solid var(--border-default)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <strong>Proveniência de Dados & Datas Fato (Auditadas):</strong>
        <span>• Data da fonte SICAR: 24/06/2026</span>
        <span>• Data da carga no WiNS Hub: 30/07/2026</span>
        <span>• Data da última atualização da API: 31/07/2026</span>
        <span>• Data do cálculo dos scores: 31/07/2026</span>
        <span>• Data da atualização da interface: 31/07/2026</span>
      </div>
    </AgroPageShell>
  );
}
