import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Building2, MapPin, ArrowLeft, ShieldCheck, HardHat, Truck, Sprout, HeartPulse,
  Users, Share2, Award, Download, Network, Globe, TrendingUp, AlertTriangle,
  CheckCircle2, ChevronRight, Info, ExternalLink, Calendar, DollarSign, Layers,
  FileText, Sparkles, Filter, Database, Bookmark, ArrowRight, Eye, Phone, Mail, HelpCircle
} from 'lucide-react';
import { DesktopSidebar, MobileSidebarContent } from '../components/AppSidebar';
import { RelationshipGraphVisualizer } from '../components/RelationshipGraphVisualizer';
import { exportService } from '../services/exportService';
import { MASTER_COMPANIES_DATABASE, type CompanyRecord } from '../services/companyDatabase';

function useMediaQuery(q: string) {
  const [match, setMatch] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const handler = (e: MediaQueryListEvent) => setMatch(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [q]);
  return match;
}

const fmtCurrency = (v: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);
};

export const EngineeringCompanyReal: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isMobile = useMediaQuery('(max-width: 767px)');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'geral' | 'cadastro' | 'grupo' | 'pessoas' | 'verticais' | 'obras' | 'oportunidades' | 'relacionamentos' | 'mapa' | 'qualidade' | 'insights'>('geral');
  const [isSaved, setIsSaved] = useState(false);

  // Find company by ID or CNPJ Clean/Formatted
  const company: CompanyRecord | undefined = useMemo(() => {
    if (!id) return MASTER_COMPANIES_DATABASE[0];
    const cleanId = id.replace(/\D/g, '');
    return MASTER_COMPANIES_DATABASE.find(c => c.id === id || c.cnpjClean === cleanId || c.cnpj === id) || MASTER_COMPANIES_DATABASE[0];
  }, [id]);

  if (!company) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#FFF' }}>
        <h2>Empresa não encontrada</h2>
        <Link to="/empresas" style={{ color: '#8B5CF6' }}>Voltar ao catálogo</Link>
      </div>
    );
  }

  // Generate graph elements for mini-graph section
  const miniGraphNodes = [
    { id: company.id, label: company.legalName, type: 'empresa' as const, sub: `CNPJ ${company.cnpj}`, identifier: company.cnpj },
    ...company.works.map(w => ({ id: w.id, label: w.name, type: 'obra' as const, sub: `${w.municipality}/${w.uf}` })),
    ...company.logistics.map(l => ({ id: l.rntrc, label: `Transportador ${l.rntrc}`, type: 'transportador' as const, sub: `${l.municipality}/${l.uf}` })),
    ...company.agro.map(a => ({ id: a.carCode, label: a.propertyName, type: 'imovel_car' as const, sub: `${a.municipality}/${a.uf}` })),
    ...company.health.map(h => ({ id: h.cnesId, label: h.unitName, type: 'estabelecimento_cnes' as const, sub: `${h.municipality}/${h.uf}` })),
  ];

  const miniGraphEdges = [
    ...company.works.map(w => ({
      id: `edge_${company.id}_${w.id}`,
      source: company.id,
      target: w.id,
      label: w.role,
      confidence: w.role === 'Executora Confirmada' ? 98 : 88,
      classification: w.role === 'Executora Confirmada' ? 'CONFIRMADO' as const : 'PROVÁVEL' as const,
      evidence: w.evidence
    })),
    ...company.logistics.map(l => ({
      id: `edge_${company.id}_${l.rntrc}`,
      source: company.id,
      target: l.rntrc,
      label: 'Operação Logística',
      confidence: 91,
      classification: 'PROVÁVEL' as const,
      evidence: 'RNTRC cadastrado na ANTT em geofence municipal coincidente'
    })),
    ...company.agro.map(a => ({
      id: `edge_${company.id}_${a.carCode}`,
      source: company.id,
      target: a.carCode,
      label: 'Imóvel CAR Vinculado',
      confidence: 94,
      classification: 'CONFIRMADO' as const,
      evidence: 'Cadastro ambiental SICAR / MMA auditado'
    })),
    ...company.health.map(h => ({
      id: `edge_${company.id}_${h.cnesId}`,
      source: company.id,
      target: h.cnesId,
      label: 'Unidade CNES',
      confidence: 95,
      classification: 'CONFIRMADO' as const,
      evidence: 'Inscrição no Cadastro Nacional de Estabelecimentos de Saúde DATASUS'
    }))
  ];

  return (
    <div data-ui-version="empresa360-sheet-v2" style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-base, #090D16)', position: 'relative', overflow: 'hidden' }}>
      {isMobile ? (
        <>
          <div
            style={{
              position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
              background: 'rgba(0,0,0,0.5)', zIndex: 200,
              opacity: sidebarOpen ? 1 : 0, pointerEvents: sidebarOpen ? 'auto' : 'none',
              transition: 'opacity 0.2s',
            }}
            onClick={() => setSidebarOpen(false)}
          />
          <aside style={{
            position: 'fixed', top: 0, left: 0, height: '100vh', width: 280,
            background: 'var(--bg-sidebar, #0F172A)', zIndex: 201,
            transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
            transition: 'transform 0.25s ease', display: 'flex', flexDirection: 'column',
            borderRight: '1px solid var(--border-default, #1E293B)', overflow: 'hidden',
          }}>
            <MobileSidebarContent onCloseMobile={() => setSidebarOpen(false)} />
          </aside>
        </>
      ) : (
        <DesktopSidebar />
      )}

      <div style={{
        marginLeft: isMobile ? 0 : 'var(--sidebar-w, 240px)',
        flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, maxWidth: '100vw',
      }}>
        {/* Navigation Bar */}
        <header style={{
          height: 'var(--topbar-h, 60px)', background: 'var(--bg-surface, #0F172A)',
          borderBottom: '1px solid var(--border-default, #1E293B)', display: 'flex', alignItems: 'center',
          padding: isMobile ? '0 12px' : '0 24px', gap: 16, position: 'sticky', top: 0, zIndex: 50,
        }}>
          <button
            onClick={() => navigate('/empresas')}
            style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}
          >
            <ArrowLeft size={16} /> Voltar ao Catálogo
          </button>

          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontSize: isMobile ? 14 : 16, fontWeight: 700, color: 'var(--text-primary, #F8FAFC)', margin: 0, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
              Ficha 360° · {company.legalName}
            </h1>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => exportService.printDossierReport({ type: 'obra', title: `Dossie Empresa 360 - ${company.legalName}`, generatedAt: new Date().toLocaleString('pt-BR') })}
              style={{ height: 30, padding: '0 10px', fontSize: 11, fontWeight: 600, background: '#8B5CF6', color: '#FFF', border: 'none', borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <Download size={12} /> {!isMobile && <span>Exportar Dossiê</span>}
            </button>
          </div>
        </header>

        {/* Content Container */}
        <div style={{ padding: isMobile ? 12 : 24, flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* SECTION 1: CABEÇALHO DA EMPRESA */}
          <div style={{ background: 'var(--bg-surface, #0F172A)', border: '1px solid var(--border-default, #1E293B)', borderRadius: 10, padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                <div style={{ width: 56, height: 56, borderRadius: 10, background: 'rgba(139,92,246,0.15)', border: '1px solid #8B5CF6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8B5CF6', fontWeight: 800, fontSize: 20 }}>
                  {company.legalName.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <h2 style={{ fontSize: 18, fontWeight: 800, color: '#FFF', margin: 0 }}>{company.legalName}</h2>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: company.status === 'ATIVA' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: company.status === 'ATIVA' ? '#22C55E' : '#EF4444' }}>
                      {company.status}
                    </span>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: 'rgba(59,130,246,0.15)', color: '#3B82F6' }}>
                      {company.type}
                    </span>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: 'rgba(236,72,153,0.15)', color: '#EC4899' }}>
                      Selo Qualidade {company.qualityScore}%
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 4 }}>
                    Nome Fantasia: <strong style={{ color: '#F8FAFC' }}>{company.tradeName}</strong> · CNPJ: <strong style={{ color: '#8B5CF6' }}>{company.cnpj}</strong> · Porte: <strong>{company.size}</strong>
                  </div>
                </div>
              </div>

              {/* Action Buttons Toolbar */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  data-testid="btn-abrir-relacionamentos"
                  onClick={() => navigate(`/relacionamentos?cnpj=${encodeURIComponent(company.cnpj)}&entity=${encodeURIComponent(company.legalName)}`)}
                  style={{ height: 32, padding: '0 12px', fontSize: 11, fontWeight: 600, background: '#8B5CF6', color: '#FFF', border: 'none', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Network size={13} /> Abrir Relacionamentos
                </button>
                <button
                  data-testid="btn-abrir-territorio"
                  onClick={() => navigate(`/territorial?municipality=${encodeURIComponent(company.address.municipality)}`)}
                  style={{ height: 32, padding: '0 12px', fontSize: 11, fontWeight: 600, background: '#1E293B', color: '#FFF', border: '1px solid #334155', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Globe size={13} color="#06B6D4" /> Abrir Território
                </button>
                <button
                  onClick={() => setIsSaved(!isSaved)}
                  style={{ height: 32, padding: '0 12px', fontSize: 11, fontWeight: 600, background: isSaved ? 'rgba(34,197,94,0.15)' : '#1E293B', color: isSaved ? '#22C55E' : '#FFF', border: '1px solid #334155', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Bookmark size={13} /> {isSaved ? 'Salva' : 'Salvar Empresa'}
                </button>
              </div>
            </div>

            {/* Quick Details Bar */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 12, borderTop: '1px solid #1E293B', paddingTop: 14, fontSize: 11, color: '#94A3B8' }}>
              <div><strong>Endereço Fiscal:</strong> {company.address.street}, {company.address.number} · {company.address.municipality}/{company.address.uf}</div>
              <div><strong>CNAE Principal:</strong> {company.cnaeMain.code} - {company.cnaeMain.text}</div>
              <div><strong>Capital Social:</strong> {fmtCurrency(company.capitalSocial)}</div>
              <div><strong>Grupo Econômico:</strong> {company.economicGroup?.name || 'Não associado a holding'}</div>
            </div>
          </div>

          {/* SECTION 2: RESUMO EXECUTIVO (12 CARDS REATIVOS) */}
          <div style={{ background: 'var(--bg-surface, #0F172A)', border: '1px solid var(--border-default, #1E293B)', borderRadius: 10, padding: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Sparkles size={16} color="#8B5CF6" /> Resumo Executivo da Investigação
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(6, 1fr)', gap: 10 }}>
              <div style={{ background: '#090D16', border: '1px solid #1E293B', borderRadius: 8, padding: 10 }}>
                <span style={{ fontSize: 10, color: '#94A3B8' }}>Verticais Presentes</span>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#3B82F6', marginTop: 2 }}>{company.verticals.length} verticais</div>
              </div>
              <div style={{ background: '#090D16', border: '1px solid #1E293B', borderRadius: 8, padding: 10 }}>
                <span style={{ fontSize: 10, color: '#94A3B8' }}>Obras Relacionadas</span>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#22C55E', marginTop: 2 }}>{company.works.length} obras</div>
              </div>
              <div style={{ background: '#090D16', border: '1px solid #1E293B', borderRadius: 8, padding: 10 }}>
                <span style={{ fontSize: 10, color: '#94A3B8' }}>Transportadores RNTRC</span>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#06B6D4', marginTop: 2 }}>{company.logistics.length} frotas</div>
              </div>
              <div style={{ background: '#090D16', border: '1px solid #1E293B', borderRadius: 8, padding: 10 }}>
                <span style={{ fontSize: 10, color: '#94A3B8' }}>Imóveis CAR</span>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#F59E0B', marginTop: 2 }}>{company.agro.length} imóveis</div>
              </div>
              <div style={{ background: '#090D16', border: '1px solid #1E293B', borderRadius: 8, padding: 10 }}>
                <span style={{ fontSize: 10, color: '#94A3B8' }}>Estabelecimentos CNES</span>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#EC4899', marginTop: 2 }}>{company.health.length} unidades</div>
              </div>
              <div style={{ background: '#090D16', border: '1px solid #1E293B', borderRadius: 8, padding: 10 }}>
                <span style={{ fontSize: 10, color: '#94A3B8' }}>Oportunidades</span>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#10B981', marginTop: 2 }}>{company.opportunities.length} identificadas</div>
              </div>

              <div style={{ background: '#090D16', border: '1px solid #1E293B', borderRadius: 8, padding: 10 }}>
                <span style={{ fontSize: 10, color: '#94A3B8' }}>Relações Confirmadas</span>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#22C55E', marginTop: 2 }}>{company.works.filter(w => w.role === 'Executora Confirmada').length} documentais</div>
              </div>
              <div style={{ background: '#090D16', border: '1px solid #1E293B', borderRadius: 8, padding: 10 }}>
                <span style={{ fontSize: 10, color: '#94A3B8' }}>Relações Prováveis</span>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#06B6D4', marginTop: 2 }}>{company.works.filter(w => w.role !== 'Executora Confirmada').length + company.logistics.length} correspondências</div>
              </div>
              <div style={{ background: '#090D16', border: '1px solid #1E293B', borderRadius: 8, padding: 10 }}>
                <span style={{ fontSize: 10, color: '#94A3B8' }}>Relações Potenciais</span>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#F59E0B', marginTop: 2 }}>{company.agro.length} territoriais</div>
              </div>
              <div style={{ background: '#090D16', border: '1px solid #1E293B', borderRadius: 8, padding: 10 }}>
                <span style={{ fontSize: 10, color: '#94A3B8' }}>Municípios de Atuação</span>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#8B5CF6', marginTop: 2 }}>2 municípios</div>
              </div>
              <div style={{ background: '#090D16', border: '1px solid #1E293B', borderRadius: 8, padding: 10 }}>
                <span style={{ fontSize: 10, color: '#94A3B8' }}>Pessoas Vinculadas</span>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#10B981', marginTop: 2 }}>{company.people.length} decisores</div>
              </div>
              <div style={{ background: '#090D16', border: '1px solid #1E293B', borderRadius: 8, padding: 10 }}>
                <span style={{ fontSize: 10, color: '#94A3B8' }}>Completude Dados</span>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#22C55E', marginTop: 2 }}>{company.qualityScore}% auditado</div>
              </div>
            </div>
          </div>

          {/* SECTION 3: IDENTIDADE E CADASTRO */}
          <div style={{ background: 'var(--bg-surface, #0F172A)', border: '1px solid var(--border-default, #1E293B)', borderRadius: 10, padding: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
              <FileText size={16} color="#3B82F6" /> Identidade e Dados Cadastrais Auditados
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 14, fontSize: 11 }}>
              <div style={{ background: '#090D16', padding: 12, borderRadius: 8, border: '1px solid #1E293B' }}>
                <div style={{ fontSize: 10, color: '#94A3B8', textTransform: 'uppercase' }}>Cadastrais RFB</div>
                <div style={{ marginTop: 6, color: '#FFF' }}><strong>Razão Social:</strong> {company.legalName}</div>
                <div style={{ color: '#FFF' }}><strong>Nome Fantasia:</strong> {company.tradeName}</div>
                <div style={{ color: '#FFF' }}><strong>CNPJ:</strong> {company.cnpj} ({company.type})</div>
                <div style={{ color: '#FFF' }}><strong>Data de Abertura:</strong> {company.openingDate}</div>
                <div style={{ color: '#FFF' }}><strong>Natureza Jurídica:</strong> {company.legalNature}</div>
              </div>

              <div style={{ background: '#090D16', padding: 12, borderRadius: 8, border: '1px solid #1E293B' }}>
                <div style={{ fontSize: 10, color: '#94A3B8', textTransform: 'uppercase' }}>CNAEs & Atividade Fiscal</div>
                <div style={{ marginTop: 6, color: '#FFF' }}><strong>CNAE Principal:</strong> {company.cnaeMain.code} - {company.cnaeMain.text}</div>
                <div style={{ color: '#CBD5E1', marginTop: 4 }}><strong>CNAEs Secundários:</strong></div>
                {company.cnaeSecondary.map((c, i) => (
                  <div key={i} style={{ fontSize: 10, color: '#94A3B8' }}>• {c.code} - {c.text}</div>
                ))}
              </div>

              <div style={{ background: '#090D16', padding: 12, borderRadius: 8, border: '1px solid #1E293B' }}>
                <div style={{ fontSize: 10, color: '#94A3B8', textTransform: 'uppercase' }}>Divergências entre Fontes</div>
                {company.provenance.discrepancies.length > 0 ? (
                  company.provenance.discrepancies.map((d, i) => (
                    <div key={i} style={{ marginTop: 6, padding: 6, background: 'rgba(245,158,11,0.1)', border: '1px solid #F59E0B', borderRadius: 4, color: '#F59E0B', fontSize: 10 }}>
                      <strong>{d.field}:</strong> Fonte {d.sourceA} ({d.valA}) vs Fonte {d.sourceB} ({d.valB})
                    </div>
                  ))
                ) : (
                  <div style={{ color: '#22C55E', marginTop: 6 }}>Nenhuma divergência de nome ou endereço detectada.</div>
                )}
              </div>
            </div>
          </div>

          {/* SECTION 4: GRUPO ECONÔMICO */}
          <div style={{ background: 'var(--bg-surface, #0F172A)', border: '1px solid var(--border-default, #1E293B)', borderRadius: 10, padding: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Share2 size={16} color="#EC4899" /> Estrutura do Grupo Econômico & Holdings
            </h3>
            {company.economicGroup ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 11 }}>
                <div style={{ background: '#090D16', padding: 12, borderRadius: 8, border: '1px solid #1E293B' }}>
                  <strong style={{ color: '#FFF' }}>{company.economicGroup.name}</strong> · {company.economicGroup.branchesCount} filiais ativas no cadastro nacional.
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #1E293B', color: '#94A3B8' }}>
                        <th style={{ padding: 6 }}>Empresa Vinculada</th>
                        <th style={{ padding: 6 }}>CNPJ</th>
                        <th style={{ padding: 6 }}>Tipo de Vínculo</th>
                        <th style={{ padding: 6 }}>Confiança</th>
                      </tr>
                    </thead>
                    <tbody>
                      {company.economicGroup.relatedCompanies.map((r, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #1E293B' }}>
                          <td style={{ padding: 6, fontWeight: 600, color: '#FFF' }}>{r.name}</td>
                          <td style={{ padding: 6, color: '#8B5CF6' }}>{r.cnpj}</td>
                          <td style={{ padding: 6, color: '#3B82F6' }}>{r.relation}</td>
                          <td style={{ padding: 6, color: '#22C55E', fontWeight: 700 }}>{r.conf}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 11, color: '#94A3B8' }}>Empresa sem indício de holding corporativa.</div>
            )}
          </div>

          {/* SECTION 5: PESSOAS E DECISORES */}
          <div style={{ background: 'var(--bg-surface, #0F172A)', border: '1px solid var(--border-default, #1E293B)', borderRadius: 10, padding: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Users size={16} color="#10B981" /> Quadro Societário, Diretores e Decisores Mapeados
            </h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #1E293B', color: '#94A3B8' }}>
                    <th style={{ padding: 8 }}>Nome Completo</th>
                    <th style={{ padding: 8 }}>Função / Cargo</th>
                    <th style={{ padding: 8 }}>Categoria do Vínculo</th>
                    <th style={{ padding: 8 }}>Fonte Auditada</th>
                    <th style={{ padding: 8 }}>Confiança</th>
                  </tr>
                </thead>
                <tbody>
                  {company.people.map((p) => (
                    <tr key={p.id} style={{ borderBottom: '1px solid #1E293B' }}>
                      <td style={{ padding: 8, fontWeight: 700, color: '#FFF' }}>{p.name}</td>
                      <td style={{ padding: 8, color: '#3B82F6' }}>{p.role}</td>
                      <td style={{ padding: 8 }}>
                        <span style={{
                          fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                          background: p.category.includes('Confirmado') ? 'rgba(34,197,94,0.15)' : 'rgba(59,130,246,0.15)',
                          color: p.category.includes('Confirmado') ? '#22C55E' : '#3B82F6'
                        }}>
                          {p.category}
                        </span>
                      </td>
                      <td style={{ padding: 8, color: '#94A3B8' }}>{p.source}</td>
                      <td style={{ padding: 8, fontWeight: 700, color: '#8B5CF6' }}>{p.confidence}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* SECTION 6 & 7: OBRAS E CONTRATOS */}
          <div style={{ background: 'var(--bg-surface, #0F172A)', border: '1px solid var(--border-default, #1E293B)', borderRadius: 10, padding: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
              <HardHat size={16} color="#3B82F6" /> Obras Executadas e Contratos de Engenharia
            </h3>
            {company.works.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #1E293B', color: '#94A3B8' }}>
                      <th style={{ padding: 8 }}>Nome da Obra</th>
                      <th style={{ padding: 8 }}>Papel da Empresa</th>
                      <th style={{ padding: 8 }}>Município/UF</th>
                      <th style={{ padding: 8 }}>Fase</th>
                      <th style={{ padding: 8 }}>CAPEX Estimado</th>
                      <th style={{ padding: 8 }}>Evidência Documental</th>
                    </tr>
                  </thead>
                  <tbody>
                    {company.works.map(w => (
                      <tr key={w.id} style={{ borderBottom: '1px solid #1E293B' }}>
                        <td style={{ padding: 8, fontWeight: 700, color: '#FFF' }}>{w.name}</td>
                        <td style={{ padding: 8 }}>
                          <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: w.role === 'Executora Confirmada' ? 'rgba(34,197,94,0.15)' : 'rgba(6,182,212,0.15)', color: w.role === 'Executora Confirmada' ? '#22C55E' : '#06B6D4' }}>
                            {w.role}
                          </span>
                        </td>
                        <td style={{ padding: 8, color: '#94A3B8' }}>{w.municipality}/{w.uf}</td>
                        <td style={{ padding: 8, color: '#F59E0B' }}>{w.phase}</td>
                        <td style={{ padding: 8, fontWeight: 700, color: '#8B5CF6' }}>{fmtCurrency(w.capex)}</td>
                        <td style={{ padding: 8, color: '#94A3B8', fontSize: 10 }}>{w.evidence}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ fontSize: 11, color: '#94A3B8' }}>Nenhuma obra pública vinculada diretamente neste recorte.</div>
            )}
          </div>

          {/* SECTION 8: OPORTUNIDADES COMERCIAIS */}
          <div style={{ background: 'var(--bg-surface, #0F172A)', border: '1px solid var(--border-default, #1E293B)', borderRadius: 10, padding: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
              <TrendingUp size={16} color="#10B981" /> Oportunidades Comerciais Explicáveis
            </h3>
            {company.opportunities.map(op => (
              <div key={op.id} style={{ background: '#090D16', border: '1px solid #10B981', borderRadius: 8, padding: 12, fontSize: 11 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ color: '#FFF', fontSize: 12 }}>{op.title}</strong>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#10B981', background: 'rgba(16,185,129,0.15)', padding: '2px 6px', borderRadius: 4 }}>
                    Score {op.score}/100
                  </span>
                </div>
                <div style={{ color: '#CBD5E1', marginTop: 4, lineHeight: 1.4 }}>
                  <strong>Racional Explicativo:</strong> {op.rationale}
                </div>
                <div style={{ color: '#94A3B8', fontSize: 10, marginTop: 4 }}>
                  Evidência: {op.evidence} · Município: {op.municipality} · Ação: <strong>{op.recommendedAction}</strong>
                </div>
              </div>
            ))}
          </div>

          {/* SECTION 9: RELACIONAMENTOS (MINI GRAFO INCORPORADO) */}
          <div style={{ background: 'var(--bg-surface, #0F172A)', border: '1px solid var(--border-default, #1E293B)', borderRadius: 10, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Network size={16} color="#8B5CF6" /> Mini Grafo de Relacionamentos
              </h3>
              <button
                onClick={() => navigate(`/relacionamentos?cnpj=${encodeURIComponent(company.cnpj)}&entity=${encodeURIComponent(company.legalName)}`)}
                style={{ height: 28, padding: '0 10px', fontSize: 10, fontWeight: 700, background: '#8B5CF6', color: '#FFF', border: 'none', borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
              >
                Abrir investigação completa em Relacionamentos <ArrowRight size={12} />
              </button>
            </div>
            <RelationshipGraphVisualizer
              nodes={miniGraphNodes}
              edges={miniGraphEdges}
              centralNodeId={company.id}
            />
          </div>

          {/* SECTION 11: QUALIDADE E PROVENIÊNCIA */}
          <div style={{ background: 'var(--bg-surface, #0F172A)', border: '1px solid var(--border-default, #1E293B)', borderRadius: 10, padding: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Database size={16} color="#06B6D4" /> Qualidade, Governança e Proveniência dos Dados
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)', gap: 10, fontSize: 11, color: '#CBD5E1' }}>
              <div><strong>Fontes Usadas:</strong> {company.provenance.sources.join(', ')}</div>
              <div><strong>Última Atualização:</strong> {company.provenance.lastUpdate}</div>
              <div><strong>Cobertura Auditada:</strong> {company.provenance.coveragePct}% dos campos preenchidos</div>
              <div><strong>Versão do Algoritmo:</strong> {company.provenance.algorithmVersion}</div>
            </div>
          </div>

          {/* SECTION 12: INSIGHTS EXPLICÁVEIS */}
          {company.insights.length > 0 && (
            <div style={{ background: 'var(--bg-surface, #0F172A)', border: '1px solid var(--border-default, #1E293B)', borderRadius: 10, padding: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Sparkles size={16} color="#F59E0B" /> Insights Explicáveis Automáticos
              </h3>
              {company.insights.map((ins, i) => (
                <div key={i} style={{ background: '#090D16', border: '1px solid #F59E0B', borderRadius: 8, padding: 12, fontSize: 11 }}>
                  <strong style={{ color: '#F59E0B', fontSize: 12 }}>{ins.title}</strong>
                  <div style={{ color: '#FFF', marginTop: 4 }}><strong>Racional:</strong> {ins.rationale}</div>
                  <div style={{ color: '#94A3B8', fontSize: 10, marginTop: 4 }}>
                    Evidência: {ins.evidence} · Confiança: <strong>{ins.confidence}%</strong> · Fonte: {ins.source} · Limitações: {ins.limitations}
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
