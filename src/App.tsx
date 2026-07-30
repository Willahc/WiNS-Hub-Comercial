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
import AgroApproved from './pages/AgroApproved';
import { LogisticaPage } from './pages/LogisticaPage';
import { SaudePage } from './pages/SaudePage';
import { RelacionamentosPage } from './pages/RelacionamentosPage';
import { AgroDoadoras, AgroEmbrioes, AgroGenealogia, AgroImovelDetail, AgroReprodutorDetail, SaudeEstabelecimentoDetail } from './pages/RealDataDetails';
import { GlobalSearchPage, RealDirectoryDetail, RealDirectoryPage } from './pages/RealDirectories';
import { 
  LayoutGrid, AlertTriangle, Map, TrendingUp, Users, ShieldAlert,
  HardHat, Truck, Sprout, HeartPulse, Globe, BarChart3, Settings, 
  LogOut, Sun, Moon, Search, Menu, PanelLeftClose, Network,
  ShieldCheck, ExternalLink, HelpCircle
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

// Official Login Screen Component (Baseline Approved Design)
const verticalsList = [
  { icon: HardHat, label: 'Engenharia', color: '#3B82F6' },
  { icon: Sprout, label: 'Agro', color: '#22C55E' },
  { icon: Truck, label: 'Logística', color: '#F59E0B' },
  { icon: HeartPulse, label: 'Saúde', color: '#EC4899' },
];

const LoginPage: React.FC = () => {
  const { login, isAuthenticated, authReady } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/visao-geral');
    }
  }, [isAuthenticated, navigate]);

  return (
    <div style={{
      width: '100%', minHeight: '100vh',
      background: 'var(--bg-base)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative', overflow: 'hidden',
      flexWrap: 'wrap',
    }}>
      <style>{`
        @media (max-width: 820px) {
          .login-institutional { display: none !important; }
          .login-card-wrap { margin-right: 0 !important; width: 90vw !important; max-width: 400px !important; padding: 24px !important; }
          .login-card-wrap h2 { font-size: 18px !important; }
          .login-footer { position: static !important; margin-top: 20px !important; }
        }
      `}</style>
      
      {/* Background: grid dots */}
      <div style={{
        position: 'absolute', inset: 0, overflow: 'hidden',
        opacity: 0.12, pointerEvents: 'none',
      }}>
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
              <circle cx="30" cy="30" r="1" fill="#4F7CFF" />
            </pattern>
            <pattern id="grid-large" width="180" height="180" patternUnits="userSpaceOnUse">
              <circle cx="90" cy="90" r="2" fill="#4F7CFF" opacity="0.3" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
          <rect width="100%" height="100%" fill="url(#grid-large)" />
        </svg>
      </div>

      {/* Left: Brazil outline + network */}
      <div style={{
        position: 'absolute', left: '6%', top: '50%', transform: 'translateY(-50%)',
        width: '38%', height: '70%', opacity: 0.25, pointerEvents: 'none',
      }}>
        <svg viewBox="0 0 500 600" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
          <path d="M250 30 C300 50 350 90 370 150 C390 210 380 270 360 320 C340 370 380 420 370 470 C360 520 310 560 250 580 C190 560 140 520 130 470 C120 420 160 370 140 320 C120 270 110 210 130 150 C150 90 200 50 250 30Z" stroke="#4F7CFF" strokeWidth="1.8" fill="none" opacity="0.8" />
          <path d="M300 100 L290 130 M220 110 L215 140 M310 170 L300 200 M360 250 L340 270 M170 270 L190 250 M220 380 L240 370 M310 390 L290 400" stroke="#4F7CFF" strokeWidth="1" opacity="0.5" />
          <circle cx="300" cy="100" r="3" fill="#4F7CFF" opacity="0.7" />
          <circle cx="220" cy="110" r="3" fill="#4F7CFF" opacity="0.7" />
          <circle cx="360" cy="250" r="3" fill="#4F7CFF" opacity="0.7" />
          <circle cx="170" cy="270" r="3" fill="#4F7CFF" opacity="0.7" />
          <circle cx="310" cy="170" r="4" fill="#22C55E" opacity="0.6" />
          <circle cx="220" cy="380" r="3" fill="#F59E0B" opacity="0.6" />
          <circle cx="310" cy="390" r="3" fill="#EC4899" opacity="0.6" />
          <line x1="300" y1="100" x2="360" y2="250" stroke="#4F7CFF" strokeWidth="0.8" opacity="0.35" />
          <line x1="220" y1="110" x2="170" y2="270" stroke="#22C55E" strokeWidth="0.8" opacity="0.35" />
          <line x1="360" y1="250" x2="310" y2="170" stroke="#3B82F6" strokeWidth="0.8" opacity="0.35" />
          <line x1="170" y1="270" x2="220" y2="380" stroke="#F59E0B" strokeWidth="0.8" opacity="0.35" />
          <line x1="310" y1="170" x2="310" y2="390" stroke="#EC4899" strokeWidth="0.8" opacity="0.35" />
        </svg>
      </div>

      {/* Right: Connection network */}
      <div style={{
        position: 'absolute', right: '10%', bottom: '12%',
        width: '25%', height: '25%', opacity: 0.2, pointerEvents: 'none',
      }}>
        <svg viewBox="0 0 300 250" width="100%" height="100%">
          <circle cx="50" cy="180" r="5" fill="#4F7CFF" opacity="0.6" />
          <circle cx="130" cy="70" r="4" fill="#22C55E" opacity="0.5" />
          <circle cx="230" cy="120" r="4" fill="#F59E0B" opacity="0.5" />
          <circle cx="270" cy="50" r="3" fill="#EC4899" opacity="0.5" />
          <circle cx="160" cy="210" r="3" fill="#8B5CF6" opacity="0.5" />
          <line x1="50" y1="180" x2="130" y2="70" stroke="#4F7CFF" strokeWidth="1" opacity="0.35" />
          <line x1="130" y1="70" x2="230" y2="120" stroke="#22C55E" strokeWidth="1" opacity="0.35" />
          <line x1="230" y1="120" x2="270" y2="50" stroke="#F59E0B" strokeWidth="1" opacity="0.35" />
          <line x1="160" y1="210" x2="50" y2="180" stroke="#8B5CF6" strokeWidth="1" opacity="0.3" />
          <line x1="160" y1="210" x2="230" y2="120" stroke="#EC4899" strokeWidth="1" opacity="0.3" />
        </svg>
      </div>

      {/* Left: Institutional panel */}
      <div className="login-institutional" style={{
        position: 'relative', zIndex: 1,
        flex: '0 0 auto', width: '45%', maxWidth: 500,
        paddingLeft: 'clamp(40px, 6vw, 100px)',
        paddingRight: 40,
        display: 'flex', flexDirection: 'column',
        justifyContent: 'center',
      }}>
        <h1 style={{
          fontSize: 28, fontWeight: 700, lineHeight: 1.25,
          color: 'var(--text-primary)', marginBottom: 16,
          maxWidth: 420,
        }}>
          Inteligência que conecta<br />mercados e territórios
        </h1>
        <p style={{
          fontSize: 14, lineHeight: 1.6,
          color: 'var(--text-secondary)', marginBottom: 28,
          maxWidth: 380,
        }}>
          Engenharia, Agro, Logística e Saúde reunidos em uma única plataforma de decisão.
        </p>

        {/* Vertical badges */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {verticalsList.map(v => (
            <div key={v.label} style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '6px 12px', borderRadius: 8,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.06)',
              fontSize: 12, fontWeight: 500, color: v.color,
            }}>
              <v.icon size={14} />
              {v.label}
            </div>
          ))}
        </div>
      </div>

      {/* Right: Login Card */}
      <div className="login-card-wrap" style={{
        position: 'relative', zIndex: 1,
        flex: '0 0 auto', width: 380,
        marginRight: 'clamp(20px, 5vw, 80px)',
        marginLeft: 'clamp(20px, 3vw, 60px)',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-lg)',
        padding: '32px 32px 24px',
        boxShadow: 'var(--shadow-lg)',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 9,
            background: 'linear-gradient(135deg, var(--accent-blue), #6C5CE7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, fontWeight: 800, color: '#fff',
          }}>W</div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>WiNS Hub</div>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 1 }}>Inteligência Multivertical</div>
          </div>
        </div>

        {/* Title */}
        <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4, margin: 0 }}>
          Acesso ao WiNS Hub
        </h2>
        <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 20, lineHeight: 1.5 }}>
          Plataforma Unificada de Inteligência Territorial
        </p>

        {/* Auth badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '3px 10px', borderRadius: 20,
          background: 'rgba(79, 124, 255, 0.1)',
          border: '1px solid rgba(79, 124, 255, 0.2)',
          fontSize: 11, color: 'var(--accent-blue)', fontWeight: 500,
          marginBottom: 16,
        }}>
          <ShieldCheck size={13} />
          <span>Autenticação Corporativa</span>
        </div>

        {/* Real Keycloak Button */}
        <button
          onClick={login}
          disabled={!authReady}
          style={{
            width: '100%', height: 44,
            background: authReady ? 'var(--accent-blue)' : 'var(--border-default)',
            color: '#fff', fontSize: 13, fontWeight: 600,
            borderRadius: 'var(--radius-md)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            border: 'none', cursor: authReady ? 'pointer' : 'wait',
            transition: 'background var(--transition-fast)',
            marginBottom: 12,
            opacity: authReady ? 1 : 0.7,
          }}
          onMouseEnter={e => { if (authReady) e.currentTarget.style.background = 'var(--accent-blue-hover)'; }}
          onMouseLeave={e => { if (authReady) e.currentTarget.style.background = 'var(--accent-blue)'; }}
        >
          <ShieldCheck size={16} />
          {authReady ? 'Entrar com Keycloak' : 'Validando sessão...'}
          <ExternalLink size={13} />
        </button>

        {/* Support */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <a
            href="https://winshubcomercial.com.br:18443/auth/realms/wins-hub-staging/account"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: 12, color: 'var(--text-tertiary)',
              display: 'inline-flex', alignItems: 'center', gap: 5,
              textDecoration: 'none', cursor: 'pointer',
              padding: '4px 8px', borderRadius: 4,
              transition: 'all var(--transition-fast)',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent-blue)'; e.currentTarget.style.background = 'var(--accent-blue-bg)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-tertiary)'; e.currentTarget.style.background = 'transparent'; }}
          >
            <HelpCircle size={13} />
            Suporte Keycloak
          </a>
        </div>

        {/* Environment & Version */}
        <div style={{
          padding: '10px 0 0', borderTop: '1px solid var(--border-subtle)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          fontSize: 10, color: 'var(--text-tertiary)',
        }}>
          <span>Ambiente: Homologação</span>
          <span>v2.0.0-oficial</span>
        </div>
      </div>

      {/* Footer */}
      <div className="login-footer" style={{
        position: 'absolute', bottom: 16, left: 0, right: 0,
        fontSize: 10, color: 'var(--text-disabled)',
        textAlign: 'center', zIndex: 1,
      }}>
        WiNS Hub © 2026 · Plataforma Unificada de Inteligência Territorial
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
          <ProtectedWrapper><AgroApproved /></ProtectedWrapper>
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
