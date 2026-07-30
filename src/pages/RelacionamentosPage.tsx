import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Network, Search, Building2, HardHat, Truck, Sprout, HeartPulse,
  ShieldCheck, Database, Menu, ArrowRight, Download, RefreshCw, Filter,
  AlertTriangle, Sparkles, ChevronLeft, ChevronRight, X, Info, Globe,
  AlertCircle, Loader2, User, CornerDownLeft, HelpCircle
} from 'lucide-react';
import { DesktopSidebar, MobileSidebarContent } from '../components/AppSidebar';
import { BrazilUfSelect } from '../components/territorial/BrazilUfSelect';
import {
  RelationshipGraphVisualizer,
  type GraphEdge,
  type GraphNode,
  type GraphVisualizerRef
} from '../components/RelationshipGraphVisualizer';
import { relationshipsService, type EntitySearchResult } from '../services/relationshipsService';
import type { CatalogEntity, CatalogEdge } from '../services/relationshipCatalog';

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

function getEntityIcon(type: string) {
  switch (type?.toLowerCase()) {
    case 'obra': return <HardHat size={14} color="#3B82F6" />;
    case 'empresa': return <Building2 size={14} color="#8B5CF6" />;
    case 'pessoa': return <User size={14} color="#F59E0B" />;
    case 'transportador':
    case 'transportadora': return <Truck size={14} color="#06B6D4" />;
    case 'imovel_car':
    case 'propriedade_rural': return <Sprout size={14} color="#22C55E" />;
    case 'estabelecimento_cnes':
    case 'unidade_saude': return <HeartPulse size={14} color="#EC4899" />;
    case 'municipio': return <Globe size={14} color="#F59E0B" />;
    default: return <Building2 size={14} color="#6366F1" />;
  }
}

function getGroupLabel(type: string): string {
  switch (type?.toLowerCase()) {
    case 'empresa': return 'Empresas';
    case 'obra': return 'Obras';
    case 'pessoa': return 'Pessoas';
    case 'municipio': return 'Municípios';
    case 'transportador':
    case 'transportadora': return 'Transportadoras';
    case 'estabelecimento_cnes':
    case 'unidade_saude': return 'Unidades de Saúde';
    case 'imovel_car':
    case 'propriedade_rural': return 'Propriedades Rurais';
    case 'prestador': return 'Prestadores';
    case 'fornecedor': return 'Fornecedores';
    default: return 'Outras Entidades';
  }
}

interface RecentInvestigation {
  id: string;
  name: string;
  type: string;
  document?: string;
  accessedAt: string;
}

interface ApiState {
  loading: boolean;
  error: string | null;
  data: {
    nodes: CatalogEntity[];
    edges: CatalogEdge[];
    meta: {
      total_entidades: number;
      total_relacoes: number;
      exibindo: number;
      confirmadas: number;
      provaveis: number;
      potenciais: number;
      revisao_pendente: number;
      confianca_media: number;
      metodo_calculo: string;
    } | null;
    entity: {
      id: string;
      nome: string;
      tipo: string;
      documento: string;
    } | null;
  } | null;
}

const INITIAL_STATE: ApiState = { loading: false, error: null, data: null };

export const RelacionamentosPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isMobile = useMediaQuery('(max-width: 767px)');
  const visualizerRef = useRef<GraphVisualizerRef>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [autocompleteOpen, setAutocompleteOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<EntitySearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<boolean>(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);

  const [selectedClass, setSelectedClass] = useState<string>('');
  const [minConfidence, setMinConfidence] = useState<number>(0);
  const [sourceVertical, setSourceVertical] = useState<string>('');
  const [targetVertical, setTargetVertical] = useState<string>('');
  const [filterUf, setFilterUf] = useState<string>('');
  const [filterSource, setFilterSource] = useState<string>('');
  const [maxNodesLimit, setMaxNodesLimit] = useState<number>(25);

  const [pathEntityA, setPathEntityA] = useState<string>('');
  const [pathEntityB, setPathEntityB] = useState<string>('');
  const [computedPath, setComputedPath] = useState<{
    found: boolean;
    hops: number;
    steps: { from: string; relation: string; to: string; classif: string; conf: number; evidence: string }[];
    nodeIds?: string[];
    edgeIds?: string[];
  } | null>(null);

  const [tablePage, setTablePage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [tableSearch, setTableSearch] = useState('');
  const [sortField, setSortField] = useState<keyof CatalogEdge>('confidence');
  const [sortAsc, setSortAsc] = useState(false);

  const [selectedEdge, setSelectedEdge] = useState<CatalogEdge | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const [apiState, setApiState] = useState<ApiState>(INITIAL_STATE);
  const [centralEntityId, setCentralEntityId] = useState<string | null>(null);

  // Recent investigations history in localStorage
  const [recentInvestigations, setRecentInvestigations] = useState<RecentInvestigation[]>(() => {
    try {
      const stored = localStorage.getItem('wins_recent_investigations');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const saveRecent = (entity: { id: string; name: string; type: string; document?: string }) => {
    try {
      const filtered = recentInvestigations.filter(r => r.id !== entity.id);
      const updated = [
        { id: entity.id, name: entity.name, type: entity.type, document: entity.document, accessedAt: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) },
        ...filtered
      ].slice(0, 5);
      setRecentInvestigations(updated);
      localStorage.setItem('wins_recent_investigations', JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  const removeRecent = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = recentInvestigations.filter(r => r.id !== id);
    setRecentInvestigations(updated);
    localStorage.setItem('wins_recent_investigations', JSON.stringify(updated));
  };

  // URL state reading
  const urlEntityId = searchParams.get('entity_id') || searchParams.get('entidade') || searchParams.get('cnpj') || '';
  const urlEntityType = searchParams.get('entity_type') || '';
  const urlClassificacao = searchParams.get('classificacao') || '';

  const fetchData = useCallback(async (entityIdent: string, params?: Record<string, string>) => {
    if (!entityIdent) {
      setApiState({ loading: false, error: null, data: null });
      setCentralEntityId(null);
      return;
    }

    setApiState(prev => ({ ...prev, loading: true, error: null }));
    relationshipsService.cancelRequest();

    try {
      const result = await relationshipsService.getRelacionamentos({
        entidade: entityIdent,
        classificacao: params?.classificacao || selectedClass || undefined,
        uf: params?.uf || filterUf || undefined,
        confianca_min: minConfidence > 0 ? minConfidence : undefined,
        page_size: 100,
      });

      const firstNode = result.nodes[0];
      const targetId = firstNode?.id || result.entity?.id || entityIdent;
      setCentralEntityId(targetId);

      if (result.entity?.nome || firstNode?.name) {
        saveRecent({
          id: targetId,
          name: result.entity?.nome || firstNode?.name || entityIdent,
          type: result.entity?.tipo || firstNode?.type || 'empresa',
          document: result.entity?.documento || firstNode?.identifier
        });
      }

      setApiState({
        loading: false,
        error: null,
        data: {
          nodes: result.nodes,
          edges: result.edges,
          meta: {
            total_entidades: result.meta.total_entidades,
            total_relacoes: result.meta.total_relacoes,
            exibindo: result.meta.exibindo,
            confirmadas: result.meta.confirmadas,
            provaveis: result.meta.provaveis,
            potenciais: result.meta.potenciais,
            revisao_pendente: result.meta.revisao_pendente,
            confianca_media: result.meta.confianca_media,
            metodo_calculo: result.meta.metodo_calculo,
          },
          entity: result.entity,
        },
      });

      if (visualizerRef.current) {
        setTimeout(() => visualizerRef.current?.fit(), 100);
      }
    } catch (err: any) {
      if (err?.name === 'AbortError' || err?.code === 'ERR_CANCELED') return;
      setApiState({
        loading: false,
        error: 'Não foi possível carregar os relacionamentos para esta entidade.',
        data: null,
      });
      setCentralEntityId(null);
    }
  }, [selectedClass, filterUf, minConfidence]);

  useEffect(() => {
    if (urlEntityId) {
      fetchData(urlEntityId);
    } else {
      setApiState(INITIAL_STATE);
      setCentralEntityId(null);
    }
  }, [urlEntityId, fetchData]);

  // Debounced autocomplete suggest search with AbortController
  const searchControllerRef = useRef<AbortController | null>(null);

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    setSearchError(false);
    setHighlightedIndex(-1);

    if (!query.trim() || query.trim().length < 2) {
      setSearchResults([]);
      setAutocompleteOpen(false);
      return;
    }

    setSearching(true);
    setAutocompleteOpen(true);

    if (searchControllerRef.current) {
      searchControllerRef.current.abort();
    }
    searchControllerRef.current = new AbortController();

    relationshipsService.searchEntities(query, searchControllerRef.current.signal)
      .then(results => {
        setSearchResults(results);
        setSearching(false);
      })
      .catch(err => {
        if (err?.name !== 'AbortError' && err?.code !== 'ERR_CANCELED') {
          setSearchResults([]);
          setSearchError(true);
          setSearching(false);
        }
      });
  };

  const handleSelectAutocomplete = (item: EntitySearchResult) => {
    setSearchQuery(item.nome);
    setAutocompleteOpen(false);
    setSearchResults([]);
    setHighlightedIndex(-1);

    const params: Record<string, string> = {
      entity_id: item.documento || item.id,
      entity_type: item.tipo
    };
    setSearchParams(params);
    fetchData(item.documento || item.id);
  };

  // Keyboard navigation inside dropdown
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!autocompleteOpen || searchResults.length === 0) {
      if (e.key === 'Enter' && searchQuery.trim()) {
        const params: Record<string, string> = { entity_id: searchQuery.trim(), entity_type: 'empresa' };
        setSearchParams(params);
        fetchData(searchQuery.trim());
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev < searchResults.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev > 0 ? prev - 1 : searchResults.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < searchResults.length) {
        handleSelectAutocomplete(searchResults[highlightedIndex]);
      } else if (searchResults.length > 0) {
        handleSelectAutocomplete(searchResults[0]);
      }
    } else if (e.key === 'Escape') {
      setAutocompleteOpen(false);
      setHighlightedIndex(-1);
    }
  };

  // Group search results by type
  const groupedResults = useMemo(() => {
    const map = new Map<string, EntitySearchResult[]>();
    searchResults.forEach(item => {
      const label = getGroupLabel(item.tipo);
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(item);
    });
    return Array.from(map.entries());
  }, [searchResults]);

  // Clean investigation ("Nova consulta")
  const handleNewConsultation = () => {
    relationshipsService.cancelRequest();
    relationshipsService.clearCache();
    setApiState(INITIAL_STATE);
    setCentralEntityId(null);
    setSearchQuery('');
    setSearchResults([]);
    setComputedPath(null);
    setSelectedEdge(null);
    setIsDrawerOpen(false);
    setSelectedClass('');
    setMinConfidence(0);
    setSourceVertical('');
    setTargetVertical('');
    setFilterUf('');
    setFilterSource('');
    setTableSearch('');
    setSearchParams(new URLSearchParams(), { replace: true });

    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 50);
  };

  const filteredEdges = useMemo(() => {
    if (!apiState.data) return [];
    return apiState.data.edges.filter(edge => {
      if (selectedClass && edge.classification !== selectedClass) return false;
      if (minConfidence > 0 && edge.confidence < minConfidence) return false;
      if (sourceVertical && edge.sourceType.toLowerCase() !== sourceVertical.toLowerCase()) return false;
      if (targetVertical && edge.targetType.toLowerCase() !== targetVertical.toLowerCase()) return false;
      if (filterSource && !edge.sourceSystem?.toLowerCase().includes(filterSource.toLowerCase())) return false;
      if (tableSearch) {
        const q = tableSearch.toLowerCase();
        const srcName = apiState.data?.nodes.find(e => e.id === edge.source)?.name || edge.source;
        const tgtName = apiState.data?.nodes.find(e => e.id === edge.target)?.name || edge.target;
        if (!srcName.toLowerCase().includes(q) &&
            !tgtName.toLowerCase().includes(q) &&
            !edge.label.toLowerCase().includes(q) &&
            !edge.evidence.toLowerCase().includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [apiState.data, selectedClass, minConfidence, sourceVertical, targetVertical, filterSource, tableSearch]);

  const filteredNodes: GraphNode[] = useMemo(() => {
    if (!apiState.data) return [];
    const activeNodeIds = new Set<string>();
    filteredEdges.forEach(e => {
      activeNodeIds.add(e.source);
      activeNodeIds.add(e.target);
    });

    return apiState.data.nodes
      .filter(e => activeNodeIds.has(e.id) || e.id === centralEntityId)
      .slice(0, maxNodesLimit)
      .map(e => ({
        id: e.id,
        label: e.name,
        type: e.type,
        sub: `${e.identifier} · ${e.mun}/${e.uf}`,
        identifier: e.identifier,
        municipality: e.mun,
        uf: e.uf,
        source: e.source,
        route: e.route,
      }));
  }, [apiState.data, filteredEdges, centralEntityId, maxNodesLimit]);

  const sortedEdges = useMemo(() => {
    return [...filteredEdges].sort((a, b) => {
      const valA = a[sortField] ?? '';
      const valB = b[sortField] ?? '';
      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [filteredEdges, sortField, sortAsc]);

  const paginatedEdges = useMemo(() => {
    const start = (tablePage - 1) * pageSize;
    return sortedEdges.slice(start, start + pageSize);
  }, [sortedEdges, tablePage, pageSize]);

  const totalTablePages = Math.max(1, Math.ceil(filteredEdges.length / pageSize));

  const userData = typeof window !== 'undefined' ? localStorage.getItem('wins_user') : null;
  const currentUser = userData ? JSON.parse(userData) : null;
  const isViewer = currentUser?.roles?.includes('viewer');

  const hasActiveInvestigation = Boolean(centralEntityId || (apiState.data && !apiState.loading));
  const hasEdgesToExport = Boolean(apiState.data && filteredEdges.length > 0);

  const handleExport = () => {
    if (isViewer || !hasActiveInvestigation || !hasEdgesToExport || !apiState.data) return;

    const { nodes, edges, entity } = apiState.data;
    const rows = filteredEdges.map(edge => {
      const src = nodes.find(n => n.id === edge.source);
      const tgt = nodes.find(n => n.id === edge.target);
      return {
        origem: src?.name || edge.source,
        origem_tipo: edge.sourceType,
        origem_doc: src?.identifier || '',
        relacao: edge.tipo_relacao || edge.label,
        destino: tgt?.name || edge.target,
        destino_tipo: edge.targetType,
        destino_doc: tgt?.identifier || '',
        classificacao: edge.classification,
        confianca: edge.confidence,
        evidencia: edge.evidence,
        fonte: edge.fonte || edge.sourceSystem || '',
        revisao: edge.status_revisao,
        calculado_em: edge.calculado_em || '',
      };
    });

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const now = new Date().toLocaleString('pt-BR');
    const hash = 'SEC-SHA256-' + Math.random().toString(36).substring(2, 10).toUpperCase();
    const entityNome = entity?.nome || centralEntityId || 'Investigação';

    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Relacionamentos - ${entityNome}</title>
  <style>
    body { font-family: system-ui, sans-serif; padding: 32px; color: #0F172A; background: #FFF; line-height: 1.5; }
    .header { border-bottom: 2px solid #8B5CF6; padding-bottom: 16px; margin-bottom: 24px; }
    h1 { font-size: 20px; margin: 0; }
    .meta { font-size: 11px; color: #64748B; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 10px; }
    th, td { border: 1px solid #E2E8F0; padding: 6px 8px; text-align: left; }
    th { background: #F8FAFC; color: #475569; font-weight: 600; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Relacionamentos - ${entityNome}</h1>
    <div class="meta">Gerado em ${now} · Hash ${hash} · ${currentUser?.name || 'Analista'}</div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Origem</th><th>Tipo</th><th>Relação</th><th>Destino</th><th>Tipo</th><th>Classificação</th><th>Confiança</th><th>Evidência</th>
      </tr>
    </thead>
    <tbody>
      ${rows.map(r => `
        <tr>
          <td><strong>${r.origem}</strong></td>
          <td>${r.origem_tipo}</td>
          <td>${r.relacao}</td>
          <td><strong>${r.destino}</strong></td>
          <td>${r.destino_tipo}</td>
          <td>${r.classificacao}</td>
          <td>${r.confianca}%</td>
          <td>${r.evidencia}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  <script>window.onload = function() { window.print(); }</script>
</body>
</html>`;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <div data-ui-version="relacionamentos-search-evolved-v2.9" style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-base, #090D16)', position: 'relative', overflow: 'hidden' }}>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h1 style={{ fontSize: isMobile ? 14 : 16, fontWeight: 700, color: 'var(--text-primary, #F8FAFC)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Network size={18} color="#F59E0B" />
                Investigação de Relacionamentos
              </h1>
              {apiState.loading && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite', color: '#3B82F6' }} />}
            </div>
            {!isMobile && centralEntityId && hasActiveInvestigation && (
              <p style={{ fontSize: 11, color: 'var(--text-tertiary, #64748B)', margin: 0, marginTop: 1 }}>
                Rede de relacionamentos de {apiState.data?.entity?.nome || centralEntityId}
              </p>
            )}
          </div>

          {/* Header Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {hasActiveInvestigation && (
              <button
                onClick={handleNewConsultation}
                style={{
                  height: 32, padding: '0 12px', fontSize: 11, fontWeight: 600,
                  background: 'var(--bg-base)', color: 'var(--text-primary)',
                  border: '1px solid var(--border-subtle)', borderRadius: 6, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6
                }}
              >
                <RefreshCw size={13} /> {!isMobile && <span>Nova consulta</span>}
              </button>
            )}

            <button
              onClick={handleExport}
              disabled={isViewer || !hasActiveInvestigation || !hasEdgesToExport}
              title={
                isViewer
                  ? 'Exportação restrita para seu perfil'
                  : (!hasActiveInvestigation || !hasEdgesToExport)
                  ? 'Selecione uma entidade e carregue seus relacionamentos para exportar.'
                  : 'Exportar relatório de conexões'
              }
              style={{
                height: 32, padding: '0 12px', fontSize: 11, fontWeight: 600,
                background: (isViewer || !hasActiveInvestigation || !hasEdgesToExport) ? '#1E293B' : '#8B5CF6',
                color: (isViewer || !hasActiveInvestigation || !hasEdgesToExport) ? '#64748B' : '#FFF',
                border: 'none', borderRadius: 6,
                cursor: (isViewer || !hasActiveInvestigation || !hasEdgesToExport) ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 6, opacity: (isViewer || !hasActiveInvestigation || !hasEdgesToExport) ? 0.6 : 1
              }}
            >
              <Download size={13} /> {!isMobile && <span>{isViewer ? 'Exportação restrita' : 'Exportar conexões'}</span>}
            </button>
          </div>
        </header>

        {/* Content Body */}
        <div style={{ padding: isMobile ? 12 : 24, flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
          
          {/* Autocomplete Search Bar Container */}
          <div style={{ position: 'relative', background: 'var(--bg-surface, #0F172A)', border: '1px solid var(--border-default, #1E293B)', borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Search size={15} color="#3B82F6" />
              <strong style={{ fontSize: 13, color: 'var(--text-primary, #F8FAFC)' }}>Buscar entidade para investigar</strong>
            </div>

            <div style={{ position: 'relative', width: '100%' }}>
              <input
                ref={searchInputRef}
                data-testid="search-autocomplete-input"
                value={searchQuery}
                onFocus={() => { if (searchResults.length > 0) setAutocompleteOpen(true); }}
                onChange={e => handleSearchChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Digitar Razão Social, CNPJ, Obra, Transportador, CNES, Município..."
                style={{
                  width: '100%', height: 38, paddingLeft: 36, paddingRight: 36, fontSize: 12,
                  background: 'var(--bg-base, #090D16)', border: '1px solid #3B82F6', borderRadius: 6, color: 'var(--text-primary)'
                }}
              />
              <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
              {searchQuery && (
                <button
                  onClick={() => { setSearchQuery(''); setAutocompleteOpen(false); setSearchResults([]); setHighlightedIndex(-1); }}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}
                >
                  <X size={14} />
                </button>
              )}

              {/* Grouped Autocomplete Dropdown */}
              {autocompleteOpen && searchResults.length > 0 && (
                <div
                  data-testid="autocomplete-dropdown"
                  style={{
                    position: 'absolute', top: 44, left: 0, width: '100%', background: '#0F172A',
                    border: '1px solid #3B82F6', borderRadius: 8, zIndex: 1000, boxShadow: '0 10px 30px rgba(0,0,0,0.8)',
                    maxHeight: 340, overflowY: 'auto'
                  }}
                >
                  {groupedResults.map(([groupName, groupItems]) => (
                    <div key={groupName}>
                      <div style={{
                        padding: '6px 14px', fontSize: 10, fontWeight: 700, color: '#3B82F6',
                        background: 'rgba(59,130,246,0.1)', textTransform: 'uppercase', letterSpacing: '0.5px'
                      }}>
                        {groupName} ({groupItems.length})
                      </div>
                      {groupItems.map(item => {
                        const globalIdx = searchResults.indexOf(item);
                        const isHighlighted = globalIdx === highlightedIndex;

                        return (
                          <div
                            key={item.id}
                            onClick={() => handleSelectAutocomplete(item)}
                            style={{
                              padding: '10px 14px', borderBottom: '1px solid #1E293B', cursor: 'pointer',
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                              background: isHighlighted ? 'rgba(59,130,246,0.2)' : 'transparent',
                              transition: 'background 0.15s'
                            }}
                            onMouseEnter={(e) => {
                              setHighlightedIndex(globalIdx);
                              e.currentTarget.style.background = 'rgba(59,130,246,0.2)';
                            }}
                            onMouseLeave={(e) => {
                              if (!isHighlighted) e.currentTarget.style.background = 'transparent';
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              {getEntityIcon(item.tipo)}
                              <div>
                                <div style={{ fontSize: 12, fontWeight: 700, color: '#FFF' }}>{item.nome}</div>
                                <div style={{ fontSize: 10, color: '#94A3B8' }}>
                                  {item.documento} · {item.municipio}/{item.uf} · Vertical: <strong>{item.fonte}</strong>
                                </div>
                              </div>
                            </div>
                            <span style={{ fontSize: 9, fontWeight: 700, color: '#3B82F6', background: 'rgba(59,130,246,0.15)', padding: '2px 8px', borderRadius: 4, textTransform: 'uppercase' }}>
                              {item.tipo}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}

              {/* Search Loading State */}
              {searching && (
                <div style={{ position: 'absolute', top: 44, left: 0, width: '100%', background: '#0F172A', border: '1px solid #3B82F6', borderRadius: 8, zIndex: 1000, padding: 16, textAlign: 'center', fontSize: 12, color: '#94A3B8' }}>
                  <Loader2 size={16} style={{ animation: 'spin 1s linear infinite', marginRight: 8 }} />
                  Buscando entidades…
                </div>
              )}

              {/* Search Empty / Error States */}
              {autocompleteOpen && !searching && searchResults.length === 0 && searchQuery.length >= 3 && !searchError && (
                <div style={{ position: 'absolute', top: 44, left: 0, width: '100%', background: '#0F172A', border: '1px solid #334155', borderRadius: 8, zIndex: 1000, padding: 16, textAlign: 'center', fontSize: 12, color: '#94A3B8' }}>
                  Nenhuma entidade encontrada para esta consulta.
                </div>
              )}

              {searchError && (
                <div style={{ position: 'absolute', top: 44, left: 0, width: '100%', background: '#0F172A', border: '1px solid #EF4444', borderRadius: 8, zIndex: 1000, padding: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: '#EF4444' }}>
                  <span>Não foi possível consultar as entidades.</span>
                  <button onClick={() => handleSearchChange(searchQuery)} style={{ background: '#EF4444', color: '#FFF', border: 'none', borderRadius: 4, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
                    Tentar novamente
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Useful Empty State (No Active Investigation) */}
          {!hasActiveInvestigation && !apiState.loading && (
            <div style={{
              background: 'var(--bg-surface, #0F172A)', border: '1px solid var(--border-default, #1E293B)',
              borderRadius: 10, padding: 32, textAlign: 'center', display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 16
            }}>
              <div style={{ width: 48, height: 48, borderRadius: 24, background: 'rgba(245,158,11,0.15)', border: '1px solid #F59E0B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Network size={24} color="#F59E0B" />
              </div>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: '#F8FAFC', margin: 0 }}>Nenhuma investigação em andamento</h2>
                <p style={{ fontSize: 12, color: '#94A3B8', marginTop: 4, maxWidth: 500, marginInline: 'auto' }}>
                  Busque uma empresa, obra, município ou outra entidade para visualizar seus relacionamentos comerciais.
                </p>
              </div>

              {/* Conceptual Shortcut Buttons */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginTop: 8 }}>
                {[
                  { label: 'Buscar uma empresa', icon: <Building2 size={13} color="#8B5CF6" />, hint: 'SANEPAR' },
                  { label: 'Buscar uma obra', icon: <HardHat size={13} color="#3B82F6" />, hint: 'USINAS FOTOVOLTAICAS' },
                  { label: 'Buscar um município', icon: <Globe size={13} color="#F59E0B" />, hint: 'Curitiba' },
                  { label: 'Buscar uma transportadora', icon: <Truck size={13} color="#06B6D4" />, hint: 'TRANSPORTE' },
                ].map((sc, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setSearchQuery(sc.hint);
                      handleSearchChange(sc.hint);
                      searchInputRef.current?.focus();
                    }}
                    style={{
                      padding: '8px 14px', fontSize: 11, fontWeight: 600, background: 'var(--bg-base)',
                      border: '1px solid var(--border-subtle)', borderRadius: 6, color: '#F8FAFC',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
                    }}
                  >
                    {sc.icon} {sc.label}
                  </button>
                ))}
              </div>

              {/* Recent Real Investigations */}
              {recentInvestigations.length > 0 && (
                <div style={{ marginTop: 20, width: '100%', maxWidth: 600, textAlign: 'left', borderTop: '1px solid #1E293B', paddingTop: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
                    Investigações recentes
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {recentInvestigations.map(recent => (
                      <div
                        key={recent.id}
                        onClick={() => {
                          const params: Record<string, string> = { entity_id: recent.id, entity_type: recent.type };
                          setSearchParams(params);
                          fetchData(recent.id);
                        }}
                        style={{
                          padding: '10px 14px', background: 'var(--bg-base)', border: '1px solid var(--border-subtle)',
                          borderRadius: 6, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {getEntityIcon(recent.type)}
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 600, color: '#FFF' }}>{recent.name}</div>
                            {recent.document && <div style={{ fontSize: 10, color: '#64748B' }}>{recent.document}</div>}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 10, color: '#64748B' }}>{recent.accessedAt}</span>
                          <button
                            onClick={(e) => removeRecent(recent.id, e)}
                            style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer' }}
                            title="Remover do histórico"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Entity without Edges State */}
          {hasActiveInvestigation && apiState.data && filteredEdges.length === 0 && !apiState.loading && (
            <div style={{
              background: 'var(--bg-surface, #0F172A)', border: '1px solid var(--border-default, #1E293B)',
              borderRadius: 10, padding: 24, textAlign: 'center', color: '#F59E0B'
            }}>
              <AlertTriangle size={24} style={{ marginBottom: 8 }} />
              <div style={{ fontSize: 14, fontWeight: 700 }}>
                Esta entidade foi encontrada, mas ainda não possui relacionamentos materializados.
              </div>
              <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>
                Entidade central: {apiState.data.entity?.nome || centralEntityId}
              </div>
            </div>
          )}

          {/* Active Investigation Main Content */}
          {hasActiveInvestigation && hasEdgesToExport && (
            <>
              {/* Graph & Filters Container */}
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 10, padding: 16 }}>
                <RelationshipGraphVisualizer
                  ref={visualizerRef}
                  nodes={filteredNodes}
                  edges={filteredEdges.map(e => ({
                    id: e.id,
                    source: e.source,
                    target: e.target,
                    label: e.label,
                    classification: e.classification,
                    confidence: e.confidence,
                    evidence: e.evidence || '',
                  }))}
                  centralNodeId={centralEntityId || undefined}
                  onSelectNode={(n) => {
                    const params: Record<string, string> = { entity_id: n.id, entity_type: n.type };
                    setSearchParams(params);
                    fetchData(n.id);
                  }}
                  onSelectEdge={(e) => {
                    const fullEdge = filteredEdges.find(item => item.id === e.id);
                    if (fullEdge) setSelectedEdge(fullEdge);
                  }}
                />
              </div>

              {/* Connections Table */}
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 10, padding: 16, overflowX: 'auto' }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: '#F8FAFC', marginBottom: 12 }}>
                  Tabela de Relacionamentos Materializados ({filteredEdges.length})
                </h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #1E293B', color: '#94A3B8', textAlign: 'left' }}>
                      <th style={{ padding: 8 }}>Origem</th>
                      <th style={{ padding: 8 }}>Relação</th>
                      <th style={{ padding: 8 }}>Destino</th>
                      <th style={{ padding: 8 }}>Classificação</th>
                      <th style={{ padding: 8 }}>Confiança</th>
                      <th style={{ padding: 8 }}>Evidência</th>
                      <th style={{ padding: 8 }}>Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedEdges.map(edge => {
                      const srcName = apiState.data?.nodes.find(n => n.id === edge.source)?.name || edge.source;
                      const tgtName = apiState.data?.nodes.find(n => n.id === edge.target)?.name || edge.target;

                      return (
                        <tr key={edge.id} style={{ borderBottom: '1px solid #1E293B' }}>
                          <td style={{ padding: 8, fontWeight: 600, color: '#FFF' }}>{srcName}</td>
                          <td style={{ padding: 8, color: '#3B82F6' }}>{edge.label}</td>
                          <td style={{ padding: 8, fontWeight: 600, color: '#FFF' }}>{tgtName}</td>
                          <td style={{ padding: 8 }}>
                            <span style={{
                              padding: '2px 6px', fontSize: 10, fontWeight: 700, borderRadius: 4,
                              background: edge.classification === 'CONFIRMADO' ? 'rgba(34,197,94,0.15)' : edge.classification === 'PROVÁVEL' ? 'rgba(245,158,11,0.15)' : 'rgba(148,163,184,0.15)',
                              color: edge.classification === 'CONFIRMADO' ? '#22C55E' : edge.classification === 'PROVÁVEL' ? '#F59E0B' : '#94A3B8'
                            }}>
                              {edge.classification}
                            </span>
                          </td>
                          <td style={{ padding: 8, fontWeight: 700, color: '#8B5CF6' }}>{edge.confidence}%</td>
                          <td style={{ padding: 8, color: '#94A3B8', fontSize: 10, maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {edge.evidence}
                          </td>
                          <td style={{ padding: 8 }}>
                            <button
                              onClick={() => setSelectedEdge(edge)}
                              style={{ padding: '3px 8px', fontSize: 10, background: 'rgba(59,130,246,0.15)', border: '1px solid #3B82F6', color: '#3B82F6', borderRadius: 4, cursor: 'pointer' }}
                            >
                              Detalhes
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
