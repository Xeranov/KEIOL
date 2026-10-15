import os
import math
from PIL import Image, ImageDraw

def create_keiol_icon(size=512):
    # Create image with RGBA
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Scale factor based on 512
    s = size / 512.0
    
    # Background rounded rectangle (squircle)
    margin = int(24 * s)
    radius = int(108 * s)
    rect_box = [margin, margin, size - margin, size - margin]
    
    # Dark modern gradient / solid background
    # Background base: Deep cinematic slate black (#0e0e12)
    draw.rounded_rectangle(rect_box, radius=radius, fill=(15, 15, 20, 255))
    
    # Subtle inner border for depth
    border_width = max(1, int(4 * s))
    draw.rounded_rectangle(
        rect_box,
        radius=radius,
        outline=(229, 9, 20, 180), # KEIOL signature crimson red
        width=border_width
    )
    
    # Center Stylized 'K' with Play Media Triangle Accent
    # Left vertical stem of K
    stem_left = int(135 * s)
    stem_right = int(185 * s)
    stem_top = int(120 * s)
    stem_bottom = int(392 * s)
    stem_radius = int(18 * s)
    draw.rounded_rectangle(
        [stem_left, stem_top, stem_right, stem_bottom],
        radius=stem_radius,
        fill=(255, 255, 255, 255)
    )
    
    # Top-right arm of K: Styled as a Play Triangle pointing right
    # Points of upper arm / play chevron
    p1 = (int(215 * s), int(250 * s))
    p2 = (int(375 * s), int(135 * s))
    p3 = (int(390 * s), int(160 * s))
    p4 = (int(240 * s), int(275 * s))
    draw.polygon([p1, p2, p3, p4], fill=(229, 9, 20, 255))
    
    # Elegant Play Symbol in upper right quadrant
    play_p1 = (int(290 * s), int(160 * s))
    play_p2 = (int(395 * s), int(230 * s))
    play_p3 = (int(290 * s), int(300 * s))
    draw.polygon([play_p1, play_p2, play_p3], fill=(229, 9, 20, 240))
    
    # Bottom-right arm of K: Solid crisp white stroke
    p5 = (int(215 * s), int(260 * s))
    p6 = (int(380 * s), int(380 * s))
    p7 = (int(345 * s), int(400 * s))
    p8 = (int(190 * s), int(285 * s))
    draw.polygon([p5, p6, p7, p8], fill=(255, 255, 255, 255))
    
    # Subtle inner circle accent (media lens)
    lens_center = (int(200 * s), int(265 * s))
    lens_r = int(14 * s)
    draw.ellipse(
        [lens_center[0] - lens_r, lens_center[1] - lens_r, lens_center[0] + lens_r, lens_center[1] + lens_r],
        fill=(229, 9, 20, 255)
    )
    
    return img

def create_tray_icon(size=32):
    # Minimalist high-contrast tray icon for Windows taskbar (works on both dark & light taskbars)
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    s = size / 32.0
    
    # Rounded badge
    margin = int(1 * s)
    draw.rounded_rectangle([margin, margin, size - margin, size - margin], radius=int(6*s), fill=(20, 20, 25, 255))
    
    # K letter in tray
    stem_left = int(7 * s)
    stem_right = int(11 * s)
    stem_top = int(6 * s)
    stem_bottom = int(26 * s)
    draw.rounded_rectangle([stem_left, stem_top, stem_right, stem_bottom], radius=int(2*s), fill=(255, 255, 255, 255))
    
    # Play accent
    play_p1 = (int(13 * s), int(9 * s))
    play_p2 = (int(26 * s), int(16 * s))
    play_p3 = (int(13 * s), int(23 * s))
    draw.polygon([play_p1, play_p2, play_p3], fill=(229, 9, 20, 255))
    
    return img

def main():
    os.makedirs('build', exist_ok=True)
    
    # 1. Generate primary high-res 512x512 PNG
    icon_512 = create_keiol_icon(512)
    icon_512.save('build/icon.png', format='PNG')
    print('Generated build/icon.png (512x512)')
    
    # 2. Generate Windows .ico with multiple resolution layers
    sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    icon_layers = [create_keiol_icon(w) for w, h in sizes]
    
    # Save as .ico
    icon_layers[-1].save(
        'build/icon.ico',
        format='ICO',
        sizes=[(layer.width, layer.height) for layer in icon_layers],
        append_images=icon_layers[:-1]
    )
    print('Generated build/icon.ico (layers: 16 to 256px)')
    
    # 3. Generate tray icon (32x32 and 16x16)
    tray_32 = create_tray_icon(32)
    tray_32.save('build/tray-icon.png', format='PNG')
    print('Generated build/tray-icon.png (32x32)')

if __name__ == '__main__':
    main()

