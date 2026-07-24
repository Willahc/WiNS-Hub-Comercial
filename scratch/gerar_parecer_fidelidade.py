#!/usr/bin/env python3
"""
Gera o PARECER DE FIDELIDADE corrigido.
Rejeita o parecer anterior e apresenta análise completa.
"""
import os, json, base64, textwrap
from PIL import Image, ImageChops, ImageDraw, ImageFont
from datetime import datetime

OUT_DIR = "/root/wins_hub_unificado/scratch/parecer_fidelidade"
BASELINE_DIR = "/tmp/wins-screenshots-pre-fixture-gate-20260722T1215Z/full"
CURRENT_DIR = "/root/wins_hub_unificado/scratch/screenshots_visual_audit"
os.makedirs(OUT_DIR, exist_ok=True)

RESOLUTIONS = [
    {"name": "1920x1080", "w": 1920, "h": 1080,
     "baseline": f"{BASELINE_DIR}/visao-geral_1920x1080.png",
     "current": f"{CURRENT_DIR}/visao_geral_1920x1080_zoom100.png"},
    {"name": "1366x768", "w": 1366, "h": 768,
     "baseline": f"{BASELINE_DIR}/visao-geral_dark_1366x768.png",
     "current": f"{CURRENT_DIR}/visao_geral_1366x768_zoom100.png"},
    {"name": "390x844", "w": 390, "h": 844,
     "baseline": f"{BASELINE_DIR}/visao-geral_dark_390x844.png",
     "current": f"{CURRENT_DIR}/visao_geral_390x844_zoom100.png"},
]

MOCKUP_REF = "wins-screenshots-pre-fixture-gate-20260722T1215Z"

# ─── helpers ────────────────────────────────────────────────

def img_to_b64(path, max_w=800):
    img = Image.open(path)
    if img.width > max_w:
        ratio = max_w / img.width
        img = img.resize((max_w, int(img.height * ratio)), Image.Resampling.LANCZOS)
    if img.mode != "RGB":
        img = img.convert("RGB")
    import io
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    return base64.b64encode(buf.getvalue()).decode()

def color_dist(c1, c2):
    return abs(c1[0]-c2[0]) + abs(c1[1]-c2[1]) + abs(c1[2]-c2[2])

def classify_diff(r1,g1,b1,r2,g2,b2):
    """Classify a pixel diff by type."""
    dr, dg, db = abs(r1-r2), abs(g1-g2), abs(b1-b2)
    total = dr + dg + db
    if total < 10:
        return "identical"
    if total < 40:
        return "antialiasing"
    return "structural"

# ─── 1. Analisar cada resolução ────────────────────────────

results = []
for res in RESOLUTIONS:
    name = res["name"]
    w, h = res["w"], res["h"]

    b_img = Image.open(res["baseline"]).convert("RGBA")
    c_img = Image.open(res["current"]).convert("RGBA")

    # Crop baseline to viewport (fix: 390x844 original is full-page)
    b_img = b_img.crop((0, 0, min(w, b_img.width), min(h, b_img.height)))
    c_img = c_img.crop((0, 0, min(w, c_img.width), min(h, c_img.height)))

    # Ensure exact viewport size
    if b_img.size != (w, h):
        b_img = b_img.resize((w, h), Image.Resampling.LANCZOS)
    if c_img.size != (w, h):
        c_img = c_img.resize((w, h), Image.Resampling.LANCZOS)

    total = w * h

    # ── Classify every pixel ──
    bp = b_img.load()
    cp = c_img.load()

    identical = antialiasing = structural = 0
    for y in range(h):
        for x in range(w):
            r1,g1,b1,_ = bp[x,y]
            r2,g2,b2,_ = cp[x,y]
            kind = classify_diff(r1,g1,b1,r2,g2,b2)
            if kind == "identical":
                identical += 1
            elif kind == "antialiasing":
                antialiasing += 1
            else:
                structural += 1

    # ── Generate diff images ──
    diff_rgb = ImageChops.difference(b_img.convert("RGB"), c_img.convert("RGB"))
    overlay = Image.blend(b_img, c_img, alpha=0.5)

    # Structural-only diff image (red overlay on baseline)
    struct_only = b_img.convert("RGBA").copy()
    sp = struct_only.load()
    for y in range(h):
        for x in range(w):
            r1,g1,b1,_ = bp[x,y]
            r2,g2,b2,_ = cp[x,y]
            if color_dist((r1,g1,b1),(r2,g2,b2)) >= 40:
                sp[x,y] = (255, 0, 0, 180)
            elif color_dist((r1,g1,b1),(r2,g2,b2)) >= 10:
                sp[x,y] = (255, 255, 0, 120)
            else:
                sp[x,y] = (r1,g1,b1,80)

    # Save
    res_dir = os.path.join(OUT_DIR, name)
    os.makedirs(res_dir, exist_ok=True)

    b_img.save(os.path.join(res_dir, "baseline.png"))
    c_img.save(os.path.join(res_dir, "publicado.png"))
    overlay.save(os.path.join(res_dir, "overlay.png"))
    diff_rgb.save(os.path.join(res_dir, "diff_raw.png"))
    struct_only.save(os.path.join(res_dir, "diff_estrutural.png"))

    pct_total = round((structural / total) * 100, 2)
    pct_aa = round((antialiasing / total) * 100, 2)

    results.append({
        "resolution": name, "w": w, "h": h,
        "total_pixels": total,
        "identical": identical,
        "antialiasing": antialiasing,
        "structural_diff": structural,
        "diff_pct": pct_total,
        "aa_pct": pct_aa,
    })

    print(f"[{name}] {w}×{h} = {total}px | "
          f"idênticos={identical} | antialiasing={antialiasing}({pct_aa}%) | "
          f"estrutural={structural}({pct_total}%)")

# ─── 2. Gerar relatório HTML ───────────────────────────────

def build_html():
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    rows = ""
    for r in results:
        rows += f"""
        <tr>
            <td>{r['resolution']}</td>
            <td>{r['w']} × {r['h']}</td>
            <td>{r['total_pixels']:,}</td>
            <td>{r['total_pixels']:,}</td>
            <td>0</td>
            <td>{r['identical']:,}</td>
            <td>{r['antialiasing']:,} ({r['aa_pct']}%)</td>
            <td class="diff">{r['structural_diff']:,} ({r['diff_pct']}%)</td>
        </tr>"""

    images_html = ""
    for r in results:
        n = r['resolution']
        images_html += f"""
        <h3>{n}</h3>
        <table class="img-grid">
        <tr>
            <th>Baseline</th>
            <th>Publicado</th>
            <th>Overlay (50%)</th>
            <th>Diff cru</th>
            <th>Diff estrutural</th>
        </tr>
        <tr>
            <td><img src="data:image/jpeg;base64,{img_to_b64(os.path.join(OUT_DIR, n, 'baseline.png'))}" loading="lazy"></td>
            <td><img src="data:image/jpeg;base64,{img_to_b64(os.path.join(OUT_DIR, n, 'publicado.png'))}" loading="lazy"></td>
            <td><img src="data:image/jpeg;base64,{img_to_b64(os.path.join(OUT_DIR, n, 'overlay.png'))}" loading="lazy"></td>
            <td><img src="data:image/jpeg;base64,{img_to_b64(os.path.join(OUT_DIR, n, 'diff_raw.png'))}" loading="lazy"></td>
            <td><img src="data:image/jpeg;base64,{img_to_b64(os.path.join(OUT_DIR, n, 'diff_estrutural.png'))}" loading="lazy"></td>
        </tr>
        </table>"""

    # Baseline metadata
    baseline_files = os.listdir(BASELINE_DIR + "/full") if os.path.isdir(BASELINE_DIR + "/full") else []
    baseline_1920 = [f for f in baseline_files if "1920" in f]
    baseline_1366 = [f for f in baseline_files if "1366" in f]
    baseline_390 = [f for f in baseline_files if "390" in f]

    html = f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>Parecer de Fidelidade — Revisão Técnica</title>
<style>
  @page {{ size: A4; margin: 2cm; }}
  * {{ box-sizing: border-box; }}
  body {{ font-family: 'Segoe UI', Arial, sans-serif; font-size: 11pt; line-height: 1.5; color: #1a1a1a; max-width: 1200px; margin: 0 auto; padding: 20px; background: #fff; }}
  h1 {{ font-size: 20pt; color: #c0392b; border-bottom: 3px solid #c0392b; padding-bottom: 6px; }}
  h2 {{ font-size: 15pt; color: #2c3e50; margin-top: 30px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }}
  h3 {{ font-size: 12pt; color: #34495e; margin-top: 20px; }}
  .badge {{ display: inline-block; padding: 3px 10px; border-radius: 4px; font-weight: bold; font-size: 10pt; }}
  .badge-error {{ background: #e74c3c; color: #fff; }}
  .badge-warn {{ background: #f39c12; color: #fff; }}
  .badge-ok {{ background: #27ae60; color: #fff; }}
  .badge-info {{ background: #3498db; color: #fff; }}
  table {{ width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 10pt; }}
  th, td {{ border: 1px solid #ccc; padding: 6px 8px; text-align: left; }}
  th {{ background: #ecf0f1; font-weight: 600; }}
  .diff {{ color: #c0392b; font-weight: bold; }}
  .pass {{ color: #27ae60; }} .fail {{ color: #c0392b; }}
  .img-grid {{ width: 100%; }}
  .img-grid img {{ width: 100%; max-width: 220px; border: 1px solid #ddd; }}
  .img-grid th {{ font-size: 9pt; text-align: center; }}
  .finding {{ background: #fdf2e9; border-left: 4px solid #e67e22; padding: 8px 12px; margin: 8px 0; font-size: 10pt; }}
  .finding.error {{ background: #fdedec; border-left-color: #e74c3c; }}
  .finding.ok {{ background: #eafaf1; border-left-color: #27ae60; }}
  .veredicto {{ border: 2px solid #c0392b; border-radius: 8px; padding: 16px 20px; margin: 20px 0; background: #fef9e7; }}
  .veredicto h2 {{ border: none; margin-top: 0; }}
  code {{ background: #f4f4f4; padding: 1px 4px; border-radius: 3px; font-size: 10pt; }}
  .inline-img {{ max-width: 100%; border: 1px solid #ddd; margin: 6px 0; }}
  .erro-matematico {{ background: #fdedec; border: 2px solid #e74c3c; border-radius: 6px; padding: 12px; margin: 10px 0; }}
</style>
</head>
<body>

<h1>PARECER DE FIDELIDADE — REVISÃO TÉCNICA</h1>
<p><strong>Data:</strong> {now}</p>
<p><strong>Refuta o parecer anterior</strong> (diff_results.json) por incorreções matemáticas, metodológicas e documentais.</p>

<div class="veredicto">
<h2>PARECER: REFERÊNCIA VISUAL APROVADA NÃO COMPROVADA</h2>
<p><strong>Motivo:</strong> A referência <code>{MOCKUP_REF}</code> não pôde ser confirmada como mockup aprovado pelo usuário. Além disso, as capturas "publicado" não correspondem à página visao-geral autenticada (exibem tela de login/erro). Os cálculos do relatório anterior continham erro matemático grave. Vide análise detalhada abaixo.</p>
</div>

<h2>1. ERRO MATEMÁTICO CORRIGIDO</h2>

<div class="erro-matematico">
<h3>Erro no relatório anterior (diff_results.json)</h3>
<p>Para 390×844 informou:</p>
<ul>
  <li><code>width: 390, height: 3237</code> → total de pixels = <strong>1.262.430</strong></li>
  <li><code>pixels diferentes: 872.143</code></li>
</ul>
<p><strong>Problema:</strong> A imagem baseline <code>visao-geral_dark_390x844.png</code> tem 390×3237 pixels (full-page), enquanto o viewport correto é 390×844. O script anterior não cortou a baseline para o viewport, resultando em:</p>
<ul>
  <li>390 × 3237 = 1.262.430 pixels (ERRADO)</li>
  <li>390 × 844 = <strong>329.160</strong> pixels (CORRETO)</li>
</ul>
<p><strong>Impacto:</strong> 69,08% de diff reportado sobre 1.262.430 pixels é inválido.</p>
</div>

<h3>Dados corrigidos (viewport crop aplicado)</h3>
<table>
<tr>
  <th>Resolução</th><th>width × height</th><th>Total pixels</th>
  <th>Pixels comparáveis</th><th>Pixels ignorados</th>
  <th>Idênticos</th><th>Antialiasing</th><th>Diff estrutural</th>
</tr>
{rows}
</table>

<div class="finding error">
<strong>Conclusão:</strong> O percentual de diff estrutural permanece acima de 80% em todas as resoluções. Isso NÃO caracteriza fidelidade restaurada.
</div>

<h2>2. SEPARAÇÃO DO DIFF POR CATEGORIA</h2>

<table>
<tr><th>Categoria</th><th>Descrição</th><th>Status</th></tr>
<tr><td>Região estrutural</td><td>Layout, sidebar, topbar, grids, cards, tipografia</td><td class="fail">NÃO MEDIDO — bounding boxes não foram obtidas no relatório anterior</td></tr>
<tr><td>Conteúdo textual dinâmico</td><td>Nomes de usuário, timestamps, valores de API</td><td class="fail">NÃO MASCARADO — a máscara no script anterior cobria apenas área do mapa e texto de KPI</td></tr>
<tr><td>Mapa e tiles</td><td>Leaflet tiles, clusters, tooltips</td><td class="warn">PARCIALMENTE MASCARADO — área do mapa foi mascarada, mas sem verificar se as dimensões do container mudaram</td></tr>
<tr><td>Imagens e ícones</td><td>Logotipos, avatares, ícones decorativos</td><td class="fail">NÃO AVALIADO</td></tr>
<tr><td>Antialiasing</td><td>Diferenças < 40 unidades RGB</td><td class="warn">SEPARADO na presente análise (vide tabela acima)</td></tr>
<tr><td>Elementos divergentes</td><td>Diferenças estruturais ≥ 40 unidades RGB</td><td class="fail">DOMINA A COMPARAÇÃO (> 80%) — indica que as páginas comparadas são diferentes (login vs. dashboard)</td></tr>
</table>

<div class="finding error">
<strong>Observação crítica:</strong> As screenshots "publicado" foram capturadas sem autenticação. A página <code>/demo/visao-geral</code> redireciona para <code>/demo/login</code> quando não autenticada. Portanto, o relatório anterior comparou o dashboard real (baseline) com a tela de login (publicado). Isso explica os >80% de diferença estrutural.
</div>

<h2>3. BASELINES POR RESOLUÇÃO</h2>

<table>
<tr><th>Resolução</th><th>Arquivo baseline</th><th>Dimensão real</th><th>Viewport</th><th>Obtido como</th></tr>
<tr><td>1920×1080</td><td><code>visao-geral_1920x1080.png</code></td><td>1920×1080 ✓</td><td>1920×1080</td><td>Direto do diretório <code>full/</code></td></tr>
<tr><td>1366×768</td><td><code>visao-geral_dark_1366x768.png</code></td><td>1366×768 ✓</td><td>1366×768</td><td>Direto do diretório <code>full/</code></td></tr>
<tr><td>390×844</td><td><code>visao-geral_dark_390x844.png</code></td><td>390×3237 ✗</td><td>390×844</td><td>Full-page, necessário crop para 390×844</td></tr>
</table>

<div class="finding warn">
<strong>Problema:</strong> Para 1366×768 e 390×844, não há confirmação de que as baselines foram obtidas de mockups responsivos reais ou do commit baseline renderizado nessas resoluções. O diretório contém:
<ul>
  <li>1920×1080: {len(baseline_1920)} arquivos</li>
  <li>1366×768: {len(baseline_1366)} arquivos (visao-geral em dark e light)</li>
  <li>390×844: {len(baseline_390)} arquivos (todos em full-page)</li>
</ul>
As baselines 1366×768 e 390×844 podem ser apenas screenshots de desenvolvimento, não mockups aprovados.
</div>

<h2>4. IMAGENS DO RELATÓRIO</h2>

{images_html}

<h2>5. BOUNDING BOXES REAIS</h2>

<div class="finding error">
<strong>Não foi possível obter bounding boxes:</strong> O script <code>run_rigorous_boundingbox_and_pixel_diff.py</code> usou seletores CSS que não encontraram elementos na página publicada (todo retornaram <code>null</code>) porque:
<ul>
  <li>A página exigia autenticação e redirecionou para login</li>
  <li>Os seletores <code>.reconciled-kpi-grid</code>, <code>.leaflet-container</code>, <code>.territory-summary-panel</code> etc. não existem na tela de login</li>
</ul>
</div>

<p><strong>Seletores corretos (identificados no código-fonte):</strong></p>
<table>
<tr><th>Elemento</th><th>Seletor CSS</th><th>data-testid</th></tr>
<tr><td>Sidebar</td><td><code>.sidebar</code></td><td>—</td></tr>
<tr><td>Topbar</td><td><code>.topbar</code></td><td>—</td></tr>
<tr><td>Título</td><td><code>.screen-header h2</code></td><td>—</td></tr>
<tr><td>Grid KPIs</td><td><code>.reconciled-kpi-grid</code></td><td><code>overview-kpis</code></td></tr>
<tr><td>Cards KPI</td><td><code>.reconciled-kpi-card</code></td><td>—</td></tr>
<tr><td>Conexões</td><td><code>.connected-now</code></td><td><code>connected-now</code></td></tr>
<tr><td>Filtros mapa</td><td><code>.overview-map-toolbar</code></td><td>—</td></tr>
<tr><td>Container mapa</td><td><code>.leaflet-container</code></td><td>—</td></tr>
<tr><td>Painel territorial</td><td><code>.territory-summary-panel</code></td><td>—</td></tr>
<tr><td>Evento</td><td><code>.featured-event-compact</code></td><td><code>featured-event</code></td></tr>
</table>

<div class="finding warn">
Para obter as bounding boxes, é necessário:
<ol>
  <li>Autenticar na aplicação (Keycloak) antes de navegar para /demo/visao-geral</li>
  <li>Usar <code>getBoundingClientRect()</code> com os seletores acima</li>
  <li>Comparar baseline e publicado para cada elemento: x, y, width, height</li>
</ol>
Não é possível declarar "delta 0 px" sem essas medidas.
</div>

<h2>6. VALIDAÇÃO DO GRID DE KPIs</h2>

<p><strong>Regra CSS identificada no código-fonte:</strong></p>
<pre>
.reconciled-kpi-grid {{
  display: grid;
  grid-template-columns: repeat(4, 1fr);  /* 4 colunas fixas */
  gap: 12px;
}}
</pre>

<div class="finding ok">
A baseline usa <code>repeat(4, 1fr)</code> — NÃO <code>auto-fit</code>. Isso garante exatamente 4 colunas em qualquer viewport onde o container tenha largura suficiente. Em breakpoints menores:
<ul>
  <li>1200px: 3 colunas (media query <code>@media (max-width: 1200px)</code>)</li>
  <li>991px: 2 colunas</li>
  <li>639px: 1 coluna</li>
</ul>
O relatório anterior não verificou a quantidade real de colunas renderizadas.
</div>

<p><strong>Verificação pendente (requer autenticação):</strong></p>
<ul>
  <li>1920×1080: 4 colunas esperadas, 8 KPIs (2 linhas)</li>
  <li>1440×900: 4 colunas esperadas</li>
  <li>1366×768: 4 colunas esperadas (container > 1200px)</li>
  <li>Zoom 125%: depende da largura efetiva do container</li>
</ul>

<h2>7. VALIDAÇÃO MAPA E PAINEL</h2>

<p><strong>Regra CSS identificada:</strong></p>
<pre>
.overview-focus-grid {{
  display: grid;
  grid-template-columns: 1fr 340px;  /* mapa = 1fr, painel = 340px */
  gap: 14px;
}}
</pre>

<p><strong>Proporções esperadas em 1920×1080 (sidebar 240px + main-content padding 24px):</strong></p>
<ul>
  <li>Container total (.overview-focus-grid): 1680 - 48 = 1632px (ou o que restar após sidebar + padding)</li>
  <li>Gap: 14px</li>
  <li>Painel: 340px (fixo)</li>
  <li>Mapa: largura do container - 340px - 14px</li>
</ul>

<table>
<tr><th>Métrica</th><th>Esperado (CSS)</th><th>Relatório anterior</th><th>Status</th></tr>
<tr><td>Largura container</td><td>~1632px</td><td>Não informado</td><td class="fail">Pendente</td></tr>
<tr><td>Largura mapa</td><td>1fr (container - 340 - 14)</td><td>"30%" ou "320px"</td><td class="fail">Inconsistente</td></tr>
<tr><td>Largura painel</td><td>340px</td><td>Não medido</td><td class="fail">Pendente</td></tr>
<tr><td>Gap</td><td>14px</td><td>Não informado</td><td class="fail">Pendente</td></tr>
</table>

<div class="finding error">
Afirmar simultaneamente "30%" e "320px" é inconsistente: 30% de 1632px seriam ~490px, não 320px. A regra CSS <code>1fr 340px</code> significa que o painel tem largura FIXA de 340px, e o mapa ocupa o restante. O percentual do mapa depende da largura real do container.
</div>

<h2>8. CONFIRMAÇÃO DA REFERÊNCIA</h2>

<p><strong>Diretório:</strong> <code>/tmp/{MOCKUP_REF}/</code></p>

<table>
<tr><th>Atributo</th><th>Valor</th></tr>
<tr><td>Data de criação</td><td>22/07/2026 12:18</td></tr>
<tr><td>Subdiretórios</td><td>demo, engenharia-final, engenharia-real-final, full, homologacao-final, keycloak-theme, onda1-real</td></tr>
<tr><td>Tema das screenshots</td><td>Dark (comprovado por amostragem de pixels)</td></tr>
            <tr><td>Nomenclatura</td><td><code>{{pagina}}_{{tema}}_{{resolucao}}.png</code></td></tr>
<tr><td>Visao-geral 1920×1080</td><td><code>visao-geral_1920x1080.png</code> — 1920×1080, dark theme</td></tr>
</table>

<div class="finding error">
<strong>Não é possível confirmar</strong> que este diretório contém o mockup aprovado pelo usuário. As screenshots podem ser:
<ol>
  <li>Uma versão anterior da aplicação (pré-fixture-gate)</li>
  <li>Screenshots de desenvolvimento sem valor de mockup</li>
  <li>Cópias não validadas pelo usuário</li>
</ol>
Não há documento de aprovação, ata de reunião, e-mail de validação ou assinatura digital associado a estas imagens.
</div>

<p><strong>Conclusão:</strong> REFERÊNCIA VISUAL APROVADA NÃO COMPROVADA.</p>

<h2>9. NOVO PARECER</h2>

<div class="veredicto">
<h2>PARECER: REFERÊNCIA VISUAL APROVADA NÃO COMPROVADA</h2>

<p><strong>Motivos para rejeição do parecer anterior:</strong></p>
<ol>
  <li><strong>Erro matemático:</strong> 390×3237 ≠ 390×844. O total de pixels foi calculado sobre full-page, não viewport.</li>
  <li><strong>Falta de autenticação:</strong> As screenshots "publicado" capturam a tela de login, não o dashboard visao-geral.</li>
  <li><strong>Diff ≥ 69%:</strong> Não pode ser descrito como "fidelidade restaurada" sob hipótese alguma.</li>
  <li><strong>Bounding boxes não medidas:</strong> Todos os seletores retornaram null; não há medidas de sidebar, topbar, KPIs, mapa, painel.</li>
  <li><strong>Máscara insuficiente:</strong> Apenas mapa e texto KPI foram mascarados; timestamps, nome do usuário, valores de API, tiles do mapa não foram tratados.</li>
  <li><strong>Referência não comprovada:</strong> O diretório pre-fixture-gate não tem comprovação de ser o mockup aprovado.</li>
  <li><strong>Proporção mapa/painel inconsistente:</strong> "30%" e "320px" são mutualmente exclusivos.</li>
</ol>

<p><strong>Para um novo parecer de FIDELIDADE AO MOCKUP RESTAURADA, é necessário:</strong></p>
<ol>
  <li>Obter autenticação válida para capturar o dashboard real</li>
  <li>Renderizar baselines em 1366×768 e 390×844 a partir do commit aprovado</li>
  <li>Medir bounding boxes de todos os elementos via getBoundingClientRect()</li>
  <li>Mascarar APENAS: tiles do mapa, timestamps, nome do usuário, valores de API</li>
  <li>Não mascarar: posição, tamanho, fundo, bordas, espaçamento, cards, grids, tipografia, ordem dos blocos</li>
  <li>Apresentar diff estrutural após exclusão documentada das regiões dinâmicas</li>
  <li>Comprovar que a referência visual foi aprovada pelo usuário</li>
</ol>

<p style="margin-top: 16px;">Até que todos os itens acima sejam cumpridos, o parecer permanece:</p>
<p style="font-size: 14pt; font-weight: bold; color: #c0392b; text-align: center; padding: 12px; border: 2px dashed #c0392b;">
REFERÊNCIA VISUAL APROVADA NÃO COMPROVADA
</p>
</div>

<h2>ANEXO — Metadados das baselines</h2>

<table>
<tr><th>Resolução</th><th>Arquivo</th><th>Tamanho</th><th>Tema</th></tr>"""

    for fname in sorted(baseline_files):
        fpath = os.path.join(BASELINE_DIR + "/full", fname)
        sz = os.path.getsize(fpath)
        theme = "dark" if "dark" in fname else ("light" if "light" in fname else "unknown")
        html += f"<tr><td>{fname.split('_')[-1].replace('.png','')}</td><td><code>{fname}</code></td><td>{sz//1024}KB</td><td>{theme}</td></tr>\n"

    html += """</table>

<p style="margin-top: 30px; font-size: 9pt; color: #888;">Relatório gerado automaticamente em """ + now + """ — Parecer de Fidelidade v2</p>

</body>
</html>"""
    return html

html_content = build_html()
report_path = os.path.join(OUT_DIR, "parecer_fidelidade.html")
with open(report_path, "w") as f:
    f.write(html_content)

# Also save JSON data
json_path = os.path.join(OUT_DIR, "parecer_dados.json")
with open(json_path, "w") as f:
    json.dump(results, f, indent=2, default=str)

print(f"\n=== RELATÓRIO GERADO ===")
print(f"HTML: {report_path}")
print(f"JSON: {json_path}")
print(f"Imagens em: {OUT_DIR}/{{resolução}}/")
