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
  <div class="login-page">
    <div class="login-container">
      <div class="login-header">
        <span class="logo-icon">
          <svg width="40" height="40" viewBox="0 0 48 46" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path fill="#863bff" d="M25.946 44.938c-.664.845-2.021.375-2.021-.698V33.937a2.26 2.26 0 0 0-2.262-2.262H10.287c-.92 0-1.456-1.04-.92-1.788l7.48-10.471c1.07-1.497 0-3.578-1.842-3.578H1.237c-.92 0-1.456-1.04-.92-1.788L10.013.474c.214-.297.556-.474.92-.474h28.894c.92 0 1.456 1.04.92 1.788l-7.48 10.471c-1.07 1.498 0 3.579 1.842 3.579h11.377c.943 0 1.473 1.088.89 1.83L25.947 44.94z"/>
            <path fill="#47bfff" d="M36.993 24.5c0 6.903-5.597 12.5-12.5 12.5s-12.5-5.597-12.5-12.5S17.59 12 24.493 12s12.5 5.597 12.5 12.5z" opacity="0.85"/>
            <path fill="#7e14ff" d="M31.493 24.5c0 3.866-3.134 7-7 7s-7-3.134-7-7 3.134-7 7-7 7 3.134 7 7z" opacity="0.9"/>
          </svg>
        </span>
        <h1 class="brand-title">WiNS Hub</h1>
        <span class="environment-badge">Ambiente de Homologação</span>
      </div>
      <div class="login-card">
        <#nested>
      </div>
      <div class="login-footer">
        <p>Suporte: <a href="mailto:suporte@winshub.com.br">suporte@winshub.com.br</a></p>
      </div>
    </div>
  </div>
</body>
</html>
</#macro>

<#macro registrationLayout displayMessage=true displayRequiredFields=true displayWarnings=true displayInfo=true>
  <@mainLayout>
    <#nested "header">
    <#nested "form">
    <#nested "footer">
  </@mainLayout>
</#macro>
