#!/usr/bin/env python3
"""Generate a PDF introduction for XNote Extension."""

from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    ListFlowable, ListItem, HRFlowable
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib import colors

# Output path
output_path = "/Users/loong_zhou/CascadeProjects/xnote-extension/docs/XNote-Extension-Introduction.pdf"

# Create document
doc = SimpleDocTemplate(
    output_path,
    pagesize=letter,
    rightMargin=0.75*inch,
    leftMargin=0.75*inch,
    topMargin=0.75*inch,
    bottomMargin=0.75*inch
)

# Define colors
PRIMARY_COLOR = HexColor("#2563eb")  # Blue
SECONDARY_COLOR = HexColor("#64748b")  # Slate
ACCENT_COLOR = HexColor("#10b981")  # Emerald

# Create styles
styles = getSampleStyleSheet()

title_style = ParagraphStyle(
    'CustomTitle',
    parent=styles['Title'],
    fontSize=28,
    textColor=PRIMARY_COLOR,
    spaceAfter=6,
    alignment=TA_CENTER,
    fontName='Helvetica-Bold'
)

subtitle_style = ParagraphStyle(
    'Subtitle',
    parent=styles['Normal'],
    fontSize=14,
    textColor=SECONDARY_COLOR,
    spaceAfter=20,
    alignment=TA_CENTER,
    fontName='Helvetica'
)

heading_style = ParagraphStyle(
    'CustomHeading',
    parent=styles['Heading1'],
    fontSize=16,
    textColor=PRIMARY_COLOR,
    spaceBefore=16,
    spaceAfter=8,
    fontName='Helvetica-Bold'
)

subheading_style = ParagraphStyle(
    'CustomSubheading',
    parent=styles['Heading2'],
    fontSize=13,
    textColor=HexColor("#1e40af"),
    spaceBefore=10,
    spaceAfter=6,
    fontName='Helvetica-Bold'
)

body_style = ParagraphStyle(
    'CustomBody',
    parent=styles['Normal'],
    fontSize=11,
    textColor=HexColor("#334155"),
    spaceAfter=8,
    leading=16,
    fontName='Helvetica'
)

bullet_style = ParagraphStyle(
    'Bullet',
    parent=styles['Normal'],
    fontSize=10,
    textColor=HexColor("#475569"),
    leftIndent=20,
    spaceAfter=4,
    leading=14,
    fontName='Helvetica'
)

# Build content
story = []

# Title Section
story.append(Paragraph("XNote Extension", title_style))
story.append(Paragraph(
    "AI-Powered Chrome Extension for Intelligent Productivity",
    subtitle_style
))

story.append(HRFlowable(
    width="100%",
    thickness=2,
    color=PRIMARY_COLOR,
    spaceAfter=20
))

# Overview
story.append(Paragraph("Overview", heading_style))
story.append(Paragraph(
    "XNote Extension transforms your browser into an intelligent productivity workspace. "
    "Featuring a convenient sidebar interface accessible via <b>Ctrl/Cmd+G</b>, it provides "
    "multi-functional AI tools, secure cloud synchronization, and seamless web integration.",
    body_style
))

# Key Features
story.append(Paragraph("Key Features", heading_style))

# AI Chat
story.append(Paragraph("AI-Powered Chat Interface", subheading_style))
features_chat = [
    "Multi-provider LLM support: OpenAI (GPT-4/3.5), Google Gemini 2.0 Flash, DeepSeek",
    "Real-time streaming responses with syntax highlighting for code blocks",
    "Chat history management: Save, load, delete, and export conversations",
    "Google Drive export with automatic timestamps",
    "Markdown rendering with proper formatting"
]
for f in features_chat:
    story.append(Paragraph(f"• {f}", bullet_style))

# Screen Capture
story.append(Paragraph("Screen Capture & Visual AI (OCR)", subheading_style))
features_capture = [
    "Area selection screenshot tool with overlay interface",
    "AI-powered text extraction using vision-capable LLM providers",
    "Custom analysis prompts: Extract, translate, or analyze visual content",
    "Support for complex diagrams, charts, and code screenshots"
]
for f in features_capture:
    story.append(Paragraph(f"• {f}", bullet_style))

# Web Summarization
story.append(Paragraph("Intelligent Web Summarization", subheading_style))
features_summary = [
    "One-click summarization via context menu",
    "AI-powered auto-categorization for organization",
    "Google Drive integration with smart folder structure",
    "Favorites system with star ratings"
]
for f in features_summary:
    story.append(Paragraph(f"• {f}", bullet_style))

# Translation
story.append(Paragraph("AI Translation Service", subheading_style))
features_translate = [
    "Real-time translation with streaming responses",
    "Context-aware translations preserving technical terminology",
    "Multiple language support via AI providers"
]
for f in features_translate:
    story.append(Paragraph(f"• {f}", bullet_style))

# Quick Links
story.append(Paragraph("Quick Links Manager", subheading_style))
features_links = [
    "Category-based organization for bookmarks",
    "Context menu integration for saving pages",
    "Edit mode for bulk management"
]
for f in features_links:
    story.append(Paragraph(f"• {f}", bullet_style))

# Google Drive
story.append(Paragraph("Google Drive Integration", subheading_style))
features_drive = [
    "Automatic synchronization with configurable intervals",
    "Smart folder organization: XNote/chats/, XNote/summaries/, XNote/translations/",
    "OAuth2 authentication via Chrome Identity API"
]
for f in features_drive:
    story.append(Paragraph(f"• {f}", bullet_style))

# Technology Stack
story.append(Spacer(1, 10))
story.append(Paragraph("Technology Stack", heading_style))

tech_data = [
    ["Category", "Technologies"],
    ["Frontend", "Vue 3.3+ (Composition API), Vite 5.0+, Pinia"],
    ["Extension", "Chrome Manifest V3, Side Panel API"],
    ["AI Providers", "OpenAI, Google Gemini, DeepSeek"],
    ["Security", "Web Crypto API (AES-GCM-256), Chrome Sync Storage"],
    ["Cloud", "Google Drive API for synchronization"]
]

tech_table = Table(tech_data, colWidths=[1.5*inch, 5*inch])
tech_table.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, 0), PRIMARY_COLOR),
    ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
    ('FONTSIZE', (0, 0), (-1, 0), 11),
    ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
    ('FONTSIZE', (0, 1), (-1, -1), 10),
    ('TEXTCOLOR', (0, 1), (-1, -1), HexColor("#334155")),
    ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ('GRID', (0, 0), (-1, -1), 0.5, HexColor("#e2e8f0")),
    ('BACKGROUND', (0, 1), (-1, -1), HexColor("#f8fafc")),
    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [HexColor("#f8fafc"), colors.white]),
    ('TOPPADDING', (0, 0), (-1, -1), 8),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ('LEFTPADDING', (0, 0), (-1, -1), 10),
]))
story.append(tech_table)

# Unique Features
story.append(Spacer(1, 10))
story.append(Paragraph("What Makes XNote Unique", heading_style))

unique_data = [
    ["Dual-Mode Architecture", "Works as Chrome extension OR standalone web app with automatic detection"],
    ["Multi-Provider LLM", "Switch between providers instantly with no vendor lock-in"],
    ["Intelligent Organization", "AI-powered auto-categorization with smart folder structures"],
    ["Privacy-First Design", "All encryption happens locally - your keys, your data"]
]

for item in unique_data:
    story.append(Paragraph(f"<b>{item[0]}</b>", subheading_style))
    story.append(Paragraph(item[1], body_style))

# Getting Started
story.append(Paragraph("Getting Started", heading_style))
story.append(Paragraph(
    "1. Install the extension from Chrome Web Store or build from source<br/>"
    "2. Open the sidebar with <b>Ctrl+G</b> (Windows/Linux) or <b>Cmd+G</b> (Mac)<br/>"
    "3. Configure your preferred LLM provider in Settings<br/>"
    "4. Connect Google Drive for cloud synchronization (optional)<br/>"
    "5. Right-click on any webpage to access summarization features",
    body_style
))

# Performance
story.append(Spacer(1, 10))
story.append(Paragraph("Performance", heading_style))

perf_data = [
    ["Metric", "Value"],
    ["Initial Load", "< 100ms"],
    ["First AI Response", "< 500ms"],
    ["Screenshot Capture", "< 1 second"],
    ["Memory Usage", "50MB idle, 150MB active"],
    ["Encryption", "< 10ms for API keys"]
]

perf_table = Table(perf_data, colWidths=[2.5*inch, 2.5*inch])
perf_table.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, 0), ACCENT_COLOR),
    ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
    ('FONTSIZE', (0, 0), (-1, 0), 11),
    ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
    ('FONTSIZE', (0, 1), (-1, -1), 10),
    ('TEXTCOLOR', (0, 1), (-1, -1), HexColor("#334155")),
    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ('GRID', (0, 0), (-1, -1), 0.5, HexColor("#e2e8f0")),
    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [HexColor("#f0fdf4"), colors.white]),
    ('TOPPADDING', (0, 0), (-1, -1), 8),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
]))
story.append(perf_table)

# Footer
story.append(Spacer(1, 20))
story.append(HRFlowable(width="100%", thickness=1, color=SECONDARY_COLOR, spaceAfter=10))

footer_style = ParagraphStyle(
    'Footer',
    parent=styles['Normal'],
    fontSize=9,
    textColor=SECONDARY_COLOR,
    alignment=TA_CENTER
)
story.append(Paragraph("Version 2.0.0 | MIT License | Active Development", footer_style))
story.append(Paragraph("https://github.com/yourusername/xnote-extension", footer_style))

# Build PDF
doc.build(story)
print(f"PDF generated: {output_path}")
