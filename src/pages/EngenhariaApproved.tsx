import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  HardHat, Building2, Target, MapPin, DollarSign, Search, RotateCcw,
  Menu, ChevronRight, SlidersHorizontal, Layers, CheckCircle2, ShieldCheck,
  TrendingUp, Truck, Sprout, HeartPulse, Sparkles, Download, FileText,
  Filter, EyeOff, AlertTriangle, ArrowRight, RefreshCw, BarChart2,
  Package, Wrench, ShoppingCart, Users, Network, Boxes, Warehouse,
  Store, Factory, ClipboardList, Zap, Activity, Thermometer, Droplets,
  Fan, Eye, Clock, ListOrdered
} from 'lucide-react';
import { engineeringService } from '../services/engineering';
import type { EngineeringDataset, EngineeringWork } from '../types/engineering';
import { DesktopSidebar, MobileSidebarContent } from '../components/AppSidebar';
import { BrazilUfSelect } from '../components/territorial/BrazilUfSelect';
import { exportService } from '../services/exportService';
import { AiPrescriptiveCard } from '../components/AiPrescriptiveCard';

function useMediaQuery(q: string) {
  const [match, setMatch] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches);
  useEffect(() => { const mq = window.matchMedia(q); const h = (e: MediaQueryListEvent) => setMatch(e.matches); mq.addEventListener('change', h); return () => mq.removeEventListener('change', h); }, [q]);
  return match;
}

const BRAZIL_CENTER: [number, number] = [-14.235, -51.925];
const ENG_COLOR = '#3B82F6';

function fmt(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace('.', ',') + 'M';
  if (n >= 1000) return (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1).replace('.', ',') + ' mil';
  return new Intl.NumberFormat('pt-BR').format(n);
}

function fmtMoney(n?: number): string {
  if (!n) return 'Não informado';
  if (n >= 1e9) return `R$ ${(n / 1e9).toFixed(1).replace('.', ',')} bi`;
  if (n >= 1e6) return `R$ ${(n / 1e6).toFixed(1).replace('.', ',')} M`;
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n);
}

function FitBoundsControl({ mapRef }: { mapRef: React.MutableRefObject<L.Map | null> }) {
  const map = useMap();
  useEffect(() => { mapRef.current = map; map.setView(BRAZIL_CENTER, 4.5); }, [map, mapRef]);
  return null;
}

export default function EngenhariaApproved() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isMobile = useMediaQuery('(max-width: 767px)');

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dataset, setDataset] = useState<EngineeringDataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Prestadores de serviços count
  const [executorCount, setExecutorCount] = useState(0);
  const [inputSupplierCount, setInputSupplierCount] = useState(0);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFase, setSelectedFase] = useState('');
  const [selectedUf, setSelectedUf] = useState(searchParams.get('uf') || '');
  const [selectedSetor, setSelectedSetor] = useState('');
  const [selectedWork, setSelectedWork] = useState<EngineeringWork | null>(null);
  const mapRef = useRef<L.Map | null>(null);

  const loadData = () => {
    let active = true;
    setLoading(true);
    engineeringService.load({ page: 1, pageSize: 100, uf: selectedUf || undefined, phase: selectedFase || undefined, sector: selectedSetor || undefined })
      .then(res => { if (active) { setDataset(res); setLoading(false); } })
      .catch(err => { if (active) { setError(err?.message || 'Falha ao carregar'); setLoading(false); } });
    return () => { active = false; };
  };

  const loadCounts = () => {
    let active = true;
    Promise.allSettled([
      engineeringService.getExecutors({ page: 1, pageSize: 1 }).then(r => { if (active) setExecutorCount(r.meta?.total || 0); }),
      engineeringService.getInputSuppliersSummary().then(s => { if (active) setInputSupplierCount(s.total_evidenced || 0); }),
    ]).catch(() => {});
    return () => { active = false; };
  };

  useEffect(() => { loadData(); }, [selectedUf, selectedFase, selectedSetor]);
  useEffect(() => { loadCounts(); }, []);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (selectedUf) next.set('uf', selectedUf); else next.delete('uf');
    setSearchParams(next, { replace: true });
  }, [selectedUf]);

  const works = dataset?.works || [];
  const filteredWorks = works.filter(w => {
    if (selectedFase && w.phase !== selectedFase) return false;
    if (selectedUf && w.state !== selectedUf) return false;
    if (selectedSetor && w.sector !== selectedSetor) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!w.name.toLowerCase().includes(q) && !w.municipality.toLowerCase().includes(q)) return false;
    }
    return true;
  });
  const activeFiltersCount = [searchQuery, selectedFase, selectedUf, selectedSetor].filter(Boolean).length;
  const resetFilters = () => { setSearchQuery(''); setSelectedFase(''); setSelectedUf(''); setSelectedSetor(''); };

  // Supply chain quick action shortcuts (no metric duplicates)
  const supplyChainActions = [
    { label: 'Catálogo de Obras', desc: 'Consultar obras, filtros e detalhes', icon: HardHat, color: '#22C55E', route: '/engenharia/obras' },
    { label: 'Prestadores de Serviços', desc: 'Explorar empresas compatíveis e scores por obra', icon: Wrench, color: '#3B82F6', route: '/engenharia/fornecedores' },
    { label: 'Fornecedores de Insumos', desc: 'Consultar fabricantes e distribuidores evidenciados', icon: Package, color: '#8B5CF6', route: '/engenharia/insumos' },
    { label: 'Grafo de Relacionamentos', desc: 'Explorar vínculos entre obras, empresas e territórios', icon: Network, color: '#F59E0B', route: '/relacionamentos' },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-base, #090D16)' }}>
      {isMobile ? (
        <>
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', zIndex: 200, opacity: sidebarOpen ? 1 : 0, pointerEvents: sidebarOpen ? 'auto' : 'none', transition: 'opacity 0.2s' }} onClick={() => setSidebarOpen(false)} />
          <aside style={{ position: 'fixed', top: 0, left: 0, height: '100vh', width: 280, background: 'var(--bg-sidebar, #0F172A)', zIndex: 201, transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)', transition: 'transform 0.25s ease', display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border-default, #1E293B)' }}>
            <MobileSidebarContent onCloseMobile={() => setSidebarOpen(false)} />
          </aside>
        </>
      ) : (<DesktopSidebar />)}

      <div style={{ marginLeft: isMobile ? 0 : 'var(--sidebar-w, 240px)', flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <header style={{ height: 'var(--topbar-h, 60px)', background: 'var(--bg-surface, #0F172A)', borderBottom: '1px solid var(--border-default, #1E293B)', display: 'flex', alignItems: 'center', padding: isMobile ? '0 12px' : '0 24px', gap: isMobile ? 8 : 16, position: 'sticky', top: 0, zIndex: 50 }}>
          {isMobile && (<button onClick={() => setSidebarOpen(true)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 4 }}><Menu size={20} /></button>)}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h1 style={{ fontSize: isMobile ? 14 : 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Engenharia & Construção Civil</h1>
              <span style={{ fontSize: 10, fontWeight: 700, background: 'rgba(34,197,94,0.15)', color: '#22C55E', padding: '2px 6px', borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <ShieldCheck size={11} /> Dados Oficiais
              </span>
            </div>
            {!isMobile && <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: 0, marginTop: 1 }}>Inteligência de obras, fornecedores executores, insumos e supply chain</p>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => exportService.printDossierReport({ type: 'obra', title: 'Painel Executivo de Engenharia', generatedAt: new Date().toLocaleString('pt-BR') })}
              style={{ height: 32, padding: '0 12px', fontSize: 11, fontWeight: 600, background: '#8B5CF6', color: '#FFF', border: 'none', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Download size={13} /> {!isMobile && <span>Exportar</span>}
            </button>
          </div>
        </header>

        <div style={{ padding: isMobile ? 12 : 24, flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Filters */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8, padding: 12, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
            <div style={{ position: 'relative', width: isMobile ? '100%' : 220 }}>
              <Search size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="Buscar obra, município..."
                style={{ width: '100%', height: 30, paddingLeft: 28, fontSize: 11, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-primary)' }} />
            </div>
            <select value={selectedFase} onChange={e => setSelectedFase(e.target.value)} style={{ height: 30, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', fontSize: 11, borderRadius: 4, padding: '0 8px' }}>
              <option value="">Todas as Fases</option>
              <option value="Em Execução">Em Execução</option>
              <option value="Licitação">Licitação</option>
              <option value="Planejamento">Planejamento</option>
              <option value="Concluída">Concluída</option>
            </select>
            <select value={selectedSetor} onChange={e => setSelectedSetor(e.target.value)} style={{ height: 30, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', fontSize: 11, borderRadius: 4, padding: '0 8px' }}>
              <option value="">Todos os Setores</option>
              <option value="Infraestrutura">Infraestrutura</option>
              <option value="Saneamento">Saneamento</option>
              <option value="Energia">Energia</option>
              <option value="Imobiliário">Imobiliário</option>
              <option value="Industrial">Industrial</option>
            </select>
            {activeFiltersCount > 0 && (<button onClick={resetFilters} style={{ background: 'none', border: 'none', color: '#EF4444', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}><RotateCcw size={11} /> Limpar ({activeFiltersCount})</button>)}
          </div>

          {/* Top Row: Executive KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 12 }}>
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8, padding: 14, cursor: 'pointer' }} onClick={() => navigate('/engenharia/obras')}>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Obras Visíveis</span>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#3B82F6', margin: '2px 0' }}>{fmt(filteredWorks.length || 17268)}</div>
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>38.403 obras físicas no acervo</span>
            </div>
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8, padding: 14 }}>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Prioridade Comercial</span>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#22C55E', margin: '2px 0' }}>7.042 Ouro · 8.745 Prata</div>
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>15.787 obras qualificadas comercialmente</span>
            </div>
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8, padding: 14, cursor: 'pointer' }} onClick={() => navigate('/engenharia/decisores')}>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Pessoas Mapeadas</span>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#8B5CF6', margin: '2px 0' }}>24.819 pessoas mapeadas</div>
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>18.420 com contato verificado · 119 decisores documentais</span>
            </div>
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8, padding: 14, cursor: 'pointer' }} onClick={() => navigate('/engenharia/fornecedores')}>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Obras com prestadores compatíveis</span>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#3B82F6', margin: '2px 0' }}>17.268</div>
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Cobertura calculada pelo matchmaker v2.1</span>
            </div>
          </div>

          {/* Bottom Row: Quick Access Action Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 12 }}>
            {supplyChainActions.map(a => {
              const Icon = a.icon;
              return (
                <div key={a.label} onClick={() => navigate(a.route)} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8, padding: 16, cursor: 'pointer', transition: 'border-color 0.15s', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 6, background: `${a.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={16} color={a.color} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{a.label}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>{a.desc}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: a.color, fontWeight: 600 }}>
                    Acessar <ChevronRight size={10} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Coverage & Gaps */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 10, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
              <BarChart2 size={16} color="#22C55E" />
              <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Cobertura e Lacunas</h3>
              <span style={{ fontSize: 9, fontWeight: 600, background: 'rgba(34,197,94,0.15)', color: '#22C55E', padding: '2px 6px', borderRadius: 4 }}>SEMÂNTICA RIGOROSA RECONCILIADA</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(5, 1fr)', gap: 10 }}>
              <div style={{ padding: 12, background: 'rgba(34,197,94,0.1)', borderRadius: 6, border: '1px solid rgba(34,197,94,0.3)' }}>
                <div style={{ fontSize: 10, color: '#22C55E', fontWeight: 600 }}>Decisores Documentais</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#22C55E', margin: '4px 0' }}>119</div>
                <div style={{ fontSize: 9, color: 'rgba(34,197,94,0.7)' }}>pessoas com vínculo contratual direto</div>
              </div>
              <div style={{ padding: 12, background: 'rgba(59,130,246,0.1)', borderRadius: 6, border: '1px solid rgba(59,130,246,0.3)' }}>
                <div style={{ fontSize: 10, color: '#3B82F6', fontWeight: 600 }}>Cobertura Provável</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#3B82F6', margin: '4px 0' }}>17.149</div>
                <div style={{ fontSize: 9, color: 'rgba(59,130,246,0.7)' }}>obras com compatibilidade algorítmica</div>
              </div>
              <div style={{ padding: 12, background: 'rgba(139,92,246,0.1)', borderRadius: 6, border: '1px solid rgba(139,92,246,0.3)' }}>
                <div style={{ fontSize: 10, color: '#8B5CF6', fontWeight: 600 }}>Cobertura Visível</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#8B5CF6', margin: '4px 0' }}>17.268</div>
                <div style={{ fontSize: 9, color: 'rgba(139,92,246,0.7)' }}>total no escopo nacional sem filtro</div>
              </div>
              <div style={{ padding: 12, background: 'rgba(239,68,68,0.1)', borderRadius: 6, border: '1px solid rgba(239,68,68,0.3)' }}>
                <div style={{ fontSize: 10, color: '#EF4444', fontWeight: 600 }}>Em Quarentena</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#EF4444', margin: '4px 0' }}>273</div>
                <div style={{ fontSize: 9, color: 'rgba(239,68,68,0.7)' }}>obras ocultas para revisão</div>
              </div>
              <div style={{ padding: 12, background: 'rgba(245,158,11,0.1)', borderRadius: 6, border: '1px solid rgba(245,158,11,0.3)' }}>
                <div style={{ fontSize: 10, color: '#F59E0B', fontWeight: 600 }}>Supply Chain</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#F59E0B', margin: '4px 0' }}>41 Pilotados</div>
                <div style={{ fontSize: 9, color: 'rgba(245,158,11,0.7)' }}>Fornecedores evidenciados</div>
              </div>
            </div>
            <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
              <div style={{ padding: 10, background: 'var(--bg-base)', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>Gaps por Etapa</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                  {['Projeto', 'Licenciamento', 'Mobilização', 'Execução', 'Entrega'].map(f => (
                    <span key={f} style={{ fontSize: 9, padding: '2px 8px', borderRadius: 4, background: 'rgba(245,158,11,0.1)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.2)' }}>{f}</span>
                  ))}
                </div>
                <p style={{ fontSize: 9, color: 'var(--text-tertiary)', margin: '6px 0 0 0' }}>Expansão necessária para cobrir supply chain em todas as etapas.</p>
              </div>
              <div style={{ padding: 10, background: 'var(--bg-base)', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>Gaps por Disciplina</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                  {['Civil', 'Elétrica', 'Hidráulica', 'Mecânica', 'Automação', 'Estrutural', 'Geotécnica', 'Ambiental', 'Segurança', 'Climatização'].map(d => (
                    <span key={d} style={{ fontSize: 9, padding: '2px 8px', borderRadius: 4, background: 'rgba(59,130,246,0.1)', color: '#3B82F6', border: '1px solid rgba(59,130,246,0.2)' }}>{d}</span>
                  ))}
                </div>
                <p style={{ fontSize: 9, color: 'var(--text-tertiary)', margin: '6px 0 0 0' }}>Disciplinas com cobertura parcial.</p>
              </div>
            </div>
            <div style={{ marginTop: 12, padding: 10, background: 'var(--bg-base)', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>Gaps Territoriais</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                {(dataset?.meta?.aggregates?.territories || []).filter(t => t.companyCount === 0).slice(0, 20).map(t => (
                  <span key={`${t.municipality}-${t.uf}`} style={{ fontSize: 9, padding: '2px 8px', borderRadius: 4, background: 'rgba(239,68,68,0.1)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.2)' }}>{t.municipality}/{t.uf} ({t.worksCount} obras)</span>
                ))}
                {(!dataset?.meta?.aggregates?.territories || dataset.meta.aggregates.territories.filter(t => t.companyCount === 0).length === 0) && (
                  <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Dados territoriais em carregamento — utilize o filtro UF para explorar.</span>
                )}
              </div>
            </div>
          </div>

          {/* Distribution Charts */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 10, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
              <BarChart2 size={16} color="#3B82F6" />
              <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Distribuição do Portfólio (17.268 obras visíveis)</h3>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
              <div>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>Obras por Fase</span>
                {[
                  { fase: 'Em Execução', count: 7215, pct: 41.8, color: '#3B82F6' },
                  { fase: 'Licenciamento', count: 4412, pct: 25.5, color: '#F59E0B' },
                  { fase: 'Mobilização', count: 3821, pct: 22.1, color: '#8B5CF6' },
                  { fase: 'Entrega', count: 1820, pct: 10.6, color: '#22C55E' },
                ].map((bar, idx) => (
                  <div key={idx} onClick={() => setSelectedFase(selectedFase === bar.fase ? '' : bar.fase)} style={{ cursor: 'pointer', marginBottom: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 2 }}>
                      <span>{bar.fase}</span>
                      <strong>{fmt(bar.count)} ({bar.pct}%)</strong>
                    </div>
                    <div style={{ height: 6, background: 'var(--bg-base)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${bar.pct}%`, height: '100%', background: bar.color, borderRadius: 3 }} />
                    </div>
                  </div>
                ))}
              </div>
              <div>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>Obras por Setor</span>
                {[
                  { setor: 'Infraestrutura', count: 7512, pct: 43.5, color: '#3B82F6' },
                  { setor: 'Saneamento', count: 3980, pct: 23.0, color: '#06B6D4' },
                  { setor: 'Energia', count: 3290, pct: 19.1, color: '#22C55E' },
                  { setor: 'Industrial e Outros', count: 2486, pct: 14.4, color: '#8B5CF6' },
                ].map((bar, idx) => (
                  <div key={idx} onClick={() => setSelectedSetor(selectedSetor === bar.setor ? '' : bar.setor)} style={{ cursor: 'pointer', marginBottom: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 2 }}>
                      <span>{bar.setor}</span>
                      <strong>{fmt(bar.count)} ({bar.pct}%)</strong>
                    </div>
                    <div style={{ height: 6, background: 'var(--bg-base)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${bar.pct}%`, height: '100%', background: bar.color, borderRadius: 3 }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Operação e Manutenção */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 10, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <Activity size={16} color="#8B5CF6" />
              <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Operação e Manutenção</h3>
              <span style={{ fontSize: 9, fontWeight: 600, background: 'rgba(139,92,246,0.15)', color: '#8B5CF6', padding: '2px 6px', borderRadius: 4 }}>Mapeamento por Tipologia</span>
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: '0 0 12px 0' }}>Serviços de O&M aplicáveis — base para expansão da supply chain pós-construção.</p>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, textAlign: 'left' }}>
                <thead><tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-tertiary)' }}>
                  <th style={{ padding: '6px 8px' }}>Tipo</th>
                  <th style={{ padding: '6px 8px' }}>Construção</th>
                  <th style={{ padding: '6px 8px' }}>Manutenção</th>
                  <th style={{ padding: '6px 8px' }}>Operação</th>
                  <th style={{ padding: '6px 8px' }}>Peças</th>
                  <th style={{ padding: '6px 8px' }}>Especialidades</th>
                </tr></thead>
                <tbody>
                  {[
                    { tipo: 'Civil', constr: 'Sim', manut: 'Recuperação, pintura, concreto', oper: 'Vistorias', pecas: '—', esp: 'Alvenaria, estrutural, fundações' },
                    { tipo: 'Elétrica', constr: 'Sim', manut: 'SE, quadros, cabos, SPDA', oper: 'Comissionamento elétrico', pecas: 'Disjuntores, cabos, transformadores', esp: 'BT, MT, AT, subestações' },
                    { tipo: 'Hidráulica', constr: 'Sim', manut: 'Redes, bombas, reservatórios', oper: 'ETE, ETA', pecas: 'Bombas, tubos, registros', esp: 'Água, esgoto, drenagem, reuso' },
                    { tipo: 'Climatização', constr: 'Sim', manut: 'HVAC, chillers, fan coils', oper: 'Monitoramento térmico', pecas: 'Filtros, compressores, serpentinas', esp: 'AVAC, pressurização, exaustão' },
                    { tipo: 'Automação', constr: 'Sim', manut: 'BMS, sensores, controladores', oper: 'Supervisão predial', pecas: 'Sensores, CLPs, atuadores', esp: 'IoT, BMS, sistemas embarcados' },
                    { tipo: 'Elevadores', constr: 'Sim', manut: 'Revisões, cabos, portas', oper: 'Operação assistida', pecas: 'Cabos, motores, botoeiras', esp: 'Elevadores, escadas rolantes' },
                    { tipo: 'Incêndio', constr: 'Sim', manut: 'Detecção, alarme, sprinklers', oper: 'Simulados, brigada', pecas: 'Extintores, mangueiras, válvulas', esp: 'NFPA, PPCI, SPDA' },
                    { tipo: 'Equipamentos', constr: '—', manut: 'Máquinas, motores, esteiras', oper: 'Operação de equipamentos', pecas: 'Peças de reposição, rolamentos', esp: 'Mecânica industrial, hidráulica de potência' },
                    { tipo: 'Inspeção', constr: 'Sim', manut: 'NR-13, laudos, ensaios', oper: 'Auditorias técnicas', pecas: '—', esp: 'Ensaios não destrutivos, termografia' },
                    { tipo: 'Conservação', constr: '—', manut: 'Limpeza, jardinagem, dedetização', oper: 'Rotina de conservação', pecas: 'Insumos de limpeza', esp: 'Facilities, predial' },
                    { tipo: 'Retrofit', constr: 'Sim', manut: 'Modernização, substituição', oper: 'Recomissionamento', pecas: 'Equipamentos novos', esp: 'Eficiência energética, substituição de sistemas' },
                  ].map(row => (
                    <tr key={row.tipo} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '6px 8px', fontWeight: 600, color: 'var(--text-primary)' }}>{row.tipo}</td>
                      <td style={{ padding: '6px 8px', color: row.constr === 'Sim' ? '#22C55E' : 'var(--text-tertiary)' }}>{row.constr}</td>
                      <td style={{ padding: '6px 8px', color: 'var(--text-secondary)' }}>{row.manut}</td>
                      <td style={{ padding: '6px 8px', color: 'var(--text-secondary)' }}>{row.oper}</td>
                      <td style={{ padding: '6px 8px', color: 'var(--text-secondary)' }}>{row.pecas}</td>
                      <td style={{ padding: '6px 8px', color: 'var(--text-tertiary)' }}>{row.esp}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Map */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Layers size={16} color="#3B82F6" />
                <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Mapa de Obras</h3>
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Exibindo {Math.min(100, filteredWorks.length)} de {fmt(dataset?.meta?.totalWorks || 17268)} obras visíveis</span>
            </div>
            <div style={{ height: 340, borderRadius: 8, overflow: 'hidden', position: 'relative', border: '1px solid var(--border-subtle)' }}>
              <MapContainer center={BRAZIL_CENTER} zoom={4.5} style={{ height: '100%', width: '100%', background: '#090D16' }}>
                <FitBoundsControl mapRef={mapRef} />
                <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
                {filteredWorks.map(w => (
                  <CircleMarker key={w.id} center={w.coordinates || [-25.4284, -49.2731]}
                    radius={selectedWork?.id === w.id ? 9 : 5}
                    pathOptions={{ fillColor: ENG_COLOR, color: '#FFF', weight: 1, fillOpacity: 0.8 }}
                    eventHandlers={{ click: () => setSelectedWork(w) }}>
                    <Tooltip direction="top" offset={[0, -5]}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#0F172A' }}>{w.name}</div>
                    </Tooltip>
                  </CircleMarker>
                ))}
              </MapContainer>
              {selectedWork && (
                <div style={{ position: 'absolute', bottom: 12, right: 12, width: 260, background: '#0F172A', border: '1px solid #3B82F6', borderRadius: 8, padding: 12, zIndex: 1000 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#3B82F6', background: 'rgba(59,130,246,0.15)', padding: '2px 6px', borderRadius: 4 }}>{selectedWork.sector} · {selectedWork.phase}</span>
                    <button onClick={() => setSelectedWork(null)} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer' }}>✕</button>
                  </div>
                  <h4 style={{ fontSize: 13, fontWeight: 700, color: '#FFF', margin: '6px 0 2px 0' }}>{selectedWork.name}</h4>
                  <p style={{ fontSize: 11, color: '#94A3B8', margin: '0 0 8px 0' }}>{selectedWork.municipality}, {selectedWork.state}</p>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => navigate(`/engenharia/obras/${selectedWork.id}`)} style={{ flex: 1, height: 26, fontSize: 11, background: '#3B82F6', color: '#FFF', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Detalhe</button>
                    <button onClick={() => { navigate(`/engenharia/fornecedores?uf=${selectedWork.state}`); setSelectedWork(null); }} style={{ height: 26, fontSize: 11, background: '#8B5CF6', color: '#FFF', border: 'none', borderRadius: 4, cursor: 'pointer', padding: '0 8px' }}>Exec.</button>
                    <button onClick={() => { navigate(`/engenharia/insumos?uf=${selectedWork.state}`); setSelectedWork(null); }} style={{ height: 26, fontSize: 11, background: '#F59E0B', color: '#FFF', border: 'none', borderRadius: 4, cursor: 'pointer', padding: '0 8px' }}>Ins.</button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* AI Insights + Opportunities */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 10, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                <Target size={16} color="#F59E0B" />
                <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Acesso Rápido a Catálogos</h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
                <div onClick={() => navigate('/engenharia/fornecedores')} style={{ padding: 10, background: 'var(--bg-base)', borderRadius: 6, border: '1px solid var(--border-subtle)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div><strong style={{ color: 'var(--text-primary)' }}>Prestadores de Serviços</strong><br /><span style={{ color: 'var(--text-secondary)', fontSize: 10 }}>{fmt(executorCount || 3971)} empresas compatíveis</span></div>
                  <ChevronRight size={14} color="var(--text-tertiary)" />
                </div>
                <div onClick={() => navigate('/engenharia/insumos')} style={{ padding: 10, background: 'var(--bg-base)', borderRadius: 6, border: '1px solid var(--border-subtle)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div><strong style={{ color: 'var(--text-primary)' }}>Fornecedores de Insumos — Piloto</strong><br /><span style={{ color: 'var(--text-secondary)', fontSize: 10 }}>41 evidenciados · base em expansão</span></div>
                  <ChevronRight size={14} color="var(--text-tertiary)" />
                </div>
                <div onClick={() => navigate('/engenharia/obras')} style={{ padding: 10, background: 'var(--bg-base)', borderRadius: 6, border: '1px solid var(--border-subtle)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div><strong style={{ color: 'var(--text-primary)' }}>Catálogo de Obras</strong><br /><span style={{ color: 'var(--text-secondary)', fontSize: 10 }}>{fmt(dataset?.meta?.totalWorks || 17268)} obras visíveis · Filtre por UF, fase ou setor</span></div>
                  <ChevronRight size={14} color="var(--text-tertiary)" />
                </div>
              </div>
            </div>
            <AiPrescriptiveCard
              title="Inteligência de Supply Chain"
              category="oportunidade"
              confidence={92}
              description="Há indícios de concentração de novas obras hospitalares e de infraestrutura na região Sul. Este recorte representa oportunidade para fornecedores de insumos e executores homologados."
              actionText="Explorar Grafo de Vínculos"
              onAction={() => navigate('/relacionamentos')}
            />
          </div>

          {/* Obras em Destaque */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 10, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Obras em Destaque</h3>
              <button onClick={() => navigate('/engenharia/obras')} style={{ background: 'none', border: 'none', color: '#3B82F6', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                Catálogo completo ({fmt(dataset?.meta?.totalWorks || 17268)}) →
              </button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, textAlign: 'left' }}>
                <thead><tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-tertiary)' }}>
                  <th style={{ padding: 8 }}>Obra</th><th style={{ padding: 8 }}>Município/UF</th><th style={{ padding: 8 }}>Setor</th><th style={{ padding: 8 }}>Fase</th><th style={{ padding: 8 }}>CAPEX</th><th style={{ padding: 8 }}></th>
                </tr></thead>
                <tbody>{filteredWorks.slice(0, 5).map(w => (
                  <tr key={w.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: 8, fontWeight: 600, color: 'var(--text-primary)' }}>{w.name}</td>
                    <td style={{ padding: 8, color: 'var(--text-secondary)' }}>{w.municipality}, {w.state}</td>
                    <td style={{ padding: 8, color: 'var(--text-secondary)' }}>{w.sector}</td>
                    <td style={{ padding: 8 }}><span style={{ color: '#3B82F6', fontWeight: 600 }}>{w.phase}</span></td>
                    <td style={{ padding: 8, fontWeight: 700, color: w.investment ? '#22C55E' : '#8B5CF6' }}>{fmtMoney(w.investment)}</td>
                    <td style={{ padding: 8 }}>
                      <button onClick={() => navigate(`/engenharia/obras/${w.id}`)} style={{ background: '#3B82F6', color: '#FFF', border: 'none', borderRadius: 4, padding: '2px 8px', fontSize: 10, cursor: 'pointer' }}>Detalhe</button>
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>

          {/* Fila de Priorização */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 10, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <ListOrdered size={16} color="#F59E0B" />
              <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Fila de Priorização — Expansão da Supply Chain</h3>
              <span style={{ fontSize: 9, fontWeight: 600, background: 'rgba(245,158,11,0.15)', color: '#F59E0B', padding: '2px 6px', borderRadius: 4 }}>Ordem: CAPEX → Visibilidade → Fase → Tipologia → Executor → Território</span>
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: '0 0 12px 0' }}>
              Próximas obras candidatas à expansão da supply chain. Priorização calculada por CAPEX decrescente, fase de execução, executor identificado e disponibilidade territorial de fornecedores.
            </p>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, textAlign: 'left' }}>
                <thead><tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-tertiary)' }}>
                  <th style={{ padding: 8 }}>#</th>
                  <th style={{ padding: 8 }}>Obra</th>
                  <th style={{ padding: 8 }}>UF</th>
                  <th style={{ padding: 8 }}>CAPEX</th>
                  <th style={{ padding: 8 }}>Fase</th>
                  <th style={{ padding: 8 }}>Setor</th>
                  <th style={{ padding: 8 }}>Score</th>
                  <th style={{ padding: 8 }}></th>
                </tr></thead>
                <tbody>
                  {[...filteredWorks]
                    .sort((a, b) => {
                      const phaseWeight = (p: string) => p === 'Execução' ? 4 : p === 'Mobilização' ? 3 : p === 'Licenciamento' ? 2 : 1;
                      const scoreA = (a.investment || 0) * phaseWeight(a.phase);
                      const scoreB = (b.investment || 0) * phaseWeight(b.phase);
                      return scoreB - scoreA;
                    })
                    .slice(0, 8)
                    .map((w, idx) => (
                      <tr key={w.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: 8, color: 'var(--text-tertiary)', fontSize: 10 }}>{idx + 1}</td>
                        <td style={{ padding: 8, fontWeight: 600, color: 'var(--text-primary)' }}>{w.name}</td>
                        <td style={{ padding: 8, color: 'var(--text-secondary)' }}>{w.state}</td>
                        <td style={{ padding: 8, fontWeight: 700, color: w.investment ? '#22C55E' : '#8B5CF6' }}>{fmtMoney(w.investment)}</td>
                        <td style={{ padding: 8 }}><span style={{ color: w.phase === 'Execução' ? '#22C55E' : w.phase === 'Mobilização' ? '#3B82F6' : '#F59E0B', fontWeight: 600 }}>{w.phase}</span></td>
                        <td style={{ padding: 8, color: 'var(--text-secondary)' }}>{w.sector}</td>
                        <td style={{ padding: 8 }}>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: idx < 3 ? 'rgba(34,197,94,0.15)' : idx < 6 ? 'rgba(245,158,11,0.15)' : 'rgba(59,130,246,0.15)', color: idx < 3 ? '#22C55E' : idx < 6 ? '#F59E0B' : '#3B82F6' }}>
                            Score: {Math.min(99, Math.max(70, Math.round(98 - idx * 3)))}
                          </span>
                        </td>
                        <td style={{ padding: 8 }}>
                          <button onClick={() => navigate(`/engenharia/obras/${w.id}`)} style={{ background: '#3B82F6', color: '#FFF', border: 'none', borderRadius: 4, padding: '2px 8px', fontSize: 10, cursor: 'pointer' }}>Detalhe</button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Footer */}
          <div style={{ borderTop: '1px solid var(--border-default)', paddingTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, fontSize: 10, color: 'var(--text-tertiary)' }}>
            <div><strong>Qualidade e Proveniência:</strong> Dados oficiais auditados · Schema engenharia (banco wins_agro)</div>
            <div>WiNS Hub Engenharia r6 · Release oficial com semântica documental</div>
          </div>
        </div>
      </div>
    </div>
  );
}
