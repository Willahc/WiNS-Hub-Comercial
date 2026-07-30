<#macro mainLayout>
<!DOCTYPE html>
<#assign loc = (locale.current)!'pt-BR'>
<html lang="${loc}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <title>WiNS Hub — ${msg("loginTitle")}</title>
  <link rel="icon" href="${url.resourcesPath}/img/wins-hub-logo.svg" type="image/svg+xml">
  <link href="${url.resourcesPath}/css/login.css" rel="stylesheet">
</head>
<body>
  <div class="login-wrapper">
    <!-- Grid background -->
    <div class="bg-grid">
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
            <circle cx="30" cy="30" r="1" fill="#4F7CFF" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>
    </div>

    <!-- Institutional Left Panel -->
    <div class="login-institutional">
      <h1 class="inst-title">Inteligência territorial e de negócios multivertical</h1>
      <p class="inst-desc">Consolidação em tempo real de infraestrutura, oportunidades, malha logística, dados agro e indicadores assistenciais de saúde no Brasil.</p>
      
      <div class="verticals-grid">
        <div class="vert-pill vert-eng">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 18h20M10 10V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5M4 18v-3a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3"/></svg>
          <span>Engenharia</span>
        </div>
        <div class="vert-pill vert-agro">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 20h10M12 20V10M12 10a5 5 0 0 1 5-5 5 5 0 0 1-5 5zM12 14a4 4 0 0 0-4-4 4 4 0 0 0 4 4z"/></svg>
          <span>Agro</span>
        </div>
        <div class="vert-pill vert-log">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
          <span>Logística</span>
        </div>
        <div class="vert-pill vert-saude">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4.8 2.3A.3.3 0 0 0 4.5 2.6V5A4 4 0 0 0 8 9h8a4 4 0 0 0 3.5-4V2.6a.3.3 0 0 0-.3-.3H4.8z"/><path d="M12 9v12"/></svg>
          <span>Saúde</span>
        </div>
      </div>
    </div>

    <!-- Login Form Right Panel -->
    <div class="login-card-wrap">
      <div class="brand-header">
        <div class="w-badge">W</div>
        <div class="brand-info">
          <span class="brand-name">WiNS Hub</span>
          <span class="brand-sub">Inteligência Multivertical</span>
        </div>
      </div>
      <div class="login-card">
        <#nested>
      </div>
      <div class="login-footer">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>
        <span>Ambiente Oficial · Criptografia de ponta a ponta</span>
      </div>
    </div>
  </div>
</body>
</html>
</#macro>
