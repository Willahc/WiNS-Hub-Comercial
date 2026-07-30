import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  Package, Search, RotateCcw, Menu, ShieldCheck, Filter, Building2, Store, Factory,
  MapPin, ChevronRight, HardHat, ExternalLink, ArrowUpDown, X, AlertCircle, Sparkles, CheckCircle2, HelpCircle
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

function fmtCnpjOrRoot(val?: string): { formatted: string; isRoot: boolean } {
  if (!val) return { formatted: '', isRoot: false };
  const clean = val.replace(/\D/g, '');
  if (clean.length === 14) {
    return {
      formatted: `${clean.slice(0, 2)}.${clean.slice(2, 5)}.${clean.slice(5, 8)}/${clean.slice(8, 12)}-${clean.slice(12, 14)}`,
      isRoot: false
    };
  }
  if (clean.length === 8) {
    return {
      formatted: `${clean.slice(0, 2)}.${clean.slice(2, 5)}.${clean.slice(5, 8)}`,
      isRoot: true
    };
  }
  return { formatted: val, isRoot: clean.length < 14 };
}

const NIVEL_CORES: Record<string, string> = {
  'A': '#22C55E',
  'B': '#F59E0B',
  'C': '#3B82F6'
};

const NIVEL_LABELS: Record<string, string> = {
  'A': 'Evidência forte',
  'B': 'Evidência média',
  'C': 'Evidência cadastral — CNAE'
};

const NIVEL_TOOLTIPS: Record<string, string> = {
  'A': 'EVIDÊNCIA_COMERCIAL_FORTE: site, catálogo, ficha técnica ou documento comercial verificável.',
  'B': 'EVIDÊNCIA_COMERCIAL_MÉDIA: evidência comercial parcial ou indireta.',
  'C': 'EVIDÊNCIA_CNAE: compatibilidade cadastral por CNAE (não constitui fornecedor confirmado por obra).'
};

const PAPEL_CORES: Record<string, string> = {
  'FABRICANTE': '#22C55E',
  'DISTRIBUIDOR': '#3B82F6',
  'REVENDEDOR': '#F59E0B',
  'LOCADORA': '#8B5CF6'
};

const categoriaDisplay: Record<string, string> = {
  'Aco e estruturas metalicas': 'Aço e estruturas metálicas',
  'Fios e cabos': 'Fios e cabos',
  'Materiais de construcao': 'Materiais de construção',
  'Equipamentos industriais': 'Equipamentos industriais',
  'Locacao de maquinas e equipamentos': 'Locação de máquinas e equipamentos'
};

export default function FornecedoresInsumosApproved() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isMobile = useMediaQuery('(max-width: 767px)');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [items, setItems] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // State from URL
  const page = Number(searchParams.get('page')) || 1;
  const perPage = Number(searchParams.get('pageSize')) || 25;
  const busca = searchParams.get('search') || '';
  const uf = searchParams.get('uf') || '';
  const categoria = searchParams.get('categoria') || '';
  const papel = searchParams.get('papel') || '';
  const nivel = searchParams.get('nivel') || '';
  const sort = searchParams.get('sort') || 'evidence_desc';

  // Local inputs
  const [searchInput, setSearchInput] = useState(busca);

  useEffect(() => { setSearchInput(busca); }, [busca]);

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

    Promise.all([
      engineeringService.getInputSuppliers({
        page,
        pageSize: perPage,
        search: busca || undefined,
        uf: uf || undefined,
        categoria: categoria || undefined,
        tipo: papel || undefined,
      }),
      engineeringService.getInputSuppliersSummary()
    ])
      .then(([r, s]) => {
        if (!controller.signal.aborted) {
          let list = r.items || [];
          
          // Apply nivel filter locally if selected
          if (nivel) {
            list = list.filter((i: any) => i.nivelEvidencia === nivel);
          }

          // Apply local sorting
          list = [...list].sort((a: any, b: any) => {
            if (sort === 'evidence_desc') {
              const orderMap: Record<string, number> = { 'A': 1, 'B': 2, 'C': 3 };
              return (orderMap[a.nivelEvidencia] || 99) - (orderMap[b.nivelEvidencia] || 99);
            }
            if (sort === 'date_desc') {
              return new Date(b.dataVerificacao || 0).getTime() - new Date(a.dataVerificacao || 0).getTime();
            }
            if (sort === 'name_asc') {
              return (a.razaoSocial || '').localeCompare(b.razaoSocial || '');
            }
            if (sort === 'uf_asc') {
              return (a.uf || '').localeCompare(b.uf || '');
            }
            if (sort === 'category_asc') {
              return (a.categoria || '').localeCompare(b.categoria || '');
            }
            return 0;
          });

          setItems(list);
          setTotalCount(r.meta?.total || list.length);
          setSummary(s);
          setLoading(false);
        }
      })
      .catch(err => {
        if (!controller.signal.aborted) {
          setError(err?.message || 'Falha ao carregar fornecedores de insumos.');
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [page, perPage, busca, uf, categoria, papel, nivel, sort]);

  const handleClearFilters = () => {
    setSearchInput('');
    setSearchParams(new URLSearchParams(), { replace: true });
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / perPage));
  const startItem = totalCount === 0 ? 0 : (page - 1) * perPage + 1;
  const endItem = Math.min(page * perPage, totalCount);

  // Active filter chips list
  const activeChips: { key: string; label: string; onRemove: () => void }[] = [];
  if (busca) activeChips.push({ key: 'search', label: `Busca: ${busca}`, onRemove: () => { setSearchInput(''); updateParams({ search: undefined, page: 1 }); } });
  if (uf) activeChips.push({ key: 'uf', label: `UF: ${uf}`, onRemove: () => updateParams({ uf: undefined, page: 1 }) });
  if (categoria) activeChips.push({ key: 'categoria', label: `Categoria: ${categoriaDisplay[categoria] || categoria}`, onRemove: () => updateParams({ categoria: undefined, page: 1 }) });
  if (papel) activeChips.push({ key: 'papel', label: `Papel: ${papel}`, onRemove: () => updateParams({ papel: undefined, page: 1 }) });
  if (nivel) activeChips.push({ key: 'nivel', label: `Nível: ${NIVEL_LABELS[nivel] || nivel}`, onRemove: () => updateParams({ nivel: undefined, page: 1 }) });

  // Check if any returned item has root CNPJ (8 digits)
  const hasRootCnpjOnly = items.some(i => (i.cnpj || '').replace(/\D/g, '').length === 8);

  return (
    <div data-ui-version="insumos-catalog-v2" style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-base, #090D16)', position: 'relative', overflow: 'hidden' }}>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: isMobile ? 14 : 16, fontWeight: 700, color: 'var(--text-primary, #F8FAFC)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Package size={18} color="#8B5CF6" />
                Fornecedores de Insumos
              </h1>
              <span style={{ fontSize: 10, fontWeight: 700, background: 'rgba(245,158,11,0.15)', color: '#F59E0B', border: '1px solid #F59E0B', padding: '2px 8px', borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                41 fornecedores evidenciados · cobertura parcial
              </span>
            </div>
            {!isMobile && <p style={{ fontSize: 11, color: 'var(--text-tertiary, #64748B)', margin: 0, marginTop: 2 }}>Fabricantes e distribuidores com evidências comerciais verificadas para categorias de insumos da Engenharia.</p>}
          </div>
        </header>

        {/* Content Body */}
        <div style={{ padding: isMobile ? 12 : 24, flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
          
          {/* KPI Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 12 }}>
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8, padding: 14 }}>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500 }}>Fornecedores Evidenciados</span>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#8B5CF6', margin: '4px 0' }}>41</div>
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Empresas únicas no piloto</span>
            </div>
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8, padding: 14 }}>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500 }}>Categorias Cobertas</span>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#22C55E', margin: '4px 0' }}>3</div>
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Aço, Fios/Cabos, Materiais</span>
            </div>
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8, padding: 14 }}>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500 }}>Papéis Comerciais</span>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#F8FAFC', margin: '6px 0' }}>
                <span style={{ color: '#22C55E' }}>21 fabricantes</span> · <span style={{ color: '#3B82F6' }}>20 distribuidores</span>
              </div>
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Total: 41 empresas</span>
            </div>
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8, padding: 14 }}>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500 }}>Cobertura Territorial</span>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#3B82F6', margin: '4px 0' }}>11 de 27 UFs</div>
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Cobertura regional parcial</span>
            </div>
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
                  placeholder="Buscar por razão social, nome fantasia, CNPJ, raiz, categoria ou produto..."
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

              {/* Categoria */}
              <select
                value={categoria}
                onChange={e => updateParams({ categoria: e.target.value || undefined, page: 1 })}
                style={{ height: 34, padding: '0 8px', fontSize: 11, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', borderRadius: 6 }}
              >
                <option value="">Todas as Categorias</option>
                <option value="Aco e estruturas metalicas">Aço e estruturas metálicas</option>
                <option value="Fios e cabos">Fios e cabos</option>
                <option value="Materiais de construcao">Materiais de construção</option>
              </select>

              {/* Papel Comercial */}
              <select
                value={papel}
                onChange={e => updateParams({ papel: e.target.value || undefined, page: 1 })}
                style={{ height: 34, padding: '0 8px', fontSize: 11, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', borderRadius: 6 }}
              >
                <option value="">Todos os Papéis</option>
                <option value="FABRICANTE">Fabricante (21)</option>
                <option value="DISTRIBUIDOR">Distribuidor (20)</option>
              </select>

              {/* Nível de Evidência */}
              <select
                value={nivel}
                onChange={e => updateParams({ nivel: e.target.value || undefined, page: 1 })}
                style={{ height: 34, padding: '0 8px', fontSize: 11, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', borderRadius: 6 }}
              >
                <option value="">Todos os Níveis de Evidência</option>
                <option value="A">🟢 Evidência forte (Comercial/Ficha)</option>
                <option value="B">🟡 Evidência média (Comercial Parcial)</option>
                <option value="C">🔵 Evidência cadastral — CNAE</option>
              </select>

              {/* Ordenação */}
              <select
                value={sort}
                onChange={e => updateParams({ sort: e.target.value, page: 1 })}
                style={{ height: 34, padding: '0 8px', fontSize: 11, background: 'var(--bg-base)', border: '1px solid #8B5CF6', color: '#8B5CF6', fontWeight: 600, borderRadius: 6 }}
              >
                <option value="evidence_desc">Ordenar: Evidência Mais Forte</option>
                <option value="date_desc">Ordenar: Verificação Mais Recente</option>
                <option value="name_asc">Ordenar: Razão Social (A-Z)</option>
                <option value="uf_asc">Ordenar: UF / Município</option>
                <option value="category_asc">Ordenar: Categoria</option>
              </select>
            </div>

            {/* Active Chips Bar */}
            {activeChips.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', paddingTop: 6, borderTop: '1px solid var(--border-subtle, #1E293B)' }}>
                <span style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Filtros ativos:</span>
                {activeChips.map(c => (
                  <span
                    key={c.key}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', fontSize: 10,
                      background: 'rgba(139,92,246,0.15)', border: '1px solid #8B5CF6', color: '#8B5CF6', borderRadius: 12
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
              Carregando fornecedores de insumos evidenciados...
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
                  <th style={{ padding: '10px 8px' }}>
                    {hasRootCnpjOnly ? 'Raiz do CNPJ' : 'CNPJ / Raiz'}
                  </th>
                  <th style={{ padding: '10px 8px', cursor: 'pointer' }} onClick={() => updateParams({ sort: 'category_asc', page: 1 })}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Categoria <ArrowUpDown size={12} /></div>
                  </th>
                  <th style={{ padding: '10px 8px' }}>Papel Comercial</th>
                  <th style={{ padding: '10px 8px', cursor: 'pointer' }} onClick={() => updateParams({ sort: 'uf_asc', page: 1 })}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Município / UF <ArrowUpDown size={12} /></div>
                  </th>
                  <th style={{ padding: '10px 8px', cursor: 'pointer' }} onClick={() => updateParams({ sort: 'evidence_desc', page: 1 })}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Nível de Evidência <ArrowUpDown size={12} /></div>
                  </th>
                  <th style={{ padding: '10px 8px' }}>Fonte Principal</th>
                  <th style={{ padding: '10px 8px', cursor: 'pointer' }} onClick={() => updateParams({ sort: 'date_desc', page: 1 })}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Verificado em <ArrowUpDown size={12} /></div>
                  </th>
                  <th style={{ padding: '10px 8px' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && !loading ? (
                  <tr>
                    <td colSpan={9} style={{ padding: 32, textAlign: 'center', color: 'var(--text-tertiary)' }}>
                      Nenhum fornecedor de insumos encontrado para a combinação de filtros selecionada.
                    </td>
                  </tr>
                ) : (
                  items.map((s) => {
                    const cnpjInfo = fmtCnpjOrRoot(s.cnpj);
                    const mainFonte = s.fontes && s.fontes[0] ? s.fontes[0].nome || s.fontes[0].tipo : 'Registro comercial';

                    return (
                      <tr 
                        key={s.id} 
                        style={{ borderBottom: '1px solid var(--border-subtle, #1E293B)' }}
                        className="hover-row"
                      >
                        <td style={{ padding: '12px 8px', fontWeight: 600 }}>
                          <Link 
                            to={`/engenharia/insumos/${s.id}`} 
                            style={{ color: '#8B5CF6', textDecoration: 'none' }}
                          >
                            {s.razaoSocial}
                          </Link>
                          <div style={{ marginTop: 2 }}>
                            <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3, background: 'rgba(139,92,246,0.12)', color: '#8B5CF6', border: '1px solid rgba(139,92,246,0.3)' }}>
                              EVIDENCIADO POR CATEGORIA
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: '12px 8px', color: 'var(--text-secondary)', fontWeight: 500, fontFamily: 'monospace' }}>
                          <div>{cnpjInfo.formatted}</div>
                          {cnpjInfo.isRoot && (
                            <span style={{ fontSize: 9, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Raiz do CNPJ</span>
                          )}
                        </td>
                        <td style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>
                          {categoriaDisplay[s.categoria] || s.categoria}
                        </td>
                        <td style={{ padding: '12px 8px' }}>
                          <span style={{
                            padding: '2px 8px', fontSize: 10, fontWeight: 700, borderRadius: 4,
                            background: `${PAPEL_CORES[s.papel] || '#64748B'}20`, color: PAPEL_CORES[s.papel] || '#64748B',
                            border: `1px solid ${PAPEL_CORES[s.papel] || '#64748B'}50`,
                          }}>
                            {s.papel}
                          </span>
                        </td>
                        <td style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>
                          {s.municipio && s.municipio !== 'Nao informado' ? `${s.municipio}, ` : 'Município não informado, '}{s.uf}
                        </td>
                        <td style={{ padding: '12px 8px' }}>
                          <span 
                            title={NIVEL_TOOLTIPS[s.nivelEvidencia] || ''}
                            style={{
                              padding: '2px 8px', fontSize: 10, fontWeight: 700, borderRadius: 4, cursor: 'help',
                              background: `${NIVEL_CORES[s.nivelEvidencia] || '#64748B'}20`, color: NIVEL_CORES[s.nivelEvidencia] || '#64748B',
                              border: `1px solid ${NIVEL_CORES[s.nivelEvidencia] || '#64748B'}50`, display: 'inline-flex', alignItems: 'center', gap: 4
                            }}
                          >
                            {NIVEL_LABELS[s.nivelEvidencia] || s.nivelEvidencia}
                            <HelpCircle size={10} />
                          </span>
                        </td>
                        <td style={{ padding: '12px 8px', color: 'var(--text-secondary)', fontSize: 11 }}>
                          {mainFonte}
                        </td>
                        <td style={{ padding: '12px 8px', color: 'var(--text-tertiary)', fontSize: 11 }}>
                          {s.dataVerificacao || '2026-07-26'}
                        </td>
                        <td style={{ padding: '12px 8px' }}>
                          <Link
                            to={`/engenharia/insumos/${s.id}`}
                            style={{ padding: '4px 10px', fontSize: 11, background: 'rgba(139,92,246,0.15)', border: '1px solid #8B5CF6', color: '#8B5CF6', borderRadius: 4, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                          >
                            Ver <ExternalLink size={10} />
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
                Exibindo {startItem.toLocaleString('pt-BR')}–{endItem.toLocaleString('pt-BR')} de {totalCount.toLocaleString('pt-BR')} fornecedores evidenciados
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
