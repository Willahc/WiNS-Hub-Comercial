import React, { useEffect, useState } from "react";
import { Building2, Search, ShieldCheck, Users } from "lucide-react";
import { httpClient } from "../services/http/client";
import {Link} from 'react-router-dom';

type Page<T> = {
  items: T[];
  meta: {
    total: number;
    source: string;
    lastUpdatedAt?: string;
    partialData: boolean;
  };
};
type Supplier = {
  source_id: string;
  razao_social?: string;
  nome_fantasia?: string;
  cnpj?: string;
  municipio?: string;
  uf?: string;
  cnae_descricao?: string;
  matches_count?: number;
  qualityScore: number;
};
type DecisionMaker = {
  source_id: string;
  nome: string;
  cargo?: string;
  obra_nome: string;
  company_id?: string;
  email?: string;
  telefone?: string;
  fonte?: string;
  contactClassification: string;
  sensitiveFieldsMasked: boolean;
  qualityScore: number;
};

function useRealPage<T>(path: string, query: string) {
  const [state, setState] = useState<{
    data?: Page<T>;
    error?: string;
    loading: boolean;
  }>({ loading: true });
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      setState({ loading: true });
      httpClient
        .get<Page<T>>(path, {
          params: { page: 1, page_size: 50, search: query || undefined },
        })
        .then((r) => active && setState({ data: r.data, loading: false }))
        .catch(
          (e) =>
            active &&
            setState({
              error: e instanceof Error ? e.message : "Falha na API real",
              loading: false,
            }),
        );
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [path, query]);
  return state;
}
const State = ({ loading, error }: { loading: boolean; error?: string }) =>
  loading ? (
    <div className="loading-container">
      <div className="spinner" />
      <p>Consultando fonte real...</p>
    </div>
  ) : error ? (
    <div className="state-error">
      <h3>Falha ao carregar dados reais</h3>
      <p>{error}</p>
    </div>
  ) : null;

export const SuppliersPage: React.FC = () => {
  const [query, setQuery] = useState("");
  const { data, error, loading } = useRealPage<Supplier>(
    "/fornecedores",
    query,
  );
  return (
    <div className="hub-page">
      <div className="screen-header">
        <div>
          <div className="eyebrow">
            <Building2 size={13} /> Onda 1 · Engenharia
          </div>
          <h1>Fornecedores reais</h1>
          <p>Cadastro pesquisável e reconciliado por CNPJ</p>
        </div>
      </div>
      <div className="module-toolbar">
        <label>
          <Search size={14} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar razão social ou nome fantasia..."
          />
        </label>
      </div>
      <State loading={loading} error={error} />
      {data && (
        <>
          <div className="wave1-source">
            <ShieldCheck />
            <b>{data.meta.total.toLocaleString("pt-BR")} fornecedores ativos</b>
            <small>{data.meta.source} · dados parciais sinalizados</small>
          </div>
          <div className="card table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fornecedor</th>
                  <th>CNPJ</th>
                  <th>Município</th>
                  <th>Segmento</th>
                  <th>Matches</th>
                  <th>Qualidade</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((x) => (
                  <tr key={x.source_id}>
                    <td>
                      <Link to={`/fornecedores/${x.source_id}`}><strong>
                        {x.nome_fantasia || x.razao_social || "Sem nome"}
                      </strong></Link>
                      <small>{x.razao_social}</small>
                    </td>
                    <td>{x.source_id}</td>
                    <td>
                      {x.municipio || "Não informado"}, {x.uf || "—"}
                    </td>
                    <td>{x.cnae_descricao || "Não classificado"}</td>
                    <td>{x.matches_count || 0}</td>
                    <td>{x.qualityScore}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.items.length && (
              <div className="empty-state">
                <h3>Nenhum fornecedor encontrado</h3>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export const DecisionMakersPage: React.FC = () => {
  const [query, setQuery] = useState("");
  const { data, error, loading } = useRealPage<DecisionMaker>(
    "/decisores",
    query,
  );
  return (
    <div className="hub-page">
      <div className="screen-header">
        <div>
          <div className="eyebrow">
            <Users size={13} /> Onda 1 · acesso controlado
          </div>
          <h1>Decisores</h1>
          <p>
            Vínculos públicos de Engenharia com contatos pessoais mascarados
          </p>
        </div>
      </div>
      <div className="module-toolbar">
        <label>
          <Search size={14} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar decisor..."
          />
        </label>
      </div>
      <State loading={loading} error={error} />
      {data && (
        <>
          <div className="wave1-source">
            <ShieldCheck />
            <b>{data.meta.total.toLocaleString("pt-BR")} decisores ativos</b>
            <small>{data.meta.source} · acesso auditado</small>
          </div>
          <div className="card table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Cargo</th>
                  <th>Obra / empresa</th>
                  <th>E-mail</th>
                  <th>Telefone</th>
                  <th>Classificação</th>
                  <th>Qualidade</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((x) => (
                  <tr key={x.source_id}>
                    <td>
                      <Link to={`/decisores/${x.source_id}`}><strong>{x.nome}</strong></Link>
                    </td>
                    <td>{x.cargo || "Não informado"}</td>
                    <td>
                      {x.obra_nome}
                      <small>{x.company_id || "Empresa sem CNPJ"}</small>
                    </td>
                    <td>{x.email || "Não disponível"}</td>
                    <td>{x.telefone || "Não disponível"}</td>
                    <td>
                      <span className="badge badge-blue">
                        {x.contactClassification}
                      </span>
                    </td>
                    <td>{x.qualityScore}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.items.length && (
              <div className="empty-state">
                <h3>Nenhum decisor encontrado</h3>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
