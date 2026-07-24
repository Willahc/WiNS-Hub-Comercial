import React, { useEffect, useState } from 'react';
import type { Company } from '../types';
import { winsApi } from '../services/api';
import { Search } from 'lucide-react';

export const Empresas: React.FC = () => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('perfil');

  useEffect(() => {
    async function loadData() {
      try {
        const data = await winsApi.getCompanies();
        setCompanies(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const open360 = async (cnpj: string) => {
    const comp = await winsApi.getCompanyByCnpj(cnpj);
    if (comp) {
      setSelectedCompany(comp);
      setActiveTab('perfil');
    }
  };

  const close360 = () => {
    setSelectedCompany(null);
  };

  const filtered = companies.filter(c => 
    c.nome.toLowerCase().includes(search.toLowerCase()) ||
    c.cnpj.includes(search) ||
    c.cidade.toLowerCase().includes(search.toLowerCase())
  );

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'var(--color-success)';
    if (score >= 70) return 'var(--color-warning)';
    return 'var(--color-danger)';
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Carregando empresas...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="screen-header">
        <div>
          <h1>Empresas e Pessoas</h1>
          <p>Base unificada de cadastro e inteligência corporativa</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="topbar-search" style={{ flex: 1, maxWidth: 'none' }}>
            <span className="search-icon"><Search size={16} /></span>
            <input 
              placeholder="Buscar por CNPJ, nome ou cidade..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: '36px' }}
            />
          </div>
          <select style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--color-border-default)', background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)' }}>
            <option>Setor: Todos</option>
            <option>Engenharia</option>
            <option>Saúde</option>
            <option>Agro</option>
            <option>Logística</option>
          </select>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', padding: '4px 0' }}>
          <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
            <strong style={{ color: 'var(--color-text-primary)', fontSize: '18px', marginRight: '4px' }}>
              {filtered.length}
            </strong> 
            empresas encontradas
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Empresa</th>
                <th>CNPJ</th>
                <th>Localização</th>
                <th>Setor</th>
                <th>Receita</th>
                <th>Funcionários</th>
                <th>Status</th>
                <th>Score WiNS</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.cnpj} onClick={() => open360(c.cnpj)}>
                  <td><strong>{c.nome}</strong></td>
                  <td style={{ color: 'var(--color-text-secondary)' }}>{c.cnpj}</td>
                  <td>{c.cidade}, {c.uf}</td>
                  <td>
                    <span className={`badge ${
                      c.setor === 'Construção Civil' ? 'badge-blue' : 
                      c.setor === 'Agroindústria' ? 'badge-green' : 
                      c.setor === 'Saúde' ? 'badge-red' : 'badge-cyan'
                    }`}>
                      {c.setor}
                    </span>
                  </td>
                  <td>{c.receita}</td>
                  <td>{c.funcionarios.toLocaleString()}</td>
                  <td>
                    <span className={`badge ${c.status === 'Ativa' ? 'badge-green' : 'badge-red'}`}>
                      {c.status}
                    </span>
                  </td>
                  <td style={{ color: getScoreColor(c.score), fontWeight: 700 }}>{c.score}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Empresa 360° Modal */}
      {selectedCompany && (
        <div className="modal-overlay" onClick={close360}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div className="empresa-header" style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <div className="topbar-avatar" style={{ width: '48px', height: '48px', fontSize: '18px' }}>
                  {selectedCompany.nome.charAt(0)}
                </div>
                <div>
                  <h2 style={{ fontSize: '18px', fontWeight: 'bold' }}>{selectedCompany.nome}</h2>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '4px' }}>
                    <span>CNPJ: {selectedCompany.cnpj}</span>
                    <span>{selectedCompany.cidade}, {selectedCompany.uf}</span>
                    <span>{selectedCompany.setor}</span>
                  </div>
                </div>
              </div>
              <button 
                onClick={close360} 
                style={{ background: 'none', border: 'none', color: 'var(--color-text-secondary)', fontSize: '20px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {/* Dashboard metrics in modal */}
            <div className="grid-3" style={{ marginBottom: '20px' }}>
              <div className="kpi-card" style={{ padding: '12px' }}>
                <span className="kpi-label">Receita</span>
                <span className="kpi-value" style={{ fontSize: '20px', color: 'var(--color-engenharia)' }}>
                  {selectedCompany.receita}
                </span>
              </div>
              <div className="kpi-card" style={{ padding: '12px' }}>
                <span className="kpi-label">Funcionários</span>
                <span className="kpi-value" style={{ fontSize: '20px', color: 'var(--color-logistica)' }}>
                  {selectedCompany.funcionarios.toLocaleString()}
                </span>
              </div>
              <div className="kpi-card" style={{ padding: '12px' }}>
                <span className="kpi-label">Score WiNS</span>
                <span className="kpi-value" style={{ fontSize: '20px', color: getScoreColor(selectedCompany.score) }}>
                  {selectedCompany.score}%
                </span>
              </div>
            </div>

            {/* Tabs */}
            <div className="tabs">
              <div className={`tab ${activeTab === 'perfil' ? 'active' : ''}`} onClick={() => setActiveTab('perfil')}>Perfil</div>
              <div className={`tab ${activeTab === 'verticais' ? 'active' : ''}`} onClick={() => setActiveTab('verticais')}>Verticais</div>
              <div className={`tab ${activeTab === 'contatos' ? 'active' : ''}`} onClick={() => setActiveTab('contatos')}>Contatos</div>
            </div>

            {/* Tab Contents */}
            {activeTab === 'perfil' && (
              <div style={{ marginTop: '16px' }}>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px', marginBottom: '12px' }}>
                  Empresa com atuação em {selectedCompany.verticais.join(', ')}. Monitoramento de conformidade cadastral e relacionamento contínuo no território brasileiro.
                </p>
                <div style={{ background: 'var(--color-bg-primary)', padding: '12px', borderRadius: '8px', fontSize: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ color: 'var(--color-text-secondary)' }}>Situação Cadastral</span>
                    <span style={{ color: 'var(--color-success)', fontWeight: 'bold' }}>{selectedCompany.status}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ color: 'var(--color-text-secondary)' }}>Porte</span>
                    <span>Grande Empresa</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--color-text-secondary)' }}>Capital Social</span>
                    <span>R$ 500.000.000,00</span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'verticais' && (
              <div style={{ marginTop: '16px' }}>
                <h4 style={{ fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: '8px' }}>
                  Lentes de Impacto Mapeadas
                </h4>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {selectedCompany.verticais.map((v, i) => (
                    <span key={i} className="tag" style={{ fontSize: '12px', padding: '6px 12px' }}>
                      {v}
                    </span>
                  ))}
                </div>
                <p style={{ fontSize: '12px', color: 'var(--color-text-tertiary)', marginTop: '12px' }}>
                  *Dados analíticos e geográficos do CAR, licitações, transportadoras e capacidade de leitos disponíveis no BFF unificado.
                </p>
              </div>
            )}

            {activeTab === 'contatos' && (
              <div style={{ marginTop: '16px' }}>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Nome</th>
                        <th>Cargo</th>
                        <th>E-mail</th>
                        <th>Telefone</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><strong>Carlos Silva</strong></td>
                        <td>CEO</td>
                        <td style={{ color: 'var(--color-text-secondary)' }}>carlos@exemplo.com</td>
                        <td style={{ color: 'var(--color-text-secondary)' }}>(11) 99999-0001</td>
                      </tr>
                      <tr>
                        <td><strong>Ana Oliveira</strong></td>
                        <td>Diretora Comercial</td>
                        <td style={{ color: 'var(--color-text-secondary)' }}>ana@exemplo.com</td>
                        <td style={{ color: 'var(--color-text-secondary)' }}>(11) 99999-0002</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-outline" onClick={close360}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
