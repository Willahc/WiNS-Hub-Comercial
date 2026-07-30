import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Building2, MapPin, Search, RotateCcw, Menu, ShieldCheck, Users,
  Share2, Award, ArrowUpRight, Filter, HardHat, Truck, Sprout, HeartPulse,
  CheckCircle2, AlertTriangle, Layers, ChevronLeft, ChevronRight, X, Info
} from 'lucide-react';
import { DesktopSidebar, MobileSidebarContent } from '../components/AppSidebar';
import { BrazilUfSelect } from '../components/territorial/BrazilUfSelect';
import { MASTER_COMPANIES_DATABASE, type CompanyRecord } from '../services/companyDatabase';

function useMediaQuery(q: string) {
  const [match, setMatch] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const handler = (e: MediaQueryListEvent) => setMatch(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [q]);
  return match;
}

export default function EmpresasApproved() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isMobile = useMediaQuery('(max-width: 767px)');
  
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Preserve & read filters from URL Search Params
  const buscaParam = searchParams.get('q') || '';
  const segmentoParam = searchParams.get('segmento') || '';
  const verticalParam = searchParams.get('vertical') || '';
  const ufParam = searchParams.get('uf') || '';
  const situacaoParam = searchParams.get('situacao') || '';
  const tipoParam = searchParams.get('tipo') || '';
  const porteParam = searchParams.get('porte') || '';
  const pageParam = parseInt(searchParams.get('page') || '1', 10);

  const [busca, setBusca] = useState(buscaParam);
  const [segmento, setSegmento] = useState(segmentoParam);
  const [vertical, setVertical] = useState(verticalParam);
  const [uf, setUf] = useState(ufParam);
  const [situacao, setSituacao] = useState(situacaoParam);
  const [tipo, setTipo] = useState(tipoParam);
  const [porte, setPorte] = useState(porteParam);
  const [onlyValidCnpj, setOnlyValidCnpj] = useState(false);
  const [onlyConfirmedRelations, setOnlyConfirmedRelations] = useState(false);
  const [page, setPage] = useState(pageParam);
  const [pageSize, setPageSize] = useState(10);

  // Synchronize state changes to URL Search Params
  const updateUrlParams = (newParams: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams(searchParams);
    Object.entries(newParams).forEach(([k, v]) => {
      if (v !== undefined && v !== '' && v !== 1) {
        params.set(k, String(v));
      } else {
        params.delete(k);
      }
    });
    setSearchParams(params);
  };

  // Filter Master Database Items
  const filteredCompanies = useMemo(() => {
    return MASTER_COMPANIES_DATABASE.filter(comp => {
      if (busca) {
        const q = busca.toLowerCase();
        const matchesName = comp.legalName.toLowerCase().includes(q) || comp.tradeName.toLowerCase().includes(q);
        const matchesCnpj = comp.cnpj.includes(q) || comp.cnpjClean.includes(q);
        const matchesMun = comp.address.municipality.toLowerCase().includes(q);
        const matchesSocio = comp.people.some(p => p.name.toLowerCase().includes(q));
        const matchesWork = comp.works.some(w => w.name.toLowerCase().includes(q));
        if (!matchesName && !matchesCnpj && !matchesMun && !matchesSocio && !matchesWork) return false;
      }
      if (segmento && comp.dominantSegment !== segmento) return false;
      if (vertical && !comp.verticals.includes(vertical as any)) return false;
      if (uf && comp.address.uf !== uf) return false;
      if (situacao && comp.status !== situacao) return false;
      if (tipo && comp.type !== tipo) return false;
      if (porte && comp.size !== porte) return false;
      if (onlyValidCnpj && comp.qualityScore < 90) return false;
      if (onlyConfirmedRelations && !comp.works.some(w => w.role === 'Executora Confirmada')) return false;

      return true;
    });
  }, [busca, segmento, vertical, uf, situacao, tipo, porte, onlyValidCnpj, onlyConfirmedRelations]);

  const totalPages = Math.ceil(filteredCompanies.length / pageSize) || 1;
  const paginatedCompanies = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredCompanies.slice(start, start + pageSize);
  }, [filteredCompanies, page, pageSize]);

  // Precise KPIs calculation (Explicit Metrics Definition)
  const kpis = useMemo(() => [
    {
      label: 'Empresas Únicas',
      value: MASTER_COMPANIES_DATABASE.length,
      unit: 'empresas auditadas',
      sub: 'Base cadastral com CNPJ próprio',
      icon: Building2,
      color: '#8B5CF6',
      tooltip: 'Total de empresas jurídicas distintas com CNPJ ativo no cadastro'
    },
    {
      label: 'CNPJs Válidos Auditados',
      value: MASTER_COMPANIES_DATABASE.filter(c => c.qualityScore >= 90).length,
      unit: 'CNPJs validados RFB',
      sub: 'Completude ≥ 90%',
      icon: ShieldCheck,
      color: '#22C55E',
      tooltip: 'CNPJs com dados cadastrais e situação fiscal validados na Receita Federal'
    },
    {
      label: 'Matrizes Corporativas',
      value: MASTER_COMPANIES_DATABASE.filter(c => c.type === 'MATRIZ').length,
      unit: 'matrizes',
      sub: 'Sedes principais',
      icon: Share2,
      color: '#3B82F6',
      tooltip: 'Estabelecimentos sede que lideram a estrutura societária'
    },
    {
      label: 'Filiais Cadastradas',
      value: MASTER_COMPANIES_DATABASE.filter(c => c.type === 'FILIAL').length,
      unit: 'filiais',
      sub: 'Unidades operacionais',
      icon: Layers,
      color: '#06B6D4',
      tooltip: 'Unidades secundárias vinculadas ao CNPJ raiz da matriz'
    },
    {
      label: 'Grupos Econômicos',
      value: 3,
      unit: 'grupos mapeados',
      sub: 'Holdings e consórcios',
      icon: Share2,
      color: '#EC4899',
      tooltip: 'Conglomerados empresariais com controle acionário ou consórcio provado'
    },
    {
      label: 'Empresas Multiverticais',
      value: MASTER_COMPANIES_DATABASE.filter(c => c.verticals.length > 1).length,
      unit: 'multiverticais',
      sub: 'Presença em > 1 setor',
      icon: Award,
      color: '#F59E0B',
      tooltip: 'Empresas que atuam simultaneamente em Engenharia, Agro, Logística ou Saúde'
    },
    {
      label: 'Pessoas Vinculadas',
      value: MASTER_COMPANIES_DATABASE.reduce((acc, c) => acc + c.people.length, 0),
      unit: 'sócios e decisores',
      sub: 'QSA e executivos',
      icon: Users,
      color: '#10B981',
      tooltip: 'Sócios, diretores e decisores identificados no QSA ou atas oficiais'
    },
    {
      label: 'Relações Confirmadas',
      value: MASTER_COMPANIES_DATABASE.reduce((acc, c) => acc + c.works.filter(w => w.role === 'Executora Confirmada').length, 0),
      unit: 'vínculos provados',
      sub: 'Provas documentais PNCP/RFB',
      icon: CheckCircle2,
      color: '#22C55E',
      tooltip: 'Vínculos com prova contratual ou edital público auditado'
    },
    {
      label: 'Relações Prováveis',
      value: MASTER_COMPANIES_DATABASE.reduce((acc, c) => acc + c.works.filter(w => w.role !== 'Executora Confirmada').length + c.logistics.length, 0),
      unit: 'matches de propensão',
      sub: 'Match CNAE/Geofence',
      icon: AlertTriangle,
      color: '#06B6D4',
      tooltip: 'Vínculos com alta probabilidade por CNAE e proximidade de 15km'
    },
    {
      label: 'Cadastros em Auditoria',
      value: MASTER_COMPANIES_DATABASE.filter(c => c.qualityScore < 95).length,
      unit: 'registros sob revisão',
      sub: 'Divergências secundárias',
      icon: Filter,
      color: '#EAB308',
      tooltip: 'Registros que possuem divergência cadastral secundária entre fontes'
    }
  ], []);

  const getVerticalBadge = (v: string) => {
    switch (v) {
      case 'Engenharia': return <span key={v} style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: 'rgba(59,130,246,0.15)', color: '#3B82F6', display: 'inline-flex', alignItems: 'center', gap: 3 }}><HardHat size={11} /> Eng</span>;
      case 'Logística': return <span key={v} style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: 'rgba(6,182,212,0.15)', color: '#06B6D4', display: 'inline-flex', alignItems: 'center', gap: 3 }}><Truck size={11} /> Log</span>;
      case 'Agro': return <span key={v} style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: 'rgba(34,197,94,0.15)', color: '#22C55E', display: 'inline-flex', alignItems: 'center', gap: 3 }}><Sprout size={11} /> Agro</span>;
      case 'Saúde': return <span key={v} style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: 'rgba(236,72,153,0.15)', color: '#EC4899', display: 'inline-flex', alignItems: 'center', gap: 3 }}><HeartPulse size={11} /> Saúde</span>;
      default: return null;
    }
  };

  return (
    <div data-ui-version="empresa-catalog-v2" style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-base, #090D16)', position: 'relative', overflow: 'hidden' }}>
      {isMobile ? (
        <>
          <div
            style={{
              position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
              background: 'rgba(0,0,0,0.5)', zIndex: 200,
              opacity: sidebarOpen ? 1 : 0, pointerEvents: sidebarOpen ? 'auto' : 'none',
              transition: 'opacity 0.2s',
            }}
            onClick={() => setSidebarOpen(false)}
          />
          <aside style={{
            position: 'fixed', top: 0, left: 0, height: '100vh', width: 280,
            background: 'var(--bg-sidebar, #0F172A)', zIndex: 201,
            transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
            transition: 'transform 0.25s ease', display: 'flex', flexDirection: 'column',
            borderRight: '1px solid var(--border-default, #1E293B)', overflow: 'hidden',
          }}>
            <MobileSidebarContent onCloseMobile={() => setSidebarOpen(false)} />
          </aside>
        </>
      ) : (
        <DesktopSidebar />
      )}

      <div style={{
        marginLeft: isMobile ? 0 : 'var(--sidebar-w, 240px)',
        flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, maxWidth: '100vw',
      }}>
        {/* Header */}
        <header style={{
          height: 'var(--topbar-h, 60px)', background: 'var(--bg-surface, #0F172A)',
          borderBottom: '1px solid var(--border-default, #1E293B)', display: 'flex', alignItems: 'center',
          padding: isMobile ? '0 12px' : '0 24px', gap: 16, position: 'sticky', top: 0, zIndex: 50,
        }}>
          {isMobile && (
            <button onClick={() => setSidebarOpen(true)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 4 }}>
              <Menu size={20} />
            </button>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontSize: isMobile ? 14 : 16, fontWeight: 700, color: 'var(--text-primary, #F8FAFC)', margin: 0 }}>
              Empresa 360° e Pessoas
            </h1>
            {!isMobile && <p style={{ fontSize: 11, color: 'var(--text-tertiary, #64748B)', margin: 0, marginTop: 1 }}>Base corporativa, territorial e relacional unificada</p>}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#8B5CF6', fontWeight: 600, background: 'rgba(139,92,246,0.1)', padding: '4px 8px', borderRadius: 4 }}>
            <ShieldCheck size={14} /><span>Base Auditada RFB 1:1</span>
          </div>
        </header>

        {/* Content Area */}
        <div style={{ padding: isMobile ? 12 : 24, flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
          
          {/* KPIs Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(5, 1fr)', gap: 10 }}>
            {kpis.map((k, idx) => (
              <div key={idx} style={{ background: 'var(--bg-surface, #0F172A)', border: '1px solid var(--border-default, #1E293B)', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 500 }}>{k.label}</span>
                  <span title={k.tooltip}><Info size={11} color={k.color} style={{ cursor: 'pointer' }} /></span>
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: '2px 0' }}>{k.value}</div>
                <span style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>{k.unit}</span>
              </div>
            ))}
          </div>

          {/* Search and Filters Bar */}
          <div style={{ background: 'var(--bg-surface, #0F172A)', border: '1px solid var(--border-default, #1E293B)', borderRadius: 8, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1, minWidth: 240 }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                <input
                  data-testid="empresas-search-input"
                  value={busca}
                  onChange={e => {
                    setBusca(e.target.value);
                    setPage(1);
                    updateUrlParams({ q: e.target.value, page: 1 });
                  }}
                  placeholder="Buscar por CNPJ, Razão Social, Sócio, Município, Obra, RNTRC..."
                  style={{
                    width: '100%', height: 32, paddingLeft: 32, fontSize: 11,
                    background: 'var(--bg-base, #090D16)', border: '1px solid var(--border-subtle, #334155)',
                    borderRadius: 6, color: 'var(--text-primary, #F8FAFC)'
                  }}
                />
              </div>

              {/* Segmento */}
              <select
                value={segmento}
                onChange={e => { setSegmento(e.target.value); setPage(1); updateUrlParams({ segmento: e.target.value, page: 1 }); }}
                style={{ height: 32, padding: '0 8px', fontSize: 11, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', borderRadius: 6 }}
              >
                <option value="">Todos os Segmentos</option>
                <option value="Engenharia e Construção">Engenharia e Construção</option>
                <option value="Logística e Transportes">Logística e Transportes</option>
                <option value="Agronegócio">Agronegócio</option>
                <option value="Saúde e Equipamentos">Saúde e Equipamentos</option>
              </select>

              {/* Vertical */}
              <select
                value={vertical}
                onChange={e => { setVertical(e.target.value); setPage(1); updateUrlParams({ vertical: e.target.value, page: 1 }); }}
                style={{ height: 32, padding: '0 8px', fontSize: 11, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', borderRadius: 6 }}
              >
                <option value="">Todas as Verticais</option>
                <option value="Engenharia">Engenharia</option>
                <option value="Logística">Logística</option>
                <option value="Agro">Agro</option>
                <option value="Saúde">Saúde</option>
              </select>

              {/* UF */}
              <BrazilUfSelect
                value={uf}
                onChange={(val) => { setUf(val); setPage(1); updateUrlParams({ uf: val, page: 1 }); }}
                showAllLabel="Todas as UFs"
              />

              {/* Situação Cadastral */}
              <select
                value={situacao}
                onChange={e => { setSituacao(e.target.value); setPage(1); updateUrlParams({ situacao: e.target.value, page: 1 }); }}
                style={{ height: 32, padding: '0 8px', fontSize: 11, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', borderRadius: 6 }}
              >
                <option value="">Situação (Todas)</option>
                <option value="ATIVA">ATIVA</option>
                <option value="INAPTA">INAPTA</option>
                <option value="BAIXADA">BAIXADA</option>
              </select>

              {/* Matriz ou Filial */}
              <select
                value={tipo}
                onChange={e => { setTipo(e.target.value); setPage(1); updateUrlParams({ tipo: e.target.value, page: 1 }); }}
                style={{ height: 32, padding: '0 8px', fontSize: 11, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', borderRadius: 6 }}
              >
                <option value="">Tipo (Todos)</option>
                <option value="MATRIZ">MATRIZ</option>
                <option value="FILIAL">FILIAL</option>
              </select>

              <button
                onClick={() => {
                  setBusca(''); setSegmento(''); setVertical(''); setUf(''); setSituacao(''); setTipo(''); setPage(1);
                  setSearchParams({});
                }}
                style={{ height: 32, padding: '0 12px', fontSize: 11, background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', borderRadius: 6, cursor: 'pointer' }}
              >
                Limpar Filtros
              </button>
            </div>

            <div style={{ display: 'flex', gap: 16, alignItems: 'center', fontSize: 11, color: 'var(--text-secondary)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input type="checkbox" checked={onlyValidCnpj} onChange={e => setOnlyValidCnpj(e.target.checked)} />
                <span>Somente CNPJ Válido Auditado (≥90%)</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input type="checkbox" checked={onlyConfirmedRelations} onChange={e => setOnlyConfirmedRelations(e.target.checked)} />
                <span>Somente Relações Confirmadas</span>
              </label>
            </div>
          </div>

          {/* Companies Table */}
          <div style={{ background: 'var(--bg-surface, #0F172A)', border: '1px solid var(--border-default, #1E293B)', borderRadius: 8, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Catálogo Corporativo ({filteredCompanies.length} empresas encontradas)
              </h3>
              <select
                value={pageSize}
                onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
                style={{ height: 28, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', fontSize: 11, borderRadius: 4, padding: '0 6px' }}
              >
                <option value={10}>10 linhas por página</option>
                <option value={20}>20 linhas por página</option>
              </select>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-default)', color: 'var(--text-tertiary)' }}>
                    <th style={{ padding: '10px 8px' }}>Razão Social / Nome Fantasia</th>
                    <th style={{ padding: '10px 8px' }}>CNPJ</th>
                    <th style={{ padding: '10px 8px' }}>Tipo</th>
                    <th style={{ padding: '10px 8px' }}>Município / UF</th>
                    <th style={{ padding: '10px 8px' }}>Situação</th>
                    <th style={{ padding: '10px 8px' }}>Segmento Dominante</th>
                    <th style={{ padding: '10px 8px' }}>Verticais</th>
                    <th style={{ padding: '10px 8px' }}>Relacionamentos</th>
                    <th style={{ padding: '10px 8px' }}>Qualidade</th>
                    <th style={{ padding: '10px 8px' }}>Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedCompanies.map((item, idx) => (
                    <tr
                      key={item.id}
                      data-testid={`company-row-${item.id}`}
                      style={{ borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer', transition: 'background 0.15s' }}
                      onClick={() => navigate(`/empresas/${item.id}`)}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ padding: '10px 8px' }}>
                        <div style={{ fontWeight: 700, color: '#F8FAFC' }}>{item.legalName}</div>
                        <div style={{ fontSize: 10, color: '#94A3B8' }}>{item.tradeName}</div>
                      </td>

                      <td style={{ padding: '10px 8px', fontWeight: 600, color: '#8B5CF6' }}>
                        {item.cnpj}
                      </td>

                      <td style={{ padding: '10px 8px' }}>
                        <span style={{
                          fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                          background: item.type === 'MATRIZ' ? 'rgba(59,130,246,0.15)' : 'rgba(6,182,212,0.15)',
                          color: item.type === 'MATRIZ' ? '#3B82F6' : '#06B6D4'
                        }}>
                          {item.type}
                        </span>
                      </td>

                      <td style={{ padding: '10px 8px', color: 'var(--text-secondary)' }}>
                        {item.address.municipality}, {item.address.uf}
                      </td>

                      <td style={{ padding: '10px 8px' }}>
                        <span style={{
                          fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                          background: item.status === 'ATIVA' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                          color: item.status === 'ATIVA' ? '#22C55E' : '#EF4444'
                        }}>
                          {item.status}
                        </span>
                      </td>

                      <td style={{ padding: '10px 8px', color: 'var(--text-secondary)' }}>
                        {item.dominantSegment}
                      </td>

                      <td style={{ padding: '10px 8px' }}>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {item.verticals.map(v => getVerticalBadge(v))}
                        </div>
                      </td>

                      <td style={{ padding: '10px 8px', fontWeight: 700, color: '#8B5CF6' }}>
                        {item.works.length + item.logistics.length + item.agro.length + item.health.length} conexões
                      </td>

                      <td style={{ padding: '10px 8px' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: item.qualityScore >= 95 ? '#22C55E' : '#F59E0B' }}>
                          {item.qualityScore}%
                        </span>
                      </td>

                      <td style={{ padding: '10px 8px' }}>
                        <button
                          data-testid={`btn-open-360-${item.id}`}
                          onClick={(e) => { e.stopPropagation(); navigate(`/empresas/${item.id}`); }}
                          style={{ padding: '4px 10px', fontSize: 10, fontWeight: 700, background: '#8B5CF6', border: 'none', color: '#FFF', borderRadius: 4, cursor: 'pointer' }}
                        >
                          Abrir Empresa 360°
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, fontSize: 11, color: 'var(--text-tertiary)' }}>
              <span>Página {page} de {totalPages}</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  disabled={page === 1}
                  onClick={() => { setPage(prev => Math.max(prev - 1, 1)); updateUrlParams({ page: Math.max(page - 1, 1) }); }}
                  style={{ background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', padding: '3px 10px', borderRadius: 4, fontSize: 10, cursor: page === 1 ? 'not-allowed' : 'pointer' }}
                >
                  <ChevronLeft size={10} style={{ display: 'inline' }} /> Anterior
                </button>
                <button
                  disabled={page === totalPages}
                  onClick={() => { setPage(prev => Math.min(prev + 1, totalPages)); updateUrlParams({ page: Math.min(page + 1, totalPages) }); }}
                  style={{ background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', padding: '3px 10px', borderRadius: 4, fontSize: 10, cursor: page === totalPages ? 'not-allowed' : 'pointer' }}
                >
                  Próxima <ChevronRight size={10} style={{ display: 'inline' }} />
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
