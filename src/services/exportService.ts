/**
 * WiNS Hub Executive Dossier & Structured CSV Data Exporter (FASE 9)
 * Generates formatted PDF reports & CSV Data Packs across all 4 verticals
 */

export interface DossierData {
  title: string;
  type: 'empresa' | 'obra' | 'municipio' | 'oportunidade';
  cnpj?: string;
  municipality?: string;
  uf?: string;
  engenhariaWorksCount?: number;
  rntrcFleetCount?: number;
  carPropertiesCount?: number;
  cnesHospitalsCount?: number;
  generatedAt: string;
  generatedBy?: string;
  documentHash?: string;
}

export const exportService = {
  /**
   * Generates and downloads a Structured CSV Data Pack
   */
  exportDossierCSV(data: DossierData) {
    const rows = [
      ['ENTIDADE', 'CNPJ/ID', 'MUNICIPIO', 'UF', 'OBRAS_ENGENHARIA', 'RNTRC_LOGISTICA', 'CAR_AGRO', 'CNES_SAUDE', 'DATA_GERACAO', 'HASH_AUDITORIA'],
      [
        `"${data.title.replace(/"/g, '""')}"`,
        `"${data.cnpj || 'N/A'}"`,
        `"${data.municipality || 'Nacional'}"`,
        `"${data.uf || 'BR'}"`,
        data.engenhariaWorksCount ?? 'N/A',
        data.rntrcFleetCount ?? 'N/A',
        data.carPropertiesCount ?? 'N/A',
        data.cnesHospitalsCount ?? 'N/A',
        `"${data.generatedAt}"`,
        `"${data.documentHash || 'INDISPONÍVEL'}"`
      ]
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `dossie_360_${data.type}_${data.title.toLowerCase().replace(/\s+/g, '_')}_2026.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  /**
   * Generates and triggers printable Executive Dossier Report in PDF
   */
  printDossierReport(data: DossierData) {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const hash = data.documentHash || 'INDISPONÍVEL-' + Math.random().toString(36).substring(2, 10).toUpperCase();

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>DOSSIÊ EXECUTIVO 360° - WINS HUB</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; padding: 40px; color: #0F172A; background: #FFF; line-height: 1.5; }
            .header { border-bottom: 2px solid #3B82F6; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; }
            h1 { font-size: 22px; color: #0F172A; margin: 0 0 5px 0; }
            p { font-size: 12px; color: #64748B; margin: 0; }
            .badge { background: #E0F2FE; color: #0284C7; font-weight: bold; font-size: 11px; padding: 4px 8px; border-radius: 4px; }
            .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin: 24px 0; }
            .card { border: 1px solid #E2E8F0; padding: 14px; border-radius: 8px; text-align: center; }
            .card .val { font-size: 20px; font-weight: bold; color: #0F172A; }
            .card .lbl { font-size: 10px; color: #64748B; text-transform: uppercase; margin-top: 2px; }
            .section { margin-top: 24px; border: 1px solid #E2E8F0; padding: 16px; border-radius: 8px; }
            .section h2 { font-size: 14px; color: #1E293B; border-bottom: 1px solid #E2E8F0; padding-bottom: 6px; margin-top: 0; }
            .table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 11px; }
            .table th, .table td { border: 1px solid #E2E8F0; padding: 8px; text-align: left; }
            .table th { background: #F8FAFC; color: #475569; }
            .classification { font-weight: bold; font-size: 10px; padding: 2px 6px; border-radius: 3px; }
            .conf { background: #DCFCE7; color: #166534; }
            .prov { background: #CFFAFE; color: #155E75; }
            .pot { background: #FEF3C7; color: #92400E; }
            footer { margin-top: 40px; font-size: 10px; color: #94A3B8; text-align: center; border-top: 1px solid #E2E8F0; padding-top: 14px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1>DOSSIÊ EXECUTIVO 360° DE INTELIGÊNCIA MULTIVERTICAL</h1>
              <p>WiNS Hub Corporativo · Plataforma Oficial de Inteligência Comercial</p>
            </div>
            <div>
              <span class="badge">CONFIDENCIAL DE USO INTERNO</span>
            </div>
          </div>

          <h3>Relatório Consolidado (${data.type.toUpperCase()}): ${data.title}</h3>
          <p>Localização: ${data.municipality || 'Nacional'}, ${data.uf || 'BR'} | CNPJ/ID: ${data.cnpj || 'N/A'}</p>
          <p>Gerado em: ${data.generatedAt} | Operador: ${data.generatedBy || 'William Nunes'} | Hash de Auditoria: <code>${hash}</code></p>

          <div class="grid">
            <div class="card">
              <div class="val">${data.engenhariaWorksCount ?? 'N/D'}</div>
              <div class="lbl">Obras Engenharia</div>
            </div>
            <div class="card">
              <div class="val">${data.carPropertiesCount ?? 'N/D'}</div>
              <div class="lbl">Imóveis Agro CAR</div>
            </div>
            <div class="card">
              <div class="val">${data.rntrcFleetCount ?? 'N/D'}</div>
              <div class="lbl">Transportadoras RNTRC</div>
            </div>
            <div class="card">
              <div class="val">${data.cnesHospitalsCount ?? 'N/D'}</div>
              <div class="lbl">Unidades Saúde CNES</div>
            </div>
          </div>

          <div class="section">
            <h2>1. Grafo de Relacionamentos e Pareamento Cross-Domain</h2>
            <table class="table">
              <thead>
                <tr>
                  <th>Entidade de Origem</th>
                  <th>Entidade Alvo</th>
                  <th>Vertical</th>
                  <th>Confiança</th>
                  <th>Classificação Obrigatória</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>${data.title}</td>
                  <td>Dados indisponíveis — consulte a API de relacionamentos</td>
                  <td>—</td>
                  <td>—</td>
                  <td><span class="classification pot">POTENCIAL</span></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="section">
            <h2>2. Metodologia e Resolução de Entidades</h2>
            <p style="font-size:11px; color:#475569;">
              Este dossiê classifica os relacionamentos sob a hierarquia de confiança documental:
              <strong>CONFIRMADO</strong> (CNPJ completo idêntico / chave inequívoca),
              <strong>PROVÁVEL</strong> (CNPJ raiz idêntico + razão social similar + município), e
              <strong>POTENCIAL</strong> (proximidade territorial + compatibilidade setorial).
              Estimativas de CAPEX são geradas via modelo preditivo de Machine Learning (Gradient Boosting).
            </p>
          </div>

          <footer>
            WiNS Hub Inteligência Comercial LTDA · Hash de Auditoria: ${hash} · Registro Imutável de Geração.
          </footer>

          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  }
};
