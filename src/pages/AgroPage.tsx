import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sprout, Search, MapPin, Network, X } from 'lucide-react';
import { realHubService, type AgroImovel, type AgroTecnico } from '../services/realHubService';
import {DirectoryLinks} from './RealDirectories';


export const AgroPage: React.FC = () => {
  const [query, setQuery] = useState('');
  const [uf, setUf] = useState('');
  const [imoveis, setImoveis] = useState<AgroImovel[]>([]);
  const [tecnicos, setTecnicos] = useState<AgroTecnico[]>([]);
  const [veterinaria, setVeterinaria] = useState<any>(null);
  const [totalImoveis, setTotalImoveis] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [resImoveis, resTecnicos, resVeterinaria] = await Promise.all([
        realHubService.getAgroImoveis({ search: query || undefined, uf: uf || undefined, page_size: 20 }),
        realHubService.getAgroTecnicos({ search: query || undefined, uf: uf || undefined, page_size: 15 }),
        realHubService.getAgroVeterinariaClassificacao()
      ]);
      setImoveis(resImoveis.items);
      setTotalImoveis(resImoveis.meta.total);
      setTecnicos(resTecnicos.items);
      setVeterinaria(resVeterinaria);
    } catch (err: any) {
      setError(err?.message || 'Falha ao carregar dados reais do Agro.');
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
      <DirectoryLinks vertical="agro" />
      <div className="wave1-source">
        <span aria-hidden="true">◉</span>
        <b>Dados reais · SICAR / CAR & CREA · {totalImoveis.toLocaleString('pt-BR')} imóveis no cadastro</b>
        <small>Atualização contínua de inteligência agropastoril</small>
      </div>

      <div className="screen-header engineering-head">
        <div>
          <div className="eyebrow"><Sprout size={14} /> Vertical Oficial · Agro</div>
          <h1>Inteligência Agro Real</h1>
          <p>Imóveis rurais, produtores e profissionais técnicos com registro informado pela fonte</p>
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
              placeholder="Buscar por CAR, imóvel, proprietário ou município..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <select value={uf} onChange={(e) => setUf(e.target.value)} aria-label="Filtrar por UF">
            <option value="">Todas as UFs</option>
            {['MT', 'SP', 'GO', 'MS', 'MG', 'PR', 'RS', 'PA', 'BA', 'RN'].map(x => <option key={x} value={x}>{x}</option>)}
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
          <p>Consultando base do CAR e registros do CREA...</p>
        </div>
      )}

      {error && (
        <div className="empty-state error">
          <Sprout size={36} />
          <h3>Erro ao Carregar Dados do Agro</h3>
          <p>{error}</p>
          <button className="btn btn-primary" onClick={loadData}>Tentar novamente</button>
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="screen-actions" style={{ marginBottom: '1rem' }}><Link className="btn btn-outline" to="/agro/reprodutores/CXP0272">Ficha de reprodutor</Link><Link className="btn btn-outline" to="/agro/doadoras">Doadoras</Link><Link className="btn btn-outline" to="/agro/embrioes">Embriões</Link></div>
          <div className="card works-table-card" style={{ marginBottom: '2rem' }}>
            <div className="card-header">
              <div>
                <h3 className="card-title">Imóveis Rurais Cadastrados (CAR)</h3>
                <p className="card-subtitle">Propriedades georreferenciadas na base oficial</p>
              </div>
              <span className="metric-chip">{imoveis.length} de {totalImoveis.toLocaleString('pt-BR')} imóveis</span>
            </div>
            <div className="table-wrap">
              <table className="works-table">
                <thead>
                  <tr>
                    <th>Código CAR / Imóvel</th>
                    <th>Proprietário / CPF-CNPJ</th>
                    <th>Município / UF</th>
                    <th>Área Total</th>
                    <th>Área de Pasto</th>
                    <th>Fonte</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {imoveis.map((item) => (
                    <tr key={item.source_id}>
                      <td>
                        <strong style={{ fontSize: '0.85rem' }}>{item.nome_imovel || `CAR ${item.codigo_car.slice(0, 22)}...`}</strong>
                        <small style={{ fontFamily: 'monospace', display: 'block', color: '#64748b' }}>{item.codigo_car}</small>
                      </td>
                      <td>
                        {item.nome_proprietario || <span className="value-unavailable">não disponível</span>}
                        <small>{item.cpf_cnpj || 'CPF/CNPJ não informado'}</small>
                      </td>
                      <td>
                        <MapPin size={12} style={{ display: 'inline', marginRight: '3px' }} />
                        {item.municipio}, {item.uf}
                      </td>
                      <td><strong>{item.area_total_ha != null ? `${Number(item.area_total_ha).toLocaleString('pt-BR')} ha` : <span className="value-unavailable">não homologado</span>}</strong></td>
                      <td>{item.area_pasto_ha != null ? `${Number(item.area_pasto_ha).toLocaleString('pt-BR')} ha` : <span className="value-unavailable">não disponível</span>}</td>
                      <td><span className="badge badge-green">{item.fonte_principal}</span></td>
                      <td>
                        <Link to={`/agro/imoveis/${encodeURIComponent(item.source_id)}`} className="table-open" title="Abrir detalhe do imóvel">
                          <Sprout size={16} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {imoveis.length === 0 && (
                <div className="empty-state">
                  <Sprout size={32} />
                  <h3>Sem imóveis rurais no recorte</h3>
                  <p>Ajuste o termo de busca ou o filtro por estado.</p>
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div>
                <h3 className="card-title">Profissionais técnicos com registro informado</h3>
                <p className="card-subtitle">Pessoas físicas do cadastro CREA; não classifica CRMV sem número, UF, situação, título e fonte profissional</p>
              </div>
              <span className="metric-chip">{tecnicos.length} profissionais</span>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Nome do Profissional</th>
                    <th>Título / Especialidade</th>
                    <th>Registro CREA</th>
                    <th>Município / UF</th>
                    <th>Situação</th>
                    <th>Fonte</th>
                  </tr>
                </thead>
                <tbody>
                  {tecnicos.map((t) => (
                    <tr key={t.source_id}>
                      <td><strong>{t.nome}</strong></td>
                      <td>{t.titulo || <span className="value-unavailable">título não informado</span>}</td>
                      <td>{t.registro_crea || <span className="value-unavailable">não informado</span>}</td>
                      <td>{t.municipio}, {t.uf}</td>
                      <td>{t.situacao ? <span className="badge badge-blue">{t.situacao}</span> : <span className="value-unavailable">situação não informada</span>}</td>
                      <td><small style={{ color: '#64748b' }}>{t.fonte || 'wins_agro.tecnico_crea'}</small></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {veterinaria && <div className="card" data-testid="veterinaria-classificacao" style={{ marginTop: '1rem' }}><div className="card-header"><div><h3 className="card-title">Classificação veterinária por natureza do registro</h3><p className="card-subtitle">Empresas não são convertidas em profissionais; ausência de situação oficial do conselho impede declarar CRMV ativo.</p></div></div><div className="engineering-kpi-grid">{veterinaria.categories.map((x:any) => <div className="card" key={x.category} style={{ padding: '1rem' }}><small>{x.table}</small><strong style={{ display: 'block' }}>{x.category}</strong><span>{Number(x.count).toLocaleString('pt-BR')} · {x.confidence}</span></div>)}</div><div className="table-wrap"><table><thead><tr><th>CNPJ</th><th>Razão social</th><th>CNAE</th><th>Município/UF</th><th>Tipo</th><th>Fonte/Atualização</th></tr></thead><tbody>{veterinaria.companies.map((x:any) => <tr key={x.cnpj}><td>{x.cnpj}</td><td>{x.razao_social}</td><td>{x.cnae}</td><td>{x.municipio}/{x.uf}</td><td>{x.tipo_entidade}</td><td>{x.fonte} · {x.atualizacao || 'não informada'}</td></tr>)}</tbody></table></div></div>}
        </>
      )}
    </div>
  );
};
