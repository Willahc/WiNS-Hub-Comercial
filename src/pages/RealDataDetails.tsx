import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Dna, HeartPulse, Sprout } from "lucide-react";
import { realHubService } from "../services/realHubService";

type LoaderProps = {
  title: string;
  load: () => Promise<any>;
  children: (data: any) => React.ReactNode;
};
const RealLoader: React.FC<LoaderProps> = ({ title, load, children }) => {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setData(null);
    setError("");
    load()
      .then((x) => active && setData(x))
      .catch((e) => active && setError(e?.message || "Falha na fonte real"));
    return () => {
      active = false;
    };
  }, [attempt]);
  if (error)
    return (
      <div className="empty-state error" data-testid="real-data-error">
        <h3>Erro ao carregar {title}</h3>
        <p>{error}</p>
        <button
          className="btn btn-primary"
          onClick={() => setAttempt((x) => x + 1)}
        >
          Tentar novamente
        </button>
      </div>
    );
  if (!data)
    return (
      <div className="loading-container">
        <div className="spinner" />
        <p>Consultando {title}...</p>
      </div>
    );
  return <>{children(data)}</>;
};

const Field = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="card" style={{ padding: "1rem" }}>
    <small>{label}</small>
    <strong style={{ display: "block", marginTop: 6 }}>
      {value ?? <span className="value-unavailable">não disponível</span>}
    </strong>
  </div>
);
const Header = ({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
}) => (
  <div className="screen-header engineering-head">
    <div>
      <div className="eyebrow">
        <Sprout size={14} />
        {eyebrow}
      </div>
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </div>
  </div>
);

export const AgroImovelDetail: React.FC = () => {
  const { id = "" } = useParams();
  return (
    <RealLoader
      title="imóvel rural"
      load={() => realHubService.getAgroImovel(id)}
    >
      {(d) => (
        <div data-testid="agro-imovel-detail">
          <Header
            eyebrow="Agro · SICAR"
            title={d.nome_imovel || `Imóvel ${d.codigo_car}`}
            subtitle="Detalhe proveniente do cadastro real de imóvel rural"
          />
          <div className="wave1-source">
            <b>Fonte: {d.sourceSystem || "SICAR / MMA"}</b>
            <small>Atualização conforme proveniência do registro</small>
          </div>
          <div className="engineering-kpi-grid">
            <Field label="Código CAR" value={d.codigo_car} />
            <Field label="Proprietário" value={d.nome_proprietario} />
            <Field label="Município/UF" value={`${d.municipio}/${d.uf}`} />
            <Field
              label="Área total"
              value={d.area_total_ha != null ? `${d.area_total_ha} ha` : null}
            />
          </div>
        </div>
      )}
    </RealLoader>
  );
};

export const AgroReprodutorDetail: React.FC = () => {
  const { id = "" } = useParams();
  return (
    <RealLoader
      title="ficha do reprodutor"
      load={() => realHubService.getAgroReprodutor(id)}
    >
      {(d) => (
        <div data-testid="agro-reprodutor-detail">
          <Header
            eyebrow="Agro · Catálogo genético"
            title={`${d.nome} · ${d.registro}`}
            subtitle="Ficha real do reprodutor e avaliações genéticas"
          />
          <div className="wave1-source">
            <b>Fonte: {d.fonte_programa}</b>
            <small>{d.fonte_url || "Catálogo genético de origem"}</small>
          </div>
          <div className="engineering-kpi-grid">
            <Field label="RGD" value={d.registro} />
            <Field label="Raça" value={d.raca_nome} />
            <Field label="Origem" value={d.fazenda_origem} />
            <Field
              label="Avaliações"
              value={`${d.avaliacoes?.length || 0} características`}
            />
          </div>
          <Link
            className="btn btn-primary"
            to={`/agro/genealogia/${encodeURIComponent(d.registro)}`}
          >
            <Dna size={15} /> Ver genealogia
          </Link>
        </div>
      )}
    </RealLoader>
  );
};

export const AgroGenealogia: React.FC = () => {
  const { id = "" } = useParams();
  return (
    <RealLoader
      title="genealogia"
      load={() => realHubService.getAgroGenealogia(id)}
    >
      {(d) => (
        <div
          data-testid={`genealogia-${String(d.classification).toLowerCase()}`}
        >
          <Header
            eyebrow="Agro · Genealogia"
            title={`${d.individual.nome} · ${d.individual.registro}`}
            subtitle="Ascendência conforme catálogo genético da fonte"
          />
          <div className="wave1-source">
            <b>Classificação: {d.classification}</b>
            <small>Fonte: wins_agro.mercado.reprodutor</small>
          </div>
          {d.classification === "AUSENTE" ? (
            <div className="empty-state" data-testid="genealogia-ausente">
              <Dna size={40} />
              <h3>Genealogia não disponível na fonte.</h3>
              <p>Nenhum pai, mãe, avô ou árvore é inferido.</p>
            </div>
          ) : (
            <div
              className="engineering-kpi-grid"
              data-testid="genealogia-arvore"
            >
              <Field
                label="Pai"
                value={`${d.sire?.nome} · ${d.sire?.registro || "RGD não informado"}`}
              />
              <Field
                label="Mãe"
                value={`${d.dam?.nome} · ${d.dam?.registro || "RGD não informado"}`}
              />
              <Field
                label="Avô materno"
                value={`${d.maternalGrandSire?.nome} · ${d.maternalGrandSire?.registro || "RGD não informado"}`}
              />
            </div>
          )}
        </div>
      )}
    </RealLoader>
  );
};

export const AgroDoadoras: React.FC = () => (
  <RealLoader title="doadoras" load={() => realHubService.getAgroDoadoras()}>
    {(d) => (
      <div data-testid="agro-doadoras">
        <Header
          eyebrow="Agro · Reprodução"
          title="Doadoras"
          subtitle={`${d.total} registros reais em oferta comercial`}
        />
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>RGD</th>
                <th>Nome</th>
                <th>Raça</th>
                <th>Origem</th>
                <th>UF</th>
              </tr>
            </thead>
            <tbody>
              {d.items.map((x: any) => (
                <tr key={x.id}>
                  <td>{x.registro}</td>
                  <td>{x.nome}</td>
                  <td>{x.raca_nome}</td>
                  <td>{x.fazenda_origem}</td>
                  <td>{x.uf}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )}
  </RealLoader>
);
export const AgroEmbrioes: React.FC = () => (
  <RealLoader title="embriões" load={() => realHubService.getAgroEmbrioes()}>
    {(d) => (
      <div data-testid="agro-embrioes">
        <Header
          eyebrow="Agro · Reprodução"
          title="Embriões"
          subtitle={`${d.total} lotes reais em comercialização`}
        />
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>Doadora</th>
                <th>Touro</th>
                <th>Tipo</th>
                <th>Quantidade</th>
                <th>Leilão</th>
              </tr>
            </thead>
            <tbody>
              {d.items.map((x: any) => (
                <tr key={x.id}>
                  <td>{x.doadora_nome}</td>
                  <td>{x.touro_nome}</td>
                  <td>{x.tipo}</td>
                  <td>{x.qtd}</td>
                  <td>{x.leilao_nome}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )}
  </RealLoader>
);

export const SaudeEstabelecimentoDetail: React.FC = () => {
  const { cnes = "" } = useParams();
  return (
    <RealLoader
      title="estabelecimento CNES"
      load={() => realHubService.getSaudeEstabelecimento(cnes)}
    >
      {(d) => {
        const x = d.detail;
        return (
          <div data-testid="saude-cnes-detail">
            <div className="screen-header engineering-head">
              <div>
                <div className="eyebrow">
                  <HeartPulse size={14} /> Saúde · DATASUS CNES
                </div>
                <h1>{x.nome_fantasia || x.razao_social}</h1>
                <p>Detalhe real do estabelecimento e capacidade assistencial</p>
              </div>
            </div>
            <div className="wave1-source">
              <b>Fonte: DATASUS CNES</b>
              <small>
                CNES {x.cnes_id} · atualização não informada na fonte
              </small>
            </div>
            <div className="engineering-kpi-grid">
              <Field label="CNES" value={x.cnes_id} />
              <Field label="CNPJ" value={x.cnpj} />
              <Field
                label="Município/UF"
                value={`${x.municipio_nome || x.municipio || "Não informado"}/${x.uf || "—"}`}
              />
              <Field label="Profissionais" value={d.profissionais.total} />
            </div>
            <section
              className="card"
              style={{ padding: "1rem", marginTop: "1rem" }}
              data-testid="cnes-professionals"
            >
              <h3>Médicos e profissionais disponíveis</h3>
              {d.profissionais.namedProfessionals?.map((professional: any) => (
                <Link
                  className="related-row"
                  key={`m-${professional.source_id}`}
                  to={`/saude/diretorios/medicos/${professional.source_id}?originCnes=${encodeURIComponent(String(x.cnes_id))}`}
                >
                  <HeartPulse size={15} />
                  <span>
                    <strong>{professional.nome}</strong>
                    <small>
                      CRM {professional.crm || "não informado"}/
                      {professional.uf_crm || "—"} ·{" "}
                      {professional.especialidades ||
                        "especialidade não informada"}{" "}
                      · vínculo municipal PROVÁVEL
                    </small>
                  </span>
                </Link>
              ))}
              {d.profissionais.professionalCategories?.map(
                (professional: any) => (
                  <Link
                    className="related-row"
                    key={`c-${professional.source_id}`}
                    to={`/saude/diretorios/profissionais/${professional.source_id}`}
                  >
                    <HeartPulse size={15} />
                    <span>
                      <strong>{professional.cbo_descricao}</strong>
                      <small>
                        CBO {professional.cbo_codigo} · quantidade{" "}
                        {professional.quantidade}
                      </small>
                    </span>
                  </Link>
                ),
              )}
              {!d.profissionais.total && (
                <p>Não identificados para este CNES.</p>
              )}
              <Link
                className="btn btn-outline"
                to={`/saude/diretorios/medicos?municipality=${encodeURIComponent(String(x.municipio_nome || ""))}&uf=${x.uf || ""}`}
              >
                Abrir médicos do município
              </Link>
            </section>
          </div>
        );
      }}
    </RealLoader>
  );
};
