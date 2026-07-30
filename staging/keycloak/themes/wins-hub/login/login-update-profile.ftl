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
  <form id="kc-update-profile-form" action="${url.loginAction}" method="post">
    <div class="form-title">
      <h2>Atualização de Perfil</h2>
      <p>Confirme ou atualize as informações da sua conta no WiNS Hub</p>
    </div>
    <div class="field-group">
      <label for="email" class="field-label">E-mail</label>
      <div class="input-wrap">
        <svg class="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
        <input id="email" name="email" type="text" class="input-field" value="${(user.email!'')}" autofocus autocomplete="email" />
      </div>
    </div>
    <div class="field-group">
      <label for="firstName" class="field-label">Nome</label>
      <div class="input-wrap">
        <svg class="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        <input id="firstName" name="firstName" type="text" class="input-field" value="${(user.firstName!'')}" autocomplete="given-name" />
      </div>
    </div>
    <div class="field-group">
      <label for="lastName" class="field-label">Sobrenome</label>
      <div class="input-wrap">
        <svg class="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        <input id="lastName" name="lastName" type="text" class="input-field" value="${(user.lastName!'')}" autocomplete="family-name" />
      </div>
    </div>
    <div class="form-actions">
      <button type="submit" id="kc-submit" class="btn-submit">Salvar e Continuar</button>
    </div>
  </form>
</@layout.mainLayout>
