#!/usr/bin/env python3
"""Generate StrataSight Word documentation with embedded architecture diagrams."""

from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_LINE_SPACING
from docx.enum.style import WD_STYLE_TYPE
from PIL import Image, ImageDraw, ImageFont
import os

OUT_DIR = "docs/StrataSight-Documentation"
DIAGRAMS_DIR = os.path.join(OUT_DIR, "diagrams")
os.makedirs(DIAGRAMS_DIR, exist_ok=True)

# ----------------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------------
def load_font(size):
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
        "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
        "C:/Windows/Fonts/arial.ttf",
    ]
    for path in candidates:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                pass
    return ImageFont.load_default()


def wrap_text(draw, text, font, max_width):
    words = text.split()
    lines = []
    current = ""
    for w in words:
        trial = current + (" " if current else "") + w
        if draw.textlength(trial, font=font) <= max_width:
            current = trial
        else:
            if current:
                lines.append(current)
            current = w
    if current:
        lines.append(current)
    return lines or [text]


def draw_rounded_rect(draw, xy, radius, fill, outline=None, width=1):
    x1, y1, x2, y2 = xy
    draw.rounded_rectangle(xy, radius=radius, fill=fill, outline=outline, width=width)


def arrow(draw, x1, y1, x2, y2, color="#334155", width=2):
    draw.line([(x1, y1), (x2, y2)], fill=color, width=width)
    # simple arrowhead
    import math
    angle = math.atan2(y2 - y1, x2 - x1)
    head_len = 8
    a1 = angle - math.pi / 6
    a2 = angle + math.pi / 6
    draw.polygon([
        (x2, y2),
        (x2 - head_len * math.cos(a1), y2 - head_len * math.sin(a1)),
        (x2 - head_len * math.cos(a2), y2 - head_len * math.sin(a2)),
    ], fill=color)


def draw_box_with_text(draw, x, y, w, h, text, font, fill="#e0f2fe", text_color="#0f172a"):
    margin = 6
    lines = wrap_text(draw, text, font, w - margin * 2)
    draw_rounded_rect(draw, (x, y, x + w, y + h), radius=8, fill=fill, outline="#94a3b8", width=2)
    line_height = font.size + 4
    total_text_h = len(lines) * line_height
    start_y = y + (h - total_text_h) // 2
    for i, line in enumerate(lines):
        lw = draw.textlength(line, font=font)
        draw.text((x + (w - lw) // 2, start_y + i * line_height), line, fill=text_color, font=font)


# ----------------------------------------------------------------------------
# Diagram 1: High-level System Architecture
# ----------------------------------------------------------------------------
def create_architecture_diagram():
    W, H = 1200, 900
    img = Image.new("RGB", (W, H), "#f8fafc")
    draw = ImageDraw.Draw(img)
    title_font = load_font(24)
    box_font = load_font(16)
    small_font = load_font(13)

    draw.text((W // 2 - 260, 20), "StrataSight High-Level System Architecture", fill="#0f172a", font=title_font)

    # User
    draw_box_with_text(draw, 40, 80, 180, 70, "User Browser", box_font, fill="#e0e7ff")

    # Host
    draw_box_with_text(draw, 300, 60, 260, 110, "Cloud Run or Railway (single container)", box_font, fill="#f1f5f9")

    # Container box outline
    draw_rounded_rect(draw, (600, 60, 1160, 830), radius=16, fill="#ffffff", outline="#cbd5e1", width=2)
    draw.text((620, 75), "StrataSight Docker container", fill="#334155", font=small_font)

    # Frontend and backend inside container
    draw_box_with_text(draw, 640, 110, 240, 90, "React 19 Frontend (Vite build)", box_font, fill="#dbeafe")
    draw_box_with_text(draw, 920, 110, 200, 90, "Express 5 Backend", box_font, fill="#ede9fe")

    # Backend modules
    mods = [
        (640, 240, 220, 70, "Series Service (trends)"),
        (890, 240, 220, 70, "Earth View Router (imagery, events, media)"),
        (640, 340, 220, 70, "AI Proxy (/api-proxy)"),
        (890, 340, 220, 70, "WebSocket Proxy (/ws-proxy)"),
    ]
    for x, y, w, h, t in mods:
        draw_box_with_text(draw, x, y, w, h, t, small_font, fill="#f0f9ff")

    # External data sources
    sources = [
        (60, 240, 180, 60, "NASA POWER"),
        (60, 330, 180, 60, "NASA GES DISC / Giovanni"),
        (60, 420, 180, 60, "NASA GIBS / Worldview"),
        (60, 510, 180, 60, "NASA EONET / EPIC"),
        (60, 600, 180, 60, "NOAA NCEI / GML"),
        (60, 690, 180, 60, "Google Earth Engine / Vertex AI"),
        (60, 780, 180, 60, "Open-Meteo / KNMI / Canada"),
    ]
    for x, y, w, h, t in sources:
        draw_box_with_text(draw, x, y, w, h, t, small_font, fill="#ecfdf5")

    # Arrows from user to host
    arrow(draw, 220, 115, 300, 115)
    # Host to container
    arrow(draw, 560, 115, 600, 115)
    # Frontend to backend inside container
    arrow(draw, 880, 155, 920, 155)
    # Backend to modules
    arrow(draw, 1020, 200, 1020, 240)
    arrow(draw, 1020, 200, 750, 240)
    arrow(draw, 1020, 310, 1020, 340)
    arrow(draw, 1020, 310, 750, 340)
    # Backend modules to external sources
    for i, (x, y, w, h, t) in enumerate(sources):
        target_x = 600 if i < 2 else 600
        # draw arrows from backend box area to source boxes roughly
        start_y = 270 + (i % 4) * 90
        if i < 4:
            arrow(draw, 640, start_y, x + w, y + h // 2)
        else:
            arrow(draw, 880, 375, x + w, y + h // 2)

    path = os.path.join(DIAGRAMS_DIR, "architecture-diagram.png")
    img.save(path)
    return path


# ----------------------------------------------------------------------------
# Diagram 2: User Workflow
# ----------------------------------------------------------------------------
def create_workflow_diagram():
    W, H = 1100, 750
    img = Image.new("RGB", (W, H), "#f8fafc")
    draw = ImageDraw.Draw(img)
    title_font = load_font(24)
    box_font = load_font(16)

    draw.text((W // 2 - 220, 20), "StrataSight User Workflow", fill="#0f172a", font=title_font)

    steps = [
        (80, 100, 220, 70, "1. Pick a plain-language question"),
        (360, 100, 220, 70, "2. Choose a place or coordinates"),
        (640, 100, 220, 70, "3. Select an Earth variable"),
        (920, 100, 140, 70, "4. Analyze"),
        (640, 220, 220, 70, "5. View verdict card and chart"),
        (360, 340, 220, 70, "6. Explore trend map"),
        (640, 340, 220, 70, "7. See satellite imagery"),
        (920, 340, 140, 70, "8. Ask AI Climatologist"),
        (500, 470, 220, 70, "9. Read methods and caveats"),
        (500, 600, 220, 70, "10. Export or share findings"),
    ]
    colors = ["#dbeafe", "#e0e7ff", "#ede9fe", "#fae8ff", "#fce7f3",
              "#ccfbf1", "#d1fae5", "#fef9c3", "#ffedd5", "#fee2e2"]
    for (x, y, w, h, t), c in zip(steps, colors):
        draw_box_with_text(draw, x, y, w, h, t, box_font, fill=c)

    # arrows
    for i in range(len(steps) - 1):
        x1, y1, w1, h1, _ = steps[i]
        x2, y2, w2, h2, _ = steps[i + 1]
        arrow(draw, x1 + w1, y1 + h1 // 2, x2, y2 + h2 // 2)

    path = os.path.join(DIAGRAMS_DIR, "workflow-diagram.png")
    img.save(path)
    return path


# ----------------------------------------------------------------------------
# Diagram 3: Backend Data Flow and Integrations
# ----------------------------------------------------------------------------
def create_integration_diagram():
    W, H = 1300, 850
    img = Image.new("RGB", (W, H), "#f8fafc")
    draw = ImageDraw.Draw(img)
    title_font = load_font(24)
    box_font = load_font(15)
    small_font = load_font(13)

    draw.text((W // 2 - 300, 20), "StrataSight Backend Data Flow and Integrations", fill="#0f172a", font=title_font)

    # Frontend
    draw_box_with_text(draw, 40, 100, 160, 70, "React Frontend", box_font, fill="#dbeafe")

    # Express router box
    draw_rounded_rect(draw, (260, 60, 640, 780), radius=16, fill="#ffffff", outline="#cbd5e1", width=2)
    draw.text((270, 75), "Express 5 Backend", fill="#334155", font=small_font)

    # Routes
    routes = [
        (280, 110, 180, 55, "/api/series"),
        (280, 190, 180, 55, "/api/earthdata"),
        (280, 270, 180, 55, "/api/imagery"),
        (280, 350, 180, 55, "/api/events"),
        (280, 430, 180, 55, "/api/media"),
        (280, 510, 180, 55, "/api/epic"),
        (280, 590, 180, 55, "/api-proxy"),
        (280, 670, 180, 55, "/ws-proxy"),
    ]
    for x, y, w, h, t in routes:
        draw_box_with_text(draw, x, y, w, h, t, small_font, fill="#e0f2fe")

    # Services
    draw_box_with_text(draw, 500, 110, 120, 55, "Series Service", small_font, fill="#ede9fe")
    draw_box_with_text(draw, 500, 270, 120, 55, "Earth View", small_font, fill="#ede9fe")

    # Cache / seed
    draw_box_with_text(draw, 500, 380, 120, 100, "Disk cache + seed-cache fallback", small_font, fill="#fef9c3")

    # Upstream APIs
    upstreams = [
        (700, 80, 200, 55, "NASA POWER"),
        (700, 150, 200, 55, "NASA GES DISC Giovanni"),
        (700, 220, 200, 55, "NASA GIBS"),
        (700, 290, 200, 55, "NASA Worldview Snapshots"),
        (700, 360, 200, 55, "NASA EONET"),
        (700, 430, 200, 55, "NASA Image and Video Library"),
        (700, 500, 200, 55, "NASA EPIC on DSCOVR"),
        (700, 570, 200, 55, "NOAA NCEI / GML"),
        (700, 640, 200, 55, "Google Earth Engine"),
        (700, 710, 200, 55, "Google Vertex AI (Gemini)"),
        (700, 780, 200, 55, "Open-Meteo / KNMI / Canada"),
    ]
    for x, y, w, h, t in upstreams:
        draw_box_with_text(draw, x, y, w, h, t, small_font, fill="#ecfdf5")

    # Arrows frontend -> express
    arrow(draw, 200, 135, 280, 135)
    # routes -> services
    arrow(draw, 460, 138, 500, 138)
    arrow(draw, 460, 298, 500, 298)
    # series service -> upstreams
    arrow(draw, 620, 138, 700, 108)
    arrow(draw, 620, 138, 700, 178)
    # earth view -> upstreams
    arrow(draw, 620, 298, 700, 248)
    arrow(draw, 620, 298, 700, 318)
    arrow(draw, 620, 298, 700, 388)
    arrow(draw, 620, 298, 700, 458)
    arrow(draw, 620, 298, 700, 528)
    # /api-proxy -> vertex
    arrow(draw, 460, 620, 700, 738)
    # /ws-proxy -> vertex
    arrow(draw, 460, 700, 700, 738)
    # /api/earthdata -> NOAA etc
    arrow(draw, 460, 220, 700, 590)
    arrow(draw, 460, 220, 700, 810)
    # cache
    arrow(draw, 560, 165, 560, 380)
    arrow(draw, 560, 325, 560, 380)

    path = os.path.join(DIAGRAMS_DIR, "integration-diagram.png")
    img.save(path)
    return path


# ----------------------------------------------------------------------------
# Word document creation
# ----------------------------------------------------------------------------
def set_style(doc, name, size, bold=False, color=None):
    style = doc.styles[name]
    font = style.font
    font.size = Pt(size)
    font.bold = bold
    if color:
        font.color.rgb = RGBColor(*color)
    return style


def add_heading(doc, text, level=1):
    p = doc.add_heading(text, level=level)
    for run in p.runs:
        run.font.color.rgb = RGBColor(15, 23, 42)
    return p


def add_para(doc, text, bold=False, italic=False):
    p = doc.add_paragraph()
    run = p.add_run(text)
    run.bold = bold
    run.italic = italic
    run.font.color.rgb = RGBColor(15, 23, 42)
    return p


def add_bullet(doc, text):
    p = doc.add_paragraph(text, style="List Bullet")
    for run in p.runs:
        run.font.color.rgb = RGBColor(15, 23, 42)
    return p


def create_document():
    doc = Document()
    set_style(doc, "Normal", 11)
    set_style(doc, "Heading 1", 22, bold=True, color=(15, 23, 42))
    set_style(doc, "Heading 2", 16, bold=True, color=(15, 23, 42))
    set_style(doc, "Heading 3", 13, bold=True, color=(15, 23, 42))

    # Title
    title = doc.add_paragraph()
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = title.add_run("StrataSight Technical Documentation")
    run.bold = True
    run.font.size = Pt(28)
    run.font.color.rgb = RGBColor(15, 23, 42)

    subtitle = doc.add_paragraph()
    subtitle.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = subtitle.add_run("NASA Space Apps Challenge 2026: Earth Science Trend Detective")
    run.font.size = Pt(14)
    run.font.color.rgb = RGBColor(71, 85, 105)

    doc.add_paragraph()
    meta = doc.add_paragraph()
    meta.alignment = WD_ALIGN_PARAGRAPH.CENTER
    meta_run = meta.add_run("Prepared by Team StrataSight | Muhammad Arslan Toor, Fatima Noor")
    meta_run.italic = True
    meta_run.font.color.rgb = RGBColor(71, 85, 105)

    doc.add_page_break()

    # 1. Executive Summary
    add_heading(doc, "1. Executive Summary", level=1)
    add_para(doc,
        "StrataSight is a full-stack web application that turns decades of NASA and partner agency Earth observations into clear, "
        "trustworthy answers about environmental change. A user asks a plain question, picks a place, and selects a variable. "
        "The app then fetches real data, runs statistical tests, and explains the result in everyday language.")
    add_para(doc,
        "This document describes the system architecture, user workflow, backend integrations, data sources, deployment options, "
        "security practices, and known limitations. It is written for judges, contributors, and future maintainers.")

    # 2. What StrataSight Does
    add_heading(doc, "2. What StrataSight Does", level=1)
    add_para(doc, "The challenge asks four questions. StrataSight answers each one:")
    add_bullet(doc, "What is changing? A verdict headline, arrow, and plain-language sentence.")
    add_bullet(doc, "Where is it changing? The analyzed grid cell and an interactive world trend map.")
    add_bullet(doc, "How much is it changing? Sen's slope per decade with a 95 percent confidence interval.")
    add_bullet(doc, "Is it significant? An autocorrelation-aware Mann-Kendall test with a p-value and confidence meter.")
    add_para(doc,
        "In addition to trend analysis, users can explore satellite imagery on a 3D globe, compare regions, "
        "view recent natural events, and open an optional AI Climatologist powered by Google Vertex AI Gemini.")

    # 3. System Architecture
    add_heading(doc, "3. System Architecture", level=1)
    add_para(doc,
        "The application is deployed as a single Docker container. The container serves the built React frontend "
        "and the Express backend from the same origin. This removes cross-origin issues and keeps the deployment simple.")
    add_heading(doc, "3.1 Architecture Diagram", level=2)
    arch_path = create_architecture_diagram()
    doc.add_picture(arch_path, width=Inches(6.2))
    last_paragraph = doc.paragraphs[-1]
    last_paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
    add_para(doc,
        "Figure 1: The user connects to a Cloud Run or Railway container. The container hosts the React frontend "
        "and Express backend. The backend proxies requests to NASA, NOAA, Google, and other data providers.")

    add_heading(doc, "3.2 Frontend Stack", level=2)
    add_bullet(doc, "React 19 with TypeScript strict mode")
    add_bullet(doc, "Vite for development and production builds")
    add_bullet(doc, "Tailwind CSS for styling")
    add_bullet(doc, "Recharts for charts")
    add_bullet(doc, "Leaflet for 2D maps")
    add_bullet(doc, "CesiumJS for the 3D globe with NASA GIBS imagery")

    add_heading(doc, "3.3 Backend Stack", level=2)
    add_bullet(doc, "Express 5 with native ES modules")
    add_bullet(doc, "Node.js test runner for backend unit tests")
    add_bullet(doc, "Rate limiting via express-rate-limit")
    add_bullet(doc, "Disk caching and a committed seed cache for resilience")
    add_bullet(doc, "WebSocket proxy for live AI streaming")

    # 4. User Workflow
    add_heading(doc, "4. User Workflow", level=1)
    wf_path = create_workflow_diagram()
    doc.add_picture(wf_path, width=Inches(6.2))
    last_paragraph = doc.paragraphs[-1]
    last_paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
    add_para(doc,
        "Figure 2: A typical journey starts with a guided question, moves through location and variable selection, "
        "and ends with charts, maps, imagery, AI explanation, methods, and export options.")

    # 5. Backend Data Flow and Integrations
    add_heading(doc, "5. Backend Data Flow and Integrations", level=1)
    add_para(doc,
        "The frontend talks to relative paths such as /api/series, /api/imagery, /api/events, /api/media, /api/epic, "
        "/api-proxy, and /ws-proxy. The Express backend routes each path to the right service or proxy.")
    int_path = create_integration_diagram()
    doc.add_picture(int_path, width=Inches(6.5))
    last_paragraph = doc.paragraphs[-1]
    last_paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
    add_para(doc,
        "Figure 3: Requests flow from the React frontend into Express routes. Each route reaches a service, "
        "which may use a disk cache or seed cache before calling the upstream agency.")

    add_heading(doc, "5.1 Series Service", level=2)
    add_para(doc,
        "The Series Service handles all trend and time-series requests. It normalizes input, checks provider availability, "
        "fetches data from NASA POWER, NASA GES DISC Giovanni, NOAA, or Google Earth Engine, fills small gaps, "
        "and returns a consistent response with provenance metadata.")
    add_bullet(doc, "Concurrent identical requests share one upstream fetch to avoid duplicate calls.")
    add_bullet(doc, "If an upstream service fails, the backend returns a previously cached real response marked CACHED_REAL.")
    add_bullet(doc, "A committed seed cache covers demo stories when the network is unavailable.")

    add_heading(doc, "5.2 Earth View Router", level=2)
    add_para(doc,
        "The Earth View Router powers the Map tab. It provides NASA GIBS layer catalogs, satellite snapshots, "
        "natural events from NASA EONET, media from the NASA Image and Video Library, and the latest EPIC whole-Earth photo.")
    add_bullet(doc, "/api/imagery/layers returns live GIBS layer metadata.")
    add_bullet(doc, "/api/imagery/snapshot fetches a place image from NASA Worldview Snapshots and caches it on disk.")
    add_bullet(doc, "/api/events returns natural events near the chosen place.")
    add_bullet(doc, "/api/media and /api/media/asset return media items and playable video URLs.")
    add_bullet(doc, "/api/epic/latest returns the newest DSCOVR EPIC natural-color image of Earth.")

    add_heading(doc, "5.3 AI Climatologist Integration", level=2)
    add_para(doc,
        "The AI Climatologist is optional and is hidden when not configured. When enabled, the backend proxies "
        "generateContent, predict, and streamGenerateContent requests to Google Vertex AI Gemini. A custom header "
        "(PROXY_HEADER) prevents unauthorized use. The WebSocket proxy routes live bidirectional audio or streaming "
        "sessions to Vertex AI.")

    # 6. Statistics Engine
    add_heading(doc, "6. Statistics Engine", level=1)
    add_para(doc,
        "StrataSight does not rely on black-box numbers. It runs well-known statistical tests in the browser "
        "using a tested TypeScript engine.")
    add_bullet(doc, "Mann-Kendall with tie correction for trend detection")
    add_bullet(doc, "Hamed-Rao modified Mann-Kendall for autocorrelation-corrected p-values")
    add_bullet(doc, "Sen's slope with Gilbert confidence intervals for the size of change")
    add_bullet(doc, "Seasonal Mann-Kendall and STL-style decomposition for seasonal robustness")
    add_bullet(doc, "Pettitt change-point test with effective-sample-size correction")
    add_bullet(doc, "Benjamini-Hochberg false-discovery rate control for the trend map")
    add_bullet(doc, "Bretherton effective-N correlation for teleconnection links")

    # 7. Data Sources and Attribution
    add_heading(doc, "7. Data Sources and Attribution", level=1)
    add_para(doc,
        "Every result carries provenance. The app only displays variables whose provider is configured. "
        "Nothing is simulated.")
    add_heading(doc, "7.1 NASA Data", level=2)
    add_bullet(doc, "NASA POWER: MERRA-2 and CERES point time series")
    add_bullet(doc, "NASA GES DISC Giovanni: GPM IMERG, GLDAS, AIRS, OMI NO2")
    add_bullet(doc, "NASA GIBS and Worldview Snapshots: satellite map tiles and place images")
    add_bullet(doc, "NASA EONET: natural events")
    add_bullet(doc, "NASA Image and Video Library: photos and videos")
    add_bullet(doc, "NASA EPIC on DSCOVR: whole-Earth natural-color images")
    add_bullet(doc, "NASA PO.DAAC Hydrocron: SWOT river altimetry")
    add_bullet(doc, "Google Earth Engine (optional): MODIS NDVI via NASA LP DAAC")
    add_heading(doc, "7.2 Partner and Other Data", level=2)
    add_bullet(doc, "NOAA NCEI Climate Data Online and Global Summary of the Month")
    add_bullet(doc, "NOAA Global Monitoring Laboratory: CO2 and CH4")
    add_bullet(doc, "KNMI Climate Explorer: climate indices")
    add_bullet(doc, "Environment and Climate Change Canada GeoMet and hydrometric data")
    add_bullet(doc, "Canadian Space Agency: RADARSAT Constellation Mission metadata")
    add_bullet(doc, "Open-Meteo, Nominatim, BigDataCloud: geocoding")

    # 8. Deployment Options
    add_heading(doc, "8. Deployment Options", level=1)
    add_heading(doc, "8.1 Google Cloud Run", level=2)
    add_para(doc,
        "Build and deploy the included Dockerfile. Cloud Run injects PORT and the server listens on 0.0.0.0. "
        "Set environment variables or secrets for EARTHDATA_TOKEN, NOAA_CDO_TOKEN, GOOGLE_CLOUD_PROJECT, "
        "GOOGLE_CLOUD_LOCATION, PROXY_HEADER, EE_PROJECT_ID, and EE_SERVICE_ACCOUNT_KEY_JSON.")
    add_heading(doc, "8.2 Railway", level=2)
    add_para(doc,
        "Railway can deploy the same Dockerfile for the full stack. Alternatively, deploy only the backend folder "
        "for an API-only service, and host the frontend separately with rewrites to the Railway URL.")
    add_heading(doc, "8.3 Local Development", level=2)
    add_para(doc,
        "Run npm install, then npm run dev. This starts the Vite frontend on port 5173 and the Express backend on port 5000. "
        "Copy backend/.env.example to backend/.env.local and fill in optional keys.")

    # 9. Security and Secrets
    add_heading(doc, "9. Security and Secrets", level=1)
    add_bullet(doc, "API keys and service-account files are read from environment variables, never committed.")
    add_bullet(doc, "backend/.env.local and any file matching *service-account*.json are git-ignored.")
    add_bullet(doc, "The AI proxy requires a matching PROXY_HEADER to prevent open proxy abuse.")
    add_bullet(doc, "Rate limits protect upstream APIs and the deployment.")
    add_bullet(doc, "If a key was ever committed, rotate it immediately.")

    # 10. Known Limitations
    add_heading(doc, "10. Known Limitations", level=1)
    add_bullet(doc, "Trend-map cells are sampled on a 15-degree land grid; coastal cells may be omitted.")
    add_bullet(doc, "Satellite-era records can be dominated by natural cycles such as El Nino.")
    add_bullet(doc, "Satellite pictures are daily snapshots, not live video.")
    add_bullet(doc, "Cloud-cover estimates for snapshots are approximate.")
    add_bullet(doc, "Detected trends are not attributed to a cause.")

    # 11. Next Steps
    add_heading(doc, "11. Next Steps", level=1)
    add_bullet(doc, "Deploy the Docker container to Cloud Run or Railway.")
    add_bullet(doc, "Configure optional provider keys and the AI Climatologist.")
    add_bullet(doc, "Run npm test before each release.")
    add_bullet(doc, "Use npm run warm to pre-fetch demo data for fast first loads.")

    out_path = os.path.join(OUT_DIR, "StrataSight-Technical-Documentation.docx")
    doc.save(out_path)
    return out_path


if __name__ == "__main__":
    out = create_document()
    print(f"Created: {out}")
