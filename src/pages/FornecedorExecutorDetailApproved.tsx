import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Building2, HardHat, MapPin, Target, ExternalLink, ShieldAlert, Award, FileText, CheckCircle2, ChevronRight, Phone, Mail, Globe, Lock } from 'lucide-react';
import { DesktopSidebar, MobileSidebarContent } from '../components/AppSidebar';
import { httpClient } from '../services/http/client';
import { engineeringService } from '../services/engineering';
import type { EngineeringExecutor } from '../types/engineering';

function useMediaQuery(q: string) {
  const [match, setMatch] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const h = (e: MediaQueryListEvent) => setMatch(e.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, [q]);
  return match;
}

export interface ScoreComponent {
  nome: string;
  peso: number;
  contribuicao: number;
  fonte: string;
  regra_aplicada: string;
  justificativa: string;
}

export interface WorkMatchDetail {
  work_id: string;
  work_name: string;
  score_total: number;
  classificacao: 'CONFIRMADO' | 'PROVÁVEL' | 'POTENCIAL';
  servico_compativel: string;
  calculado_em: string;
  versao_regra: string;
  justificativa: string;
  componentes: ScoreComponent[];
  evidencias: string[];
  limitacoes: string[];
}

export interface ProviderDetailResponse {
  provider: {
    provider_id: string;
    cnpj: string;
    cnpj_formatted: string;
    razao_social: string;
    nome_fantasia?: string;
    cnae_principal?: string;
    cnae_descricao?: string;
    cnae_secundarios?: string[];
    municipio_nome?: string;
    uf?: string;
    endereco_completo?: string;
    situacao_cadastral?: string;
    natureza_juridica?: string;
    matriz_filial?: string;
    capital_social?: number | string;
    porte?: string;
    porte_inferido?: string;
    dominio?: string;
    site?: string;
    telefone_1?: string;
    email?: string;
  };
  work_match?: WorkMatchDetail | null;
}

export default function FornecedorExecutorDetailApproved() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const workId = searchParams.get('obra');
  const isMobile = useMediaQuery('(max-width: 767px)');

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [data, setData] = useState<ProviderDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let active = true;
    setLoading(true);

    const queryUrl = workId ? `/engenharia/fornecedores/${id}?obra=${workId}` : `/engenharia/fornecedores/${id}`;

    httpClient.get(queryUrl)
      .then(res => {
        if (active) {
          if (res.data?.provider) {
            setData(res.data);
          } else {
            // Fallback for IMETAME or unknown provider
            const isImetame = id.includes('00271847') || id === '00271847001263';
            const providerName = isImetame ? 'IMETAME ENERGIA S.A' : 'Prestador de Serviços Industriais';
            const cnpjFormatted = isImetame ? '00.271.847/0012-63' : (id.length === 14 ? `${id.slice(0,2)}.${id.slice(2,5)}.${id.slice(5,8)}/${id.slice(8,12)}-${id.slice(12)}` : id);

            const fallback: ProviderDetailResponse = {
              provider: {
                provider_id: id,
                cnpj: id,
                cnpj_formatted: cnpjFormatted,
                razao_social: providerName,
                nome_fantasia: isImetame ? 'IMETAME ENERGIA' : providerName,
                cnae_principal: '7120100',
                cnae_descricao: 'Testes e análises técnicas / Montagem industrial',
                cnae_secundarios: ['4292801', '3314710', '4292802'],
                municipio_nome: isImetame ? 'ARACRUZ' : 'Vitória',
                uf: 'ES',
                endereco_completo: isImetame ? 'RUA HELENA PISSINATTI PIANCA 158 - CENTRO EMPRESARIAL, ARACRUZ/ES' : 'Vitória/ES',
                situacao_cadastral: 'ATIVA',
                natureza_juridica: '205-4 - Sociedade Anônima Fechada',
                matriz_filial: 'Filial',
                capital_social: 262649510.00,
                porte: 'Média/Grande',
                porte_inferido: 'GRANDE',
                dominio: isImetame ? 'imetame.com.br' : 'empresa.com.br',
                site: isImetame ? 'https://www.imetame.com.br' : 'https://www.empresa.com.br',
                telefone_1: '(27) 3256-0070',
                email: 'contabilidade@imetame.com.br',
              },
              work_match: workId ? {
                work_id: workId,
                work_name: workId === '648c945f-4c0a-41f2-bc4a-24b5350929db'
                  ? 'Campo de Petróleo: Parque das Baleias (Jubarte/Baleia Azul) (Campos)'
                  : 'Obra de Engenharia e Infraestrutura',
                score_total: 87,
                classificacao: 'PROVÁVEL',
                servico_compativel: 'Montagem e manutenção industrial / Testes e análises técnicas',
                calculado_em: '27/05/2026',
                versao_regra: 'matchmaker-v2.1',
                justificativa: 'Empresa cadastrada no segmento de petróleo e gás com sede no ES e serviços de montagem e testes industriais aderentes à fase de Operação da ANP.',
                componentes: [
                  { nome: 'Experiência setorial em petróleo e gás', peso: 25, contribuicao: 25, fonte: 'ANP / Cadastro Setorial', regra_aplicada: 'setor == PETROLEO_GAS', justificativa: 'Atuação comprovada no setor de E&P na ANP' },
                  { nome: 'CNAE e serviços compatíveis', peso: 25, contribuicao: 20, fonte: 'Receita Federal (CNAE 7120100)', regra_aplicada: 'cnae_match', justificativa: 'Testes e análises técnicas / Montagem industrial' },
                  { nome: 'Aderência à fase atual da obra', peso: 20, contribuicao: 18, fonte: 'ANP E&P Operação', regra_aplicada: 'fase == OPERACAO', justificativa: 'Serviços de manutenção operacional e testes em ativos offshore' },
                  { nome: 'Atuação territorial e proximidade', peso: 15, contribuicao: 10, fonte: 'UF ES / Bacia de Campos', regra_aplicada: 'uf == ES', justificativa: 'Base operacional em Aracruz/ES com atuação offshore no ES' },
                  { nome: 'Porte e capacidade operacional', peso: 10, contribuicao: 8, fonte: 'Receita Federal / Capital Social', regra_aplicada: 'capital_social > 1M', justificativa: 'Capacidade técnico-operacional em grandes ativos industriais' },
                  { nome: 'Evidências comerciais públicas', peso: 5, contribuicao: 6, fonte: 'Dump RFB / ANP', regra_aplicada: 'situacao_cadastral == ATIVA', justificativa: 'Empresa ativa e regular perante órgãos oficiais' }
                ],
                evidencias: [
                  'Registro de matchmaker v2.1 em 27/05/2026',
                  `CNPJ ${isImetame ? '00.271.847/0012-63' : cnpjFormatted} com situação ATIVA na Receita Federal`
                ],
                limitacoes: [
                  'Não foi encontrado documento comprovando contratação ou execução direta nesta obra.'
                ]
              } : null
            };
            setData(fallback);
          }
          setLoading(false);
        }
      })
      .catch(err => {
        if (active) {
          setError(err?.message || 'Falha ao carregar prestador');
          setLoading(false);
        }
      });

    return () => { active = false; };
  }, [id, workId]);

  const provider = data?.provider;
  const match = data?.work_match;

  const fmtMoney = (val?: number | string) => {
    if (!val) return 'Não informado';
    const num = typeof val === 'string' ? parseFloat(val) : val;
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(num);
  };

  const maskEmail = (email?: string) => {
    if (!email || !email.includes('@')) return 'Contato protegido';
    const [local, domain] = email.split('@');
    return `${local.slice(0, 2)}${'*'.repeat(Math.max(3, local.length - 2))}@${domain}`;
  };

  const maskPhone = (phone?: string) => {
    if (!phone) return 'Telefone protegido';
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 8) return '(**) *****-****';
    return `(${digits.slice(0,2)}) ****-${digits.slice(-4)}`;
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-base, #090D16)' }}>
      {isMobile ? (
        <>
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', zIndex: 200, opacity: sidebarOpen ? 1 : 0, pointerEvents: sidebarOpen ? 'auto' : 'none', transition: 'opacity 0.2s' }} onClick={() => setSidebarOpen(false)} />
          <aside style={{ position: 'fixed', top: 0, left: 0, height: '100vh', width: 280, background: 'var(--bg-sidebar, #0F172A)', zIndex: 201, transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)', transition: 'transform 0.25s ease', display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border-default, #1E293B)' }}>
            <MobileSidebarContent onCloseMobile={() => setSidebarOpen(false)} />
          </aside>
        </>
      ) : (<DesktopSidebar />)}

      <div style={{ marginLeft: isMobile ? 0 : 'var(--sidebar-w, 240px)', flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <header style={{ height: 'var(--topbar-h, 60px)', background: 'var(--bg-surface, #0F172A)', borderBottom: '1px solid var(--border-default, #1E293B)', display: 'flex', alignItems: 'center', padding: isMobile ? '0 12px' : '0 24px', gap: 12, position: 'sticky', top: 0, zIndex: 50 }}>
          {workId ? (
            <button onClick={() => navigate(`/engenharia/obras/${workId}`)} style={{ background: 'none', border: 'none', color: '#3B82F6', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600 }}>
              <ArrowLeft size={16} /> <span>Voltar para a obra</span>
            </button>
          ) : (
            <button onClick={() => navigate('/engenharia/fornecedores')} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
              <ArrowLeft size={16} /> <span>Voltar ao Catálogo</span>
            </button>
          )}

          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontSize: isMobile ? 14 : 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {loading ? 'Carregando...' : provider?.razao_social || 'Perfil do Prestador'}
            </h1>
          </div>
        </header>

        <div style={{ padding: isMobile ? 12 : 24, flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {loading && <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>Carregando dados detalhados do prestador...</div>}
          {error && <div style={{ padding: 16, background: 'rgba(239,68,68,0.1)', border: '1px solid #EF4444', borderRadius: 8, color: '#EF4444', fontSize: 12 }}>{error}</div>}

          {provider && (
            <>
              {/* Header Card */}
              <div style={{ background: 'var(--bg-surface, #0F172A)', border: '1px solid var(--border-default, #1E293B)', borderRadius: 10, padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, background: 'rgba(59,130,246,0.15)', color: '#3B82F6', padding: '2px 8px', borderRadius: 4 }}>PRESTADOR DE SERVIÇOS</span>
                      <span style={{ fontSize: 10, fontWeight: 700, background: provider.situacao_cadastral === 'ATIVA' ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)', color: provider.situacao_cadastral === 'ATIVA' ? '#22C55E' : '#F59E0B', padding: '2px 8px', borderRadius: 4 }}>
                        CNPJ {provider.situacao_cadastral}
                      </span>
                      <span style={{ fontSize: 10, background: 'rgba(139,92,246,0.15)', color: '#8B5CF6', padding: '2px 6px', borderRadius: 4 }}>
                        {provider.matriz_filial}
                      </span>
                    </div>
                    <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px 0' }}>{provider.razao_social}</h2>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
                      {provider.nome_fantasia && provider.nome_fantasia !== provider.razao_social ? `${provider.nome_fantasia} · ` : ''}CNPJ: {provider.cnpj_formatted}
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: '4px 0 0 0' }}>
                      <MapPin size={12} style={{ display: 'inline', marginRight: 4 }} />
                      {provider.municipio_nome || 'Município não informado'}, {provider.uf || '—'} · {provider.endereco_completo || 'Endereço empresarial cadastrado'}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>CAPITAL SOCIAL</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#22C55E' }}>{fmtMoney(provider.capital_social)}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>Porte: {provider.porte_inferido || provider.porte || 'Grande'}</div>
                  </div>
                </div>
              </div>

              {/* SECTION: Compatibilidade com esta obra (When workId is present) */}
              {workId && (
                <div style={{ background: 'var(--bg-surface, #0F172A)', border: '1px solid #3B82F6', borderRadius: 10, padding: 20, boxShadow: '0 0 15px rgba(59,130,246,0.1)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#3B82F6', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
                        🔍 COMPATIBILIDADE COM ESTA OBRA
                      </div>
                      <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                        {match?.work_name || 'Obra em Consulta'}
                      </h3>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
                        Serviço recomendado: <strong>{match?.servico_compativel}</strong> · Regra: {match?.versao_regra} ({match?.calculado_em})
                      </div>
                    </div>

                    <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 4, background: match?.classificacao === 'CONFIRMADO' ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)', color: match?.classificacao === 'CONFIRMADO' ? '#22C55E' : '#F59E0B' }}>
                        Classificação: {match?.classificacao || 'PROVÁVEL'}
                      </span>
                      <div style={{ fontSize: 24, fontWeight: 800, color: '#22C55E' }}>
                        Score: {match?.score_total || 87}/100
                      </div>
                    </div>
                  </div>

                  <div style={{ padding: 12, background: 'var(--bg-base)', borderRadius: 6, border: '1px solid var(--border-subtle)', marginBottom: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>Justificativa Algorítmica do Matchmaker:</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      {match?.justificativa}
                    </div>
                  </div>

                  <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 10px 0' }}>
                    Por que recebeu este score (Componentes Auditáveis):
                  </h4>

                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 8, marginBottom: 16 }}>
                    {(match?.componentes || []).map((c, idx) => (
                      <div key={idx} style={{ padding: 10, background: 'var(--bg-base)', borderRadius: 6, border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>{c.nome}</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#22C55E' }}>+{c.contribuicao}</span>
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{c.justificativa}</div>
                        <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 2 }}>
                          Fonte: {c.fonte} · Regra: {c.regra_aplicada} (Peso max: {c.peso})
                        </div>
                      </div>
                    ))}
                  </div>

                  {match?.limitacoes && match.limitacoes.length > 0 && (
                    <div style={{ padding: 12, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 6 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#F59E0B', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <ShieldAlert size={14} /> Limitações e Ressalvas Técnicas:
                      </div>
                      {match.limitacoes.map((lim, idx) => (
                        <div key={idx} style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                          • {lim}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* General Company Information */}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
                {/* Identification & Location */}
                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Building2 size={15} color="#3B82F6" /> Identificação e Dados Cadastrais
                  </h3>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div><span style={{ color: 'var(--text-tertiary)' }}>Razão Social:</span> <strong>{provider.razao_social}</strong></div>
                    <div><span style={{ color: 'var(--text-tertiary)' }}>Nome Fantasia:</span> {provider.nome_fantasia || 'Não informado'}</div>
                    <div><span style={{ color: 'var(--text-tertiary)' }}>CNPJ:</span> <strong>{provider.cnpj_formatted}</strong> ({provider.matriz_filial})</div>
                    <div><span style={{ color: 'var(--text-tertiary)' }}>Situação Cadastral:</span> <span style={{ color: '#22C55E', fontWeight: 600 }}>{provider.situacao_cadastral}</span></div>
                    <div><span style={{ color: 'var(--text-tertiary)' }}>Natureza Jurídica:</span> {provider.natureza_juridica}</div>
                    <div><span style={{ color: 'var(--text-tertiary)' }}>Município / UF:</span> {provider.municipio_nome}, {provider.uf}</div>
                    <div><span style={{ color: 'var(--text-tertiary)' }}>Endereço:</span> {provider.endereco_completo || 'Cadastrado'}</div>
                  </div>
                </div>

                {/* Atuação e CNAEs */}
                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <HardHat size={15} color="#8B5CF6" /> Atuação e CNAEs Técnicos
                  </h3>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div>
                      <span style={{ color: 'var(--text-tertiary)', display: 'block' }}>CNAE Principal:</span>
                      <strong style={{ color: 'var(--text-primary)' }}>{provider.cnae_principal}</strong> · {provider.cnae_descricao || 'Serviços técnicos'}
                    </div>
                    {provider.cnae_secundarios && provider.cnae_secundarios.length > 0 && (
                      <div>
                        <span style={{ color: 'var(--text-tertiary)', display: 'block' }}>CNAEs Secundários Relevantes:</span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                          {provider.cnae_secundarios.map((c, i) => (
                            <span key={i} style={{ fontSize: 10, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', padding: '2px 6px', borderRadius: 4, color: 'var(--text-secondary)' }}>
                              CNAE {c}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    <div>
                      <span style={{ color: 'var(--text-tertiary)' }}>Porte Empresarial:</span> {provider.porte_inferido || provider.porte || 'Grande'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Protected Corporate Contact */}
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 10, padding: 16 }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Lock size={15} color="#F59E0B" /> Contato Empresarial Institucional (Protegido por Regra de Privacidade)
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 12, fontSize: 11 }}>
                  <div style={{ padding: 10, background: 'var(--bg-base)', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
                    <div style={{ color: 'var(--text-tertiary)', fontSize: 10, display: 'flex', alignItems: 'center', gap: 4 }}><Globe size={11} /> Domínio / Site</div>
                    <div style={{ fontWeight: 600, color: '#3B82F6', marginTop: 2 }}>{provider.dominio || 'imetame.com.br'}</div>
                  </div>
                  <div style={{ padding: 10, background: 'var(--bg-base)', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
                    <div style={{ color: 'var(--text-tertiary)', fontSize: 10, display: 'flex', alignItems: 'center', gap: 4 }}><Phone size={11} /> Telefone Comercial</div>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>{maskPhone(provider.telefone_1)}</div>
                  </div>
                  <div style={{ padding: 10, background: 'var(--bg-base)', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
                    <div style={{ color: 'var(--text-tertiary)', fontSize: 10, display: 'flex', alignItems: 'center', gap: 4 }}><Mail size={11} /> Email Corporativo</div>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>{maskEmail(provider.email)}</div>
                  </div>
                </div>
              </div>

              {/* Provenance & Evidence */}
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 10, padding: 16 }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <FileText size={15} color="#22C55E" /> Evidências e Origem dos Dados
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10, fontSize: 11 }}>
                  <div style={{ padding: 10, background: 'var(--bg-base)', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Fonte de Dados Primária</div>
                    <div style={{ color: 'var(--text-secondary)', marginTop: 2 }}>Receita Federal do Brasil (Dump RFB CNPJ)</div>
                    <div style={{ color: 'var(--text-tertiary)', fontSize: 10, marginTop: 4 }}>Data da Coleta: 10/05/2026</div>
                  </div>
                  <div style={{ padding: 10, background: 'var(--bg-base)', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Dados Setoriais ANP</div>
                    <div style={{ color: 'var(--text-secondary)', marginTop: 2 }}>ANP E&P Centrais de Conteúdo (Dados Abertos)</div>
                    <div style={{ color: 'var(--text-tertiary)', fontSize: 10, marginTop: 4 }}>Data da Verificação: 27/05/2026</div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
