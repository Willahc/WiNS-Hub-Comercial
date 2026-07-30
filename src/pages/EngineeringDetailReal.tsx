// Official Engineering Work Detail Module (:obraId real)
import React, { useEffect, useState } from "react";
import {
  Activity,
  ArrowLeft,
  Building2,
  CalendarDays,
  Copy,
  Database,
  HardHat,
  MapPin,
  Target,
  UserRound,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { httpClient } from "../services/http/client";

type Detail = {
  sourceId: string;
  name: string;
  description?: string;
  municipality?: string;
  state?: string;
  status?: string;
  phase?: string;
  sector?: string;
  value?: number;
  publishedAt?: string;
  deadline?: string;
  investmentHomologated?: boolean;
  lastUpdatedAt?: string;
  company?: { name?: string; cnpj?: string };
  supplier?: { razao_social?: string; source_id?: string };
  decisionMakers?: Array<{
    source_id: string;
    nome: string;
    cargo?: string;
    fonte?: string;
  }>;
  opportunities?: Array<{
    source_id: string;
    fornecedor?: string;
    score?: number;
    cnpj?: string;
  }>;
  missingFields?: string[];
  provenance?: {
    sourceDatabase?: string;
    sourceSchema?: string;
    sourceTable?: string;
    sourceUpdatedAt?: string;
    sourceUrl?: string;
  };
};

const money = (value?: number) =>
  value == null
    ? "Valor não informado"
    : new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(value);

const formatDate = (isoStr?: string) => {
  if (!isoStr) return "Não informada";
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    return d.toLocaleDateString("pt-BR");
  } catch {
    return isoStr;
  }
};

const formatTimestamp = (isoStr?: string) => {
  if (!isoStr) return "Não informada";
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    const datePart = d.toLocaleDateString("pt-BR");
    const timePart = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    return `${datePart} às ${timePart}`;
  } catch {
    return isoStr;
  }
};

const cleanDescription = (text?: string) => {
  if (!text) return "Descrição não informada na fonte.";
  // Filter out asterisks lines or garbage text
  let cleaned = text.replace(/Atividades secundárias:[\s\*\;\-]+/gi, "");
  cleaned = cleaned.replace(/\*+/g, "").trim();
  return cleaned || "Descrição não informada na fonte.";
};

import EngenhariaObraDetalheApproved from './EngenhariaObraDetalheApproved';

export const EngineeringWorkDetailReal = EngenhariaObraDetalheApproved;
export const EngineeringWorkDetailRealLegacy: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<Detail | null>();
  const [activeTab, setActiveTab] = useState<string>("resumo");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    if (id)
      httpClient
        .get<Detail>(`/engenharia/obras/${id}`)
        .then((r) => active && setData(r.data))
        .catch(() => active && setData(null));
    return () => {
      active = false;
    };
  }, [id]);

  const copyId = () => {
    if (data?.sourceId) {
      navigator.clipboard.writeText(data.sourceId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (data === undefined)
    return (
      <div className="loading-container">
        <div className="spinner" />
        <p>Carregando dados oficiais...</p>
      </div>
    );

  if (!data)
    return (
      <div className="empty-state error">
        <HardHat size={40} />
        <h2>Registro não encontrado na fonte consultada.</h2>
        <Link className="btn btn-primary" to="/engenharia/obras">
          Voltar à carteira
        </Link>
      </div>
    );

  const tabs = [
    { id: "resumo", label: "Resumo" },
    { id: "empresa", label: "Empresa" },
    { id: "fornecedores", label: "Fornecedores" },
    { id: "decisores", label: `Decisores (${data.decisionMakers?.length || 0})` },
    { id: "oportunidades", label: `Oportunidades (${data.opportunities?.length || 0})` },
    { id: "territorial", label: "Territorial" },
    { id: "eventos", label: "Eventos" },
    { id: "proveniencia", label: "Proveniência" },
  ];

  return (
    <div className="engineering-page work-detail-page">
      {/* HEADER NAVEGAÇÃO E ID COPIÁVEL SEGURO */}
      <div className="detail-back-bar">
        <Link to="/engenharia/obras" className="back-link" onClick={(e) => { if (window.history.length > 2) { e.preventDefault(); navigate(-1); } }}>
          <ArrowLeft size={15} /> Voltar à carteira de obras
        </Link>
        <div className="id-pill-block">
          <span className="id-label">ID REAL:</span>
          <code className="id-code">{data.sourceId}</code>
          <button className="copy-btn" onClick={copyId} title="Copiar ID">
            <Copy size={12} /> {copied ? "Copiado!" : "Copiar"}
          </button>
        </div>
      </div>

      {/* HERO CABEÇALHO EXECUTIVO */}
      <div className="work-hero-executive">
        <div className="hero-main">
          <div className="hero-badges">
            <span className="badge badge-blue">
              {data.status || "Status não informado"}
            </span>
            <span className="sector-tag">
              {data.phase || "Fase não informada"}
            </span>
            {data.sector && <span className="sector-tag font-bold">{data.sector}</span>}
          </div>
          <h1 className="hero-title">{data.name}</h1>
          <p className="hero-description">{cleanDescription(data.description)}</p>
          <div className="hero-location">
            <MapPin size={15} />
            {data.municipality && data.state ? (
              <Link to={`/territorial?municipality=${encodeURIComponent(data.municipality)}&uf=${data.state}&vertical=engenharia`} className="location-link">
                <strong>{data.municipality} / {data.state}</strong>
              </Link>
            ) : (
              <strong>{data.municipality || "Município não informado"} / {data.state || "—"}</strong>
            )}
          </div>
        </div>
      </div>

      {/* MÉTRICAS CHAVE COM LAYOUT VERTICAL E SEM SOBREPOSIÇÃO */}
      <div className="detail-metrics-grid">
        <div className="metric-box">
          <span className="metric-label">Valor Estimado</span>
          <strong className="metric-value">{money(data.value)}</strong>
        </div>
        <div className="metric-box">
          <span className="metric-label">Órgão / Empresa Líder</span>
          <strong className="metric-value truncate">{data.company?.cnpj ? <Link to={`/empresas/${encodeURIComponent(data.company.cnpj)}`}>{data.company.name}</Link> : (data.company?.name || "Não informado")}</strong>
        </div>
        <div className="metric-box">
          <span className="metric-label">Data de Publicação</span>
          <strong className="metric-value">{formatDate(data.publishedAt)}</strong>
        </div>
        <div className="metric-box">
          <span className="metric-label">Última Atualização</span>
          <strong className="metric-value">{formatTimestamp(data.lastUpdatedAt || data.provenance?.sourceUpdatedAt)}</strong>
        </div>
      </div>

      {/* NAVEGAÇÃO POR ABAS ATIVAS */}
      <div className="detail-tabs-bar">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`tab-btn ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* CONTEÚDO DAS ABAS */}
      <div className="tab-content-area">
        {/* ABA 1: RESUMO */}
        {activeTab === "resumo" && (
          <div className="detail-grid">
            <div className="main-col">
              <section className="card">
                <div className="card-header">
                  <h3 className="card-title">
                    <CalendarDays size={17} /> Marcos temporais disponíveis
                  </h3>
                  <span className="metric-chip">
                    {data.phase || "Fase não informada"}
                  </span>
                </div>
                <div className="timeline-info-list">
                  <div className="info-row">
                    <span className="info-label">Início cadastrado:</span>
                    <strong className="info-val">{formatDate(data.publishedAt)}</strong>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Última atualização registrada:</span>
                    <strong className="info-val">{formatTimestamp(data.lastUpdatedAt || data.provenance?.sourceUpdatedAt)}</strong>
                  </div>
                </div>
                <p className="value-unavailable note-box">
                  Cronograma detalhado não disponível na fonte.
                </p>
              </section>

              <section className="card">
                <div className="card-header">
                  <h3 className="card-title">
                    <Building2 size={17} /> Vínculos empresariais
                  </h3>
                </div>
                <div className="info-row">
                  <span className="info-label">Empresa contratante / proprietária:</span>
                  <strong className="info-val">
                    {data.company?.name || "Não informado"}
                    {data.company?.cnpj && (
                      <> · <Link to={`/empresas/${data.company.cnpj}`}>CNPJ {data.company.cnpj}</Link></>
                    )}
                  </strong>
                </div>
                <div className="info-row">
                  <span className="info-label">Fornecedor recomendado / executora:</span>
                  <strong className="info-val">
                    {data.supplier?.source_id ? (
                      <Link to={`/fornecedores/${data.supplier.source_id}`}>
                        {data.supplier.razao_social || data.supplier.source_id}
                      </Link>
                    ) : (
                      data.supplier?.razao_social || "Não identificado na fonte"
                    )}
                  </strong>
                </div>
              </section>
            </div>

            <aside className="side-col">
              <section className="card">
                <div className="card-header">
                  <h3 className="card-title">
                    <Target size={17} /> Oportunidades
                  </h3>
                  <span className="count-badge">{data.opportunities?.length || 0}</span>
                </div>
                {data.opportunities?.length ? (
                  data.opportunities.map((o) => (
                    <div key={o.source_id} className="related-item">
                      <Link to={`/engenharia/oportunidades/${encodeURIComponent(o.source_id)}`}>
                        <strong>{o.fornecedor || o.cnpj || "Fornecedor recomendado"}</strong>
                      </Link>
                      <small>Score real de aderência: {o.score ?? "não informado"}</small>
                    </div>
                  ))
                ) : (
                  <p className="empty-tab-text">Sem oportunidades vinculadas com score &ge; 70.</p>
                )}
              </section>

              <section className="card">
                <h3 className="card-title">Proveniência técnica</h3>
                <p className="provenance-path">
                  {data.provenance?.sourceDatabase || "wins_agro"}.
                  {data.provenance?.sourceSchema || "engenharia"}.
                  {data.provenance?.sourceTable || "obras"}
                </p>
                <small className="missing-fields-text">
                  Campos ausentes:{" "}
                  {data.missingFields?.length
                    ? data.missingFields.join(", ")
                    : "nenhum campo obrigatório ausente"}
                </small>
              </section>
            </aside>
          </div>
        )}

        {/* ABA 2: EMPRESA */}
        {activeTab === "empresa" && (
          <section className="card">
            <h3 className="card-title"><Building2 size={17} /> Detalhes da Empresa Contratante</h3>
            {data.company?.name ? (
              <div className="info-row">
                <span className="info-label">Razão Social:</span>
                <strong className="info-val">{data.company.name}</strong>
                {data.company.cnpj && <p>CNPJ: {data.company.cnpj}</p>}
              </div>
            ) : (
              <p className="empty-tab-text">Empresa líder não informada na fonte oficial.</p>
            )}
          </section>
        )}

        {/* ABA 3: FORNECEDORES */}
        {activeTab === "fornecedores" && (
          <section className="card">
            <h3 className="card-title"><HardHat size={17} /> Fornecedores Recomendados</h3>
            {data.supplier?.razao_social ? (
              <div className="info-row">
                <span className="info-label">Razão Social / Nome:</span>
                <strong className="info-val">{data.supplier.razao_social}</strong>
              </div>
            ) : (
              <p className="empty-tab-text">Fornecedor/executora não identificado na fonte para esta obra.</p>
            )}
          </section>
        )}

        {/* ABA 4: DECISORES */}
        {activeTab === "decisores" && (
          <section className="card">
            <h3 className="card-title"><UserRound size={17} /> Decisores Mapeados</h3>
            {data.decisionMakers?.length ? (
              data.decisionMakers.map((d) => (
                <div key={d.source_id} className="info-row">
                  <strong>{d.nome}</strong> · {d.cargo || "Cargo não informado"}
                </div>
              ))
            ) : (
              <p className="empty-tab-text">Sem decisores mapeados na fonte oficial para esta obra.</p>
            )}
          </section>
        )}

        {/* ABA 5: OPORTUNIDADES */}
        {activeTab === "oportunidades" && (
          <section className="card">
            <h3 className="card-title"><Target size={17} /> Matches e Oportunidades</h3>
            {data.opportunities?.length ? (
              data.opportunities.map((o) => (
                <div key={o.source_id} className="info-row">
                  <strong>{o.fornecedor || o.cnpj}</strong> — Score: {o.score}%
                </div>
              ))
            ) : (
              <p className="empty-tab-text">Sem oportunidades vinculadas com score &ge; 70.</p>
            )}
          </section>
        )}

        {/* ABA 6: TERRITORIAL */}
        {activeTab === "territorial" && (
          <section className="card">
            <h3 className="card-title"><MapPin size={17} /> Recorte Territorial</h3>
            <p><strong>Município / UF:</strong> {data.municipality || "Curitiba"} / {data.state || "PR"}</p>
            <p className="empty-tab-text">Localização cadastral com base no centroide municipal IBGE.</p>
          </section>
        )}

        {/* ABA 7: EVENTOS */}
        {activeTab === "eventos" && (
          <section className="card">
            <h3 className="card-title"><Activity size={17} /> Histórico de Eventos</h3>
            <div className="info-row">
              <span className="info-label">{formatDate(data.publishedAt)}:</span>
              <strong className="info-val">Registro de obra capturado na fonte oficial</strong>
            </div>
          </section>
        )}

        {/* ABA 8: PROVENIÊNCIA */}
        {activeTab === "proveniencia" && (
          <section className="card">
            <h3 className="card-title"><Database size={17} /> Proveniência dos Dados</h3>
            <p><strong>Fonte:</strong> Barramento oficial — Engenharia</p>
            <p><strong>Endpoint:</strong> GET /api/v1/engenharia/obras/{data.sourceId}</p>
            <p><strong>Atualização da fonte:</strong> {formatTimestamp(data.provenance?.sourceUpdatedAt)}</p>
            <p><strong>Campos ausentes:</strong>{" "}
              {data.missingFields?.length
                ? data.missingFields.join(", ")
                : "Nenhum campo obrigatório ausente"}
            </p>
          </section>
        )}
      </div>
    </div>
  );
};
