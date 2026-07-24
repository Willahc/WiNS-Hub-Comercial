import os
import sys
from PIL import Image, ImageChops, ImageEnhance

def compare_images(baseline_path, current_path, output_dir, label):
    os.makedirs(output_dir, exist_ok=True)
    if not os.path.exists(baseline_path) or not os.path.exists(current_path):
        return {"error": f"Missing file: {baseline_path} or {current_path}"}

    img1 = Image.open(baseline_path).convert("RGBA")
    img2 = Image.open(current_path).convert("RGBA")

    # Resize img2 to match img1 if needed
    if img1.size != img2.size:
        img2 = img2.resize(img1.size, Image.Resampling.LANCZOS)

    # 1. Overlay with 50% opacity
    overlay = Image.blend(img1, img2, alpha=0.5)
    overlay_path = os.path.join(output_dir, f"{label}_overlay_50pct.png")
    overlay.save(overlay_path)

    # 2. Pixel-by-pixel diff
    diff = ImageChops.difference(img1, img2)
    diff_path = os.path.join(output_dir, f"{label}_pixel_diff.png")
    diff.save(diff_path)

    # Calculate numeric diff
    bbox = diff.getbbox()
    diff_pixels = 0
    total_pixels = img1.width * img1.height

    # Count non-zero diff pixels
    diff_gray = diff.convert("L")
    histogram = diff_gray.histogram()
    diff_pixels = sum(histogram[1:]) # pixels with diff > 0
    diff_pct = (diff_pixels / total_pixels) * 100.0

    return {
        "label": label,
        "width": img1.width,
        "height": img1.height,
        "total_pixels": total_pixels,
        "diff_pixels": diff_pixels,
        "diff_percentage": round(diff_pct, 2),
        "overlay_path": overlay_path,
        "diff_path": diff_path
    }

if __name__ == "__main__":
    b_path = "/tmp/wins-screenshots-pre-fixture-gate-20260722T1215Z/full/visao-geral_1920x1080.png"
    c_path = "/root/wins_hub_unificado/scratch/screenshots_visual_audit/visao_geral_1920x1080_zoom100.png"
    out_dir = "/root/wins_hub_unificado/scratch/visual_diffs"
    res = compare_images(b_path, c_path, out_dir, "visao_geral_1920x1080")
    print(res)
