// Official Engineering Works Directory & Dashboard Module
import React, { useEffect, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  Activity,
  ArrowLeft,
  ArrowUpRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Factory,
  Filter,
  HardHat,
  Layers3,
  Map as MapIcon,
  MapPin,
  Search,
  Target,
  TrendingUp,
  Users,
  X,
  Database,
  ShieldAlert,
  Check,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { engineeringService } from "../services/engineering";
import type {
  EngineeringDataset,
  OpportunityStage,
  Sector,
} from "../types/engineering";
import { EngineeringWorksMap } from "./EngineeringWorksMap";
import type { EngineeringMapCluster } from "./EngineeringWorksMap";

const money = (value: number | undefined, compact = true) =>
  value != null
    ? new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        notation: compact ? "compact" : "standard",
        maximumFractionDigits: 1,
      }).format(value)
    : "Valor indisponível";
const statusClass = (status: string) =>
  status === "Em andamento" || status === "Negociação"
    ? "badge-blue"
    : status === "Concluída"
      ? "badge-green"
      : status === "Paralisada"
        ? "badge-red"
        : status === "Proposta"
          ? "badge-purple"
          : "badge-orange";
const Glyph = ({
  icon: Icon,
  size = 17,
}: {
  icon: React.ElementType;
  size?: number;
}) => <Icon size={size} />;

function useEngineeringData() {
  const [data, setData] = useState<EngineeringDataset | null>(null);
  useEffect(() => {
    let active = true;
    engineeringService
      .load()
      .then((value) => active && setData(value))
      .catch(
        (error) =>
          active &&
          setData({
            works: [],
            companies: [],
            opportunities: [],
            meta: {
              source: "API Onda 1",
              partialData: true,
              totalWorks: 0,
              realData: true,
              error:
                error instanceof Error
                  ? error.message
                  : "Falha ao carregar dados reais",
            },
          }),
      );
    return () => {
      active = false;
    };
  }, []);
  return data;
}

const Loading = () => (
  <div className="loading-container">
    <div className="spinner" />
    <p>Consolidando inteligência de engenharia...</p>
  </div>
);
const PageHead = ({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children?: React.ReactNode;
}) => (
  <div className="screen-header engineering-head">
    <div>
      <div className="eyebrow">
        <HardHat size={13} /> WiNS Engenharia
      </div>
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </div>
    {children && <div className="screen-actions">{children}</div>}
  </div>
);
const SourceStrip = ({ data }: { data: EngineeringDataset }) => {
  const meta = data.meta;
  const sourceName = meta?.source || "wins_agro.engenharia.obras";
  const count = (meta?.totalWorks || data.works.length).toLocaleString("pt-BR");
  const updatedAt = meta?.lastUpdatedAt
    ? new Date(meta.lastUpdatedAt).toLocaleString("pt-BR")
    : "Atualização parcial";
  const coverage = meta?.partialData ? "campos parciais" : "completa";

  return (
    <div className="provenance-strip" title="Linha de proveniência dos dados de Engenharia">
      <div className="provenance-item" title="Tabela ou esquema de origem principal">
        <Database size={14} />
        <span>Fonte:</span>
        <strong>{sourceName}</strong>
      </div>
      <div className="provenance-item" title="Quantidade total de obras visíveis">
        <Layers3 size={14} />
        <span>Registros visíveis:</span>
        <strong>{count}</strong>
      </div>
      <div className="provenance-item" title="Data e hora da última sincronização oficial">
        <CalendarDays size={14} />
        <span>Atualização:</span>
        <strong>{updatedAt}</strong>
      </div>
      <div className="provenance-item" title="Status da integridade e completude dos campos">
        {meta?.partialData ? <ShieldAlert size={14} color="#f59e0b" /> : <CheckCircle2 size={14} color="#22c55e" />}
        <span>Cobertura:</span>
        <strong>{coverage}</strong>
      </div>
    </div>
  );
};

const MiniBars = ({
  items,
  total,
  onSelect,
  selectedLabel,
  source,
  updatedAt,
}: {
  items: { label: string; value: number; color: string }[];
  total: number;
  onSelect: (label: string) => void;
  selectedLabel?: string;
  source?: string;
  updatedAt?: string;
}) => (
  <div className="mini-bars">
    {items.map((item) => {
      const isSelected = selectedLabel === item.label;
      const pct = total ? ((item.value / total) * 100).toFixed(1) : "0.0";
      return (
        <button
          type="button"
          className={`mini-bar-row ${isSelected ? "active" : ""}`}
          key={item.label}
          onClick={() => onSelect(item.label)}
          title={`${item.label}: ${item.value.toLocaleString("pt-BR")} obras (${pct}%) · Clique para filtrar · Fonte: ${source || "wins_agro.engenharia.obras"}${updatedAt ? ` · Atualizado: ${new Date(updatedAt).toLocaleString("pt-BR")}` : ""}`}
        >
          <div className="mini-bar-label">
            <span style={{ fontWeight: isSelected ? 700 : 400, color: isSelected ? "#60a5fa" : undefined }}>
              {item.label} {isSelected ? "✓" : ""}
            </span>
            <strong>
              {item.value.toLocaleString("pt-BR")} · {pct}%
            </strong>
          </div>
          <div className="mini-bar-track">
            <i
              style={{
                width: `${total ? Math.max(1.5, Number(pct)) : 0}%`,
                background: item.color,
                boxShadow: isSelected ? `0 0 10px ${item.color}` : undefined,
              }}
            />
          </div>
        </button>
      );
    })}
  </div>
);

export const EngineeringDashboard: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [data, setData] = useState<EngineeringDataset | null>(null);
  const [connections, setConnections] = useState<Awaited<
    ReturnType<typeof engineeringService.getConnections>
  > | null>(null);
  const [retry, setRetry] = useState(0);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Local state for draft filter controls
  const [draftFilters, setDraftFilters] = useState({
    search: params.get("search") || "",
    status: params.get("status") || "",
    phase: params.get("phase") || "",
    sector: params.get("sector") || "",
    municipality: params.get("municipality") || "",
    uf: params.get("uf") || "",
    company: params.get("company") || "",
    investmentMin: params.get("investmentMin") || "",
    investmentMax: params.get("investmentMax") || "",
    periodStart: params.get("periodStart") || "",
    periodEnd: params.get("periodEnd") || "",
    hasSupplier: params.get("hasSupplier") || "",
    hasDecisionMaker: params.get("hasDecisionMaker") || "",
    hasOpportunity: params.get("hasOpportunity") || "",
    capexHomologado: params.get("capex_homologado") || "",
  });

  // Keep draft in sync with URL params if updated via URL navigation
  useEffect(() => {
    setDraftFilters({
      search: params.get("search") || "",
      status: params.get("status") || "",
      phase: params.get("phase") || "",
      sector: params.get("sector") || "",
      municipality: params.get("municipality") || "",
      uf: params.get("uf") || "",
      company: params.get("company") || "",
      investmentMin: params.get("investmentMin") || "",
      investmentMax: params.get("investmentMax") || "",
      periodStart: params.get("periodStart") || "",
      periodEnd: params.get("periodEnd") || "",
      hasSupplier: params.get("hasSupplier") || "",
      hasDecisionMaker: params.get("hasDecisionMaker") || "",
      hasOpportunity: params.get("hasOpportunity") || "",
      capexHomologado: params.get("capex_homologado") || "",
    });
  }, [params.toString()]);

  const activeFiltersCount = Object.values(draftFilters).filter((v) => Boolean(v)).length;

  const advancedActiveCount = [
    draftFilters.sector,
    draftFilters.company,
    draftFilters.investmentMin,
    draftFilters.investmentMax,
    draftFilters.periodStart,
    draftFilters.periodEnd,
    draftFilters.hasSupplier,
    draftFilters.hasDecisionMaker,
    draftFilters.hasOpportunity,
    draftFilters.capexHomologado,
  ].filter((v) => Boolean(v)).length;

  const filters = {
    search: params.get("search") || undefined,
    status: params.get("status") || undefined,
    phase: params.get("phase") || undefined,
    sector: params.get("sector") || undefined,
    municipality: params.get("municipality") || undefined,
    uf: params.get("uf") || undefined,
    company: params.get("company") || undefined,
    investmentMin: params.get("investmentMin") ? Number(params.get("investmentMin")) : undefined,
    investmentMax: params.get("investmentMax") ? Number(params.get("investmentMax")) : undefined,
    periodStart: params.get("periodStart") || undefined,
    periodEnd: params.get("periodEnd") || undefined,
    hasSupplier: params.has("hasSupplier") ? params.get("hasSupplier") === "true" : undefined,
    hasDecisionMaker: params.has("hasDecisionMaker") ? params.get("hasDecisionMaker") === "true" : undefined,
    hasOpportunity: params.has("hasOpportunity") ? params.get("hasOpportunity") === "true" : undefined,
    capexHomologado: params.has("capex_homologado") ? params.get("capex_homologado") === "true" : undefined,
  };

  useEffect(() => {
    let active = true;
    engineeringService
      .load({ ...filters, page: 1, pageSize: 25 })
      .then((x) => active && setData(x))
      .catch((error) =>
        active &&
        setData({
          works: [],
          companies: [],
          opportunities: [],
          meta: {
            source: "wins_agro.engenharia.obras",
            partialData: true,
            totalWorks: 0,
            realData: true,
            error: error instanceof Error ? error.message : "Falha na API real",
          },
        })
      );
    return () => {
      active = false;
    };
  }, [params.toString(), retry]);

  useEffect(() => {
    if (!data) return;
    let active = true;
    engineeringService
      .getConnections({
        search: filters.search,
        status: filters.status,
        phase: filters.phase,
        sector: filters.sector,
        municipality: filters.municipality,
        uf: filters.uf,
        company: filters.company,
        has_opportunity: filters.hasOpportunity,
        capex_homologado: filters.capexHomologado,
      })
      .then((x) => active && setConnections(x))
      .catch(() => active && setConnections(null));
    return () => {
      active = false;
    };
  }, [params.toString(), retry, data?.meta?.lastUpdatedAt]);

  if (!data) return <Loading />;
  if (data.meta?.error)
    return (
      <div className="engineering-page">
        <SourceStrip data={data} />
        <div className="empty-state error">
          <HardHat size={42} />
          <h3>API indisponível</h3>
          <p>{data.meta.error}</p>
          <button className="btn btn-primary" onClick={() => setRetry((x) => x + 1)}>
            Tentar novamente
          </button>
        </div>
      </div>
    );

  const a = data.meta?.aggregates;
  if (!a) return <Loading />;

  const statuses = a.statusCounts.map((x, i) => ({
    ...x,
    color: ["#3b82f6", "#f59e0b", "#22c55e", "#ef4444"][i % 4],
  }));
  const phases = a.phaseCounts.map((x, i) => ({
    ...x,
    color: ["#64748b", "#a855f7", "#06b6d4", "#3b82f6", "#22c55e"][i % 5],
  }));

  const handleApplyFilters = () => {
    const next = new URLSearchParams();
    if (draftFilters.search.trim()) next.set("search", draftFilters.search.trim());
    if (draftFilters.status) next.set("status", draftFilters.status);
    if (draftFilters.phase) next.set("phase", draftFilters.phase);
    if (draftFilters.sector) next.set("sector", draftFilters.sector);
    if (draftFilters.municipality.trim()) next.set("municipality", draftFilters.municipality.trim());
    if (draftFilters.uf) next.set("uf", draftFilters.uf.toUpperCase());
    if (draftFilters.company.trim()) next.set("company", draftFilters.company.trim());
    if (draftFilters.investmentMin) next.set("investmentMin", draftFilters.investmentMin);
    if (draftFilters.investmentMax) next.set("investmentMax", draftFilters.investmentMax);
    if (draftFilters.periodStart) next.set("periodStart", draftFilters.periodStart);
    if (draftFilters.periodEnd) next.set("periodEnd", draftFilters.periodEnd);
    if (draftFilters.hasSupplier) next.set("hasSupplier", draftFilters.hasSupplier);
    if (draftFilters.hasDecisionMaker) next.set("hasDecisionMaker", draftFilters.hasDecisionMaker);
    if (draftFilters.hasOpportunity) next.set("hasOpportunity", draftFilters.hasOpportunity);
    if (draftFilters.capexHomologado) next.set("capex_homologado", draftFilters.capexHomologado);
    setParams(next);
  };

  const handleClearFilters = () => {
    setDraftFilters({
      search: "",
      status: "",
      phase: "",
      sector: "",
      municipality: "",
      uf: "",
      company: "",
      investmentMin: "",
      investmentMax: "",
      periodStart: "",
      periodEnd: "",
      hasSupplier: "",
      hasDecisionMaker: "",
      hasOpportunity: "",
      capexHomologado: "",
    });
    setParams(new URLSearchParams());
  };

  const updateDraft = (key: string, val: string) => {
    setDraftFilters((prev) => ({ ...prev, [key]: val }));
  };

  const worksUrl = (extra: Record<string, string> = {}) => {
    const next = new URLSearchParams(params);
    Object.entries(extra).forEach(([k, v]) => next.set(k, v));
    return `/engenharia/obras?${next}`;
  };

  const ufsList = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];
  const sectorsList = ["Energia", "Transporte", "Saneamento", "Imobiliário", "Infraestrutura Urbana", "Industrial"];

  // Top items for Executive Prioritization using real data
  const topCapexWorks = [...data.works]
    .filter((w) => w.investment != null)
    .sort((a, b) => (b.investment || 0) - (a.investment || 0))
    .slice(0, 5);

  const topOpportunities = [...data.opportunities]
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, 5);

  const attentionWorks = [...data.works]
    .filter((w) => w.investment == null || !w.investmentHomologated)
    .slice(0, 5);

  return (
    <div className="engineering-page">
      <SourceStrip data={data} />
      
      <PageHead
        title="Dashboard de Engenharia"
        subtitle="Panorama executivo de obras, territórios e oportunidades em monitoramento"
      >
        <Link className="btn btn-outline" to="/engenharia/fornecedores">
          Fornecedores
        </Link>
        <Link className="btn btn-outline" to="/engenharia/decisores">
          Decisores
        </Link>
        <Link className="btn btn-outline" to={worksUrl()}>
          Ver obras
        </Link>
        <Link className="btn btn-primary" to={`/engenharia/mapa?${params}`}>
          <MapIcon size={15} /> Explorar mapa
        </Link>
      </PageHead>

      {/* PAINEL DE FILTROS RESPONSIVO E ESTRUTURADO */}
      <div className="filter-panel">
        {/* FILTROS BÁSICOS SEMPRE VISÍVEIS */}
        <div className="filter-grid-basic">
          <div className="filter-field field-search">
            <label htmlFor="filter-search">Busca Geral</label>
            <input
              id="filter-search"
              value={draftFilters.search}
              onChange={(e) => updateDraft("search", e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleApplyFilters();
              }}
              placeholder="Buscar obra ou empresa..."
            />
          </div>

          <div className="filter-field">
            <label htmlFor="filter-status">Status</label>
            <select
              id="filter-status"
              value={draftFilters.status}
              onChange={(e) => updateDraft("status", e.target.value)}
            >
              <option value="">Todos os status</option>
              <option value="Em andamento">Em andamento</option>
              <option value="Prevista">Prevista</option>
              <option value="Concluída">Concluída</option>
              <option value="Paralisada">Paralisada</option>
            </select>
          </div>

          <div className="filter-field">
            <label htmlFor="filter-phase">Fase</label>
            <select
              id="filter-phase"
              value={draftFilters.phase}
              onChange={(e) => updateDraft("phase", e.target.value)}
            >
              <option value="">Todas as fases</option>
              <option value="Projeto">Projeto</option>
              <option value="Licenciamento">Licenciamento</option>
              <option value="Mobilização">Mobilização</option>
              <option value="Execução">Execução</option>
              <option value="Entrega">Entrega</option>
            </select>
          </div>

          <div className="filter-field">
            <label htmlFor="filter-uf">UF</label>
            <select
              id="filter-uf"
              value={draftFilters.uf}
              onChange={(e) => updateDraft("uf", e.target.value)}
            >
              <option value="">Todas as UFs</option>
              {ufsList.map((uf) => (
                <option key={uf} value={uf}>{uf}</option>
              ))}
            </select>
          </div>

          <div className="filter-field">
            <label htmlFor="filter-municipality">Município</label>
            <input
              id="filter-municipality"
              value={draftFilters.municipality}
              onChange={(e) => updateDraft("municipality", e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleApplyFilters();
              }}
              placeholder="Nome do município"
            />
          </div>
        </div>

        {/* FILTROS AVANÇADOS EXPANSÍVEIS */}
        {showAdvanced && (
          <div className="filter-grid-advanced">
            <div className="filter-field">
              <label htmlFor="filter-sector">Setor</label>
              <select
                id="filter-sector"
                value={draftFilters.sector}
                onChange={(e) => updateDraft("sector", e.target.value)}
              >
                <option value="">Todos os setores</option>
                {sectorsList.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div className="filter-field">
              <label htmlFor="filter-company">Empresa / CNPJ</label>
              <input
                id="filter-company"
                value={draftFilters.company}
                onChange={(e) => updateDraft("company", e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleApplyFilters();
                }}
                placeholder="Razão social ou CNPJ"
              />
            </div>

            <div className="filter-field">
              <label htmlFor="filter-inv-min">CAPEX Mín. (R$)</label>
              <input
                id="filter-inv-min"
                type="number"
                min="0"
                value={draftFilters.investmentMin}
                onChange={(e) => updateDraft("investmentMin", e.target.value)}
                placeholder="R$ Mín."
              />
            </div>

            <div className="filter-field">
              <label htmlFor="filter-inv-max">CAPEX Máx. (R$)</label>
              <input
                id="filter-inv-max"
                type="number"
                min="0"
                value={draftFilters.investmentMax}
                onChange={(e) => updateDraft("investmentMax", e.target.value)}
                placeholder="R$ Máx."
              />
            </div>

            <div className="filter-field">
              <label htmlFor="filter-period-start">Início Período</label>
              <input
                id="filter-period-start"
                type="date"
                value={draftFilters.periodStart}
                onChange={(e) => updateDraft("periodStart", e.target.value)}
              />
            </div>

            <div className="filter-field">
              <label htmlFor="filter-period-end">Fim Período</label>
              <input
                id="filter-period-end"
                type="date"
                value={draftFilters.periodEnd}
                onChange={(e) => updateDraft("periodEnd", e.target.value)}
              />
            </div>

            <div className="filter-field">
              <label htmlFor="filter-has-supplier">Fornecedor</label>
              <select
                id="filter-has-supplier"
                value={draftFilters.hasSupplier}
                onChange={(e) => updateDraft("hasSupplier", e.target.value)}
              >
                <option value="">Fornecedor: todos</option>
                <option value="true">Com fornecedor</option>
                <option value="false">Sem fornecedor</option>
              </select>
            </div>

            <div className="filter-field">
              <label htmlFor="filter-has-decisionmaker">Decisor</label>
              <select
                id="filter-has-decisionmaker"
                value={draftFilters.hasDecisionMaker}
                onChange={(e) => updateDraft("hasDecisionMaker", e.target.value)}
              >
                <option value="">Decisor: todos</option>
                <option value="true">Com decisor</option>
                <option value="false">Sem decisor</option>
              </select>
            </div>

            <div className="filter-field">
              <label htmlFor="filter-has-opportunity">Oportunidade</label>
              <select
                id="filter-has-opportunity"
                value={draftFilters.hasOpportunity}
                onChange={(e) => updateDraft("hasOpportunity", e.target.value)}
              >
                <option value="">Oportunidade: todas</option>
                <option value="true">Com oportunidade</option>
                <option value="false">Sem oportunidade</option>
              </select>
            </div>

            <div className="filter-field">
              <label htmlFor="filter-capex-homologado">CAPEX Homologado</label>
              <select
                id="filter-capex-homologado"
                value={draftFilters.capexHomologado}
                onChange={(e) => updateDraft("capex_homologado", e.target.value)}
              >
                <option value="">CAPEX: todos</option>
                <option value="true">Homologado</option>
                <option value="false">Não homologado</option>
              </select>
            </div>
          </div>
        )}

        {/* ÁREA PRÓPRIA PARA BOTÕES E BADGE */}
        <div className="filter-actions">
          <div className="filter-active-badge">
            <Filter size={12} style={{ display: "inline", marginRight: 5 }} />
            {activeFiltersCount > 0 ? `${activeFiltersCount} filtro(s) ativo(s)` : "Nenhum filtro aplicado"}
          </div>

          <div className="filter-actions-right">
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              <Filter size={13} />
              {showAdvanced ? "Ocultar avançados" : "Filtros avançados"}
              {advancedActiveCount > 0 ? ` (${advancedActiveCount})` : ""}
              {showAdvanced ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>

            {activeFiltersCount > 0 && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={handleClearFilters}
              >
                <X size={13} /> Limpar
              </button>
            )}

            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleApplyFilters}
            >
              <Check size={13} /> Aplicar filtros
            </button>
          </div>
        </div>
      </div>

      {/* KPIS DE ENGENHARIA E OPORTUNIDADES RECONCILIADAS */}
      <div className="reconciled-kpi-grid">
        <Link to={worksUrl()} className="reconciled-kpi-card" title="Recorte total de obras filtradas no universo">
          <div className="reconciled-kpi-header">
            <span>TOTAL DE OBRAS</span>
            <HardHat size={16} />
          </div>
          <div className="reconciled-kpi-value">{a.worksTotal.toLocaleString("pt-BR")}</div>
          <div className="reconciled-kpi-def">Universo total de obras em monitoramento</div>
          <div className="reconciled-kpi-coverage">100% da base homologada <ArrowUpRight size={11} /></div>
        </Link>

        <Link to={worksUrl({ status: "Em andamento" })} className="reconciled-kpi-card" title="Obras com status em andamento">
          <div className="reconciled-kpi-header">
            <span>EM ANDAMENTO</span>
            <Activity size={16} />
          </div>
          <div className="reconciled-kpi-value">
            {(a.statusCounts.find((x) => x.label === "Em andamento")?.value || 0).toLocaleString("pt-BR")}
          </div>
          <div className="reconciled-kpi-def">Obras ativas em fase de execução/mobilização</div>
          <div className="reconciled-kpi-coverage">Filtro server-side ativo <ArrowUpRight size={11} /></div>
        </Link>

        <Link to={worksUrl({ status: "Prevista" })} className="reconciled-kpi-card" title="Obras com status prevista">
          <div className="reconciled-kpi-header">
            <span>OBRAS PREVISTAS</span>
            <CalendarDays size={16} />
          </div>
          <div className="reconciled-kpi-value">
            {(a.statusCounts.find((x) => x.label === "Prevista")?.value || 0).toLocaleString("pt-BR")}
          </div>
          <div className="reconciled-kpi-def">Obras em projeto ou planejamento inicial</div>
          <div className="reconciled-kpi-coverage">Filtro server-side ativo <ArrowUpRight size={11} /></div>
        </Link>

        <Link to={worksUrl({ capex_homologado: "true" })} className="reconciled-kpi-card" title="Soma total dos investimentos com capex homologado">
          <div className="reconciled-kpi-header">
            <span>INVESTIMENTO HOMOLOGADO</span>
            <CircleDollarSign size={16} />
          </div>
          <div className="reconciled-kpi-value">
            {a.investmentStatus === "unavailable" ? "Não homologado" : money(a.investmentTotal)}
          </div>
          <div className="reconciled-kpi-def">
            {a.investmentRecordsCount.toLocaleString("pt-BR")} obras com CAPEX homologado ({a.financialCoveragePct.toLocaleString("pt-BR")}% do recorte)
          </div>
          <div className="reconciled-kpi-coverage">{a.investmentMissingCount + a.investmentUnhomologatedCount} obras sem CAPEX <ArrowUpRight size={11} /></div>
        </Link>

        <Link to={worksUrl({ hasOpportunity: "true" })} className="reconciled-kpi-card" title="Base nacional de oportunidades ativas (score >= 70)">
          <div className="reconciled-kpi-header">
            <span>OPORTUNIDADES ATIVAS (GLOBAL)</span>
            <Target size={16} />
          </div>
          <div className="reconciled-kpi-value">
            {a.opportunities.opportunitiesActiveTotal.toLocaleString("pt-BR")}
          </div>
          <div className="reconciled-kpi-def">Base nacional deduplicada com score &ge; 70</div>
          <div className="reconciled-kpi-coverage">1.314.135 matches brutos totais <ArrowUpRight size={11} /></div>
        </Link>

        <Link to={worksUrl({ hasOpportunity: "true" })} className="reconciled-kpi-card" title="Oportunidades ativas vinculadas às obras deste recorte">
          <div className="reconciled-kpi-header">
            <span>OPORTUNIDADES NO RECORTE</span>
            <TrendingUp size={16} />
          </div>
          <div className="reconciled-kpi-value">
            {a.opportunities.opportunitiesLinked.toLocaleString("pt-BR")}
          </div>
          <div className="reconciled-kpi-def">
            {a.opportunities.worksWithOpportunity.toLocaleString("pt-BR")} obras com oportunidade no filtro
          </div>
          <div className="reconciled-kpi-coverage">{a.opportunities.worksWithoutOpportunity.toLocaleString("pt-BR")} obras sem oportunidade <ArrowUpRight size={11} /></div>
        </Link>

        <Link to={`/territorial?vertical=engenharia&${params}`} className="reconciled-kpi-card" title="Total de municípios com obras no recorte">
          <div className="reconciled-kpi-header">
            <span>MUNICÍPIOS</span>
            <MapPin size={16} />
          </div>
          <div className="reconciled-kpi-value">{a.municipalityCount.toLocaleString("pt-BR")}</div>
          <div className="reconciled-kpi-def">Municípios mapeados na fonte oficial</div>
          <div className="reconciled-kpi-coverage">{a.missingMunicipalityCount} sem município informado <ArrowUpRight size={11} /></div>
        </Link>

        <Link to={`/engenharia/empresas?${params}`} className="reconciled-kpi-card" title="Total de empresas associadas no recorte">
          <div className="reconciled-kpi-header">
            <span>EMPRESAS</span>
            <Building2 size={16} />
          </div>
          <div className="reconciled-kpi-value">{a.companyCount.toLocaleString("pt-BR")}</div>
          <div className="reconciled-kpi-def">Empresas proprietárias ou executoras das obras</div>
          <div className="reconciled-kpi-coverage">{a.missingCompanyCount} sem empresa informada <ArrowUpRight size={11} /></div>
        </Link>
      </div>

      {/* ANÁLISE GRÁFICA & TERRITORIAL */}
      <div className="engineering-analytics">
        <section className="card chart-card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Obras por status</h3>
              <p className="card-subtitle">Distribuição proporcional · clique para filtrar</p>
            </div>
            <span className="metric-chip">{a.worksTotal.toLocaleString("pt-BR")} obras</span>
          </div>
          <MiniBars
            items={statuses}
            total={a.worksTotal}
            selectedLabel={filters.status}
            onSelect={(label) => navigate(worksUrl({ status: filters.status === label ? "" : label }))}
            source={data.meta?.source}
            updatedAt={data.meta?.lastUpdatedAt}
          />
        </section>

        <section className="card chart-card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Obras por fase</h3>
              <p className="card-subtitle">Distribuição por estágio · clique para filtrar</p>
            </div>
            <Layers3 size={18} />
          </div>
          <MiniBars
            items={phases}
            total={a.worksTotal}
            selectedLabel={filters.phase}
            onSelect={(label) => navigate(worksUrl({ phase: filters.phase === label ? "" : label }))}
            source={data.meta?.source}
            updatedAt={data.meta?.lastUpdatedAt}
          />
        </section>

        <section className="card territory-card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Resumo territorial</h3>
              <p className="card-subtitle">Principais municípios por volume de obras</p>
            </div>
            <MapPin size={18} />
          </div>
          <div className="territory-list">
            {a.territories.map((t) => (
              <Link
                key={`${t.municipality}-${t.uf}`}
                to={`/territorial?municipality=${encodeURIComponent(t.municipality)}&uf=${t.uf}&vertical=engenharia`}
              >
                <span>
                  <i />
                  {t.municipality}/{t.uf}
                </span>
                <strong>
                  {t.investmentTotal != null ? money(t.investmentTotal) : "Valor não homologado"}
                </strong>
                <small>
                  {t.worksCount} obras · {t.companyCount} empresas · {t.opportunityCount} oportunidades
                </small>
              </Link>
            ))}
          </div>
        </section>
      </div>

      {/* CONEXÕES DA CARTEIRA RECONCILIADAS */}
      <section className="card priority-card" style={{ marginTop: 16 }}>
        <div className="card-header">
          <div>
            <h3 className="card-title">Conexões desta carteira</h3>
            <p className="card-subtitle">
              CNPJ idêntico é CONFIRMADO (100%); coincidência territorial é POTENCIAL (40%)
            </p>
          </div>
          <Link to={`/relacionamentos?vertical=engenharia&${params}`}>
            Ver relacionamentos <ChevronRight size={14} />
          </Link>
        </div>

        {connections ? (
          <>
            <div className="reconciled-kpi-grid" style={{ marginBottom: 16 }}>
              <div className="reconciled-kpi-card">
                <div className="reconciled-kpi-header">
                  <span>EMPRESAS MULTIVERTIICAIS</span>
                  <Building2 size={15} />
                </div>
                <div className="reconciled-kpi-value">
                  {connections.kpis.multiverticalCompanies.toLocaleString("pt-BR")}
                </div>
                <div className="reconciled-kpi-def">Empresas presentes em mais de uma vertical</div>
              </div>

              <div className="reconciled-kpi-card">
                <div className="reconciled-kpi-header">
                  <span>FORNECEDORES MULTIVERTIICAIS</span>
                  <Users size={15} />
                </div>
                <div className="reconciled-kpi-value">
                  {connections.kpis.multiverticalSuppliers.toLocaleString("pt-BR")}
                </div>
                <div className="reconciled-kpi-def">Fornecedores com correspondência cruzada</div>
              </div>

              <div className="reconciled-kpi-card">
                <div className="reconciled-kpi-header">
                  <span>MUNICÍPIOS (4 VERTICAIS)</span>
                  <MapPin size={15} />
                </div>
                <div className="reconciled-kpi-value">
                  {connections.kpis.fourVerticalMunicipalities.toLocaleString("pt-BR")}
                </div>
                <div className="reconciled-kpi-def">Municípios presentes nas 4 verticais oficiais</div>
              </div>

              <div className="reconciled-kpi-card">
                <div className="reconciled-kpi-header">
                  <span>OPORTUNIDADES TRANSVERSAIS</span>
                  <Target size={15} />
                </div>
                <div className="reconciled-kpi-value">
                  {connections.kpis.transversalOpportunities.toLocaleString("pt-BR")}
                </div>
                <div className="reconciled-kpi-def">Oportunidades geradas por fornecedores multiverticais</div>
              </div>

              <div className="reconciled-kpi-card">
                <div className="reconciled-kpi-header">
                  <span>RELAÇÕES CONFIRMADAS</span>
                  <CheckCircle2 size={15} color="#22c55e" />
                </div>
                <div className="reconciled-kpi-value">
                  {connections.kpis.confirmedRelations.toLocaleString("pt-BR")}
                </div>
                <div className="reconciled-kpi-def">Vínculos por CNPJ idêntico nas duas fontes</div>
              </div>

              <div className="reconciled-kpi-card">
                <div className="reconciled-kpi-header">
                  <span>RELAÇÕES POTENCIAIS</span>
                  <Clock3 size={15} color="#f59e0b" />
                </div>
                <div className="reconciled-kpi-value">
                  {connections.kpis.potentialRelations.toLocaleString("pt-BR")}
                </div>
                <div className="reconciled-kpi-def">Vínculos por coincidência territorial homologada</div>
              </div>
            </div>

            {/* CARDS DE CONEXÃO SEM SOBREPOSIÇÃO VISUAL */}
            <div className="reconciled-connection-grid">
              {connections.relations.slice(0, 8).map((r) => (
                <div className="reconciled-connection-card" key={`${r.vertical}-${r.cnpj}`}>
                  <div className="reconciled-connection-header">
                    <span className={`badge ${r.classification === "CONFIRMADO" ? "badge-green" : "badge-orange"}`}>
                      {r.classification}
                    </span>
                    <span className="metric-chip">Confiança: {r.confidence}%</span>
                  </div>

                  <div className="reconciled-connection-title">
                    <strong title={r.name}>{r.name}</strong>
                    <small>CNPJ: {r.cnpj} · Engenharia + {r.vertical.toUpperCase()}</small>
                  </div>

                  <div className="reconciled-connection-metrics">
                    <div>
                      <span>Obras</span>
                      <strong>{r.worksCount}</strong>
                    </div>
                    <div>
                      <span>Oportunidades</span>
                      <strong>{r.opportunitiesCount}</strong>
                    </div>
                    <div>
                      <span>Vínculo</span>
                      <strong style={{ fontSize: 10 }}>CNPJ Direct</strong>
                    </div>
                    <div>
                      <span>Origem</span>
                      <strong style={{ fontSize: 10 }}>{r.vertical}</strong>
                    </div>
                  </div>

                  <div className="reconciled-connection-footer">
                    <span title={r.rule}>{r.source}</span>
                    <Link to={r.company360Url} className="btn btn-outline btn-sm">
                      Abrir Empresa 360° <ArrowUpRight size={12} />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <Loading />
        )}
      </section>

      {/* BLOCO DE PRIORIZAÇÃO EXECUTIVA (APENAS DADOS HOMOLOGADOS REAIS) */}
      <section className="card priority-card" style={{ marginTop: 16 }}>
        <div className="card-header">
          <div>
            <h3 className="card-title">Priorização Executiva</h3>
            <p className="card-subtitle">
              Rankings e destaques operacionais baseados exclusivamente nos dados homologados
            </p>
          </div>
          <Target size={18} />
        </div>

        <div className="executive-prioritization-grid">
          {/* PAINEL 1: OBRAS DE MAIOR CAPEX */}
          <div className="executive-panel">
            <div className="executive-panel-header">
              <CircleDollarSign size={16} color="#3b82f6" />
              <h4>Maiores Investimentos (CAPEX)</h4>
            </div>
            <div className="executive-panel-list">
              {topCapexWorks.map((w) => (
                <Link to={`/engenharia/obras/${w.id}`} key={w.id} className="executive-item">
                  <div className="executive-item-info">
                    <strong title={w.name}>{w.name}</strong>
                    <small>{w.municipality}/{w.state} · {w.status || "Status não informado"}</small>
                  </div>
                  <div className="executive-item-val">{money(w.investment)}</div>
                </Link>
              ))}
            </div>
          </div>

          {/* PAINEL 2: OPORTUNIDADES DE MAIOR ADERÊNCIA */}
          <div className="executive-panel">
            <div className="executive-panel-header">
              <Target size={16} color="#22c55e" />
              <h4>Oportunidades de Maior Score</h4>
            </div>
            <div className="executive-panel-list">
              {topOpportunities.map((o) => (
                <Link to={worksUrl({ hasOpportunity: "true" })} key={o.id} className="executive-item">
                  <div className="executive-item-info">
                    <strong title={o.title}>{o.title}</strong>
                    <small>{o.sector || "Engenharia"} · {o.municipality}</small>
                  </div>
                  <div className="executive-item-val" style={{ color: "#22c55e" }}>Score {o.score}</div>
                </Link>
              ))}
            </div>
          </div>

          {/* PAINEL 3: PRINCIPAIS MUNICÍPIOS */}
          <div className="executive-panel">
            <div className="executive-panel-header">
              <MapPin size={16} color="#a855f7" />
              <h4>Municípios de Maior Concentração</h4>
            </div>
            <div className="executive-panel-list">
              {a.territories.slice(0, 5).map((t) => (
                <Link
                  to={`/territorial?municipality=${encodeURIComponent(t.municipality)}&uf=${t.uf}&vertical=engenharia`}
                  key={`${t.municipality}-${t.uf}`}
                  className="executive-item"
                >
                  <div className="executive-item-info">
                    <strong>{t.municipality}/{t.uf}</strong>
                    <small>{t.companyCount} empresas · {t.opportunityCount} oportunidades</small>
                  </div>
                  <div className="executive-item-val" style={{ color: "#a855f7" }}>{t.worksCount} obras</div>
                </Link>
              ))}
            </div>
          </div>

          {/* PAINEL 4: OBRAS QUE EXIGEM ATENÇÃO */}
          <div className="executive-panel">
            <div className="executive-panel-header">
              <ShieldAlert size={16} color="#f59e0b" />
              <h4>Itens que Exigem Atenção</h4>
            </div>
            <div className="executive-panel-list">
              {attentionWorks.map((w) => (
                <Link to={`/engenharia/obras/${w.id}`} key={w.id} className="executive-item">
                  <div className="executive-item-info">
                    <strong title={w.name}>{w.name}</strong>
                    <small>{w.municipality}/{w.state} · {!w.investmentHomologated ? "Sem CAPEX homologado" : "Pendente"}</small>
                  </div>
                  <div className="executive-item-val" style={{ color: "#f59e0b" }}>Pendente</div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export const EngineeringMap: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const [mapData, setMapData] = useState<Awaited<
    ReturnType<typeof engineeringService.getMap>
  > | null>(null);
  const [selected, setSelected] = useState<EngineeringMapCluster>();
  const [error, setError] = useState("");
  const [layers, setLayers] = useState<string[]>([
    "works",
    "companies",
    "suppliers",
    "opportunities",
  ]);
  const [viewport, setViewport] = useState({
    min_lat: Number(params.get("min_lat")) || -35.5,
    max_lat: Number(params.get("max_lat")) || 6.5,
    min_lng: Number(params.get("min_lng")) || -75.5,
    max_lng: Number(params.get("max_lng")) || -32,
    zoom: Number(params.get("zoom")) || 4,
  });
  const patch = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    value ? next.set(key, value) : next.delete(key);
    setParams(next);
  };
  useEffect(() => {
    let active = true;
    setError("");
    const timer = window.setTimeout(
      () =>
        engineeringService
          .getMap({
            ...viewport,
            layers: layers.join(","),
            search: params.get("search") || undefined,
            municipality: params.get("municipality") || undefined,
            uf: params.get("uf") || undefined,
            status: params.get("status") || undefined,
            phase: params.get("phase") || undefined,
            sector: params.get("sector") || undefined,
            company: params.get("company") || undefined,
            has_opportunity: params.has("hasOpportunity")
              ? params.get("hasOpportunity") === "true"
              : undefined,
            capex_homologado: params.has("capex_homologado")
              ? params.get("capex_homologado") === "true"
              : undefined,
          })
          .then((x) => active && setMapData(x))
          .catch(
            (e) =>
              active &&
              setError(e instanceof Error ? e.message : "Falha no mapa real"),
          ),
      300,
    );
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [
    params.toString(),
    layers.join(","),
    viewport.min_lat,
    viewport.max_lat,
    viewport.min_lng,
    viewport.max_lng,
    viewport.zoom,
  ]);
  const changeViewport = (v: typeof viewport) => {
    setViewport(v);
    const next = new URLSearchParams(params);
    Object.entries(v).forEach(([k, value]) =>
      next.set(k, String(Number(value).toFixed(k === "zoom" ? 0 : 4))),
    );
    setParams(next, { replace: true });
  };
  const choose = (cluster: EngineeringMapCluster) => {
    setSelected(cluster);
    const next = new URLSearchParams(params);
    next.set("cluster_lat", String(cluster.latitude));
    next.set("cluster_lng", String(cluster.longitude));
    next.set("layer", cluster.layer);
    if (cluster.municipality_count === 1) {
      next.set("municipality", cluster.municipality);
      next.set("uf", cluster.uf);
    }
    setParams(next);
  };
  const toggle = (layer: string) =>
    setLayers((current) =>
      current.includes(layer)
        ? current.filter((x) => x !== layer)
        : [...current, layer],
    );
  return (
    <div className="engineering-page">
      <PageHead
        title="Mapa de Engenharia"
        subtitle="Universo completo agregado por viewport e zoom"
      >
        <Link className="btn btn-outline" to={`/engenharia?${params}`}>
          <Activity size={15} /> Dashboard
        </Link>
        <Link className="btn btn-outline" to={`/engenharia/obras?${params}`}>
          <Layers3 size={15} /> Lista de obras
        </Link>
      </PageHead>
      <div className="map-filterbar">
        <Filter size={15} />
        <input
          aria-label="Filtrar município"
          value={params.get("municipality") || ""}
          onChange={(e) => patch("municipality", e.target.value)}
          placeholder="Município"
        />
        <input
          aria-label="Filtrar UF"
          maxLength={2}
          value={params.get("uf") || ""}
          onChange={(e) => patch("uf", e.target.value.toUpperCase())}
          placeholder="UF"
        />
        <select
          aria-label="Filtrar status"
          value={params.get("status") || ""}
          onChange={(e) => patch("status", e.target.value)}
        >
          <option value="">Todos os status</option>
          {["Em andamento", "Prevista", "Concluída", "Paralisada"].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
        <select
          aria-label="Filtrar fase"
          value={params.get("phase") || ""}
          onChange={(e) => patch("phase", e.target.value)}
        >
          <option value="">Todas as fases</option>
          {[
            "Projeto",
            "Licenciamento",
            "Mobilização",
            "Execução",
            "Entrega",
          ].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
        <input
          aria-label="Filtrar empresa"
          value={params.get("company") || ""}
          onChange={(e) => patch("company", e.target.value)}
          placeholder="Empresa ou CNPJ"
        />
        <select
          aria-label="Filtro oportunidade"
          value={params.get("hasOpportunity") || ""}
          onChange={(e) => patch("hasOpportunity", e.target.value)}
        >
          <option value="">Oportunidade: todas</option>
          <option value="true">Com oportunidade</option>
          <option value="false">Sem oportunidade</option>
        </select>
        <select
          aria-label="Filtro CAPEX"
          value={params.get("capex_homologado") || ""}
          onChange={(e) => patch("capex_homologado", e.target.value)}
        >
          <option value="">CAPEX: todos</option>
          <option value="true">CAPEX homologado</option>
          <option value="false">Sem CAPEX homologado</option>
        </select>
        <span className="map-count">
          {mapData
            ? `${mapData.totals.works?.toLocaleString("pt-BR") || 0} obras · sem amostragem · ${mapData.strategy}`
            : "Carregando recorte..."}
        </span>
      </div>
      <div className="map-filterbar">
        {(
          [
            ["works", "Obras"],
            ["companies", "Empresas"],
            ["suppliers", "Fornecedores"],
            ["opportunities", "Oportunidades"],
          ] as const
        ).map(([key, label]) => (
          <label key={key}>
            <input
              type="checkbox"
              checked={layers.includes(key)}
              onChange={() => toggle(key)}
            />
            {label}
            {mapData?.totals[key] != null
              ? ` (${mapData.totals[key].toLocaleString("pt-BR")})`
              : ""}
          </label>
        ))}
      </div>
      {error ? (
        <div className="empty-state error">
          <h3>API geoespacial indisponível</h3>
          <p>{error}</p>
          <button
            className="btn btn-primary"
            onClick={() => setViewport({ ...viewport })}
          >
            Tentar novamente
          </button>
        </div>
      ) : (
        <div className="map-layout">
          <div className="map-stage">
            {mapData ? (
              <EngineeringWorksMap
                clusters={mapData.clusters}
                zoom={mapData.zoom}
                focusFiltered={!!(
                  params.get("uf") ||
                  params.get("municipality") ||
                  params.get("company")
                )}
                onSelect={choose}
                onViewport={changeViewport}
              />
            ) : (
              <Loading />
            )}
            <div className="map-legend">
              <span>Azul: obras</span>
              <span>Roxo: empresas</span>
              <span>Laranja: fornecedores</span>
              <span>Verde: oportunidades</span>
            </div>
          </div>
          <aside className="map-side">
            {selected ? (
              <div className="map-side-body">
                <small>
                  {selected.layer} · {selected.quantity.toLocaleString("pt-BR")}{" "}
                  entidades
                </small>
                <h2>{selected.locationLabel}</h2>
                <p>
                  <MapPin size={14} />
                  Localização aproximada pelo município
                </p>
                <p>Fonte: {selected.source}</p>
                <p>
                  Atualização:{" "}
                  {selected.updated_at
                    ? new Date(selected.updated_at).toLocaleDateString("pt-BR")
                    : "não informada"}
                </p>
                <Link className="btn btn-primary" to={selected.detailUrl}>
                  Abrir detalhe <ArrowUpRight size={14} />
                </Link>
              </div>
            ) : (
              <div className="map-side-empty">
                <Target size={35} />
                <h3>Selecione um cluster</h3>
                <p>O clique atualiza o recorte e preserva os filtros na URL.</p>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
};

export const EngineeringWorks: React.FC = () => {
  const [urlParams, setUrlParams] = useSearchParams();
  const [data, setData] = useState<EngineeringDataset | null>(null);
  const [page, setPage] = useState(Number(urlParams.get("page")) || 1);
  const [query, setQuery] = useState(urlParams.get("search") || "");
  const [status, setStatus] = useState(urlParams.get("status") || "Todos");
  const [phase, setPhase] = useState(urlParams.get("phase") || "Todos");
  const [sector, setSector] = useState(urlParams.get("sector") || "Todos");
  const [municipality, setMunicipality] = useState(
    urlParams.get("municipality") || "",
  );
  const [uf, setUf] = useState(urlParams.get("uf") || "");
  const [company, setCompany] = useState(urlParams.get("company") || "");
  const [investmentMin, setInvestmentMin] = useState(
    urlParams.get("investmentMin") || "",
  );
  const [investmentMax, setInvestmentMax] = useState(
    urlParams.get("investmentMax") || "",
  );
  const [periodStart, setPeriodStart] = useState(
    urlParams.get("periodStart") || "",
  );
  const [periodEnd, setPeriodEnd] = useState(urlParams.get("periodEnd") || "");
  const [hasSupplier, setHasSupplier] = useState(
    urlParams.get("hasSupplier") || "",
  );
  const [hasDecisionMaker, setHasDecisionMaker] = useState(
    urlParams.get("hasDecisionMaker") || "",
  );
  const [hasOpportunity, setHasOpportunity] = useState(
    urlParams.get("hasOpportunity") || "",
  );
  const [capexHomologado, setCapexHomologado] = useState(
    urlParams.get("capex_homologado") || "",
  );
  const [sort, setSort] = useState("investment_desc");
  useEffect(() => {
    const next = new URLSearchParams();
    const values = {
      page: page > 1 ? String(page) : "",
      search: query,
      status: status === "Todos" ? "" : status,
      phase: phase === "Todos" ? "" : phase,
      sector: sector === "Todos" ? "" : sector,
      municipality,
      uf,
      company,
      investmentMin,
      investmentMax,
      periodStart,
      periodEnd,
      hasSupplier,
      hasDecisionMaker,
      hasOpportunity,
      capex_homologado: capexHomologado,
    };
    Object.entries(values).forEach(([k, v]) => v && next.set(k, v));
    setUrlParams(next, { replace: true });
  }, [
    page,
    query,
    status,
    phase,
    sector,
    municipality,
    uf,
    company,
    investmentMin,
    investmentMax,
    periodStart,
    periodEnd,
    hasSupplier,
    hasDecisionMaker,
    hasOpportunity,
    capexHomologado,
  ]);
  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      engineeringService
        .load({
          page,
          pageSize: 25,
          search: query || undefined,
          status: status === "Todos" ? undefined : status,
          phase: phase === "Todos" ? undefined : phase,
          sector: sector === "Todos" ? undefined : sector,
          municipality: municipality || undefined,
          uf: uf || undefined,
          company: company || undefined,
          investmentMin: investmentMin ? Number(investmentMin) : undefined,
          investmentMax: investmentMax ? Number(investmentMax) : undefined,
          periodStart: periodStart || undefined,
          periodEnd: periodEnd || undefined,
          hasSupplier: hasSupplier ? hasSupplier === "true" : undefined,
          hasDecisionMaker: hasDecisionMaker
            ? hasDecisionMaker === "true"
            : undefined,
          hasOpportunity: hasOpportunity
            ? hasOpportunity === "true"
            : undefined,
          capexHomologado: capexHomologado
            ? capexHomologado === "true"
            : undefined,
          sort,
        })
        .then((value) => active && setData(value))
        .catch(
          (error) =>
            active &&
            setData({
              works: [],
              companies: [],
              opportunities: [],
              meta: {
                source: "wins_agro.engenharia.obras",
                partialData: true,
                totalWorks: 0,
                realData: true,
                error:
                  error instanceof Error ? error.message : "Falha na API real",
              },
            }),
        );
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [
    page,
    query,
    status,
    phase,
    sector,
    municipality,
    uf,
    company,
    investmentMin,
    investmentMax,
    periodStart,
    periodEnd,
    hasSupplier,
    hasDecisionMaker,
    hasOpportunity,
    capexHomologado,
    sort,
  ]);
  if (!data) return <Loading />;
  const hasError = !!data.meta?.error;
  const hasFilters =
    query ||
    status !== "Todos" ||
    phase !== "Todos" ||
    sector !== "Todos" ||
    municipality ||
    uf ||
    company ||
    investmentMin ||
    investmentMax ||
    periodStart ||
    periodEnd ||
    hasSupplier ||
    hasDecisionMaker ||
    hasOpportunity ||
    capexHomologado;
  const worksLoaded = data.works.length > 0;
  const items = data.works;
  const aggregates = data.meta?.aggregates;
  return (
    <div className="engineering-page">
      <SourceStrip data={data} />
      <PageHead
        title="Carteira de Obras"
        subtitle="Busca, classificação e acompanhamento dos projetos monitorados"
      >
        <Link className="btn btn-primary" to="/engenharia/mapa">
          <MapIcon size={15} /> Ver no mapa
        </Link>
      </PageHead>
      {hasError ? (
        <div className="empty-state error">
          <HardHat size={42} />
          <h3>API indisponível</h3>
          <p>{data.meta?.error}</p>
          <button
            className="btn btn-primary"
            onClick={() => window.location.reload()}
          >
            Tentar novamente
          </button>
        </div>
      ) : (
        <>
          <div className="works-toolbar">
            <label className="search-field">
              <Search size={15} />
              <input
                aria-label="Buscar obras"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Buscar obra ou empresa..."
              />
            </label>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              aria-label="Status"
            >
              <option>Todos</option>
              {["Em andamento", "Prevista", "Concluída", "Paralisada"].map(
                (x) => (
                  <option key={x}>{x}</option>
                ),
              )}
            </select>
            <select
              value={phase}
              onChange={(e) => {
                setPhase(e.target.value);
                setPage(1);
              }}
              aria-label="Fase"
            >
              <option>Todos</option>
              {[
                "Projeto",
                "Licenciamento",
                "Mobilização",
                "Execução",
                "Entrega",
              ].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
            <select
              value={sector}
              onChange={(e) => {
                setSector(e.target.value);
                setPage(1);
              }}
              aria-label="Setor"
            >
              <option>Todos</option>
              {[
                "INFRAESTRUTURA",
                "SANEAMENTO",
                "ENERGIA",
                "INDUSTRIAL",
                "LOGISTICO",
                "MINERACAO",
              ].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
            <input
              aria-label="Município"
              value={municipality}
              onChange={(e) => {
                setMunicipality(e.target.value);
                setPage(1);
              }}
              placeholder="Município"
            />
            <input
              aria-label="UF"
              value={uf}
              maxLength={2}
              onChange={(e) => {
                setUf(e.target.value.toUpperCase());
                setPage(1);
              }}
              placeholder="UF"
            />
            <input
              aria-label="Empresa"
              value={company}
              onChange={(e) => {
                setCompany(e.target.value);
                setPage(1);
              }}
              placeholder="Empresa ou CNPJ"
            />
            <input
              aria-label="Investimento mínimo"
              type="number"
              min="0"
              value={investmentMin}
              onChange={(e) => {
                setInvestmentMin(e.target.value);
                setPage(1);
              }}
              placeholder="Invest. mín."
            />
            <input
              aria-label="Investimento máximo"
              type="number"
              min="0"
              value={investmentMax}
              onChange={(e) => {
                setInvestmentMax(e.target.value);
                setPage(1);
              }}
              placeholder="Invest. máx."
            />
            <input
              aria-label="Período inicial"
              type="date"
              value={periodStart}
              onChange={(e) => {
                setPeriodStart(e.target.value);
                setPage(1);
              }}
            />
            <input
              aria-label="Período final"
              type="date"
              value={periodEnd}
              onChange={(e) => {
                setPeriodEnd(e.target.value);
                setPage(1);
              }}
            />
            {[
              ["Fornecedor", hasSupplier, setHasSupplier],
              ["Decisor", hasDecisionMaker, setHasDecisionMaker],
              ["Oportunidade", hasOpportunity, setHasOpportunity],
            ].map(([label, value, setValue]) => (
              <select
                key={String(label)}
                aria-label={`Existência de ${String(label).toLowerCase()}`}
                value={String(value)}
                onChange={(e) => {
                  (setValue as React.Dispatch<React.SetStateAction<string>>)(
                    e.target.value,
                  );
                  setPage(1);
                }}
              >
                <option value="">{String(label)}: todos</option>
                <option value="true">Com {String(label).toLowerCase()}</option>
                <option value="false">Sem {String(label).toLowerCase()}</option>
              </select>
            ))}
            <select
              aria-label="CAPEX homologado"
              value={capexHomologado}
              onChange={(e) => {
                setCapexHomologado(e.target.value);
                setPage(1);
              }}
            >
              <option value="">CAPEX: todos</option>
              <option value="true">CAPEX homologado</option>
              <option value="false">Sem CAPEX homologado</option>
            </select>
            <select
              value={sort}
              onChange={(e) => {
                setSort(e.target.value);
                setPage(1);
              }}
              aria-label="Ordenação"
            >
              <option value="investment_desc">Maior investimento</option>
              <option value="investment_asc">Menor investimento</option>
              <option value="updated_desc">Atualização recente</option>
              <option value="start_asc">Início</option>
              <option value="name_asc">Nome A–Z</option>
              <option value="name_desc">Nome Z–A</option>
            </select>
          </div>
          <div className="results-line">
            <span>
              <strong>
                {(data.meta?.totalWorks || 0).toLocaleString("pt-BR")}
              </strong>{" "}
              obras encontradas · página {page}
            </span>
            <span>
              {aggregates?.investmentStatus === "unavailable"
                ? "Investimento não disponível"
                : `${money(aggregates?.investmentTotal)} · ${aggregates?.investmentStatus === "partial" ? "parcial" : "completo"}`}
              {!!aggregates &&
                aggregates.investmentMissingCount +
                  aggregates.investmentUnhomologatedCount >
                  0 && (
                  <small>
                    {" "}
                    · {aggregates.investmentMissingCount} sem valor ·{" "}
                    {aggregates.investmentUnhomologatedCount} não homologados
                  </small>
                )}
            </span>
            {hasFilters && (
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setQuery("");
                  setStatus("Todos");
                  setPhase("Todos");
                  setSector("Todos");
                  setMunicipality("");
                  setUf("");
                  setCompany("");
                  setInvestmentMin("");
                  setInvestmentMax("");
                  setPeriodStart("");
                  setPeriodEnd("");
                  setHasSupplier("");
                  setHasDecisionMaker("");
                  setHasOpportunity("");
                  setCapexHomologado("");
                  setPage(1);
                }}
              >
                <X size={13} /> Limpar filtros
              </button>
            )}
          </div>
          <div className="card works-table-card">
            <div className="table-wrap">
              <table className="works-table">
                <thead>
                  <tr>
                    <th>Obra</th>
                    <th>Status / fase</th>
                    <th>Município</th>
                    <th>Setor</th>
                    <th>Investimento</th>
                    <th>Empresa líder</th>
                    <th>Prazo</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((w) => {
                    const company = data.companies.find((c) =>
                      w.companyIds?.includes(c.id),
                    );
                    return (
                      <tr key={w.id}>
                        <td>
                          <strong>{w.name}</strong>
                          <small>{w.progress}% executado</small>
                        </td>
                        <td>
                          <span className={`badge ${statusClass(w.status)}`}>
                            {w.status}
                          </span>
                          <small>{w.phase}</small>
                        </td>
                        <td>
                          {w.municipality}
                          <small>{w.state}</small>
                        </td>
                        <td>
                          <span className="sector-tag">{w.sector}</span>
                        </td>
                        <td>
                          <strong>
                            {w.investment != null ? (
                              money(w.investment)
                            ) : (
                              <span className="value-unavailable">
                                Valor indisponível
                              </span>
                            )}
                          </strong>
                        </td>
                        <td>
                          {company?.tradeName ||
                            (w.companyIds?.length ? (
                              <span className="value-unavailable">—</span>
                            ) : null)}
                        </td>
                        <td>{w.deadline}</td>
                        <td>
                          <Link
                            className="table-open"
                            aria-label={`Abrir ${w.name}`}
                            to={`/engenharia/obras/${w.id}`}
                          >
                            <ChevronRight size={17} />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!items.length && !hasError && worksLoaded && (
                <div className="empty-state">
                  <Search size={32} />
                  <h3>Nenhuma obra encontrada</h3>
                  <p>Revise a busca ou os filtros selecionados.</p>
                </div>
              )}
              {!items.length && !hasError && !worksLoaded && (
                <div className="empty-state">
                  <HardHat size={32} />
                  <h3>Nenhuma obra disponível</h3>
                  <p>
                    A API retornou uma lista vazia para os critérios atuais.
                  </p>
                </div>
              )}
            </div>
            <div className="results-line">
              <button
                className="btn btn-outline"
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Página anterior
              </button>
              <span>
                Página {page} de{" "}
                {Math.max(1, Math.ceil((data.meta?.totalWorks || 0) / 25))}
              </span>
              <button
                className="btn btn-outline"
                disabled={page * 25 >= (data.meta?.totalWorks || 0)}
                onClick={() => setPage((p) => p + 1)}
              >
                Próxima página
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export const EngineeringWorkDetail: React.FC = () => {
  const { id } = useParams();
  const data = useEngineeringData();
  if (!data) return <Loading />;
  const work = data.works.find((w) => w.id === id);
  if (!work) return <NotFound label="Obra não encontrada" />;
  const companies = data.companies.filter((c) =>
    work.companyIds.includes(c.id),
  );
  const opps = data.opportunities.filter((o) => o.workId === work.id);
  return (
    <div className="engineering-page">
      <div className="detail-back">
        <Link to="/engenharia/obras">
          <ArrowLeft size={14} /> Voltar à carteira
        </Link>
        <span>ID {work.id.toUpperCase()}</span>
      </div>
      <div className="work-hero">
        <div>
          <div className="hero-badges">
            <span className={`badge ${statusClass(work.status)}`}>
              {work.status}
            </span>
            <span className="sector-tag">{work.sector}</span>
            <span className="priority-pill">Prioridade {work.priority}</span>
          </div>
          <h1>{work.name}</h1>
          <p>{work.description}</p>
          <div className="hero-location">
            <MapPin size={15} />
            {work.municipality}, {work.state}
          </div>
        </div>
        <div
          className="work-progress-ring"
          style={
            { "--progress": `${work.progress * 3.6}deg` } as React.CSSProperties
          }
        >
          <div>
            <strong>{work.progress}%</strong>
            <span>executado</span>
          </div>
        </div>
      </div>
      <div className="detail-metrics">
        {[
          ["Investimento", money(work.investment), CircleDollarSign],
          ["Fase atual", work.phase, Layers3],
          ["Início", work.startDate, CalendarDays],
          ["Prazo previsto", work.deadline, Clock3],
        ].map(([l, v, I]) => (
          <div key={String(l)}>
            <span className="detail-icon">
              <Glyph icon={I as React.ElementType} />
            </span>
            <small>{String(l)}</small>
            <strong>{String(v)}</strong>
          </div>
        ))}
      </div>
      <div className="detail-grid">
        <div>
          <section className="card">
            <div className="card-header">
              <h3 className="card-title">Cronograma executivo</h3>
              <span className="metric-chip">{work.phase}</span>
            </div>
            <div className="phase-track">
              {[
                "Projeto",
                "Licenciamento",
                "Mobilização",
                "Execução",
                "Entrega",
              ].map((p, i) => {
                const active =
                  i <=
                  [
                    "Projeto",
                    "Licenciamento",
                    "Mobilização",
                    "Execução",
                    "Entrega",
                  ].indexOf(work.phase);
                return (
                  <div className={active ? "active" : ""} key={p}>
                    <i>{active ? <CheckCircle2 size={15} /> : i + 1}</i>
                    <span>{p}</span>
                  </div>
                );
              })}
            </div>
          </section>
          <section className="card">
            <div className="card-header">
              <h3 className="card-title">Empresas relacionadas</h3>
              <span>{companies.length} vínculos</span>
            </div>
            <div className="related-companies">
              {companies.map((c) => (
                <Link to={`/empresas/${c.id}`} key={c.id}>
                  <div className="company-mark">
                    {c.tradeName.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <strong>{c.name}</strong>
                    <span>
                      {c.segment} · {c.municipality}
                    </span>
                  </div>
                  <div className="company-score">
                    {c.score}
                    <small>score</small>
                  </div>
                  <ChevronRight size={16} />
                </Link>
              ))}
            </div>
          </section>
          <section className="card">
            <div className="card-header">
              <h3 className="card-title">Eventos recentes</h3>
              <Activity size={17} />
            </div>
            <div className="event-timeline">
              {work.events.map((e, i) => (
                <div key={i}>
                  <i />
                  <span>{e.date}</span>
                  <strong>{e.title}</strong>
                  <p>{e.detail}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
        <aside>
          <section className="card">
            <div className="card-header">
              <h3 className="card-title">Indicadores</h3>
              <TrendingUp size={17} />
            </div>
            <div className="indicator-stack">
              {work.indicators.map((x) => (
                <div key={x.label}>
                  <span>{x.label}</span>
                  <strong>{x.value}</strong>
                </div>
              ))}
            </div>
          </section>
          <section className="card opportunity-panel">
            <div className="card-header">
              <h3 className="card-title">Oportunidades</h3>
              <span className="badge badge-orange">{opps.length}</span>
            </div>
            {opps.map((o) => (
              <div className="mini-opportunity" key={o.id}>
                <div>
                  <span>{o.stage}</span>
                  <strong>{o.title}</strong>
                </div>
                <b>{money(o.estimatedValue)}</b>
                <small>{o.score}% de aderência</small>
              </div>
            ))}
            <Link to="/oportunidades">
              Ver pipeline completo <ArrowUpRight size={13} />
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
};

export const EngineeringCompanies: React.FC = () => {
  const data = useEngineeringData();
  if (!data) return <Loading />;
  return (
    <div className="engineering-page">
      <PageHead
        title="Empresas Relacionadas"
        subtitle="Ecossistema empresarial conectado à carteira de engenharia"
      />
      <div className="company-grid">
        {data.companies.map((c) => (
          <article className="company-card" key={c.id}>
            <div className="company-card-head">
              <div className="company-mark">
                {c.tradeName.slice(0, 2).toUpperCase()}
              </div>
              <span className="score-ring">{c.score}</span>
            </div>
            <h3>{c.name}</h3>
            <p>{c.segment}</p>
            <div className="company-card-meta">
              <span>
                <MapPin size={13} />
                {c.municipality}, {c.state}
              </span>
              <span>
                <HardHat size={13} />
                {c.workIds.length} obras relacionadas
              </span>
              <span>
                <TrendingUp size={13} />
                {c.opportunityIds.length} oportunidades
              </span>
            </div>
            <Link className="btn btn-outline" to={`/empresas/${c.id}`}>
              Abrir Empresa 360° <ArrowUpRight size={13} />
            </Link>
          </article>
        ))}
      </div>
    </div>
  );
};

export const Company360: React.FC = () => {
  const { id } = useParams();
  const data = useEngineeringData();
  if (!data) return <Loading />;
  const company = data.companies.find((c) => c.id === id);
  if (!company) return <NotFound label="Empresa não encontrada" />;
  const works = data.works.filter((w) => company.workIds.includes(w.id));
  const opps = data.opportunities.filter((o) =>
    company.opportunityIds.includes(o.id),
  );
  return (
    <div className="engineering-page">
      <div className="detail-back">
        <Link to="/engenharia/empresas">
          <ArrowLeft size={14} /> Empresas relacionadas
        </Link>
        <span>Empresa 360°</span>
      </div>
      <div className="company-hero">
        <div className="company-mark large">
          {company.tradeName.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <div className="eyebrow">Cadastro empresarial transversal</div>
          <h1>{company.name}</h1>
          <p>
            {company.tradeName} · CNPJ {company.cnpj}
          </p>
          <div className="hero-location">
            <MapPin size={14} />
            {company.municipality}, {company.state} · Fundada em{" "}
            {company.founded}
          </div>
        </div>
        <div className="wins-score">
          <strong>{company.score}</strong>
          <span>Score WiNS</span>
        </div>
      </div>
      <div className="detail-metrics company-metrics">
        {[
          ["Receita estimada", money(company.revenue), CircleDollarSign],
          ["Colaboradores", company.employees.toLocaleString("pt-BR"), Users],
          ["Obras vinculadas", works.length, HardHat],
          ["Oportunidades", opps.length, TrendingUp],
        ].map(([l, v, I]) => (
          <div key={String(l)}>
            <span className="detail-icon">
              <Glyph icon={I as React.ElementType} />
            </span>
            <small>{String(l)}</small>
            <strong>{String(v)}</strong>
          </div>
        ))}
      </div>
      <div className="company360-grid">
        <section className="card">
          <div className="card-header">
            <h3 className="card-title">Atuação territorial</h3>
            <MapIcon size={17} />
          </div>
          <div className="territory-chips">
            {company.territories.map((t) => (
              <span key={t}>
                {t}
                <small>Atuação ativa</small>
              </span>
            ))}
          </div>
          <div className="territory-visual">
            <Factory size={36} />
            <div>
              <strong>{company.segment}</strong>
              <span>
                Presença operacional em {company.territories.length} estados
              </span>
            </div>
          </div>
        </section>
        <section className="card">
          <div className="card-header">
            <h3 className="card-title">Vínculos mapeados</h3>
            <Layers3 size={17} />
          </div>
          <div className="links-list">
            {company.links.map((x, i) => (
              <div key={i}>
                <i />
                <span>
                  {x.type}
                  <strong>{x.name}</strong>
                </span>
              </div>
            ))}
          </div>
        </section>
        <section className="card company-works">
          <div className="card-header">
            <h3 className="card-title">Obras relacionadas</h3>
            <span>{works.length} projetos</span>
          </div>
          {works.map((w) => (
            <Link to={`/engenharia/obras/${w.id}`} key={w.id}>
              <div>
                <span className={`badge ${statusClass(w.status)}`}>
                  {w.status}
                </span>
                <strong>{w.name}</strong>
                <small>
                  {w.municipality} · {money(w.investment)}
                </small>
              </div>
              <ChevronRight size={16} />
            </Link>
          ))}
        </section>
        <section className="card">
          <div className="card-header">
            <h3 className="card-title">Histórico recente</h3>
            <Clock3 size={17} />
          </div>
          <div className="event-timeline compact">
            {company.history.map((e, i) => (
              <div key={i}>
                <i />
                <span>{e.date}</span>
                <strong>{e.title}</strong>
                <p>{e.detail}</p>
              </div>
            ))}
          </div>
        </section>
        <section className="card company-opps">
          <div className="card-header">
            <h3 className="card-title">Oportunidades</h3>
            <span className="badge badge-orange">{opps.length}</span>
          </div>
          {opps.length ? (
            opps.map((o) => (
              <Link to={`/engenharia/obras/${o.workId}`} key={o.id}>
                <Target size={17} />
                <div>
                  <strong>{o.title}</strong>
                  <span>
                    {o.stage} · {money(o.estimatedValue)}
                  </span>
                </div>
                <b>{o.score}%</b>
              </Link>
            ))
          ) : (
            <div className="quiet-empty">
              Nenhuma oportunidade ativa neste recorte.
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export const EngineeringOpportunities: React.FC = () => {
  const data = useEngineeringData();
  const navigate = useNavigate();
  const [stage, setStage] = useState<"Todos" | OpportunityStage>("Todos");
  const [sector, setSector] = useState<"Todos" | Sector>("Todos");
  if (!data) return <Loading />;
  const items = data.opportunities.filter(
    (o) =>
      (stage === "Todos" || o.stage === stage) &&
      (sector === "Todos" || o.sector === sector),
  );
  return (
    <div className="engineering-page">
      <PageHead
        title="Oportunidades de Engenharia"
        subtitle="Matching comercial conectado a obras, territórios e empresas potenciais"
      />
      <div className="opportunity-summary">
        <div>
          <span>Pipeline estimado</span>
          <strong>
            {money(items.reduce((s, o) => s + o.estimatedValue, 0))}
          </strong>
        </div>
        <div>
          <span>Aderência média</span>
          <strong>
            {Math.round(
              items.reduce((s, o) => s + o.score, 0) /
                Math.max(items.length, 1),
            )}
            %
          </strong>
        </div>
        <div className="opportunity-filters">
          <select
            value={stage}
            onChange={(e) => setStage(e.target.value as typeof stage)}
          >
            <option>Todos</option>
            {["Identificada", "Qualificação", "Proposta", "Negociação"].map(
              (x) => (
                <option key={x}>{x}</option>
              ),
            )}
          </select>
          <select
            value={sector}
            onChange={(e) => setSector(e.target.value as typeof sector)}
          >
            <option>Todos</option>
            {["Rodovias", "Saneamento", "Energia", "Mobilidade"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="opportunity-list">
        {items.map((o) => {
          const work = data.works.find((w) => w.id === o.workId)!;
          const company = data.companies.find((c) => c.id === o.companyId)!;
          return (
            <article key={o.id}>
              <div className="opp-score-block">
                <strong>{o.score}%</strong>
                <span>match</span>
              </div>
              <div className="opp-main">
                <div>
                  <span className={`badge ${statusClass(o.stage)}`}>
                    {o.stage}
                  </span>
                  <span className="sector-tag">{o.sector}</span>
                </div>
                <h3>{o.title}</h3>
                <p>{o.justification}</p>
                <div className="opp-links">
                  <button
                    onClick={() => navigate(`/engenharia/obras/${work.id}`)}
                  >
                    <HardHat size={13} />
                    {work.name}
                  </button>
                  <button onClick={() => navigate(`/empresas/${company.id}`)}>
                    <Building2 size={13} />
                    {company.tradeName}
                  </button>
                </div>
              </div>
              <div className="opp-value">
                <span>{o.municipality}</span>
                <strong>{money(o.estimatedValue)}</strong>
                <small>valor estimado</small>
              </div>
            </article>
          );
        })}
        {!items.length && (
          <div className="empty-state">
            <Target size={35} />
            <h3>Nenhuma oportunidade</h3>
            <p>Altere os filtros do pipeline.</p>
          </div>
        )}
      </div>
    </div>
  );
};

const NotFound = ({ label }: { label: string }) => (
  <div className="empty-state not-found">
    <HardHat size={42} />
    <h2>{label}</h2>
    <p>O registro solicitado não faz parte dos dados controlados da demo.</p>
    <Link className="btn btn-primary" to="/engenharia">
      Voltar ao dashboard
    </Link>
  </div>
);
