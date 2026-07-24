import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Database, MapPin, RefreshCw, Search } from "lucide-react";
import { httpClient } from "../services/http/client";

const labels: Record<string, string> = {
  works: "Obras e investimento homologado",
  ruralProperties: "Imóveis rurais e produtores potenciais",
  technicians: "Técnicos",
  carriers: "Transportadores",
  fuelStations: "Postos ANP",
  healthEstablishments: "Estabelecimentos de saúde",
  capacity: "Capacidade, leitos, UTI e equipamentos",
  opportunities: "Oportunidades",
};
const paths: Record<string, (id: string) => string> = {
  works: (id) => `/engenharia/obras/${id}`,
  ruralProperties: (id) => `/agro/imoveis/${id}`,
  technicians: (id) => `/agro/diretorios/agronomos/${id}`,
  carriers: (id) => `/logistica/diretorios/transportadores/${id}`,
  fuelStations: (id) => `/logistica/diretorios/postos/${id}`,
  healthEstablishments: (id) => `/saude/estabelecimentos/${id}`,
};

export const TerritorialReal: React.FC = () => {
  const [sp, setSp] = useSearchParams();
  const [municipality, setMunicipality] = useState(
    sp.get("municipality") || "São Paulo",
  );
  const [uf, setUf] = useState(sp.get("uf") || "SP");
  const [data, setData] = useState<any>();
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const m = sp.get("municipality") || "São Paulo";
    const state = sp.get("uf") || "SP";
    setData(undefined);
    setError("");
    httpClient
      .get("/territorios/municipio", { params: { municipality: m, uf: state } })
      .then((r) => setData(r.data))
      .catch((e) => setError(e?.message || "Falha ao consolidar o município"));
  }, [sp, retry]);
  return (
    <div className="hub-page" data-testid="territorial-real">
      <div className="screen-header">
        <div>
          <div className="eyebrow">
            <MapPin size={14} /> Inteligência territorial · fontes reais
          </div>
          <h1>Município integrado</h1>
          <p>
            Agregados municipais permanecem identificados como agregados;
            coincidência territorial é vínculo potencial.
          </p>
        </div>
      </div>
      <form
        className="works-toolbar"
        onSubmit={(e) => {
          e.preventDefault();
          setSp({ municipality, uf });
        }}
      >
        <label className="search-field">
          <Search size={15} />
          <input
            value={municipality}
            onChange={(e) => setMunicipality(e.target.value)}
            placeholder="Município"
          />
        </label>
        <input
          value={uf}
          maxLength={2}
          onChange={(e) => setUf(e.target.value.toUpperCase())}
          placeholder="UF"
        />
        <button className="btn btn-primary">Consolidar</button>
      </form>
      {error && (
        <div className="empty-state error">
          <h3>Erro na consolidação real</h3>
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
        </div>
      )}
      {data && (
        <>
          <div className="wave1-source">
            <Database />
            <b>
              {data.municipality}, {data.uf} · {data.classification}
            </b>
            <small>
              {data.relationshipRule} · confiança {data.confidence}% ·{" "}
              {data.source}
            </small>
          </div>
          <div className="territorial-grid">
            {Object.entries(data.datasets).map(([key, value]: any) => {
              const rows = Array.isArray(value) ? value : [];
              return (
                <section className="card" style={{ padding: "1rem" }} key={key}>
                  <h3>{labels[key] || key}</h3>
                  <small>{rows.length} registros exibidos neste recorte</small>
                  {rows.slice(0, 12).map((r: any, i: number) =>
                    paths[key] ? (
                      <Link
                        className="related-row"
                        to={paths[key](r.source_id)}
                        key={`${r.source_id}-${i}`}
                      >
                        <MapPin size={14} />
                        <span>
                          <strong>
                            {r.display_name || r.municipio_nome || r.source_id}
                          </strong>
                          <small>
                            {r.source_id || "agregado municipal"} · fonte real
                          </small>
                        </span>
                      </Link>
                    ) : (
                      <div className="related-row" key={i}>
                        <Database size={14} />
                        <span>
                          <strong>
                            {r.municipio_nome || data.municipality}
                          </strong>
                          <small>
                            {Object.entries(r)
                              .filter(([, v]) => v !== null)
                              .slice(0, 4)
                              .map(([k, v]) => `${k}: ${v}`)
                              .join(" · ")}
                          </small>
                        </span>
                      </div>
                    ),
                  )}
                  {!rows.length && (
                    <div className="empty-state">
                      <p>Não identificado nesta fonte.</p>
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
