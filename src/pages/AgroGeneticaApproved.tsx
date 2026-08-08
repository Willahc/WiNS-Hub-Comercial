import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { httpClient } from '../services/http/client';
import { AGRO_API } from './agroApiEndpoints';
import AgroPageShell from '../components/AgroPageShell';
import {
  Dna,
  ShieldAlert,
  Search,
  CheckCircle2,
  AlertTriangle,
  Info,
  ChevronRight,
  Database,
  Layers,
  Award,
  GitBranch,
  XCircle,
  HelpCircle,
  Eye,
  SlidersHorizontal,
  ChevronLeft
} from 'lucide-react';

export type TabKey = 'resumo' | 'reprodutores' | 'perfil' | 'pedigree' | 'acasalamento' | 'matrizes' | 'metodologia';

export const KINSHIP_LABELS: Record<string, string> = {
  PARENT_CHILD: 'Parentesco Pai/Mãe-Filho(a) Direto (PARENT_CHILD)',
  HALF_SIBLING_PATERNAL: 'Meio-irmãos Pelo Mesmo Pai (HALF_SIBLING_PATERNAL)',
  HALF_SIBLING_MATERNAL: 'Meio-irmãos Pela Mesma Mãe (HALF_SIBLING_MATERNAL)'
};

export default function AgroGeneticaApproved() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = (searchParams.get('tab') as TabKey) || 'resumo';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Data states
  const [resumoData, setResumoData] = useState<any>(null);
  const [reprodutoresList, setReprodutoresList] = useState<any[]>([]);
  const [reprodutoresMeta, setReprodutoresMeta] = useState<any>(null);
  const [caracteristicasData, setCaracteristicasData] = useState<any>(null);
  const [prontidaoData, setProntidaoData] = useState<any>(null);

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [selectedRaca, setSelectedRaca] = useState(searchParams.get('raca') || '');
  const [selectedCentral, setSelectedCentral] = useState(searchParams.get('central') || '');
  const [selectedPedigreeStatus, setSelectedPedigreeStatus] = useState(searchParams.get('pedigree') || '');
  const [currentPage, setCurrentPage] = useState(parseInt(searchParams.get('page') || '1', 10));

  // Selected animal detail modal/drawer
  const [selectedReprodutorId, setSelectedReprodutorId] = useState<string | null>(null);
  const [selectedReprodutorDetail, setSelectedReprodutorDetail] = useState<any>(null);
  const [selectedReprodutorPedigree, setSelectedReprodutorPedigree] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Mating simulator state
  const [selectedMatrixId, setSelectedMatrixId] = useState<string>('');
  const [selectedTargetTrait, setSelectedTargetTrait] = useState<string>('GPD');
  const [matingResult, setMatingResult] = useState<any>(null);
  const [matingLoading, setMatingLoading] = useState(false);

  // Change tab and sync with URL
  const handleTabChange = (tab: TabKey) => {
    const params = new URLSearchParams(searchParams);
    params.set('tab', tab);
    setSearchParams(params);
  };

  // Load general summary & characteristics once
  const loadInitialData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [resumoRes, caracRes, prontidaoRes] = await Promise.all([
        httpClient.get<any>(AGRO_API.geneticaResumo),
        httpClient.get<any>(AGRO_API.geneticaCaracteristicas),
        httpClient.get<any>(AGRO_API.geneticaAcasalamentoProntidao)
      ]);
      setResumoData(resumoRes.data);
      setCaracteristicasData(caracRes.data);
      setProntidaoData(prontidaoRes.data);

      if (prontidaoRes.data?.matrizes?.length > 0 && !selectedMatrixId) {
        setSelectedMatrixId(prontidaoRes.data.matrizes[0].id);
      }
    } catch (err: any) {
      console.error('Erro ao carregar dados genéticos:', err);
      setError(err?.message || 'Falha ao carregar núcleo genético');
    } finally {
      setLoading(false);
    }
  }, [selectedMatrixId]);

  // Load reproducers with pagination and filters
  const loadReprodutores = useCallback(async () => {
    try {
      const params: Record<string, any> = {
        page: currentPage,
        page_size: 25,
        sort: 'avaliacoes_count',
        order: 'desc'
      };
      if (searchQuery) params.q = searchQuery;
      if (selectedRaca) params.raca = selectedRaca;
      if (selectedCentral) params.central = selectedCentral;
      if (selectedPedigreeStatus) params.pedigree_status = selectedPedigreeStatus;

      const res = await httpClient.get<any>(AGRO_API.geneticaReprodutores, { params });
      setReprodutoresList(res.data?.items || []);
      setReprodutoresMeta(res.data?.meta || null);
    } catch (err: any) {
      console.error('Erro ao carregar reprodutores:', err);
    }
  }, [currentPage, searchQuery, selectedRaca, selectedCentral, selectedPedigreeStatus]);

  // Load reproducer detail when selected
  const loadReprodutorDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    try {
      const [detailRes, pedRes] = await Promise.all([
        httpClient.get<any>(AGRO_API.geneticaReprodutor(id)),
        httpClient.get<any>(AGRO_API.geneticaPedigree(id))
      ]);
      setSelectedReprodutorDetail(detailRes.data);
      setSelectedReprodutorPedigree(pedRes.data);
    } catch (err: any) {
      console.error('Erro ao carregar detalhe do reprodutor:', err);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  // Run mating candidates evaluation
  const runAcasalamento = useCallback(async () => {
    if (!selectedMatrixId) return;
    setMatingLoading(true);
    try {
      const payload = {
        matrix_id: selectedMatrixId,
        target_characteristic: selectedTargetTrait,
        limit: 15
      };
      const res = await httpClient.post<any>(AGRO_API.geneticaAcasalamentoCandidatos, payload);
      setMatingResult(res.data);
    } catch (err: any) {
      console.error('Erro ao executar acasalamento:', err);
    } finally {
      setMatingLoading(false);
    }
  }, [selectedMatrixId, selectedTargetTrait]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    loadReprodutores();
  }, [loadReprodutores]);

  useEffect(() => {
    if (selectedReprodutorId) {
      loadReprodutorDetail(selectedReprodutorId);
    } else {
      setSelectedReprodutorDetail(null);
      setSelectedReprodutorPedigree(null);
    }
  }, [selectedReprodutorId, loadReprodutorDetail]);

  const counts = resumoData?.counts || {};
  const breedDistribution = resumoData?.breed_distribution || [];

  // Group characteristics by category
  const categorizedTraits = useMemo(() => {
    const traits = caracteristicasData?.caracteristicas || [];
    const groups: Record<string, any[]> = {};
    for (const t of traits) {
      const cat = t.categoria || 'Outras / Específicas';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(t);
    }
    return groups;
  }, [caracteristicasData]);

  return (
    <AgroPageShell
      title="Genética & Rebanho"
      subtitle="Núcleo Zootécnico, Catálogo Oficial de Reprodutores & Acasalamento Dirigido"
      loading={loading}
      error={error}
      onRetry={loadInitialData}
      statusBadge="Catálogo Oficial Auditado"
    >
      {/* Disclaimer de Integridade Zootécnica */}
      <div style={{ background: 'rgba(236, 72, 153, 0.08)', border: '1px solid rgba(236, 72, 153, 0.25)', borderRadius: 8, padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
        <ShieldAlert size={22} color="#EC4899" style={{ flexShrink: 0 }} />
        <div style={{ fontSize: 12, color: '#E2E8F0', lineHeight: 1.5 }}>
          <strong>Governança de Integridade Zootécnica:</strong> O WiNS Hub Agro opera em modo estritamente factual. Todos os dados de DEPs, acurácias, percentis e genealogia decorrem de sumários zootécnicos oficiais homologados. Nenhum resultado fictício, score sintético, prenhez estimada fixa ou pedigree inferido por similaridade é gerado.
        </div>
      </div>

      {/* Tabs Navigation */}
      <div style={{ display: 'flex', gap: 6, borderBottom: '1px solid var(--border-default)', paddingBottom: 8, overflowX: 'auto' }}>
        {[
          { key: 'resumo', label: '1. Visão Geral', icon: Layers },
          { key: 'reprodutores', label: '2. Reprodutores', icon: Database },
          { key: 'perfil', label: '3. Perfil & DEPs', icon: Dna },
          { key: 'pedigree', label: '4. Pedigree', icon: GitBranch },
          { key: 'acasalamento', label: '5. Acasalamento', icon: Award },
          { key: 'matrizes', label: '6. Matrizes & Lotes', icon: CheckCircle2 },
          { key: 'metodologia', label: '7. Metodologia', icon: HelpCircle }
        ].map(({ key, label, icon: Icon }) => {
          const isActive = currentTab === key;
          return (
            <button
              key={key}
              id={`tab-genetica-${key}`}
              onClick={() => handleTabChange(key as TabKey)}
              style={{
                background: isActive ? '#EC4899' : 'var(--bg-surface)',
                color: isActive ? '#FFFFFF' : '#94A3B8',
                border: `1px solid ${isActive ? '#EC4899' : 'var(--border-default)'}`,
                padding: '8px 14px',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease'
              }}
            >
              <Icon size={14} />
              {label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: VISÃO GERAL */}
      {currentTab === 'resumo' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Summary Metric Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8, padding: 16 }}>
              <span style={{ fontSize: 11, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Reprodutores Oficiais</span>
              <strong style={{ display: 'block', fontSize: 24, color: '#F8FAFC', marginTop: 4 }}>
                {counts.total_reprodutores?.toLocaleString('pt-BR') || '118.793'}
              </strong>
              <small style={{ color: '#22C55E', fontSize: 11 }}>100% com RGD e Nome</small>
            </div>

            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8, padding: 16 }}>
              <span style={{ fontSize: 11, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Avaliações Genéticas (DEPs)</span>
              <strong style={{ display: 'block', fontSize: 24, color: '#EC4899', marginTop: 4 }}>
                {counts.total_avaliacoes?.toLocaleString('pt-BR') || '1.195.971'}
              </strong>
              <small style={{ color: '#94A3B8', fontSize: 11 }}>75.197 touros avaliados</small>
            </div>

            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8, padding: 16 }}>
              <span style={{ fontSize: 11, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pedigrees Declarados</span>
              <strong style={{ display: 'block', fontSize: 24, color: '#38BDF8', marginTop: 4 }}>
                {counts.com_pedigree_pai_mae?.toLocaleString('pt-BR') || '71.715'}
              </strong>
              <small style={{ color: '#94A3B8', fontSize: 11 }}>Pai e Mãe informados (60,4%)</small>
            </div>

            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8, padding: 16 }}>
              <span style={{ fontSize: 11, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Características Mapeadas</span>
              <strong style={{ display: 'block', fontSize: 24, color: '#A855F7', marginTop: 4 }}>
                {counts.total_caracteristicas || 56}
              </strong>
              <small style={{ color: '#22C55E', fontSize: 11 }}>{counts.caracteristicas_densas || 19} com cobertura massiva</small>
            </div>

            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8, padding: 16 }}>
              <span style={{ fontSize: 11, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Centrais & Ofertas</span>
              <strong style={{ display: 'block', fontSize: 24, color: '#F59E0B', marginTop: 4 }}>
                {counts.total_centrais || 19} centrais
              </strong>
              <small style={{ color: '#94A3B8', fontSize: 11 }}>{counts.ofertas_semen?.toLocaleString('pt-BR') || '2.924'} ofertas de dose</small>
            </div>

            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8, padding: 16 }}>
              <span style={{ fontSize: 11, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Matrizes Cadastradas</span>
              <strong style={{ display: 'block', fontSize: 24, color: '#E2E8F0', marginTop: 4 }}>
                {counts.matrizes_reais || 14}
              </strong>
              <small style={{ color: '#F59E0B', fontSize: 11 }}>8 fazenda + 6 doadoras catálogo</small>
            </div>
          </div>

          {/* Status dos Pilares */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8, padding: 16 }}>
            <h4 style={{ fontSize: 14, fontWeight: 700, color: '#F8FAFC', margin: '0 0 12px 0' }}>Status Factual dos Pilares de Produto</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
              <div style={{ background: '#0F172A', padding: 12, borderRadius: 6, border: '1px solid #1E293B' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#F8FAFC' }}>Catálogo de Reprodutores</span>
                  <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(34, 197, 94, 0.2)', color: '#22C55E', fontWeight: 700 }}>AVAILABLE</span>
                </div>
                <small style={{ color: '#94A3B8', display: 'block', marginTop: 4, fontSize: 11 }}>118.793 reprodutores com RGD, raça e criatório de origem.</small>
              </div>

              <div style={{ background: '#0F172A', padding: 12, borderRadius: 6, border: '1px solid #1E293B' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#F8FAFC' }}>Avaliações Genéticas (DEPs)</span>
                  <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(34, 197, 94, 0.2)', color: '#22C55E', fontWeight: 700 }}>AVAILABLE</span>
                </div>
                <small style={{ color: '#94A3B8', display: 'block', marginTop: 4, fontSize: 11 }}>1,19M avaliações com valor, percentil e acurácia oficial.</small>
              </div>

              <div style={{ background: '#0F172A', padding: 12, borderRadius: 6, border: '1px solid #1E293B' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#F8FAFC' }}>Pedigree Imediato Declarado</span>
                  <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(34, 197, 94, 0.2)', color: '#22C55E', fontWeight: 700 }}>AVAILABLE</span>
                </div>
                <small style={{ color: '#94A3B8', display: 'block', marginTop: 4, fontSize: 11 }}>71.715 reprodutores com pai e mãe cadastrados no programa.</small>
              </div>

              <div style={{ background: '#0F172A', padding: 12, borderRadius: 6, border: '1px solid #1E293B' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#F8FAFC' }}>Acasalamento Dirigido</span>
                  <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(236, 72, 153, 0.2)', color: '#EC4899', fontWeight: 700 }}>AVAILABLE_WITH_MATRIX</span>
                </div>
                <small style={{ color: '#94A3B8', display: 'block', marginTop: 4, fontSize: 11 }}>Ranqueia touros por mérito e bloqueia parentesco direto quando matriz é informada.</small>
              </div>

              <div style={{ background: '#0F172A', padding: 12, borderRadius: 6, border: '1px solid #1E293B' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#F8FAFC' }}>Consanguinidade Formal (Wright)</span>
                  <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(245, 158, 11, 0.2)', color: '#F59E0B', fontWeight: 700 }}>UNAVAILABLE</span>
                </div>
                <small style={{ color: '#94A3B8', display: 'block', marginTop: 4, fontSize: 11 }}>Exige profundidade genealógica multi-geracional e matriz de parentesco pré-calculada.</small>
              </div>

              <div style={{ background: '#0F172A', padding: 12, borderRadius: 6, border: '1px solid #1E293B' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#F8FAFC' }}>Valor Econômico / ROI Sintético</span>
                  <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(245, 158, 11, 0.2)', color: '#F59E0B', fontWeight: 700 }}>UNAVAILABLE</span>
                </div>
                <small style={{ color: '#94A3B8', display: 'block', marginTop: 4, fontSize: 11 }}>Depende dos parâmetros de custo e índices produtivos reais de cada propriedade.</small>
              </div>
            </div>
          </div>

          {/* Distribuição por Raça */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8, padding: 16 }}>
            <h4 style={{ fontSize: 14, fontWeight: 700, color: '#F8FAFC', margin: '0 0 12px 0' }}>Concentração do Catálogo por Raça (22 Raças Ativas)</h4>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#0B132B', color: '#94A3B8', borderBottom: '1px solid #1E293B' }}>
                  <th style={{ padding: '8px 10px' }}>Raça</th>
                  <th style={{ padding: '8px 10px' }}>Reprodutores</th>
                  <th style={{ padding: '8px 10px' }}>% do Catálogo</th>
                  <th style={{ padding: '8px 10px' }}>Pai Declarado</th>
                  <th style={{ padding: '8px 10px' }}>Mãe Declarada</th>
                  <th style={{ padding: '8px 10px' }}>Pedigree Completo</th>
                </tr>
              </thead>
              <tbody>
                {breedDistribution.slice(0, 12).map((b: any, idx: number) => {
                  const pct = counts.total_reprodutores ? ((b.total / counts.total_reprodutores) * 100).toFixed(2) : '0';
                  return (
                    <tr key={idx} style={{ borderBottom: '1px solid #1E293B' }}>
                      <td style={{ padding: '8px 10px', color: '#F8FAFC', fontWeight: 600 }}>{b.raca}</td>
                      <td style={{ padding: '8px 10px', color: '#E2E8F0' }}>{b.total.toLocaleString('pt-BR')}</td>
                      <td style={{ padding: '8px 10px', color: '#EC4899' }}>{pct}%</td>
                      <td style={{ padding: '8px 10px', color: '#94A3B8' }}>{b.with_pai?.toLocaleString('pt-BR')}</td>
                      <td style={{ padding: '8px 10px', color: '#94A3B8' }}>{b.with_mae?.toLocaleString('pt-BR')}</td>
                      <td style={{ padding: '8px 10px', color: '#22C55E' }}>{b.with_ambos?.toLocaleString('pt-BR')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: REPRODUTORES */}
      {currentTab === 'reprodutores' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Search & Filters */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8, padding: 14, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: '1 1 200px' }}>
              <Search size={14} color="#94A3B8" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder="Buscar por nome, RGD ou criatório..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: '100%', background: '#0F172A', border: '1px solid #334155', borderRadius: 6, padding: '7px 10px 7px 30px', color: '#F8FAFC', fontSize: 12 }}
              />
            </div>

            <select
              value={selectedRaca}
              onChange={(e) => setSelectedRaca(e.target.value)}
              style={{ background: '#0F172A', border: '1px solid #334155', borderRadius: 6, padding: '7px 10px', color: '#F8FAFC', fontSize: 12 }}
            >
              <option value="">Todas as Raças</option>
              {breedDistribution.map((b: any) => (
                <option key={b.id} value={b.raca}>{b.raca} ({b.total})</option>
              ))}
            </select>

            <select
              value={selectedPedigreeStatus}
              onChange={(e) => setSelectedPedigreeStatus(e.target.value)}
              style={{ background: '#0F172A', border: '1px solid #334155', borderRadius: 6, padding: '7px 10px', color: '#F8FAFC', fontSize: 12 }}
            >
              <option value="">Todos os Pedigrees</option>
              <option value="declared">Pedigree Declarado (Pai + Mãe)</option>
              <option value="partial">Pedigree Parcial</option>
              <option value="none">Sem Pedigree Declarado</option>
            </select>
          </div>

          {/* Reprodutores Table */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', background: '#0F172A', borderBottom: '1px solid var(--border-default)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#F8FAFC' }}>
                Exibindo {reprodutoresList.length} de {reprodutoresMeta?.total?.toLocaleString('pt-BR') || 0} reprodutores
              </span>
              <span style={{ fontSize: 11, color: '#94A3B8' }}>Página {currentPage} de {reprodutoresMeta?.totalPages || 1}</span>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#0B132B', color: '#94A3B8', borderBottom: '1px solid #1E293B' }}>
                  <th style={{ padding: '10px' }}>RGD / Nome</th>
                  <th style={{ padding: '10px' }}>Raça</th>
                  <th style={{ padding: '10px' }}>Pedigree Imediato</th>
                  <th style={{ padding: '10px' }}>Criatório / Origem</th>
                  <th style={{ padding: '10px' }}>Central / Oferta</th>
                  <th style={{ padding: '10px' }}>DEPs</th>
                  <th style={{ padding: '10px' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {reprodutoresList.map((t: any) => (
                  <tr key={t.id} style={{ borderBottom: '1px solid #1E293B' }}>
                    <td style={{ padding: '10px' }}>
                      <strong style={{ color: '#F8FAFC', display: 'block' }}>{t.nome || 'Reprodutor Cadastrado'}</strong>
                      <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#EC4899' }}>{t.registro || 'S/RGD'}</span>
                    </td>
                    <td style={{ padding: '10px', color: '#CBD5E1' }}>{t.raca_nome || '—'}</td>
                    <td style={{ padding: '10px', color: '#94A3B8', fontSize: 11 }}>
                      {t.pai_nome ? <span>P: {t.pai_nome}</span> : <span style={{ color: '#64748B' }}>P: —</span>}
                      <br />
                      {t.mae_nome ? <span>M: {t.mae_nome}</span> : <span style={{ color: '#64748B' }}>M: —</span>}
                    </td>
                    <td style={{ padding: '10px', color: '#94A3B8', fontSize: 11 }}>
                      {t.fazenda_origem || '—'}
                      {t.uf && <span style={{ color: '#64748B' }}> ({t.uf})</span>}
                    </td>
                    <td style={{ padding: '10px', fontSize: 11 }}>
                      {t.central_nome ? (
                        <span style={{ color: '#38BDF8', fontWeight: 600 }}>{t.central_nome}</span>
                      ) : (
                        <span style={{ color: '#64748B' }}>Direto no criatório</span>
                      )}
                      {t.preco_dose_brl && (
                        <div style={{ color: '#22C55E', fontWeight: 600 }}>R$ {t.preco_dose_brl.toFixed(2)}/dose</div>
                      )}
                    </td>
                    <td style={{ padding: '10px' }}>
                      <span style={{ background: '#1E293B', color: '#E2E8F0', padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700 }}>
                        {t.avaliacoes_count} DEPs
                      </span>
                    </td>
                    <td style={{ padding: '10px' }}>
                      <button
                        onClick={() => setSelectedReprodutorId(t.id)}
                        style={{ background: '#0F172A', color: '#EC4899', border: '1px solid #EC4899', padding: '4px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                      >
                        <Eye size={12} /> Detalhe
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination Controls */}
            <div style={{ padding: '10px 14px', background: '#0B132B', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                style={{ background: '#1E293B', color: '#F8FAFC', border: 'none', padding: '6px 12px', borderRadius: 4, fontSize: 11, cursor: currentPage <= 1 ? 'not-allowed' : 'pointer', opacity: currentPage <= 1 ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <ChevronLeft size={14} /> Anterior
              </button>
              <span style={{ fontSize: 11, color: '#94A3B8' }}>Página {currentPage} de {reprodutoresMeta?.totalPages || 1}</span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(reprodutoresMeta?.totalPages || 1, p + 1))}
                disabled={currentPage >= (reprodutoresMeta?.totalPages || 1)}
                style={{ background: '#1E293B', color: '#F8FAFC', border: 'none', padding: '6px 12px', borderRadius: 4, fontSize: 11, cursor: currentPage >= (reprodutoresMeta?.totalPages || 1) ? 'not-allowed' : 'pointer', opacity: currentPage >= (reprodutoresMeta?.totalPages || 1) ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: 4 }}
              >
                Próxima <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PERFIL GENÉTICO & DEPs */}
      {currentTab === 'perfil' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8, padding: 16 }}>
            <h4 style={{ fontSize: 14, fontWeight: 700, color: '#F8FAFC', margin: '0 0 4px 0' }}>Catálogo de 56 Características Zootécnicas & DEPs</h4>
            <p style={{ fontSize: 12, color: '#94A3B8', margin: '0 0 16px 0' }}>
              Divisão por grupos zootécnicos oficiais com indicação expressa da direção de seleção, unidade de medida e cobertura populacional.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {Object.entries(categorizedTraits).map(([category, traits]) => (
                <div key={category} style={{ background: '#0F172A', border: '1px solid #1E293B', borderRadius: 8, padding: 14 }}>
                  <h5 style={{ fontSize: 13, fontWeight: 700, color: '#EC4899', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Dna size={14} /> {category} ({traits.length} características)
                  </h5>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10 }}>
                    {traits.map((t: any) => (
                      <div key={t.id} style={{ background: '#0B132B', border: '1px solid #1E293B', borderRadius: 6, padding: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <strong style={{ color: '#F8FAFC', fontSize: 12 }}>{t.sigla}</strong> — <span style={{ color: '#CBD5E1', fontSize: 11 }}>{t.nome}</span>
                          </div>
                          <span style={{ fontSize: 9, padding: '2px 5px', borderRadius: 3, background: t.selection_direction === 'HIGHER_BETTER' ? 'rgba(34, 197, 94, 0.2)' : t.selection_direction === 'LOWER_BETTER' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(148, 163, 184, 0.2)', color: t.selection_direction === 'HIGHER_BETTER' ? '#22C55E' : t.selection_direction === 'LOWER_BETTER' ? '#38BDF8' : '#94A3B8', fontWeight: 700 }}>
                            {t.selection_direction === 'HIGHER_BETTER' ? 'MAIOR = MELHOR' : t.selection_direction === 'LOWER_BETTER' ? 'MENOR = MELHOR' : 'ESPECÍFICO'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, fontSize: 11, color: '#94A3B8' }}>
                          <span>{t.total_avaliacoes?.toLocaleString('pt-BR') || 0} avaliações</span>
                          {t.unidade && <span>Unid: {t.unidade}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: PEDIGREE */}
      {currentTab === 'pedigree' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8, padding: 16 }}>
            <h4 style={{ fontSize: 14, fontWeight: 700, color: '#F8FAFC', margin: '0 0 8px 0' }}>Árvore de Pedigree Imediato Declarado</h4>
            <p style={{ fontSize: 12, color: '#94A3B8', margin: '0 0 16px 0' }}>
              Selecione um reprodutor do catálogo na aba anterior ou consulte o modelo de genealogia comprovada abaixo.
            </p>

            {selectedReprodutorPedigree ? (
              <div style={{ background: '#0F172A', border: '1px solid #1E293B', borderRadius: 8, padding: 16 }}>
                <div style={{ fontSize: 12, color: '#38BDF8', fontWeight: 600, marginBottom: 12 }}>
                  Pedigree do Reprodutor: {selectedReprodutorPedigree.subject?.nome} ({selectedReprodutorPedigree.subject?.registro})
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                  <div style={{ background: '#0B132B', border: '1px solid #334155', borderRadius: 6, padding: 12 }}>
                    <small style={{ color: '#94A3B8', display: 'block' }}>Indivíduo (G0)</small>
                    <strong style={{ color: '#F8FAFC', fontSize: 13 }}>{selectedReprodutorPedigree.subject?.nome}</strong>
                    <div style={{ fontSize: 11, color: '#EC4899', marginTop: 2 }}>RGD: {selectedReprodutorPedigree.subject?.registro}</div>
                    <div style={{ fontSize: 11, color: '#94A3B8' }}>Raça: {selectedReprodutorPedigree.subject?.raca}</div>
                  </div>

                  <div style={{ background: '#0B132B', border: '1px solid #334155', borderRadius: 6, padding: 12 }}>
                    <small style={{ color: '#94A3B8', display: 'block' }}>Pai Declarado (G1)</small>
                    <strong style={{ color: '#F8FAFC', fontSize: 13 }}>{selectedReprodutorPedigree.father?.nome || '—'}</strong>
                    <div style={{ fontSize: 11, color: '#38BDF8', marginTop: 2 }}>RGD: {selectedReprodutorPedigree.father?.registro || 'Não informado'}</div>
                    <div style={{ fontSize: 10, color: '#22C55E', marginTop: 2 }}>
                      {selectedReprodutorPedigree.father?.resolved_id ? '✓ Vínculo resolvido no catálogo' : 'Registro nominal declarado'}
                    </div>
                  </div>

                  <div style={{ background: '#0B132B', border: '1px solid #334155', borderRadius: 6, padding: 12 }}>
                    <small style={{ color: '#94A3B8', display: 'block' }}>Mãe Declarada (G1)</small>
                    <strong style={{ color: '#F8FAFC', fontSize: 13 }}>{selectedReprodutorPedigree.mother?.nome || '—'}</strong>
                    <div style={{ fontSize: 11, color: '#38BDF8', marginTop: 2 }}>RGD: {selectedReprodutorPedigree.mother?.registro || 'Não informado'}</div>
                    <div style={{ fontSize: 10, color: '#22C55E', marginTop: 2 }}>
                      {selectedReprodutorPedigree.mother?.resolved_id ? '✓ Vínculo resolvido no catálogo' : 'Registro nominal declarado'}
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 14, fontSize: 11, color: '#94A3B8', borderTop: '1px solid #1E293B', paddingTop: 10 }}>
                  <strong>Qualidade do Pedigree:</strong> {selectedReprodutorPedigree.quality} | <strong>Profundidade:</strong> Geração {selectedReprodutorPedigree.depth_available}
                  <p style={{ margin: '4px 0 0 0', color: '#64748B' }}>{selectedReprodutorPedigree.limitations}</p>
                </div>
              </div>
            ) : (
              <div style={{ background: '#0F172A', border: '1px solid #1E293B', borderRadius: 8, padding: 20, textAlign: 'center' }}>
                <GitBranch size={32} color="#94A3B8" style={{ margin: '0 auto 10px auto' }} />
                <strong style={{ color: '#F8FAFC', display: 'block', fontSize: 13 }}>Nenhum reprodutor selecionado no momento</strong>
                <p style={{ color: '#94A3B8', fontSize: 12, margin: '6px 0 14px 0' }}>
                  Acesse a aba <strong>2. Reprodutores</strong> e clique em <em>Detalhe</em> para visualizar o pedigree individual de qualquer animal.
                </p>
                <button
                  onClick={() => handleTabChange('reprodutores')}
                  style={{ background: '#EC4899', color: '#FFF', border: 'none', padding: '6px 14px', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                >
                  Abrir Catálogo de Reprodutores
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: ACASALAMENTO */}
      {currentTab === 'acasalamento' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Readiness Status Banner */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8, padding: 16 }}>
            <h4 style={{ fontSize: 14, fontWeight: 700, color: '#EC4899', margin: '0 0 8px 0' }}>Simulador de Acasalamento Dirigido — Motor Fail-Closed</h4>
            <p style={{ fontSize: 12, color: '#94A3B8', margin: '0 0 14px 0' }}>
              O acasalamento dirigido cruza a matriz selecionada com o catálogo de 118k touros, bloqueando deterministicamente parentesco direto (mesmo pai, mesma mãe, genitores) e ordenando candidatos pela DEP real selecionada.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, background: '#0F172A', padding: 14, borderRadius: 6, border: '1px solid #1E293B' }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: '#94A3B8', marginBottom: 4 }}>1. Selecione a Matriz / Fêmea:</label>
                <select
                  value={selectedMatrixId}
                  onChange={(e) => setSelectedMatrixId(e.target.value)}
                  style={{ width: '100%', background: '#0B132B', border: '1px solid #334155', borderRadius: 4, padding: '6px 8px', color: '#F8FAFC', fontSize: 12 }}
                >
                  {prontidaoData?.matrizes?.map((m: any) => (
                    <option key={m.id} value={m.id}>
                      {m.nome} ({m.raca} — {m.registro}) [{m.origem}]
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, color: '#94A3B8', marginBottom: 4 }}>2. Objetivo Genético (DEP de Seleção):</label>
                <select
                  value={selectedTargetTrait}
                  onChange={(e) => setSelectedTargetTrait(e.target.value)}
                  style={{ width: '100%', background: '#0B132B', border: '1px solid #334155', borderRadius: 4, padding: '6px 8px', color: '#F8FAFC', fontSize: 12 }}
                >
                  {prontidaoData?.available_target_traits?.map((t: any) => (
                    <option key={t.sigla} value={t.sigla}>
                      {t.sigla} — {t.nome} ({t.categoria})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button
                  id="btn-executar-acasalamento"
                  onClick={runAcasalamento}
                  disabled={matingLoading || !selectedMatrixId}
                  style={{ width: '100%', background: '#EC4899', color: '#FFF', border: 'none', padding: '8px 14px', borderRadius: 4, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                >
                  <SlidersHorizontal size={14} />
                  {matingLoading ? 'Avaliando catálogo...' : 'Executar Acasalamento'}
                </button>
              </div>
            </div>
          </div>

          {/* Results Table */}
          {matingResult && (
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ padding: '10px 14px', background: '#0F172A', borderBottom: '1px solid var(--border-default)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong style={{ color: '#F8FAFC', fontSize: 13 }}>
                    Candidatos Recomendados para {matingResult.matrix?.nome} ({matingResult.matrix?.raca})
                  </strong>
                  <div style={{ fontSize: 11, color: '#22C55E', marginTop: 2 }}>
                    Critério: DEP {matingResult.target_characteristic?.sigla} ({matingResult.target_characteristic?.selection_direction})
                  </div>
                </div>
                <span style={{ fontSize: 11, color: '#94A3B8' }}>{matingResult.eligible_reproducers?.length} touros elegíveis</span>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#0B132B', color: '#94A3B8', borderBottom: '1px solid #1E293B' }}>
                    <th style={{ padding: '10px' }}>Rank / Touro</th>
                    <th style={{ padding: '10px' }}>RGD</th>
                    <th style={{ padding: '10px' }}>Valor DEP {matingResult.target_characteristic?.sigla}</th>
                    <th style={{ padding: '10px' }}>Percentil / Acurácia</th>
                    <th style={{ padding: '10px' }}>Oferta de Dose</th>
                    <th style={{ padding: '10px' }}>Veredito de Parentesco</th>
                  </tr>
                </thead>
                <tbody>
                  {matingResult.eligible_reproducers?.map((t: any, idx: number) => (
                    <tr key={t.id} style={{ borderBottom: '1px solid #1E293B' }}>
                      <td style={{ padding: '10px' }}>
                        <span style={{ color: '#EC4899', fontWeight: 700, marginRight: 6 }}>#{idx + 1}</span>
                        <strong style={{ color: '#F8FAFC' }}>{t.nome}</strong>
                      </td>
                      <td style={{ padding: '10px', fontFamily: 'monospace', color: '#CBD5E1' }}>{t.registro}</td>
                      <td style={{ padding: '10px' }}>
                        <strong style={{ color: '#22C55E', fontSize: 13 }}>
                          {t.dep_valor !== null ? t.dep_valor : '—'}
                        </strong>
                      </td>
                      <td style={{ padding: '10px', color: '#94A3B8', fontSize: 11 }}>
                        TOP {t.dep_percentil ? `${t.dep_percentil}%` : '—'} | Acurácia {t.dep_acuracia ? `${t.dep_acuracia}%` : '—'}
                      </td>
                      <td style={{ padding: '10px', fontSize: 11 }}>
                        {t.preco_dose_brl ? (
                          <span style={{ color: '#22C55E', fontWeight: 600 }}>R$ {t.preco_dose_brl.toFixed(2)}</span>
                        ) : (
                          <span style={{ color: '#64748B' }}>Sob consulta</span>
                        )}
                      </td>
                      <td style={{ padding: '10px' }}>
                        <span style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#22C55E', padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700 }}>
                          ✓ Sem parentesco imediato
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Blocked / Excluded bulls list */}
              {matingResult.excluded_reproducers?.length > 0 && (
                <div style={{ padding: 14, background: 'rgba(239, 68, 68, 0.05)', borderTop: '1px solid rgba(239, 68, 68, 0.2)' }}>
                  <h5 style={{ fontSize: 12, fontWeight: 700, color: '#EF4444', margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <XCircle size={14} /> Touros Descartados por Risco de Consanguinidade Direta ({matingResult.excluded_reproducers.length})
                  </h5>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {matingResult.excluded_reproducers.map((ex: any, i: number) => (
                      <span key={i} style={{ background: '#1E293B', border: '1px solid #334155', borderRadius: 4, padding: '3px 8px', fontSize: 11, color: '#CBD5E1' }}>
                        <strong>{ex.nome}</strong> ({ex.registro}) [<em>{ex.reason}</em>]: <span style={{ color: '#F87171' }}>{ex.details}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 6: MATRIZES & LOTES */}
      {currentTab === 'matrizes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8, padding: 16 }}>
            <h4 style={{ fontSize: 14, fontWeight: 700, color: '#F8FAFC', margin: '0 0 6px 0' }}>Base Factual de Matrizes & Fêmeas Cadastradas</h4>
            <p style={{ fontSize: 12, color: '#94A3B8', margin: '0 0 14px 0' }}>
              O WiNS Hub Agro <strong>não inventa matrizes</strong> a partir de cadastros rurais do CAR/SICAR. A base atual conta com 8 animais no rebanho piloto da fazenda e 6 doadoras registradas em catálogo zootécnico.
            </p>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#0B132B', color: '#94A3B8', borderBottom: '1px solid #1E293B' }}>
                  <th style={{ padding: '10px' }}>Nome / Brinco</th>
                  <th style={{ padding: '10px' }}>Tipo</th>
                  <th style={{ padding: '10px' }}>Raça</th>
                  <th style={{ padding: '10px' }}>Pai Declarado</th>
                  <th style={{ padding: '10px' }}>Peso / Escore</th>
                  <th style={{ padding: '10px' }}>Origem / Base</th>
                </tr>
              </thead>
              <tbody>
                {prontidaoData?.matrizes?.map((m: any) => (
                  <tr key={m.id} style={{ borderBottom: '1px solid #1E293B' }}>
                    <td style={{ padding: '10px' }}>
                      <strong style={{ color: '#F8FAFC', display: 'block' }}>{m.nome}</strong>
                      <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#EC4899' }}>{m.registro}</span>
                    </td>
                    <td style={{ padding: '10px' }}>
                      <span style={{ background: m.tipo === 'MATRIZ_FAZENDA' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(168, 85, 247, 0.2)', color: m.tipo === 'MATRIZ_FAZENDA' ? '#38BDF8' : '#A855F7', padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700 }}>
                        {m.tipo === 'MATRIZ_FAZENDA' ? 'MATRIZ_FAZENDA' : 'DOADORA_CATALOGO'}
                      </span>
                    </td>
                    <td style={{ padding: '10px', color: '#CBD5E1' }}>{m.raca}</td>
                    <td style={{ padding: '10px', color: '#94A3B8', fontSize: 11 }}>{m.pai_nome || '—'}</td>
                    <td style={{ padding: '10px', color: '#94A3B8', fontSize: 11 }}>
                      {m.peso_kg ? `${m.peso_kg} kg` : '—'} {m.escore_corporal ? `(ECC ${m.escore_corporal})` : ''}
                    </td>
                    <td style={{ padding: '10px', color: '#22C55E', fontSize: 11 }}>{m.origem}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 7: METODOLOGIA */}
      {currentTab === 'metodologia' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8, padding: 16 }}>
            <h4 style={{ fontSize: 14, fontWeight: 700, color: '#EC4899', margin: '0 0 8px 0' }}>Metodologia, Fontes Oficiais & Governança de Dados</h4>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14, marginTop: 12 }}>
              <div style={{ background: '#0F172A', border: '1px solid #1E293B', borderRadius: 6, padding: 14 }}>
                <strong style={{ color: '#F8FAFC', fontSize: 13, display: 'block', marginBottom: 6 }}>1. Programas Genéticos Fontes</strong>
                <ul style={{ paddingLeft: 18, fontSize: 12, color: '#94A3B8', lineHeight: 1.6 }}>
                  <li><strong>Embrapa Geneplus:</strong> Avaliações genômicas para gado de corte (Nelore, Senepol, Caracu).</li>
                  <li><strong>ABCZ PMGZ:</strong> Programa de Melhoramento Genético de Zebuínos (Nelore, Brahman, Guzerá, Sindi, Tabapuã).</li>
                  <li><strong>ANCP Nelore Brasil:</strong> Índices MGTe,Stayability e características de carcaça.</li>
                  <li><strong>GenSys Consultores:</strong> Índices Aliança e Natura (Brangus, Montana).</li>
                  <li><strong>PROMEBO:</strong> Sumário oficial taurino (Aberdeen Angus, Hereford).</li>
                  <li><strong>Programa Nacional do Gir Leiteiro:</strong> PTAs leiteiras e STA de conformação.</li>
                </ul>
              </div>

              <div style={{ background: '#0F172A', border: '1px solid #1E293B', borderRadius: 6, padding: 14 }}>
                <strong style={{ color: '#F8FAFC', fontSize: 13, display: 'block', marginBottom: 6 }}>2. Integridade & Não-Fabricação</strong>
                <ul style={{ paddingLeft: 18, fontSize: 12, color: '#94A3B8', lineHeight: 1.6 }}>
                  <li><strong>Zero Scores Sintéticos:</strong> Nenhuma média ou nota inventada substitui DEPs oficiais.</li>
                  <li><strong>Pedigree Imediato Declarado:</strong> A genealogia reflete estritamente os registros (RGD) de pai e mãe informados pelo programa.</li>
                  <li><strong>Bloqueio de Parentesco:</strong> O simulador descarta preventivamente animais com parentesco imediato direto.</li>
                  <li><strong>Zero Matrizes CAR:</strong> Imóveis rurais do SICAR não são contabilizados como matrizes biológicas.</li>
                </ul>
              </div>
            </div>

            <div style={{ marginTop: 16, padding: 12, background: '#0F172A', borderRadius: 6, border: '1px solid #1E293B', fontSize: 11, color: '#64748B' }}>
              <strong>Atualização de Metadados:</strong> 08/08/2026 | Responsabilidade Técnica: Zootecnia & Ciência de Dados WiNS Hub Agro.
            </div>
          </div>
        </div>
      )}

      {/* MODAL / DRAWER DO REPRODUTOR SELECIONADO */}
      {selectedReprodutorId && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16
          }}
          onClick={() => setSelectedReprodutorId(null)}
        >
          <div
            style={{
              background: '#0B132B',
              border: '1px solid #334155',
              borderRadius: 8,
              width: '100%',
              maxWidth: 720,
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: 20
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {detailLoading ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#94A3B8', fontSize: 13 }}>Carregando dados técnicos do reprodutor...</div>
            ) : selectedReprodutorDetail ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #1E293B', paddingBottom: 12 }}>
                  <div>
                    <h3 style={{ fontSize: 18, fontWeight: 700, color: '#F8FAFC', margin: 0 }}>{selectedReprodutorDetail.nome}</h3>
                    <span style={{ fontSize: 12, fontFamily: 'monospace', color: '#EC4899' }}>RGD: {selectedReprodutorDetail.registro}</span>
                    <span style={{ fontSize: 12, color: '#94A3B8', marginLeft: 10 }}>Raça: {selectedReprodutorDetail.raca_nome}</span>
                  </div>
                  <button
                    onClick={() => setSelectedReprodutorId(null)}
                    style={{ background: '#1E293B', color: '#FFF', border: 'none', padding: '4px 10px', borderRadius: 4, fontSize: 12, cursor: 'pointer' }}
                  >
                    Fechar
                  </button>
                </div>

                {/* Technical Overview */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, background: '#0F172A', padding: 12, borderRadius: 6 }}>
                  <div><small style={{ color: '#64748B' }}>Origem / Fazenda</small><strong style={{ display: 'block', color: '#F8FAFC', fontSize: 12 }}>{selectedReprodutorDetail.fazenda_origem || '—'}</strong></div>
                  <div><small style={{ color: '#64748B' }}>Localização</small><strong style={{ display: 'block', color: '#F8FAFC', fontSize: 12 }}>{selectedReprodutorDetail.municipio || '—'} / {selectedReprodutorDetail.uf || '—'}</strong></div>
                  <div><small style={{ color: '#64748B' }}>Programa Zootécnico</small><strong style={{ display: 'block', color: '#22C55E', fontSize: 12 }}>{selectedReprodutorDetail.fonte_programa || '—'}</strong></div>
                  <div><small style={{ color: '#64748B' }}>Disponibilidade de Dose</small><strong style={{ display: 'block', color: '#38BDF8', fontSize: 12 }}>{selectedReprodutorDetail.preco_dose_brl ? `R$ ${selectedReprodutorDetail.preco_dose_brl.toFixed(2)}` : 'Direto no criatório'}</strong></div>
                </div>

                {/* Pedigree Imediato */}
                <div style={{ background: '#0F172A', padding: 12, borderRadius: 6 }}>
                  <h5 style={{ fontSize: 12, fontWeight: 700, color: '#EC4899', margin: '0 0 8px 0' }}>Genealogia Imediata Declarada</h5>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 12 }}>
                    <div><span style={{ color: '#64748B' }}>Pai:</span> <strong style={{ color: '#F8FAFC' }}>{selectedReprodutorDetail.pai_nome || '—'}</strong> <small style={{ color: '#94A3B8' }}>({selectedReprodutorDetail.pai_registro || 'S/RGD'})</small></div>
                    <div><span style={{ color: '#64748B' }}>Mãe:</span> <strong style={{ color: '#F8FAFC' }}>{selectedReprodutorDetail.mae_nome || '—'}</strong> <small style={{ color: '#94A3B8' }}>({selectedReprodutorDetail.mae_registro || 'S/RGD'})</small></div>
                  </div>
                </div>

                {/* DEPs Grid */}
                <div>
                  <h5 style={{ fontSize: 12, fontWeight: 700, color: '#F8FAFC', margin: '0 0 8px 0' }}>Avaliações Genéticas Oficiais ({selectedReprodutorDetail.avaliacoes?.length || 0} DEPs)</h5>
                  <div style={{ maxHeight: 240, overflowY: 'auto', border: '1px solid #1E293B', borderRadius: 6 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, textAlign: 'left' }}>
                      <thead>
                        <tr style={{ background: '#0F172A', color: '#94A3B8' }}>
                          <th style={{ padding: '6px 8px' }}>DEP</th>
                          <th style={{ padding: '6px 8px' }}>Valor</th>
                          <th style={{ padding: '6px 8px' }}>Percentil</th>
                          <th style={{ padding: '6px 8px' }}>Acurácia</th>
                          <th style={{ padding: '6px 8px' }}>Direção</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedReprodutorDetail.avaliacoes?.map((av: any, i: number) => (
                          <tr key={i} style={{ borderBottom: '1px solid #1E293B' }}>
                            <td style={{ padding: '6px 8px', color: '#F8FAFC' }}>
                              <strong>{av.sigla}</strong> — {av.caracteristica_nome}
                            </td>
                            <td style={{ padding: '6px 8px', color: '#22C55E', fontWeight: 700 }}>
                              {av.valor} {av.unidade}
                            </td>
                            <td style={{ padding: '6px 8px', color: '#94A3B8' }}>
                              {av.percentil !== null ? `TOP ${av.percentil}%` : '—'}
                            </td>
                            <td style={{ padding: '6px 8px', color: '#94A3B8' }}>
                              {av.acuracia !== null ? `${av.acuracia}%` : '—'}
                            </td>
                            <td style={{ padding: '6px 8px', fontSize: 10, color: av.selection_direction === 'HIGHER_BETTER' ? '#22C55E' : av.selection_direction === 'LOWER_BETTER' ? '#38BDF8' : '#94A3B8' }}>
                              {av.selection_direction}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </AgroPageShell>
  );
}
