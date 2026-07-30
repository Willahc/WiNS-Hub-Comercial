import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  Building2, Search, RotateCcw, Menu, ShieldCheck, Users, MapPin, Filter,
  ExternalLink, ChevronRight, SlidersHorizontal, ArrowUpDown, X, AlertCircle, Sparkles
} from 'lucide-react';
import { DesktopSidebar, MobileSidebarContent } from '../components/AppSidebar';
import { BrazilUfSelect } from '../components/territorial/BrazilUfSelect';
import { engineeringService } from '../services/engineering';

function useMediaQuery(q: string) {
  const [match, setMatch] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const h = (e: MediaQueryListEvent) => setMatch(e.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, [q]);
  return match;
}

function fmtCnpj(cnpj?: string): string {
  if (!cnpj) return '';
  const c = cnpj.replace(/\D/g, '');
  if (c.length !== 14) return cnpj;
  return `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12, 14)}`;
}

export default function FornecedoresExecutoresApproved() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isMobile = useMediaQuery('(max-width: 767px)');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);

  const [items, setItems] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // State from URL
  const page = Number(searchParams.get('page')) || 1;
  const perPage = Number(searchParams.get('pageSize')) || 25;
  const busca = searchParams.get('search') || '';
  const uf = searchParams.get('uf') || '';
  const municipio = searchParams.get('municipality') || '';
  const especialidade = searchParams.get('especialidade') || '';
  const cnae = searchParams.get('cnae') || '';
  const setor = searchParams.get('sector') || '';
  const classificacao = searchParams.get('classification') || '';
  const situacao = searchParams.get('situacao') || '';
  const porte = searchParams.get('porte') || '';
  const hasRelationships = searchParams.get('hasRelationships') === 'true';
  const hasConfirmed = searchParams.get('hasConfirmed') === 'true';
  const hasProbable = searchParams.get('hasProbable') === 'true';
  const hasPotential = searchParams.get('hasPotential') === 'true';
  const hasContact = searchParams.get('hasContact') === 'true';
  const quickTab = searchParams.get('quick') || 'all';
  const sort = searchParams.get('sort') || 'rel_confirmed_desc';

  // Local inputs
  const [searchInput, setSearchInput] = useState(busca);
  const [municipioInput, setMunicipioInput] = useState(municipio);

  useEffect(() => { setSearchInput(busca); }, [busca]);
  useEffect(() => { setMunicipioInput(municipio); }, [municipio]);

  // Debounce search update to URL
  useEffect(() => {
    const handler = setTimeout(() => {
      if (searchInput !== busca) {
        updateParams({ search: searchInput || undefined, page: 1 });
      }
    }, 350);
    return () => clearTimeout(handler);
  }, [searchInput]);

  const updateParams = (newParams: Record<string, string | number | boolean | undefined>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(newParams).forEach(([k, v]) => {
      if (v === undefined || v === '' || v === false) {
        next.delete(k);
      } else {
        next.set(k, String(v));
      }
    });
    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    engineeringService.getExecutors({
      page,
      pageSize: perPage,
      search: busca || undefined,
      uf: uf || undefined,
      municipality: municipio || undefined,
      especialidade: especialidade || undefined,
      cnae: cnae || undefined,
      sector: setor || undefined,
      classification: quickTab !== 'all' && quickTab !== 'sem_rel' ? (quickTab === 'confirmed' ? 'CONFIRMADO' : quickTab === 'probable' ? 'PROVÁVEL' : quickTab === 'potential' ? 'POTENCIAL' : classificacao) : (classificacao || undefined),
      situacaoCadastral: situacao || undefined,
      porte: porte || undefined,
      hasRelationships: quickTab === 'with_rel' ? true : (hasRelationships || undefined),
      hasConfirmed: quickTab === 'confirmed' ? true : (hasConfirmed || undefined),
      hasProbable: quickTab === 'probable' ? true : (hasProbable || undefined),
      hasPotential: quickTab === 'potential' ? true : (hasPotential || undefined),
      hasContact: hasContact || undefined,
      sort,
    })
      .then(r => {
        if (!controller.signal.aborted) {
          setItems(r.items || []);
          setTotalCount(r.meta?.total || 0);
          setLoading(false);
        }
      })
      .catch(err => {
        if (!controller.signal.aborted) {
          setError(err?.message || 'Falha ao carregar catálogo de empresas prestadoras.');
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [page, perPage, busca, uf, municipio, especialidade, cnae, setor, classificacao, situacao, porte, hasRelationships, hasConfirmed, hasProbable, hasPotential, hasContact, quickTab, sort]);

  const handleClearFilters = () => {
    setSearchInput('');
    setMunicipioInput('');
    setSearchParams(new URLSearchParams(), { replace: true });
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / perPage));
  const startItem = totalCount === 0 ? 0 : (page - 1) * perPage + 1;
  const endItem = Math.min(page * perPage, totalCount);

  // Active filter chips list
  const activeChips: { key: string; label: string; onRemove: () => void }[] = [];
  if (busca) activeChips.push({ key: 'search', label: `Busca: ${busca}`, onRemove: () => { setSearchInput(''); updateParams({ search: undefined, page: 1 }); } });
  if (uf) activeChips.push({ key: 'uf', label: `UF: ${uf}`, onRemove: () => updateParams({ uf: undefined, page: 1 }) });
  if (municipio) activeChips.push({ key: 'municipality', label: `Município: ${municipio}`, onRemove: () => { setMunicipioInput(''); updateParams({ municipality: undefined, page: 1 }); } });
  if (especialidade) activeChips.push({ key: 'especialidade', label: `Especialidade: ${especialidade}`, onRemove: () => updateParams({ especialidade: undefined, page: 1 }) });
  if (classificacao) activeChips.push({ key: 'classification', label: `Classificação: ${classificacao}`, onRemove: () => updateParams({ classification: undefined, page: 1 }) });
  if (porte) activeChips.push({ key: 'porte', label: `Porte: ${porte}`, onRemove: () => updateParams({ porte: undefined, page: 1 }) });
  if (hasContact) activeChips.push({ key: 'hasContact', label: 'Com contato verificado', onRemove: () => updateParams({ hasContact: undefined, page: 1 }) });

  return (
    <div data-ui-version="prestadores-catalog-v2" style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-base, #090D16)', position: 'relative', overflow: 'hidden' }}>
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
        {/* Top Header */}
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
            <h1 style={{ fontSize: isMobile ? 14 : 16, fontWeight: 700, color: 'var(--text-primary, #F8FAFC)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Building2 size={18} color="#3B82F6" />
              Empresas Prestadoras de Serviços
            </h1>
            <p style={{ fontSize: 11, color: 'var(--text-tertiary, #64748B)', margin: 0, marginTop: 1 }}>
              Exibindo {startItem.toLocaleString('pt-BR')}–{endItem.toLocaleString('pt-BR')} de {totalCount.toLocaleString('pt-BR')} empresas prestadoras
            </p>
          </div>
        </header>

        {/* Content Body */}
        <div style={{ padding: isMobile ? 12 : 24, flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
          
          {/* Quick Filter Bar */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {[
              { id: 'all', label: 'Todas as Empresas' },
              { id: 'with_rel', label: '⚡ Com Relações Calculadas' },
              { id: 'confirmed', label: '🟢 Confirmadas' },
              { id: 'probable', label: '🟡 Prováveis' },
              { id: 'potential', label: '⚪ Potenciais' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => updateParams({ quick: tab.id, page: 1 })}
                style={{
                  padding: '5px 12px', fontSize: 11, fontWeight: 600, borderRadius: 6, cursor: 'pointer',
                  background: quickTab === tab.id ? 'rgba(59,130,246,0.2)' : 'var(--bg-surface)',
                  border: `1px solid ${quickTab === tab.id ? '#3B82F6' : 'var(--border-default)'}`,
                  color: quickTab === tab.id ? '#3B82F6' : 'var(--text-secondary)',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Main Filters Box */}
          <div style={{
            background: 'var(--bg-surface, #0F172A)', border: '1px solid var(--border-default, #1E293B)',
            borderRadius: 8, padding: 14, display: 'flex', flexDirection: 'column', gap: 12
          }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              {/* Search Bar */}
              <div style={{ position: 'relative', flex: 1, minWidth: 260 }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                <input
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  placeholder="Buscar por razão social, nome fantasia, CNPJ, CNAE, município..."
                  style={{
                    width: '100%', height: 34, paddingLeft: 32, fontSize: 11,
                    background: 'var(--bg-base, #090D16)', border: '1px solid var(--border-subtle, #334155)',
                    borderRadius: 6, color: 'var(--text-primary, #F8FAFC)'
                  }}
                />
              </div>

              {/* UF */}
              <BrazilUfSelect
                value={uf}
                onChange={(val) => updateParams({ uf: val || undefined, page: 1 })}
                showAllLabel="Todas as UFs"
              />

              {/* Especialidades */}
              <select
                value={especialidade}
                onChange={e => updateParams({ especialidade: e.target.value || undefined, page: 1 })}
                style={{ height: 34, padding: '0 8px', fontSize: 11, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', borderRadius: 6 }}
              >
                <option value="">Todas as Especialidades</option>
                <option value="Engenharia">Engenharia Geral</option>
                <option value="Elétrica">Instalações Elétricas</option>
                <option value="Hidráulica">Instalações Hidráulicas</option>
                <option value="Estrutural">Estruturas & Concreto</option>
                <option value="Pavimentação">Terraplenagem & Pavimentação</option>
                <option value="Saneamento">Saneamento & Drenagem</option>
                <option value="Montagem">Montagem Industrial</option>
                <option value="Manutenção">Manutenção & Operação</option>
              </select>

              {/* Classificação */}
              <select
                value={classificacao}
                onChange={e => updateParams({ classification: e.target.value || undefined, page: 1 })}
                style={{ height: 34, padding: '0 8px', fontSize: 11, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', borderRadius: 6 }}
              >
                <option value="">Todas Classificações</option>
                <option value="CONFIRMADO">CONFIRMADO</option>
                <option value="PROVÁVEL">PROVÁVEL</option>
                <option value="POTENCIAL">POTENCIAL</option>
              </select>

              {/* Ordenação */}
              <select
                value={sort}
                onChange={e => updateParams({ sort: e.target.value, page: 1 })}
                style={{ height: 34, padding: '0 8px', fontSize: 11, background: 'var(--bg-base)', border: '1px solid #3B82F6', color: '#3B82F6', fontWeight: 600, borderRadius: 6 }}
              >
                <option value="rel_confirmed_desc">Ordenar: Relações Confirmadas Primeiro</option>
                <option value="rel_probable_desc">Ordenar: Relações Prováveis Primeiro</option>
                <option value="works_desc">Ordenar: Maior Qtd Obras Relacionadas</option>
                <option value="score_desc">Ordenar: Melhor Score de Compatibilidade</option>
                <option value="updated_desc">Ordenar: Atualização Mais Recente</option>
                <option value="name_asc">Ordenar: Razão Social (A-Z)</option>
                <option value="location_asc">Ordenar: Município / UF</option>
              </select>
            </div>

            {/* Expanded Advanced Filters */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', paddingTop: 8, borderTop: '1px solid var(--border-subtle, #1E293B)' }}>
              <input
                value={municipioInput}
                onChange={e => setMunicipioInput(e.target.value)}
                onBlur={() => updateParams({ municipality: municipioInput || undefined, page: 1 })}
                placeholder="Filtrar por município..."
                style={{ width: 170, height: 30, padding: '0 8px', fontSize: 11, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', borderRadius: 6 }}
              />

              <select
                value={porte}
                onChange={e => updateParams({ porte: e.target.value || undefined, page: 1 })}
                style={{ height: 30, padding: '0 8px', fontSize: 11, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', borderRadius: 6 }}
              >
                <option value="">Todo Porte</option>
                <option value="DEMAIS">Grande / Médio Porte (DEMAIS)</option>
                <option value="EPP">Empresa de Pequeno Porte (EPP)</option>
                <option value="ME">Microempresa (ME)</option>
              </select>

              <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                <input type="checkbox" checked={hasContact} onChange={e => updateParams({ hasContact: e.target.checked || undefined, page: 1 })} />
                Com contato empresarial verificado
              </label>

              {activeChips.length > 0 && (
                <button
                  onClick={handleClearFilters}
                  style={{ height: 30, padding: '0 10px', fontSize: 11, background: 'rgba(239,68,68,0.1)', border: '1px solid #EF4444', color: '#EF4444', borderRadius: 6, cursor: 'pointer', marginLeft: 'auto' }}
                >
                  Limpar Filtros ({activeChips.length})
                </button>
              )}
            </div>

            {/* Active Chips Bar */}
            {activeChips.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', paddingTop: 6 }}>
                <span style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Filtros ativos:</span>
                {activeChips.map(c => (
                  <span
                    key={c.key}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', fontSize: 10,
                      background: 'rgba(59,130,246,0.15)', border: '1px solid #3B82F6', color: '#3B82F6', borderRadius: 12
                    }}
                  >
                    {c.label}
                    <X size={12} style={{ cursor: 'pointer' }} onClick={c.onRemove} />
                  </span>
                ))}
              </div>
            )}
          </div>

          {loading && (
            <div style={{ padding: 24, textAlign: 'center', background: 'var(--bg-surface)', borderRadius: 8, color: 'var(--text-secondary)' }}>
              Carregando empresas prestadoras de serviços...
            </div>
          )}

          {error && (
            <div style={{ padding: 16, background: 'rgba(239,68,68,0.1)', border: '1px solid #EF4444', borderRadius: 8, color: '#EF4444', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertCircle size={16} /> {error}
            </div>
          )}

          {/* Table Container */}
          <div style={{ background: 'var(--bg-surface, #0F172A)', border: '1px solid var(--border-default, #1E293B)', borderRadius: 8, padding: 16, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-default)', textAlign: 'left', color: 'var(--text-tertiary)' }}>
                  <th style={{ padding: '10px 8px', cursor: 'pointer' }} onClick={() => updateParams({ sort: sort === 'name_asc' ? 'name_desc' : 'name_asc', page: 1 })}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Empresa <ArrowUpDown size={12} /></div>
                  </th>
                  <th style={{ padding: '10px 8px' }}>CNPJ</th>
                  <th style={{ padding: '10px 8px', cursor: 'pointer' }} onClick={() => updateParams({ sort: 'location_asc', page: 1 })}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Município / UF <ArrowUpDown size={12} /></div>
                  </th>
                  <th style={{ padding: '10px 8px' }}>Especialidades</th>
                  <th style={{ padding: '10px 8px', cursor: 'pointer' }} onClick={() => updateParams({ sort: 'works_desc', page: 1 })}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Relações com Obras <ArrowUpDown size={12} /></div>
                  </th>
                  <th style={{ padding: '10px 8px', cursor: 'pointer' }} onClick={() => updateParams({ sort: 'rel_confirmed_desc', page: 1 })}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Melhor Classificação <ArrowUpDown size={12} /></div>
                  </th>
                  <th style={{ padding: '10px 8px', cursor: 'pointer' }} onClick={() => updateParams({ sort: 'score_desc', page: 1 })}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Melhor Score <ArrowUpDown size={12} /></div>
                  </th>
                  <th style={{ padding: '10px 8px' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && !loading ? (
                  <tr>
                    <td colSpan={8} style={{ padding: 32, textAlign: 'center', color: 'var(--text-tertiary)' }}>
                      Nenhuma empresa prestadora encontrada para a combinação de filtros selecionada.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => {
                    const cnpjFmt = fmtCnpj(item.cnpj);
                    const specs = item.especialidades || [];
                    const firstTwoSpecs = specs.slice(0, 2);
                    const extraSpecsCount = specs.length > 2 ? specs.length - 2 : 0;

                    return (
                      <tr 
                        key={item.id} 
                        style={{ borderBottom: '1px solid var(--border-subtle, #1E293B)' }}
                        className="hover-row"
                      >
                        <td style={{ padding: '12px 8px', fontWeight: 600 }}>
                          <Link 
                            to={`/engenharia/fornecedores/${item.id}`} 
                            style={{ color: '#3B82F6', textDecoration: 'none' }}
                          >
                            {item.razaoSocial}
                          </Link>
                          {item.nomeFantasia && item.nomeFantasia !== item.razaoSocial && (
                            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 400 }}>
                              {item.nomeFantasia}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '12px 8px', color: 'var(--text-secondary)', fontWeight: 500, fontFamily: 'monospace' }}>
                          {cnpjFmt}
                        </td>
                        <td style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>
                          {item.location_formatted}
                        </td>
                        <td style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                            {firstTwoSpecs.map((s: string, idx: number) => (
                              <span key={idx} style={{ padding: '2px 6px', fontSize: 10, borderRadius: 4, background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-subtle)' }}>
                                {s}
                              </span>
                            ))}
                            {extraSpecsCount > 0 && (
                              <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                                +{extraSpecsCount} especialidades
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '12px 8px', fontSize: 11, color: 'var(--text-secondary)' }}>
                          {item.relationships_summary}
                        </td>
                        <td style={{ padding: '12px 8px' }}>
                          <span style={{
                            padding: '2px 8px', fontSize: 10, fontWeight: 700, borderRadius: 4,
                            background: item.best_classification === 'CONFIRMADO' ? 'rgba(34,197,94,0.15)' : item.best_classification === 'PROVÁVEL' ? 'rgba(245,158,11,0.15)' : item.best_classification === 'POTENCIAL' ? 'rgba(148,163,184,0.15)' : 'rgba(255,255,255,0.05)',
                            border: `1px solid ${item.best_classification === 'CONFIRMADO' ? '#22C55E' : item.best_classification === 'PROVÁVEL' ? '#F59E0B' : item.best_classification === 'POTENCIAL' ? '#94A3B8' : '#334155'}`,
                            color: item.best_classification === 'CONFIRMADO' ? '#22C55E' : item.best_classification === 'PROVÁVEL' ? '#F59E0B' : item.best_classification === 'POTENCIAL' ? '#94A3B8' : '#64748B',
                          }}>
                            {item.best_classification}
                          </span>
                        </td>
                        <td style={{ padding: '12px 8px', fontWeight: 600, color: item.best_score > 0 ? '#3B82F6' : 'var(--text-tertiary)' }}>
                          {item.best_score_label}
                        </td>
                        <td style={{ padding: '12px 8px' }}>
                          <Link
                            to={`/engenharia/fornecedores/${item.id}`}
                            style={{ padding: '4px 10px', fontSize: 11, background: 'rgba(59,130,246,0.15)', border: '1px solid #3B82F6', color: '#3B82F6', borderRadius: 4, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                          >
                            Ver Detalhes <ExternalLink size={10} />
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                Exibindo {startItem.toLocaleString('pt-BR')}–{endItem.toLocaleString('pt-BR')} de {totalCount.toLocaleString('pt-BR')} empresas prestadoras
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Por página:</span>
                <select
                  value={perPage}
                  onChange={e => updateParams({ pageSize: Number(e.target.value), page: 1 })}
                  style={{ height: 26, padding: '0 4px', fontSize: 11, background: 'var(--bg-surface)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', borderRadius: 4 }}
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginRight: 6 }}>
                Página {page} de {totalPages}
              </span>
              <button
                disabled={page <= 1}
                onClick={() => updateParams({ page: Math.max(1, page - 1) })}
                style={{ padding: '6px 12px', fontSize: 11, background: 'var(--bg-surface)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', borderRadius: 4, cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? 0.5 : 1 }}
              >
                Anterior
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => updateParams({ page: Math.min(totalPages, page + 1) })}
                style={{ padding: '6px 12px', fontSize: 11, background: 'var(--bg-surface)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', borderRadius: 4, cursor: page >= totalPages ? 'not-allowed' : 'pointer', opacity: page >= totalPages ? 0.5 : 1 }}
              >
                Próxima
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
