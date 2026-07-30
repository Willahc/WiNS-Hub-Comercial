import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Truck, Search, MapPin, Network, X } from 'lucide-react';
import { realHubService, type LogisticaTransportador } from '../services/realHubService';
import {DirectoryLinks} from './RealDirectories';


export const LogisticaPage: React.FC = () => {
  const [query, setQuery] = useState('');
  const [uf, setUf] = useState('');
  const [carriers, setCarriers] = useState<LogisticaTransportador[]>([]);
  const [totalCarriers, setTotalCarriers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await realHubService.getLogisticaTransportadores({
        search: query || undefined,
        uf: uf || undefined,
        page_size: 25
      });
      setCarriers(res.items);
      setTotalCarriers(res.meta.total);
    } catch (err: any) {
      setError(err?.message || 'Falha ao carregar dados reais de Logística.');
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
      <DirectoryLinks vertical="logistica" />
      <div className="wave1-source" style={{ backgroundColor: 'rgba(234, 179, 8, 0.12)', borderColor: 'rgba(234, 179, 8, 0.4)', color: '#eab308' }}>
        <span aria-hidden="true">⚠️</span>
        <b>DECLARAÇÃO OFICIAL: Diretório logístico homologado; operação transacional indisponível.</b>
        <small>{totalCarriers.toLocaleString('pt-BR')} transportadores no registro nacional ANTT RNTRC. Sem simulação de cargas/viagens.</small>
      </div>

      <div className="screen-header engineering-head">
        <div>
          <div className="eyebrow"><Truck size={14} /> Vertical Oficial · Logística</div>
          <h1>Inteligência Logística Real</h1>
          <p>Operadores de transporte rntrc, polos logísticos, fretes e eficiência de frota</p>
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
              placeholder="Buscar transportador, RNTRC ou município..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <select value={uf} onChange={(e) => setUf(e.target.value)} aria-label="Filtrar por UF">
            <option value="">Todas as UFs</option>
            {['SP', 'MG', 'PR', 'RS', 'SC', 'GO', 'MT', 'RJ', 'BA', 'PE'].map(x => <option key={x} value={x}>{x}</option>)}
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
          <p>Consultando base oficial de transportadores da ANTT (RNTRC)...</p>
        </div>
      )}

      {error && (
        <div className="empty-state error">
          <Truck size={36} />
          <h3>Erro ao Carregar Dados de Logística</h3>
          <p>{error}</p>
          <button className="btn btn-primary" onClick={loadData}>Tentar novamente</button>
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="card works-table-card">
            <div className="card-header">
              <div>
                <h3 className="card-title">Transportadores Rodoferroviários (RNTRC / ANTT)</h3>
                <p className="card-subtitle">Empresas e frotas com registro nacional ativo ou pendente</p>
              </div>
              <span className="metric-chip">{carriers.length} de {totalCarriers.toLocaleString('pt-BR')} transportadores</span>
            </div>
            <div className="table-wrap">
              <table className="works-table">
                <thead>
                  <tr>
                    <th>Razão Social / Nome Fantasia</th>
                    <th>Nº RNTRC</th>
                    <th>Categoria</th>
                    <th>CPF / CNPJ</th>
                    <th>Município / UF</th>
                    <th>Situação ANTT</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {carriers.map((item) => (
                    <tr key={item.source_id}>
                      <td>
                        <strong style={{ fontSize: '0.85rem' }}>{item.nome_transportador}</strong>
                      </td>
                      <td><span style={{ fontFamily: 'monospace' }}>{item.numero_rntrc}</span></td>
                      <td><span className="sector-tag">{item.categoria_transportador || 'ETC'}</span></td>
                      <td>{item.cpfcnpjtransportador || <span className="value-unavailable">não informado</span>}</td>
                      <td>
                        <MapPin size={12} style={{ display: 'inline', marginRight: '3px' }} />
                        {item.municipio}, {item.uf}
                      </td>
                      <td>
                        <span className={`badge ${item.situacao_rntrc === 'ATIVO' ? 'badge-green' : 'badge-orange'}`}>
                          {item.situacao_rntrc || 'ATIVO'}
                        </span>
                      </td>
                      <td>
                        <Link to={`/relacionamentos?municipality=${encodeURIComponent(item.municipio)}&uf=${item.uf}`} className="table-open" title="Ver relacionamentos do município">
                          <Network size={16} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {carriers.length === 0 && (
                <div className="empty-state">
                  <Truck size={32} />
                  <h3>Nenhum transportador no recorte</h3>
                  <p>Ajuste os filtros de busca ou estado.</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
