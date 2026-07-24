import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Network, Search, Building2, HardHat, Truck, Sprout, HeartPulse, ShieldCheck, MapPin, Database, RefreshCw, X } from 'lucide-react';
import { realHubService, type RelationshipGraph, type RelationshipLink } from '../services/realHubService';


export const RelacionamentosPage: React.FC = () => {
  const relationEvidence = (link: RelationshipLink) => (
    <div style={{ marginTop: '0.45rem', fontSize: '0.72rem', color: '#64748b' }}>
      Tipo: {link.relation_type} · Evidência: {link.evidence_type}<br />
      Fonte: {link.source} · Atualização: {link.updated_at || 'não informada'}
    </div>
  );
  const [searchParams] = useSearchParams();

  const initialMun = searchParams.get('municipality') || 'Rondonópolis';
  const initialCnpj = searchParams.get('cnpj') || '';

  const [municipality, setMunicipality] = useState(initialMun);
  const [cnpj, setCnpj] = useState(initialCnpj);
  const [data, setData] = useState<RelationshipGraph | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRelationships = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await realHubService.getRelacionamentos({
        municipality: municipality || undefined,
        cnpj: cnpj || undefined
      });
      setData(res);
    } catch (err: any) {
      setError(err?.message || 'Falha ao carregar matriz de relacionamentos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRelationships();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchRelationships();
  };

  const nodeIcon = (type: string) => {
    switch (type) {
      case 'Obra': return <HardHat size={16} className="icon-work" />;
      case 'Empresa': return <Building2 size={16} className="icon-company" />;
      case 'Transportador RNTRC': return <Truck size={16} className="icon-log" />;
      case 'Imóvel Rural': return <Sprout size={16} className="icon-agro" />;
      case 'Estabelecimento Saúde': return <HeartPulse size={16} className="icon-saude" />;
      default: return <Database size={16} />;
    }
  };

  return (
    <div className="engineering-page">
      <div className="screen-header engineering-head">
        <div>
          <div className="eyebrow"><Network size={14} /> WiNS Hub · Inteligência Transversal</div>
          <h1>Painel Central de Relacionamentos</h1>
          <p>Navegação cruzada real entre Engenharia, Agro, Logística e Saúde por entidade, município e CNPJ</p>
        </div>
      </div>

      <div className="works-toolbar" style={{ marginBottom: '1.5rem' }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.75rem', width: '100%', flexWrap: 'wrap' }}>
          <label className="search-field" style={{ flex: 1, minWidth: '220px' }}>
            <MapPin size={15} />
            <input
              type="text"
              placeholder="Município (ex: Rondonópolis, São Paulo, Estação)..."
              value={municipality}
              onChange={(e) => setMunicipality(e.target.value)}
            />
          </label>
          <label className="search-field" style={{ flex: 1, minWidth: '220px' }}>
            <Building2 size={15} />
            <input
              type="text"
              placeholder="CNPJ (ex: 33000167000101)..."
              value={cnpj}
              onChange={(e) => setCnpj(e.target.value)}
            />
          </label>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? <RefreshCw size={14} className="spin" /> : <Search size={14} />} Consultar Vínculos
          </button>
          {(municipality || cnpj) && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => { setMunicipality(''); setCnpj(''); fetchRelationships(); }}
            >
              <X size={13} /> Limpar
            </button>
          )}
        </form>
      </div>

      {loading && (
        <div className="loading-container">
          <div className="spinner" />
          <p>Cruzando registros reais entre Engenharia, Agro, Logística e Saúde...</p>
        </div>
      )}

      {error && (
        <div className="empty-state error">
          <Network size={36} />
          <h3>Erro na Consulta Relacional</h3>
          <p>{error}</p>
          <button className="btn btn-primary" onClick={fetchRelationships}>Tentar novamente</button>
        </div>
      )}

      {!loading && !error && data && (
        <>
          <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShieldCheck size={18} color="#22c55e" />
              Matriz de Relacionamentos Transversais ({data.nodes.length} Entidades Identificadas)
            </h3>
            <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '1rem' }}>
              Registros recuperados diretamente dos bancos de dados reais. Cada vínculo possui procedência e nível de confiança auditável.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
              {data.nodes.length > 0 ? (
                data.nodes.map((node) => (
                  <div key={node.id} className="card" style={{ padding: '0.9rem', borderLeft: '3px solid #3b82f6', background: '#fafafa' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                      <span className="badge badge-blue" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        {nodeIcon(node.type)} {node.type}
                      </span>
                      <small style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{node.source.split('.').pop()}</small>
                    </div>
                    <strong style={{ fontSize: '0.92rem', display: 'block', marginBottom: '0.2rem', color: '#0f172a' }}>
                      {node.label}
                    </strong>
                    <small style={{ color: '#64748b', display: 'block', fontSize: '0.78rem' }}>{node.sub}</small>
                    <div style={{ marginTop: '0.6rem', borderTop: '1px solid #e2e8f0', paddingTop: '0.4rem', fontSize: '0.72rem', color: '#94a3b8' }}>
                      Fonte: {node.source}
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
                  <Network size={32} />
                  <h3>sem vínculo identificado</h3>
                  <p>Nenhuma entidade cruzada encontrada para os filtros aplicados.</p>
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
            <div className="card" style={{ padding: '1.25rem' }}>
              <div className="card-header">
                <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <HardHat size={16} color="#3b82f6" /> <Truck size={16} color="#06b6d4" /> ENGENHARIA ↔ LOGÍSTICA
                </h3>
              </div>
              {data.crossVerticalSummary.engenharia_logistica.length > 0 ? (
                data.crossVerticalSummary.engenharia_logistica.map((link, i) => (
                  <div key={i} style={{ padding: '0.75rem', background: '#f8fafc', borderRadius: '6px', marginBottom: '0.5rem' }}>
                    <span className="badge badge-amber" style={{ fontSize: '0.7rem', marginBottom: '0.3rem' }}>{link.confidence}</span>
                    <strong style={{ display: 'block', fontSize: '0.88rem' }}>{link.title}</strong>
                    <p style={{ fontSize: '0.82rem', color: '#475569', margin: '0.3rem 0' }}>{link.detail}</p>
                    {relationEvidence(link)}
                  </div>
                ))
              ) : (
                <div style={{ color: '#94a3b8', fontStyle: 'italic', padding: '1rem 0' }}>sem vínculo identificado</div>
              )}
            </div>

            <div className="card" style={{ padding: '1.25rem' }}>
              <div className="card-header">
                <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <HardHat size={16} color="#3b82f6" /> <Sprout size={16} color="#22c55e" /> ENGENHARIA ↔ AGRO
                </h3>
              </div>
              {data.crossVerticalSummary.engenharia_agro.length > 0 ? (
                data.crossVerticalSummary.engenharia_agro.map((link, i) => (
                  <div key={i} style={{ padding: '0.75rem', background: '#f8fafc', borderRadius: '6px', marginBottom: '0.5rem' }}>
                    <span className="badge badge-amber" style={{ fontSize: '0.7rem', marginBottom: '0.3rem' }}>{link.confidence}</span>
                    <strong style={{ display: 'block', fontSize: '0.88rem' }}>{link.title}</strong>
                    <p style={{ fontSize: '0.82rem', color: '#475569', margin: '0.3rem 0' }}>{link.detail}</p>
                    {relationEvidence(link)}
                  </div>
                ))
              ) : (
                <div style={{ color: '#94a3b8', fontStyle: 'italic', padding: '1rem 0' }}>sem vínculo identificado</div>
              )}
            </div>

            <div className="card" style={{ padding: '1.25rem' }}>
              <div className="card-header">
                <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Sprout size={16} color="#22c55e" /> <Truck size={16} color="#06b6d4" /> AGRO ↔ LOGÍSTICA
                </h3>
              </div>
              {data.crossVerticalSummary.agro_logistica.length > 0 ? (
                data.crossVerticalSummary.agro_logistica.map((link, i) => (
                  <div key={i} style={{ padding: '0.75rem', background: '#f8fafc', borderRadius: '6px', marginBottom: '0.5rem' }}>
                    <span className="badge badge-amber" style={{ fontSize: '0.7rem', marginBottom: '0.3rem' }}>{link.confidence}</span>
                    <strong style={{ display: 'block', fontSize: '0.88rem' }}>{link.title}</strong>
                    <p style={{ fontSize: '0.82rem', color: '#475569', margin: '0.3rem 0' }}>{link.detail}</p>
                    {relationEvidence(link)}
                  </div>
                ))
              ) : (
                <div style={{ color: '#94a3b8', fontStyle: 'italic', padding: '1rem 0' }}>sem vínculo identificado</div>
              )}
            </div>

            <div className="card" style={{ padding: '1.25rem' }}>
              <div className="card-header">
                <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Sprout size={16} color="#22c55e" /> <HeartPulse size={16} color="#ef4444" /> AGRO ↔ SAÚDE
                </h3>
              </div>
              {data.crossVerticalSummary.agro_saude.length > 0 ? (
                data.crossVerticalSummary.agro_saude.map((link, i) => (
                  <div key={i} style={{ padding: '0.75rem', background: '#f8fafc', borderRadius: '6px', marginBottom: '0.5rem' }}>
                    <span className="badge badge-amber" style={{ fontSize: '0.7rem', marginBottom: '0.3rem' }}>{link.confidence}</span>
                    <strong style={{ display: 'block', fontSize: '0.88rem' }}>{link.title}</strong>
                    <p style={{ fontSize: '0.82rem', color: '#475569', margin: '0.3rem 0' }}>{link.detail}</p>
                    {relationEvidence(link)}
                  </div>
                ))
              ) : (
                <div style={{ color: '#94a3b8', fontStyle: 'italic', padding: '1rem 0' }}>sem vínculo identificado</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
