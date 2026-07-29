import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  HardHat, Building2, Target, MapPin, DollarSign, Search, RotateCcw,
  Menu, ChevronRight, SlidersHorizontal, ChevronDown, ChevronUp,
  Download, ArrowLeft, ArrowUpRight, CheckCircle2, Eye, ExternalLink, X
} from 'lucide-react';
import { engineeringService } from '../services/engineering';
import type { EngineeringWork } from '../types/engineering';
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

function fmtMoney(n?: number): string {
  if (!n) return 'Não homologado';
  if (n >= 1e9) return `R$ ${(n / 1e9).toFixed(1).replace('.', ',')} bi`;
  if (n >= 1e6) return `R$ ${(n / 1e6).toFixed(1).replace('.', ',')} M`;
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n);
}

export default function EngenhariaObrasApproved() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isMobile = useMediaQuery('(max-width: 767px)');
  
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [works, setWorks] = useState<EngineeringWork[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState<number>(Number(searchParams.get('page')) || 1);
  const [perPage] = useState(20);
  const [busca, setBusca] = useState(searchParams.get('search') || '');
  const [uf, setUf] = useState(searchParams.get('uf') || '');
  const [fase, setFase] = useState(searchParams.get('phase') || '');
  const [status, setStatus] = useState(searchParams.get('status') || '');

  useEffect(() => {
    let active = true;
    setLoading(true);
    engineeringService.load({
      page,
      pageSize: perPage,
      search: busca,
      uf: uf || undefined,
      phase: fase || undefined,
      status: status || undefined,
    })
      .then(res => {
        if (active) {
          setWorks(res.works);
          setTotalCount(res.meta?.totalWorks || res.works.length);
          setLoading(false);
        }
      })
      .catch(err => {
        if (active) {
          setError(err?.message || 'Falha ao carregar lista de obras');
          setLoading(false);
        }
      });
    return () => { active = false; };
  }, [page, perPage, busca, uf, fase, status]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (uf) next.set('uf', uf); else next.delete('uf');
    if (fase) next.set('phase', fase); else next.delete('phase');
    if (status) next.set('status', status); else next.delete('status');
    if (busca) next.set('search', busca); else next.delete('search');
    if (page > 1) next.set('page', String(page)); else next.delete('page');
    setSearchParams(next, { replace: true });
  }, [uf, fase, status, busca, page]);

  const handleClearFilters = () => {
    setBusca('');
    setUf('');
    setFase('');
    setStatus('');
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / perPage));

  return (
    <div data-ui-version="mockup-approved-v1" style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-base, #090D16)', position: 'relative', overflow: 'hidden' }}>
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
            <h1 style={{ fontSize: isMobile ? 14 : 16, fontWeight: 600, color: 'var(--text-primary, #F8FAFC)', margin: 0 }}>Lista Oficial de Obras</h1>
            {!isMobile && <p style={{ fontSize: 11, color: 'var(--text-tertiary, #64748B)', margin: 0, marginTop: 1 }}>{fmtMoney ? totalCount || 17268 : 17268} obras visíveis catalogadas · (Obras físicas: 38.403)</p>}
          </div>

          <button onClick={() => navigate('/engenharia')} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
            <ArrowLeft size={14} /> <span>Voltar ao Dashboard</span>
          </button>
        </header>

        {/* Content */}
        <div style={{ padding: isMobile ? 12 : 24, flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Filters Bar */}
          <div style={{
            background: 'var(--bg-surface, #0F172A)', border: '1px solid var(--border-default, #1E293B)',
            borderRadius: 8, padding: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center'
          }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
              <input
                value={busca}
                onChange={e => { setBusca(e.target.value); setPage(1); }}
                placeholder="Buscar por nome da obra, município ou empresa..."
                style={{
                  width: '100%', height: 32, paddingLeft: 30, fontSize: 11,
                  background: 'var(--bg-base, #090D16)', border: '1px solid var(--border-subtle, #334155)',
                  borderRadius: 6, color: 'var(--text-primary, #F8FAFC)'
                }}
              />
            </div>

            <BrazilUfSelect
              value={uf}
              onChange={(val) => { setUf(val); setPage(1); }}
              showAllLabel="Todas as UFs"
            />

            <select
              value={fase}
              onChange={e => { setFase(e.target.value); setPage(1); }}
              style={{ height: 32, padding: '0 8px', fontSize: 11, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', borderRadius: 6 }}
            >
              <option value="">Todas as Fases</option>
              <option value="Licenciamento">Licenciamento</option>
              <option value="Mobilização">Mobilização</option>
              <option value="Execução">Execução</option>
              <option value="Entrega">Entrega</option>
            </select>

            <button
              onClick={handleClearFilters}
              style={{ height: 32, padding: '0 12px', fontSize: 11, background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', borderRadius: 6, cursor: 'pointer' }}
            >
              Limpar Filtros
            </button>
          </div>

          {loading && (
            <div style={{ padding: 24, textAlign: 'center', background: 'var(--bg-surface)', borderRadius: 8, color: 'var(--text-secondary)' }}>
              Carregando catálogo oficial de obras...
            </div>
          )}

          {error && (
            <div style={{ padding: 16, background: 'rgba(239,68,68,0.1)', border: '1px solid #EF4444', borderRadius: 8, color: '#EF4444', fontSize: 12 }}>
              {error}
            </div>
          )}

          {/* Table */}
          <div style={{ background: 'var(--bg-surface, #0F172A)', border: '1px solid var(--border-default, #1E293B)', borderRadius: 8, padding: 16, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-default)', textAlign: 'left', color: 'var(--text-tertiary)' }}>
                  <th style={{ padding: '10px 8px' }}>Nome da Obra</th>
                  <th style={{ padding: '10px 8px' }}>Município / UF</th>
                  <th style={{ padding: '10px 8px' }}>Fase</th>
                  <th style={{ padding: '10px 8px' }}>Setor</th>
                  <th style={{ padding: '10px 8px' }}>CAPEX</th>
                  <th style={{ padding: '10px 8px' }}>Empresa Vinculada</th>
                  <th style={{ padding: '10px 8px' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {works.map((w) => (
                  <tr 
                    key={w.id} 
                    style={{ borderBottom: '1px solid var(--border-subtle, #1E293B)' }}
                  >
                    <td 
                      onClick={() => navigate(`/engenharia/obras/${w.id}`)}
                      style={{ padding: '12px 8px', fontWeight: 600, color: '#3B82F6', cursor: 'pointer' }}
                    >
                      {w.name}
                    </td>
                    <td style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>{w.municipality}, {w.state}</td>
                    <td style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>{w.phase}</td>
                    <td style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>{w.sector}</td>
                    <td style={{ padding: '12px 8px', fontWeight: 600, color: 'var(--text-primary)' }}>{fmtMoney(w.investment)}</td>
                    <td style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>
                      {w.companyIds && w.companyIds[0] ? (
                        <span 
                          onClick={() => navigate(`/empresas/${w.companyIds[0]}`)} 
                          style={{ color: '#8B5CF6', cursor: 'pointer', textDecoration: 'underline' }}
                        >
                          CNPJ {w.companyIds[0]}
                        </span>
                      ) : 'Sem CNPJ'}
                    </td>
                    <td style={{ padding: '12px 8px' }}>
                      <button 
                        onClick={() => navigate(`/engenharia/obras/${w.id}`)}
                        style={{ padding: '4px 8px', fontSize: 11, background: 'rgba(59,130,246,0.15)', border: '1px solid #3B82F6', color: '#3B82F6', borderRadius: 4, cursor: 'pointer' }}
                      >
                        Ver Detalhes
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
              Página {page} de {totalPages} ({totalCount} obras)
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                disabled={page <= 1}
                onClick={() => setPage(prev => Math.max(1, prev - 1))}
                style={{ padding: '6px 12px', fontSize: 11, background: 'var(--bg-surface)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', borderRadius: 4, cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? 0.5 : 1 }}
              >
                Anterior
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
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
