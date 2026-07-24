import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './services/auth';
import { EngineeringCompanies, EngineeringDashboard, EngineeringMap, EngineeringWorks } from './pages/Engineering';
import { EngineeringWorkDetailReal } from './pages/EngineeringDetailReal';
import { EngineeringCompanyReal } from './pages/EngineeringCompanyReal';
import { AccessDeniedPage, CommercialPage, CompaniesPage, EventDetail, EventsPage, GlobalMap, GlobalOverview, OpportunitiesPage, OpportunityDetail, ReportsPage, SettingsPage } from './pages/HubPages';
import {TerritorialReal} from './pages/TerritorialReal';
import {DecisionMakerDetail,EngineeringOpportunityDetail,SupplierDetail} from './pages/EngineeringRelations';

import { DecisionMakersPage, SuppliersPage } from './pages/Wave1Directories';
import { AgroPage } from './pages/AgroPage';
import { LogisticaPage } from './pages/LogisticaPage';
import { SaudePage } from './pages/SaudePage';
import { RelacionamentosPage } from './pages/RelacionamentosPage';
import { AgroDoadoras, AgroEmbrioes, AgroGenealogia, AgroImovelDetail, AgroReprodutorDetail, SaudeEstabelecimentoDetail } from './pages/RealDataDetails';
import { GlobalSearchPage, RealDirectoryDetail, RealDirectoryPage } from './pages/RealDirectories';
import { 
  LayoutGrid, AlertTriangle, Map, TrendingUp, Users, ShieldAlert,
  HardHat, Truck, Sprout, HeartPulse, Globe, BarChart3, Settings, 
  LogOut, Sun, Moon, Search, Menu, PanelLeftClose, Network
} from 'lucide-react';


// Reusable protected layout component
const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => window.matchMedia('(min-width: 769px)').matches);
  const location = useLocation();
  const navigate = useNavigate();
  const [globalQuery,setGlobalQuery]=useState('');

  // Handle Theme
  useEffect(() => {
    const savedTheme = localStorage.getItem('wins-theme') as 'dark' | 'light';
    if (savedTheme) {
      setTheme(savedTheme);
      document.body.classList.toggle('light', savedTheme === 'light');
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('wins-theme', newTheme);
    document.body.classList.toggle('light', newTheme === 'light');
  };

  const navItems = [
    { section: 'Painéis Unificados' },
    { name: 'Visão Geral', path: '/visao-geral', icon: <LayoutGrid size={18} /> },
    { name: 'Eventos', path: '/eventos', icon: <AlertTriangle size={18} /> },
    { name: 'Mapa', path: '/mapa', icon: <Map size={18} /> },
    { name: 'Oportunidades', path: '/oportunidades', icon: <TrendingUp size={18} /> },
    { name: 'Empresas e Pessoas', path: '/empresas', icon: <Users size={18} /> },
    { name: 'Relacionamentos', path: '/relacionamentos', icon: <Network size={18} /> },
    { name: 'Comercial', path: '/comercial', icon: <ShieldAlert size={18} /> },

    { name: 'Inteligência Territorial', path: '/territorial', icon: <Globe size={18} /> },
    
    { section: 'Verticais Oficiais' },
    { name: 'Engenharia', path: '/engenharia', icon: <HardHat size={18} />, color: 'var(--color-engenharia)' },
    { name: 'Logística', path: '/logistica', icon: <Truck size={18} />, color: 'var(--color-logistica)' },
    { name: 'Agro', path: '/agro', icon: <Sprout size={18} />, color: 'var(--color-agro)' },
    { name: 'Saúde', path: '/saude', icon: <HeartPulse size={18} />, color: 'var(--color-saude)' },
    
    { section: 'Configuração & Suporte' },
    { name: 'Relatórios', path: '/relatorios', icon: <BarChart3 size={18} /> },
    { name: 'Configurações', path: '/configuracoes', icon: <Settings size={18} /> },
  ];

  const currentPath = location.pathname;

  return (
    <div className={`app-shell ${isSidebarOpen ? 'sidebar-open' : 'sidebar-collapsed'}`}>
      {/* Sidebar */}
      <aside className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <div className="topbar-avatar" style={{ margin: 0, width: '32px', height: '32px' }}>W</div>
          <div>
            <span>WiNS Hub</span>
            <small>Unificado</small>
          </div>
          <button 
            className="sidebar-toggle" 
            onClick={() => setIsSidebarOpen(false)}
            title="Recolher menu"
            style={{ marginLeft: 'auto' }}
          >
            <PanelLeftClose size={18} />
          </button>
        </div>
        
        <nav className="sidebar-nav">
          {navItems.map((item, idx) => {
            if (item.section) {
              return <div key={idx} className="nav-section">{item.section}</div>;
            }
            
            const isActive = currentPath === item.path || (item.path && item.path !== '/' && currentPath.startsWith(`${item.path}/`));
            
            return (
              <Link 
                key={idx}
                to={item.path || '#'}
                className={`nav-item ${isActive ? 'active' : ''}`}
                style={item.color && isActive ? { color: item.color, borderLeftColor: item.color } : {}}
                onClick={() => { if (window.matchMedia('(max-width: 768px)').matches) setIsSidebarOpen(false); }}
              >
                <span className="nav-icon" style={item.color ? { color: item.color } : {}}>
                  {item.icon}
                </span>
                <span>{item.name}</span>
              </Link>
            );
          })}
          
        </nav>
      </aside>

      {/* Main Content Area */}
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
        {/* Topbar */}
        <header className="topbar">
          {!isSidebarOpen && <button 
            className="sidebar-toggle" 
            onClick={() => setIsSidebarOpen(true)}
            title="Expandir menu"
          >
            <Menu size={18} />
          </button>}
          
          <div className="topbar-search">
            <span className="search-icon"><Search size={16} /></span>
            <input aria-label="Busca global real" value={globalQuery} onChange={e=>setGlobalQuery(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&globalQuery.trim().length>=2)navigate(`/busca?q=${encodeURIComponent(globalQuery.trim())}`)}} placeholder="Nome, CNPJ, CAR, CNES, RNTRC, CREA, RGD ou município..." />
          </div>

          {import.meta.env.VITE_WINS_WAVE1_REAL === 'true' && (
            <div className="environment-badge" style={{ background: import.meta.env.VITE_WINS_WAVE1_REAL==='true'?'rgba(34,197,94,.12)':'rgba(235, 94, 40, 0.15)', color: import.meta.env.VITE_WINS_WAVE1_REAL==='true'?'#22c55e':'#eb5e28', border: `1px solid ${import.meta.env.VITE_WINS_WAVE1_REAL==='true'?'rgba(34,197,94,.35)':'rgba(235,94,40,.3)'}`, padding: '4px 12px', borderRadius: '6px', fontSize: '10px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="pulse-dot" style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: import.meta.env.VITE_WINS_WAVE1_REAL==='true'?'#22c55e':'#eb5e28' }}></span>
              DADOS REAIS · AMBIENTE DE HOMOLOGAÇÃO
            </div>
          )}

          <div className="topbar-actions">
            <button className="topbar-btn" onClick={toggleTheme} title="Alternar Tema">
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            
            {user && (
              <>
                <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '12px', fontWeight: 'bold' }}>{user.name}</span>
                  <span style={{ fontSize: '10px', color: 'var(--color-text-tertiary)' }}>
                    {user.roles.join(', ').toUpperCase()}
                  </span>
                </div>
                
                <div className="topbar-avatar" onClick={() => navigate('/conta')} title="Perfil da Conta">
                  {user.name.charAt(0)}
                </div>

                <button className="topbar-btn" onClick={() => { logout(); navigate('/login'); }} title="Sair da Conta">
                  <LogOut size={18} />
                </button>
              </>
            )}
          </div>
        </header>

        {/* Content Body */}
        <main className="main-content">
          {children}
        </main>
      </div>
    </div>
  );
};

// Login Screen Component
const LoginPage: React.FC = () => {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/visao-geral');
    }
  }, [isAuthenticated, navigate]);

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg-primary)', padding: '20px' }}>
      <div className="card" style={{ width: '100%', maxWidth: '420px', padding: '32px', textAlign: 'center', boxShadow: '0 8px 30px rgba(0,0,0,0.5)' }}>
        <div className="topbar-avatar" style={{ margin: '0 auto 16px', width: '48px', height: '48px', fontSize: '20px' }}>W</div>
        <h1 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '4px' }}>Acesso ao WiNS Hub</h1>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px', marginBottom: '24px' }}>
          Plataforma Unificada de Inteligência Territorial
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}><h4 style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-text-tertiary)' }}>Autenticação corporativa</h4><button className="btn btn-primary" style={{justifyContent:'center'}} onClick={login}>Entrar com Keycloak</button></div>

        <div style={{ marginTop: '24px', fontSize: '11px', color: 'var(--color-text-tertiary)' }}>
          WiNS Hub © 2026 · Ambiente unificado de apresentação
        </div>
      </div>
    </div>
  );
};

// Protected routes wrapper
const ProtectedWrapper: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return <AppLayout>{children}</AppLayout>;
};

function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <Routes>
        {/* Public Route */}
        <Route path="/login" element={<LoginPage />} />

        {/* Protected Routes */}
        <Route path="/visao-geral" element={
          <ProtectedWrapper><GlobalOverview /></ProtectedWrapper>
        } />
        
        <Route path="/empresas" element={
          <ProtectedWrapper><CompaniesPage /></ProtectedWrapper>
        } />

        <Route path="/eventos" element={
          <ProtectedWrapper><EventsPage /></ProtectedWrapper>
        } />
        <Route path="/eventos/:id" element={<ProtectedWrapper><EventDetail /></ProtectedWrapper>} />

        <Route path="/mapa" element={<ProtectedWrapper><GlobalMap /></ProtectedWrapper>} />

        <Route path="/oportunidades" element={<ProtectedWrapper><OpportunitiesPage /></ProtectedWrapper>} />
        <Route path="/oportunidades/:id" element={<ProtectedWrapper><OpportunityDetail /></ProtectedWrapper>} />

        <Route path="/comercial" element={
          <ProtectedWrapper><CommercialPage /></ProtectedWrapper>
        } />

        <Route path="/territorial" element={
          <ProtectedWrapper><TerritorialReal /></ProtectedWrapper>
        } />

        <Route path="/engenharia" element={<ProtectedWrapper><EngineeringDashboard /></ProtectedWrapper>} />
        <Route path="/engenharia/mapa" element={<ProtectedWrapper><EngineeringMap /></ProtectedWrapper>} />
        <Route path="/engenharia/obras" element={<ProtectedWrapper><EngineeringWorks /></ProtectedWrapper>} />
        <Route path="/engenharia/obras/:id" element={<ProtectedWrapper><EngineeringWorkDetailReal /></ProtectedWrapper>} />
        <Route path="/engenharia/empresas" element={<ProtectedWrapper><EngineeringCompanies /></ProtectedWrapper>} />
        <Route path="/fornecedores" element={<ProtectedWrapper><SuppliersPage /></ProtectedWrapper>} />
        <Route path="/fornecedores/:id" element={<ProtectedWrapper><SupplierDetail /></ProtectedWrapper>} />
        <Route path="/engenharia/fornecedores" element={<ProtectedWrapper><SuppliersPage /></ProtectedWrapper>} />
        <Route path="/engenharia/fornecedores/:id" element={<ProtectedWrapper><SupplierDetail /></ProtectedWrapper>} />
        <Route path="/decisores" element={<ProtectedWrapper><DecisionMakersPage /></ProtectedWrapper>} />
        <Route path="/decisores/:id" element={<ProtectedWrapper><DecisionMakerDetail /></ProtectedWrapper>} />
        <Route path="/engenharia/decisores" element={<ProtectedWrapper><DecisionMakersPage /></ProtectedWrapper>} />
        <Route path="/engenharia/decisores/:id" element={<ProtectedWrapper><DecisionMakerDetail /></ProtectedWrapper>} />
        <Route path="/engenharia/oportunidades/:id" element={<ProtectedWrapper><EngineeringOpportunityDetail /></ProtectedWrapper>} />
        <Route path="/empresas/:id" element={<ProtectedWrapper><EngineeringCompanyReal /></ProtectedWrapper>} />
        <Route path="/relacionamentos" element={<ProtectedWrapper><RelacionamentosPage /></ProtectedWrapper>} />
        <Route path="/busca" element={<ProtectedWrapper><GlobalSearchPage /></ProtectedWrapper>} />
        <Route path="/:vertical/diretorios/:entity" element={<ProtectedWrapper><RealDirectoryPage /></ProtectedWrapper>} />
        <Route path="/:vertical/diretorios/:entity/:sourceId" element={<ProtectedWrapper><RealDirectoryDetail /></ProtectedWrapper>} />

        <Route path="/logistica" element={
          <ProtectedWrapper><LogisticaPage /></ProtectedWrapper>
        } />

        <Route path="/agro" element={
          <ProtectedWrapper><AgroPage /></ProtectedWrapper>
        } />
        <Route path="/agro/imoveis/:id" element={<ProtectedWrapper><AgroImovelDetail /></ProtectedWrapper>} />
        <Route path="/agro/reprodutores/:id" element={<ProtectedWrapper><AgroReprodutorDetail /></ProtectedWrapper>} />
        <Route path="/agro/genealogia/:id" element={<ProtectedWrapper><AgroGenealogia /></ProtectedWrapper>} />
        <Route path="/agro/doadoras" element={<ProtectedWrapper><AgroDoadoras /></ProtectedWrapper>} />
        <Route path="/agro/embrioes" element={<ProtectedWrapper><AgroEmbrioes /></ProtectedWrapper>} />

        <Route path="/saude" element={
          <ProtectedWrapper><SaudePage /></ProtectedWrapper>
        } />
        <Route path="/saude/estabelecimentos/:cnes" element={<ProtectedWrapper><SaudeEstabelecimentoDetail /></ProtectedWrapper>} />


        <Route path="/relatorios" element={
          <ProtectedWrapper><ReportsPage /></ProtectedWrapper>
        } />

        <Route path="/configuracoes" element={
          <ProtectedWrapper><SettingsPage /></ProtectedWrapper>
        } />

        <Route path="/conta" element={<Navigate to="/configuracoes" replace />} />
        <Route path="/acesso-negado" element={<ProtectedWrapper><AccessDeniedPage /></ProtectedWrapper>} />

        {/* Fallback routing */}
        <Route path="*" element={<Navigate to="/visao-geral" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
