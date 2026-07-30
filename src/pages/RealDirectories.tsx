import React, { useEffect, useMemo, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { ArrowLeft, Database, MapPin, RefreshCw, Search } from "lucide-react";
import { httpClient } from "../services/http/client";

type DirectoryRow = {
  source_id: string;
  display_name?: string;
  source?: string;
  source_updated_at?: string;
  detail_path?: string;
  [key: string]: any;
};
type DirectoryResponse = {
  items: DirectoryRow[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    returned: number;
    source: string;
    lastUpdatedAt?: string;
    serverSide: boolean;
  };
};

export const REAL_DIRECTORIES: Record<
  string,
  { title: string; vertical: string }
> = {
  "agro/imoveis": { title: "Imóveis CAR", vertical: "Agro" },
  "agro/produtores": { title: "Produtores declarados", vertical: "Agro" },
  "agro/fazendas": { title: "Fazendas e áreas rurais", vertical: "Agro" },
  "agro/holdings": { title: "Holdings rurais", vertical: "Agro" },
  "agro/agronomos": { title: "Engenheiros agrônomos", vertical: "Agro" },
  "agro/zootecnistas": { title: "Zootecnistas", vertical: "Agro" },
  "agro/veterinarios-nominais": {
    title: "Registros nominais veterinários",
    vertical: "Agro",
  },
  "agro/empresas-veterinarias": {
    title: "Empresas veterinárias",
    vertical: "Agro",
  },
  "agro/estabelecimentos-veterinarios": {
    title: "Estabelecimentos veterinários",
    vertical: "Agro",
  },
  "agro/reprodutores": { title: "Reprodutores", vertical: "Agro" },
  "agro/touros-central": { title: "Touros de central", vertical: "Agro" },
  "agro/doadoras": { title: "Doadoras", vertical: "Agro" },
  "agro/embrioes": { title: "Embriões", vertical: "Agro" },
  "agro/avaliacoes-geneticas": {
    title: "Avaliações genéticas",
    vertical: "Agro",
  },
  "logistica/transportadores": {
    title: "Transportadores RNTRC",
    vertical: "Logística",
  },
  "logistica/agregados-municipais": {
    title: "Agregados municipais RNTRC",
    vertical: "Logística",
  },
  "logistica/empresas": {
    title: "Empresas logísticas agregadas",
    vertical: "Logística",
  },
  "logistica/postos": { title: "Postos ANP", vertical: "Logística" },
  "logistica/bases-apoio": { title: "Bases de apoio", vertical: "Logística" },
  "logistica/pedagios": { title: "Pedágios", vertical: "Logística" },
  "logistica/rodovias": { title: "Rodovias concedidas", vertical: "Logística" },
  "logistica/riscos-rota": { title: "Riscos de rota", vertical: "Logística" },
  "saude/estabelecimentos": {
    title: "Estabelecimentos CNES",
    vertical: "Saúde",
  },
  "saude/mantenedoras": { title: "Empresas mantenedoras", vertical: "Saúde" },
  "saude/medicos": { title: "Médicos", vertical: "Saúde" },
  "saude/operadoras": { title: "Operadoras ANS", vertical: "Saúde" },
  "saude/capacidade-municipal": {
    title: "Capacidade municipal, leitos, UTI e equipamentos",
    vertical: "Saúde",
  },
  "saude/desertos-medicos": { title: "Desertos médicos", vertical: "Saúde" },
  "saude/mercado": { title: "Mercado de saúde", vertical: "Saúde" },
  "saude/oportunidades": {
    title: "Oportunidades de investimento",
    vertical: "Saúde",
  },
};

const shown = (row: DirectoryRow) =>
  Object.entries(row)
    .filter(
      ([k, v]) =>
        ![
          "source_id",
          "display_name",
          "detail_path",
          "source",
          "source_updated_at",
        ].includes(k) &&
        v !== null &&
        v !== "" &&
        typeof v !== "object",
    )
    .slice(0, 5);
const fmt = (v: unknown) =>
  typeof v === "boolean"
    ? v
      ? "Sim"
      : "Não"
    : String(v ?? "não identificado");
const fmtDate = (value: unknown) => {
  if (!value) return "não informada na fonte";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleString("pt-BR");
};

export const DirectoryLinks: React.FC<{
  vertical: "agro" | "logistica" | "saude";
}> = ({ vertical }) => (
  <div
    className="card"
    style={{ padding: "1rem", marginBottom: "1rem" }}
    data-testid={`${vertical}-directory-links`}
  >
    <h3>Todos os conjuntos reais disponíveis</h3>
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: ".5rem",
        marginTop: ".75rem",
      }}
    >
      {Object.entries(REAL_DIRECTORIES)
        .filter(([k]) => k.startsWith(`${vertical}/`))
        .map(([k, v]) => (
          <Link
            className="btn btn-outline"
            key={k}
            to={`/${k.split("/")[0]}/diretorios/${k.split("/")[1]}`}
          >
            {v.title}
          </Link>
        ))}
    </div>
  </div>
);

export const RealDirectoryPage: React.FC = () => {
  const { vertical = "", entity = "" } = useParams();
  const key = `${vertical}/${entity}`;
  const config = REAL_DIRECTORIES[key];
  const [sp, setSp] = useSearchParams();
  const [draft, setDraft] = useState(sp.get("search") || "");
  const page = Math.max(1, Number(sp.get("page") || 1));
  const [data, setData] = useState<DirectoryResponse>();
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const params = useMemo(
    () => ({
      page,
      page_size: 25,
      search: sp.get("search") || undefined,
      uf: sp.get("uf") || undefined,
      municipality: sp.get("municipality") || undefined,
      sort: sp.get("sort") || "updated_desc",
    }),
    [page, sp],
  );
  useEffect(() => {
    let live = true;
    setError("");
    setData(undefined);
    httpClient
      .get<DirectoryResponse>(`/diretorios/${vertical}/${entity}`, { params })
      .then((r) => live && setData(r.data))
      .catch(
        (e) =>
          live && setError(e?.message || "Falha ao consultar a fonte real"),
      );
    return () => {
      live = false;
    };
  }, [vertical, entity, params, retry]);
  if (!config)
    return (
      <div className="empty-state">
        <h2>Diretório não identificado</h2>
      </div>
    );
  const pages = data
    ? Math.max(1, Math.ceil(data.meta.total / data.meta.pageSize))
    : 1;
  return (
    <div className="hub-page" data-testid="real-directory">
      <div className="screen-header">
        <div>
          <div className="eyebrow">
            <Database size={14} /> {config.vertical} · diretório real
          </div>
          <h1>{config.title}</h1>
          <p>Busca, filtros, ordenação e paginação executados no backend.</p>
        </div>
      </div>
      <form
        className="works-toolbar"
        onSubmit={(e) => {
          e.preventDefault();
          setSp((p) => {
            p.set("page", "1");
            draft ? p.set("search", draft) : p.delete("search");
            return p;
          });
        }}
      >
        <label className="search-field">
          <Search size={15} />
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Buscar nesta fonte real"
          />
        </label>
        <input
          value={sp.get("municipality") || ""}
          onChange={(e) =>
            setSp((p) => {
              e.target.value
                ? p.set("municipality", e.target.value)
                : p.delete("municipality");
              p.set("page", "1");
              return p;
            })
          }
          placeholder="Município"
        />
        <input
          value={sp.get("uf") || ""}
          maxLength={2}
          onChange={(e) =>
            setSp((p) => {
              e.target.value
                ? p.set("uf", e.target.value.toUpperCase())
                : p.delete("uf");
              p.set("page", "1");
              return p;
            })
          }
          placeholder="UF"
        />
        <select
          value={sp.get("sort") || "updated_desc"}
          onChange={(e) =>
            setSp((p) => {
              p.set("sort", e.target.value);
              return p;
            })
          }
        >
          <option value="updated_desc">Atualização mais recente</option>
          <option value="updated_asc">Atualização mais antiga</option>
          <option value="name_asc">Nome A–Z</option>
          <option value="name_desc">Nome Z–A</option>
        </select>
        <button className="btn btn-primary">Buscar</button>
      </form>
      {error && (
        <div className="empty-state error">
          <h3>Erro ao carregar dados reais</h3>
          <p>{error}</p>
          <button
            className="btn btn-primary"
            onClick={() => setRetry((x) => x + 1)}
          >
            <RefreshCw size={14} /> Tentar novamente
          </button>
        </div>
      )}
      {!data && !error && (
        <div className="loading-container">
          <div className="spinner" />
          <p>Consultando fonte real...</p>
        </div>
      )}
      {data && (
        <>
          <div className="wave1-source">
            <Database />
            <b>{data.meta.total.toLocaleString("pt-BR")} registros</b>
            <small>
              {data.meta.source} · atualização{" "}
              {fmtDate(data.meta.lastUpdatedAt)}
            </small>
          </div>
          <div className="card table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Entidade</th>
                  <th>Dados reais</th>
                  <th>Fonte / atualização</th>
                  <th>Detalhe</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((r, i) => (
                  <tr key={`${r.source_id}-${i}`}>
                    <td>
                      <strong>{r.display_name || r.source_id}</strong>
                      <small>{r.source_id}</small>
                    </td>
                    <td>
                      {shown(r).map(([k, v]) => (
                        <small style={{ display: "block" }} key={k}>
                          <b>{k.replaceAll("_", " ")}:</b> {fmt(v)}
                        </small>
                      ))}
                    </td>
                    <td>
                      {r.source}
                      <small>{fmtDate(r.source_updated_at)}</small>
                    </td>
                    <td>
                      <Link className="table-open" to={r.detail_path || "#"}>
                        Abrir
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.items.length && (
              <div className="empty-state">
                <h3>Nenhum registro no recorte</h3>
                <p>A fonte respondeu corretamente; ajuste os filtros.</p>
              </div>
            )}
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: "1rem",
            }}
          >
            <button
              className="btn btn-outline"
              disabled={page <= 1}
              onClick={() =>
                setSp((p) => {
                  p.set("page", String(page - 1));
                  return p;
                })
              }
            >
              Anterior
            </button>
            <span>
              Página {page} de {pages} · {data.meta.returned} exibidos
            </span>
            <button
              className="btn btn-outline"
              disabled={page >= pages}
              onClick={() =>
                setSp((p) => {
                  p.set("page", String(page + 1));
                  return p;
                })
              }
            >
              Próxima
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export const RealDirectoryDetail: React.FC = () => {
  const { vertical = "", entity = "", sourceId = "" } = useParams();
  const [detailSearch] = useSearchParams();
  const originCnes = detailSearch.get("originCnes");
  const config = REAL_DIRECTORIES[`${vertical}/${entity}`];
  const [data, setData] = useState<DirectoryRow>();
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    setError("");
    httpClient
      .get<DirectoryRow>(
        `/diretorios/${vertical}/${entity}/${encodeURIComponent(sourceId)}`,
      )
      .then((r) => setData(r.data))
      .catch((e) => setError(e?.message || "Falha ao consultar detalhe real"));
  }, [vertical, entity, sourceId, retry]);
  return (
    <div className="hub-page" data-testid="real-directory-detail">
      <Link to={`/${vertical}/diretorios/${entity}`} className="btn btn-ghost">
        <ArrowLeft size={14} /> Voltar ao diretório
      </Link>
      <div className="screen-header">
        <div>
          <div className="eyebrow">
            <Database size={14} /> {config?.vertical || vertical} · detalhe real
          </div>
          <h1>{data?.display_name || config?.title || "Entidade"}</h1>
          <p>Registro individual conforme disponibilizado pela fonte.</p>
        </div>
      </div>
      {error && (
        <div className="empty-state error">
          <h3>Erro ao carregar detalhe</h3>
          <p>{error}</p>
          <button
            className="btn btn-primary"
            onClick={() => setRetry((x) => x + 1)}
          >
            Tentar novamente
          </button>
        </div>
      )}
      {!data && !error && (
        <div className="loading-container">
          <div className="spinner" />
        </div>
      )}
      {data && (
        <>
          <div className="wave1-source">
            <Database />
            <b>{data.source}</b>
            <small>Atualização {fmtDate(data.source_updated_at)}</small>
          </div>
          <div className="card" style={{ padding: "1rem" }}>
            {Object.entries(data)
              .filter(
                ([k]) =>
                  !["relationship", "relations", "detail_path"].includes(k),
              )
              .map(([k, v]) => (
                <div
                  key={k}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "220px 1fr",
                    padding: ".55rem",
                    borderBottom: "1px solid var(--color-border)",
                  }}
                >
                  <strong>{k.replaceAll("_", " ")}</strong>
                  <span>{fmt(v)}</span>
                </div>
              ))}
          </div>
          <div className="card" style={{ padding: "1rem", marginTop: "1rem" }}>
            <h3>Vínculo entre entidades</h3>
            <p>
              <b>
                {(data.relationship as any)?.classification ||
                  "NÃO IDENTIFICADO"}
              </b>{" "}
              · {(data.relationship as any)?.rule}
            </p>
            <div style={{ display: "flex", gap: ".5rem", marginTop: ".75rem" }}>
              {(data.relations || []).map((relation: any, index: number) => (
                <Link
                  className="btn btn-outline"
                  to={relation.path}
                  key={`${relation.path}-${index}`}
                  title={`${relation.classification} · ${relation.rule} · confiança ${relation.confidence}%`}
                >
                  <MapPin size={14} />
                  {relation.label} · {relation.classification}
                </Link>
              ))}
              {vertical === "saude" && entity === "medicos" && originCnes && (
                <Link
                  className="btn btn-outline"
                  to={`/saude/estabelecimentos/${originCnes}`}
                  title="PROVÁVEL · profissional disponível no mesmo município/UF"
                >
                  <MapPin size={14} /> Voltar ao CNES de origem · PROVÁVEL
                </Link>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export const GlobalSearchPage: React.FC = () => {
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const q = sp.get("q") || "";
  const [groups, setGroups] = useState<any[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    if (q.length < 2) {
      setGroups([]);
      return;
    }
    httpClient
      .get("/busca-global", { params: { q } })
      .then((r) => setGroups(r.data.groups || []))
      .catch((e) => setError(e?.message || "Falha na busca real"));
  }, [q]);
  return (
    <div className="hub-page" data-testid="global-search">
      <div className="screen-header">
        <div>
          <div className="eyebrow">
            <Search size={14} /> Busca global real
          </div>
          <h1>Resultados para “{q}”</h1>
          <p>
            Agrupados por entidade e vertical; cada resultado abre seu registro
            real.
          </p>
        </div>
      </div>
      {error && (
        <div className="empty-state error">
          <p>{error}</p>
        </div>
      )}
      {groups.map((g) => (
        <div
          className="card"
          style={{ padding: "1rem", marginBottom: "1rem" }}
          key={g.key}
        >
          <h3>
            {REAL_DIRECTORIES[g.key]?.title || g.key}{" "}
            <small>· {g.vertical}</small>
          </h3>
          {g.items.map((r: any, i: number) => (
            <button
              key={i}
              className="btn btn-ghost"
              style={{
                display: "flex",
                width: "100%",
                justifyContent: "space-between",
              }}
              onClick={() => nav(r.detail_path)}
            >
              <span>{r.display_name || r.source_id}</span>
              <small>{g.source}</small>
            </button>
          ))}
        </div>
      ))}
      {q.length >= 2 && !groups.length && !error && (
        <div className="empty-state">
          <h3>Nenhuma entidade encontrada</h3>
        </div>
      )}
    </div>
  );
};
