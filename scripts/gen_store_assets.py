from PIL import Image
import os

base = r"C:\dev\VoltLabsApp\src\assets\images"
out = r"C:\dev\VoltLabsApp\store_assets"
os.makedirs(out, exist_ok=True)

WHITE = (255, 255, 255, 255)

# --- App icon (512x512) from the circular logo ---
logo = Image.open(os.path.join(base, "volt_labs_logo.png")).convert("RGBA")
w, h = logo.size  # 668 x 699

# Flatten onto white
flat = Image.new("RGBA", (w, h), WHITE)
flat.alpha_composite(logo)

# Pad to square (max dimension), centered
side = max(w, h)
square = Image.new("RGBA", (side, side), WHITE)
square.paste(flat, ((side - w) // 2, (side - h) // 2), flat)

icon = square.resize((512, 512), Image.LANCZOS).convert("RGB")
icon_path = os.path.join(out, "app_icon_512.png")
icon.save(icon_path, "PNG")
print("Saved", icon_path, icon.size)

# --- Feature graphic (1024x500) from the composite logo ---
composite = Image.open(os.path.join(base, "volt_labs_composite_logo.png")).convert("RGB")
cw, ch = composite.size  # 717 x 622

target_h = 420
scale = target_h / ch
new_w = int(cw * scale)
resized = composite.resize((new_w, target_h), Image.LANCZOS)

canvas = Image.new("RGB", (1024, 500), (255, 255, 255))
x = (1024 - new_w) // 2
y = (500 - target_h) // 2
canvas.paste(resized, (x, y))

fg_path = os.path.join(out, "feature_graphic_1024x500.png")
canvas.save(fg_path, "PNG")
print("Saved", fg_path, canvas.size)
