import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Database, Dna, ShieldAlert } from 'lucide-react';
import AgroPageShell from '../components/AgroPageShell';
import { httpClient } from '../services/http/client';

const fmt = (value: unknown) => typeof value === 'number' ? value.toLocaleString('pt-BR') : '—';
const cardStyle: React.CSSProperties = { background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8, padding: 16 };

export default function AgroGeneticaApproved() {
  const [summary, setSummary] = useState<any>(null);
  const [catalog, setCatalog] = useState<any>(null);
  const [traits, setTraits] = useState<any>(null);
  const [readiness, setReadiness] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const results = await Promise.all([
        httpClient.get('/agro/genetica/resumo'),
        httpClient.get('/agro/genetica/reprodutores', { params: { page: 1, page_size: 25 } }),
        httpClient.get('/agro/genetica/caracteristicas'),
        httpClient.get('/agro/genetica/acasalamento/prontidao'),
      ]);
      setSummary(results[0].data); setCatalog(results[1].data);
      setTraits(results[2].data); setReadiness(results[3].data);
    } catch (err: any) {
      setError(err?.userMessage || err?.message || 'Falha ao carregar o contrato genético');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const counts = summary?.counts || {};
  const reprodutores = catalog?.items || [];
  const caracteristicas = traits?.caracteristicas || [];
  const matingAvailable = readiness?.status === 'AVAILABLE' && readiness?.eligible_matrices_count > 0;

  return (
    <AgroPageShell
      title="Genética & Pecuária"
      subtitle="Catálogo, DEPs, pedigree e prontidão de acasalamento com evidência persistida"
      loading={loading} error={error} onRetry={loadData}
    >
      <style>{`
        @media (max-width: 700px) {
          .genetica-catalogo { min-width: 0 !important; }
          .genetica-catalogo th:nth-child(n+4), .genetica-catalogo td:nth-child(n+4) { display: none; }
          .genetica-caracteristicas { min-width: 0 !important; }
          .genetica-caracteristicas th:nth-child(3), .genetica-caracteristicas td:nth-child(3),
          .genetica-caracteristicas th:nth-child(5), .genetica-caracteristicas td:nth-child(5) { display: none; }
        }
      `}</style>
      <div style={{ ...cardStyle, display: 'flex', gap: 12, alignItems: 'flex-start', borderColor: matingAvailable ? '#22C55E55' : '#F59E0B55' }}>
        {matingAvailable ? <Dna size={22} color="#22C55E" /> : <ShieldAlert size={22} color="#F59E0B" />}
        <div>
          <strong style={{ color: '#F8FAFC', display: 'block' }}>Acasalamento: {matingAvailable ? 'AVAILABLE' : 'NOT_CALCULABLE'}</strong>
          <span style={{ color: '#94A3B8', fontSize: 12 }}>
            {matingAvailable
              ? 'Há matriz elegível, DEP real e direção de mérito documentada para triagem.'
              : `Nenhuma das ${fmt(readiness?.matrizes_count)} matrizes cadastradas tem hoje identidade, raça e registros exatos de pai e mãe completos.`}
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        {[
          ['Reprodutores', counts.total_reprodutores, 'mercado.reprodutor'],
          ['Avaliações / DEPs', counts.total_avaliacoes, 'mercado.avaliacao'],
          ['Com avaliação', counts.reprodutores_com_avaliacao, 'reprodutores distintos'],
          ['Características', counts.total_caracteristicas, `${fmt(counts.caracteristicas_densas)} com ≥ 10 mil avaliações`],
          ['Raças com reprodutor', counts.racas_com_reprodutor, `${fmt(counts.total_racas_cadastradas)} cadastradas`],
          ['Pedigree textual completo', counts.com_pedigree_pai_mae, 'pai e mãe declarados; não implica ID resolvido'],
          ['Fêmeas operacionais', counts.femeas_cadastradas, 'base parcial'],
          ['Ofertas de sêmen', counts.ofertas_semen, 'registros persistidos'],
        ].map(([label, value, note]) => (
          <div key={String(label)} style={cardStyle}>
            <span style={{ color: '#94A3B8', fontSize: 11 }}>{label}</span>
            <strong style={{ color: '#F8FAFC', fontSize: 22, display: 'block', margin: '4px 0' }}>{fmt(value)}</strong>
            <small style={{ color: '#64748B' }}>{note}</small>
          </div>
        ))}
      </div>

      <div style={{ ...cardStyle, overflowX: 'auto' }}>
        <h3 style={{ margin: '0 0 12px', color: '#F8FAFC', fontSize: 14 }}><Database size={15} style={{ verticalAlign: 'middle', marginRight: 6 }} />Catálogo real de reprodutores</h3>
        <table className="genetica-catalogo" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 760 }}>
          <thead><tr style={{ color: '#94A3B8', borderBottom: '1px solid #334155' }}><th style={{ padding: 9, textAlign: 'left' }}>RGD / Nome</th><th>Raça</th><th>Pedigree</th><th>DEPs</th><th>Origem</th><th>Localidade</th></tr></thead>
          <tbody>{reprodutores.map((item: any) => <tr key={item.id} style={{ borderBottom: '1px solid #1E293B', color: '#CBD5E1' }}>
            <td style={{ padding: 9 }}><strong style={{ color: '#F8FAFC', display: 'block' }}>{item.nome || '—'}</strong><span style={{ color: '#EC4899' }}>{item.registro || '—'}</span></td>
            <td style={{ textAlign: 'center' }}>{item.raca_nome || '—'}</td><td style={{ textAlign: 'center' }}>{item.pedigree_quality}</td><td style={{ textAlign: 'center' }}>{fmt(item.avaliacoes_count)}</td>
            <td style={{ textAlign: 'center' }}>{item.fonte_programa || '—'}</td><td style={{ textAlign: 'center' }}>{[item.municipio, item.uf].filter(Boolean).join(' / ') || '—'}</td>
          </tr>)}</tbody>
        </table>
      </div>

      <div style={{ ...cardStyle, overflowX: 'auto' }}>
        <h3 style={{ margin: '0 0 12px', color: '#F8FAFC', fontSize: 14 }}>Características e cobertura das avaliações</h3>
        <table className="genetica-caracteristicas" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 700 }}>
          <thead><tr style={{ color: '#94A3B8', borderBottom: '1px solid #334155' }}><th style={{ padding: 9, textAlign: 'left' }}>Característica</th><th>Avaliações</th><th>Reprodutores</th><th>Mediana</th><th>Direção documentada</th></tr></thead>
          <tbody>{caracteristicas.filter((item: any) => item.total_avaliacoes > 0).slice(0, 20).map((item: any) => <tr key={item.id} style={{ borderBottom: '1px solid #1E293B', color: '#CBD5E1' }}>
            <td style={{ padding: 9 }}><strong style={{ color: '#F8FAFC' }}>{item.sigla}</strong> — {item.nome}</td><td style={{ textAlign: 'center' }}>{fmt(item.total_avaliacoes)}</td><td style={{ textAlign: 'center' }}>{fmt(item.total_reprodutores)}</td><td style={{ textAlign: 'center' }}>{item.mediana_valor ?? '—'} {item.unidade || ''}</td><td style={{ textAlign: 'center' }}>{item.selection_direction}</td>
          </tr>)}</tbody>
        </table>
      </div>

      <div style={{ ...cardStyle, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <AlertTriangle size={18} color="#F59E0B" style={{ flexShrink: 0 }} />
        <small style={{ color: '#94A3B8' }}>Pai e mãe textuais são “pedigree imediato declarado”, não árvore genealógica resolvida. A página não calcula coeficiente formal de consanguinidade, prenhez, ganho econômico, ROI ou fenótipo previsto. Null não é convertido em zero. Atualização mais recente informada pelo banco: {summary?.updated_at || 'não disponível'}.</small>
      </div>
    </AgroPageShell>
  );
}
