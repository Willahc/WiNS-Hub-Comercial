<#import "template.ftl" as layout>
<@layout.mainLayout>
  <#if message?has_content && message.type == "error">
    <div class="alert alert-error">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
      <span>${message.summary}</span>
    </div>
  </#if>
  <#if message?has_content && message.type == "info">
    <div class="alert alert-info">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
      <span>${message.summary}</span>
    </div>
  </#if>
  <form id="kc-reset-password-form" action="${url.loginAction}" method="post">
    <div class="form-title">
      <h2>${msg("emailForgotTitle")}</h2>
      <p>${msg("emailInstruction")}</p>
    </div>
    <div class="field-group">
      <label for="username" class="field-label">${msg("usernameOrEmail")}</label>
      <div class="input-wrap">
        <svg class="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        <input id="username" name="username" type="text" class="input-field" placeholder=" " autofocus autocomplete="username" />
      </div>
    </div>
    <div class="form-actions">
      <button type="submit" id="kc-send-email-btn" class="btn-submit">${msg("doSubmit")}</button>
    </div>
  </form>
  <div class="back-link">
    <a href="${url.loginUrl}">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
      ${msg("returnToLogin")}
    </a>
  </div>
</@layout.mainLayout>
