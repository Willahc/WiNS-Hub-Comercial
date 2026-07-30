import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { HeartPulse, Search, MapPin, Network, X } from 'lucide-react';
import { realHubService, type SaudeEstabelecimento } from '../services/realHubService';
import {DirectoryLinks} from './RealDirectories';


export const SaudePage: React.FC = () => {
  const [query, setQuery] = useState('');
  const [uf, setUf] = useState('');
  const [healthUnits, setHealthUnits] = useState<SaudeEstabelecimento[]>([]);
  const [totalUnits, setTotalUnits] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await realHubService.getSaudeEstabelecimentos({
        search: query || undefined,
        uf: uf || undefined,
        page_size: 25
      });
      setHealthUnits(res.items);
      setTotalUnits(res.meta.total);
    } catch (err: any) {
      setError(err?.message || 'Falha ao carregar dados reais de Saúde.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [uf]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  return (
    <div className="engineering-page">
      <DirectoryLinks vertical="saude" />
      <div className="wave1-source">
        <span aria-hidden="true">◉</span>
        <b>Dados reais · DATASUS CNES & Capacidade Hospitalar · {totalUnits.toLocaleString('pt-BR')} estabelecimentos cadastrados</b>
        <small>Leitos, infraestrutura assistencial e decisores hospitalares</small>
      </div>

      <div className="screen-header engineering-head">
        <div>
          <div className="eyebrow"><HeartPulse size={14} /> Vertical Oficial · Saúde</div>
          <h1>Inteligência em Saúde Real</h1>
          <p>Estabelecimentos CNES, capacidade assistencial, médicos e decisores autorizados</p>
        </div>
        <div className="screen-actions">
          <Link to="/relacionamentos" className="btn btn-outline"><Network size={14} /> Ver relacionamentos</Link>
        </div>
      </div>

      <div className="works-toolbar">
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.75rem', width: '100%', flexWrap: 'wrap' }}>
          <label className="search-field" style={{ flex: 1 }}>
            <Search size={15} />
            <input
              type="text"
              placeholder="Buscar hospital, CNES, razão social ou município..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <select value={uf} onChange={(e) => setUf(e.target.value)} aria-label="Filtrar por UF">
            <option value="">Todas as UFs</option>
            {['SP', 'MG', 'RJ', 'PR', 'RS', 'BA', 'PE', 'MA', 'GO', 'SC'].map(x => <option key={x} value={x}>{x}</option>)}
          </select>
          <button type="submit" className="btn btn-primary">Buscar</button>
          {(query || uf) && (
            <button type="button" className="btn btn-ghost" onClick={() => { setQuery(''); setUf(''); loadData(); }}>
              <X size={13} /> Limpar
            </button>
          )}
        </form>
      </div>

      {loading && (
        <div className="loading-container">
          <div className="spinner" />
          <p>Consultando base oficial do DATASUS (CNES) e decisores de saúde...</p>
        </div>
      )}

      {error && (
        <div className="empty-state error">
          <HeartPulse size={36} />
          <h3>Erro ao Carregar Dados de Saúde</h3>
          <p>{error}</p>
          <button className="btn btn-primary" onClick={loadData}>Tentar novamente</button>
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="card works-table-card">
            <div className="card-header">
              <div>
                <h3 className="card-title">Estabelecimentos de Saúde (CNES / DATASUS)</h3>
                <p className="card-subtitle">Hospitais, UBS, clínicas e centros de atenção especializada</p>
              </div>
              <span className="metric-chip">{healthUnits.length} de {totalUnits.toLocaleString('pt-BR')} unidades</span>
            </div>
            <div className="table-wrap">
              <table className="works-table">
                <thead>
                  <tr>
                    <th>Nome Fantasia / Razão Social</th>
                    <th>CNES / CNPJ</th>
                    <th>Município / UF</th>
                    <th>Capacidade / SUS</th>
                    <th>Decisor / Diretor</th>
                    <th>Fonte</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {healthUnits.map((item) => (
                    <tr key={item.source_id}>
                      <td>
                        <strong style={{ fontSize: '0.85rem' }}>{item.nome_fantasia || item.razao_social}</strong>
                        <small style={{ color: '#64748b', display: 'block' }}>{item.razao_social}</small>
                      </td>
                      <td>
                        <span style={{ fontFamily: 'monospace' }}>CNES {item.cnes_id}</span>
                        <small style={{ display: 'block' }}>{item.cnpj ? `CNPJ ${item.cnpj}` : 'CNPJ não informado'}</small>
                      </td>
                      <td>
                        <MapPin size={12} style={{ display: 'inline', marginRight: '3px' }} />
                        {item.municipio || 'Não informado'}, {item.uf}
                      </td>
                      <td>
                        {item.tem_internacao ? <span className="badge badge-purple" style={{ marginRight: '4px' }}>Internação</span> : null}
                        {item.tem_cirurgia ? <span className="badge badge-blue" style={{ marginRight: '4px' }}>Cirurgia</span> : null}
                        {!item.tem_internacao && !item.tem_cirurgia ? <span className="value-unavailable">Ambulatorial</span> : null}
                      </td>
                      <td>
                        {item.decisor_nome ? (
                          <div>
                            <strong style={{ fontSize: '0.82rem' }}>{item.decisor_nome}</strong>
                            <small style={{ color: '#64748b', display: 'block' }}>{item.decisor_cargo || 'Diretor / Gestor'}</small>
                          </div>
                        ) : (
                          <span className="value-unavailable">não disponível</span>
                        )}
                      </td>
                      <td><span className="badge badge-green">DATASUS CNES</span></td>
                      <td>
                        <Link to={`/saude/estabelecimentos/${encodeURIComponent(String(item.cnes_id))}`} className="table-open" title="Abrir detalhe CNES">
                          <HeartPulse size={16} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {healthUnits.length === 0 && (
                <div className="empty-state">
                  <HeartPulse size={32} />
                  <h3>Nenhum estabelecimento no recorte</h3>
                  <p>Ajuste a busca ou filtro de estado.</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
