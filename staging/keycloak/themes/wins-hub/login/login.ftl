<#import "template.ftl" as layout>
<@layout.mainLayout>
  <#if message?has_content && message.type == "error">
    <div class="alert alert-error">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
      <span>${message.summary}</span>
    </div>
  </#if>
  <#if message?has_content && message.type == "warning">
    <div class="alert alert-warning">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      <span>${message.summary}</span>
    </div>
  </#if>
  <#if message?has_content && message.type == "success">
    <div class="alert alert-success">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
      <span>${message.summary}</span>
    </div>
  </#if>
  <#if message?has_content && message.type == "info">
    <div class="alert alert-info">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
      <span>${message.summary}</span>
    </div>
  </#if>
  <form id="kc-form-login" action="${url.loginAction}" method="post">
    <div class="form-title">
      <h2>${msg("loginTitle")}</h2>
      <p>${msg("loginSubtitle", (realm.displayNameHtml)!)}</p>
    </div>
    <div class="field-group">
      <label for="username" class="field-label">${msg("usernameOrEmail")}</label>
      <div class="input-wrap">
        <svg class="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        <input id="username" name="username" type="text" class="input-field" placeholder=" " value="${login.username!''}" autofocus autocomplete="username" />
      </div>
    </div>
    <div class="field-group">
      <label for="password" class="field-label">${msg("password")}</label>
      <div class="input-wrap">
        <svg class="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        <input id="password" name="password" type="password" class="input-field" placeholder=" " autocomplete="current-password" />
        <button type="button" class="password-toggle" onclick="togglePassword()" aria-label="${msg("showPassword")}">
          <svg id="eye-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          <svg id="eye-off-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:none"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
        </button>
      </div>
    </div>
    <div class="form-options">
      <#if realm.rememberMe && !usernameEditDisabled??>
        <label class="checkbox-label">
          <input id="rememberMe" name="rememberMe" type="checkbox" class="checkbox-input" <#if login.rememberMe??>checked</#if>>
          <span class="checkbox-custom"></span>
          ${msg("rememberMe")}
        </label>
      </#if>
      <#if realm.resetPasswordAllowed>
        <a href="${url.loginResetCredentialsUrl}" class="forgot-link">${msg("doForgotPassword")}</a>
      </#if>
    </div>
    <div id="kc-form-buttons" class="form-actions">
      <input type="hidden" id="id-hidden-input" name="credentialId" <#if auth.selectedCredential?has_content>value="${auth.selectedCredential}"</#if>/>
      <button type="submit" id="kc-login" class="btn-submit">${msg("doLogIn")}</button>
    </div>
  </form>
  <#if realm.password && social.providers?? && social.providers?size != 0>
    <div class="social-section">
      <div class="divider"><span>${msg("orLoginWith")}</span></div>
      <div class="social-buttons">
        <#list social.providers as p>
          <a href="${p.loginUrl}" class="btn-social" id="zocial-${p.alias}">
            <#if p.iconClasses?has_content>
              <span class="${p.iconClasses!}"></span>
            </#if>
            ${p.displayName}
          </a>
        </#list>
      </div>
    </div>
  </#if>
  <#if client?? && client.clientId?has_content && client.baseUrl?has_content>
    <div class="back-link">
      <a href="${client.baseUrl}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
        ${msg("backToApplication")}
      </a>
    </div>
  </#if>
  <script>
    function togglePassword() {
      var pwd = document.getElementById("password");
      var eye = document.getElementById("eye-icon");
      var eyeOff = document.getElementById("eye-off-icon");
      if (pwd.type === "password") {
        pwd.type = "text";
        eye.style.display = "none";
        eyeOff.style.display = "block";
      } else {
        pwd.type = "password";
        eye.style.display = "block";
        eyeOff.style.display = "none";
      }
    }
  </script>
</@layout.mainLayout>
