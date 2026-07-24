<#import "template.ftl" as layout>
<@layout.mainLayout>
  <div class="form-title">
    <h2>${msg("errorTitle")}</h2>
    <#if message.summary?has_content>
    <p>${message.summary}</p>
    <#else>
    <p>${msg("errorTitleHtml")}</p>
    </#if>
  </div>
</@layout.mainLayout>
