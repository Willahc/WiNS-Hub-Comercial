import React, { useEffect, useState } from "react";
import { ArrowLeft, Building2, HardHat, Target, UserRound } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { httpClient } from "../services/http/client";

const Load = () => (
  <div className="loading-container">
    <div className="spinner" />
    <p>Consultando fonte real...</p>
  </div>
);
const ErrorState = ({ back }: { back: string }) => (
  <div className="empty-state error">
    <h2>Registro não encontrado</h2>
    <Link className="btn btn-primary" to={back}>
      Voltar
    </Link>
  </div>
);

type Supplier = {
  cnpj: string;
  legalName?: string;
  tradeName?: string;
  segment?: string;
  municipality?: string;
  state?: string;
  activeStatus: boolean;
  lastUpdatedAt?: string;
  matches: Array<{
    obra_id: string;
    nome: string;
    score: number;
    gerado_em?: string;
    opportunity_id: string;
  }>;
  provenance: any;
};
export const SupplierDetail: React.FC = () => {
  const { id } = useParams();
  const [data, setData] = useState<Supplier | null>();
  useEffect(() => {
    if (id)
      httpClient
        .get<Supplier>(`/fornecedores/${id}`)
        .then((r) => setData(r.data))
        .catch(() => setData(null));
  }, [id]);
  if (data === undefined) return <Load />;
  if (!data) return <ErrorState back="/fornecedores" />;
  return (
    <div className="engineering-page" data-testid="supplier-detail">
      <div className="detail-back">
        <Link to="/fornecedores">
          <ArrowLeft size={14} /> Fornecedores
        </Link>
        <span>Fornecedor · fonte real</span>
      </div>
      <div className="company-hero">
        <Building2 size={42} />
        <div>
          <div className="eyebrow">Fornecedor de Engenharia</div>
          <h1>{data.tradeName || data.legalName}</h1>
          <p>
            {data.legalName} · CNPJ {data.cnpj}
          </p>
          <Link to={`/empresas/${data.cnpj}`}>Abrir Empresa 360°</Link>
        </div>
      </div>
      <div className="detail-metrics">
        <div>
          <small>Situação</small>
          <strong>{data.activeStatus ? "Ativa" : "Não ativa"}</strong>
        </div>
        <div>
          <small>Segmento</small>
          <strong>{data.segment || "Não identificado"}</strong>
        </div>
        <div>
          <small>Município</small>
          <strong>
            {data.municipality || "Não identificado"}, {data.state || "—"}
          </strong>
        </div>
        <div>
          <small>Atualização</small>
          <strong>{data.lastUpdatedAt || "Não informada"}</strong>
        </div>
      </div>
      <section className="card" style={{ padding: "1rem" }}>
        <h3>
          <Target size={17} /> Oportunidades e obras relacionadas
        </h3>
        {data.matches.length ? (
          data.matches.map((m) => (
            <div className="related-row" key={m.opportunity_id}>
              <Target size={15} />
              <span>
                <strong>{m.nome}</strong>
                <small>
                  Score {m.score} · vínculo PROVÁVEL por match comercial
                </small>
              </span>
              <div style={{ display: "flex", gap: ".5rem" }}>
                <Link
                  className="btn btn-outline"
                  to={`/engenharia/oportunidades/${encodeURIComponent(m.opportunity_id)}`}
                >
                  Oportunidade
                </Link>
                <Link
                  className="btn btn-outline"
                  to={`/engenharia/obras/${m.obra_id}`}
                >
                  <HardHat size={14} /> Obra
                </Link>
              </div>
            </div>
          ))
        ) : (
          <p>Nenhuma oportunidade identificada.</p>
        )}
      </section>
      <section className="card" style={{ padding: "1rem", marginTop: "1rem" }}>
        <h3>Proveniência</h3>
        <p>
          {data.provenance?.sourceSchema}.{data.provenance?.sourceTable}
        </p>
      </section>
    </div>
  );
};

type Decision = {
  source_id: string;
  nome: string;
  cargo?: string;
  email?: string;
  telefone?: string;
  fonte?: string;
  work_id: string;
  work_name: string;
  company_cnpj?: string;
  company_name?: string;
  municipio?: string;
  uf?: string;
  source_updated_at?: string;
  sensitiveFieldsMasked: boolean;
  relationship: any;
};
export const DecisionMakerDetail: React.FC = () => {
  const { id } = useParams();
  const [data, setData] = useState<Decision | null>();
  useEffect(() => {
    if (id)
      httpClient
        .get<Decision>(`/decisores/${id}`)
        .then((r) => setData(r.data))
        .catch(() => setData(null));
  }, [id]);
  if (data === undefined) return <Load />;
  if (!data) return <ErrorState back="/decisores" />;
  return (
    <div className="engineering-page" data-testid="decision-maker-detail">
      <div className="detail-back">
        <Link to="/decisores">
          <ArrowLeft size={14} /> Decisores
        </Link>
        <span>Decisor · acesso controlado</span>
      </div>
      <div className="company-hero">
        <UserRound size={42} />
        <div>
          <div className="eyebrow">Pessoa vinculada à obra</div>
          <h1>{data.nome}</h1>
          <p>
            {data.cargo || "Cargo não informado"} ·{" "}
            {data.municipio || "Município não informado"}, {data.uf || "—"}
          </p>
        </div>
      </div>
      <div className="detail-metrics">
        <div>
          <small>E-mail</small>
          <strong>{data.email || "Não disponível"}</strong>
        </div>
        <div>
          <small>Telefone</small>
          <strong>{data.telefone || "Não disponível"}</strong>
        </div>
        <div>
          <small>Fonte</small>
          <strong>{data.fonte || "Não informada"}</strong>
        </div>
        <div>
          <small>Atualização</small>
          <strong>{data.source_updated_at || "Não informada"}</strong>
        </div>
      </div>
      <section className="card" style={{ padding: "1rem" }}>
        <h3>Vínculos confirmados</h3>
        <p>
          <b>{data.relationship.classification}</b> · {data.relationship.rule} ·
          confiança {data.relationship.confidence}%
        </p>
        <div style={{ display: "flex", gap: ".5rem" }}>
          <Link
            className="btn btn-outline"
            to={`/engenharia/obras/${data.work_id}`}
          >
            <HardHat size={14} /> {data.work_name}
          </Link>
          {data.company_cnpj && (
            <Link
              className="btn btn-outline"
              to={`/empresas/${data.company_cnpj}`}
            >
              <Building2 size={14} /> {data.company_name || "Empresa 360°"}
            </Link>
          )}
        </div>
      </section>
    </div>
  );
};

type Opportunity = {
  source_id: string;
  work_id: string;
  work_name: string;
  cnpj: string;
  supplier_name?: string;
  nome_fantasia?: string;
  score: number;
  score_breakdown?: any;
  municipio?: string;
  uf?: string;
  source_updated_at?: string;
  relationship: any;
};
export const EngineeringOpportunityDetail: React.FC = () => {
  const { id } = useParams();
  const [data, setData] = useState<Opportunity | null>();
  useEffect(() => {
    if (id)
      httpClient
        .get<Opportunity>(`/engenharia/oportunidades/${encodeURIComponent(id)}`)
        .then((r) => setData(r.data))
        .catch(() => setData(null));
  }, [id]);
  if (data === undefined) return <Load />;
  if (!data) return <ErrorState back="/oportunidades" />;
  return (
    <div
      className="engineering-page"
      data-testid="engineering-opportunity-detail"
    >
      <div className="detail-back">
        <Link to={`/fornecedores/${data.cnpj}`}>
          <ArrowLeft size={14} /> Fornecedor
        </Link>
        <span>Oportunidade real</span>
      </div>
      <div className="work-hero">
        <div>
          <div className="eyebrow">Match comercial de Engenharia</div>
          <h1>{data.supplier_name || data.nome_fantasia || data.cnpj}</h1>
          <p>Oportunidade vinculada à obra {data.work_name}</p>
        </div>
      </div>
      <div className="detail-metrics">
        <div>
          <small>Score</small>
          <strong>{data.score}</strong>
        </div>
        <div>
          <small>Classificação</small>
          <strong>{data.relationship.classification}</strong>
        </div>
        <div>
          <small>Confiança</small>
          <strong>{data.relationship.confidence}%</strong>
        </div>
        <div>
          <small>Atualização</small>
          <strong>{data.source_updated_at || "Não informada"}</strong>
        </div>
      </div>
      <section className="card" style={{ padding: "1rem" }}>
        <h3>Navegação da oportunidade</h3>
        <p>{data.relationship.rule}</p>
        <div style={{ display: "flex", gap: ".5rem" }}>
          <Link
            className="btn btn-outline"
            to={`/engenharia/obras/${data.work_id}`}
          >
            <HardHat size={14} /> Obra relacionada
          </Link>
          <Link className="btn btn-outline" to={`/fornecedores/${data.cnpj}`}>
            <Building2 size={14} /> Fornecedor
          </Link>
          <Link className="btn btn-outline" to={`/empresas/${data.cnpj}`}>
            <Building2 size={14} /> Empresa 360°
          </Link>
        </div>
      </section>
    </div>
  );
};
