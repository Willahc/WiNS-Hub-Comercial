import { AlertCircle, ExternalLink, Monitor, Smartphone, Laptop, CheckCircle } from 'lucide-react';

const pages = [
  {
    num: '01', name: 'Login', route: '/login',
    status: 'Aprovado',
    statusColor: '#22C55E',
    screenshots: [
      { label: 'Desktop', res: '1920×1080', file: '01-login-desktop.png' },
      { label: 'Laptop', res: '1440×900', file: '01-login-laptop.png' },
      { label: 'Mobile', res: '390×844', file: '01-login-mobile.png' },
    ],
  },
  {
    num: '02', name: 'Visão Geral', route: '/visao-geral',
    status: 'Aprovado',
    statusColor: '#22C55E',
    screenshots: [
      { label: 'Desktop', res: '1920×1080', file: '02-visao-geral-desktop.png' },
      { label: 'Laptop', res: '1440×900', file: '02-visao-geral-laptop.png' },
      { label: 'Mobile', res: '390×844', file: '02-visao-geral-mobile.png' },
    ],
  },
  {
    num: '03', name: 'Engenharia', route: '/engenharia',
    status: 'Aprovado',
    statusColor: '#22C55E',
    screenshots: [
      { label: 'Desktop', res: '1920×1080', file: '03-engenharia-dashboard-desktop.png' },
      { label: 'Laptop', res: '1440×900', file: '03-engenharia-dashboard-laptop.png' },
      { label: 'Mobile', res: '390×844', file: '03-engenharia-dashboard-mobile.png' },
    ],
  },
  {
    num: '04', name: 'Engenharia · Lista de Obras', route: '/engenharia/obras',
    status: 'Aprovado',
    statusColor: '#22C55E',
    screenshots: [
      { label: 'Desktop', res: '1920×1080', file: '04-engenharia-obras-desktop.png' },
      { label: 'Laptop', res: '1440×900', file: '04-engenharia-obras-laptop.png' },
      { label: 'Mobile', res: '390×844', file: '04-engenharia-obras-mobile.png' },
    ],
  },
  {
    num: '05', name: 'Engenharia · Detalhe da Obra', route: '/engenharia/obras/obra-exemplo',
    status: 'Em validação',
    statusColor: '#F59E0B',
    screenshots: [
      { label: 'Desktop', res: '1920×1080', file: '05-engenharia-obra-desktop.png' },
      { label: 'Laptop', res: '1440×900', file: '05-engenharia-obra-laptop.png' },
      { label: 'Mobile', res: '390×844', file: '05-engenharia-obra-mobile.png' },
    ],
  },
];

export default function Gallery() {
  return (
    <div style={{
      minHeight: '100vh', background: '#08111F',
      color: '#F4F7FB', fontFamily: "'Inter', -apple-system, sans-serif",
      padding: '40px 24px',
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: 'linear-gradient(135deg, #4F7CFF, #6C5CE7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, fontWeight: 800, color: '#fff',
          }}>W</div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>WiNS Hub — Mockups v2</h1>
            <p style={{ fontSize: 12, color: '#71809A', margin: '2px 0 0' }}>
              Galeria de validação · Projeto isolado · Navegação local
            </p>
          </div>
        </div>

        <div style={{
          marginTop: 32, display: 'flex', flexDirection: 'column', gap: 24,
        }}>
          {pages.map(p => (
            <div key={p.num} style={{
              background: '#101C2D', border: '1px solid #253650',
              borderRadius: 12, padding: 24,
            }}>
              {/* Page header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <span style={{ fontSize: 11, color: '#71809A', fontWeight: 600 }}>PÁGINA {p.num}</span>
                  <h2 style={{ fontSize: 18, fontWeight: 600, margin: '4px 0', color: '#F4F7FB' }}>{p.name}</h2>
                </div>
                <a
                  href={p.route}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '8px 16px', background: '#4F7CFF', color: '#fff',
                    borderRadius: 8, fontSize: 13, fontWeight: 600,
                    textDecoration: 'none',
                  }}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink size={14} />
                  Abrir mockup
                </a>
              </div>

              {/* Status */}
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '3px 10px', borderRadius: 12,
                background: `${p.statusColor}22`,
                border: `1px solid ${p.statusColor}44`,
                fontSize: 11, color: p.statusColor, fontWeight: 500, marginBottom: 16,
              }}>
                {p.status === 'Aprovado' ? <CheckCircle size={12} /> : <AlertCircle size={12} />}
                {p.status}
              </div>

              {/* Screenshot set */}
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                {p.screenshots.map(s => (
                  <div key={s.label} style={{
                    flex: '1 1 200px', minWidth: 160, maxWidth: 320,
                  }}>
                    <div style={{
                      background: '#0a0a0a', borderRadius: 8, overflow: 'hidden',
                      border: '1px solid #1E2D42',
                    }}>
                      <a href={`/mockups-v2/screenshots/${s.file}`} target="_blank" rel="noopener noreferrer">
                        <img
                          src={`/mockups-v2/screenshots/${s.file}`}
                          alt={`${p.name} ${s.label}`}
                          style={{ width: '100%', display: 'block', cursor: 'pointer' }}
                          loading="lazy"
                        />
                      </a>
                    </div>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 6, marginTop: 6,
                      fontSize: 11, color: '#9EACC4',
                    }}>
                      {s.label === 'Desktop' ? <Monitor size={14} /> : s.label === 'Laptop' ? <Laptop size={14} /> : <Smartphone size={14} />}
                      <span>{s.label} · {s.res}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Review link */}
        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <a
            href="/mockups-v2/review/login-review.html"
            target="_blank" rel="noopener noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              color: '#4F7CFF', fontSize: 13, textDecoration: 'none',
            }}
          >
            <ExternalLink size={14} />
            Abrir relatório de revisão
          </a>
          <span style={{ margin: '0 12px', color: '#253650' }}>·</span>
          <a
            href="/mockups-v2/screenshots/"
            target="_blank" rel="noopener noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              color: '#4F7CFF', fontSize: 13, textDecoration: 'none',
            }}
          >
            <ExternalLink size={14} />
            Screenshots
          </a>
          <span style={{ margin: '0 12px', color: '#253650' }}>·</span>
          <a
            href="/mockups-v2/review/login-contact-sheet.png"
            target="_blank" rel="noopener noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              color: '#4F7CFF', fontSize: 13, textDecoration: 'none',
            }}
          >
            <ExternalLink size={14} />
            Contact sheet
          </a>
        </div>

        <p style={{
          marginTop: 32, fontSize: 10, color: '#4A5A74', textAlign: 'center',
        }}>
          WiNS Hub Mockups v2 · Nenhuma chamada a API real · Ambiente isolado de prototipação
        </p>
      </div>
    </div>
  );
}
