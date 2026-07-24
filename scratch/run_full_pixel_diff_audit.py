import os
from PIL import Image, ImageChops

def compare(b_path, c_path, out_dir, label):
    os.makedirs(out_dir, exist_ok=True)
    if not os.path.exists(b_path) or not os.path.exists(c_path):
        return None

    img1 = Image.open(b_path).convert("RGBA")
    img2 = Image.open(c_path).convert("RGBA")

    if img1.size != img2.size:
        img2 = img2.resize(img1.size, Image.Resampling.LANCZOS)

    overlay = Image.blend(img1, img2, alpha=0.5)
    overlay_path = os.path.join(out_dir, f"{label}_overlay_50pct.png")
    overlay.save(overlay_path)

    diff = ImageChops.difference(img1, img2)
    diff_path = os.path.join(out_dir, f"{label}_pixel_diff.png")
    diff.save(diff_path)

    diff_gray = diff.convert("L")
    histogram = diff_gray.histogram()
    diff_pixels = sum(histogram[1:])
    total_pixels = img1.width * img1.height
    diff_pct = (diff_pixels / total_pixels) * 100.0

    return {
        "label": label,
        "width": img1.width,
        "height": img1.height,
        "total_pixels": total_pixels,
        "diff_pixels": diff_pixels,
        "diff_percentage": round(diff_pct, 2),
        "baseline": b_path,
        "current": c_path,
        "overlay": overlay_path,
        "diff": diff_path
    }

out_dir = "/root/wins_hub_unificado/scratch/visual_diff_artifacts"

items = [
    ("/tmp/wins-screenshots-pre-fixture-gate-20260722T1215Z/full/visao-geral_1920x1080.png",
     "/root/wins_hub_unificado/scratch/screenshots_visual_audit/visao_geral_1920x1080_zoom100.png",
     "1920x1080"),
    ("/tmp/wins-screenshots-pre-fixture-gate-20260722T1215Z/full/visao-geral_dark_1366x768.png",
     "/root/wins_hub_unificado/scratch/screenshots_visual_audit/visao_geral_1366x768_zoom100.png",
     "1366x768"),
    ("/tmp/wins-screenshots-pre-fixture-gate-20260722T1215Z/full/visao-geral_dark_390x844.png",
     "/root/wins_hub_unificado/scratch/screenshots_visual_audit/visao_geral_390x844_zoom100.png",
     "390x844")
]

results = []
for b, c, l in items:
    res = compare(b, c, out_dir, l)
    if res:
        results.append(res)
        print(f"[{l}] diff_pixels={res['diff_pixels']}/{res['total_pixels']} ({res['diff_percentage']}%)")

with open("/root/wins_hub_unificado/scratch/diff_results.json", "w") as f:
    import json
    json.dump(results, f, indent=2)
