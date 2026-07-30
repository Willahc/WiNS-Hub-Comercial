<#import "template.ftl" as layout>
<@layout.mainLayout>
  <div class="form-title">
    <h2>${msg("logoutConfirmTitle")}</h2>
    <p>${msg("logoutConfirmMessage")}</p>
  </div>
  <form id="kc-logout-form" action="" method="post">
    <input type="hidden" name="logout" value="true" />
    <div class="form-actions">
      <button type="submit" class="btn-submit">${msg("doLogout")}</button>
    </div>
  </form>
  <div class="back-link">
    <a href="/auth/realms/wins-hub-staging/protocol/openid-connect/auth?client_id=wins-hub-spa&redirect_uri=https://winshubcomercial.com.br:18443/demo/&response_type=code&scope=openid">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
      ${msg("returnToLogin")}
    </a>
  </div>
</@layout.mainLayout>
