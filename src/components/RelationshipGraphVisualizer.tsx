import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import cytoscape, { type Core, type NodeSingular, type EdgeSingular } from 'cytoscape';
import {
  ZoomIn, ZoomOut, RotateCcw, Maximize2, Minimize2, RefreshCw,
  Crosshair, Layers, Sparkles, X, ExternalLink, ArrowRight, Info,
  EyeOff, Network, Database
} from 'lucide-react';

export interface GraphNode {
  id: string;
  label: string;
  type: 'empresa' | 'obra' | 'transportador' | 'imovel_car' | 'estabelecimento_cnes' | 'municipio' | 'oportunidade' | 'evento';
  sub?: string;
  identifier?: string;
  municipality?: string;
  uf?: string;
  source?: string;
  updatedAt?: string;
  route?: string;
}

export interface ScoreComponent {
  nome: string;
  peso: number;
  contribuicao: number;
  valor: number;
  fonte: string;
  justificativa: string;
}

export interface GraphEdge {
  id?: string;
  source: string;
  target: string;
  sourceType?: string;
  targetType?: string;
  label: string;
  tipo_relacao?: string;
  confidence: number;
  classification: 'CONFIRMADO' | 'PROVÁVEL' | 'POTENCIAL';
  score_components?: ScoreComponent[];
  evidence: string;
  fonte?: string;
  tipo_fonte?: string;
  sourceSystem?: string;
  updatedAt?: string;
  calculado_em?: string;
  verificado_em?: string | null;
  versao_regra?: string;
  limitacoes?: string;
  status_revisao?: string;
  provenance?: string;
}

export interface GraphVisualizerRef {
  fit: () => void;
  centerNode: (nodeId: string) => void;
  reorganize: () => void;
  highlightPath: (nodeIds: string[], edgeIds?: string[]) => void;
}

interface Props {
  nodes: GraphNode[];
  edges: GraphEdge[];
  centralNodeId?: string;
  onSelectEdge?: (edge: GraphEdge) => void;
  onSelectNode?: (node: GraphNode) => void;
  onSetCentralNode?: (node: GraphNode) => void;
  onExpandNode?: (node: GraphNode) => void;
  onCollapseNode?: (node: GraphNode) => void;
  onHideNode?: (nodeId: string) => void;
  onSetPathEntity?: (nodeName: string, slot: 'A' | 'B') => void;
  onOpenDetail?: (node: GraphNode) => void;
}

export const RelationshipGraphVisualizer = forwardRef<GraphVisualizerRef, Props>(({
  nodes,
  edges,
  centralNodeId,
  onSelectEdge,
  onSelectNode,
  onSetCentralNode,
  onExpandNode,
  onCollapseNode,
  onHideNode,
  onSetPathEntity,
  onOpenDetail
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<GraphEdge | null>(null);
  const [nodeMenuPos, setNodeMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [provenanceModalNode, setProvenanceModalNode] = useState<GraphNode | null>(null);
  const [activeLayout, setActiveLayout] = useState<string>('concentric');
  const [showLabels, setShowLabels] = useState(false);

  const getNodeColor = (type: string) => {
    switch (type) {
      case 'obra': return '#3B82F6';
      case 'empresa': return '#8B5CF6';
      case 'transportador': return '#06B6D4';
      case 'imovel_car': return '#22C55E';
      case 'estabelecimento_cnes': return '#EC4899';
      case 'municipio': return '#F59E0B';
      case 'oportunidade': return '#10B981';
      case 'evento': return '#EF4444';
      default: return '#6366F1';
    }
  };

  const getNodeShape = (type: string) => {
    switch (type) {
      case 'obra': return 'round-rectangle';
      case 'empresa': return 'ellipse';
      case 'transportador': return 'diamond';
      case 'imovel_car': return 'pentagon';
      case 'estabelecimento_cnes': return 'hexagon';
      case 'municipio': return 'star';
      default: return 'ellipse';
    }
  };

  const getEdgeStyle = (classification: string) => {
    switch (classification) {
      case 'CONFIRMADO': return { color: '#22C55E', lineStyle: 'solid', width: 3 };
      case 'PROVÁVEL': return { color: '#06B6D4', lineStyle: 'dashed', width: 2.5 };
      case 'POTENCIAL': return { color: '#F59E0B', lineStyle: 'dotted', width: 2 };
      default: return { color: '#64748B', lineStyle: 'solid', width: 1.5 };
    }
  };

  // Initialize and Update Cytoscape Graph
  useEffect(() => {
    if (!containerRef.current) return;

    const cyNodes = nodes.map(n => {
      const color = getNodeColor(n.type);
      const shape = getNodeShape(n.type);
      const isCentral = centralNodeId && (n.id === centralNodeId || n.label === centralNodeId);
      return {
        data: {
          id: n.id,
          label: n.label,
          sub: n.sub || n.identifier || '',
          type: n.type,
          color: color,
          shape: shape,
          isCentral: isCentral ? 'yes' : 'no',
          rawNode: n
        }
      };
    });

    const nodeIdsSet = new Set(nodes.map(n => n.id));
    const nodeLabelsMap = new Map(nodes.map(n => [n.label, n.id]));

    const cyEdges = edges.map((e, idx) => {
      const srcId = nodeIdsSet.has(e.source) ? e.source : nodeLabelsMap.get(e.source) || e.source;
      const tgtId = nodeIdsSet.has(e.target) ? e.target : nodeLabelsMap.get(e.target) || e.target;
      const style = getEdgeStyle(e.classification);
      const edgeId = e.id || `edge_${idx}_${srcId}_${tgtId}`;

      return {
        data: {
          id: edgeId,
          source: srcId,
          target: tgtId,
          label: showLabels ? `${e.label} (${e.confidence}%)` : '',
          rawLabel: e.label,
          confidence: e.confidence,
          classification: e.classification,
          color: style.color,
          lineStyle: style.lineStyle,
          width: e.confidence >= 95 ? 4 : e.confidence >= 85 ? 3 : 2,
          rawEdge: e
        }
      };
    }).filter(e => nodeIdsSet.has(e.data.source) && nodeIdsSet.has(e.data.target));

    if (cyRef.current) {
      cyRef.current.destroy();
    }

    const nodeSize = (n: any) => {
      const isCentral = n.isCentral === 'yes';
      const conns = edges.filter(e => e.source === n.id || e.target === n.id).length;
      return Math.max(30, Math.min(60, 30 + conns * 3));
    };

    const layoutOpts: Record<string, any> = {
      name: activeLayout,
      padding: 60,
      animate: true,
      animationDuration: 400,
    };
    if (activeLayout === 'concentric') {
      layoutOpts.concentric = (node: NodeSingular) => node.data('isCentral') === 'yes' ? 10 : 1;
      layoutOpts.levelWidth = () => 1;
    }
    if (activeLayout === 'breadthfirst') {
      layoutOpts.directed = true;
      layoutOpts.spacingFactor = 1.5;
    }
    if (activeLayout === 'cose') {
      layoutOpts.idealEdgeLength = () => 120;
      layoutOpts.nodeRepulsion = () => 8000;
      layoutOpts.gravity = 0.5;
    }
    if (activeLayout === 'grid') {
      layoutOpts.rows = undefined;
    }
    if (activeLayout === 'circle') {
      layoutOpts.spacingFactor = 1.2;
    }

    const cy = cytoscape({
      container: containerRef.current,
      elements: [...cyNodes, ...cyEdges],
      boxSelectionEnabled: false,
      autounselectify: false,
      style: [
        {
          selector: 'node',
          style: {
            'label': showLabels ? 'data(label)' : '',
            'background-color': 'data(color)',
            'shape': 'data(shape)' as any,
            'color': '#F8FAFC',
            'font-size': 11,
            'font-weight': 'bold',
            'text-valign': 'bottom',
            'text-margin-y': 6,
            'text-wrap': 'wrap',
            'text-max-width': '100px' as any,
            'width': (el: NodeSingular) => nodeSize(el.data()),
            'height': (el: NodeSingular) => nodeSize(el.data()),
            'border-width': 2,
            'border-color': '#0F172A',
            'transition-property': 'background-color, border-color, border-width',
            'transition-duration': 0.2
          }
        },
        {
          selector: 'node[isCentral = "yes"]',
          style: {
            'border-width': 4,
            'border-color': '#3B82F6',
          }
        },
        {
          selector: 'node:selected',
          style: {
            'border-width': 4,
            'border-color': '#FFFFFF',
          }
        },
        {
          selector: 'edge',
          style: {
            'label': showLabels ? 'data(label)' : '',
            'width': 'data(width)',
            'line-color': 'data(color)',
            'target-arrow-color': 'data(color)',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'font-size': 8,
            'font-weight': 600,
            'color': '#CBD5E1',
            'text-background-color': '#090D16',
            'text-background-opacity': 0.9,
            'text-background-padding': '2px' as any,
            'line-style': 'data(lineStyle)' as any,
          }
        },
        {
          selector: 'edge:selected',
          style: {
            'width': 4.5,
            'line-color': '#FFFFFF',
            'target-arrow-color': '#FFFFFF',
          }
        },
        {
          selector: '.path-highlighted',
          style: {
            'border-width': 5,
            'border-color': '#EC4899',
            'line-color': '#EC4899',
            'target-arrow-color': '#EC4899',
            'width': 5,
            'z-index': 99
          }
        }
      ],
      layout: layoutOpts as any
    });

    cyRef.current = cy;

    // Node tap handler
    cy.on('tap', 'node', (evt) => {
      const node = evt.target;
      const rawNode = node.data('rawNode');
      setSelectedNode(rawNode);
      setSelectedEdge(null);

      const renderedPos = node.renderedPosition();
      setNodeMenuPos({ x: renderedPos.x, y: renderedPos.y });

      if (onSelectNode) onSelectNode(rawNode);
    });

    // Edge tap handler
    cy.on('tap', 'edge', (evt) => {
      const edge = evt.target;
      const rawEdge = edge.data('rawEdge');
      setSelectedEdge(rawEdge);
      setSelectedNode(null);
      setNodeMenuPos(null);

      if (onSelectEdge) onSelectEdge(rawEdge);
    });

    // Background tap handler
    cy.on('tap', (evt) => {
      if (evt.target === cy) {
        setNodeMenuPos(null);
      }
    });

    // Initial fit
    cy.ready(() => {
      cy.fit(undefined, 40);
    });

    return () => {
      cy.destroy();
    };
  }, [nodes, edges, centralNodeId, activeLayout, showLabels]);

  // Imperative handle methods
  useImperativeHandle(ref, () => ({
    fit: () => {
      if (cyRef.current) {
        cyRef.current.fit(undefined, 40);
      }
    },
    centerNode: (nodeId: string) => {
      if (!cyRef.current) return;
      const el = cyRef.current.getElementById(nodeId);
      if (el && el.length > 0) {
        cyRef.current.animate({
          fit: { eles: el, padding: 120 },
          duration: 400
        });
      } else {
        cyRef.current.fit(undefined, 40);
      }
    },
    reorganize: () => {
      if (cyRef.current) {
        const layoutOpts: Record<string, any> = {
          name: activeLayout,
          padding: 60,
          animate: true,
          animationDuration: 400,
        };
        if (activeLayout === 'concentric') {
          layoutOpts.concentric = (node: NodeSingular) => (node.data('isCentral') === 'yes' ? 10 : 1);
          layoutOpts.levelWidth = () => 1;
        }
        cyRef.current.layout(layoutOpts as any).run();
      }
    },
    highlightPath: (nodeIds: string[], edgeIds?: string[]) => {
      if (!cyRef.current) return;
      const cy = cyRef.current;
      cy.elements().removeClass('path-highlighted');

      const elementsToHighlight = cy.collection();
      nodeIds.forEach(id => {
        const el = cy.getElementById(id);
        if (el.length) elementsToHighlight.merge(el);
      });

      if (edgeIds) {
        edgeIds.forEach(id => {
          const el = cy.getElementById(id);
          if (el.length) elementsToHighlight.merge(el);
        });
      }

      elementsToHighlight.addClass('path-highlighted');
      cy.fit(elementsToHighlight, 80);
    }
  }));

  const handleZoomIn = () => {
    if (cyRef.current) {
      cyRef.current.zoom({
        level: cyRef.current.zoom() * 1.25,
        renderedPosition: { x: cyRef.current.width() / 2, y: cyRef.current.height() / 2 }
      });
    }
  };

  const handleZoomOut = () => {
    if (cyRef.current) {
      cyRef.current.zoom({
        level: cyRef.current.zoom() / 1.25,
        renderedPosition: { x: cyRef.current.width() / 2, y: cyRef.current.height() / 2 }
      });
    }
  };

  const handleFit = () => {
    if (cyRef.current) {
      cyRef.current.fit(undefined, 40);
    }
  };

  const handleCenterMain = () => {
    if (!cyRef.current) return;
    if (centralNodeId) {
      const el = cyRef.current.getElementById(centralNodeId);
      if (el.length > 0) {
        cyRef.current.fit(el, 140);
        return;
      }
    }
    cyRef.current.fit(undefined, 40);
  };

  const handleReorganize = () => {
    if (cyRef.current) {
      const layoutOpts: Record<string, any> = {
        name: activeLayout,
        padding: 60,
        animate: true,
        animationDuration: 400,
      };
      if (activeLayout === 'concentric') {
        layoutOpts.concentric = (node: NodeSingular) => node.data('isCentral') === 'yes' ? 10 : 1;
        layoutOpts.levelWidth = () => 1;
      }
      if (activeLayout === 'cose') {
        layoutOpts.idealEdgeLength = () => 120;
        layoutOpts.nodeRepulsion = () => 8000;
        layoutOpts.gravity = 0.5;
      }
      cyRef.current.layout(layoutOpts as any).run();
    }
  };

  return (
    <div style={{
      width: '100%',
      height: isFullscreen ? '100vh' : 600,
      position: isFullscreen ? 'fixed' : 'relative',
      top: isFullscreen ? 0 : 'auto',
      left: isFullscreen ? 0 : 'auto',
      zIndex: isFullscreen ? 9999 : 1,
      background: '#090D16',
      border: '1px solid var(--border-default, #1E293B)',
      borderRadius: isFullscreen ? 0 : 10,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* 2. CONTROLES VISÍVEIS DE GRAFO (TOOLBAR) */}
      <div style={{
        padding: '10px 16px',
        background: '#0F172A',
        borderBottom: '1px solid #1E293B',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 8,
        zIndex: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Network size={16} color="#8B5CF6" />
          <h3 style={{ fontSize: 13, fontWeight: 700, color: '#F8FAFC', margin: 0 }}>
            Grafo de Relacionamentos Cytoscape ({nodes.length} nós · {edges.length} arestas)
          </h3>
        </div>

        {/* Toolbar Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <button
            onClick={handleZoomIn}
            title="Zoom In (+)"
            style={{ background: '#1E293B', border: '1px solid #334155', color: '#FFF', borderRadius: 4, padding: '4px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', fontSize: 11 }}
          >
            <ZoomIn size={14} /> <span style={{ marginLeft: 4 }}>+</span>
          </button>
          <button
            onClick={handleZoomOut}
            title="Zoom Out (-)"
            style={{ background: '#1E293B', border: '1px solid #334155', color: '#FFF', borderRadius: 4, padding: '4px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', fontSize: 11 }}
          >
            <ZoomOut size={14} /> <span style={{ marginLeft: 4 }}>-</span>
          </button>
          <button
            onClick={handleFit}
            title="Ajustar à Tela (Fit)"
            style={{ background: '#1E293B', border: '1px solid #334155', color: '#FFF', borderRadius: 4, padding: '4px 8px', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <RotateCcw size={12} /> Fit
          </button>
          <button
            onClick={handleCenterMain}
            title="Centralizar Nó Principal"
            style={{ background: '#1E293B', border: '1px solid #334155', color: '#FFF', borderRadius: 4, padding: '4px 8px', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <Crosshair size={12} /> Centralizar
          </button>
          <button
            onClick={handleReorganize}
            title="Reorganizar Layout"
            style={{ background: '#1E293B', border: '1px solid #334155', color: '#FFF', borderRadius: 4, padding: '4px 8px', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <RefreshCw size={12} /> Reorganizar
          </button>
          <button
            onClick={() => { if (selectedNode && onExpandNode) onExpandNode(selectedNode); }}
            disabled={!selectedNode}
            title="Expandir Selecionado"
            style={{ background: selectedNode ? '#3B82F6' : '#1E293B', border: '1px solid #334155', color: '#FFF', borderRadius: 4, padding: '4px 8px', fontSize: 11, cursor: selectedNode ? 'pointer' : 'not-allowed', opacity: selectedNode ? 1 : 0.5, display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <Sparkles size={12} /> Expandir
          </button>
          <button
            onClick={() => { if (selectedNode && onCollapseNode) onCollapseNode(selectedNode); }}
            title="Recolher Todos"
            style={{ background: '#1E293B', border: '1px solid #334155', color: '#FFF', borderRadius: 4, padding: '4px 8px', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <Layers size={12} /> Recolher
          </button>
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            title="Tela Cheia"
            style={{ background: '#1E293B', border: '1px solid #334155', color: '#FFF', borderRadius: 4, padding: '4px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
          <select
            value={activeLayout}
            onChange={e => setActiveLayout(e.target.value)}
            style={{ height: 28, fontSize: 10, background: '#1E293B', border: '1px solid #334155', color: '#FFF', borderRadius: 4, padding: '0 4px', cursor: 'pointer' }}
            title="Selecionar layout do grafo"
          >
            <option value="concentric">Força (Central)</option>
            <option value="circle">Radial</option>
            <option value="breadthfirst">Hierárquico</option>
            <option value="grid">Por Vertical</option>
            <option value="cose">Por Comunidade</option>
          </select>
          <button
            onClick={() => setShowLabels(!showLabels)}
            title={showLabels ? 'Ocultar rótulos' : 'Mostrar rótulos'}
            style={{ background: showLabels ? '#3B82F6' : '#1E293B', border: '1px solid #334155', color: '#FFF', borderRadius: 4, padding: '4px 8px', fontSize: 10, cursor: 'pointer' }}
          >
            {showLabels ? 'Rótulos ON' : 'Rótulos OFF'}
          </button>
        </div>
      </div>

      {/* Canvas Cytoscape Container */}
      <div style={{ flex: 1, position: 'relative', width: '100%', overflow: 'hidden' }}>
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

        {/* 9. AÇÕES NOS NÓS (POPUP MENU ON NODE CLICK) */}
        {selectedNode && nodeMenuPos && (
          <div style={{
            position: 'absolute',
            top: Math.min(nodeMenuPos.y, 420),
            left: Math.min(nodeMenuPos.x, 600),
            background: '#0F172A',
            border: '1px solid #3B82F6',
            borderRadius: 8,
            padding: 8,
            zIndex: 100,
            boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
            width: 220,
            fontSize: 11
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 6, marginBottom: 6, borderBottom: '1px solid #1E293B' }}>
              <strong style={{ color: '#FFF', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {selectedNode.label}
              </strong>
              <button onClick={() => setNodeMenuPos(null)} style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}>
                <X size={12} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <button
                onClick={() => { if (onExpandNode) onExpandNode(selectedNode); setNodeMenuPos(null); }}
                style={{ background: '#1E293B', color: '#FFF', border: 'none', borderRadius: 4, padding: '6px 8px', textAlign: 'left', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Sparkles size={12} color="#3B82F6" /> Expandir conexões
              </button>

              <button
                onClick={() => { if (onCollapseNode) onCollapseNode(selectedNode); setNodeMenuPos(null); }}
                style={{ background: '#1E293B', color: '#FFF', border: 'none', borderRadius: 4, padding: '6px 8px', textAlign: 'left', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Layers size={12} color="#F59E0B" /> Recolher conexões
              </button>

              <button
                onClick={() => { if (onSetCentralNode) onSetCentralNode(selectedNode); setNodeMenuPos(null); }}
                style={{ background: '#1E293B', color: '#FFF', border: 'none', borderRadius: 4, padding: '6px 8px', textAlign: 'left', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Crosshair size={12} color="#8B5CF6" /> Definir como central
              </button>

              <button
                onClick={() => { if (onOpenDetail) onOpenDetail(selectedNode); setNodeMenuPos(null); }}
                style={{ background: '#1E293B', color: '#FFF', border: 'none', borderRadius: 4, padding: '6px 8px', textAlign: 'left', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <ExternalLink size={12} color="#22C55E" /> Abrir detalhe
              </button>

              <button
                onClick={() => {
                  if (onSetPathEntity) onSetPathEntity(selectedNode.label, 'A');
                  setNodeMenuPos(null);
                }}
                style={{ background: '#1E293B', color: '#FFF', border: 'none', borderRadius: 4, padding: '6px 8px', textAlign: 'left', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <ArrowRight size={12} color="#EC4899" /> Encontrar caminho a partir daqui
              </button>

              <button
                onClick={() => { if (onHideNode) onHideNode(selectedNode.id); setNodeMenuPos(null); }}
                style={{ background: '#1E293B', color: '#FFF', border: 'none', borderRadius: 4, padding: '6px 8px', textAlign: 'left', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <EyeOff size={12} color="#EF4444" /> Ocultar nó
              </button>

              <button
                onClick={() => { setProvenanceModalNode(selectedNode); setNodeMenuPos(null); }}
                style={{ background: '#1E293B', color: '#FFF', border: 'none', borderRadius: 4, padding: '6px 8px', textAlign: 'left', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Database size={12} color="#06B6D4" /> Mostrar proveniência
              </button>
            </div>
          </div>
        )}

        {/* Provenance Detail Modal */}
        {provenanceModalNode && (
          <div style={{
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            background: '#0F172A', border: '1px solid #06B6D4', borderRadius: 8, padding: 16,
            zIndex: 200, width: 340, boxShadow: '0 12px 36px rgba(0,0,0,0.8)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h4 style={{ fontSize: 13, fontWeight: 700, color: '#FFF', margin: 0 }}>Proveniência e Origem dos Dados</h4>
              <button onClick={() => setProvenanceModalNode(null)} style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}><X size={14} /></button>
            </div>
            <div style={{ fontSize: 11, color: '#CBD5E1', lineHeight: 1.5, background: '#090D16', padding: 10, borderRadius: 6, border: '1px solid #1E293B' }}>
              <div><strong>Entidade:</strong> {provenanceModalNode.label}</div>
              <div><strong>Tipo:</strong> {provenanceModalNode.type}</div>
              <div><strong>Identificador:</strong> {provenanceModalNode.identifier || provenanceModalNode.sub || '—'}</div>
              <div><strong>Fonte Primária:</strong> {provenanceModalNode.source || 'Receita Federal RFB / PNCP / SICAR'}</div>
              <div><strong>Atualizado em:</strong> {provenanceModalNode.updatedAt || '24/07/2026'}</div>
              <div><strong>Schema DB:</strong> wins_agro.core.empresa / engenharia.obras</div>
            </div>
          </div>
        )}

        {/* Floating Legend */}
        <div style={{
          position: 'absolute', bottom: 12, left: 12, background: 'rgba(15,23,42,0.9)',
          padding: '8px 12px', borderRadius: 6, border: '1px solid #1E293B',
          display: 'flex', gap: 12, fontSize: 10, flexWrap: 'wrap', zIndex: 10
        }}>
          <span style={{ color: '#22C55E', fontWeight: 600 }}>── CONFIRMADO</span>
          <span style={{ color: '#06B6D4', fontWeight: 600 }}>- - PROVÁVEL</span>
          <span style={{ color: '#F59E0B', fontWeight: 600 }}>· · · POTENCIAL</span>
        </div>
      </div>
    </div>
  );
});
