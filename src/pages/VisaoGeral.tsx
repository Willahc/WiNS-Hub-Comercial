import React, { useEffect, useState } from 'react';
import { winsApi } from '../services/api';
import type { TimelineItem, VerticalImpact, Opportunity } from '../types';
import { AlertTriangle, TrendingUp, DollarSign, MapPin, Layers } from 'lucide-react';

export const VisaoGeral: React.FC = () => {
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [impacts, setImpacts] = useState<VerticalImpact[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [featured, setFeatured] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [tl, imp, opp, feat] = await Promise.all([
          winsApi.getTimeline(),
          winsApi.getVerticalImpacts(),
          winsApi.getOpportunities(),
          winsApi.getFeaturedEvent()
        ]);
        setTimeline(tl);
        setImpacts(imp);
        setOpportunities(opp.slice(0, 3));
        setFeatured(feat);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Carregando dados consolidados...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="screen-header">
        <div>
          <h1>Visão Geral</h1>
          <p>Métricas consolidadas de inteligência territorial</p>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>
            <AlertTriangle size={18} />
          </div>
          <div className="kpi-label">Eventos Ativos</div>
          <div className="kpi-value">47</div>
          <div className="kpi-change">↑ 12% vs mês anterior</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: 'rgba(139,92,246,0.15)', color: '#8b5cf6' }}>
            <Layers size={18} />
          </div>
          <div className="kpi-label">Empresas Mapeadas</div>
          <div className="kpi-value">1.234</div>
          <div className="kpi-change" style={{ color: '#8b5cf6' }}>↑ 5% no território</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>
            <TrendingUp size={18} />
          </div>
          <div className="kpi-label">Oportunidades Abertas</div>
          <div className="kpi-value">89</div>
          <div className="kpi-change" style={{ color: '#f59e0b' }}>↑ 20% novas demandas</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e' }}>
            <DollarSign size={18} />
          </div>
          <div className="kpi-label">Impacto Total</div>
          <div className="kpi-value">R$ 2.4B</div>
          <div className="kpi-change" style={{ color: '#22c55e' }}>↑ 15% CAPEX monitorado</div>
        </div>
      </div>

      {/* Featured Event Section */}
      {featured && (
        <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: '24px' }}>
          <div className="featured-grid">
            <div className="featured-main">
              <div className="featured-img">
                <div className="overlay-glow"></div>
                <div style={{ color: '#ef4444', textAlign: 'center', zIndex: 1 }}>
                  <AlertTriangle size={48} style={{ margin: '0 auto 10px', display: 'block' }} />
                  <span style={{ fontSize: '18px', fontWeight: 'bold' }}>MAPA DE IMPACTO OPERACIONAL</span>
                </div>
              </div>
              <div className="featured-info">
                <h3>{featured.title}</h3>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px', marginBottom: '14px' }}>
                  {featured.description}
                </p>
                <div className="fi-row">
                  <span className="fi-label">Gravidade</span>
                  <span className="fi-value" style={{ color: '#ef4444' }}>{featured.severity}</span>
                </div>
                <div className="fi-row">
                  <span className="fi-label">Data de Início</span>
                  <span className="fi-value">{featured.startDate}</span>
                </div>
                <div className="fi-row">
                  <span className="fi-label">Município</span>
                  <span className="fi-value">{featured.location}</span>
                </div>
                <div className="fi-row">
                  <span className="fi-label">Empresas Impactadas</span>
                  <span className="fi-value">{featured.companies.join(', ')}</span>
                </div>
              </div>
            </div>
            
            <div className="featured-aside" style={{ padding: '20px' }}>
              <h4 style={{ marginBottom: '12px', fontSize: '14px', fontWeight: '600' }}>Impactos Verticais</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {impacts.map((imp, idx) => (
                  <div key={idx} className="impact-card" style={{ borderLeftColor: imp.color }}>
                    <div className="ic-module" style={{ color: imp.color }}>{imp.module}</div>
                    <div className="ic-value">{imp.value}</div>
                    <div className="ic-detail">{imp.detail}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Grid: Map & Recent Timeline */}
      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Mapa de Cobertura Geográfica</h3>
          </div>
          <div className="map-placeholder">
            <div className="map-grid"></div>
            <div style={{ zIndex: 1, textAlign: 'center', color: 'var(--color-text-secondary)' }}>
              <Layers size={36} style={{ margin: '0 auto 10px', display: 'block', opacity: 0.7 }} />
              <p>Mapeamento de 156 propriedades e 12 obras rodoviárias</p>
              <small>Filtros ativos: SP, BA, CE, PE, MG, RJ</small>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Timeline de Eventos Territoriais</h3>
          </div>
          <div className="timeline">
            {timeline.map((item, idx) => (
              <div key={idx} className="timeline-item">
                <div className="tl-date">{item.date}</div>
                <div className="tl-title">
                  <span style={{ marginRight: '6px' }}>{item.icon}</span>
                  {item.title}
                </div>
                <div className="tl-location">
                  <MapPin size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                  {item.location} • <span style={{ color: 'var(--color-text-tertiary)' }}>Relevância: {item.relevance}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Opportunities List */}
      <div className="card" style={{ marginTop: '16px' }}>
        <div className="card-header">
          <h3 className="card-title">Oportunidades Comerciais Sugeridas</h3>
        </div>
        <div className="grid-3">
          {opportunities.map((opp) => (
            <div key={opp.id} className="opp-card">
              <div className="opp-score">{opp.score}% Recomendação</div>
              <div className="opp-product">{opp.demanda}</div>
              <div className="opp-detail">{opp.local} • {opp.valor}</div>
              <div className="opp-just">{opp.justification}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
