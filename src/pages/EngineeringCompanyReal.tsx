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

type Occurrence = {
  source_id?: string;
  display_name?: string;
  entity_type?: string;
  municipality?: string;
  municipio?: string;
  uf?: string;
};
type Company = {
  cnpj: string;
  legalName?: string;
  tradeName?: string;
  status?: string;
  size?: string;
  capital?: number;
  address?: { municipality?: string; state?: string };
  works?: Array<{
    id: string;
    nome: string;
    municipio?: string;
    uf?: string;
    valor_estimado?: number;
    fase?: string;
  }>;
  supplierProfile?: { cnae_descricao?: string };
  decisionMakers?: Array<{
    id: string;
    nome: string;
    cargo?: string;
    obra_nome?: string;
  }>;
  opportunities?: Array<{
    source_id:string;
    obra_id: string;
    obra_nome?: string;
    score?: number;
  }>;
  crossVerticalOccurrences?: Record<string, Occurrence[]>;
  lastUpdatedAt?: string;
  provenance?: {
    sourceDatabase?: string;
    sourceSchema?: string;
    sourceTable?: string;
  };
};
const money = (v?: number) =>
  v == null
    ? "Não informado"
    : new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(v);
export const EngineeringCompanyReal: React.FC = () => {
  const { id } = useParams();
  const [data, setData] = useState<Company | null>();
  useEffect(() => {
    let active = true;
    if (id)
      httpClient
        .get<Company>(`/empresas/${id}`)
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
        <p>Carregando Empresa 360° real...</p>
      </div>
    );
  if (!data)
    return (
      <div className="empty-state error">
        <Building2 size={40} />
        <h2>Empresa não encontrada</h2>
        <Link className="btn btn-primary" to="/engenharia/empresas">
          Voltar
        </Link>
      </div>
    );
  return (
    <div className="engineering-page">
      <div className="detail-back">
        <Link to="/engenharia/empresas">
          <ArrowLeft size={14} /> Empresas relacionadas
        </Link>
        <span>Empresa 360° · fonte real</span>
      </div>
      <div className="company-hero">
        <div className="company-mark large">
          {(data.tradeName || data.legalName || "E").slice(0, 2).toUpperCase()}
        </div>
        <div>
          <div className="eyebrow">Cadastro de Engenharia</div>
          <h1>{data.legalName || "Razão social não informada"}</h1>
          <p>
            {data.tradeName || "Nome fantasia não informado"} · CNPJ {data.cnpj}
          </p>
          <div className="hero-location">
            <MapPin size={14} />
            {data.address?.municipality || "Município não informado"},{" "}
            {data.address?.state || "UF não informada"}
          </div>
        </div>
      </div>
      <div className="detail-metrics company-metrics">
        <div>
          <small>Capital social</small>
          <strong>{money(data.capital)}</strong>
        </div>
        <div>
          <small>Obras vinculadas</small>
          <strong>{data.works?.length || 0}</strong>
        </div>
        <div>
          <small>Decisores</small>
          <strong>{data.decisionMakers?.length || 0}</strong>
        </div>
        <div>
          <small>Oportunidades</small>
          <strong>{data.opportunities?.length || 0}</strong>
        </div>
      </div>
      <div className="company360-grid">
        <section className="card company-works">
          <div className="card-header">
            <h3 className="card-title">
              <HardHat size={17} /> Obras relacionadas
            </h3>
          </div>
          {data.works?.length ? (
            data.works.map((w) => (
              <Link to={`/engenharia/obras/${w.id}`} key={w.id}>
                <div>
                  <strong>{w.nome}</strong>
                  <small>
                    {w.municipio || "Município não informado"} ·{" "}
                    {money(w.valor_estimado)}
                  </small>
                </div>
              </Link>
            ))
          ) : (
            <p>Nenhuma obra vinculada.</p>
          )}
        </section>
        <section className="card">
          <div className="card-header">
            <h3 className="card-title">
              <UserRound size={17} /> Decisores
            </h3>
          </div>
          {data.decisionMakers?.length ? (
            data.decisionMakers.map((d) => (
              <p key={d.id}>
                <Link to={`/decisores/${d.id}`}>
                <strong>{d.nome}</strong> · {d.cargo || "Cargo não informado"}
                </Link>
                <br />
                <small>{d.obra_nome}</small>
              </p>
            ))
          ) : (
            <p>Não identificados.</p>
          )}
        </section>
        <section className="card">
          <div className="card-header">
            <h3 className="card-title">
              <Target size={17} /> Oportunidades
            </h3>
          </div>
          {data.opportunities?.length ? (
            data.opportunities.map((o) => (
              <p key={o.source_id}>
                <Link to={`/engenharia/oportunidades/${encodeURIComponent(o.source_id)}`}>
                <strong>{o.obra_nome || o.obra_id}</strong> · score{" "}
                {o.score ?? "não informado"}
                </Link>
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
          <small>Atualização: {data.lastUpdatedAt || "não informada"}</small>
        </section>
        {Object.entries(data.crossVerticalOccurrences || {}).map(([vertical, rows]) => (
          <section className="card" key={vertical} data-testid={`empresa360-${vertical}`}>
            <h3 className="card-title">Ocorrências em {vertical}</h3>
            {rows.length ? rows.map((row, index) => (
              <div className="related-row" key={`${row.source_id}-${index}`}>
                <Building2 size={15}/>
                <span><strong>{row.display_name || row.source_id}</strong><small>{row.entity_type || 'vínculo por CNPJ confirmado'} · {row.municipality || row.municipio || 'município não identificado'} {row.uf || ''}</small></span>
              </div>
            )) : <p>Não identificado.</p>}
          </section>
        ))}
      </div>
    </div>
  );
};
