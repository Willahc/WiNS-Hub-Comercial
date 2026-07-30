import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Package, Building2, ExternalLink, HardHat, Target, MapPin, ShieldCheck, Globe, FileText, Award, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { DesktopSidebar, MobileSidebarContent } from '../components/AppSidebar';
import { engineeringService } from '../services/engineering';

function useMediaQuery(q: string) {
  const [match, setMatch] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches);
  useEffect(() => { const mq = window.matchMedia(q); const h = (e: MediaQueryListEvent) => setMatch(e.matches); mq.addEventListener('change', h); return () => mq.removeEventListener('change', h); }, [q]);
  return match;
}

function formatCnpj(cnpj: string): string {
  if (!cnpj || cnpj.length !== 14) return cnpj || '';
  return `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12)}`;
}

const NIVEL_LABELS: Record<string, string> = { 'A': 'Evidência Forte', 'B': 'Evidência Média', 'C': 'Evidência por CNAE' };
const NIVEL_CORES: Record<string, string> = { 'A': '#22C55E', 'B': '#F59E0B', 'C': '#3B82F6' };
const NIVEL_ICONS: Record<string, React.ReactNode> = { 'A': <CheckCircle size={16} />, 'B': <Award size={16} />, 'C': <FileText size={16} /> };
const PAPEL_CORES: Record<string, string> = { 'FABRICANTE': '#22C55E', 'DISTRIBUIDOR': '#3B82F6', 'REVENDEDOR': '#F59E0B', 'LOCADORA': '#8B5CF6' };

const TIPO_EVIDENCIA_ICONS: Record<string, React.ReactNode> = {
  'site oficial': <Globe size={14} />,
  'catalogo': <FileText size={14} />,
  'contrato': <FileText size={14} />,
  'certificado': <Award size={14} />,
  'cnae': <Building2 size={14} />,
};

const TIPO_EVIDENCIA_ORDER = ['site oficial', 'catalogo oficial', 'contrato/PNCP', 'certificado', 'fabricante ou marca oficial', 'cnae'];

const categoriaDisplay: Record<string, string> = {
  'Aco e estruturas metalicas': 'Aço e estruturas metálicas',
  'Fios e cabos': 'Fios e cabos',
  'Materiais de construcao': 'Materiais de construção',
  'Equipamentos industriais': 'Equipamentos industriais',
  'Locacao de maquinas e equipamentos': 'Locação de máquinas e equipamentos'
};

const CATEGORIA_SECTORES: Record<string, string[]> = {
  'Aco e estruturas metalicas': ['Rodovias', 'Saneamento', 'Energia', 'Mobilidade', 'Industrial'],
  'Fios e cabos': ['Energia', 'Saneamento', 'Industrial'],
  'Materiais de construcao': ['Rodovias', 'Saneamento', 'Habitacional', 'Industrial'],
};

export default function FornecedorInsumoDetailApproved() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isMobile = useMediaQuery('(max-width: 767px)');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [supplier, setSupplier] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let active = true;
    setLoading(true);
    engineeringService.getInputSupplier(id)
      .then(d => { if (active) { setSupplier(d || null); setLoading(false); } })
      .catch(err => { if (active) { setError(err?.message || 'Falha ao carregar'); setLoading(false); } });
    return () => { active = false; };
  }, [id]);

  const fontes = supplier?.fontes || [];
  const sortedFontes = [...fontes].sort((a, b) => {
    const ia = TIPO_EVIDENCIA_ORDER.indexOf(a.tipo);
    const ib = TIPO_EVIDENCIA_ORDER.indexOf(b.tipo);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

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
          <button onClick={() => navigate('/engenharia/insumos')} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
            <ArrowLeft size={16} /> Voltar
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontSize: isMobile ? 14 : 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              {loading ? 'Carregando...' : supplier?.razaoSocial || 'Fornecedor não encontrado'}
            </h1>
          </div>
        </header>

        <div style={{ padding: isMobile ? 12 : 24, flex: 1, overflowY: 'auto' }}>
          {loading && <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>Carregando fornecedor de insumo...</div>}
          {error && <div style={{ padding: 16, background: 'rgba(239,68,68,0.1)', border: '1px solid #EF4444', borderRadius: 8, color: '#EF4444', fontSize: 12 }}>{error}</div>}
          {!supplier && !loading && (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)' }}>
              <Package size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
              <p>Fornecedor de insumo não encontrado</p>
            </div>
          )}

          {supplier && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Header Card */}
              <div style={{ background: 'var(--bg-surface, #0F172A)', border: '1px solid var(--border-default, #1E293B)', borderRadius: 10, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, background: `${PAPEL_CORES[supplier.papel] || '#64748B'}20`, color: PAPEL_CORES[supplier.papel] || '#64748B', padding: '2px 8px', borderRadius: 4 }}>
                        {supplier.papel}
                      </span>
                      <span style={{ fontSize: 10, fontWeight: 700, background: `${NIVEL_CORES[supplier.nivelEvidencia] || '#64748B'}20`, color: NIVEL_CORES[supplier.nivelEvidencia] || '#64748B', padding: '2px 8px', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                        {NIVEL_ICONS[supplier.nivelEvidencia]} {NIVEL_LABELS[supplier.nivelEvidencia] || supplier.nivelEvidencia}
                      </span>
                      <span style={{ fontSize: 10, background: 'rgba(245,158,11,0.15)', color: '#F59E0B', padding: '2px 8px', borderRadius: 4 }}>
                        Cobertura parcial
                      </span>
                    </div>
                    <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px 0' }}>{supplier.razaoSocial}</h2>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>{formatCnpj(supplier.cnpj)}</p>
                    <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: '4px 0 0 0' }}>
                      <MapPin size={11} style={{ display: 'inline' }} /> {supplier.municipio ? `${supplier.municipio}, ` : ''}{supplier.uf}
                    </p>
                  </div>
                  {supplier.cnpj && (
                    <button onClick={() => navigate(`/empresas/${supplier.cnpj}`)} style={{ height: 32, padding: '0 12px', fontSize: 11, fontWeight: 600, background: '#8B5CF6', color: '#FFF', border: 'none', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <ExternalLink size={13} /> Empresa 360°
                    </button>
                  )}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
                {/* Category & Role */}
                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 10, padding: 16 }}>
                  <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Package size={14} color="#8B5CF6" /> Classificação Comercial
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 11 }}>
                    <div>
                      <span style={{ color: 'var(--text-tertiary)' }}>Categoria de Insumo</span>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>
                        <span style={{ background: 'rgba(139,92,246,0.12)', color: '#8B5CF6', padding: '2px 8px', borderRadius: 4 }}>
                          {categoriaDisplay[supplier.categoria] || supplier.categoria}
                        </span>
                      </div>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-tertiary)' }}>Papel Empresarial</span>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>{supplier.papel}</div>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-tertiary)' }}>CNAE Principal</span>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>{supplier.cnaePrincipal || '—'}</div>
                    </div>
                    {supplier.cnaesSecundarios && supplier.cnaesSecundarios.length > 0 && (
                      <div>
                        <span style={{ color: 'var(--text-tertiary)' }}>CNAEs Secundários</span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                          {supplier.cnaesSecundarios.map((c: string, i: number) => (
                            <span key={i} style={{ fontSize: 10, background: 'var(--bg-base)', color: 'var(--text-secondary)', padding: '1px 6px', borderRadius: 3 }}>{c}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Evidence */}
                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 10, padding: 16 }}>
                  <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ShieldCheck size={14} color="#22C55E" /> Evidência Comercial
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 11 }}>
                    <div>
                      <span style={{ color: 'var(--text-tertiary)' }}>Nível de Evidência</span>
                      <div style={{ fontWeight: 600, color: NIVEL_CORES[supplier.nivelEvidencia] || 'var(--text-primary)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                        {NIVEL_ICONS[supplier.nivelEvidencia]} {NIVEL_LABELS[supplier.nivelEvidencia] || supplier.nivelEvidencia}
                      </div>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-tertiary)' }}>Confiança</span>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>{supplier.confianca || '—'}%</div>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-tertiary)' }}>Data da Verificação</span>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>{supplier.dataVerificacao || '—'}</div>
                    </div>
                    <div style={{ marginTop: 4, padding: '8px 10px', background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.15)', borderRadius: 6 }}>
                      <p style={{ margin: 0, fontSize: 10, color: 'var(--text-tertiary)', lineHeight: 1.4 }}>
                        <strong>Evidência comercial ≠ Compatibilidade por CNAE.</strong> Esta classificação indica que a empresa possui evidências verificáveis de atividade comercial no setor de insumos. Não afirma fornecimento para obra específica.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Evidence Sources */}
              {sortedFontes.length > 0 && (
                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 10, padding: 16 }}>
                  <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Globe size={14} color="#3B82F6" /> Fontes Utilizadas
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {sortedFontes.map((f: any, i: number) => (
                      <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 10px', background: 'var(--bg-base)', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
                        <div style={{ width: 28, height: 28, borderRadius: 5, background: `${NIVEL_CORES[f.nivel] || '#64748B'}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: NIVEL_CORES[f.nivel] || '#64748B' }}>
                          {TIPO_EVIDENCIA_ICONS[f.tipo] || <FileText size={14} />}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>{f.nome}</span>
                            <span style={{ fontSize: 9, background: `${NIVEL_CORES[f.nivel] || '#64748B'}20`, color: NIVEL_CORES[f.nivel] || '#64748B', padding: '1px 5px', borderRadius: 3 }}>Nível {f.nivel}</span>
                            <span style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>{f.data_consulta}</span>
                          </div>
                          <p style={{ margin: '2px 0 0 0', fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                            {f.descricao}
                          </p>
                          {f.referencia && <p style={{ margin: '2px 0 0 0', fontSize: 9, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>Ref: {f.referencia}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Products & Brands */}
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 10, padding: 16 }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Target size={14} color="#F59E0B" /> Produtos ou Famílias Evidenciadas
                </h3>
                {supplier.produtos && supplier.produtos.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {supplier.produtos.map((p: string, i: number) => (
                      <span key={i} style={{ fontSize: 10, background: 'rgba(245,158,11,0.12)', color: '#F59E0B', padding: '2px 8px', borderRadius: 4 }}>{p}</span>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: 0 }}>
                    Famílias de produtos associadas à categoria {categoriaDisplay[supplier.categoria] || supplier.categoria}. Consulte as fontes para detalhamento.
                  </p>
                )}
              </div>

              {/* Obras Relacionadas */}
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 10, padding: 16 }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <HardHat size={14} color="#3B82F6" /> Obras que Demandam esta Categoria
                </h3>
                <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '0 0 12px 0', lineHeight: 1.5 }}>
                  Insumos da categoria <strong>{categoriaDisplay[supplier.categoria] || supplier.categoria}</strong> são tipicamente demandados em obras dos setores:
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                  {(CATEGORIA_SECTORES[supplier.categoria] || ['Rodovias', 'Saneamento', 'Energia']).map((s: string) => (
                    <span key={s} style={{ fontSize: 10, background: 'rgba(59,130,246,0.12)', color: '#3B82F6', padding: '2px 8px', borderRadius: 4 }}>{s}</span>
                  ))}
                </div>
                <button onClick={() => navigate('/engenharia/obras')} style={{ height: 32, padding: '0 12px', fontSize: 11, fontWeight: 600, background: '#3B82F6', color: '#FFF', border: 'none', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <HardHat size={13} /> Explorar obras por setor
                </button>
              </div>

              {/* Provenance */}
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 10, padding: 16 }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 12px 0' }}>Proveniência</h3>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 12, fontSize: 11 }}>
                  <div><span style={{ color: 'var(--text-tertiary)' }}>Fonte</span><br /><strong style={{ color: 'var(--text-primary)' }}>Piloto Lotes 3+4 · Auditoria de Evidências</strong></div>
                  <div><span style={{ color: 'var(--text-tertiary)' }}>Validação</span><br /><strong style={{ color: 'var(--text-primary)' }}>{supplier.dataVerificacao || '—'}</strong></div>
                  <div><span style={{ color: 'var(--text-tertiary)' }}>Confiança</span><br /><strong style={{ color: 'var(--text-primary)' }}>{supplier.confianca || '—'}%</strong></div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
