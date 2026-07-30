import React, { useState, useEffect, useTransition } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  HardHat, Building2, Target, MapPin, DollarSign, Search, RotateCcw,
  Menu, ChevronRight, SlidersHorizontal, ChevronDown, ChevronUp,
  Download, ArrowLeft, ArrowUpRight, CheckCircle2, Eye, ExternalLink, X,
  ArrowUpDown, Filter, ShieldCheck, Sparkles, AlertCircle
} from 'lucide-react';
import { engineeringService } from '../services/engineering';
import type { EngineeringWork, EngineeringFilters } from '../types/engineering';
import { DesktopSidebar, MobileSidebarContent } from '../components/AppSidebar';
import { BrazilUfSelect } from '../components/territorial/BrazilUfSelect';

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

function fmtMoney(n?: number): { text: string; hasValue: boolean } {
  if (n === undefined || n === null || isNaN(n) || n === 0) {
    return { text: 'Indisponível', hasValue: false };
  }
  if (n >= 1e9) return { text: `R$ ${(n / 1e9).toFixed(1).replace('.', ',')} bi`, hasValue: true };
  if (n >= 1e6) return { text: `R$ ${(n / 1e6).toFixed(1).replace('.', ',')} M`, hasValue: true };
  return { text: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n), hasValue: true };
}

function fmtCnpj(cnpj?: string): string {
  if (!cnpj) return '';
  const c = cnpj.replace(/\D/g, '');
  if (c.length !== 14) return cnpj;
  return `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12, 14)}`;
}

export default function EngenhariaObrasApproved() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isMobile = useMediaQuery('(max-width: 767px)');
  
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [works, setWorks] = useState<EngineeringWork[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // State from URL
  const page = Number(searchParams.get('page')) || 1;
  const perPage = Number(searchParams.get('pageSize')) || 25;
  const busca = searchParams.get('search') || '';
  const uf = searchParams.get('uf') || '';
  const fase = searchParams.get('phase') || '';
  const status = searchParams.get('status') || '';
  const municipio = searchParams.get('municipality') || '';
  const setor = searchParams.get('sector') || '';
  const prioridade = searchParams.get('priority') || '';
  const capexClass = searchParams.get('capexClass') || '';
  const empresa = searchParams.get('company') || '';
  const fonte = searchParams.get('source') || '';
  const valMin = searchParams.get('min') || '';
  const valMax = searchParams.get('max') || '';
  const hasDecisor = searchParams.get('hasDecisor') === 'true';
  const hasSupplier = searchParams.get('hasSupplier') === 'true';
  const hasOpportunity = searchParams.get('hasOpportunity') === 'true';
  const hasInputs = searchParams.get('hasInputs') === 'true';
  const sort = searchParams.get('sort') || 'updated_desc';

  // Input debounced state
  const [searchInput, setSearchInput] = useState(busca);
  const [municipioInput, setMunicipioInput] = useState(municipio);
  const [empresaInput, setEmpresaInput] = useState(empresa);

  useEffect(() => { setSearchInput(busca); }, [busca]);
  useEffect(() => { setMunicipioInput(municipio); }, [municipio]);
  useEffect(() => { setEmpresaInput(empresa); }, [empresa]);

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

    engineeringService.load({
      page,
      pageSize: perPage,
      search: busca || undefined,
      uf: uf || undefined,
      phase: fase || undefined,
      status: status || undefined,
      municipality: municipio || undefined,
      sector: setor || undefined,
      priority: prioridade || undefined,
      capexClass: capexClass || undefined,
      company: empresa || undefined,
      source: fonte || undefined,
      investmentMin: valMin ? Number(valMin) : undefined,
      investmentMax: valMax ? Number(valMax) : undefined,
      hasDecisionMaker: hasDecisor || undefined,
      hasSupplier: hasSupplier || undefined,
      hasOpportunity: hasOpportunity || undefined,
      hasInputs: hasInputs || undefined,
      sort: sort || undefined,
    })
      .then(res => {
        if (!controller.signal.aborted) {
          setWorks(res.works);
          setTotalCount(res.meta?.totalWorks || res.works.length);
          setLoading(false);
        }
      })
      .catch(err => {
        if (!controller.signal.aborted) {
          setError(err?.message || 'Falha ao carregar lista de obras do catálogo real.');
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [page, perPage, busca, uf, fase, status, municipio, setor, prioridade, capexClass, empresa, fonte, valMin, valMax, hasDecisor, hasSupplier, hasOpportunity, hasInputs, sort]);

  const handleClearFilters = () => {
    setSearchInput('');
    setMunicipioInput('');
    setEmpresaInput('');
    setSearchParams(new URLSearchParams(), { replace: true });
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / perPage));
  const startItem = totalCount === 0 ? 0 : (page - 1) * perPage + 1;
  const endItem = Math.min(page * perPage, totalCount);

  // Active filter chips list
  const activeChips: { key: string; label: string; onRemove: () => void }[] = [];
  if (busca) activeChips.push({ key: 'search', label: `Busca: ${busca}`, onRemove: () => { setSearchInput(''); updateParams({ search: undefined, page: 1 }); } });
  if (uf) activeChips.push({ key: 'uf', label: `UF: ${uf}`, onRemove: () => updateParams({ uf: undefined, page: 1 }) });
  if (fase) activeChips.push({ key: 'phase', label: `Fase: ${fase}`, onRemove: () => updateParams({ phase: undefined, page: 1 }) });
  if (status) activeChips.push({ key: 'status', label: `Status: ${status}`, onRemove: () => updateParams({ status: undefined, page: 1 }) });
  if (municipio) activeChips.push({ key: 'municipality', label: `Município: ${municipio}`, onRemove: () => { setMunicipioInput(''); updateParams({ municipality: undefined, page: 1 }); } });
  if (setor) activeChips.push({ key: 'sector', label: `Setor: ${setor}`, onRemove: () => updateParams({ sector: undefined, page: 1 }) });
  if (prioridade) activeChips.push({ key: 'priority', label: `Prioridade: ${prioridade}`, onRemove: () => updateParams({ priority: undefined, page: 1 }) });
  if (capexClass) activeChips.push({ key: 'capexClass', label: `CAPEX: ${capexClass}`, onRemove: () => updateParams({ capexClass: undefined, page: 1 }) });
  if (empresa) activeChips.push({ key: 'company', label: `Empresa: ${empresa}`, onRemove: () => { setEmpresaInput(''); updateParams({ company: undefined, page: 1 }); } });
  if (fonte) activeChips.push({ key: 'source', label: `Fonte: ${fonte}`, onRemove: () => updateParams({ source: undefined, page: 1 }) });
  if (valMin) activeChips.push({ key: 'min', label: `Min: R$ ${valMin}`, onRemove: () => updateParams({ min: undefined, page: 1 }) });
  if (valMax) activeChips.push({ key: 'max', label: `Max: R$ ${valMax}`, onRemove: () => updateParams({ max: undefined, page: 1 }) });
  if (hasDecisor) activeChips.push({ key: 'hasDecisor', label: 'Possui Decisor', onRemove: () => updateParams({ hasDecisor: undefined, page: 1 }) });
  if (hasSupplier) activeChips.push({ key: 'hasSupplier', label: 'Possui Prestador', onRemove: () => updateParams({ hasSupplier: undefined, page: 1 }) });
  if (hasOpportunity) activeChips.push({ key: 'hasOpportunity', label: 'Possui Oportunidade', onRemove: () => updateParams({ hasOpportunity: undefined, page: 1 }) });
  if (hasInputs) activeChips.push({ key: 'hasInputs', label: 'Possui Insumos', onRemove: () => updateParams({ hasInputs: undefined, page: 1 }) });

  return (
    <div data-ui-version="obras-catalog-v2" style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-base, #090D16)', position: 'relative', overflow: 'hidden' }}>
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
            <h1 style={{ fontSize: isMobile ? 14 : 16, fontWeight: 600, color: 'var(--text-primary, #F8FAFC)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <HardHat size={18} color="#22C55E" />
              Catálogo Geral de Obras
            </h1>
            <p style={{ fontSize: 11, color: 'var(--text-tertiary, #64748B)', margin: 0, marginTop: 1 }}>
              Exibindo {startItem.toLocaleString('pt-BR')}–{endItem.toLocaleString('pt-BR')} de {totalCount.toLocaleString('pt-BR')} obras visíveis catalogadas
            </p>
          </div>

          <button onClick={() => navigate('/engenharia')} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
            <ArrowLeft size={14} /> <span>Voltar ao Dashboard</span>
          </button>
        </header>

        {/* Content Container */}
        <div style={{ padding: isMobile ? 12 : 24, flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
          
          {/* Main Filters Bar */}
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
                  placeholder="Buscar por obra, empresa, CNPJ, município, edital..."
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

              {/* Fase */}
              <select
                value={fase}
                onChange={e => updateParams({ phase: e.target.value || undefined, page: 1 })}
                style={{ height: 34, padding: '0 8px', fontSize: 11, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', borderRadius: 6 }}
              >
                <option value="">Todas as Fases</option>
                <option value="Projeto">Projeto</option>
                <option value="Licenciamento">Licenciamento</option>
                <option value="Mobilização">Mobilização</option>
                <option value="Execução">Execução</option>
                <option value="Entrega">Entrega</option>
              </select>

              {/* Prioridade Comercial */}
              <select
                value={prioridade}
                onChange={e => updateParams({ priority: e.target.value || undefined, page: 1 })}
                style={{ height: 34, padding: '0 8px', fontSize: 11, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', borderRadius: 6 }}
              >
                <option value="">Todas Prioridades</option>
                <option value="Ouro">🥇 Ouro (Alta)</option>
                <option value="Prata">🥈 Prata (Média)</option>
                <option value="Bronze">🥉 Bronze (Demais)</option>
              </select>

              {/* Classificação CAPEX */}
              <select
                value={capexClass}
                onChange={e => updateParams({ capexClass: e.target.value || undefined, page: 1 })}
                style={{ height: 34, padding: '0 8px', fontSize: 11, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', borderRadius: 6 }}
              >
                <option value="">Todo Tipo CAPEX</option>
                <option value="HOMOLOGADO">HOMOLOGADO</option>
                <option value="PUBLICADO">PUBLICADO</option>
                <option value="ESTIMADO_FONTE">ESTIMADO_FONTE</option>
                <option value="ESTIMADO_REGRA">ESTIMADO_REGRA</option>
                <option value="ESTIMADO_MODELO">ESTIMADO_MODELO</option>
                <option value="INDISPONIVEL">INDISPONIVEL</option>
              </select>

              {/* Ordenação */}
              <select
                value={sort}
                onChange={e => updateParams({ sort: e.target.value, page: 1 })}
                style={{ height: 34, padding: '0 8px', fontSize: 11, background: 'var(--bg-base)', border: '1px solid #3B82F6', color: '#3B82F6', fontWeight: 600, borderRadius: 6 }}
              >
                <option value="updated_desc">Ordenar: Mais Recentes</option>
                <option value="investment_desc">Ordenar: Maior CAPEX</option>
                <option value="investment_asc">Ordenar: Menor CAPEX</option>
                <option value="priority_desc">Ordenar: Prioridade Comercial</option>
                <option value="name_asc">Ordenar: Ordem Alfabética (A-Z)</option>
              </select>

              {isMobile && (
                <button
                  onClick={() => setFilterDrawerOpen(!filterDrawerOpen)}
                  style={{ height: 34, padding: '0 12px', fontSize: 11, background: '#1E293B', border: '1px solid #334155', color: '#F8FAFC', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <SlidersHorizontal size={14} /> Filtros Avançados
                </button>
              )}
            </div>

            {/* Expanded Advanced Filters */}
            {(!isMobile || filterDrawerOpen) && (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', paddingTop: 8, borderTop: '1px solid var(--border-subtle, #1E293B)' }}>
                <input
                  value={municipioInput}
                  onChange={e => setMunicipioInput(e.target.value)}
                  onBlur={() => updateParams({ municipality: municipioInput || undefined, page: 1 })}
                  placeholder="Filtrar por município..."
                  style={{ width: 160, height: 30, padding: '0 8px', fontSize: 11, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', borderRadius: 6 }}
                />

                <input
                  value={empresaInput}
                  onChange={e => setEmpresaInput(e.target.value)}
                  onBlur={() => updateParams({ company: empresaInput || undefined, page: 1 })}
                  placeholder="Filtrar por empresa / CNPJ..."
                  style={{ width: 170, height: 30, padding: '0 8px', fontSize: 11, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', borderRadius: 6 }}
                />

                <input
                  type="number"
                  value={valMin}
                  onChange={e => updateParams({ min: e.target.value || undefined, page: 1 })}
                  placeholder="Valor mín (R$)..."
                  style={{ width: 120, height: 30, padding: '0 8px', fontSize: 11, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', borderRadius: 6 }}
                />

                <input
                  type="number"
                  value={valMax}
                  onChange={e => updateParams({ max: e.target.value || undefined, page: 1 })}
                  placeholder="Valor máx (R$)..."
                  style={{ width: 120, height: 30, padding: '0 8px', fontSize: 11, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', borderRadius: 6 }}
                />

                {/* Toggles */}
                <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                  <input type="checkbox" checked={hasDecisor} onChange={e => updateParams({ hasDecisor: e.target.checked || undefined, page: 1 })} />
                  Possui Decisor
                </label>

                <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                  <input type="checkbox" checked={hasSupplier} onChange={e => updateParams({ hasSupplier: e.target.checked || undefined, page: 1 })} />
                  Possui Prestador
                </label>

                <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                  <input type="checkbox" checked={hasOpportunity} onChange={e => updateParams({ hasOpportunity: e.target.checked || undefined, page: 1 })} />
                  Possui Oportunidade
                </label>

                <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                  <input type="checkbox" checked={hasInputs} onChange={e => updateParams({ hasInputs: e.target.checked || undefined, page: 1 })} />
                  Possui Insumos
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
            )}

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
              Carregando catálogo oficial de obras...
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Nome da Obra <ArrowUpDown size={12} /></div>
                  </th>
                  <th style={{ padding: '10px 8px', cursor: 'pointer' }} onClick={() => updateParams({ sort: 'municipality_asc', page: 1 })}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Município / UF <ArrowUpDown size={12} /></div>
                  </th>
                  <th style={{ padding: '10px 8px', cursor: 'pointer' }} onClick={() => updateParams({ sort: 'phase_asc', page: 1 })}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Fase <ArrowUpDown size={12} /></div>
                  </th>
                  <th style={{ padding: '10px 8px', cursor: 'pointer' }} onClick={() => updateParams({ sort: 'sector_asc', page: 1 })}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Setor <ArrowUpDown size={12} /></div>
                  </th>
                  <th style={{ padding: '10px 8px', cursor: 'pointer' }} onClick={() => updateParams({ sort: sort === 'investment_desc' ? 'investment_asc' : 'investment_desc', page: 1 })}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>CAPEX <ArrowUpDown size={12} /></div>
                  </th>
                  <th style={{ padding: '10px 8px' }}>Empresa Vinculada</th>
                  <th style={{ padding: '10px 8px', cursor: 'pointer' }} onClick={() => updateParams({ sort: 'priority_desc', page: 1 })}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Prioridade <ArrowUpDown size={12} /></div>
                  </th>
                  <th style={{ padding: '10px 8px' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {works.length === 0 && !loading ? (
                  <tr>
                    <td colSpan={8} style={{ padding: 32, textAlign: 'center', color: 'var(--text-tertiary)' }}>
                      Nenhuma obra encontrada para a combinação de filtros selecionada.
                    </td>
                  </tr>
                ) : (
                  works.map((w) => {
                    const capex = fmtMoney(w.investment);
                    const companyCnpj = w.companyCnpj || (w.companyIds && w.companyIds[0]);
                    const companyName = w.companyName || (w.company && w.company.name);

                    return (
                      <tr 
                        key={w.id} 
                        style={{ borderBottom: '1px solid var(--border-subtle, #1E293B)' }}
                        className="hover-row"
                      >
                        <td style={{ padding: '12px 8px', fontWeight: 600 }}>
                          <Link 
                            to={`/engenharia/obras/${w.id}`} 
                            style={{ color: '#3B82F6', textDecoration: 'none' }}
                          >
                            {w.name}
                          </Link>
                          {w.source && (
                            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 400, marginTop: 2 }}>
                              Fonte: {w.source} ({w.sourceType || 'OFICIAL'})
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>{w.municipality}, {w.state}</td>
                        <td style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>
                          <span style={{ padding: '2px 6px', fontSize: 10, borderRadius: 4, background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-subtle)' }}>
                            {w.phase}
                          </span>
                        </td>
                        <td style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>{w.sector}</td>
                        <td style={{ padding: '12px 8px' }}>
                          <div style={{ fontWeight: 600, color: capex.hasValue ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                            {capex.text}
                          </div>
                          <div style={{ fontSize: 9, fontWeight: 700, color: w.capexTaxonomy === 'HOMOLOGADO' ? '#22C55E' : '#94A3B8', textTransform: 'uppercase' }}>
                            {w.capexTaxonomy || 'ESTIMADO_REGRA'}
                          </div>
                        </td>
                        <td style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>
                          {companyCnpj ? (
                            <div>
                              <Link 
                                to={`/empresas/${companyCnpj}`} 
                                style={{ color: '#8B5CF6', textDecoration: 'underline', fontWeight: 500 }}
                              >
                                {companyName || `CNPJ ${fmtCnpj(companyCnpj)}`}
                              </Link>
                              <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                                {fmtCnpj(companyCnpj)} · <span style={{ fontStyle: 'italic' }}>{w.companyRole || 'responsável'}</span>
                              </div>
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>Sem CNPJ vinculado</span>
                          )}
                        </td>
                        <td style={{ padding: '12px 8px' }}>
                          <span style={{
                            padding: '2px 8px', fontSize: 10, fontWeight: 700, borderRadius: 10,
                            background: w.commercialPriority === 'Ouro' ? 'rgba(234,179,8,0.15)' : w.commercialPriority === 'Prata' ? 'rgba(148,163,184,0.15)' : 'rgba(217,119,6,0.15)',
                            border: `1px solid ${w.commercialPriority === 'Ouro' ? '#EAB308' : w.commercialPriority === 'Prata' ? '#94A3B8' : '#D97706'}`,
                            color: w.commercialPriority === 'Ouro' ? '#EAB308' : w.commercialPriority === 'Prata' ? '#94A3B8' : '#D97706',
                          }}>
                            {w.commercialPriority === 'Ouro' ? '🥇 Ouro' : w.commercialPriority === 'Prata' ? '🥈 Prata' : '🥉 Bronze'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 8px' }}>
                          <Link
                            to={`/engenharia/obras/${w.id}`}
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
                Exibindo {startItem.toLocaleString('pt-BR')}–{endItem.toLocaleString('pt-BR')} de {totalCount.toLocaleString('pt-BR')} obras visíveis
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
