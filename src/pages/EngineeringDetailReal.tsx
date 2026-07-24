// Official Engineering Work Detail Module (:obraId real)
import React, { useEffect, useState } from "react";
import {
  ArrowLeft,
  Building2,
  HardHat,
  MapPin,
  Target,
  UserRound,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { httpClient } from "../services/http/client";

type Detail = {
  sourceId: string;
  name: string;
  description?: string;
  municipality?: string;
  state?: string;
  status?: string;
  phase?: string;
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

export const EngineeringWorkDetailReal: React.FC = () => {
  const { id } = useParams();
  const [data, setData] = useState<Detail | null>();
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
  if (data === undefined)
    return (
      <div className="loading-container">
        <div className="spinner" />
        <p>Carregando obra real...</p>
      </div>
    );
  if (!data)
    return (
      <div className="empty-state error">
        <HardHat size={40} />
        <h2>Obra não encontrada na fonte</h2>
        <Link className="btn btn-primary" to="/engenharia/obras">
          Voltar
        </Link>
      </div>
    );
  return (
    <div className="engineering-page">
      <div className="detail-back">
        <Link to="/engenharia/obras">
          <ArrowLeft size={14} /> Voltar à carteira
        </Link>
        <span>ID real {data.sourceId}</span>
      </div>
      <div className="work-hero">
        <div>
          <div className="hero-badges">
            <span className="badge badge-blue">
              {data.status || "Status não informado"}
            </span>
            <span className="sector-tag">
              {data.phase || "Fase não informada"}
            </span>
          </div>
          <h1>{data.name}</h1>
          <p>{data.description || "Descrição não informada na fonte."}</p>
          <div className="hero-location">
            <MapPin size={15} />
            {data.municipality || "Município não informado"},{" "}
            {data.state || "UF não informada"}
          </div>
        </div>
      </div>
      <div className="detail-metrics">
        <div>
          <small>Valor</small>
          <strong>{money(data.value)}</strong>
        </div>
        <div>
          <small>Órgão/empresa</small>
          <strong>{data.company?.name || "Não informado"}</strong>
        </div>
        <div>
          <small>Publicação</small>
          <strong>{data.publishedAt || "Não informada"}</strong>
        </div>
        <div>
          <small>Atualização</small>
          <strong>{data.provenance?.sourceUpdatedAt || "Não informada"}</strong>
        </div>
      </div>
      <div className="detail-grid">
        <div>
          <section className="card">
            <div className="card-header">
              <h3 className="card-title">Cronograma disponível</h3>
              <span className="metric-chip">
                {data.phase || "Fase não informada"}
              </span>
            </div>
            <p>
              <strong>Início existente:</strong>{" "}
              {data.publishedAt || "Não informado"}
            </p>
            <p>
              <strong>Previsão existente:</strong>{" "}
              {data.deadline || "Não informada"}
            </p>
            <p>
              <strong>Última atualização:</strong>{" "}
              {data.lastUpdatedAt ||
                data.provenance?.sourceUpdatedAt ||
                "Não informada"}
            </p>
            <p className="value-unavailable">
              Cronograma detalhado não disponível na fonte.
            </p>
          </section>
          <section className="card">
            <div className="card-header">
              <h3 className="card-title">
                <Building2 size={17} /> Empresas e fornecedores
              </h3>
            </div>
            <p>
              <strong>Contratante:</strong>{" "}
              {data.company?.name || "Não informado"}
              {data.company?.cnpj && (
                <>
                  {" "}
                  ·{" "}
                  <Link to={`/empresas/${data.company.cnpj}`}>
                    CNPJ {data.company.cnpj}
                  </Link>
                </>
              )}
            </p>
            <p>
              <strong>Fornecedor/executora:</strong>{" "}
              {data.supplier?.source_id?<Link to={`/fornecedores/${data.supplier.source_id}`}>{data.supplier.razao_social||data.supplier.source_id}</Link>:(data.supplier?.razao_social || "Não identificado na fonte")}
            </p>
          </section>
          <section className="card">
            <div className="card-header">
              <h3 className="card-title">
                <UserRound size={17} /> Decisores
              </h3>
              <span>{data.decisionMakers?.length || 0}</span>
            </div>
            {data.decisionMakers?.length ? (
              data.decisionMakers.map((d) => (
                <p key={d.source_id}>
                  <Link to={`/decisores/${d.source_id}`}><strong>{d.nome}</strong></Link> · {d.cargo || "Cargo não informado"}
                  <br />
                  <small>Fonte: {d.fonte || "não informada"}</small>
                </p>
              ))
            ) : (
              <p>Não identificado na fonte.</p>
            )}
          </section>
        </div>
        <aside>
          <section className="card">
            <div className="card-header">
              <h3 className="card-title">
                <Target size={17} /> Oportunidades
              </h3>
              <span>{data.opportunities?.length || 0}</span>
            </div>
            {data.opportunities?.length ? (
              data.opportunities.map((o) => (
                <p key={o.source_id}>
                  <Link to={`/engenharia/oportunidades/${encodeURIComponent(o.source_id)}`}>
                  <strong>
                    {o.fornecedor || o.cnpj || "Fornecedor não informado"}
                  </strong>
                  </Link>
                  <br />
                  <small>Score real: {o.score ?? "não informado"}</small>
                  {o.cnpj&&<><br/><Link to={`/fornecedores/${o.cnpj}`}>Abrir fornecedor relacionado</Link></>}
                </p>
              ))
            ) : (
              <p>Nenhuma oportunidade identificada.</p>
            )}
          </section>
          <section className="card">
            <h3 className="card-title">Proveniência</h3>
            <p>
              {data.provenance?.sourceDatabase}.{data.provenance?.sourceSchema}.
              {data.provenance?.sourceTable}
            </p>
            <small>
              Campos ausentes:{" "}
              {data.missingFields?.length
                ? data.missingFields.join(", ")
                : "nenhum campo obrigatório ausente"}
            </small>
          </section>
        </aside>
      </div>
    </div>
  );
};
