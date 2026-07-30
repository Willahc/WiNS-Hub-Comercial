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
  <form id="kc-update-password-form" action="${url.loginAction}" method="post">
    <div class="form-title">
      <h2>${msg("updatePasswordTitle")}</h2>
      <p>${msg("updatePasswordSubtitle")}</p>
    </div>
    <#if messagesPerField.existsError("password")>
      <div class="alert alert-error">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
        <span>${messagesPerField.get("password")}</span>
      </div>
    </#if>
    <div class="field-group">
      <label for="password-new" class="field-label">${msg("passwordNew")}</label>
      <div class="input-wrap">
        <svg class="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        <input id="password-new" name="password-new" type="password" class="input-field" placeholder=" " autofocus autocomplete="new-password" />
        <button type="button" class="password-toggle" onclick="togglePassword('password-new')" aria-label="${msg("showPassword")}">
          <svg class="eye-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          <svg class="eye-off-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:none"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
        </button>
      </div>
    </div>
    <#if messagesPerField.existsError("password-confirm")>
      <div class="alert alert-error">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
        <span>${messagesPerField.get("password-confirm")}</span>
      </div>
    </#if>
    <div class="field-group">
      <label for="password-confirm" class="field-label">${msg("passwordConfirm")}</label>
      <div class="input-wrap">
        <svg class="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/><polyline points="9 19 12 22 15 15"/></svg>
        <input id="password-confirm" name="password-confirm" type="password" class="input-field" placeholder=" " autocomplete="new-password" />
        <button type="button" class="password-toggle" onclick="togglePassword('password-confirm')" aria-label="${msg("showPassword")}">
          <svg class="eye-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          <svg class="eye-off-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:none"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
        </button>
      </div>
    </div>
    <div class="form-options">
      <#if isAppInitiatedAction??>
        <label class="checkbox-label">
          <input id="logout-sessions" name="logout-sessions" type="checkbox" class="checkbox-input" checked>
          <span class="checkbox-custom"></span>
          ${msg("logoutOtherSessions")}
        </label>
      </#if>
    </div>
    <div class="form-actions">
      <input type="hidden" id="id-hidden-input" name="credentialId" <#if auth.selectedCredential?has_content>value="${auth.selectedCredential}"</#if>/>
      <button type="submit" id="kc-update-password-button" class="btn-submit">${msg("doSaveNewPassword")}</button>
    </div>
  </form>
  <#if client?? && client.clientId?has_content && client.baseUrl?has_content>
    <div class="back-link">
      <a href="${client.baseUrl}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
        ${msg("backToApplication")}
      </a>
    </div>
  </#if>
  <script>
    function togglePassword(fieldId) {
      var pwd = document.getElementById(fieldId);
      var container = pwd.closest('.input-wrap');
      var eye = container.querySelector('.eye-icon');
      var eyeOff = container.querySelector('.eye-off-icon');
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
