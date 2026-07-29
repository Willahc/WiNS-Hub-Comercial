import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Network, Search, Building2, HardHat, Truck, Sprout, HeartPulse,
  ShieldCheck, Database, Menu, ArrowRight,
  Download, RefreshCw, Filter, AlertTriangle, Sparkles,
  ChevronLeft, ChevronRight, X, Info, Globe, AlertCircle, Loader2
} from 'lucide-react';
import { DesktopSidebar, MobileSidebarContent } from '../components/AppSidebar';
import { BrazilUfSelect } from '../components/territorial/BrazilUfSelect';
import {
  RelationshipGraphVisualizer,
  type GraphEdge,
  type GraphNode,
  type GraphVisualizerRef
} from '../components/RelationshipGraphVisualizer';
import { exportService } from '../services/exportService';
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
  switch (type) {
    case 'obra': return <HardHat size={14} color="#3B82F6" />;
    case 'empresa': return <Building2 size={14} color="#8B5CF6" />;
    case 'transportador': return <Truck size={14} color="#06B6D4" />;
    case 'imovel_car': return <Sprout size={14} color="#22C55E" />;
    case 'estabelecimento_cnes': return <HeartPulse size={14} color="#EC4899" />;
    case 'municipio': return <Globe size={14} color="#F59E0B" />;
    default: return <Building2 size={14} color="#6366F1" />;
  }
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

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [autocompleteOpen, setAutocompleteOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<EntitySearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  const [selectedClass, setSelectedClass] = useState<string>('');
  const [minConfidence, setMinConfidence] = useState<number>(0);
  const [sourceVertical, setSourceVertical] = useState<string>('');
  const [targetVertical, setTargetVertical] = useState<string>('');
  const [nodeTypeFilter, setNodeTypeFilter] = useState<string>('');
  const [relationTypeFilter, setRelationTypeFilter] = useState<string>('');
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
  const [reviewNewClassification, setReviewNewClassification] = useState<string>('');
  const [reviewJustification, setReviewJustification] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewSuccess, setReviewSuccess] = useState<string | null>(null);

  const [apiState, setApiState] = useState<ApiState>(INITIAL_STATE);
  const [centralEntityId, setCentralEntityId] = useState<string | null>(null);
  const [currentInvestigation, setCurrentInvestigation] = useState<string>('');

  const initialParam = searchParams.get('entidade') || searchParams.get('cnpj') || '';

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
        classificacao: params?.classificacao || undefined,
        uf: params?.uf || undefined,
        confianca_min: params?.confianca_min ? Number(params.confianca_min) : undefined,
        page_size: 100,
      });

      const firstNode = result.nodes[0];
      setCentralEntityId(firstNode?.id || result.entity?.id || null);

      if (firstNode) {
        setCurrentInvestigation(entityIdent);
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
        error: 'Não foi possível carregar os relacionamentos.',
        data: null,
      });
      setCentralEntityId(null);
    }
  }, []);

  useEffect(() => {
    if (initialParam) {
      fetchData(initialParam);
    } else {
      setApiState(INITIAL_STATE);
      setCentralEntityId(null);
    }
  }, [initialParam, fetchData]);

  useEffect(() => {
    return () => {
      relationshipsService.cancelRequest();
    };
  }, []);

  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      setAutocompleteOpen(false);
      return;
    }
    setSearching(true);
    setAutocompleteOpen(true);
    try {
      const results = await relationshipsService.searchEntities(query);
      setSearchResults(results);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleSelectAutocomplete = (item: EntitySearchResult) => {
    setSearchQuery(item.nome);
    setAutocompleteOpen(false);
    const params: Record<string, string> = { entidade: item.documento || item.id };
    setSearchParams(params);
    fetchData(item.documento || item.id);
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

  const confirmedCount = useMemo(() => filteredEdges.filter(e => e.classification === 'CONFIRMADO').length, [filteredEdges]);
  const probableCount = useMemo(() => filteredEdges.filter(e => e.classification === 'PROVÁVEL').length, [filteredEdges]);
  const potentialCount = useMemo(() => filteredEdges.filter(e => e.classification === 'POTENCIAL').length, [filteredEdges]);
  const totalConnsCount = filteredEdges.length;

  const avgConfidenceVal = useMemo(() => {
    if (totalConnsCount === 0) return '0,0';
    const sum = filteredEdges.reduce((acc, e) => acc + e.confidence, 0);
    return (sum / totalConnsCount).toFixed(1);
  }, [filteredEdges, totalConnsCount]);

  const pendingReviewCount = useMemo(() =>
    filteredEdges.filter(e => e.status_revisao === 'pendente').length,
  [filteredEdges]);

  const handleComputeShortestPath = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pathEntityA || !pathEntityB || !apiState.data) return;

    const entA = apiState.data.nodes.find(n => n.name.toLowerCase().includes(pathEntityA.toLowerCase()) || n.id === pathEntityA);
    const entB = apiState.data.nodes.find(n => n.name.toLowerCase().includes(pathEntityB.toLowerCase()) || n.id === pathEntityB);

    if (!entA || !entB) {
      setComputedPath({ found: false, hops: 0, steps: [] });
      return;
    }

    const adjMap = new Map<string, { to: string; edge: CatalogEdge }[]>();
    apiState.data.edges.forEach(edge => {
      if (!adjMap.has(edge.source)) adjMap.set(edge.source, []);
      if (!adjMap.has(edge.target)) adjMap.set(edge.target, []);
      adjMap.get(edge.source)!.push({ to: edge.target, edge });
      adjMap.get(edge.target)!.push({ to: edge.source, edge });
    });

    const queue: { current: string; path: { from: string; to: string; edge: CatalogEdge }[] }[] = [
      { current: entA.id, path: [] }
    ];
    const visited = new Set<string>([entA.id]);
    let foundPath: { from: string; to: string; edge: CatalogEdge }[] | null = null;

    while (queue.length > 0) {
      const { current, path } = queue.shift()!;
      if (current === entB.id) {
        foundPath = path;
        break;
      }
      const neighbors = adjMap.get(current) || [];
      for (const n of neighbors) {
        if (!visited.has(n.to)) {
          visited.add(n.to);
          queue.push({ current: n.to, path: [...path, { from: current, to: n.to, edge: n.edge }] });
        }
      }
    }

    if (foundPath && foundPath.length > 0) {
      const steps = foundPath.map(step => {
        const srcObj = apiState.data!.nodes.find(x => x.id === step.from);
        const tgtObj = apiState.data!.nodes.find(x => x.id === step.to);
        return {
          from: srcObj ? srcObj.name : step.from,
          to: tgtObj ? tgtObj.name : step.to,
          relation: step.edge.label,
          classif: step.edge.classification,
          conf: step.edge.confidence,
          evidence: step.edge.evidence,
        };
      });
      const nodeIds = Array.from(new Set([entA.id, ...foundPath.map(s => s.to)]));
      const edgeIds = foundPath.map(s => s.edge.id);
      setComputedPath({ found: true, hops: foundPath.length, steps, nodeIds, edgeIds });
    } else {
      setComputedPath({ found: false, hops: 0, steps: [] });
    }
  };

  const handleHighlightPathInGraph = () => {
    if (computedPath?.found && computedPath.nodeIds && visualizerRef.current) {
      visualizerRef.current.highlightPath(computedPath.nodeIds, computedPath.edgeIds);
    }
  };

  const handleOpenEdgeDrawer = (edge: CatalogEdge) => {
    setSelectedEdge(edge);
    setIsDrawerOpen(true);
    setReviewNewClassification('');
    setReviewJustification('');
    setReviewError(null);
    setReviewSuccess(null);
  };

  const resolveEntityName = (id: string) => {
    return apiState.data?.nodes.find(e => e.id === id)?.name || id;
  };
  const resolveEntityType = (id: string) => {
    return apiState.data?.nodes.find(e => e.id === id)?.type || 'entidade';
  };
  const resolveEntityIdentifier = (id: string) => {
    return apiState.data?.nodes.find(e => e.id === id)?.identifier || '';
  };
  const resolveEntityRoute = (id: string) => {
    return apiState.data?.nodes.find(e => e.id === id)?.route;
  };

  const userData = typeof window !== 'undefined' ? localStorage.getItem('wins_user') : null;
  const currentUser = userData ? JSON.parse(userData) : null;
  const isViewer = currentUser?.roles?.includes('viewer');

  const handleExport = () => {
    if (isViewer || !apiState.data) return;

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
    const confirmed = rows.filter(r => r.classificacao === 'CONFIRMADO').length;
    const provavel = rows.filter(r => r.classificacao === 'PROVÁVEL').length;
    const potencial = rows.filter(r => r.classificacao === 'POTENCIAL').length;
    const confMedia = rows.length > 0 ? (rows.reduce((s, r) => s + r.confianca, 0) / rows.length).toFixed(1) : '0,0';

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
    .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 20px 0; }
    .card { border: 1px solid #E2E8F0; padding: 12px; border-radius: 6px; text-align: center; }
    .card .val { font-size: 18px; font-weight: 700; }
    .card .lbl { font-size: 10px; color: #64748B; }
    .warning { background: #FEF3C7; border: 1px solid #F59E0B; border-radius: 6px; padding: 10px 14px; font-size: 11px; color: #92400E; margin: 16px 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 10px; }
    th, td { border: 1px solid #E2E8F0; padding: 6px 8px; text-align: left; }
    th { background: #F8FAFC; color: #475569; font-weight: 600; }
    .conf { color: #166534; font-weight: 700; }
    .prov { color: #155E75; font-weight: 700; }
    .pot { color: #92400E; font-weight: 700; }
    footer { margin-top: 32px; font-size: 9px; color: #94A3B8; text-align: center; border-top: 1px solid #E2E8F0; padding-top: 12px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Relacionamentos - ${entityNome}</h1>
    <div class="meta">Gerado em ${now} · Hash ${hash} · ${currentUser?.name || 'Analista'}</div>
  </div>

  <div class="grid">
    <div class="card"><div class="val">${rows.length}</div><div class="lbl">Conexões</div></div>
    <div class="card"><div class="val" style="color:#22C55E">${confirmed}</div><div class="lbl">Confirmadas</div></div>
    <div class="card"><div class="val" style="color:#06B6D4">${provavel}</div><div class="lbl">Prováveis</div></div>
    <div class="card"><div class="val" style="color:#F59E0B">${potencial}</div><div class="lbl">Potenciais</div></div>
  </div>
  <div class="grid">
    <div class="card"><div class="val">${nodes.length}</div><div class="lbl">Entidades no recorte</div></div>
    <div class="card"><div class="val">${confMedia}%</div><div class="lbl">Confiança Média</div></div>
  </div>

  <div class="warning">
    <strong>⚠ Aviso:</strong> Relações classificadas como PROVÁVEL ou POTENCIAL não representam vínculo contratual ou
    operacional comprovado. Apenas relações CONFIRMADO possuem evidência documental auditada.
  </div>

  <table>
    <thead>
      <tr>
        <th>Origem</th>
        <th>Tipo</th>
        <th>Relação</th>
        <th>Destino</th>
        <th>Tipo</th>
        <th>Classificação</th>
        <th>Confiança</th>
        <th>Evidência</th>
        <th>Fonte</th>
        <th>Revisão</th>
      </tr>
    </thead>
    <tbody>
      ${rows.map(r => `
        <tr>
          <td><strong>${r.origem}</strong><br><span style="font-size:9px;color:#94A3B8">${r.origem_doc}</span></td>
          <td>${r.origem_tipo}</td>
          <td>${r.relacao}</td>
          <td><strong>${r.destino}</strong><br><span style="font-size:9px;color:#94A3B8">${r.destino_doc}</span></td>
          <td>${r.destino_tipo}</td>
          <td class="${r.classificacao === 'CONFIRMADO' ? 'conf' : r.classificacao === 'PROVÁVEL' ? 'prov' : 'pot'}">${r.classificacao}</td>
          <td>${r.confianca}%</td>
          <td style="font-size:9px;max-width:200px">${r.evidencia}</td>
          <td style="font-size:9px">${r.fonte}</td>
          <td>${r.revisao}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <footer>
    WiNS Hub Inteligência Comercial · Hash ${hash} · Dados da API
  </footer>
  <script>window.onload = function() { window.print(); }</script>
</body>
</html>`;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const activeChips = useMemo(() => {
    const chips: { key: string; label: string; clear: () => void }[] = [];
    if (selectedClass) chips.push({ key: 'class', label: `Classificação: ${selectedClass}`, clear: () => setSelectedClass('') });
    if (minConfidence > 0) chips.push({ key: 'conf', label: `Confiança ≥ ${minConfidence}%`, clear: () => setMinConfidence(0) });
    if (sourceVertical) chips.push({ key: 'srcVert', label: `Origem: ${sourceVertical}`, clear: () => setSourceVertical('') });
    if (targetVertical) chips.push({ key: 'tgtVert', label: `Destino: ${targetVertical}`, clear: () => setTargetVertical('') });
    if (filterSource) chips.push({ key: 'source', label: `Fonte: ${filterSource}`, clear: () => setFilterSource('') });
    if (tableSearch) chips.push({ key: 'search', label: `Busca: ${tableSearch}`, clear: () => setTableSearch('') });
    return chips;
  }, [selectedClass, minConfidence, sourceVertical, targetVertical, filterSource, tableSearch]);

  const hasData = apiState.data && !apiState.loading && !apiState.error;

  return (
    <div data-ui-version="relacionamentos-approved-v2" style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-base, #090D16)', position: 'relative', overflow: 'hidden' }}>
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
              <h1 style={{ fontSize: isMobile ? 14 : 16, fontWeight: 700, color: 'var(--text-primary, #F8FAFC)', margin: 0 }}>
                Investigação de Relacionamentos
              </h1>
              {apiState.loading && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite', color: '#3B82F6' }} />}
            </div>
            {!isMobile && centralEntityId && hasData && (
              <p style={{ fontSize: 11, color: 'var(--text-tertiary, #64748B)', margin: 0, marginTop: 1 }}>
                Rede de relacionamentos de {apiState.data?.entity?.nome || centralEntityId}
              </p>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => {
                relationshipsService.cancelRequest();
                relationshipsService.clearCache();
                setApiState(INITIAL_STATE);
                setCentralEntityId(null);
                setCurrentInvestigation('');
                setSelectedClass('');
                setMinConfidence(0);
                setSourceVertical('');
                setTargetVertical('');
                setNodeTypeFilter('');
                setFilterSource('');
                setTableSearch('');
                setSearchQuery('');
                setSearchResults([]);
                setComputedPath(null);
                setSelectedEdge(null);
                setIsDrawerOpen(false);
                setSearchParams({});
              }}
              style={{ height: 32, padding: '0 12px', fontSize: 11, fontWeight: 600, background: 'var(--bg-base)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <RefreshCw size={13} /> {!isMobile && <span>Nova consulta</span>}
            </button>
            <button
              onClick={handleExport}
              disabled={isViewer || !hasData}
              title={isViewer ? 'Apenas administradores podem exportar' : 'Exportar conexões'}
              style={{ height: 32, padding: '0 12px', fontSize: 11, fontWeight: 600, background: isViewer ? '#1E293B' : '#8B5CF6', color: isViewer ? '#64748B' : '#FFF', border: 'none', borderRadius: 6, cursor: isViewer ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <Download size={13} /> {!isMobile && <span>{isViewer ? 'Exportação restrita' : 'Exportar conexões'}</span>}
            </button>
          </div>
        </header>

        <div style={{ padding: isMobile ? 12 : 24, flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

          <div style={{ position: 'relative', background: 'var(--bg-surface, #0F172A)', border: '1px solid var(--border-default, #1E293B)', borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Search size={15} color="#3B82F6" />
              <strong style={{ fontSize: 13, color: 'var(--text-primary, #F8FAFC)' }}>Buscar entidade para investigar</strong>
            </div>

            <div style={{ position: 'relative', width: '100%' }}>
              <input
                data-testid="search-autocomplete-input"
                value={searchQuery}
                onFocus={() => { if (searchResults.length > 0) setAutocompleteOpen(true); }}
                onChange={e => handleSearch(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && searchQuery.trim()) {
                    handleSelectAutocomplete({ id: searchQuery, nome: searchQuery, tipo: 'empresa', documento: searchQuery, municipio: '', uf: '', fonte: '', rota: null });
                  }
                }}
                placeholder="Digitar Razão Social, CNPJ, Obra, Transportador, CNES, Município..."
                style={{
                  width: '100%', height: 36, paddingLeft: 36, paddingRight: 36, fontSize: 12,
                  background: 'var(--bg-base, #090D16)', border: '1px solid #3B82F6', borderRadius: 6, color: 'var(--text-primary)'
                }}
              />
              <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
              {searchQuery && (
                <button onClick={() => { setSearchQuery(''); setAutocompleteOpen(false); setSearchResults([]); }} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}>
                  <X size={14} />
                </button>
              )}

              {autocompleteOpen && searchResults.length > 0 && (
                <div
                  data-testid="autocomplete-dropdown"
                  style={{
                    position: 'absolute', top: 40, left: 0, width: '100%', background: '#0F172A',
                    border: '1px solid #3B82F6', borderRadius: 8, zIndex: 1000, boxShadow: '0 10px 30px rgba(0,0,0,0.8)',
                    maxHeight: 280, overflowY: 'auto'
                  }}
                >
                  {searchResults.map(item => (
                    <div
                      key={item.id}
                      onClick={() => handleSelectAutocomplete(item)}
                      style={{
                        padding: '10px 14px', borderBottom: '1px solid #1E293B', cursor: 'pointer',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'background 0.15s'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#1E293B')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {getEntityIcon(item.tipo)}
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#FFF' }}>{item.nome}</div>
                          <div style={{ fontSize: 10, color: '#94A3B8' }}>
                            {item.documento} · {item.municipio}/{item.uf} · Fonte: <strong>{item.fonte}</strong>
                          </div>
                        </div>
                      </div>
                      <span style={{ fontSize: 9, fontWeight: 700, color: '#3B82F6', background: 'rgba(59,130,246,0.15)', padding: '2px 8px', borderRadius: 4, textTransform: 'uppercase' }}>
                        {item.tipo}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {searching && (
                <div style={{ position: 'absolute', top: 40, left: 0, width: '100%', background: '#0F172A', border: '1px solid #3B82F6', borderRadius: 8, zIndex: 1000, padding: 16, textAlign: 'center', fontSize: 12, color: '#94A3B8' }}>
                  <Loader2 size={16} style={{ animation: 'spin 1s linear infinite', marginRight: 8 }} />
                  Buscando...
                </div>
              )}
            </div>

            {!hasData && !apiState.loading && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', paddingTop: 6, borderTop: '1px solid #1E293B', fontSize: 11, color: '#64748B' }}>
                <Info size={12} /> Digite um CNPJ, razão social ou selecione uma entidade para iniciar a investigação. Ex: CNPJ 00.000.000/0001-91
              </div>
            )}

            {hasData && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', paddingTop: 6, borderTop: '1px solid #1E293B' }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Filter size={12} /> Filtros:
                </span>

                <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)} style={{ height: 30, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', fontSize: 11, borderRadius: 4, padding: '0 8px' }}>
                  <option value="">Todas as Classificações</option>
                  <option value="CONFIRMADO">CONFIRMADO (Vínculo Documental)</option>
                  <option value="PROVÁVEL">PROVÁVEL (Correspondência Forte)</option>
                  <option value="POTENCIAL">POTENCIAL (Geofence Territorial)</option>
                </select>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-secondary)', background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, padding: '0 8px', height: 30 }}>
                  <span>Confiança Min:</span>
                  <strong style={{ color: '#8B5CF6' }}>{minConfidence}%</strong>
                  <input type="range" min={0} max={99} value={minConfidence} onChange={e => setMinConfidence(Number(e.target.value))} style={{ width: 60 }} />
                </div>

                <select value={sourceVertical} onChange={e => setSourceVertical(e.target.value)} style={{ height: 30, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', fontSize: 11, borderRadius: 4, padding: '0 8px' }}>
                  <option value="">Origem (Todas)</option>
                  <option value="empresa">Empresa</option>
                  <option value="obra">Obra</option>
                  <option value="transportador">Transportador</option>
                  <option value="imovel_car">Imóvel CAR</option>
                  <option value="estabelecimento_cnes">CNES</option>
                  <option value="municipio">Município</option>
                </select>

                <BrazilUfSelect value={filterUf} onChange={(val) => setFilterUf(val)} showAllLabel="Todas as UFs" />

                <select value={targetVertical} onChange={e => setTargetVertical(e.target.value)} style={{ height: 30, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', fontSize: 11, borderRadius: 4, padding: '0 8px' }}>
                  <option value="">Destino (Todas)</option>
                  <option value="empresa">Empresa</option>
                  <option value="obra">Obra</option>
                  <option value="transportador">Transportador</option>
                  <option value="imovel_car">Imóvel CAR</option>
                  <option value="estabelecimento_cnes">CNES</option>
                  <option value="municipio">Município</option>
                </select>

                <select value={maxNodesLimit} onChange={e => setMaxNodesLimit(Number(e.target.value))} style={{ height: 30, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', fontSize: 11, borderRadius: 4, padding: '0 8px' }}>
                  <option value={10}>Limite: 10 nós</option>
                  <option value={25}>Limite: 25 nós</option>
                  <option value={50}>Limite: 50 nós</option>
                  <option value={100}>Limite: 100 nós</option>
                </select>
              </div>
            )}

            {hasData && activeChips.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: 10, color: '#64748B' }}>Filtros ativos:</span>
                {activeChips.map(chip => (
                  <span key={chip.key} style={{ fontSize: 10, background: '#1E293B', color: '#F8FAFC', padding: '2px 8px', borderRadius: 12, display: 'inline-flex', alignItems: 'center', gap: 4, border: '1px solid #334155' }}>
                    {chip.label}
                    <button onClick={chip.clear} style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: 0 }}><X size={10} /></button>
                  </span>
                ))}
                <button onClick={() => { setSelectedClass(''); setMinConfidence(0); setSourceVertical(''); setTargetVertical(''); setNodeTypeFilter(''); setFilterSource(''); setTableSearch(''); }} style={{ fontSize: 10, color: '#EF4444', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                  Limpar tudo
                </button>
              </div>
            )}
          </div>

          {apiState.loading && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', gap: 16 }}>
              <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: '#8B5CF6' }} />
              <p style={{ fontSize: 13, color: '#94A3B8', margin: 0 }}>Carregando relacionamentos...</p>
            </div>
          )}

          {apiState.error && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', gap: 12, background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 10 }}>
              <AlertCircle size={32} color="#EF4444" />
              <p style={{ fontSize: 14, fontWeight: 700, color: '#F8FAFC', margin: 0 }}>{apiState.error}</p>
              <button onClick={() => initialParam && fetchData(initialParam)} style={{ height: 32, padding: '0 16px', fontSize: 11, fontWeight: 600, background: '#3B82F6', color: '#FFF', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
                Tentar novamente
              </button>
            </div>
          )}

          {!hasData && !apiState.loading && !apiState.error && !initialParam && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 20px', gap: 12, background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 10 }}>
              <Network size={48} color="#334155" />
              <p style={{ fontSize: 14, fontWeight: 700, color: '#64748B', margin: 0 }}>Nenhuma investigação em andamento</p>
              <p style={{ fontSize: 12, color: '#475569', margin: 0, textAlign: 'center', maxWidth: 400 }}>
                Utilize a busca acima para encontrar uma entidade e iniciar a análise de relacionamentos comerciais.
              </p>
            </div>
          )}

          {hasData && (
            <>
              <div style={{ fontSize: 11, color: '#64748B', display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0' }}>
                <Database size={12} /> Exibindo <strong style={{ color: '#F8FAFC' }}>{filteredNodes.length}</strong> de{' '}
                <strong style={{ color: '#F8FAFC' }}>{apiState.data!.meta?.total_entidades || filteredNodes.length}</strong> entidades relacionadas ·{' '}
                {filteredEdges.length} arestas no recorte atual
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(7, 1fr)', gap: 10 }}>
                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8, padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Nó Central</span>
                    <span title="Entidade central da investigação atual"><Info size={11} color="#64748B" style={{ cursor: 'pointer' }} /></span>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#3B82F6', margin: '4px 0 2px 0', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    {apiState.data?.entity?.nome || centralEntityId || '—'}
                  </div>
                  <span style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>{apiState.data?.entity?.documento || ''}</span>
                </div>

                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8, padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Conexões Totais</span>
                    <span title="Soma de todas as relações no recorte atual"><Info size={11} color="#64748B" style={{ cursor: 'pointer' }} /></span>
                  </div>
                  <div data-testid="kpi-total-conns" style={{ fontSize: 18, fontWeight: 700, color: '#8B5CF6', margin: '2px 0' }}>{totalConnsCount} arestas</div>
                  <span style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>{filteredNodes.length} nós no recorte</span>
                </div>

                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8, padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Confirmadas</span>
                    <span title="Relações com evidência documental"><Info size={11} color="#64748B" style={{ cursor: 'pointer' }} /></span>
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#22C55E', margin: '2px 0' }}>{confirmedCount}</div>
                  <span style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>Documental</span>
                </div>

                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8, padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Prováveis</span>
                    <span title="Correspondência algorítmica forte"><Info size={11} color="#64748B" style={{ cursor: 'pointer' }} /></span>
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#06B6D4', margin: '2px 0' }}>{probableCount}</div>
                  <span style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>Match CNAE/território</span>
                </div>

                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8, padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Potenciais</span>
                    <span title="Relação contextual ou territorial"><Info size={11} color="#64748B" style={{ cursor: 'pointer' }} /></span>
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#F59E0B', margin: '2px 0' }}>{potentialCount}</div>
                  <span style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>Contextual/territorial</span>
                </div>

                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8, padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Confiança Média</span>
                    <span title={`Média aritmética simples dos scores no recorte atual. Cálculo: soma(confidence) / ${totalConnsCount} relações. ${apiState.data?.meta?.metodo_calculo || 'Média simples'}.`}><Info size={11} color="#64748B" style={{ cursor: 'pointer' }} /></span>
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#EC4899', margin: '2px 0' }}>{avgConfidenceVal}%</div>
                  <span style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>Média aritmética simples</span>
                </div>

                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8, padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Revisão Pendente</span>
                    <span title="Relações aguardando auditoria"><Info size={11} color="#64748B" style={{ cursor: 'pointer' }} /></span>
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#EAB308', margin: '2px 0' }}>{pendingReviewCount}</div>
                  <span style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>Auditoria analítica</span>
                </div>
              </div>

              <div style={{ position: 'relative' }}>
                <RelationshipGraphVisualizer
                  ref={visualizerRef}
                  nodes={filteredNodes}
                  edges={filteredEdges.map(e => ({
                    id: e.id,
                    source: e.source,
                    target: e.target,
                    sourceType: e.sourceType,
                    targetType: e.targetType,
                    label: e.label,
                    tipo_relacao: e.tipo_relacao,
                    confidence: e.confidence,
                    classification: e.classification,
                    score_components: e.score_components,
                    evidence: e.evidence,
                    fonte: e.fonte,
                    tipo_fonte: e.tipo_fonte,
                    sourceSystem: e.sourceSystem,
                    updatedAt: e.updatedAt,
                    calculado_em: e.calculado_em,
                    verificado_em: e.verificado_em,
                    versao_regra: e.versao_regra,
                    limitacoes: e.limitacoes,
                    status_revisao: e.status_revisao,
                    provenance: e.provenance,
                  }))}
                  centralNodeId={centralEntityId || undefined}
                  onSelectEdge={(edge) => {
                    const catalogEdge = apiState.data!.edges.find(x => x.id === edge.id) || edge as any;
                    handleOpenEdgeDrawer(catalogEdge);
                  }}
                  onSelectNode={(node) => {}}
                  onSetCentralNode={(node) => {
                    const params: Record<string, string> = { entidade: node.identifier || node.id };
                    setSearchParams(params);
                    fetchData(node.identifier || node.id);
                  }}
                  onExpandNode={(node) => setMaxNodesLimit(prev => Math.min(prev + 10, 100))}
                  onCollapseNode={() => setMaxNodesLimit(15)}
                  onHideNode={() => {}}
                  onSetPathEntity={(nodeName, slot) => {
                    if (slot === 'A') setPathEntityA(nodeName);
                    else setPathEntityB(nodeName);
                  }}
                  onOpenDetail={(node) => {
                    if (node.route) navigate(node.route);
                  }}
                />
              </div>

              {isDrawerOpen && selectedEdge && (
                <div
                  data-testid="evidence-drawer"
                  style={{
                    position: 'fixed', top: 0, right: 0, width: isMobile ? '100%' : 460, height: '100vh',
                    background: '#0F172A', borderLeft: '1px solid #8B5CF6', zIndex: 2000,
                    boxShadow: '-10px 0 30px rgba(0,0,0,0.8)', padding: 20, display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1E293B', paddingBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <ShieldCheck size={18} color="#8B5CF6" />
                      <h3 style={{ fontSize: 15, fontWeight: 700, color: '#FFF', margin: 0 }}>Por que essas entidades estão relacionadas?</h3>
                    </div>
                    <button data-testid="close-drawer-btn" onClick={() => setIsDrawerOpen(false)} style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: 4 }}><X size={18} /></button>
                  </div>

                  <div style={{ background: '#090D16', border: '1px solid #1E293B', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#FFF' }}>{resolveEntityName(selectedEdge.source)}</div>
                      <div style={{ fontSize: 10, color: '#3B82F6' }}>{resolveEntityType(selectedEdge.source)} · {resolveEntityIdentifier(selectedEdge.source) || '—'}</div>
                    </div>
                    <div style={{ textAlign: 'center', fontSize: 11, color: '#8B5CF6', fontWeight: 700 }}>
                      → {selectedEdge.tipo_relacao || selectedEdge.label} {selectedEdge.confidence}% ←
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#FFF' }}>{resolveEntityName(selectedEdge.target)}</div>
                      <div style={{ fontSize: 10, color: '#3B82F6' }}>{resolveEntityType(selectedEdge.target)} · {resolveEntityIdentifier(selectedEdge.target) || '—'}</div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div style={{ background: '#090D16', border: '1px solid #1E293B', borderRadius: 6, padding: 8 }}>
                      <div style={{ fontSize: 9, color: '#94A3B8' }}>Classificação</div>
                      <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2, color: selectedEdge.classification === 'CONFIRMADO' ? '#22C55E' : selectedEdge.classification === 'PROVÁVEL' ? '#06B6D4' : '#F59E0B' }}>
                        {selectedEdge.classification}
                      </div>
                    </div>
                    <div style={{ background: '#090D16', border: '1px solid #1E293B', borderRadius: 6, padding: 8 }}>
                      <div style={{ fontSize: 9, color: '#94A3B8' }}>Score</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#8B5CF6', marginTop: 2 }}>{selectedEdge.confidence}/100</div>
                    </div>
                  </div>

                  <div style={{ background: '#090D16', border: '1px solid #1E293B', borderRadius: 8, padding: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#F8FAFC', marginBottom: 4 }}>Justificativa:</div>
                    <p style={{ fontSize: 11, color: '#CBD5E1', lineHeight: 1.4, margin: 0 }}>{selectedEdge.evidence}</p>
                  </div>

                  {selectedEdge.score_components && selectedEdge.score_components.length > 0 && (
                    <div style={{ background: '#090D16', border: '1px solid #1E293B', borderRadius: 8, padding: 12 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#F8FAFC', marginBottom: 6 }}>Componentes do Score:</div>
                      <table style={{ width: '100%', fontSize: 10, borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ color: '#64748B', borderBottom: '1px solid #1E293B' }}>
                            <th style={{ textAlign: 'left', padding: '3px 4px' }}>Componente</th>
                            <th style={{ textAlign: 'right', padding: '3px 4px' }}>Peso</th>
                            <th style={{ textAlign: 'right', padding: '3px 4px' }}>Valor</th>
                            <th style={{ textAlign: 'right', padding: '3px 4px' }}>Contrib.</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedEdge.score_components.map((sc, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid #1E293B' }}>
                              <td style={{ padding: '4px', color: '#FFF' }} title={sc.justificativa}>{sc.nome}</td>
                              <td style={{ textAlign: 'right', padding: '4px', color: '#94A3B8' }}>{(sc.peso * 100).toFixed(0)}%</td>
                              <td style={{ textAlign: 'right', padding: '4px', color: '#8B5CF6', fontWeight: 700 }}>{sc.valor}</td>
                              <td style={{ textAlign: 'right', padding: '4px', color: '#22C55E' }}>{(sc.contribuicao * 100).toFixed(0)}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div style={{ fontSize: 10, color: '#94A3B8', display: 'flex', flexDirection: 'column', gap: 3, background: '#090D16', padding: 10, borderRadius: 8, border: '1px solid #1E293B' }}>
                    <div><strong style={{ color: '#CBD5E1' }}>Fonte:</strong> {selectedEdge.fonte || selectedEdge.sourceSystem || 'API'}</div>
                    <div><strong style={{ color: '#CBD5E1' }}>Tipo de Fonte:</strong> {selectedEdge.tipo_fonte || 'API'}</div>
                    <div><strong style={{ color: '#CBD5E1' }}>Regra:</strong> {selectedEdge.versao_regra || '—'}</div>
                    <div><strong style={{ color: '#CBD5E1' }}>Calculado em:</strong> {selectedEdge.calculado_em || '—'}</div>
                    <div><strong style={{ color: '#CBD5E1' }}>Verificado em:</strong> {selectedEdge.verificado_em || 'Não verificado'}</div>
                    <div><strong style={{ color: '#CBD5E1' }}>Revisão:</strong> {selectedEdge.status_revisao === 'dispensada' ? 'Dispensada' : selectedEdge.status_revisao === 'concluida' ? 'Concluída' : 'Pendente'}</div>
                    <div style={{ color: '#EF4444', marginTop: 4 }}><strong>Limitação:</strong> {selectedEdge.limitacoes || 'Nenhuma'}</div>
                  </div>

                  {!isViewer && (
                    <div style={{ background: '#090D16', border: '1px solid #334155', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#F8FAFC', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <ShieldCheck size={13} color="#8B5CF6" /> Revisão da Classificação
                      </div>
                      <select
                        value={reviewNewClassification}
                        onChange={e => setReviewNewClassification(e.target.value as any)}
                        disabled={reviewSubmitting}
                        style={{ height: 32, background: 'var(--bg-base)', border: '1px solid #8B5CF6', color: 'var(--text-primary)', fontSize: 11, borderRadius: 4, padding: '0 8px' }}
                      >
                        <option value="">Selecionar nova classificação...</option>
                        <option value="CONFIRMADO">CONFIRMADO — Vínculo Documental</option>
                        <option value="PROVÁVEL">PROVÁVEL — Correspondência Forte</option>
                        <option value="POTENCIAL">POTENCIAL — Geofence Territorial</option>
                      </select>
                      <textarea
                        value={reviewJustification}
                        onChange={e => setReviewJustification(e.target.value)}
                        disabled={reviewSubmitting}
                        placeholder="Justificativa obrigatória para reclassificação..."
                        rows={3}
                        style={{ width: '100%', background: 'var(--bg-base)', border: '1px solid #334155', borderRadius: 4, color: 'var(--text-primary)', fontSize: 11, padding: 8, resize: 'vertical', fontFamily: 'inherit' }}
                      />
                      {reviewError && <div style={{ fontSize: 10, color: '#EF4444' }}>{reviewError}</div>}
                      {reviewSuccess && <div style={{ fontSize: 10, color: '#22C55E' }}>{reviewSuccess}</div>}
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          onClick={async () => {
                            if (!reviewNewClassification) { setReviewError('Selecione uma classificação.'); return; }
                            if (!reviewJustification.trim()) { setReviewError('A justificativa é obrigatória.'); return; }
                            setReviewSubmitting(true); setReviewError(''); setReviewSuccess('');
                            try {
                              await relationshipsService.updateReviewStatus(
                                selectedEdge.id,
                                reviewNewClassification as any,
                                reviewJustification.trim()
                              );
                              setReviewSuccess('Revisão registrada com sucesso.');
                              setTimeout(() => setIsDrawerOpen(false), 1500);
                            } catch (e: any) {
                              setReviewError(e?.response?.data?.detail || 'Erro ao registrar revisão.');
                            } finally { setReviewSubmitting(false); }
                          }}
                          disabled={reviewSubmitting}
                          style={{ flex: 1, height: 30, fontSize: 10, fontWeight: 700, background: '#8B5CF6', color: '#FFF', border: 'none', borderRadius: 4, cursor: reviewSubmitting ? 'not-allowed' : 'pointer' }}
                        >
                          {reviewSubmitting ? 'Enviando...' : 'Reclassificar'}
                        </button>
                        <button
                          onClick={() => { setReviewNewClassification(''); setReviewJustification(''); setReviewError(''); setReviewSuccess(''); }}
                          disabled={reviewSubmitting}
                          style={{ height: 30, fontSize: 10, fontWeight: 600, background: '#1E293B', color: '#FFF', border: '1px solid #334155', borderRadius: 4, cursor: 'pointer', padding: '0 10px' }}
                        >
                          Limpar
                        </button>
                      </div>
                    </div>
                  )}

                  {isViewer && selectedEdge.status_revisao === 'pendente' && (
                    <div style={{ background: '#090D16', border: '1px solid #F59E0B', borderRadius: 8, padding: 10, fontSize: 10, color: '#F59E0B', textAlign: 'center' }}>
                      Esta relação aguarda revisão por um administrador.
                    </div>
                  )}

                  <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {(resolveEntityIdentifier(selectedEdge.source) || resolveEntityIdentifier(selectedEdge.target)) && (
                      <button onClick={() => {
                        const routeSrc = resolveEntityRoute(selectedEdge.source);
                        const routeTgt = resolveEntityRoute(selectedEdge.target);
                        if (routeSrc) navigate(routeSrc);
                        else if (routeTgt) navigate(routeTgt);
                        setIsDrawerOpen(false);
                      }} style={{ height: 34, fontSize: 11, fontWeight: 700, background: '#8B5CF6', color: '#FFF', border: 'none', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                        Abrir Ficha 360° <ArrowRight size={13} />
                      </button>
                    )}
                    <button onClick={() => { setIsDrawerOpen(false); setReviewNewClassification(''); setReviewJustification(''); setReviewError(''); setReviewSuccess(''); }} style={{ height: 30, fontSize: 10, fontWeight: 600, background: '#1E293B', color: '#FFF', border: '1px solid #334155', borderRadius: 6, cursor: 'pointer' }}>
                      Fechar Painel
                    </button>
                  </div>
                </div>
              )}

              <div style={{ background: 'var(--bg-surface, #0F172A)', border: '1px solid var(--border-default, #1E293B)', borderRadius: 10, padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <Sparkles size={16} color="#3B82F6" />
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                    Como estas entidades estão conectadas?
                  </h3>
                </div>

                <form onSubmit={handleComputeShortestPath} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <input data-testid="shortest-path-entity-a" value={pathEntityA} onChange={e => setPathEntityA(e.target.value)} placeholder="Entidade A" style={{ width: '100%', height: 32, padding: '0 10px', fontSize: 11, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-primary)' }} />
                  </div>
                  <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>➔</span>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <input data-testid="shortest-path-entity-b" value={pathEntityB} onChange={e => setPathEntityB(e.target.value)} placeholder="Entidade B" style={{ width: '100%', height: 32, padding: '0 10px', fontSize: 11, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-primary)' }} />
                  </div>
                  <button data-testid="shortest-path-btn" type="submit" style={{ height: 32, padding: '0 14px', fontSize: 11, fontWeight: 700, background: '#3B82F6', color: '#FFF', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
                    Encontrar conexão
                  </button>
                </form>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8, fontSize: 10, color: '#94A3B8' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer' }}><input type="radio" name="pathMode" defaultChecked style={{ accentColor: '#8B5CF6' }} /> Caminho mais curto</label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer' }}><input type="radio" name="pathMode" style={{ accentColor: '#22C55E' }} /> Somente confirmadas</label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer' }}><input type="radio" name="pathMode" style={{ accentColor: '#06B6D4' }} /> Permitir prováveis</label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer' }}><input type="radio" name="pathMode" style={{ accentColor: '#F59E0B' }} /> Excluir potenciais</label>
                  <span style={{ color: '#64748B', fontSize: 9 }}>· Conexão não representa vínculo contratual</span>
                </div>

                {computedPath && (
                  <div style={{ padding: 12, background: 'var(--bg-base)', borderRadius: 8, border: '1px solid var(--border-subtle)', fontSize: 11, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {computedPath.found ? (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: '#22C55E', fontWeight: 700 }}>Caminho Encontrado: {computedPath.hops} saltos</span>
                          <button onClick={handleHighlightPathInGraph} style={{ background: '#EC4899', color: '#FFF', border: 'none', borderRadius: 4, padding: '4px 10px', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>
                            Destacar no grafo
                          </button>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          {computedPath.steps.map((step, idx) => (
                            <React.Fragment key={idx}>
                              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{step.from}</span>
                              <ArrowRight size={12} color="#3B82F6" />
                              <span style={{ color: step.classif === 'CONFIRMADO' ? '#22C55E' : '#06B6D4', fontWeight: 700, background: 'rgba(59,130,246,0.1)', padding: '2px 6px', borderRadius: 4 }}>
                                {step.relation} ({step.conf}%)
                              </span>
                              <ArrowRight size={12} color="#3B82F6" />
                              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{step.to}</span>
                            </React.Fragment>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div style={{ color: '#EF4444', fontWeight: 600 }}>Nenhuma conexão foi encontrada no recorte atual.</div>
                    )}
                  </div>
                )}
              </div>

              <div style={{ background: 'var(--bg-surface, #0F172A)', border: '1px solid var(--border-default, #1E293B)', borderRadius: 10, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                      Matriz Tabular de Conexões ({filteredEdges.length} registros paginados)
                    </h3>
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                      Exibindo {paginatedEdges.length} linhas nesta página · 1:1 com as arestas do grafo
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setTablePage(1); }} style={{ height: 28, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', fontSize: 11, borderRadius: 4, padding: '0 6px' }}>
                      <option value={10}>10 linhas por página</option>
                      <option value={20}>20 linhas por página</option>
                    </select>

                    <div style={{ position: 'relative', width: 200 }}>
                      <Search size={12} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                      <input value={tableSearch} onChange={e => { setTableSearch(e.target.value); setTablePage(1); }} placeholder="Buscar na tabela..." style={{ width: '100%', height: 28, paddingLeft: 26, fontSize: 11, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-primary)' }} />
                    </div>
                  </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-tertiary)' }}>
                        <th style={{ padding: 8, cursor: 'pointer' }} onClick={() => { setSortField('source'); setSortAsc(!sortAsc); }}>Origem {sortField === 'source' ? (sortAsc ? '▲' : '▼') : ''}</th>
                        <th style={{ padding: 8 }}>Tipo Origem</th>
                        <th style={{ padding: 8, cursor: 'pointer' }} onClick={() => { setSortField('label'); setSortAsc(!sortAsc); }}>Relação {sortField === 'label' ? (sortAsc ? '▲' : '▼') : ''}</th>
                        <th style={{ padding: 8, cursor: 'pointer' }} onClick={() => { setSortField('target'); setSortAsc(!sortAsc); }}>Destino {sortField === 'target' ? (sortAsc ? '▲' : '▼') : ''}</th>
                        <th style={{ padding: 8 }}>Tipo Destino</th>
                        <th style={{ padding: 8, cursor: 'pointer' }} onClick={() => { setSortField('classification'); setSortAsc(!sortAsc); }}>Classificação {sortField === 'classification' ? (sortAsc ? '▲' : '▼') : ''}</th>
                        <th style={{ padding: 8, cursor: 'pointer' }} onClick={() => { setSortField('confidence'); setSortAsc(!sortAsc); }}>Confiança {sortField === 'confidence' ? (sortAsc ? '▲' : '▼') : ''}</th>
                        <th style={{ padding: 8 }}>Evidência</th>
                        <th style={{ padding: 8 }}>Fonte</th>
                        <th style={{ padding: 8 }}>Atualização</th>
                        <th style={{ padding: 8 }}>Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedEdges.map((edge, idx) => (
                        <tr key={edge.id || idx} style={{ borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer', transition: 'background 0.15s' }} onClick={() => handleOpenEdgeDrawer(edge)} onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                          <td style={{ padding: 8, fontWeight: 700, color: 'var(--text-primary)' }}>{resolveEntityName(edge.source)}</td>
                          <td style={{ padding: 8, color: '#3B82F6', fontSize: 10 }}>{edge.sourceType}</td>
                          <td style={{ padding: 8, color: '#8B5CF6', fontWeight: 600 }}>{edge.label}</td>
                          <td style={{ padding: 8, fontWeight: 700, color: 'var(--text-primary)' }}>{resolveEntityName(edge.target)}</td>
                          <td style={{ padding: 8, color: '#3B82F6', fontSize: 10 }}>{edge.targetType}</td>
                          <td style={{ padding: 8 }}>
                            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, color: edge.classification === 'CONFIRMADO' ? '#22C55E' : edge.classification === 'PROVÁVEL' ? '#06B6D4' : '#F59E0B', background: edge.classification === 'CONFIRMADO' ? 'rgba(34,197,94,0.15)' : edge.classification === 'PROVÁVEL' ? 'rgba(6,182,212,0.15)' : 'rgba(245,158,11,0.15)' }}>
                              {edge.classification}
                            </span>
                          </td>
                          <td style={{ padding: 8, fontWeight: 700, color: '#EC4899' }}>{edge.confidence}%</td>
                          <td style={{ padding: 8, color: 'var(--text-secondary)', fontSize: 10, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{edge.evidence}</td>
                          <td style={{ padding: 8, color: '#94A3B8', fontSize: 10 }}>{edge.sourceSystem || edge.fonte || 'API'}</td>
                          <td style={{ padding: 8, color: '#94A3B8', fontSize: 10 }}>{edge.updatedAt || '—'}</td>
                          <td style={{ padding: 8 }}>
                            <button onClick={(e) => { e.stopPropagation(); handleOpenEdgeDrawer(edge); }} style={{ background: '#8B5CF6', color: '#FFF', border: 'none', borderRadius: 4, padding: '3px 8px', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>
                              Ver evidências
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, fontSize: 11, color: 'var(--text-tertiary)' }}>
                  <span>Página {tablePage} de {totalTablePages}</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button disabled={tablePage === 1} onClick={() => setTablePage(prev => Math.max(prev - 1, 1))} style={{ background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', padding: '3px 10px', borderRadius: 4, fontSize: 10, cursor: tablePage === 1 ? 'not-allowed' : 'pointer' }}>
                      <ChevronLeft size={10} style={{ display: 'inline' }} /> Anterior
                    </button>
                    <button disabled={tablePage === totalTablePages} onClick={() => setTablePage(prev => Math.min(prev + 1, totalTablePages))} style={{ background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', padding: '3px 10px', borderRadius: 4, fontSize: 10, cursor: tablePage === totalTablePages ? 'not-allowed' : 'pointer' }}>
                      Próxima <ChevronRight size={10} style={{ display: 'inline' }} />
                    </button>
                  </div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border-default, #1E293B)', paddingTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, fontSize: 10, color: 'var(--text-tertiary)' }}>
                <div>
                  <strong>Qualidade e Governance:</strong> {filteredEdges.length} Arestas Auditadas · Dados da API · Grafo & Tabela Unificados.
                </div>
                <div>
                  WiNS Hub Relacionamentos Cross-Domain · Dados Reais
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
