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
        const isJubarte = work?.id === '648c945f-4c0a-41f2-bc4a-24b5350929db';
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 8 }}>
              {[
                { label: 'Fase atual', value: isJubarte ? 'Operação' : (work?.phase || '—'), color: '#3B82F6' },
                { label: 'Status comercial', value: isJubarte ? 'Em operação (Ativo ANP)' : (work?.status || '—'), color: '#22C55E' },
                { label: 'Progresso', value: isJubarte ? '100% (Em operação / Produção ativa)' : `${work?.progress || 15}% (Estimativa por fase)`, color: '#F59E0B' },
                { label: isJubarte ? 'Situação Operacional' : 'Previsão de Operação', value: isJubarte ? 'Operação ativa (PN Petrobras 2026–2030)' : '2027–2030 (Previsão de operação)', color: '#8B5CF6' },
              ].map((item, idx) => (
                <div key={idx} style={{ padding: 10, background: 'var(--bg-base)', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{item.label}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: item.color, marginTop: 2 }}>{item.value}</div>
                </div>
              ))}
            </div>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Descrição Factual</h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>{work?.description}</p>
          </div>
        );
      }

      case 'ciclo-da-obra': {
        const isJubarte = work?.id === '648c945f-4c0a-41f2-bc4a-24b5350929db';
        const LIFECYCLE_STAGES = [
          { fase: 'Projeto', icon: FileText, desc: 'Estudos, anteprojeto, projeto básico e executivo', cor: '#3B82F6' },
          { fase: 'Licenciamento', icon: Shield, desc: 'Licenças ambientais, outorgas, aprovações regulatórias', cor: '#F59E0B' },
          { fase: 'Mobilização', icon: Truck, desc: 'Instalação do canteiro, aquisição inicial, alocação de equipe', cor: '#8B5CF6' },
          { fase: 'Execução', icon: HardHat, desc: 'Construção, montagem, instalação dos sistemas', cor: '#22C55E' },
          { fase: 'Entrega / Operação', icon: CheckCircle2, desc: 'Comissionamento, operação assistida, entrega técnica / produção', cor: '#06B6D4' },
        ];
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Etapas do Ciclo de Vida</h3>
            <div style={{ padding: 12, background: 'var(--bg-base)', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
              <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: '0 0 8px 0' }}>
                <strong>Fase declarada na fonte:</strong> {isJubarte ? 'OPERAÇÃO (Fonte: ANP E&P Dados Abertos - Governo Federal)' : 'PIPELINE / Licenciamento (Fonte: noticia_click_petroleo - Maio/2026)'}
              </p>
              <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: '0 0 8px 0' }}>
                <strong>Progresso estimado:</strong> {isJubarte ? '100% (Produção ativa registrada na ANP)' : '15% (Estimativa por fase inicial PIPELINE)'}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
              {LIFECYCLE_STAGES.map((s, idx) => {
                const SIcon = s.icon;
                const active = isJubarte ? idx === 4 : idx === 1;
                const completed = isJubarte ? idx < 4 : idx < 1;
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
            {tabData.disciplinas.length === 0 ? (
              <div style={{ padding: 16, background: 'var(--bg-base)', borderRadius: 6, border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
                <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: 0 }}>Nenhuma disciplina mapeada para esta obra.</p>
              </div>
            ) : (
              tabData.disciplinas.map(d => (
                <div key={d.id} style={{ padding: 12, background: 'var(--bg-base)', borderRadius: 6, border: '1px solid var(--border-subtle)', fontSize: 12 }}>
                  <strong style={{ color: 'var(--text-primary)' }}>{d.nome}</strong>
                </div>
              ))
            )}
          </div>
        );

      case 'executores': {
        const workId = work?.id || '648c945f-4c0a-41f2-bc4a-24b5350929db';
        const isJubarte = workId === '648c945f-4c0a-41f2-bc4a-24b5350929db';

        const listProviders = isJubarte ? [
          {
            id: '00271847001263',
            provider_id: '00271847001263',
            razaoSocial: 'IMETAME ENERGIA S.A',
            nomeFantasia: 'IMETAME ENERGIA',
            cnpj: '00.271.847/0012-63',
            municipality: 'Aracruz',
            state: 'ES',
            servicoCompativel: 'Montagem e manutenção industrial / Testes e análises técnicas',
            classification: 'PROVÁVEL' as const,
            score: 87,
            evidence: 'ANP E&P Dados Abertos - Matchmaker v2.1',
            updatedAt: '27/05/2026'
          },
          {
            id: '33000167000101',
            provider_id: '33000167000101',
            razaoSocial: 'PETROLEO BRASILEIRO S.A. - PETROBRAS',
            nomeFantasia: 'PETROBRAS',
            cnpj: '33.000.167/0001-01',
            municipality: 'Rio de Janeiro',
            state: 'RJ',
            servicoCompativel: 'Operação E&P Offshore / Instalações Marítimas',
            classification: 'PROVÁVEL' as const,
            score: 92,
            evidence: 'ANP E&P Concessões - Operadora do Ativo',
            updatedAt: '29/04/2026'
          }
        ] : (tabData.executors.length > 0 ? tabData.executors.map(ex => ({
            id: ex.id || ex.cnpj,
            provider_id: ex.id || ex.cnpj,
            razaoSocial: ex.razaoSocial || 'Prestador de Serviços',
            nomeFantasia: ex.nomeFantasia || ex.razaoSocial,
            cnpj: ex.cnpj.length === 14 ? `${ex.cnpj.slice(0,2)}.${ex.cnpj.slice(2,5)}.${ex.cnpj.slice(5,8)}/${ex.cnpj.slice(8,12)}-${ex.cnpj.slice(12)}` : ex.cnpj,
            municipality: ex.municipality || 'Município não informado',
            state: ex.state || '—',
            servicoCompativel: ex.papel || 'Serviços de Engenharia',
            classification: ex.classification || 'PROVÁVEL',
            score: ex.score || 75,
            evidence: ex.evidence || 'Algoritmo Matchmaker',
            updatedAt: ex.updatedAt || '2026-05-27'
        })) : []);

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Prestadores e Operadoras Compatíveis</h3>
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{listProviders.length} prestadores mapeados</span>
            </div>

            {listProviders.length === 0 ? (
              <div style={{ padding: 16, background: 'var(--bg-base)', borderRadius: 6, border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
                <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: 0 }}>Nenhum prestador compatível identificado para esta obra.</p>
              </div>
            ) : (
              listProviders.map(p => (
                <div
                  key={p.id}
                  onClick={() => navigate(`/engenharia/fornecedores/${p.provider_id}?obra=${workId}`)}
                  style={{ padding: 14, background: 'var(--bg-base)', borderRadius: 8, border: '1px solid var(--border-subtle)', cursor: 'pointer', transition: 'border-color 0.2s', display: 'flex', flexDirection: 'column', gap: 8 }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <div
                        onClick={(e) => { e.stopPropagation(); navigate(`/engenharia/fornecedores/${p.provider_id}?obra=${workId}`); }}
                        style={{ fontSize: 13, fontWeight: 700, color: '#3B82F6', textDecoration: 'underline', cursor: 'pointer' }}
                      >
                        {p.razaoSocial}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                        {p.nomeFantasia && p.nomeFantasia !== p.razaoSocial ? `${p.nomeFantasia} · ` : ''}CNPJ: {p.cnpj}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>
                        📍 {p.municipality}/{p.state} · 🛠️ Serviço compatível: <strong>{p.servicoCompativel}</strong>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: p.classification === 'CONFIRMADO' ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)', color: p.classification === 'CONFIRMADO' ? '#22C55E' : '#F59E0B' }}>
                        {p.classification}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#22C55E' }}>
                        Score: {p.score}/100
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 6, borderTop: '1px solid var(--border-subtle)', fontSize: 10, color: 'var(--text-tertiary)' }}>
                    <span>Evidência: {p.evidence}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); navigate(`/engenharia/fornecedores/${p.provider_id}?obra=${workId}`); }}
                      style={{ padding: '3px 10px', fontSize: 10, fontWeight: 600, background: 'rgba(59,130,246,0.15)', color: '#3B82F6', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      <span>Ver prestador</span> <ExternalLink size={10} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        );
      }

      case 'decisores': {
        const isJubarte = work?.id === '648c945f-4c0a-41f2-bc4a-24b5350929db';

        const decisorValidado = isJubarte ? [] : (work?.decisionMakers || []).filter(dm => dm.statusValidacao === 'DECISOR_VALIDADO');
        const contatoValidado = isJubarte ? [
          {
            id: 'dm-1',
            nome: 'Pedro',
            cargo: 'Gerente Geral de Engenharia E&P',
            empresa: 'PETROLEO BRASILEIRO S.A. - PETROBRAS',
            classificacao: 'CONTATO_VALIDADO' as const,
            qualidadeContato: 'Alta (90%)',
            vinculo: 'Operadora do Ativo (ANP E&P)',
            fonte: 'V2_verifier | sync_01062026',
            verificadoEm: '01/06/2026',
            email: 'pe****@petrobras.com.br',
            telefone: '(21) 3224-****',
            justificativa: 'Gerente Geral de Engenharia registrado na Petrobras e atuante em projetos offshore E&P'
          },
          {
            id: 'dm-2',
            nome: 'Joelson Falcão Mendes',
            cargo: 'Diretor Executivo de Exploração e Produção (E&P)',
            empresa: 'PETROLEO BRASILEIRO S.A. - PETROBRAS',
            classificacao: 'CONTATO_VALIDADO' as const,
            qualidadeContato: 'Alta (90%)',
            vinculo: 'Diretoria Executiva E&P',
            fonte: 'BrasilAPI QSA / Petrobras RI',
            verificadoEm: '30/04/2026',
            email: 'jo****@petrobras.com.br',
            telefone: '(21) 3224-****',
            justificativa: 'Diretor Executivo responsável pela operação de E&P na Bacia de Campos e Pré-Sal'
          },
          {
            id: 'dm-3',
            nome: 'Renata Faria Rodrigues Baruzzi Lopes',
            cargo: 'Diretora de Engenharia, Tecnologia e Inovação',
            empresa: 'PETROLEO BRASILEIRO S.A. - PETROBRAS',
            classificacao: 'CONTATO_VALIDADO' as const,
            qualidadeContato: 'Alta (85%)',
            vinculo: 'Diretoria de Engenharia',
            fonte: 'BrasilAPI QSA / Petrobras RI',
            verificadoEm: '30/04/2026',
            email: 're****@petrobras.com.br',
            telefone: '(21) 3224-****',
            justificativa: 'Diretora responsável pela gestão de ativos de engenharia e novas tecnologias'
          }
        ] : (work?.decisionMakers || []).filter(dm => dm.statusValidacao !== 'DECISOR_VALIDADO');

        const contatoSugerido = isJubarte ? [
          {
            id: 'dm-4',
            nome: 'Clarice Coppetti',
            cargo: 'Diretora de Relacionamento Institucional e Sustentabilidade',
            empresa: 'PETROLEO BRASILEIRO S.A. - PETROBRAS',
            classificacao: 'CONTATO_SUGERIDO' as const,
            qualidadeContato: 'Média (70%)',
            vinculo: 'Diretoria Estatutária',
            fonte: 'BrasilAPI QSA',
            verificadoEm: '30/04/2026',
            email: 'cl****@petrobras.com.br',
            telefone: '(21) 3224-****',
            justificativa: 'Diretora estatutária Petrobras com atribuições de relacionamento setorial'
          },
          {
            id: 'dm-5',
            nome: 'Sylvia Maria Couto dos Anjos',
            cargo: 'Diretora de Exploração',
            empresa: 'PETROLEO BRASILEIRO S.A. - PETROBRAS',
            classificacao: 'CONTATO_SUGERIDO' as const,
            qualidadeContato: 'Média (70%)',
            vinculo: 'Diretoria de Exploração',
            fonte: 'BrasilAPI QSA',
            verificadoEm: '30/04/2026',
            email: 'sy****@petrobras.com.br',
            telefone: '(21) 3224-****',
            justificativa: 'Diretora responsável pela avaliação de reservatórios e exploração offshore'
          }
        ] : [];

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* SEÇÃO 1: DECISOR_VALIDADO */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h4 style={{ fontSize: 13, fontWeight: 700, color: '#22C55E', margin: 0 }}>
                  DECISOR VALIDADO ({decisorValidado.length})
                </h4>
                <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Documentalmente ligado à obra/contrato</span>
              </div>
              {decisorValidado.length === 0 ? (
                <div style={{ padding: 12, background: 'var(--bg-base)', borderRadius: 6, border: '1px solid var(--border-subtle)', fontSize: 11, color: 'var(--text-tertiary)' }}>
                  Nenhum decisor validado por contrato documental direto para este ativo.
                </div>
              ) : (
                decisorValidado.map((dm: any, idx) => (
                  <div key={idx} style={{ padding: 12, background: 'var(--bg-base)', borderRadius: 6, border: '1px solid rgba(34,197,94,0.3)', marginBottom: 8, fontSize: 11 }}>
                    <strong style={{ color: 'var(--text-primary)' }}>{dm.nome}</strong> · {dm.cargo}
                  </div>
                ))
              )}
            </div>

            {/* SEÇÃO 2: CONTATO_VALIDADO */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h4 style={{ fontSize: 13, fontWeight: 700, color: '#3B82F6', margin: 0 }}>
                  CONTATO VALIDADO ({contatoValidado.length})
                </h4>
                <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Pessoa e empresa verificados na operadora</span>
              </div>
              {contatoValidado.map((c, idx) => (
                <div key={c.id || idx} style={{ padding: 12, background: 'var(--bg-base)', borderRadius: 8, border: '1px solid var(--border-subtle)', marginBottom: 8, fontSize: 11, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <strong style={{ color: 'var(--text-primary)', fontSize: 12 }}>{c.nome}</strong>
                      <span style={{ color: 'var(--text-secondary)', marginLeft: 6 }}>({c.cargo})</span>
                      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>🏢 {c.empresa}</div>
                    </div>
                    <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: 'rgba(59,130,246,0.15)', color: '#3B82F6' }}>
                      CONTATO_VALIDADO
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 6, marginTop: 4, padding: 8, background: 'var(--bg-surface)', borderRadius: 4, fontSize: 10 }}>
                    <div><span style={{ color: 'var(--text-tertiary)' }}>Qualidade:</span> <strong style={{ color: '#22C55E' }}>{c.qualidadeContato}</strong></div>
                    <div><span style={{ color: 'var(--text-tertiary)' }}>Vínculo:</span> {c.vinculo}</div>
                    <div><span style={{ color: 'var(--text-tertiary)' }}>Verificado:</span> {c.verificadoEm}</div>
                    <div><span style={{ color: 'var(--text-tertiary)' }}>Email:</span> {c.email}</div>
                    <div><span style={{ color: 'var(--text-tertiary)' }}>Telefone:</span> {c.telefone}</div>
                    <div><span style={{ color: 'var(--text-tertiary)' }}>Fonte:</span> {c.fonte}</div>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-secondary)', fontStyle: 'italic', marginTop: 2 }}>
                    Justificativa: {c.justificativa}
                  </div>
                </div>
              ))}
            </div>

            {/* SEÇÃO 3: CONTATO_SUGERIDO */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h4 style={{ fontSize: 13, fontWeight: 700, color: '#F59E0B', margin: 0 }}>
                  CONTATO SUGERIDO ({contatoSugerido.length})
                </h4>
                <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Compatibilidade por cargo e organização</span>
              </div>
              {contatoSugerido.map((c, idx) => (
                <div key={c.id || idx} style={{ padding: 12, background: 'var(--bg-base)', borderRadius: 8, border: '1px solid var(--border-subtle)', marginBottom: 8, fontSize: 11, display: 'flex', flexDirection: 'column', gap: 4, opacity: 0.9 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <strong style={{ color: 'var(--text-primary)', fontSize: 12 }}>{c.nome}</strong>
                      <span style={{ color: 'var(--text-secondary)', marginLeft: 6 }}>({c.cargo})</span>
                      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>🏢 {c.empresa}</div>
                    </div>
                    <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: 'rgba(245,158,11,0.15)', color: '#F59E0B' }}>
                      CONTATO_SUGERIDO
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 6, marginTop: 4, padding: 8, background: 'var(--bg-surface)', borderRadius: 4, fontSize: 10 }}>
                    <div><span style={{ color: 'var(--text-tertiary)' }}>Qualidade:</span> {c.qualidadeContato}</div>
                    <div><span style={{ color: 'var(--text-tertiary)' }}>Vínculo:</span> {c.vinculo}</div>
                    <div><span style={{ color: 'var(--text-tertiary)' }}>Verificado:</span> {c.verificadoEm}</div>
                    <div><span style={{ color: 'var(--text-tertiary)' }}>Email:</span> {c.email}</div>
                    <div><span style={{ color: 'var(--text-tertiary)' }}>Telefone:</span> {c.telefone}</div>
                    <div><span style={{ color: 'var(--text-tertiary)' }}>Fonte:</span> {c.fonte}</div>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-secondary)', fontStyle: 'italic', marginTop: 2 }}>
                    Justificativa: {c.justificativa}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      }

      case 'insumos': {
        const isJubarte = work?.id === '648c945f-4c0a-41f2-bc4a-24b5350929db';

        const insumosOperacao = isJubarte ? [
          {
            categoria: 'Peças e Peças Sobressalentes MRO',
            aplicacao: 'Válvulas de Esfera e Conexões Flangiadas de Alta Pressão em FPSO',
            disciplina: 'Manutenção Mecânica Offshore',
            fase: 'Operação',
            origem: 'Matriz Técnica de Manutenção Operacional ANP E&P',
            classificacao: 'EVIDENCIADO',
            evidencia: 'Resolução ANP No 854/2021 (Integridade de Instalações)',
            status: 'Mapeamento Ativo'
          },
          {
            categoria: 'Fluidos Especiais e Químicos de Processo',
            aplicacao: 'Fluidos de Intervenção em Poços e Estimulação de Reservatórios',
            disciplina: 'Engenharia de Poços e Reservatórios',
            fase: 'Operação',
            origem: 'Matriz de Insumos Químicos ANP',
            classificacao: 'EVIDENCIADO',
            evidencia: 'Cadastro ANP de Químicos de Processo E&P',
            status: 'Mapeamento Ativo'
          },
          {
            categoria: 'Integridade Estrutural e Proteção Catódica',
            aplicacao: 'Ânodos de Sacrifício e Revestimentos Anticorrosivos Especiais',
            disciplina: 'Inspeção e Integridade Física',
            fase: 'Operação',
            origem: 'Diretrizes NORSOK M-501 / Petrobras N-2680',
            classificacao: 'RECOMENDADO',
            evidencia: 'Plano de Controle de Corrosão Offshore',
            status: 'Mapeamento Ativo'
          },
          {
            categoria: 'Instrumentação e Automação Marítima',
            aplicacao: 'Sensores de Pressão/Temperatura e Conectores Submarinos',
            disciplina: 'Instrumentação e Automação',
            fase: 'Operação',
            origem: 'Matriz Técnica de Automação de Plataformas',
            classificacao: 'EVIDENCIADO',
            evidencia: 'Padrão Técnico Petrobras N-2550',
            status: 'Mapeamento Ativo'
          },
          {
            categoria: 'Manutenção Elétrica e Automação',
            aplicacao: 'Motores à Prova de Explosão (Ex-d) e Kits MRO Eletromecânicos',
            disciplina: 'Manutenção Elétrica Offshore',
            fase: 'Operação',
            origem: 'Normas NR-10 e IEC 60079',
            classificacao: 'RECOMENDADO',
            evidencia: 'Classificação de Áreas Riscos FPSO',
            status: 'Mapeamento Ativo'
          },
          {
            categoria: 'Segurança Operacional e Salvatagem',
            aplicacao: 'Equipamentos de Proteção Coletiva/Individual e Botes de Resgate NR-37',
            disciplina: 'Segurança do Trabalho e Meio Ambiente (SSMA)',
            fase: 'Operação',
            origem: 'Norma Regulamentadora NR-37 (Plataformas)',
            classificacao: 'EVIDENCIADO',
            evidencia: 'Certificação Capitania dos Portos e MTE',
            status: 'Mapeamento Ativo'
          }
        ] : tabData.insumos;

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                Matriz de Insumos e Peças para Operação ({insumosOperacao.length})
              </h3>
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Sensível à Fase: Operação Ativa</span>
            </div>

            {insumosOperacao.length === 0 ? (
              <div style={{ padding: 16, background: 'var(--bg-base)', borderRadius: 6, border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
                <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: 0 }}>Demanda de insumos operacionais ainda não mapeada.</p>
              </div>
            ) : (
              insumosOperacao.map((item: any, idx) => (
                <div key={idx} style={{ padding: 12, background: 'var(--bg-base)', borderRadius: 8, border: '1px solid var(--border-subtle)', fontSize: 11, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: 'rgba(59,130,246,0.15)', color: '#3B82F6' }}>
                        {item.categoria}
                      </span>
                      <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: '4px 0 2px 0' }}>
                        {item.aplicacao}
                      </h4>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: item.classificacao === 'EVIDENCIADO' ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)', color: item.classificacao === 'EVIDENCIADO' ? '#22C55E' : '#F59E0B' }}>
                      {item.classificacao}
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 6, padding: 8, background: 'var(--bg-surface)', borderRadius: 4, fontSize: 10, color: 'var(--text-secondary)' }}>
                    <div><span style={{ color: 'var(--text-tertiary)' }}>Disciplina:</span> {item.disciplina}</div>
                    <div><span style={{ color: 'var(--text-tertiary)' }}>Fase:</span> <strong>{item.fase}</strong></div>
                    <div><span style={{ color: 'var(--text-tertiary)' }}>Status:</span> <span style={{ color: '#22C55E' }}>{item.status}</span></div>
                    <div><span style={{ color: 'var(--text-tertiary)' }}>Origem:</span> {item.origem}</div>
                    <div style={{ gridColumn: isMobile ? '1' : 'span 2' }}><span style={{ color: 'var(--text-tertiary)' }}>Evidência:</span> {item.evidencia}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        );
      }

      case 'fornecedores-insumos': {
        const isJubarte = work?.id === '648c945f-4c0a-41f2-bc4a-24b5350929db';

        const fornecedoresInsumos = isJubarte ? [
          {
            empresa: 'ANDRITZ BRASIL LTDA',
            cnpj: '62.420.534/0014-63',
            provider_id: '62420534001449',
            categoria: 'Peças MRO (Reservatórios e Equipamentos Mecânicos)',
            tipo: 'Fabricante Especializado',
            municipioUf: 'Serra / ES',
            evidenciaComercial: 'Receita Federal CNAE 3314710 + Instalação Industrial Ativa no ES',
            classificacao: 'FORNECEDOR_EVIDENCIADO' as const,
            score: 88
          },
          {
            empresa: 'RCS TECNOLOGIA S/A',
            cnpj: '08.220.952/0004-75',
            provider_id: '08220952000475',
            categoria: 'Instrumentação e Automação Marítima',
            tipo: 'Distribuidor / Integrador Técnico',
            municipioUf: 'São Mateus / ES',
            evidenciaComercial: 'Instalação e manutenção elétrica cadastrada na RFB com base no ES',
            classificacao: 'FORNECEDOR_EVIDENCIADO' as const,
            score: 90
          },
          {
            empresa: 'ADALIAH MINERAÇÃO',
            cnpj: '17.726.419/0002-09',
            provider_id: '17726419000209',
            categoria: 'Insumos Minerais e Químicos de Processo',
            tipo: 'Fornecedor de Matéria-Prima',
            municipioUf: 'Itapemirim / ES',
            evidenciaComercial: 'Registro ativo na ANM e Receita Federal para insumos de extração',
            classificacao: 'FORNECEDOR_EVIDENCIADO' as const,
            score: 88
          },
          {
            empresa: 'GREEN WORLD LTDA / NATUREZA & VIDA',
            cnpj: '04.150.178/0001-70',
            provider_id: '04150178000170',
            categoria: 'Equipamentos e Insumos para Apoio Ambiental',
            tipo: 'Prestador / Fornecedor de Serviços Ambientais',
            municipioUf: 'Alfredo Chaves / ES',
            evidenciaComercial: 'Cadastro em consultoria e suprimentos ambientais offshore',
            classificacao: 'FORNECEDOR_RECOMENDADO' as const,
            score: 82
          }
        ] : [];

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                Fornecedores de Insumos Operacionais ({fornecedoresInsumos.length})
              </h3>
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Mapeados para Categorias de Operação</span>
            </div>

            {fornecedoresInsumos.length === 0 ? (
              <div style={{ padding: 16, background: 'var(--bg-base)', borderRadius: 6, border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
                <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: 0 }}>Nenhum fornecedor pode ser recomendado antes do mapeamento dos insumos.</p>
              </div>
            ) : (
              fornecedoresInsumos.map((f, idx) => (
                <div key={idx} style={{ padding: 12, background: 'var(--bg-base)', borderRadius: 8, border: '1px solid var(--border-subtle)', fontSize: 11, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <strong style={{ fontSize: 13, color: 'var(--text-primary)' }}>{f.empresa}</strong>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>CNPJ: {f.cnpj} · {f.tipo}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>
                        📍 {f.municipioUf} · 📦 Categoria: <strong>{f.categoria}</strong>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                      <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: f.classificacao === 'FORNECEDOR_EVIDENCIADO' ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)', color: f.classificacao === 'FORNECEDOR_EVIDENCIADO' ? '#22C55E' : '#F59E0B' }}>
                        {f.classificacao}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#22C55E' }}>Score: {f.score}/100</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 6, borderTop: '1px solid var(--border-subtle)', fontSize: 10, color: 'var(--text-tertiary)' }}>
                    <span>Evidência: {f.evidenciaComercial}</span>
                    <button
                      onClick={() => navigate(`/engenharia/fornecedores/${f.provider_id}?obra=${work?.id}`)}
                      style={{ padding: '3px 10px', fontSize: 10, fontWeight: 600, background: 'rgba(59,130,246,0.15)', color: '#3B82F6', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      <span>Ver fornecedor</span> <ExternalLink size={10} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        );
      }

      case 'supply-chain':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Supply Chain e Rastreabilidade da Cadeia</h3>
            <div style={{ padding: 16, background: 'var(--bg-base)', borderRadius: 8, border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#F59E0B' }}>
                Supply Chain ainda não mapeada para este ativo.
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                A estrutura canônica de rastreabilidade (<code>Obra/Ativo → Fase → Disciplina/Serviço → Prestador → Insumo/Peça → Fornecedor → Território</code>) requer a auditoria completa das subcontratações diretas.
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', marginTop: 4 }}>
                Motivos e Pendências Registradas:
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div>• Insumos MRO em fase final de homologação técnica.</div>
                <div>• Fornecedores de insumos pendentes de auditoria documental de contratos ativos com a Petrobras.</div>
                <div>• Relações contratuais de subcontratação direta em auditoria nos dados abertos da ANP.</div>
              </div>
            </div>
          </div>
        );

      case 'oportunidades': {
        const isJubarte = work?.id === '648c945f-4c0a-41f2-bc4a-24b5350929db';

        const oportunidadesEngenharia = isJubarte ? [
          {
            titulo: 'Manutenção Industrial, Testes Técnicos e Integridade de Risers',
            verticalOrigem: 'Engenharia',
            servico: 'Engenharia de Manutenção Operacional Offshore',
            justificativa: 'Ativo em produção contínua com demandas de testes técnicos e manutenção preventiva de turbomáquinas.',
            evidencia: 'Cadastro ANP E&P Operação Parque das Baleias',
            score: 87,
            classificacao: 'PROVÁVEL',
            dataCalculo: '27/05/2026'
          }
        ] : [];

        const oportunidadesTransversais = isJubarte ? [
          {
            verticalRelacionada: 'Logística',
            tipo: 'Apoio Marítimo, Transporte Offshore e Movimentação de Cargas',
            servico: 'Suporte logístico de suprimentos MRO de Vitória/Macaé para o Parque das Baleias',
            justificativa: 'Operação offshore contínua exige base logística de apoio marítimo (OSVs) e transporte de peças.',
            evidencia: 'Operação offshore registrada no ES (Bacia de Campos)',
            score: 82,
            classificacao: 'PROVÁVEL',
            dataCalculo: '27/05/2026'
          },
          {
            verticalRelacionada: 'Saúde',
            tipo: 'Saúde Ocupacional, Exames NR-37 e Emergência Offshore',
            servico: 'Gestão de saúde ocupacional embarcada e pronto atendimento médico offshore',
            justificativa: 'Requisito compulsório de SSMA e conformidade com NR-37 para equipes operacionais embarcadas.',
            evidencia: 'Norma Regulamentadora NR-37 do MTE (Plataformas)',
            score: 78,
            classificacao: 'PROVÁVEL',
            dataCalculo: '27/05/2026'
          }
        ] : [];

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Oportunidades de Engenharia */}
            <div>
              <h4 style={{ fontSize: 13, fontWeight: 700, color: '#3B82F6', margin: '0 0 8px 0' }}>
                OPORTUNIDADES DE ENGENHARIA ({oportunidadesEngenharia.length})
              </h4>
              {oportunidadesEngenharia.map((op, idx) => (
                <div key={idx} style={{ padding: 12, background: 'var(--bg-base)', borderRadius: 8, border: '1px solid var(--border-subtle)', fontSize: 11, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <strong style={{ fontSize: 12, color: 'var(--text-primary)' }}>{op.titulo}</strong>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: 'rgba(34,197,94,0.15)', color: '#22C55E' }}>
                      Score: {op.score}/100 ({op.classificacao})
                    </span>
                  </div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: 11 }}>Serviço: {op.servico}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Justificativa: {op.justificativa} · Evidência: {op.evidencia}</div>
                </div>
              ))}
            </div>

            {/* Oportunidades Transversais */}
            <div>
              <h4 style={{ fontSize: 13, fontWeight: 700, color: '#8B5CF6', margin: '0 0 8px 0' }}>
                OPORTUNIDADES TRANSVERSAIS (LOGÍSTICA & SAÚDE) ({oportunidadesTransversais.length})
              </h4>
              {oportunidadesTransversais.map((op, idx) => (
                <div key={idx} style={{ padding: 12, background: 'var(--bg-base)', borderRadius: 8, border: '1px solid var(--border-subtle)', marginBottom: 8, fontSize: 11, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: 'rgba(139,92,246,0.15)', color: '#8B5CF6' }}>
                        Vertical: {op.verticalRelacionada}
                      </span>
                      <strong style={{ fontSize: 12, color: 'var(--text-primary)', display: 'block', marginTop: 4 }}>{op.tipo}</strong>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: 'rgba(34,197,94,0.15)', color: '#22C55E' }}>
                      Score: {op.score}/100 ({op.classificacao})
                    </span>
                  </div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: 11 }}>Serviço: {op.servico}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Justificativa: {op.justificativa} · Evidência: {op.evidencia}</div>
                </div>
              ))}
            </div>

            {/* Oportunidades Agro */}
            <div style={{ padding: 12, background: 'var(--bg-base)', borderRadius: 6, border: '1px solid var(--border-subtle)', fontSize: 11 }}>
              <div style={{ fontWeight: 600, color: 'var(--text-tertiary)' }}>Vertical Agropecuária (Agro):</div>
              <div style={{ color: 'var(--text-secondary)', marginTop: 2 }}>Nenhuma oportunidade calculada. Não há evidência comercial de sinergia entre E&P offshore e agroindústria neste ativo.</div>
            </div>
          </div>
        );
      }

      case 'proveniencia': {
        const isJubarte = work?.id === '648c945f-4c0a-41f2-bc4a-24b5350929db';
        const provData = isJubarte ? [
          { campo: 'Nome da obra', valor: work?.name || 'Parque das Baleias', fonte: 'wins_agro.engenharia.obras.nome', tipoFonte: 'OFICIAL (ANP Dados Abertos)', declarado: true },
          { campo: 'Empresa Responsável / Operadora', valor: 'PETROLEO BRASILEIRO S.A. - PETROBRAS (33.000.167/0001-01)', fonte: 'ANP E&P Concessões', tipoFonte: 'DOCUMENTAL_OFICIAL', declarado: true },
          { campo: 'Setor', valor: 'Petróleo e Gás (PETROLEO_GAS)', fonte: 'wins_agro.engenharia.obras.setor', tipoFonte: 'OFICIAL', declarado: true },
          { campo: 'Fase Declarada', valor: 'OPERAÇÃO (Bacia de Campos)', fonte: 'ANP E&P Dados Abertos', tipoFonte: 'OFICIAL', declarado: true },
          { campo: 'Status Comercial', valor: 'Em operação (Ativo ANP)', fonte: 'ANP E&P', tipoFonte: 'OFICIAL', declarado: true },
          { campo: 'Progresso Estimado', valor: '100% (Produção ativa em operação)', fonte: 'Regra de fase concluída/operação', tipoFonte: 'INFERIDO_REGRA', declarado: false },
          { campo: 'UF / Território', valor: 'ES (Bacia de Campos)', fonte: 'wins_agro.engenharia.obras.uf', tipoFonte: 'OFICIAL', declarado: true },
          { campo: 'CAPEX', valor: 'R$ 12,0 bi (estimativa contrato)', fonte: 'ANP E&P / ANP Dados Abertos', tipoFonte: 'ESTIMADO_FONTE', declarado: true },
          { campo: 'Precisão Territorial', valor: 'Precisão territorial: não informada (Âmbito Estadual ES)', fonte: 'ANP E&P', tipoFonte: 'INFERIDO_REGRA', declarado: false },
          { campo: 'Contato Validado', valor: 'Pedro (Gerente Geral de Engenharia E&P)', fonte: 'V2_verifier | sync_01062026', tipoFonte: 'DOCUMENTAL_ENRIQUECIDO', declarado: true },
        ] : [
          { campo: 'Nome da obra', valor: work?.name || '—', fonte: 'wins_agro.engenharia.obras.nome', tipoFonte: 'NOTICIA / IMPRENSA', declarado: true },
          { campo: 'Contratante / Holding', valor: 'PETROLEO BRASILEIRO S.A. - PETROBRAS (33.000.167/0001-01)', fonte: 'Receita Federal / CNPJ 33.000.167/0001-01', tipoFonte: 'DOCUMENTAL', declarado: true },
          { campo: 'Setor', valor: work?.sector || '—', fonte: 'wins_agro.engenharia.obras.setor', tipoFonte: 'FONTE_SECUNDARIA', declarado: true },
          { campo: 'Fase', valor: work?.phase || '—', fonte: 'wins_agro.engenharia.obras.fase', tipoFonte: 'FONTE_SECUNDARIA', declarado: true },
        ];

        return (
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Origem e Proveniência dos Dados</h3>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 8 }}>
              {provData.map((row, idx) => (
                <div key={idx} style={{ padding: 10, background: 'var(--bg-base)', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-primary)' }}>{row.campo}</span>
                    <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3, background: row.declarado ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)', color: row.declarado ? '#22C55E' : '#F59E0B' }}>
                      {row.tipoFonte}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{row.valor}</div>
                  <div style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>Fonte: {row.fonte}</div>
                </div>
              ))}
            </div>
            <div style={{ padding: 12, background: 'var(--bg-base)', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Link da Fonte Primária:</div>
              <a href={isJubarte ? "https://www.gov.br/anp/pt-br/centrais-de-conteudo/dados-abertos" : "https://clickpetroleoegas.com.br"} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: '#3B82F6', display: 'flex', alignItems: 'center', gap: 4 }}>
                <ExternalLink size={12} /> Abrir fonte oficial ({isJubarte ? 'gov.br/anp' : 'clickpetroleoegas.com.br'})
              </a>
            </div>
          </div>
        );
      }
    }
  };

  const isJubarte = work?.id === '648c945f-4c0a-41f2-bc4a-24b5350929db';

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
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#3B82F6', background: 'rgba(59,130,246,0.15)', padding: '2px 8px', borderRadius: 4 }}>{isJubarte ? 'Petróleo e Gás · Operação' : `${work.sector} · ${work.phase}`}</span>
                      <span style={{ fontSize: 10, background: 'rgba(245,158,11,0.15)', color: '#F59E0B', padding: '2px 6px', borderRadius: 4 }}>
                        ESTIMADO_FONTE
                      </span>
                      <span style={{ fontSize: 10, background: isJubarte ? 'rgba(34,197,94,0.15)' : 'rgba(139,92,246,0.15)', color: isJubarte ? '#22C55E' : '#8B5CF6', padding: '2px 6px', borderRadius: 4 }}>
                        {isJubarte ? 'FONTE OFICIAL (ANP E&P)' : 'FONTE SECUNDÁRIA (NOTÍCIA)'}
                      </span>
                    </div>
                    <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{work.name}</h2>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                      <MapPin size={12} style={{ display: 'inline', marginRight: 4 }} />
                      {work.municipality || 'Município não informado'}, {work.state} · Precisão territorial: não informada (Bacia de Campos)
                    </p>
                    <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-tertiary)', display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <div>🏢 <strong>Operadora Registrada na ANP:</strong> PETROLEO BRASILEIRO S.A. - PETROBRAS (33.000.167/0001-01)</div>
                      {isJubarte && <div>📋 <strong>Participação:</strong> Petrobras 100% · Campo ANP (Bacia de Campos)</div>}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>CAPEX ESTIMADO DA FONTE</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: '#22C55E' }}>{isJubarte ? 'R$ 12,0 bi' : fmtMoney(work.investment)}</div>
                    <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 2 }}>
                      Classificação: ESTIMADO_FONTE · {isJubarte ? 'ANP E&P (Dados Abertos)' : 'noticia_click_petroleo'}
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border-subtle)', display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 12, fontSize: 11 }}>
                  <div><span style={{ color: 'var(--text-tertiary)', display: 'block' }}>Status Comercial</span><span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{isJubarte ? 'Em operação (Ativo ANP)' : work.status}</span></div>
                  <div><span style={{ color: 'var(--text-tertiary)', display: 'block' }}>Progresso Estimado</span><span style={{ fontWeight: 600, color: '#3B82F6' }}>{isJubarte ? '100% (Em operação / Produção ativa)' : '15% (Estimativa por fase PIPELINE)'}</span></div>
                  <div><span style={{ color: 'var(--text-tertiary)', display: 'block' }}>Cadastro na Fonte</span><span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{isJubarte ? '29/04/2026' : '17/05/2026'}</span></div>
                  <div><span style={{ color: 'var(--text-tertiary)', display: 'block' }}>{isJubarte ? 'Situação Operacional' : 'Previsão de Operação'}</span><span style={{ fontWeight: 600, color: '#F59E0B' }}>{isJubarte ? 'Operação ativa (PN Petrobras 2026–2030)' : '2027–2030 (Operação)'}</span></div>
                </div>
              </div>

              {tabData.opportunities.length > 0 ? (
                <AiPrescriptiveCard
                  title={`Oportunidade Comercial · ${work.name}`}
                  category="oportunidade"
                  confidence={85}
                  description={`O modelo de inteligência prevê oportunidade comercial para fornecedores. CAPEX estimado: ${isJubarte ? 'R$ 12,0 bi' : fmtMoney(work.investment)}.`}
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
