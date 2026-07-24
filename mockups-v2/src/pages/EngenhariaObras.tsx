import React, { useState, useEffect } from 'react';
import {
  HardHat, Search, RotateCcw, ChevronRight, Menu, X,
  LayoutDashboard, Share2, Map as MP, LogOut, ShieldCheck,
  Bell, Sun, SlidersHorizontal, Filter, ChevronDown,
  ChevronUp, AlertTriangle, DollarSign, Home, Users,
  Briefcase, EyeOff, ChevronLeft, ArrowUpRight,
  Calendar, FolderOpen, List, Table as TbIcon, Download, Save, Bookmark,
  HelpCircle, Info, CheckCircle, XCircle, CheckSquare,
  Square, GripVertical, Columns, MapPin, FileText,
  Building2, Target, Clock, ExternalLink, MoreHorizontal,
  Tractor, Truck, Stethoscope, Plus,
} from 'lucide-react';

const ENG_COLOR = '#3B82F6';

function fmt(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1).replace('.', ',') + ' mil';
  return String(n);
}
function fmtCapex(n: number): string {
  if (n >= 1e9) return 'R$ ' + (n / 1e9).toFixed(1).replace('.', ',') + ' bi';
  if (n >= 1e6) return 'R$ ' + (n / 1e6).toFixed(1).replace('.', ',') + ' M';
  if (n >= 1e3) return 'R$ ' + (n / 1e3).toFixed(1).replace('.', ',') + ' mil';
  return 'R$ ' + n;
}

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

const obrasData = [
  { id: 1, obra: 'Reforço Ponte Rio-Niterói', mun: 'Niterói', uf: 'RJ', empresa: 'Consórcio Ponte S.A.', cnpj: '12.345.678/0001-90', fase: 'Execução', status: 'Em andamento', setor: 'Transporte', capex: 47200000, capexHom: true, oportunidade: { score: 92, classe: 'PROVÁVEL', matches: 4 }, qualidade: 'Completo', qualCor: '#22C55E', fonte: 'DNIT-SICRO', atualizacao: 'Jul/2026', lat: -22.88, lng: -43.11 },
  { id: 2, obra: 'Duplicação BR-101 Sul', mun: 'Araranguá', uf: 'SC', empresa: 'Via Sul Engenharia', cnpj: '98.765.432/0001-11', fase: 'Execução', status: 'Em andamento', setor: 'Transporte', capex: 183500000, capexHom: true, oportunidade: { score: 88, classe: 'PROVÁVEL', matches: 3 }, qualidade: 'Município ausente', qualCor: '#F97316', fonte: 'DNIT-SICRO', atualizacao: 'Jun/2026', lat: -28.93, lng: -49.49 },
  { id: 3, obra: 'Nova Estação Metrô SP', mun: '', uf: 'SP', empresa: 'Metrô SP', cnpj: '45.678.901/0001-23', fase: 'Planejamento', status: 'Em planejamento', setor: 'Transporte', capex: 320000000, capexHom: true, oportunidade: { score: 76, classe: 'PROVÁVEL', matches: 2 }, qualidade: 'Município ausente', qualCor: '#F97316', fonte: 'Governo SP', atualizacao: 'Mai/2026', lat: -23.55, lng: -46.63 },
  { id: 4, obra: 'Hospital Regional BA', mun: 'Feira de Santana', uf: 'BA', empresa: '', cnpj: '', fase: 'Projeto', status: 'Em projeto', setor: 'Saúde', capex: 0, capexHom: false, oportunidade: { score: 65, classe: 'POTENCIAL', matches: 1 }, qualidade: 'Empresa ausente', qualCor: '#EF4444', fonte: 'SES-BA', atualizacao: 'Abr/2026', lat: -12.26, lng: -38.96 },
  { id: 5, obra: 'Contorno Viário Florianópolis', mun: 'São José', uf: 'SC', empresa: 'ViaSC Concessões', cnpj: '33.444.555/0001-66', fase: 'Execução', status: 'Em andamento', setor: 'Transporte', capex: 245800000, capexHom: true, oportunidade: { score: 85, classe: 'PROVÁVEL', matches: 3 }, qualidade: 'Completo', qualCor: '#22C55E', fonte: 'ANEOR', atualizacao: 'Jul/2026', lat: -27.61, lng: -48.63 },
  { id: 6, obra: 'Usina Hidrelétrica PA', mun: 'Altamira', uf: 'PA', empresa: 'Norte Energia S.A.', cnpj: '11.222.333/0001-44', fase: 'Execução', status: 'Em andamento', setor: 'Energia', capex: 580000000, capexHom: true, oportunidade: { score: 71, classe: 'PROVÁVEL', matches: 2 }, qualidade: 'Completo', qualCor: '#22C55E', fonte: 'ANEEL', atualizacao: 'Jul/2026', lat: -3.20, lng: -52.20 },
  { id: 7, obra: 'Saneamento Básico PE', mun: '', uf: 'PE', empresa: '', cnpj: '', fase: 'Licitação', status: 'Em licitação', setor: 'Saneamento', capex: 0, capexHom: false, oportunidade: { score: 58, classe: 'POTENCIAL', matches: 1 }, qualidade: 'Múltiplas lacunas', qualCor: '#EF4444', fonte: 'Gov. PE', atualizacao: 'Mar/2026', lat: -8.05, lng: -34.90 },
  { id: 8, obra: 'Terminal Portuário Santos', mun: 'Santos', uf: 'SP', empresa: 'Porto de Santos S.A.', cnpj: '55.666.777/0001-88', fase: 'Projeto', status: 'Em projeto', setor: 'Logística', capex: 1200000000, capexHom: true, oportunidade: { score: 82, classe: 'PROVÁVEL', matches: 5 }, qualidade: 'Completo', qualCor: '#22C55E', fonte: 'Antaq', atualizacao: 'Jun/2026', lat: -23.96, lng: -46.33 },
  { id: 9, obra: 'Escola Técnica Rural MG', mun: 'Uberlândia', uf: 'MG', empresa: 'Construtora Minas Ltda.', cnpj: '77.888.999/0001-00', fase: 'Execução', status: 'Em andamento', setor: 'Educação', capex: 28500000, capexHom: true, oportunidade: { score: 45, classe: 'POTENCIAL', matches: 1 }, qualidade: 'Completo', qualCor: '#22C55E', fonte: 'FNDE', atualizacao: 'Jul/2026', lat: -18.91, lng: -48.27 },
  { id: 10, obra: 'Ampliação Aeroporto GRU', mun: 'Guarulhos', uf: 'SP', empresa: 'GRU Airport', cnpj: '01.234.567/0001-89', fase: 'Planejamento', status: 'Em planejamento', setor: 'Transporte', capex: 2100000000, capexHom: true, oportunidade: { score: 90, classe: 'PROVÁVEL', matches: 6 }, qualidade: 'Completo', qualCor: '#22C55E', fonte: 'SAC', atualizacao: 'Jun/2026', lat: -23.43, lng: -46.47 },
  { id: 11, obra: 'Ponte Estaiada Rio', mun: 'Rio de Janeiro', uf: 'RJ', empresa: '', cnpj: '', fase: 'Projeto', status: 'Em projeto', setor: 'Transporte', capex: 450000000, capexHom: false, oportunidade: { score: 73, classe: 'PROVÁVEL', matches: 2 }, qualidade: 'Empresa ausente', qualCor: '#EF4444', fonte: 'Pref. RJ', atualizacao: 'Fev/2026', lat: -22.90, lng: -43.20 },
  { id: 12, obra: 'Barragem Hídrica CE', mun: 'Jaguaribe', uf: 'CE', empresa: 'Consórcio Águas do CE', cnpj: '22.333.444/0001-55', fase: 'Execução', status: 'Em andamento', setor: 'Recursos Hídricos', capex: 89000000, capexHom: true, oportunidade: { score: 67, classe: 'PROVÁVEL', matches: 2 }, qualidade: 'Completo', qualCor: '#22C55E', fonte: 'COGERH', atualizacao: 'Mai/2026', lat: -5.89, lng: -38.62 },
  { id: 13, obra: 'Centro Administrativo GO', mun: '', uf: 'GO', empresa: '', cnpj: '', fase: 'Planejamento', status: 'Em planejamento', setor: 'Administrativo', capex: 0, capexHom: false, oportunidade: { score: 35, classe: 'POTENCIAL', matches: 0 }, qualidade: 'Múltiplas lacunas', qualCor: '#EF4444', fonte: 'Gov. GO', atualizacao: 'Jan/2026', lat: -16.68, lng: -49.25 },
  { id: 14, obra: 'Ferrovia Norte-Sul Trecho 3', mun: 'Palmas', uf: 'TO', empresa: 'VALEC S.A.', cnpj: '44.555.666/0001-77', fase: 'Execução', status: 'Em andamento', setor: 'Transporte', capex: 780000000, capexHom: true, oportunidade: { score: 79, classe: 'PROVÁVEL', matches: 3 }, qualidade: 'Completo', qualCor: '#22C55E', fonte: 'ANTT', atualizacao: 'Jul/2026', lat: -10.24, lng: -48.35 },
  { id: 15, obra: 'Complexo Eólico RN', mun: 'Natal', uf: 'RN', empresa: 'Ventos do NE S.A.', cnpj: '66.777.888/0001-99', fase: 'Execução', status: 'Em andamento', setor: 'Energia', capex: 1350000000, capexHom: true, oportunidade: { score: 87, classe: 'PROVÁVEL', matches: 4 }, qualidade: 'Completo', qualCor: '#22C55E', fonte: 'ANEEL', atualizacao: 'Jul/2026', lat: -5.79, lng: -35.21 },
];

const allColumns = [
  { key: 'selecao', label: '', always: true },
  { key: 'obra', label: 'Obra', always: true },
  { key: 'munUf', label: 'Município / UF', always: true },
  { key: 'empresa', label: 'Empresa', always: true },
  { key: 'cnpj', label: 'CNPJ', default: false },
  { key: 'fase', label: 'Fase', always: true },
  { key: 'status', label: 'Status', default: false },
  { key: 'setor', label: 'Setor', default: false },
  { key: 'capex', label: 'CAPEX', always: true },
  { key: 'oportunidade', label: 'Oportunidade', always: true },
  { key: 'qualidade', label: 'Qualidade', always: true },
  { key: 'atualizacao', label: 'Atualização', always: true },
  { key: 'acoes', label: '', always: true },
];

const modalColumnsList = [
  { key: 'obra', label: 'Obra', mandatory: true },
  { key: 'munUf', label: 'Município / UF', mandatory: true },
  { key: 'empresa', label: 'Empresa', mandatory: true },
  { key: 'cnpj', label: 'CNPJ', mandatory: false },
  { key: 'fase', label: 'Fase', mandatory: true },
  { key: 'status', label: 'Status detalhado', mandatory: false },
  { key: 'setor', label: 'Setor', mandatory: false },
  { key: 'capex', label: 'CAPEX', mandatory: true },
  { key: 'oportunidade', label: 'Oportunidade', mandatory: true },
  { key: 'qualidade', label: 'Qualidade', mandatory: true },
  { key: 'atualizacao', label: 'Atualização', mandatory: true },
  { key: 'idObra', label: 'ID da obra', mandatory: false },
  { key: 'fonte', label: 'Fonte', mandatory: false },
  { key: 'coordenada', label: 'Coordenada', mandatory: false },
  { key: 'precisaoGeo', label: 'Precisão geográfica', mandatory: false },
  { key: 'fornecedorRec', label: 'Fornecedor recomendado', mandatory: false },
  { key: 'decisor', label: 'Decisor', mandatory: false },
  { key: 'dataIdent', label: 'Data de identificação', mandatory: false },
  { key: 'qtdRelac', label: 'Quantidade de relacionamentos', mandatory: false },
  { key: 'acoes', label: 'Ações', mandatory: true },
];

const sortOptions = [
  { label: 'CAPEX maior', value: 'capex-desc' },
  { label: 'CAPEX menor', value: 'capex-asc' },
  { label: 'Atualização recente', value: 'atualizacao-desc' },
  { label: 'Nome', value: 'nome-asc' },
  { label: 'Município', value: 'mun-asc' },
  { label: 'Oportunidade', value: 'oportunidade-desc' },
  { label: 'Qualidade cadastral', value: 'qualidade-asc' },
];

function QualBadge({ text, color }: { text: string; color: string }) {
  const bgMap: Record<string, string> = {
    '#22C55E': '#22C55E22',
    '#F97316': '#F9731622',
    '#EF4444': '#EF444422',
  };
  return (
    <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 8, background: bgMap[color] || color + '22', color, whiteSpace: 'nowrap', fontWeight: 500 }}>
      {text}
    </span>
  );
}

function MobileSidebarContent({ onClose }: { onClose: () => void }) {
  const navItems = [
    { icon: LayoutDashboard, label: 'Visão Geral', route: '/visao-geral' },
    { icon: HardHat, label: 'Engenharia', route: '/engenharia' },
    { icon: HardHat, label: '— Lista de Obras', route: '/engenharia/obras', sub: true },
    { icon: Tractor, label: 'Agro', route: '/engenharia' },
    { icon: Truck, label: 'Logística', route: '/engenharia' },
    { icon: Stethoscope, label: 'Saúde', route: '/engenharia' },
    { icon: Share2, label: 'Relacionamentos', route: '/engenharia' },
    { icon: Building2, label: 'Empresa 360°', route: '/engenharia' },
    { icon: MP, label: 'Inteligência Territorial', route: '/engenharia' },
    { icon: Search, label: 'Busca Global', route: '/engenharia' },
  ];
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid var(--border-default)' }}>
        <div style={{ width: 28, height: 28, borderRadius: 6, background: 'linear-gradient(135deg, var(--accent-blue), #6C5CE7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#fff' }}>W</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>WiNS Hub</div>
          <div style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>Inteligência Multivertical</div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: 4 }}><X size={18} /></button>
      </div>
      <nav style={{ flex: 1, padding: 8, overflowY: 'auto' }}>
        {navItems.map(item => (
          <a key={item.label} href={item.route} onClick={onClose} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: item.sub ? '6px 10px 6px 30px' : '8px 10px',
            borderRadius: 'var(--radius-sm)', color: item.route === '/engenharia/obras' ? ENG_COLOR : 'var(--text-secondary)',
            fontSize: 12, fontWeight: item.route === '/engenharia/obras' ? 600 : 400,
            background: item.route === '/engenharia/obras' ? `${ENG_COLOR}18` : 'transparent',
            textDecoration: 'none', marginBottom: 1,
          }}>
            {item.sub ? null : <item.icon size={16} style={{ flexShrink: 0 }} />}
            <span>{item.label}</span>
          </a>
        ))}
      </nav>
      <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border-default)', fontSize: 10, color: 'var(--text-tertiary)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}><ShieldCheck size={12} /> Homologação</div>
        <div>William · Analista</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, cursor: 'pointer', color: 'var(--text-secondary)' }}><LogOut size={12} /> Sair</div>
      </div>
    </>
  );
}

function DesktopSidebar() {
  const active = '/engenharia/obras';
  const nav = [
    { icon: LayoutDashboard, label: 'Visão Geral', route: '/visao-geral' },
    { icon: HardHat, label: 'Engenharia', route: '/engenharia' },
    { icon: null as any, label: '— Lista de Obras', route: '/engenharia/obras', sub: true },
    { icon: Tractor, label: 'Agro', route: '/engenharia' },
    { icon: Truck, label: 'Logística', route: '/engenharia' },
    { icon: Stethoscope, label: 'Saúde', route: '/engenharia' },
    { icon: Share2, label: 'Relacionamentos', route: '/engenharia' },
    { icon: Building2, label: 'Empresa 360°', route: '/engenharia' },
    { icon: MP, label: 'Inteligência Territorial', route: '/engenharia' },
    { icon: Search, label: 'Busca Global', route: '/engenharia' },
  ];
  return (
    <aside style={{ width: 'var(--sidebar-w)', height: '100vh', background: 'var(--bg-sidebar)', borderRight: '1px solid var(--border-default)', display: 'flex', flexDirection: 'column', position: 'fixed', left: 0, top: 0, zIndex: 100 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '18px 16px', borderBottom: '1px solid var(--border-default)', minHeight: 64 }}>
        <div style={{ width: 30, height: 30, borderRadius: 7, background: 'linear-gradient(135deg, var(--accent-blue), #6C5CE7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#fff', flexShrink: 0 }}>W</div>
        <div><div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>WiNS Hub</div><div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 1 }}>Inteligência Multivertical</div></div>
      </div>
      <nav style={{ flex: 1, padding: '8px 8px', overflowY: 'auto' }}>
        {nav.map(item => {
          const isActive = item.route === active;
          return (
            <a key={item.label} href={item.route} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: item.sub ? '5px 10px 5px 32px' : '7px 10px',
              borderRadius: 'var(--radius-sm)', color: isActive ? ENG_COLOR : 'var(--text-secondary)',
              fontSize: 12, fontWeight: isActive ? 600 : 400,
              background: isActive ? `${ENG_COLOR}18` : 'transparent',
              textDecoration: 'none', marginBottom: 1,
            }}>
              {item.sub ? null : <item.icon size={16} style={{ flexShrink: 0 }} />}
              <span>{item.label}</span>
            </a>
          );
        })}
      </nav>
      <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border-default)', fontSize: 10, color: 'var(--text-tertiary)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}><ShieldCheck size={12} /> Homologação</div>
        <div>William · Analista</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, cursor: 'pointer', color: 'var(--text-secondary)' }}><LogOut size={12} /> Sair</div>
      </div>
    </aside>
  );
}

export default function EngenhariaObras() {
  const isMobile = useMediaQuery('(max-width: 767px)');
  const isTablet = useMediaQuery('(min-width: 768px) and (max-width: 1199px)');

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState<number | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [moreActionsOpen, setMoreActionsOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [selected, setSelected] = useState<number[]>([]);
  const [sortBy, setSortBy] = useState('capex-desc');
  const [density, setDensity] = useState<'comfortable' | 'compact'>('comfortable');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [filters, setFilters] = useState<Record<string, string>>({ busca: '', uf: '', mun: '', status: '', fase: '', setor: '' });
  const [advFilters, setAdvFilters] = useState<Record<string, string>>({ empresa: '', capexMin: '', capexMax: '', dtIni: '', dtFim: '' });
  const [advCheck, setAdvCheck] = useState<Record<string, boolean>>({ comEmp: false, comMun: false, comFor: false, comDec: false, comOport: false, capHom: false, qualCad: false, fonte: '', atualiz: '' });
  const [visibleCols, setVisibleCols] = useState<Record<string, boolean>>({
    obra: true, munUf: true, empresa: true, cnpj: false, fase: true, status: false, setor: false, capex: true, oportunidade: true, qualidade: true, atualizacao: true,
  });

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2800); };

  const allSelected = selected.length === obrasData.length && obrasData.length > 0;
  const toggleAll = () => { if (allSelected) setSelected([]); else setSelected(obrasData.map(o => o.id)); };
  const toggleOne = (id: number) => { setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]); };

  // Calculate total active filters count (main + advanced)
  let activeCount = 0;
  if (filters.busca) activeCount++;
  if (filters.uf) activeCount++;
  if (filters.mun) activeCount++;
  if (filters.status) activeCount++;
  if (filters.fase) activeCount++;
  if (filters.setor) activeCount++;
  if (advFilters.empresa) activeCount++;
  if (advFilters.capexMin) activeCount++;
  if (advFilters.capexMax) activeCount++;
  if (advFilters.dtIni) activeCount++;
  if (advFilters.dtFim) activeCount++;
  if (advCheck.comEmp) activeCount++;
  if (advCheck.comMun) activeCount++;
  if (advCheck.comFor) activeCount++;
  if (advCheck.comDec) activeCount++;
  if (advCheck.comOport) activeCount++;
  if (advCheck.capHom) activeCount++;
  if (advCheck.qualCad) activeCount++;
  if (advCheck.fonte) activeCount++;
  if (advCheck.atualiz) activeCount++;

  const activeLabel = activeCount === 1 ? '1 ativo' : `${activeCount} ativos`;

  const filterChips: { label: string; key: string }[] = [];
  if (filters.uf) filterChips.push({ label: `UF: ${filters.uf}`, key: 'uf' });
  if (filters.fase) filterChips.push({ label: `Fase: ${filters.fase}`, key: 'fase' });
  if (advCheck.capHom) filterChips.push({ label: 'CAPEX homologado', key: 'capHom' });
  if (advCheck.comOport) filterChips.push({ label: 'Com oportunidade', key: 'comOport' });

  const filtered = obrasData.filter(o => {
    if (filters.busca) {
      const q = filters.busca.toLowerCase();
      if (!o.obra.toLowerCase().includes(q) && !o.empresa.toLowerCase().includes(q) && !o.cnpj.includes(q) && !o.mun.toLowerCase().includes(q)) return false;
    }
    if (filters.uf && o.uf !== filters.uf) return false;
    if (filters.mun && !o.mun.toLowerCase().includes(filters.mun.toLowerCase())) return false;
    if (filters.status && o.status !== filters.status) return false;
    if (filters.fase && o.fase !== filters.fase) return false;
    if (filters.setor && o.setor !== filters.setor) return false;
    if (advFilters.empresa && !o.empresa.toLowerCase().includes(advFilters.empresa.toLowerCase())) return false;
    if (advFilters.capexMin && o.capex < Number(advFilters.capexMin) * 1e6) return false;
    if (advFilters.capexMax && o.capex > Number(advFilters.capexMax) * 1e6) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    switch (sortBy) {
      case 'capex-desc': return b.capex - a.capex;
      case 'capex-asc': return a.capex - b.capex;
      case 'nome-asc': return a.obra.localeCompare(b.obra);
      case 'mun-asc': return (a.mun + a.uf).localeCompare(b.mun + b.uf);
      case 'oportunidade-desc': return b.oportunidade.score - a.oportunidade.score;
      default: return b.capex - a.capex;
    }
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / perPage));
  const paginated = sorted.slice((page - 1) * perPage, page * perPage);

  const activeCols = allColumns.filter(c => c.always || visibleCols[c.key]);
  const drawerObra = drawerOpen ? obrasData.find(o => o.id === drawerOpen) : null;

  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

  const colWidths: Record<string, number> = {
    selecao: 36, obra: 190, munUf: 100, empresa: 150, cnpj: 120, fase: 90, status: 100, setor: 100,
    capex: 120, oportunidade: 140, qualidade: 100, atualizacao: 80, acoes: 36,
  };
  const rowPad = density === 'compact' ? 4 : 7;

  const desktopMainPad = isMobile ? 12 : 24;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-base)', position: 'relative', overflow: 'hidden' }}>
      {toast && (
        <div style={{
          position: 'fixed', top: 80, left: '50%', transform: 'translateX(-50%)', zIndex: 99999,
          background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-md)', padding: '8px 16px',
          display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 12, color: 'var(--text-primary)',
          boxShadow: 'var(--shadow-lg)', pointerEvents: 'none',
        }}>
          <Info size={14} color={ENG_COLOR} />
          {toast}
        </div>
      )}

      {isMobile ? (
        <>
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', zIndex: 200, opacity: sidebarOpen ? 1 : 0, pointerEvents: sidebarOpen ? 'auto' : 'none', transition: 'opacity 0.2s' }} onClick={() => setSidebarOpen(false)} />
          <aside style={{ position: 'fixed', top: 0, left: 0, height: '100vh', width: 280, background: 'var(--bg-sidebar)', zIndex: 201, transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)', transition: 'transform 0.25s ease', display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border-default)' }}>
            <MobileSidebarContent onClose={() => setSidebarOpen(false)} />
          </aside>
        </>
      ) : (
        <DesktopSidebar />
      )}

      <div style={{ marginLeft: isMobile ? 0 : 'var(--sidebar-w)', flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, maxWidth: '100vw' }}>
        <header style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-default)', position: 'sticky', top: 0, zIndex: 50 }}>
          <div style={{ height: 'var(--topbar-h)', display: 'flex', alignItems: 'center', padding: isMobile ? '0 12px' : '0 24px', gap: isMobile ? 8 : 16 }}>
            {isMobile && <button onClick={() => setSidebarOpen(true)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 4 }}><Menu size={20} /></button>}
            <div style={{ flex: 1, minWidth: 0 }}>
              {!isMobile && <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 2 }}><a href="/engenharia" style={{ color: 'var(--text-tertiary)', textDecoration: 'none' }}>Engenharia</a> <span style={{ margin: '0 4px' }}>/</span> <span style={{ color: ENG_COLOR }}>Obras</span></div>}
              <h1 style={{ fontSize: isMobile ? 14 : 16, fontWeight: 600, color: 'var(--text-primary)' }}>Obras</h1>
              {!isMobile && <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>Diretório de obras, investimentos, empresas e oportunidades</p>}
            </div>
            <div style={{ position: 'relative', width: isMobile ? 120 : 200, flexShrink: 0 }}>
              <Search size={12} style={{ position: 'absolute', left: 7, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
              <input placeholder={isMobile ? 'Buscar…' : 'Buscar obras…'} value={filters.busca} onChange={e => setFilters(prev => ({ ...prev, busca: e.target.value }))} style={{ width: '100%', height: 30, paddingLeft: 24, fontSize: 10, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)' }} />
            </div>
            {!isMobile && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text-secondary)', cursor: 'pointer', flexShrink: 0 }}>
                <Calendar size={12} /><span>Jul 2026</span><ChevronDown size={9} />
              </div>
            )}
            {!isMobile && (
              <button style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-sm)', color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer' }}>
                <Sun size={13} />
              </button>
            )}
            {!isMobile && (
              <button style={{ position: 'relative', width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-sm)', color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer' }}>
                <Bell size={13} />
                <span style={{ position: 'absolute', top: 5, right: 5, width: 5, height: 5, borderRadius: '50%', background: ENG_COLOR }} />
              </button>
            )}
            {!isMobile && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 6px 3px 3px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', flexShrink: 0 }}>
                <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent-blue), #6C5CE7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff' }}>W</div>
                <div style={{ lineHeight: 1.2 }}><div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>William</div><div style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>Analista</div></div>
              </div>
            )}
          </div>
        </header>

        <main style={{ flex: 1, overflowY: 'auto', padding: desktopMainPad, maxWidth: 1680, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 10 : 14 }}>

            {/* ── Breadcrumb mobile ── */}
            {isMobile && <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}><a href="/engenharia" style={{ color: 'var(--text-tertiary)', textDecoration: 'none' }}>Engenharia</a> <span style={{ margin: '0 4px' }}>/</span> <span style={{ color: ENG_COLOR }}>Obras</span></div>}

            {/* ── 1. Summary metrics ── */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: isMobile ? 6 : 10 }}>
              {[
                { label: 'Obras visíveis', value: '16.633', sub: 'no recorte atual' },
                { label: 'CAPEX homologado', value: 'R$ 243,5 bi', sub: '3.146 obras com valor' },
                { label: 'Obras com empresa', value: '12.413', sub: '74,6% do total' },
                { label: 'Obras com município', value: '9.544', sub: '57,4% do total' },
              ].map(m => (
                <div key={m.label} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: isMobile ? 10 : 12, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: isMobile ? 9 : 10, color: 'var(--text-tertiary)' }}>{m.label}</span>
                  <span style={{ fontSize: isMobile ? 15 : 20, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.2px' }}>{m.value}</span>
                  <span style={{ fontSize: isMobile ? 8 : 9, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 3 }}>
                    {m.sub}
                    <HelpCircle size={9} style={{ cursor: 'pointer', flexShrink: 0 }} onClick={() => showToast('ℹ️ Definição: ' + m.label + ' no recorte atual. Fonte: WiNS Hub.')} />
                  </span>
                </div>
              ))}
            </div>

            {/* ── 2. Filters card ── */}
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
                <Filter size={12} color={ENG_COLOR} />
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>Filtros do diretório</span>
                {activeCount > 0 && (
                  <span style={{ fontSize: 9, padding: '1px 6px', background: `${ENG_COLOR}22`, color: ENG_COLOR, borderRadius: 8, fontWeight: 600 }}>
                    {activeLabel}
                  </span>
                )}
              </div>

              {/* Main filters bar */}
              <div style={{ display: 'flex', gap: 5, padding: '8px 12px', flexWrap: 'wrap', borderBottom: (advancedOpen && !isMobile) ? '1px solid var(--border-subtle)' : 'none' }}>
                <div style={{ flex: '1 1 160px', minWidth: 100, position: 'relative' }}>
                  <Search size={10} style={{ position: 'absolute', left: 6, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                  <input placeholder="Buscar obra, empresa, CNPJ…" value={filters.busca} onChange={e => setFilters(prev => ({ ...prev, busca: e.target.value }))}
                    style={{ width: '100%', height: 26, paddingLeft: 20, fontSize: 9, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-secondary)' }} />
                </div>
                <select value={filters.uf} onChange={e => setFilters(prev => ({ ...prev, uf: e.target.value }))} style={{ fontSize: 9, padding: '2px 5px', background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-secondary)', height: 26 }}>
                  <option value="">UF: Todas</option>
                  {['SP','MG','RJ','BA','RS','SC','PR','PE','CE','PA','GO','TO','RN','MT'].map(u => <option key={u} value={u}>{u}</option>)}
                </select>
                <select value={filters.mun} onChange={e => setFilters(prev => ({ ...prev, mun: e.target.value }))} style={{ fontSize: 9, padding: '2px 5px', background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-secondary)', height: 26, maxWidth: 100 }}>
                  <option value="">Município: Todos</option>
                  <option value="são paulo">São Paulo</option><option value="rio de janeiro">Rio de Janeiro</option>
                </select>
                <select value={filters.status} onChange={e => setFilters(prev => ({ ...prev, status: e.target.value }))} style={{ fontSize: 9, padding: '2px 5px', background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-secondary)', height: 26 }}>
                  <option value="">Status: Todos</option>
                  <option value="Em andamento">Em andamento</option><option value="Em planejamento">Planejamento</option>
                  <option value="Em projeto">Projeto</option><option value="Em licitação">Licitação</option>
                </select>
                <select value={filters.fase} onChange={e => setFilters(prev => ({ ...prev, fase: e.target.value }))} style={{ fontSize: 9, padding: '2px 5px', background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-secondary)', height: 26 }}>
                  <option value="">Fase: Todas</option>
                  <option value="Execução">Execução</option><option value="Planejamento">Planejamento</option>
                  <option value="Projeto">Projeto</option><option value="Licitação">Licitação</option>
                </select>
                <select value={filters.setor} onChange={e => setFilters(prev => ({ ...prev, setor: e.target.value }))} style={{ fontSize: 9, padding: '2px 5px', background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-secondary)', height: 26 }}>
                  <option value="">Setor: Todos</option>
                  <option value="Transporte">Transporte</option><option value="Energia">Energia</option>
                  <option value="Saneamento">Saneamento</option><option value="Saúde">Saúde</option>
                  <option value="Educação">Educação</option>
                </select>
                <button onClick={() => setAdvancedOpen(!advancedOpen)} style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '2px 7px', fontSize: 9, background: advancedOpen ? `${ENG_COLOR}22` : 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: advancedOpen ? ENG_COLOR : 'var(--text-tertiary)', cursor: 'pointer', height: 26 }}>
                  <SlidersHorizontal size={9} /> Avançados {advancedOpen ? <ChevronUp size={8} /> : <ChevronDown size={8} />}
                </button>
              </div>

              {/* Desktop Advanced filters: Clean 4-column grid */}
              {advancedOpen && !isMobile && (
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px 16px' }}>
                    {/* Col 1 */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <span style={{ fontSize: 9, fontWeight: 500, color: 'var(--text-tertiary)' }}>Empresa / CNPJ</span>
                        <input type="text" placeholder="Ex: Consórcio ou CNPJ" value={advFilters.empresa} onChange={e => setAdvFilters(prev => ({ ...prev, empresa: e.target.value }))}
                          style={{ height: 26, fontSize: 9, padding: '2px 6px', background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-secondary)' }} />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input type="checkbox" id="comEmp" checked={!!advCheck.comEmp} onChange={e => setAdvCheck(prev => ({ ...prev, comEmp: e.target.checked }))} style={{ accentColor: ENG_COLOR }} />
                        <label htmlFor="comEmp" style={{ fontSize: 9, color: 'var(--text-secondary)', cursor: 'pointer' }}>Com empresa</label>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input type="checkbox" id="comDec" checked={!!advCheck.comDec} onChange={e => setAdvCheck(prev => ({ ...prev, comDec: e.target.checked }))} style={{ accentColor: ENG_COLOR }} />
                        <label htmlFor="comDec" style={{ fontSize: 9, color: 'var(--text-secondary)', cursor: 'pointer' }}>Com decisor</label>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <span style={{ fontSize: 9, fontWeight: 500, color: 'var(--text-tertiary)' }}>Fonte</span>
                        <select value={advCheck.fonte || ''} onChange={e => setAdvCheck(prev => ({ ...prev, fonte: e.target.value }))} style={{ height: 26, fontSize: 9, padding: '2px 6px', background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-secondary)' }}>
                          <option value="">Todas as fontes</option>
                          <option value="DNIT">DNIT-SICRO</option><option value="ANEEL">ANEEL</option><option value="Antaq">Antaq</option>
                        </select>
                      </div>
                    </div>

                    {/* Col 2 */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <span style={{ fontSize: 9, fontWeight: 500, color: 'var(--text-tertiary)' }}>CAPEX mínimo (R$ M)</span>
                        <input type="number" placeholder="Ex: 10" value={advFilters.capexMin} onChange={e => setAdvFilters(prev => ({ ...prev, capexMin: e.target.value }))}
                          style={{ height: 26, fontSize: 9, padding: '2px 6px', background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-secondary)' }} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <span style={{ fontSize: 9, fontWeight: 500, color: 'var(--text-tertiary)' }}>CAPEX máximo (R$ M)</span>
                        <input type="number" placeholder="Ex: 500" value={advFilters.capexMax} onChange={e => setAdvFilters(prev => ({ ...prev, capexMax: e.target.value }))}
                          style={{ height: 26, fontSize: 9, padding: '2px 6px', background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-secondary)' }} />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input type="checkbox" id="comMun" checked={!!advCheck.comMun} onChange={e => setAdvCheck(prev => ({ ...prev, comMun: e.target.checked }))} style={{ accentColor: ENG_COLOR }} />
                        <label htmlFor="comMun" style={{ fontSize: 9, color: 'var(--text-secondary)', cursor: 'pointer' }}>Com município</label>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input type="checkbox" id="comOport" checked={!!advCheck.comOport} onChange={e => setAdvCheck(prev => ({ ...prev, comOport: e.target.checked }))} style={{ accentColor: ENG_COLOR }} />
                        <label htmlFor="comOport" style={{ fontSize: 9, color: 'var(--text-secondary)', cursor: 'pointer' }}>Com oportunidade</label>
                      </div>
                    </div>

                    {/* Col 3 */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <span style={{ fontSize: 9, fontWeight: 500, color: 'var(--text-tertiary)' }}>Data inicial</span>
                        <input type="date" value={advFilters.dtIni} onChange={e => setAdvFilters(prev => ({ ...prev, dtIni: e.target.value }))}
                          style={{ height: 26, fontSize: 9, padding: '2px 6px', background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-secondary)' }} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <span style={{ fontSize: 9, fontWeight: 500, color: 'var(--text-tertiary)' }}>Data final</span>
                        <input type="date" value={advFilters.dtFim} onChange={e => setAdvFilters(prev => ({ ...prev, dtFim: e.target.value }))}
                          style={{ height: 26, fontSize: 9, padding: '2px 6px', background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-secondary)' }} />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input type="checkbox" id="comFor" checked={!!advCheck.comFor} onChange={e => setAdvCheck(prev => ({ ...prev, comFor: e.target.checked }))} style={{ accentColor: ENG_COLOR }} />
                        <label htmlFor="comFor" style={{ fontSize: 9, color: 'var(--text-secondary)', cursor: 'pointer' }}>Com fornecedor recomendado</label>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input type="checkbox" id="capHom" checked={!!advCheck.capHom} onChange={e => setAdvCheck(prev => ({ ...prev, capHom: e.target.checked }))} style={{ accentColor: ENG_COLOR }} />
                        <label htmlFor="capHom" style={{ fontSize: 9, color: 'var(--text-secondary)', cursor: 'pointer' }}>CAPEX homologado</label>
                      </div>
                    </div>

                    {/* Col 4 */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                        <input type="checkbox" id="qualCad" checked={!!advCheck.qualCad} onChange={e => setAdvCheck(prev => ({ ...prev, qualCad: e.target.checked }))} style={{ accentColor: ENG_COLOR }} />
                        <label htmlFor="qualCad" style={{ fontSize: 9, color: 'var(--text-secondary)', cursor: 'pointer' }}>Qualidade cadastral</label>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <span style={{ fontSize: 9, fontWeight: 500, color: 'var(--text-tertiary)' }}>Atualização</span>
                        <select value={advCheck.atualiz || ''} onChange={e => setAdvCheck(prev => ({ ...prev, atualiz: e.target.value }))} style={{ height: 26, fontSize: 9, padding: '2px 6px', background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-secondary)' }}>
                          <option value="">Qualquer período</option>
                          <option value="30">Últimos 30 dias</option>
                          <option value="90">Últimos 90 dias</option>
                          <option value="365">Últimos 12 meses</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Actions Row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, paddingTop: 10, borderTop: '1px solid var(--border-subtle)' }}>
                    <button onClick={() => showToast('✅ Filtros aplicados')} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 12px', fontSize: 9, fontWeight: 600, background: ENG_COLOR, border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer' }}>
                      <CheckCircle size={10} /> Aplicar
                    </button>
                    <button onClick={() => { setFilters({ busca: '', uf: '', mun: '', status: '', fase: '', setor: '' }); setAdvFilters({ empresa: '', capexMin: '', capexMax: '', dtIni: '', dtFim: '' }); setAdvCheck({ comEmp: false, comMun: false, comFor: false, comDec: false, comOport: false, capHom: false, qualCad: false, fonte: '', atualiz: '' }); }} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 12px', fontSize: 9, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                      <RotateCcw size={10} /> Limpar
                    </button>
                    <button onClick={() => showToast('💾 Visão salva — disponível na próxima fase')} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 12px', fontSize: 9, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                      <Save size={10} /> Salvar visão
                    </button>
                  </div>
                </div>
              )}

              {/* Filter Action Buttons (main bar) */}
              {(!advancedOpen || isMobile) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', flexWrap: 'wrap' }}>
                  <button onClick={() => showToast('✅ Filtros aplicados')} style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '3px 8px', fontSize: 9, fontWeight: 600, background: ENG_COLOR, border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer' }}>
                    <CheckCircle size={9} /> Aplicar
                  </button>
                  <button onClick={() => { setFilters({ busca: '', uf: '', mun: '', status: '', fase: '', setor: '' }); setAdvFilters({ empresa: '', capexMin: '', capexMax: '', dtIni: '', dtFim: '' }); setAdvCheck({ comEmp: false, comMun: false, comFor: false, comDec: false, comOport: false, capHom: false, qualCad: false, fonte: '', atualiz: '' }); }} style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '3px 8px', fontSize: 9, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                    <RotateCcw size={9} /> Limpar
                  </button>
                  <button onClick={() => showToast('💾 Visão salva — disponível na próxima fase')} style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '3px 8px', fontSize: 9, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                    <Save size={9} /> Salvar visão
                  </button>
                </div>
              )}

              {/* Active Filter Chips */}
              {filterChips.length > 0 && (
                <div style={{ display: 'flex', gap: 4, padding: '0 12px 6px', flexWrap: 'wrap' }}>
                  {filterChips.map(chip => (
                    <span key={chip.key} style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '1px 6px', fontSize: 8, background: `${ENG_COLOR}18`, color: ENG_COLOR, borderRadius: 4, border: `1px solid ${ENG_COLOR}33` }}>
                      {chip.label}
                      <X size={8} style={{ cursor: 'pointer' }} onClick={() => {
                        if (chip.key === 'uf') setFilters(prev => ({ ...prev, uf: '' }));
                        else if (chip.key === 'fase') setFilters(prev => ({ ...prev, fase: '' }));
                        else if (chip.key === 'capHom') setAdvCheck(prev => ({ ...prev, capHom: false }));
                        else if (chip.key === 'comOport') setAdvCheck(prev => ({ ...prev, comOport: false }));
                      }} />
                    </span>
                  ))}
                  <button onClick={() => { setFilters({ busca: '', uf: '', mun: '', status: '', fase: '', setor: '' }); setAdvFilters({ empresa: '', capexMin: '', capexMax: '', dtIni: '', dtFim: '' }); setAdvCheck({ comEmp: false, comMun: false, comFor: false, comDec: false, comOport: false, capHom: false, qualCad: false, fonte: '', atualiz: '' }); }} style={{ fontSize: 8, color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Limpar todos</button>
                </div>
              )}
            </div>

            {/* ── 3. Results & Header Actions Bar ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: isMobile ? 11 : 13, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>{fmt(sorted.length)} obras encontradas</span>

              {!isMobile && (
                <>
                  <button onClick={() => showToast('✨ Nova visão criada')} style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '2px 7px', fontSize: 9, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-tertiary)', cursor: 'pointer', height: 24 }}>
                    <Plus size={10} /> Nova visão
                  </button>
                  <button onClick={() => showToast('💾 Visão salva')} style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '2px 7px', fontSize: 9, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-tertiary)', cursor: 'pointer', height: 24 }}>
                    <Save size={10} /> Salvar visão
                  </button>

                  <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ fontSize: 9, padding: '2px 6px', background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-secondary)', height: 24 }}>
                    {sortOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>

                  <div style={{ display: 'flex', gap: 1, border: '1px solid var(--border-subtle)', borderRadius: 4, padding: 1 }}>
                    <button onClick={() => setDensity('comfortable')} style={{ padding: '2px 4px', background: density === 'comfortable' ? `${ENG_COLOR}22` : 'transparent', borderRadius: 3, border: 'none', cursor: 'pointer', color: density === 'comfortable' ? ENG_COLOR : 'var(--text-tertiary)' }} title="Confortável"><List size={11} /></button>
                    <button onClick={() => setDensity('compact')} style={{ padding: '2px 4px', background: density === 'compact' ? `${ENG_COLOR}22` : 'transparent', borderRadius: 3, border: 'none', cursor: 'pointer', color: density === 'compact' ? ENG_COLOR : 'var(--text-tertiary)' }} title="Compacto"><TbIcon size={11} /></button>
                  </div>

                  <div style={{ display: 'flex', gap: 1, border: '1px solid var(--border-subtle)', borderRadius: 4, padding: 1 }}>
                    <button onClick={() => setViewMode('table')} style={{ padding: '2px 4px', background: viewMode === 'table' ? `${ENG_COLOR}22` : 'transparent', borderRadius: 3, border: 'none', cursor: 'pointer', color: viewMode === 'table' ? ENG_COLOR : 'var(--text-tertiary)' }}><TbIcon size={11} /></button>
                    <button onClick={() => setViewMode('cards')} style={{ padding: '2px 4px', background: viewMode === 'cards' ? `${ENG_COLOR}22` : 'transparent', borderRadius: 3, border: 'none', cursor: 'pointer', color: viewMode === 'cards' ? ENG_COLOR : 'var(--text-tertiary)' }}><FolderOpen size={11} /></button>
                  </div>

                  <button onClick={() => setColumnsOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '2px 7px', fontSize: 9, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-tertiary)', cursor: 'pointer', height: 24 }}>
                    <Columns size={10} /> Colunas
                  </button>
                  <button onClick={() => showToast('🗺️ Mapa da carteira')} style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '2px 7px', fontSize: 9, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-tertiary)', cursor: 'pointer', height: 24 }}>
                    <MP size={10} /> Abrir mapa
                  </button>
                  <button onClick={() => showToast('📤 Exportar')} style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '2px 7px', fontSize: 9, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-tertiary)', cursor: 'pointer', height: 24 }}>
                    <Download size={10} /> Exportar
                  </button>
                </>
              )}

              {isMobile && (
                <div style={{ display: 'flex', gap: 4, position: 'relative' }}>
                  <button onClick={() => showToast('🗺️ Mapa da carteira')} style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '2px 7px', fontSize: 9, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-tertiary)', cursor: 'pointer', height: 24 }}>
                    <MP size={10} /> Mapa
                  </button>
                  <button onClick={() => setMoreActionsOpen(!moreActionsOpen)} style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '2px 7px', fontSize: 9, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-tertiary)', cursor: 'pointer', height: 24 }}>
                    Mais <MoreHorizontal size={10} />
                  </button>
                  {moreActionsOpen && (
                    <div style={{ position: 'absolute', right: 0, top: 28, zIndex: 90, background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 6, padding: 4, width: 140, boxShadow: 'var(--shadow-md)', display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <button onClick={() => { setMoreActionsOpen(false); showToast('✨ Nova visão'); }} style={{ textAlign: 'left', padding: '4px 8px', fontSize: 9, background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>+ Nova visão</button>
                      <button onClick={() => { setMoreActionsOpen(false); showToast('💾 Salvar visão'); }} style={{ textAlign: 'left', padding: '4px 8px', fontSize: 9, background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>💾 Salvar visão</button>
                      <button onClick={() => { setMoreActionsOpen(false); setColumnsOpen(true); }} style={{ textAlign: 'left', padding: '4px 8px', fontSize: 9, background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>📊 Colunas</button>
                      <button onClick={() => { setMoreActionsOpen(false); showToast('📤 Exportar'); }} style={{ textAlign: 'left', padding: '4px 8px', fontSize: 9, background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>📤 Exportar</button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── 4. Table / Cards ── */}
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
              {isMobile ? (
                /* Mobile card list */
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {paginated.map(o => (
                    <div key={o.id} style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer' }}
                      onClick={() => setDrawerOpen(o.id)}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                        <div onClick={e => { e.stopPropagation(); toggleOne(o.id); }} style={{ padding: 2, cursor: 'pointer', flexShrink: 0 }}>
                          {selected.includes(o.id) ? <CheckSquare size={14} color={ENG_COLOR} /> : <Square size={14} color="var(--text-tertiary)" />}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{o.obra}</div>
                          <div style={{ fontSize: 9, color: 'var(--text-secondary)', marginBottom: 4 }}>
                            {o.mun ? `${o.mun}/${o.uf}` : o.uf} · {o.empresa || 'Sem empresa'} · {o.fase}
                          </div>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: o.capex === 0 ? 'var(--text-disabled)' : 'var(--text-primary)' }}>
                              {o.capex === 0 ? 'Não homologado' : fmtCapex(o.capex)}
                            </span>
                            <QualBadge text={o.qualidade} color={o.qualCor} />
                            {o.oportunidade.score >= 70 && <span style={{ fontSize: 8, padding: '1px 5px', borderRadius: 6, background: '#8B5CF622', color: '#8B5CF6', fontWeight: 500 }}>{o.oportunidade.score}%</span>}
                          </div>
                        </div>
                        <ChevronRight size={12} color="var(--text-tertiary)" style={{ flexShrink: 0, marginTop: 4 }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : viewMode === 'cards' ? (
                /* Desktop card view */
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8, padding: 12 }}>
                  {paginated.map(o => (
                    <div key={o.id} style={{ background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: 12, cursor: 'pointer' }}
                      onClick={() => setDrawerOpen(o.id)}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{o.obra}</span>
                        <div onClick={e => { e.stopPropagation(); toggleOne(o.id); }} style={{ cursor: 'pointer', flexShrink: 0 }}>
                          {selected.includes(o.id) ? <CheckSquare size={14} color={ENG_COLOR} /> : <Square size={14} color="var(--text-tertiary)" />}
                        </div>
                      </div>
                      <div style={{ fontSize: 9, color: 'var(--text-secondary)', marginBottom: 4 }}>{o.mun ? `${o.mun}/${o.uf}` : o.uf} · {o.empresa || 'Sem empresa'}</div>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 4 }}>
                        <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: `${ENG_COLOR}18`, color: ENG_COLOR }}>{o.fase}</span>
                        <QualBadge text={o.qualidade} color={o.qualCor} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: o.capex === 0 ? 'var(--text-disabled)' : 'var(--text-primary)' }}>
                          {o.capex === 0 ? 'Não homologado' : fmtCapex(o.capex)}
                        </span>
                        {o.oportunidade.score >= 70 && <span style={{ fontSize: 8, padding: '1px 5px', borderRadius: 6, background: '#8B5CF622', color: '#8B5CF6', fontWeight: 500 }}>Score {o.oportunidade.score}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* Desktop/Laptop Table */
                <div style={{ overflowX: 'auto', position: 'relative' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}>
                        <th style={{ position: 'sticky', top: 0, left: 0, background: 'var(--bg-surface)', zIndex: 3, padding: '6px 8px', textAlign: 'left', width: 36 }}>
                          <div onClick={toggleAll} style={{ cursor: 'pointer' }}>
                            {allSelected ? <CheckSquare size={12} color={ENG_COLOR} /> : <Square size={12} color="var(--text-tertiary)" />}
                          </div>
                        </th>
                        {activeCols.filter(c => c.key !== 'selecao').map(c => {
                          if (c.key === 'acoes') {
                            return <th key={c.key} style={{ position: 'sticky', top: 0, right: 0, background: 'var(--bg-surface)', zIndex: 3, padding: '6px 8px', width: 36, textAlign: 'center' }} />;
                          }
                          const isObra = c.key === 'obra';
                          return (
                            <th key={c.key} style={{
                              position: 'sticky', top: 0,
                              left: isObra ? 36 : undefined,
                              background: 'var(--bg-surface)', zIndex: isObra ? 3 : 1,
                              padding: '6px 8px', fontSize: 9, fontWeight: 600, color: 'var(--text-tertiary)',
                              textAlign: 'left', whiteSpace: 'nowrap', minWidth: colWidths[c.key] || 80,
                              boxShadow: isObra ? '2px 0 4px rgba(0,0,0,0.1)' : 'none',
                            }}>
                              {c.label}
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {paginated.map(o => (
                        <tr key={o.id} style={{ borderBottom: '1px solid var(--border-subtle)', background: selected.includes(o.id) ? `${ENG_COLOR}0D` : 'transparent', cursor: 'pointer', transition: 'background 0.1s' }}
                          onClick={() => setDrawerOpen(o.id)}
                          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-surface-hover)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = selected.includes(o.id) ? `${ENG_COLOR}0D` : 'transparent'; }}>
                          
                          {/* Selection Checkbox */}
                          <td style={{ position: 'sticky', left: 0, background: 'var(--bg-surface)', zIndex: 2, padding: `${rowPad}px 8px` }}>
                            <div onClick={e => { e.stopPropagation(); toggleOne(o.id); }} style={{ cursor: 'pointer' }}>
                              {selected.includes(o.id) ? <CheckSquare size={12} color={ENG_COLOR} /> : <Square size={12} color="var(--text-tertiary)" />}
                            </div>
                          </td>

                          {/* Obra Column (Sticky Left) */}
                          <td style={{ position: 'sticky', left: 36, background: 'var(--bg-surface)', zIndex: 2, padding: `${rowPad}px 8px`, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: colWidths.obra, boxShadow: '2px 0 4px rgba(0,0,0,0.1)' }} title={o.obra}>
                            {o.obra}
                          </td>

                          {/* Município / UF */}
                          <td style={{ padding: `${rowPad}px 8px`, color: o.mun ? 'var(--text-secondary)' : 'var(--text-disabled)', whiteSpace: 'nowrap' }}>
                            {o.mun ? `${o.mun}/${o.uf}` : o.uf}
                          </td>

                          {/* Empresa */}
                          <td style={{ padding: `${rowPad}px 8px`, color: o.empresa ? 'var(--text-secondary)' : 'var(--text-disabled)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: colWidths.empresa }} title={o.empresa || ''}>
                            {o.empresa || '—'}
                          </td>

                          {/* CNPJ (optional) */}
                          {visibleCols.cnpj && (
                            <td style={{ padding: `${rowPad}px 8px`, color: o.cnpj ? 'var(--text-secondary)' : 'var(--text-disabled)', whiteSpace: 'nowrap' }}>
                              {o.cnpj || '—'}
                            </td>
                          )}

                          {/* Fase */}
                          <td style={{ padding: `${rowPad}px 8px`, color: o.fase === 'Execução' ? '#22C55E' : 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                            {o.fase}
                          </td>

                          {/* Status (optional) */}
                          {visibleCols.status && (
                            <td style={{ padding: `${rowPad}px 8px`, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                              {o.status}
                            </td>
                          )}

                          {/* Setor (optional) */}
                          {visibleCols.setor && (
                            <td style={{ padding: `${rowPad}px 8px`, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                              {o.setor}
                            </td>
                          )}

                          {/* CAPEX */}
                          <td style={{ padding: `${rowPad}px 8px`, fontWeight: 600, whiteSpace: 'nowrap', color: o.capex === 0 ? 'var(--text-disabled)' : 'var(--text-primary)' }}>
                            {o.capex === 0 ? 'Não homologado' : fmtCapex(o.capex)}
                          </td>

                          {/* Oportunidade */}
                          <td style={{ padding: `${rowPad}px 8px` }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span style={{ fontSize: 9, fontWeight: 600, color: '#8B5CF6' }}>{o.oportunidade.score}</span>
                              <span style={{ fontSize: 8, padding: '1px 5px', borderRadius: 6, background: o.oportunidade.classe === 'PROVÁVEL' ? '#22C55E22' : '#F59E0B22', color: o.oportunidade.classe === 'PROVÁVEL' ? '#22C55E' : '#F59E0B', fontWeight: 500 }}>{o.oportunidade.classe}</span>
                              <span style={{ fontSize: 8, color: 'var(--text-tertiary)' }}>{o.oportunidade.matches}</span>
                            </div>
                          </td>

                          {/* Qualidade */}
                          <td style={{ padding: `${rowPad}px 8px` }}>
                            <QualBadge text={o.qualidade} color={o.qualCor} />
                          </td>

                          {/* Atualização */}
                          <td style={{ padding: `${rowPad}px 8px`, color: 'var(--text-tertiary)', whiteSpace: 'nowrap', fontSize: 9 }}>
                            {o.atualizacao}
                          </td>

                          {/* Ações Column (Sticky Right) */}
                          <td style={{ position: 'sticky', right: 0, background: 'var(--bg-surface)', zIndex: 2, padding: `${rowPad}px 8px`, textAlign: 'center' }}>
                            <button onClick={e => { e.stopPropagation(); showToast(`🔍 Detalhes de ${o.obra} — disponível na próxima fase`); }} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: 2 }}>
                              <ArrowUpRight size={10} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={{ padding: '6px 12px', fontSize: 8, color: 'var(--text-tertiary)', fontStyle: 'italic', borderTop: '1px solid var(--border-subtle)' }}>
                    Dados ilustrativos para validação visual do diretório.
                  </div>
                </div>
              )}

              {/* Mobile pagination */}
              {isMobile && (
                <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>Exibindo 1–{paginated.length} de {sorted.length}</span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} style={{ padding: '2px 6px', fontSize: 9, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: page === 1 ? 'var(--text-disabled)' : 'var(--text-secondary)', cursor: page === 1 ? 'default' : 'pointer' }}>Anterior</button>
                    <span style={{ fontSize: 9, color: 'var(--text-tertiary)', padding: '2px 6px' }}>{page}/{totalPages}</span>
                    <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} style={{ padding: '2px 6px', fontSize: 9, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: page === totalPages ? 'var(--text-disabled)' : 'var(--text-secondary)', cursor: page === totalPages ? 'default' : 'pointer' }}>Próximo</button>
                  </div>
                </div>
              )}

              {/* Batch selection bar */}
              {selected.length > 0 && (
                <div style={{
                  padding: '6px 12px', borderTop: '1px solid var(--border-subtle)',
                  background: `${ENG_COLOR}0D`, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
                  position: isMobile ? 'sticky' : 'static', bottom: isMobile ? 0 : 'auto',
                }}>
                  <span style={{ fontSize: 9, fontWeight: 600, color: ENG_COLOR, flex: 1 }}>{selected.length} obra(s) selecionada(s)</span>
                  <button onClick={() => showToast('📊 Comparar obras — disponível na próxima fase')} style={{ padding: '2px 6px', fontSize: 8, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-secondary)', cursor: 'pointer' }}>Comparar</button>
                  <button onClick={() => showToast('🗺️ Abrir no mapa — disponível na próxima fase')} style={{ padding: '2px 6px', fontSize: 8, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-secondary)', cursor: 'pointer' }}>Abrir no mapa</button>
                  <button onClick={() => showToast('📋 Criar lista — disponível na próxima fase')} style={{ padding: '2px 6px', fontSize: 8, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-secondary)', cursor: 'pointer' }}>Criar lista</button>
                  <button onClick={() => showToast('📤 Exportar seleção — disponível na próxima fase')} style={{ padding: '2px 6px', fontSize: 8, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-secondary)', cursor: 'pointer' }}>Exportar</button>
                  <button onClick={() => setSelected([])} style={{ padding: '2px 6px', fontSize: 8, background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', textDecoration: 'underline' }}>Limpar seleção</button>
                </div>
              )}
            </div>

            {/* ── 5. Pagination (desktop) ── */}
            {!isMobile && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>Itens por página:</span>
                  {[25, 50, 100].map(n => (
                    <button key={n} onClick={() => { setPerPage(n); setPage(1); }} style={{ padding: '2px 6px', fontSize: 9, background: perPage === n ? `${ENG_COLOR}22` : 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: perPage === n ? ENG_COLOR : 'var(--text-secondary)', cursor: 'pointer' }}>{n}</button>
                  ))}
                </div>
                <span style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>Exibindo {(page - 1) * perPage + 1}–{Math.min(page * perPage, sorted.length)} de {fmt(sorted.length)} obras</span>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <button onClick={() => setPage(1)} disabled={page === 1} style={{ padding: '3px 6px', fontSize: 9, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: page === 1 ? 'var(--text-disabled)' : 'var(--text-secondary)', cursor: page === 1 ? 'default' : 'pointer' }}>«</button>
                  <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} style={{ padding: '3px 6px', fontSize: 9, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: page === 1 ? 'var(--text-disabled)' : 'var(--text-secondary)', cursor: page === 1 ? 'default' : 'pointer' }}>Anterior</button>
                  <span style={{ fontSize: 9, color: 'var(--text-secondary)', padding: '0 4px' }}>{page} de {totalPages}</span>
                  <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} style={{ padding: '3px 6px', fontSize: 9, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: page === totalPages ? 'var(--text-disabled)' : 'var(--text-secondary)', cursor: page === totalPages ? 'default' : 'pointer' }}>Próximo</button>
                  <button onClick={() => setPage(totalPages)} disabled={page === totalPages} style={{ padding: '3px 6px', fontSize: 9, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: page === totalPages ? 'var(--text-disabled)' : 'var(--text-secondary)', cursor: page === totalPages ? 'default' : 'pointer' }}>»</button>
                </div>
              </div>
            )}

          </div>
        </main>

        {/* ── Footer ── */}
        <div style={{ padding: '8px 24px', borderTop: '1px solid var(--border-subtle)', fontSize: 9, color: 'var(--text-tertiary)', textAlign: 'center' }}>
          WiNS Hub Mockups v2 · Página 04 — Engenharia · Lista de Obras · Nenhuma chamada a API real · Ambiente isolado de prototipação
        </div>
      </div>

      {/* ── Mobile Filter Drawer (Offcanvas Sheet - Single Column) ── */}
      {isMobile && advancedOpen && (
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9998 }} onClick={() => setAdvancedOpen(false)} />
          <div role="dialog" aria-label="Filtros avançados" tabIndex={0}
            onKeyDown={e => { if (e.key === 'Escape') setAdvancedOpen(false); }}
            ref={el => { if (el) setTimeout(() => el.focus(), 50); }}
            style={{
              position: 'fixed', top: 0, right: 0, bottom: 0, width: '85vw', maxWidth: 360,
              zIndex: 9999, background: 'var(--bg-surface)', borderLeft: '1px solid var(--border-default)',
              display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 24px rgba(0,0,0,0.4)',
            }}>
            {/* Drawer Header */}
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-default)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Filtros avançados</span>
                {activeCount > 0 && (
                  <span style={{ fontSize: 9, padding: '1px 6px', background: `${ENG_COLOR}22`, color: ENG_COLOR, borderRadius: 8, fontWeight: 600 }}>
                    {activeLabel}
                  </span>
                )}
              </div>
              <button onClick={() => setAdvancedOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: 4 }}><X size={18} /></button>
            </div>

            {/* Drawer Body (Scrollable Single Column) */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Buscar obra, empresa, CNPJ…</span>
                <input type="text" placeholder="Buscar…" value={filters.busca} onChange={e => setFilters(prev => ({ ...prev, busca: e.target.value }))}
                  style={{ width: '100%', height: 28, fontSize: 11, padding: '4px 8px', background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-secondary)' }} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Empresa / CNPJ</span>
                <input type="text" placeholder="Ex: Consórcio ou CNPJ" value={advFilters.empresa} onChange={e => setAdvFilters(prev => ({ ...prev, empresa: e.target.value }))}
                  style={{ width: '100%', height: 28, fontSize: 11, padding: '4px 8px', background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-secondary)' }} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>CAPEX mínimo (R$ M)</span>
                <input type="number" placeholder="Ex: 10" value={advFilters.capexMin} onChange={e => setAdvFilters(prev => ({ ...prev, capexMin: e.target.value }))}
                  style={{ width: '100%', height: 28, fontSize: 11, padding: '4px 8px', background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-secondary)' }} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>CAPEX máximo (R$ M)</span>
                <input type="number" placeholder="Ex: 500" value={advFilters.capexMax} onChange={e => setAdvFilters(prev => ({ ...prev, capexMax: e.target.value }))}
                  style={{ width: '100%', height: 28, fontSize: 11, padding: '4px 8px', background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-secondary)' }} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Data inicial</span>
                <input type="date" value={advFilters.dtIni} onChange={e => setAdvFilters(prev => ({ ...prev, dtIni: e.target.value }))}
                  style={{ width: '100%', height: 28, fontSize: 10, padding: '4px 6px', background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-secondary)' }} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Data final</span>
                <input type="date" value={advFilters.dtFim} onChange={e => setAdvFilters(prev => ({ ...prev, dtFim: e.target.value }))}
                  style={{ width: '100%', height: 28, fontSize: 10, padding: '4px 6px', background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-secondary)' }} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                {[
                  { label: 'Com empresa', key: 'comEmp' },
                  { label: 'Com município', key: 'comMun' },
                  { label: 'Com fornecedor recomendado', key: 'comFor' },
                  { label: 'Com decisor', key: 'comDec' },
                  { label: 'Com oportunidade', key: 'comOport' },
                  { label: 'CAPEX homologado', key: 'capHom' },
                  { label: 'Qualidade cadastral', key: 'qualCad' },
                ].map(cb => (
                  <div key={cb.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="checkbox" id={`mob-${cb.key}`} checked={!!advCheck[cb.key]} onChange={e => setAdvCheck(prev => ({ ...prev, [cb.key]: e.target.checked }))} style={{ accentColor: ENG_COLOR }} />
                    <label htmlFor={`mob-${cb.key}`} style={{ fontSize: 11, color: 'var(--text-secondary)', cursor: 'pointer' }}>{cb.label}</label>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Fonte</span>
                <select value={advCheck.fonte || ''} onChange={e => setAdvCheck(prev => ({ ...prev, fonte: e.target.value }))} style={{ width: '100%', height: 28, fontSize: 11, padding: '4px 8px', background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-secondary)' }}>
                  <option value="">Todas as fontes</option>
                  <option value="DNIT">DNIT-SICRO</option><option value="ANEEL">ANEEL</option><option value="Antaq">Antaq</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Atualização</span>
                <select value={advCheck.atualiz || ''} onChange={e => setAdvCheck(prev => ({ ...prev, atualiz: e.target.value }))} style={{ width: '100%', height: 28, fontSize: 11, padding: '4px 8px', background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-secondary)' }}>
                  <option value="">Qualquer período</option>
                  <option value="30">Últimos 30 dias</option>
                  <option value="90">Últimos 90 dias</option>
                  <option value="365">Últimos 12 meses</option>
                </select>
              </div>
            </div>

            {/* Fixed Footer inside Drawer */}
            <div style={{ padding: 12, borderTop: '1px solid var(--border-default)', background: 'var(--bg-surface)', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button onClick={() => { setFilters({ busca: '', uf: '', mun: '', status: '', fase: '', setor: '' }); setAdvFilters({ empresa: '', capexMin: '', capexMax: '', dtIni: '', dtFim: '' }); setAdvCheck({ comEmp: false, comMun: false, comFor: false, comDec: false, comOport: false, capHom: false, qualCad: false, fonte: '', atualiz: '' }); }}
                style={{ flex: 1, padding: '8px 4px', fontSize: 10, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                Limpar
              </button>
              <button onClick={() => showToast('💾 Visão salva')}
                style={{ flex: 1, padding: '8px 4px', fontSize: 10, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                Salvar visão
              </button>
              <button onClick={() => { setAdvancedOpen(false); showToast('✅ Filtros aplicados'); }}
                style={{ flex: 2, padding: '8px 4px', fontSize: 10, fontWeight: 600, background: ENG_COLOR, border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer' }}>
                Aplicar filtros
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Drawer lateral de detalhes da obra ── */}
      {drawerObra && (
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9998 }} onClick={() => setDrawerOpen(null)} />
          <div role="dialog" aria-label="Resumo da obra" tabIndex={0}
            onKeyDown={e => { if (e.key === 'Escape') setDrawerOpen(null); }}
            ref={el => { if (el) setTimeout(() => el.focus(), 50); }}
            style={isMobile ? {
              position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999,
              background: 'var(--bg-surface)', borderTopLeftRadius: 'var(--radius-lg)',
              borderTopRightRadius: 'var(--radius-lg)', maxHeight: '85vh', overflowY: 'auto',
              padding: '16px 20px', boxShadow: '0 -8px 32px rgba(0,0,0,0.5)',
            } : {
              position: 'fixed', top: 0, right: 0, width: 380, height: '100vh', zIndex: 9999,
              background: 'var(--bg-surface)', borderLeft: '1px solid var(--border-default)',
              display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 24px rgba(0,0,0,0.3)',
            }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, padding: isMobile ? 0 : '14px 16px 0' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Resumo da obra</span>
              <button onClick={() => setDrawerOpen(null)} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: 4 }}><X size={16} /></button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? 0 : '0 16px 16px' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{drawerObra.obra}</div>
              {drawerObra.mun && <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 12 }}>{drawerObra.mun} / {drawerObra.uf}</div>}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                {[
                  { label: 'Empresa', value: drawerObra.empresa || 'Não informada' },
                  { label: 'CNPJ', value: drawerObra.cnpj || 'Não informado' },
                  { label: 'Fase', value: drawerObra.fase },
                  { label: 'Status', value: drawerObra.status },
                  { label: 'Setor', value: drawerObra.setor },
                  { label: 'CAPEX', value: drawerObra.capex === 0 ? 'Não homologado' : fmtCapex(drawerObra.capex) },
                  { label: 'Fonte', value: drawerObra.fonte },
                  { label: 'Atualização', value: drawerObra.atualizacao },
                ].map(f => (
                  <div key={f.label}>
                    <span style={{ fontSize: 9, color: 'var(--text-tertiary)', display: 'block', marginBottom: 1 }}>{f.label}</span>
                    <span style={{ fontSize: 11, fontWeight: 500, color: f.value === 'Não informado' || f.value === 'Não homologado' ? 'var(--text-disabled)' : 'var(--text-primary)' }}>{f.value}</span>
                  </div>
                ))}
              </div>

              <div style={{ marginBottom: 16 }}>
                <span style={{ fontSize: 9, color: 'var(--text-tertiary)', display: 'block', marginBottom: 4 }}>Qualidade cadastral</span>
                <QualBadge text={drawerObra.qualidade} color={drawerObra.qualCor} />
              </div>

              <div style={{ marginBottom: 16 }}>
                <span style={{ fontSize: 9, color: 'var(--text-tertiary)', display: 'block', marginBottom: 4 }}>Oportunidade</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 16, fontWeight: 700, color: '#8B5CF6' }}>{drawerObra.oportunidade.score}</span>
                  <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 6, background: drawerObra.oportunidade.classe === 'PROVÁVEL' ? '#22C55E22' : '#F59E0B22', color: drawerObra.oportunidade.classe === 'PROVÁVEL' ? '#22C55E' : '#F59E0B', fontWeight: 600 }}>{drawerObra.oportunidade.classe}</span>
                  <span style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>{drawerObra.oportunidade.matches} match(es)</span>
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <span style={{ fontSize: 9, color: 'var(--text-tertiary)', display: 'block', marginBottom: 4 }}>Coordenada</span>
                <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{drawerObra.lat.toFixed(4)}, {drawerObra.lng.toFixed(4)}</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <button onClick={() => showToast('🔍 Detalhe completo — disponível na próxima fase')} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', fontSize: 10, background: ENG_COLOR, border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer', fontWeight: 500 }}><FileText size={12} /> Abrir detalhe</button>
                <button onClick={() => showToast('🏢 Empresa 360° — disponível na próxima fase')} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', fontSize: 10, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-secondary)', cursor: 'pointer' }}><Building2 size={12} /> Abrir Empresa 360°</button>
                <button onClick={() => showToast('🗺️ Ver no mapa — disponível na próxima fase')} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', fontSize: 10, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-secondary)', cursor: 'pointer' }}><MapPin size={12} /> Ver no mapa</button>
                <button onClick={() => showToast('🎯 Oportunidades — disponível na próxima fase')} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', fontSize: 10, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-secondary)', cursor: 'pointer' }}><Target size={12} /> Ver oportunidades</button>
                <button onClick={() => { navigator.clipboard?.writeText(drawerObra.id.toString()); showToast('📋 Identificação copiada'); }} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', fontSize: 10, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-secondary)', cursor: 'pointer' }}><FileText size={12} /> Copiar identificação</button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Modal de Colunas Realista ── */}
      {columnsOpen && (
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9998 }} onClick={() => setColumnsOpen(false)} />
          <div role="dialog" aria-label="Personalizar colunas" style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            zIndex: 9999, background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-lg)', padding: 24, width: 440, maxWidth: '92vw',
            maxHeight: '82vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Personalizar colunas</span>
                <p style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>Selecione as colunas exibidas no diretório de obras</p>
              </div>
              <button onClick={() => setColumnsOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: 4 }}><X size={16} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {modalColumnsList.map(col => {
                const isChecked = col.mandatory ? true : !!visibleCols[col.key];
                return (
                  <label key={col.key} style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px',
                    borderRadius: 'var(--radius-sm)', cursor: col.mandatory ? 'default' : 'pointer',
                    fontSize: 11, color: col.mandatory ? 'var(--text-tertiary)' : 'var(--text-secondary)',
                    background: col.mandatory ? 'rgba(255,255,255,0.02)' : 'transparent',
                  }}>
                    <input type="checkbox" checked={isChecked} disabled={col.mandatory}
                      onChange={() => { if (!col.mandatory) setVisibleCols(prev => ({ ...prev, [col.key]: !prev[col.key] })); }}
                      style={{ accentColor: ENG_COLOR }} />
                    <span style={{ fontWeight: col.mandatory ? 500 : 400 }}>{col.label}</span>
                    {col.mandatory && (
                      <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: 'rgba(255,255,255,0.06)', color: 'var(--text-disabled)', marginLeft: 4 }}>
                        Coluna obrigatória
                      </span>
                    )}
                    <GripVertical size={12} style={{ marginLeft: 'auto', color: 'var(--text-tertiary)', cursor: col.mandatory ? 'not-allowed' : 'grab' }} />
                  </label>
                );
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 16 }}>
              <button onClick={() => setVisibleCols({ obra: true, munUf: true, empresa: true, cnpj: false, fase: true, status: false, setor: false, capex: true, oportunidade: true, qualidade: true, atualizacao: true })} style={{ padding: '5px 10px', fontSize: 10, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-secondary)', cursor: 'pointer' }}>Restaurar padrão</button>
              <button onClick={() => setColumnsOpen(false)} style={{ padding: '5px 10px', fontSize: 10, background: ENG_COLOR, border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer', fontWeight: 500 }}>Concluído</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
