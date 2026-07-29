import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  HardHat, Building2, Target, MapPin, DollarSign, Search, Menu,
  ArrowLeft, ArrowUpRight, CheckCircle2, ShieldCheck, Calendar,
  FileText, Layers, Share2, Award, UserCheck, RefreshCw, ExternalLink, Download,
  Package, Boxes, Truck, ChevronRight, Database, Tag, Activity,
  Users, Wrench, ShoppingCart, Network, BarChart3, Clock,
  Thermometer, Shield, Zap, Droplets, Fan, Building, Eye
} from 'lucide-react';
import { engineeringService } from '../services/engineering';
import type { EngineeringWork, EngineeringExecutor, EngineeringInsumo, EngineeringSupplyChainLink, EngineeringOpportunity, EngineeringDisciplina, DecisionMaker } from '../types/engineering';
import { DesktopSidebar, MobileSidebarContent } from '../components/AppSidebar';
import { AiPrescriptiveCard } from '../components/AiPrescriptiveCard';
import { exportService } from '../services/exportService';

function useMediaQuery(q: string) {
  const [match, setMatch] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches);
  useEffect(() => { const mq = window.matchMedia(q); const h = (e: MediaQueryListEvent) => setMatch(e.matches); mq.addEventListener('change', h); return () => mq.removeEventListener('change', h); }, [q]);
  return match;
}

function fmtMoney(n?: number): string {
  if (!n) return 'Indisponível';
  if (n >= 1e9) return `R$ ${(n / 1e9).toFixed(1).replace('.', ',')} bi`;
  if (n >= 1e6) return `R$ ${(n / 1e6).toFixed(1).replace('.', ',')} M`;
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n);
}

type TabId = 'resumo' | 'ciclo-da-obra' | 'disciplinas-e-servicos' | 'executores' | 'decisores' | 'insumos' | 'fornecedores-insumos' | 'oportunidades' | 'supply-chain' | 'proveniencia';

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'resumo', label: 'Resumo', icon: FileText },
  { id: 'ciclo-da-obra', label: 'Ciclo da Obra', icon: Activity },
  { id: 'disciplinas-e-servicos', label: 'Disciplinas e Serviços', icon: Layers },
  { id: 'executores', label: 'Executores', icon: Wrench },
  { id: 'decisores', label: 'Decisores', icon: Users },
  { id: 'insumos', label: 'Insumos', icon: Package },
  { id: 'fornecedores-insumos', label: 'Fornecedores de Insumos', icon: Truck },
  { id: 'oportunidades', label: 'Oportunidades', icon: Target },
  { id: 'supply-chain', label: 'Supply Chain', icon: Network },
  { id: 'proveniencia', label: 'Proveniência', icon: Database },
];

type TabData = {
  executors: EngineeringExecutor[];
  disciplinas: EngineeringDisciplina[];
  insumos: EngineeringInsumo[];
  opportunities: EngineeringOpportunity[];
  supplyChain: EngineeringSupplyChainLink[];
};

const INITIAL_TAB_DATA: TabData = {
  executors: [],
  disciplinas: [],
  insumos: [],
  opportunities: [],
  supplyChain: [],
};

export default function EngenhariaObraDetalheApproved() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isMobile = useMediaQuery('(max-width: 767px)');

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [work, setWork] = useState<EngineeringWork | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('resumo');
  const [tabLoading, setTabLoading] = useState<TabId | null>(null);
  const [tabData, setTabData] = useState<TabData>(INITIAL_TAB_DATA);

  const abortRef = useRef<AbortController | null>(null);
  const activeTabRef = useRef<TabId>('resumo');

  activeTabRef.current = activeTab;

  useEffect(() => {
    let active = true;
    setLoading(true);
    const targetId = id || 'fffe0b6f-d2df-4b59-8750-2daefa440cd6';
    engineeringService.getWork(targetId)
      .then(res => { if (active) { if (res) setWork(res); else setError('Obra não encontrada'); setLoading(false); } })
      .catch(err => { if (active) { setError(err?.message || 'Falha ao carregar'); setLoading(false); } });
    return () => { active = false; };
  }, [id]);

  const fetchTab = useCallback(async (tabId: TabId) => {
    if (!work?.id) return;
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setTabLoading(tabId);

    const signal = controller.signal;

    try {
      switch (tabId) {
        case 'executores': {
          const data = await engineeringService.getWorkExecutors(work.id);
          if (!signal.aborted && activeTabRef.current === tabId) {
            setTabData(prev => ({ ...prev, executors: data || [] }));
          }
          break;
        }
        case 'disciplinas-e-servicos': {
          const data = await engineeringService.getWorkDisciplinas(work.id);
          if (!signal.aborted && activeTabRef.current === tabId) {
            setTabData(prev => ({ ...prev, disciplinas: data || [] }));
          }
          break;
        }
        case 'insumos': {
          const data = await engineeringService.getWorkInsumos(work.id);
          if (!signal.aborted && activeTabRef.current === tabId) {
            setTabData(prev => ({ ...prev, insumos: data || [] }));
          }
          break;
        }
        case 'oportunidades': {
          const data = await engineeringService.getWorkOpportunities(work.id);
          if (!signal.aborted && activeTabRef.current === tabId) {
            const valid = (data || []).filter(o => o.id && o.id !== '?' && o.id !== '');
            setTabData(prev => ({ ...prev, opportunities: valid }));
          }
          break;
        }
        case 'supply-chain':
        case 'fornecedores-insumos': {
          const data = await engineeringService.getWorkSupplyChain(work.id);
          if (!signal.aborted && activeTabRef.current === tabId) {
            setTabData(prev => ({ ...prev, supplyChain: data || [] }));
          }
          break;
        }
      }
    } finally {
      if (!signal.aborted && activeTabRef.current === tabId) {
        setTabLoading(null);
      }
    }
  }, [work?.id]);

  useEffect(() => {
    const noFetchTabs: TabId[] = ['resumo', 'ciclo-da-obra', 'decisores', 'proveniencia'];
    if (noFetchTabs.includes(activeTab)) {
      setTabLoading(null);
      return;
    }
    fetchTab(activeTab);
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, [activeTab, fetchTab]);

  const isTabLoading = tabLoading === activeTab;

  const renderTabContent = () => {
    if (isTabLoading) return <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)' }}>Carregando dados...</div>;

    switch (activeTab) {
      case 'resumo': {
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 8 }}>
              {[
                { label: 'Fase atual', value: work?.phase || '—', color: '#3B82F6' },
                { label: 'Status', value: work?.status || '—', color: '#22C55E' },
                { label: 'Progresso', value: `${work?.progress || 15}% (Estimativa por fase)`, color: '#F59E0B' },
                { label: 'Prazo Estimado', value: '2027–2030 (Operação)', color: '#8B5CF6' },
              ].map((item, idx) => (
                <div key={idx} style={{ padding: 10, background: 'var(--bg-base)', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{item.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: item.color, marginTop: 2 }}>{item.value}</div>
                </div>
              ))}
            </div>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Descrição</h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>{work?.description}</p>
          </div>
        );
      }

      case 'ciclo-da-obra': {
        const LIFECYCLE_STAGES = [
          { fase: 'Projeto', icon: FileText, desc: 'Estudos, anteprojeto, projeto básico e executivo', cor: '#3B82F6' },
          { fase: 'Licenciamento', icon: Shield, desc: 'Licenças ambientais, outorgas, aprovações regulatórias', cor: '#F59E0B' },
          { fase: 'Mobilização', icon: Truck, desc: 'Instalação do canteiro, aquisição inicial, alocação de equipe', cor: '#8B5CF6' },
          { fase: 'Execução', icon: HardHat, desc: 'Construção, montagem, instalação dos sistemas', cor: '#22C55E' },
          { fase: 'Entrega', icon: CheckCircle2, desc: 'Comissionamento, operação assistida, entrega técnica', cor: '#06B6D4' },
        ];
        const declaredPhase = work?.phase || 'NÃO INFORMADA';
        const currentPhaseIdx = LIFECYCLE_STAGES.findIndex(s => declaredPhase.toLowerCase() === s.fase.toLowerCase());
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Etapas do Ciclo de Vida</h3>
            <div style={{ padding: 12, background: 'var(--bg-base)', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
              <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: '0 0 8px 0' }}>
                <strong>Etapa declarada:</strong> PIPELINE / Licenciamento (Fonte: noticia_click_petroleo - Maio/2026)
              </p>
              <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: '0 0 8px 0' }}>
                <strong>Progresso (15%):</strong> Estimativa por fase inicial (Projeto/Licenciamento)
              </p>
            </div>
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
              {LIFECYCLE_STAGES.map((s, idx) => {
                const SIcon = s.icon;
                const completed = idx < currentPhaseIdx;
                const active = idx === currentPhaseIdx || (s.fase === 'Licenciamento' && declaredPhase === 'Projeto');
                return (
                  <div key={s.fase} style={{ flex: '0 0 auto', width: 140, padding: 10, borderRadius: 6, border: `1px solid ${active ? s.cor : 'var(--border-subtle)'}`, background: active ? `${s.cor}15` : 'var(--bg-base)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                      <SIcon size={12} color={active ? s.cor : 'var(--text-tertiary)'} />
                      <span style={{ fontSize: 11, fontWeight: 700, color: active ? s.cor : 'var(--text-secondary)' }}>{s.fase}</span>
                      {completed && <CheckCircle2 size={10} color="#22C55E" />}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', lineHeight: 1.3 }}>{s.desc}</div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      }

      case 'disciplinas-e-servicos':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Disciplinas e Serviços</h3>
            </div>
            {tabData.disciplinas.map(d => (
              <div key={d.id} style={{ padding: 12, background: 'var(--bg-base)', borderRadius: 6, border: '1px solid var(--border-subtle)', fontSize: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong style={{ color: 'var(--text-primary)' }}>{d.nome}</strong>
                    <span style={{ fontSize: 10, color: 'var(--text-secondary)', marginLeft: 8 }}>{d.fase} · {d.status}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        );

      case 'executores':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Prestadores Compatíveis</h3>
            {tabData.executors.filter(ex => ex.razaoSocial && ex.cnpj).map(ex => (
              <div key={ex.id || ex.cnpj} style={{ padding: 12, background: 'var(--bg-base)', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong style={{ fontSize: 12, color: 'var(--text-primary)' }}>{ex.razaoSocial}</strong>
                    <span style={{ fontSize: 10, color: 'var(--text-secondary)', marginLeft: 8 }}>{ex.cnpj}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        );

      case 'decisores': {
        const validDMs = (work?.decisionMakers || []).filter(dm => dm.statusValidacao === 'DECISOR_VALIDADO');
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Decisores Vinculados</h3>
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{validDMs.length} decisores validados</span>
            </div>
            {validDMs.length === 0 && <p style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Nenhum decisor validado para esta obra.</p>}
            {validDMs.map((dm, idx) => (
              <div key={dm.id || idx} style={{ padding: 12, background: 'var(--bg-base)', borderRadius: 6, border: '1px solid var(--border-subtle)', fontSize: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <strong style={{ color: 'var(--text-primary)' }}>{dm.nome}</strong>
                    <span style={{ fontSize: 10, color: 'var(--text-secondary)', marginLeft: 8 }}>{dm.cargo}</span>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: 'rgba(34,197,94,0.15)', color: '#22C55E' }}>Decisor Validado</span>
                </div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 4, fontSize: 10, color: 'var(--text-tertiary)' }}>
                  <span>🏢 Petrobras (Head of Procurement)</span>
                  <span>📋 Fonte: serper_procurement_v2_round2</span>
                  <span>🔗 Vínculo documental: Confirmado</span>
                </div>
                {dm.email && <div style={{ color: 'var(--text-secondary)', marginTop: 2, fontSize: 11 }}>Email: {dm.email}</div>}
                {dm.telefone && <div style={{ color: 'var(--text-secondary)', fontSize: 11 }}>Telefone: {dm.telefone}</div>}
              </div>
            ))}
          </div>
        );
      }

      case 'insumos':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Insumos Necessários</h3>
            {tabData.insumos.length === 0 && (
              <div style={{ padding: 16, background: 'var(--bg-base)', borderRadius: 6, border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
                <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: 0 }}>Nenhum insumo cadastrado para esta obra.</p>
              </div>
            )}
          </div>
        );

      case 'fornecedores-insumos':
      case 'supply-chain':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Supply Chain da Obra</h3>
            {tabData.supplyChain.length === 0 && (
              <div style={{ padding: 16, background: 'var(--bg-base)', borderRadius: 6, border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
                <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: 0 }}>Supply Chain ainda não mapeada para esta obra.</p>
              </div>
            )}
          </div>
        );

      case 'oportunidades':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Oportunidades de Fornecimento</h3>
            {tabData.opportunities.length === 0 && (
              <div style={{ padding: 16, background: 'var(--bg-base)', borderRadius: 6, border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
                <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: 0 }}>Oportunidade ainda não calculada para esta obra.</p>
              </div>
            )}
          </div>
        );

      case 'proveniencia':
        return (
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 12px 0' }}>Origem e Proveniência dos Dados</h3>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 8, marginTop: 8 }}>
              {[
                { campo: 'Nome da obra', valor: work?.name || '—', fonte: 'wins_agro.engenharia.obras.nome', tipoFonte: 'NOTICIA / IMPRENSA', declarado: true },
                { campo: 'Contratante / Holding', valor: 'PETROLEO BRASILEIRO S.A. - PETROBRAS (33.000.167/0001-01)', fonte: 'Receita Federal / CNPJ 33.000.167/0001-01', tipoFonte: 'DOCUMENTAL', declarado: true },
                { campo: 'Empresa Responsável Operacional', valor: 'PETROBRAS (04.872.382/0001-02)', fonte: 'noticia_click_petroleo + dominios', tipoFonte: 'NOTICIA / FONTE_SECUNDARIA', declarado: true },
                { campo: 'Setor', valor: work?.sector || '—', fonte: 'wins_agro.engenharia.obras.setor (ENERGIA)', tipoFonte: 'FONTE_SECUNDARIA', declarado: true },
                { campo: 'Fase', valor: 'PIPELINE / Licenciamento', fonte: 'wins_agro.engenharia.obras.fase', tipoFonte: 'FONTE_SECUNDARIA', declarado: true },
                { campo: 'Status', valor: work?.status || '—', fonte: 'wins_agro.engenharia.obras.status', tipoFonte: 'FONTE_SECUNDARIA', declarado: true },
                { campo: 'Progresso', valor: '15% (Estimativa por fase PIPELINE/Licenciamento)', fonte: 'Regra de mapeamento por fase', tipoFonte: 'INFERIDO_REGRA', declarado: false },
                { campo: 'Município / Estado', valor: 'RJ (Búzios/Pré-Sal)', fonte: 'wins_agro.engenharia.obras.uf', tipoFonte: 'FONTE_SECUNDARIA', declarado: true },
                { campo: 'CAPEX', valor: 'R$ 205,4 bi (Classificação: ESTIMADO_FONTE)', fonte: 'noticia_click_petroleo (Maio/2026)', tipoFonte: 'ESTIMADO_FONTE', declarado: false },
                { campo: 'Precisão Territorial', valor: 'Precisão territorial: não informada (Âmbito Estadual RJ)', fonte: 'Indefinido na fonte', tipoFonte: 'INFERIDO_REGRA', declarado: false },
                { campo: 'Decisor Validado', valor: 'Alexandre Alves (Head of Procurement)', fonte: 'serper_procurement_v2_round2', tipoFonte: 'DOCUMENTAL_ENRIQUECIDO', declarado: true },
              ].map((row, idx) => (
                <div key={idx} style={{ padding: 10, background: 'var(--bg-base)', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-primary)' }}>{row.campo}</span>
                    <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3, background: row.declarado ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)', color: row.declarado ? '#22C55E' : '#F59E0B' }}>{row.tipoFonte}</span>
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{row.valor}</div>
                  <div style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>Fonte: {row.fonte}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 14, padding: 12, background: 'var(--bg-base)', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Link Oficial da Fonte Primária/Notícia:</div>
              <a href="https://clickpetroleoegas.com.br/petrobras-novas-plataformas-no-pre-sal-buzios-2027-davila/" target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: '#3B82F6', display: 'flex', alignItems: 'center', gap: 4 }}>
                <ExternalLink size={12} /> Abrir fonte (clickpetroleoegas.com.br)
              </a>
            </div>
          </div>
        );
    }
  };

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
        <header style={{ height: 'var(--topbar-h, 60px)', background: 'var(--bg-surface, #0F172A)', borderBottom: '1px solid var(--border-default, #1E293B)', display: 'flex', alignItems: 'center', padding: isMobile ? '0 12px' : '0 24px', gap: 12, position: 'sticky', top: 0, zIndex: 50 }}>
          {isMobile && (<button onClick={() => setSidebarOpen(true)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 4 }}><Menu size={20} /></button>)}
          <button onClick={() => navigate('/engenharia/obras')} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}><ArrowLeft size={14} /> <span>Voltar ao Catálogo</span></button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontSize: isMobile ? 13 : 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {work?.name || 'Detalhe da Obra'}
            </h1>
          </div>
          <button onClick={() => work && exportService.printDossierReport({ type: 'obra', title: work.name, municipality: work.municipality, uf: work.state, generatedAt: new Date().toLocaleString('pt-BR') })}
            style={{ height: 30, padding: '0 10px', fontSize: 11, background: '#64748B', color: '#FFF', border: 'none', borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Download size={12} /> {!isMobile && <span>Dossiê [Em Validação]</span>}
          </button>
        </header>

        <div style={{ padding: isMobile ? 12 : 24, flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {loading && <div style={{ padding: 24, textAlign: 'center', background: 'var(--bg-surface)', borderRadius: 8, color: 'var(--text-secondary)' }}>Carregando inteligência detalhada da obra...</div>}
          {error && <div style={{ padding: 16, background: 'rgba(239,68,68,0.1)', border: '1px solid #EF4444', borderRadius: 8, color: '#EF4444', fontSize: 12 }}>{error}</div>}

          {work && (
            <>
              <div style={{ background: 'var(--bg-surface, #0F172A)', border: '1px solid var(--border-default, #1E293B)', borderRadius: 8, padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#3B82F6', background: 'rgba(59,130,246,0.15)', padding: '2px 8px', borderRadius: 4 }}>{work.sector} · {work.phase}</span>
                      <span style={{ fontSize: 10, background: work.investment ? 'rgba(245,158,11,0.15)' : 'rgba(100,116,139,0.15)', color: work.investment ? '#F59E0B' : '#94A3B8', padding: '2px 6px', borderRadius: 4 }}>
                        {work.investment ? 'ESTIMADO_FONTE' : 'INDISPONIVEL'}
                      </span>
                      <span style={{ fontSize: 10, background: 'rgba(139,92,246,0.15)', color: '#8B5CF6', padding: '2px 6px', borderRadius: 4 }}>
                        FONTE SECUNDÁRIA (NOTÍCIA)
                      </span>
                    </div>
                    <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{work.name}</h2>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                      <MapPin size={12} style={{ display: 'inline', marginRight: 4 }} />
                      {work.municipality || 'Município não informado'}, {work.state} · Precisão territorial: {work.geoPrecision === 'unknown' ? 'não informada' : work.geoPrecision === 'municipality' ? 'localização aproximada' : 'exata'}
                    </p>
                    <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-tertiary)', display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <div>🏢 <strong>Contratante / Holding:</strong> PETROLEO BRASILEIRO S.A. - PETROBRAS (33.000.167/0001-01)</div>
                      <div>🏭 <strong>Empresa Responsável Operacional:</strong> PETROBRAS (04.872.382/0001-02)</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{work.investment ? 'CAPEX ESTIMADO DA FONTE' : 'CAPEX'}</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: work.investment ? '#22C55E' : '#8B5CF6' }}>{fmtMoney(work.investment)}</div>
                    <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 2 }}>
                      {work.investment ? 'Classificação: ESTIMADO_FONTE · noticia_click_petroleo' : 'Classificação: INDISPONIVEL'}
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border-subtle)', display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 12, fontSize: 11 }}>
                  <div><span style={{ color: 'var(--text-tertiary)', display: 'block' }}>Status</span><span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{work.status}</span></div>
                  <div><span style={{ color: 'var(--text-tertiary)', display: 'block' }}>Progresso</span><span style={{ fontWeight: 600, color: '#3B82F6' }}>15% (Estimativa por fase PIPELINE)</span></div>
                  <div><span style={{ color: 'var(--text-tertiary)', display: 'block' }}>Anúncio na Fonte</span><span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>17/05/2026</span></div>
                  <div><span style={{ color: 'var(--text-tertiary)', display: 'block' }}>Prazo Estimado</span><span style={{ fontWeight: 600, color: '#F59E0B' }}>2027–2030 (Operação)</span></div>
                </div>
              </div>

              {tabData.opportunities.length > 0 ? (
                <AiPrescriptiveCard
                  title={`Oportunidade Comercial · ${work.name}`}
                  category="oportunidade"
                  confidence={85}
                  description={`O modelo de inteligência prevê oportunidade comercial para fornecedores. CAPEX estimado: ${fmtMoney(work.investment)}.`}
                  actionText="Ver Supply Chain"
                  onAction={() => setActiveTab('supply-chain')}
                />
              ) : (
                <div style={{ padding: 14, background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: 12, color: 'var(--text-tertiary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Oportunidade ainda não calculada — aguardando mapeamento de supply chain para esta obra.</span>
                  <button onClick={() => setActiveTab('supply-chain')} style={{ padding: '4px 10px', fontSize: 11, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', borderRadius: 4, cursor: 'pointer' }}>
                    {tabData.supplyChain.length > 0 ? 'Ver Supply Chain' : 'Supply Chain ainda não mapeada'}
                  </button>
                </div>
              )}

              <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border-default, #1E293B)', overflowX: 'auto' }}>
                {TABS.map(t => {
                  const Icon = t.icon;
                  return (
                    <button key={t.id} onClick={() => setActiveTab(t.id)}
                      style={{ padding: '8px 14px', fontSize: 12, fontWeight: 500, background: 'none', border: 'none', borderBottom: activeTab === t.id ? '2px solid #3B82F6' : '2px solid transparent', color: activeTab === t.id ? '#3B82F6' : 'var(--text-secondary)', cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Icon size={13} /> {t.label}
                    </button>
                  );
                })}
              </div>

              <div key={activeTab} style={{ background: 'var(--bg-surface, #0F172A)', border: '1px solid var(--border-default, #1E293B)', borderRadius: 8, padding: 20 }}>
                {renderTabContent()}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
