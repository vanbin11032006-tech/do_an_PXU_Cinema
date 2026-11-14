#!/usr/bin/env python3
"""Sinh slide báo cáo đồ án PXU Cinema (14 slide, 16:9, có ảnh + hiệu ứng).

Chạy: python scripts/build_pptx.py
Sau đó scripts/anim_pptx.py bơm hiệu ứng động bằng PowerPoint COM.
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image
from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_CONNECTOR, MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.oxml.ns import qn
from pptx.util import Emu, Inches, Pt
from lxml import etree

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "PXU_CINEMA_BAO_CAO.pptx"
FIGS = ROOT / ".tmp-docx" / "figs"
TMP = ROOT / ".tmp-pptx"
LOGO = ROOT / ".tmp-docx" / "logo.png"

# ------------------------------------------------------------------ palette
BASE = "F5F7FC"
SURF = "FFFFFF"
SURF2 = "EDF2F9"
ELEV = "E3EAF5"
LINE = "D6DFEC"
WHITE = "0F172A"          # ink: default text colour on the light deck
SOFT = "334155"
MUTED = "5A6B84"
DIM = "7E8FA6"
BRAND = "D9480F"
BRAND2 = "EA580C"
GOLD = "B45309"
PINK = "BE185D"
GREEN = "15803D"
BLUE = "0369A1"
RED = "DC2626"

FONT = "Segoe UI"
DISPLAY = "Segoe UI"

SW, SH = 13.333, 7.5
ML = 0.72


def rgb(h: str) -> RGBColor:
    return RGBColor.from_string(h)


def new_slide(prs: Presentation):
    s = prs.slides.add_slide(prs.slide_layouts[6])
    bg = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, Inches(SW), Inches(SH))
    bg.fill.solid()
    bg.fill.fore_color.rgb = rgb(BASE)
    bg.line.fill.background()
    bg.shadow.inherit = False
    bg.name = "bg"
    # fade transition between slides
    trans = etree.SubElement(s._element, qn("p:transition"))
    trans.set("spd", "med")
    etree.SubElement(trans, qn("p:fade"))
    return s


def solid(shape, color: str, alpha: int | None = None):
    shape.fill.solid()
    shape.fill.fore_color.rgb = rgb(color)
    if alpha is not None:
        spPr = shape._element.spPr
        sf = spPr.find(qn("a:solidFill"))
        srgb = sf.find(qn("a:srgbClr"))
        a = etree.SubElement(srgb, qn("a:alpha"))
        a.set("val", str(int(alpha * 1000)))


def no_line(shape):
    shape.line.fill.background()


def stroke(shape, color: str = LINE, width: float = 0.75):
    shape.line.color.rgb = rgb(color)
    shape.line.width = Pt(width)


def rounded(slide, x, y, w, h, *, fill=SURF, line=LINE, radius=0.06,
            alpha=None, name=None, lw=0.75):
    s = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(x), Inches(y),
                               Inches(w), Inches(h))
    try:
        s.adjustments[0] = radius
    except Exception:
        pass
    solid(s, fill, alpha)
    if line is None:
        no_line(s)
    else:
        stroke(s, line, lw)
    s.shadow.inherit = False
    if name:
        s.name = name
    return s


def rect(slide, x, y, w, h, *, fill=SURF, line=None, alpha=None, name=None):
    s = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(x), Inches(y), Inches(w), Inches(h))
    solid(s, fill, alpha)
    if line is None:
        no_line(s)
    else:
        stroke(s, line)
    s.shadow.inherit = False
    if name:
        s.name = name
    return s


def oval(slide, x, y, w, h, *, fill=BRAND, alpha=None, line=None):
    s = slide.shapes.add_shape(MSO_SHAPE.OVAL, Inches(x), Inches(y), Inches(w), Inches(h))
    solid(s, fill, alpha)
    if line is None:
        no_line(s)
    else:
        stroke(s, line)
    s.shadow.inherit = False
    return s


def textbox(slide, x, y, w, h, *, anchor=MSO_ANCHOR.TOP, margins=(0, 0, 0, 0), name=None):
    box = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = box.text_frame
    tf.word_wrap = True
    tf.vertical_anchor = anchor
    tf.margin_left, tf.margin_right, tf.margin_top, tf.margin_bottom = (
        Emu(int(margins[0] * 914400)), Emu(int(margins[1] * 914400)),
        Emu(int(margins[2] * 914400)), Emu(int(margins[3] * 914400)))
    box.name = name or "A99"
    return box, tf


def run(p, text, *, size=13, color=WHITE, bold=False, font=FONT, italic=False, spc=None):
    r = p.add_run()
    r.text = text
    r.font.name = font
    r.font.size = Pt(size)
    r.font.bold = bold
    r.font.italic = italic
    r.font.color.rgb = rgb(color)
    if spc is not None:
        r._r.get_or_add_rPr().set("spc", str(spc))
    return r


def par(tf, *, first=False, align=PP_ALIGN.LEFT, line=1.05, before=0, after=0,
        bullet=None, indent=0.0, level_indent=0.0):
    p = tf.paragraphs[0] if first else tf.add_paragraph()
    p.alignment = align
    p.line_spacing = line
    p.space_before = Pt(before)
    p.space_after = Pt(after)
    if bullet:
        pPr = p._p.get_or_add_pPr()
        pPr.set("marL", str(int((indent + 0.22) * 914400)))
        pPr.set("indent", str(int(-0.22 * 914400)))
        bu = etree.SubElement(pPr, qn("a:buChar"))
        bu.set("char", bullet)
        buFont = etree.SubElement(pPr, qn("a:buFont"))
        buFont.set("typeface", "Segoe UI")
    return p


def title_block(slide, kicker: str, title: str, *, sub: str | None = None,
                title_size=29):
    _, tf = textbox(slide, ML, 0.40, 11.9, 0.3, name="A01")
    p = par(tf, first=True, line=1.0)
    run(p, kicker.upper(), size=10.5, color=BRAND, bold=True, spc=180)

    _, tf = textbox(slide, ML, 0.66, 11.9, 0.62, name="A02")
    p = par(tf, first=True, line=0.95)
    run(p, title, size=title_size, color=WHITE, bold=True)

    if sub:
        _, tf = textbox(slide, ML, 1.30, 11.4, 0.34, name="A03")
        p = par(tf, first=True, line=1.0)
        run(p, sub, size=12, color=MUTED)

    bar = rect(slide, ML, 1.40 if not sub else 1.66, 0.92, 0.05, fill=BRAND)
    bar.name = "A03"


def footer(slide, n: int, total: int = 14):
    ln = rect(slide, ML, 6.94, SW - 2 * ML, 0.008, fill=ELEV)
    ln.name = "A98"
    _, tf = textbox(slide, ML, 7.00, 7.4, 0.26)
    p = par(tf, first=True, line=1.0)
    run(p, "PXU Cinema  ·  Báo cáo đồ án  ·  Web Front End nâng cao", size=8.5, color=DIM)
    _, tf = textbox(slide, 10.9, 7.00, 1.7, 0.26)
    p = par(tf, first=True, align=PP_ALIGN.RIGHT, line=1.0)
    run(p, f"{n:02d}", size=9, color=BRAND, bold=True)
    run(p, f"  /  {total}", size=9, color=DIM)


def chip(slide, x, y, w, h, text, *, fill=SURF2, color=SOFT, size=10,
         border=LINE, bold=False, name=None):
    s = rounded(slide, x, y, w, h, fill=fill, line=border, radius=0.35, name=name)
    tf = s.text_frame
    tf.word_wrap = False
    tf.margin_left = tf.margin_right = Emu(int(0.10 * 914400))
    tf.margin_top = tf.margin_bottom = Emu(0)
    tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    p = tf.paragraphs[0]
    p.alignment = PP_ALIGN.CENTER
    p.line_spacing = 1.0
    run(p, text, size=size, color=color, bold=bold)
    return s


def crop_to(src: Path, dst: Path, aspect: float, width_px: int = 1600,
            focus: float = 0.5) -> Path:
    im = Image.open(src).convert("RGB")
    w, h = im.size
    if abs(w / h - aspect) > 0.01:
        if w / h > aspect:
            nw = int(h * aspect)
            left = int((w - nw) * focus)
            im = im.crop((left, 0, left + nw, h))
        else:
            nh = int(w / aspect)
            top = (h - nh) // 2
            im = im.crop((0, top, w, top + nh))
    height_px = int(width_px / aspect)
    im = im.resize((width_px, height_px), Image.LANCZOS)
    dst.parent.mkdir(parents=True, exist_ok=True)
    im.save(dst, quality=92)
    return dst


def framed_picture(slide, name: str, x, y, w, h, *, caption=None, cap_size=9.5,
                   frame=True, shadow=True, focus=0.5):
    TMP.mkdir(exist_ok=True)
    dst = TMP / f"{name}_{int(w*100)}x{int(h*100)}_{int(focus*100)}.jpg"
    crop_to(FIGS / f"{name}.png", dst, w / h, focus=focus)
    if shadow:
        glow = rounded(slide, x - 0.06, y + 0.09, w + 0.12, h + 0.12,
                       fill="1E293B", line=None, alpha=14, radius=0.04)
        glow.name = "A97"
    if frame:
        fr = rounded(slide, x - 0.055, y - 0.055, w + 0.11, h + 0.11,
                     fill=ELEV, line=LINE, radius=0.035)
        fr.name = "A97"
    pic = slide.shapes.add_picture(str(dst), Inches(x), Inches(y), Inches(w), Inches(h))
    pic.name = "A50"
    if caption:
        _, tf = textbox(slide, x, y + h + 0.12, w, 0.3, name="A51")
        p = par(tf, first=True, line=1.0)
        run(p, caption, size=cap_size, color=MUTED, italic=True)
    return pic


def arrow(slide, x1, y1, x2, y2, *, color=BRAND, width=1.5):
    c = slide.shapes.add_connector(MSO_CONNECTOR.STRAIGHT, Inches(x1), Inches(y1),
                                   Inches(x2), Inches(y2))
    c.line.color.rgb = rgb(color)
    c.line.width = Pt(width)
    ln = c.line._get_or_add_ln()
    tail = etree.SubElement(ln, qn("a:tailEnd"))
    tail.set("type", "triangle")
    tail.set("w", "med")
    tail.set("len", "med")
    return c


def down_arrow(slide, x, y, h=0.34, color=BRAND):
    s = slide.shapes.add_shape(MSO_SHAPE.DOWN_ARROW, Inches(x - 0.055), Inches(y),
                               Inches(0.11), Inches(h))
    solid(s, color)
    no_line(s)
    s.shadow.inherit = False
    return s


def stat(slide, x, y, w, number, label, *, color=BRAND, num_size=30, label_size=9.5):
    _, tf = textbox(slide, x, y, w, 0.52, name="A20")
    p = par(tf, first=True, line=0.9)
    run(p, number, size=num_size, color=color, bold=True)
    _, tf = textbox(slide, x, y + 0.50, w, 0.34, name="A21")
    p = par(tf, first=True, line=1.0)
    run(p, label, size=label_size, color=MUTED)


# ------------------------------------------------------------------- slides
def slide_cover(prs):
    s = new_slide(prs)
    # right image, full bleed
    cover = TMP / "cover.jpg"
    crop_to(FIGS / "01-home.png", cover, 6.15 / SH, focus=0.10)
    pic = s.shapes.add_picture(str(cover), Inches(7.18), 0, Inches(6.15), Inches(SH))
    pic.name = "A05"
    # smooth fade from the screenshot into the paper background
    fade_path = TMP / "fade.png"
    fw, fh = 520, 1200
    fade = Image.new("RGBA", (fw, fh))
    base_rgb = tuple(int(BASE[i:i+2], 16) for i in (0, 2, 4))
    for x in range(fw):
        alpha = int(255 * (1 - x / (fw - 1)) ** 1.15)
        fade.paste((*base_rgb, alpha), (x, 0, x + 1, fh))
    fade.save(fade_path)
    s.shapes.add_picture(str(fade_path), Inches(7.18), 0, Inches(1.15), Inches(SH)).name = "A04"

    oval(s, -1.8, -2.2, 5.2, 5.2, fill=BRAND, alpha=7)
    oval(s, 5.4, 5.4, 3.2, 3.2, fill=BLUE, alpha=5)

    # logo sits directly on the light paper
    s.shapes.add_picture(str(LOGO), Inches(ML), Inches(0.52), Inches(0.70),
                         Inches(0.70 * 0.905)).name = "A06"

    _, tf = textbox(s, ML + 0.96, 0.62, 5.4, 0.26, name="A07")
    p = par(tf, first=True, line=1.0)
    run(p, "TRƯỜNG ĐẠI HỌC PHÚ XUÂN", size=8.5, color=BRAND, bold=True, spc=140)
    _, tf = textbox(s, ML + 0.96, 0.86, 5.4, 0.26, name="A07")
    p = par(tf, first=True, line=1.0)
    run(p, "BÁO CÁO ĐỒ ÁN KẾT THÚC HỌC PHẦN", size=8, color=MUTED, bold=True, spc=100)

    _, tf = textbox(s, ML, 1.72, 6.3, 1.15, name="A09")
    p = par(tf, first=True, line=0.9)
    run(p, "PXU", size=66, color=WHITE, bold=True, spc=60)
    run(p, " CINEMA", size=66, color=BRAND, bold=True, spc=40)

    _, tf = textbox(s, ML, 2.92, 6.2, 0.62, name="A10")
    p = par(tf, first=True, line=1.05)
    run(p, "Hệ thống đặt vé và quản lý rạp chiếu phim", size=21, color=SOFT, bold=True)

    _, tf = textbox(s, ML, 3.62, 5.95, 0.72, name="A11")
    p = par(tf, first=True, line=1.3)
    run(p, "Máy chủ là nguồn sự thật duy nhất cho giá, tồn ghế, trạng thái đơn\nvà quyền truy cập — giao diện chỉ hiển thị và thu thập đầu vào.",
        size=11.5, color=MUTED)

    # stat chips
    xs = ML
    for val, label, w in (("158", "hàm nghiệp vụ", 1.86), ("56", "tuyến giao diện", 1.86),
                          ("29", "bảng dữ liệu", 1.86)):
        c = rounded(s, xs, 4.62, w, 0.74, fill=SURF2, line=LINE, radius=0.10)
        tf = c.text_frame
        tf.word_wrap = True
        tf.margin_left = Emu(int(0.16 * 914400))
        tf.margin_right = Emu(int(0.06 * 914400))
        tf.vertical_anchor = MSO_ANCHOR.MIDDLE
        p = tf.paragraphs[0]
        p.alignment = PP_ALIGN.LEFT
        p.line_spacing = 0.95
        run(p, val, size=19, color=BRAND, bold=True)
        p = tf.add_paragraph()
        p.alignment = PP_ALIGN.LEFT
        p.line_spacing = 0.95
        run(p, label, size=8.5, color=MUTED)
        xs += w + 0.15

    # author block
    _, tf = textbox(s, ML, 5.62, 4.9, 0.95, name="A12")
    p = par(tf, first=True, line=1.5)
    run(p, "GVHD:  ", size=10, color=DIM, bold=True)
    run(p, "Trương Ngọc Duy", size=11.5, color=WHITE, bold=True)
    p = par(tf, line=1.5)
    run(p, "SVTH:  ", size=10, color=DIM, bold=True)
    run(p, "Nguyễn Văn Bin", size=11.5, color=WHITE, bold=True)

    _, tf = textbox(s, ML, 6.62, 5.2, 0.3, name="A13")
    p = par(tf, first=True, line=1.0)
    run(p, "TP. Huế  ·  tháng 11 năm 2026", size=10, color=BRAND, bold=True, spc=60)

    rect(s, 0, 7.10, 7.18, 0.02, fill=ELEV)
    return s


def slide_problem(prs):
    s = new_slide(prs)
    title_block(s, "01 · Bài toán", "Năm điều hệ thống không được làm sai",
                sub="Một suất chiếu gắn với một phim, một phòng và một khung giờ; mỗi ghế chỉ bán được một lần cho đúng suất đó.")

    cards = [
        ("01", "Bán trùng ghế", "Hai khách bấm cùng lúc: một người giữ được, người kia nhận SEAT_UNAVAILABLE kèm ghế bị mất.", RED),
        ("02", "Tính sai tiền", "Tổng tiền, giảm giá và thuế do máy chủ quyết định; giao diện không tự cộng.", GOLD),
        ("03", "Giữ ghế vô hạn", "Hạn giữ 10 phút; quét hết hạn mỗi lần đọc dữ liệu và nhả ghế ngay.", BLUE),
        ("04", "Xác nhận khống", "Duyệt biên lai thật; băm ảnh SHA-256 để chặn gửi lại một chứng từ.", PINK),
        ("05", "Dùng lại mã QR", "Soát vé nguyên tử: mỗi vé chỉ đổi valid → used đúng một lần.", GREEN),
    ]
    y = 1.86
    for i, (num, name, desc, col) in enumerate(cards):
        card = rounded(s, ML, y, 7.55, 0.82, fill=SURF, line=LINE, radius=0.09, name=f"A2{i}")
        bar = rect(s, ML, y + 0.13, 0.045, 0.56, fill=col)
        bar.name = f"A2{i}"
        _, tf = textbox(s, ML + 0.20, y + 0.10, 0.52, 0.6, name=f"A2{i}")
        p = par(tf, first=True, line=1.0)
        run(p, num, size=20, color=col, bold=True)
        _, tf = textbox(s, ML + 0.80, y + 0.09, 6.5, 0.66, name=f"A2{i}")
        p = par(tf, first=True, line=1.05)
        run(p, name + "  ·  ", size=12.5, color=WHITE, bold=True)
        run(p, desc, size=10, color=MUTED)
        y += 0.94

    # right panel: old way
    panel = rounded(s, 8.55, 1.86, 4.05, 3.80, fill=SURF, line=LINE, radius=0.05, name="A32")
    _, tf = textbox(s, 8.82, 2.02, 3.55, 0.30, name="A33")
    p = par(tf, first=True, line=1.0)
    run(p, "CÁCH VẬN HÀNH CŨ", size=9, color=BRAND, bold=True, spc=140)

    items = [
        "Tồn ghế hai nguồn: quầy và online giữ bảng riêng.",
        "Găm ghế: giữ rồi bỏ đi, không ai nhả.",
        "Đối soát sao kê bằng mắt, không có chỗ ghi lệch.",
        "Soát vé bằng ảnh chụp màn hình.",
    ]
    _, tf = textbox(s, 8.82, 2.36, 3.55, 3.1, name="A34")
    first = True
    for t in items:
        p = par(tf, first=first, line=1.3, before=0 if first else 11, bullet="—", indent=0.0)
        run(p, t, size=11, color=SOFT)
        first = False

    _, tf = textbox(s, 8.82, 4.72, 3.55, 0.74, name="A35")
    p = par(tf, first=True, line=1.2)
    run(p, "Ba điểm nghẽn đầu là bài toán dữ liệu: chỉ giải được khi ghế, hạn giữ và trạng thái được mô hình hóa đúng.",
        size=9, color=SOFT, italic=True)

    band = rounded(s, 8.55, 5.90, 4.05, 0.78, fill=ELEV, line=BRAND, radius=0.07, lw=1.0)
    tf = band.text_frame
    tf.word_wrap = True
    tf.margin_left = tf.margin_right = Emu(int(0.14 * 914400))
    tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    p = tf.paragraphs[0]
    p.alignment = PP_ALIGN.LEFT
    p.line_spacing = 1.1
    run(p, "Máy chủ quyết định tất cả", size=10.5, color=BRAND, bold=True)
    p = tf.add_paragraph()
    p.line_spacing = 1.05
    run(p, "Giá · tồn ghế · trạng thái · quyền · thời hạn", size=9, color=SOFT)

    footer(s, 2)
    return s


def slide_roles(prs):
    s = new_slide(prs)
    title_block(s, "02 · Phạm vi", "Năm vai trò, mười hai phân hệ, một nguồn sự thật",
                sub="Khách vãng lai không cần tài khoản; mọi vai trò còn lại được kiểm tra quyền ở máy chủ cho từng yêu cầu.")

    roles = [
        ("GUEST", "Khách vãng lai", "Xem phim, lịch chiếu, rạp, bắp nước. Không giữ ghế.", DIM),
        ("CUSTOMER", "Khách hàng", "Đặt vé, chọn ghế, voucher, VietQR, vé điện tử, điểm thưởng.", BLUE),
        ("STAFF", "Nhân viên", "POS tại quầy, mở/đóng ca, soát QR, in lại vé.", GREEN),
        ("MANAGER", "Quản lý rạp", "Duyệt biên lai, hoàn tiền, dời/hủy suất, báo cáo.", GOLD),
        ("ADMIN", "Quản trị", "Toàn quyền: phim, phòng, ghế, giá, người dùng, cấu hình, nhật ký.", BRAND),
    ]
    x = ML
    w = 2.36
    for i, (tag, name, desc, col) in enumerate(roles):
        c = rounded(s, x, 1.92, w, 2.28, fill=SURF, line=LINE, radius=0.06, name=f"A4{i}")
        rect(s, x, 1.92, w, 0.05, fill=col)
        _, tf = textbox(s, x + 0.20, 2.10, w - 0.4, 0.26, name=f"A4{i}")
        p = par(tf, first=True, line=1.0)
        run(p, tag, size=8, color=col, bold=True, spc=160)
        _, tf = textbox(s, x + 0.20, 2.40, w - 0.4, 0.34, name=f"A4{i}")
        p = par(tf, first=True, line=1.0)
        run(p, name, size=13.5, color=WHITE, bold=True)
        _, tf = textbox(s, x + 0.20, 2.80, w - 0.38, 1.25, name=f"A4{i}")
        p = par(tf, first=True, line=1.2)
        run(p, desc, size=9.5, color=MUTED)
        x += w + 0.135

    # stats strip
    strip = [
        ("12", "phân hệ M01–M12", BRAND),
        ("5", "vai trò", BLUE),
        ("77", "điểm kiểm tra quyền", GREEN),
        ("29", "bảng dữ liệu", GOLD),
    ]
    x = ML
    for num, label, col in strip:
        c = rounded(s, x, 4.44, 2.86, 0.78, fill=SURF2, line=LINE, radius=0.08)
        tf = c.text_frame
        tf.margin_left = Emu(int(0.18 * 914400))
        tf.vertical_anchor = MSO_ANCHOR.MIDDLE
        p = tf.paragraphs[0]
        p.line_spacing = 1.0
        run(p, num + "   ", size=19, color=col, bold=True)
        run(p, label, size=10, color=SOFT)
        x += 2.86 + 0.135

    # scope
    inc = rounded(s, ML, 5.42, 5.92, 1.32, fill=SURF, line=LINE, radius=0.06)
    _, tf = textbox(s, ML + 0.22, 5.54, 5.5, 0.28, name="A60")
    p = par(tf, first=True, line=1.0)
    run(p, "TRONG PHẠM VI", size=8.5, color=GREEN, bold=True, spc=140)
    _, tf = textbox(s, ML + 0.22, 5.84, 5.5, 0.78, name="A61")
    p = par(tf, first=True, line=1.2)
    run(p, "Bán vé online + POS · phim, suất chiếu, phòng, sơ đồ ghế · combo · voucher · giữ ghế · QR + duyệt biên lai · vé điện tử · soát vé · hoàn tiền · báo cáo · nhật ký.",
        size=9.5, color=SOFT)

    out = rounded(s, 6.82, 5.42, 5.78, 1.32, fill=SURF, line=LINE, radius=0.06)
    _, tf = textbox(s, 7.04, 5.54, 5.3, 0.28, name="A62")
    p = par(tf, first=True, line=1.0)
    run(p, "NGOÀI PHẠM VI (ghi rõ)", size=8.5, color=RED, bold=True, spc=140)
    _, tf = textbox(s, 7.04, 5.84, 5.35, 0.78, name="A63")
    p = par(tf, first=True, line=1.2)
    run(p, "Cổng thanh toán thật (VNPay/MoMo) · webhook ngân hàng · hóa đơn điện tử · email/SMS queue · app native · kế toán tổng hợp.",
        size=9.5, color=MUTED)

    footer(s, 3)
    return s


def slide_arch(prs):
    s = new_slide(prs)
    title_block(s, "03 · Kiến trúc", "Một đường vào API, một nguồn sự thật",
                sub="Ba thứ không bao giờ được tính ở trình duyệt: tổng tiền, danh sách ghế trống và danh sách hành động hợp lệ.")

    x0, w0 = ML, 7.7
    layers = [
        ("TRÌNH DUYỆT", "React 18.3 · React Router 6.28 · TanStack Query 5 · Zustand 5",
         "56 tuyến, lazy theo khu vực · 4 khung: khách, đặt vé, nhân viên, quản trị", BLUE),
        ("API", "POST /api/rpc  { fn, args }  →  Express 5",
         "Phong bì { data } hoặc { error: code, message, details, status }", BRAND),
        ("NGHIỆP VỤ", "158 hàm · engine TypeScript dùng chung",
         "Ghi tuần tự · kiểm tra quyền · chụp giá · chuyển trạng thái nguyên tử", GOLD),
        ("DỮ LIỆU", "MySQL / MariaDB 8 · mysql2 3.24",
         "29 bảng · row_key kỹ thuật + cột JSON json_valid · unique code", GREEN),
    ]
    y = 1.90
    for i, (tag, main, sub, col) in enumerate(layers):
        box = rounded(s, x0, y, w0, 0.96, fill=SURF, line=LINE, radius=0.07, name=f"A7{i}")
        rect(s, x0, y + 0.12, 0.05, 0.72, fill=col)
        _, tf = textbox(s, x0 + 0.22, y + 0.12, 1.30, 0.24, name=f"A7{i}")
        p = par(tf, first=True, line=1.0)
        run(p, tag, size=8, color=col, bold=True, spc=150)
        _, tf = textbox(s, x0 + 0.22, y + 0.34, w0 - 0.45, 0.26, name=f"A7{i}")
        p = par(tf, first=True, line=1.0)
        run(p, main, size=12.5, color=WHITE, bold=True)
        _, tf = textbox(s, x0 + 0.22, y + 0.62, w0 - 0.45, 0.26, name=f"A7{i}")
        p = par(tf, first=True, line=1.0)
        run(p, sub, size=9, color=MUTED)
        if i < 3:
            down_arrow(s, x0 + 1.55, y + 1.00, 0.20)
        y += 1.22

    # right principle cards
    cards = [
        ("Không tính ở trình duyệt", "Tiền, ghế trống và các hành động hợp lệ đều do máy chủ trả về.", BLUE),
        ("Một phong bì lỗi", "Mã lỗi ổn định + thông điệp tiếng Việt + hành vi giao diện xác định.", BRAND),
        ("Ghi tuần tự", "Hai yêu cầu giữ cùng một ghế không thể chen giữa kiểm tra và ghi.", GOLD),
    ]
    y = 1.90
    for i, (t, d, col) in enumerate(cards):
        box = rounded(s, 8.75, y, 3.86, 1.06, fill=SURF, line=LINE, radius=0.07, name=f"A80")
        rect(s, 8.75, y, 0.05, 1.06, fill=col)
        _, tf = textbox(s, 8.98, y + 0.14, 3.45, 0.28, name=f"A81")
        p = par(tf, first=True, line=1.0)
        run(p, t, size=11.5, color=WHITE, bold=True)
        _, tf = textbox(s, 8.98, y + 0.44, 3.45, 0.52, name=f"A82")
        p = par(tf, first=True, line=1.2)
        run(p, d, size=9, color=MUTED)
        y += 1.22

    # bottom stats
    stats = [("158", "hàm nghiệp vụ", BRAND), ("56", "tuyến", BLUE),
             ("29", "bảng", GREEN), ("32.5k", "dòng frontend", GOLD)]
    x = 8.75
    for num, label, col in stats:
        _, tf = textbox(s, x, 5.62, 0.9, 0.5, name="A90")
        p = par(tf, first=True, line=0.9)
        run(p, num, size=19, color=col, bold=True)
        _, tf = textbox(s, x, 6.10, 0.98, 0.3, name="A91")
        p = par(tf, first=True, line=1.0)
        run(p, label, size=8, color=MUTED)
        x += 0.98

    footer(s, 4)
    return s


def slide_booking(prs):
    s = new_slide(prs)
    title_block(s, "04 · Luồng trung tâm", "Tám bước từ chọn phim đến vé điện tử",
                sub="Luồng đặt vé là nơi hội tụ gần như toàn bộ quy tắc nghiệp vụ: ghế, tiền, hạn giữ và trạng thái.")

    steps = [
        ("1", "Chọn phim, rạp, ngày, suất", "Chỉ suất đang mở bán; mỗi nút giờ ghi giá thấp nhất và số ghế còn."),
        ("2", "Mở sơ đồ ghế", "Bảy trạng thái ghế; giá từng ghế đã gồm phụ thu loại ghế."),
        ("3", "Chọn tối đa 8 ghế", "Ghế đôi chọn theo cặp; phim T16/T18 xác nhận đủ tuổi."),
        ("4", "Tạo đơn holding", "Khóa ghế + hạn giữ; mất ghế trả SEAT_UNAVAILABLE kèm danh sách."),
        ("5", "Thêm combo", "Mỗi thay đổi gọi máy chủ tính lại tổng; giao diện không tự cộng."),
        ("6", "Voucher, điểm, liên hệ", "Kiểm tra lại voucher trước khi chốt để tránh hết lượt."),
        ("7", "Thanh toán", "Chốt đơn, sinh VietQR; đơn vẫn giữ ghế đến khi duyệt hoặc hết hạn."),
        ("8", "Tải biên lai", "Chờ duyệt; duyệt xong phát hành mỗi ghế một vé + thông báo."),
    ]
    x0, y0 = ML, 1.94
    cw, ch = 3.47, 1.10
    for i, (n, t, d) in enumerate(steps):
        col = i % 2
        row = i // 2
        x = x0 + col * (cw + 0.16)
        y = y0 + row * (ch + 0.14)
        card = rounded(s, x, y, cw, ch, fill=SURF, line=LINE, radius=0.07, name=f"A6{i}")
        _, tf = textbox(s, x + 0.16, y + 0.11, 0.36, 0.28, name=f"A6{i}")
        p = par(tf, first=True, line=1.0)
        run(p, n, size=15, color=BRAND, bold=True)
        _, tf = textbox(s, x + 0.54, y + 0.10, cw - 0.7, 0.26, name=f"A6{i}")
        p = par(tf, first=True, line=1.0)
        run(p, t, size=9.6, color=WHITE, bold=True)
        _, tf = textbox(s, x + 0.16, y + 0.40, cw - 0.31, 0.62, name=f"A6{i}")
        p = par(tf, first=True, line=1.14)
        run(p, d, size=8.0, color=MUTED)

    framed_picture(s, "04-seats", 8.14, 1.94, 4.43, 2.77,
                   caption="Chọn ghế — lưới ô, bảy trạng thái, tóm tắt đơn dính đáy")

    note = rounded(s, 8.14, 5.18, 4.43, 1.46, fill=SURF2, line=LINE, radius=0.06)
    _, tf = textbox(s, 8.34, 5.28, 4.05, 0.24, name="A70")
    p = par(tf, first=True, line=1.0)
    run(p, "NGOẠI LỆ CÓ HÀNH VI XÁC ĐỊNH", size=7.6, color=BRAND, bold=True, spc=110)
    _, tf = textbox(s, 8.34, 5.54, 4.05, 1.0, name="A71")
    first = True
    for t in ("Hết hạn giữ ghế → đơn expired, ghế được nhả.",
              "Ghế vừa bị giữ → tô đỏ đúng ghế, yêu cầu chọn lại.",
              "Voucher sai → báo lý do, không chặn đặt vé."):
        p = par(tf, first=first, line=1.18, before=0 if first else 4, bullet="·")
        run(p, t, size=8.4, color=SOFT)
        first = False

    footer(s, 5)
    return s


def slide_hold(prs):
    s = new_slide(prs)
    title_block(s, "05 · Giữ ghế", "Đồng hồ máy chủ, không phải đồng hồ trình duyệt",
                sub="Giữ ghế không đọc rồi ghi hai bước: kiểm tra và khóa ghế nằm trong cùng một lần ghi tuần tự.")

    stats = [("10'", "hạn giữ mặc định", BRAND), ("8", "ghế tối đa / đơn", BLUE),
             ("3", "đơn giữ đồng thời", GOLD), ("5'", "gia hạn một lần", GREEN)]
    x = ML
    for num, label, col in stats:
        stat(s, x, 1.88, 1.55, num, label, color=col, num_size=27)
        x += 1.62

    rules = [
        ("Một lần ghi duy nhất", "Kiểm tra suất mở bán, giới hạn ghế, ghế chưa thuộc đơn hiệu lực rồi tạo holding + khóa ghế.", BRAND),
        ("Ảnh chụp giá", "Giá ghế và tên combo chụp vào đơn tại thời điểm tạo; đổi bảng giá sau đó không làm lệch đơn cũ.", GOLD),
        ("Độ lệch giờ máy chủ", "Mỗi phản hồi mang giờ máy chủ; giao diện lưu offset và tính lại khi tab bị ngủ.", BLUE),
        ("Quét hết hạn", "Đơn holding quá hạn → expired, nhả ghế, trả lượt voucher, gửi thông báo.", GREEN),
    ]
    y = 2.78
    for i, (t, d, col) in enumerate(rules):
        box = rounded(s, ML, y, 6.55, 0.84, fill=SURF, line=LINE, radius=0.07, name=f"A8{i}")
        rect(s, ML, y + 0.12, 0.045, 0.60, fill=col)
        _, tf = textbox(s, ML + 0.20, y + 0.10, 6.05, 0.28, name=f"A8{i}")
        p = par(tf, first=True, line=1.0)
        run(p, t, size=11, color=WHITE, bold=True)
        _, tf = textbox(s, ML + 0.20, y + 0.38, 6.05, 0.42, name=f"A8{i}")
        p = par(tf, first=True, line=1.15)
        run(p, d, size=8.8, color=MUTED)
        y += 0.94

    framed_picture(s, "07-payment", 7.62, 1.90, 4.98, 3.11,
                   caption="Thanh toán — VietQR, sao chép từng trường, đồng hồ giữ ghế")

    # countdown bar
    track = rounded(s, 7.62, 5.62, 4.98, 0.10, fill=ELEV, line=None, radius=0.5)
    fill = rounded(s, 7.62, 5.62, 3.9, 0.10, fill=BRAND, line=None, radius=0.5)
    warn = rounded(s, 11.02, 5.54, 0.08, 0.26, fill=RED, line=None, radius=0.5)
    _, tf = textbox(s, 7.62, 5.84, 4.98, 0.7, name="A88")
    p = par(tf, first=True, line=1.15)
    run(p, "Còn dưới 2 phút → đồng hồ chuyển màu cảnh báo và chỉ nhắc một lần. ", size=9, color=SOFT)
    run(p, "Hết giờ → hộp thoại chặn, hỏi lại máy chủ trước khi cho chọn ghế.", size=9, color=MUTED)

    footer(s, 6)
    return s


def slide_payment(prs):
    s = new_slide(prs)
    title_block(s, "06 · Thanh toán", "VietQR và duyệt biên lai có kiểm soát",
                sub="Chưa nối cổng ngân hàng: hệ thống sinh QR, nhận ảnh chứng từ và chờ người duyệt theo SLA.")

    pipeline = [
        ("1", "Sinh VietQR", "Số tiền + nội dung PXU-YYMMDD-XXXXXX; mã hóa từng thành phần chuỗi."),
        ("2", "Tải biên lai", "JPG/PNG/WebP ≤ 5 MB; kiểm tra định dạng và dung lượng hai phía."),
        ("3", "Băm SHA-256", "Một ảnh chỉ dùng cho một đơn; ảnh trùng trả PAYMENT_PROOF_DUPLICATE."),
        ("4", "Chờ duyệt", "SLA 60 phút, nhưng không vượt quá 30 phút trước giờ chiếu."),
        ("5", "Duyệt", "paid → phát hành vé, cộng điểm, ghi lượt voucher, ghi nhật ký người duyệt."),
    ]
    y = 1.86
    for i, (n, t, d) in enumerate(pipeline):
        row = rounded(s, ML, y, 6.75, 0.80, fill=SURF if i % 2 == 0 else SURF, line=LINE, radius=0.07, name=f"A8{i}")
        circ = oval(s, ML + 0.14, y + 0.18, 0.42, 0.42, fill=ELEV, line=BRAND)
        tf = circ.text_frame
        tf.margin_left = tf.margin_right = Emu(0)
        tf.margin_top = tf.margin_bottom = Emu(0)
        tf.vertical_anchor = MSO_ANCHOR.MIDDLE
        p = tf.paragraphs[0]
        p.alignment = PP_ALIGN.CENTER
        p.line_spacing = 1.0
        run(p, n, size=11, color=BRAND, bold=True)
        _, tf = textbox(s, ML + 0.72, y + 0.10, 5.8, 0.26, name=f"A8{i}")
        p = par(tf, first=True, line=1.0)
        run(p, t, size=11, color=WHITE, bold=True)
        _, tf = textbox(s, ML + 0.72, y + 0.36, 5.85, 0.38, name=f"A8{i}")
        p = par(tf, first=True, line=1.1)
        run(p, d, size=8.6, color=MUTED)
        y += 0.885

    framed_picture(s, "10-admin-receipts", 7.70, 1.82, 4.90, 3.06,
                   caption="Hàng đợi duyệt — ảnh chứng từ, đối chiếu số tiền, hạn SLA")

    _, tf = textbox(s, 7.70, 5.36, 4.9, 0.24, name="A92")
    p = par(tf, first=True, line=1.0)
    run(p, "LÝ DO TỪ CHỐI BẮT BUỘC CHỌN", size=7.8, color=BRAND, bold=True, spc=100)
    reasons = ["Ảnh mờ", "Sai số tiền", "Sai nội dung", "Chưa nhận tiền", "Khác"]
    x = 7.70
    for r in reasons:
        w = 0.72 if len(r) <= 8 else 0.98
        w = 0.86 if r == "Ảnh mờ" else w
        chip(s, x, 5.62, w, 0.30, r, size=7.6, fill=SURF2, border=LINE, color=SOFT)
        x += w + 0.08

    _, tf = textbox(s, 7.70, 6.06, 4.90, 0.76, name="A93")
    p = par(tf, first=True, line=1.2)
    run(p, "Duyệt hoặc từ chối đều ghi nhật ký kèm người thực hiện. ", size=8.6, color=SOFT)
    run(p, "Biên lai bị từ chối → khách gửi lại trong thời gian còn lại; quá hạn → đơn expired và nhả ghế.",
        size=8.6, color=MUTED)

    footer(s, 7)
    return s


def slide_ticket(prs):
    s = new_slide(prs)
    title_block(s, "07 · Vé & soát vé", "Mỗi ghế một vé, mỗi vé một lần vào",
                sub="Vé điện tử sinh ra từ đơn đã thanh toán; soát vé là thao tác nguyên tử và mọi lần quét đều được ghi log.")

    facts = [
        ("32", "ký tự mã vé, loại 0/O/1/I", BRAND),
        ("5", "nhóm kết quả soát vé", BLUE),
        ("1", "lần valid → used / vé", GREEN),
        ("100%", "lần quét được ghi log", GOLD),
    ]
    x = ML
    for num, label, col in facts:
        w = 2.98
        c = rounded(s, x, 1.82, w, 0.72, fill=SURF, line=LINE, radius=0.07)
        tf = c.text_frame
        tf.margin_left = Emu(int(0.18 * 914400))
        tf.vertical_anchor = MSO_ANCHOR.MIDDLE
        p = tf.paragraphs[0]
        p.line_spacing = 1.0
        run(p, num + "  ", size=18, color=col, bold=True)
        run(p, label, size=9, color=SOFT)
        x += w + 0.13

    framed_picture(s, "08-ticket", ML, 2.68, 5.28, 3.20,
                   caption="Vé điện tử — một vé mỗi ghế, QR chỉ chứa mã vé")
    framed_picture(s, "16-staff-scanner", 6.28, 2.68, 5.28, 3.20,
                   caption="Soát vé — nhập tay hoặc quét QR, lịch sử quét")

    _, tf = textbox(s, 6.28, 6.42, 5.28, 0.46, name="A94")
    p = par(tf, first=True, line=1.15)
    run(p, "Hai máy quét đồng thời: ", size=8.8, color=BRAND, bold=True)
    run(p, "chỉ một máy nhận OK, máy kia nhận ALREADY_USED kèm giờ và người đã soát trước đó.",
        size=8.8, color=SOFT)

    footer(s, 8)
    return s


def slide_states(prs):
    s = new_slide(prs)
    title_block(s, "08 · Máy trạng thái", "Chỉ máy chủ được chuyển trạng thái",
                sub="Một chuyển đổi không có trong bảng bị từ chối với BOOKING_INVALID_STATE; mọi lần chuyển ghi thời điểm và người thực hiện.")

    def state(x, y, w, label, desc, col, fill=SURF):
        b = rounded(s, x, y, w, 0.82, fill=fill, line=col, radius=0.10, lw=1.25)
        tf = b.text_frame
        tf.margin_left = tf.margin_right = Emu(int(0.06 * 914400))
        tf.vertical_anchor = MSO_ANCHOR.MIDDLE
        p = tf.paragraphs[0]
        p.alignment = PP_ALIGN.CENTER
        p.line_spacing = 1.0
        run(p, label, size=11.5, color=col, bold=True)
        p = tf.add_paragraph()
        p.alignment = PP_ALIGN.CENTER
        p.line_spacing = 1.0
        run(p, desc, size=7.6, color=MUTED)
        return b

    hy = 2.08
    state(0.85, hy, 1.70, "holding", "Đang giữ ghế", GOLD)
    state(3.25, hy, 1.70, "confirmed", "Đã thanh toán", GREEN)
    state(5.65, hy, 1.70, "completed", "Suất đã kết thúc", BLUE)
    state(0.85, hy + 1.98, 1.70, "expired", "Quá hạn giữ / chờ duyệt", RED)
    state(3.25, hy + 1.98, 1.70, "cancelled", "Khách · nhân viên · rạp", RED)

    arrow(s, 2.55, hy + 0.30, 3.23, hy + 0.30, color=GREEN)
    arrow(s, 4.95, hy + 0.30, 5.63, hy + 0.30, color=BLUE)
    arrow(s, 1.70, hy + 0.82, 1.70, hy + 1.96, color=RED)
    arrow(s, 2.45, hy + 0.66, 3.30, hy + 1.94, color=RED)
    arrow(s, 4.10, hy + 0.82, 4.10, hy + 1.96, color=RED)

    labels = [(2.55, hy + 0.46, 0.70, "duyệt tiền"), (4.95, hy + 0.46, 0.70, "kết thúc"),
              (1.82, hy + 1.24, 0.62, "quá hạn")]
    for lx, ly, lw, t in labels:
        _, tf = textbox(s, lx, ly, lw, 0.20, name="A95")
        p = par(tf, first=True, line=1.0, align=PP_ALIGN.CENTER)
        run(p, t, size=6.8, color=DIM)

    # side panels: other lifecycles
    panels = [
        ("Thanh toán", "pending → proof_submitted → paid · rejected · expired · refunded", GOLD),
        ("Vé", "valid → used · cancelled · expired (hoàn tác check-in phải có lý do)", GREEN),
        ("Suất chiếu", "scheduled → selling → closed → finished · cancelled", BLUE),
        ("Hoàn tiền", "requested → approved → processing → completed · rejected · failed", PINK),
    ]
    y = 1.94
    for i, (t, d, col) in enumerate(panels):
        box = rounded(s, 7.62, y, 5.00, 0.80, fill=SURF, line=LINE, radius=0.07, name=f"A9{i}")
        rect(s, 7.62, y, 0.045, 0.80, fill=col)
        _, tf = textbox(s, 7.84, y + 0.10, 4.55, 0.24, name=f"A9{i}")
        p = par(tf, first=True, line=1.0)
        run(p, t, size=10.5, color=WHITE, bold=True)
        _, tf = textbox(s, 7.84, y + 0.35, 4.55, 0.40, name=f"A9{i}")
        p = par(tf, first=True, line=1.1)
        run(p, d, size=8, color=MUTED)
        y += 0.88

    guard = rounded(s, 0.85, 5.66, 6.42, 0.80, fill=SURF2, line=LINE, radius=0.07)
    _, tf = textbox(s, 1.04, 5.80, 6.0, 0.56, name="A97")
    p = par(tf, first=True, line=1.15)
    run(p, "Mọi chuyển trạng thái: ", size=8.8, color=BRAND, bold=True)
    run(p, "một lần ghi nguyên tử · luôn kèm thời điểm và người thực hiện · thao tác sai trạng thái bị từ chối.",
        size=8.8, color=SOFT)

    # auto jobs note
    _, tf = textbox(s, 7.62, 5.56, 5.02, 1.10, name="A96")
    p = par(tf, first=True, line=1.25)
    run(p, "Tự động hóa: ", size=8.8, color=BRAND, bold=True)
    run(p, "hết hạn giữ ghế · hết hạn chờ duyệt · đóng bán · kết thúc suất · đồng bộ phim — "
           "chạy khi có truy cập dữ liệu, an toàn khi chạy lại, nhưng cần hàng đợi có khóa phân tán khi lên nhiều tiến trình.",
        size=8.8, color=SOFT)

    footer(s, 9)
    return s


def slide_admin(prs):
    s = new_slide(prs)
    title_block(s, "09 · Quản trị", "Bảng điều khiển trả lời câu hỏi của người quản lý",
                sub="/admin tự làm mới mỗi 60 giây: doanh thu, vé bán, tỷ lệ lấp đầy, đơn chờ duyệt, đơn hết hạn.")

    framed_picture(s, "09-admin-dashboard", ML, 1.90, 6.96, 4.35,
                   caption="Bảng điều khiển — KPI, doanh thu bảy ngày, top phim")

    items = [
        ("23", "màn hình quản trị", "Phim, suất chiếu, phòng, ghế, giá, combo, đơn, hoàn tiền, voucher, người dùng, nhật ký…", BRAND),
        ("8", "loại báo cáo + CSV", "Doanh thu · phim · suất chiếu · ca · voucher · hoàn tiền · khách hàng · bắp nước", BLUE),
        ("15'", "dọn phòng giữa suất", "Timeline theo phòng; chặn chồng lấn và thiếu thời gian dọn bằng SHOWTIME_OVERLAP", GOLD),
        ("60s", "chu kỳ tự làm mới", "Số liệu lấy từ máy chủ theo cùng một định nghĩa chỉ số, không từ bảng tính.", GREEN),
    ]
    y = 1.90
    for i, (num, t, d, col) in enumerate(items):
        box = rounded(s, 8.35, y, 4.25, 1.06, fill=SURF, line=LINE, radius=0.07, name=f"A7{i}")
        _, tf = textbox(s, 8.56, y + 0.13, 0.9, 0.46, name=f"A7{i}")
        p = par(tf, first=True, line=0.9)
        run(p, num, size=20, color=col, bold=True)
        _, tf = textbox(s, 9.50, y + 0.12, 3.0, 0.26, name=f"A7{i}")
        p = par(tf, first=True, line=1.0)
        run(p, t, size=10.5, color=WHITE, bold=True)
        _, tf = textbox(s, 9.50, y + 0.40, 2.98, 0.6, name=f"A7{i}")
        p = par(tf, first=True, line=1.12)
        run(p, d, size=8.3, color=MUTED)
        y += 1.16

    footer(s, 10)
    return s


def slide_data(prs):
    s = new_slide(prs)
    title_block(s, "10 · Dữ liệu", "29 bảng, sáu nhóm nghiệp vụ",
                sub="MySQL 8 theo hướng “tài liệu có lược đồ”: cột vô hướng để truy vấn, cột JSON json_valid giữ bản ghi đầy đủ.")

    groups = [
        ("Người dùng & bảo mật", "users · sessions · audit_logs · notifications", BLUE),
        ("Danh mục rạp", "cinemas · rooms · seats · movies · showtimes", GOLD),
        ("Bán hàng", "bookings · payments · tickets · checkin_logs · shifts", BRAND),
        ("Hoàn & ngoại lệ", "refunds · payment_exceptions", PINK),
        ("Marketing & thành viên", "vouchers · voucher_usages · point_transactions · membership_tiers", GREEN),
        ("Cấu hình & nội dung", "app_settings · static_pages · price_rules · combos", DIM),
    ]
    y = 1.88
    for i, (t, d, col) in enumerate(groups):
        box = rounded(s, ML, y, 6.15, 0.70, fill=SURF, line=LINE, radius=0.07, name=f"A6{i}")
        rect(s, ML, y, 0.045, 0.70, fill=col)
        _, tf = textbox(s, ML + 0.20, y + 0.09, 5.7, 0.24, name=f"A6{i}")
        p = par(tf, first=True, line=1.0)
        run(p, t, size=10, color=WHITE, bold=True)
        _, tf = textbox(s, ML + 0.20, y + 0.35, 5.7, 0.24, name=f"A6{i}")
        p = par(tf, first=True, line=1.0)
        run(p, d, size=8, color=MUTED)
        y += 0.78

    # ER diagram on the right
    def er(x, y, w, text, col=WHITE, fill=ELEV, size=9.5):
        b = rounded(s, x, y, w, 0.44, fill=fill, line=LINE, radius=0.22)
        tf = b.text_frame
        tf.margin_left = tf.margin_right = Emu(0)
        tf.vertical_anchor = MSO_ANCHOR.MIDDLE
        p = tf.paragraphs[0]
        p.alignment = PP_ALIGN.CENTER
        p.line_spacing = 1.0
        run(p, text, size=size, color=col, bold=True)
        return b

    er(8.30, 1.88, 1.55, "Cinema")
    er(10.05, 1.88, 1.25, "Room")
    er(11.50, 1.88, 1.10, "Seat")
    er(8.30, 2.72, 1.55, "Movie")
    er(10.05, 2.72, 1.55, "Showtime")
    er(10.05, 3.56, 1.55, "Booking", BRAND)
    er(9.10, 4.40, 1.55, "Payment")
    er(11.00, 4.40, 1.30, "Ticket", GREEN)
    er(10.05, 5.24, 1.55, "AuditLog", MUTED)

    arrow(s, 9.85, 2.10, 10.05, 2.10, color=DIM, width=1.0)
    arrow(s, 11.30, 2.10, 11.50, 2.10, color=DIM, width=1.0)
    arrow(s, 10.83, 2.44, 10.83, 2.70, color=DIM, width=1.0)
    arrow(s, 10.83, 3.16, 10.83, 3.54, color=DIM, width=1.0)
    arrow(s, 10.45, 4.00, 9.90, 4.38, color=DIM, width=1.0)
    arrow(s, 11.20, 4.00, 11.55, 4.38, color=DIM, width=1.0)
    arrow(s, 10.83, 4.84, 10.83, 5.22, color=DIM, width=1.0)

    labels = [(9.10, 1.72, "1─n"), (11.10, 1.72, "1─n"), (10.90, 2.48, "1─n"),
              (10.90, 3.30, "1─n"), (9.30, 4.06, "1─n"), (10.95, 4.06, "1─n")]
    for lx, ly, t in labels:
        _, tf = textbox(s, lx, ly, 0.4, 0.2, name="A69")
        p = par(tf, first=True, line=1.0)
        run(p, t, size=7, color=DIM)

    # callout
    call = rounded(s, 8.30, 5.86, 4.30, 0.84, fill=SURF2, line=BRAND, radius=0.06, lw=1.0)
    _, tf = textbox(s, 8.50, 5.96, 3.95, 0.66, name="A68")
    p = par(tf, first=True, line=1.15)
    run(p, "row_key", size=8.5, color=BRAND, bold=True)
    run(p, " giữ khóa kỹ thuật; ", size=8.5, color=SOFT)
    run(p, "id", size=8.5, color=BRAND, bold=True)
    run(p, " là mã nghiệp vụ; bảng tài chính không xóa cứng.", size=8.5, color=SOFT)

    footer(s, 11)
    return s


def slide_tech(prs):
    s = new_slide(prs)
    title_block(s, "11 · Công nghệ", "Chọn theo hợp đồng dữ liệu, không theo mốt",
                sub="TypeScript strict, tiền là số nguyên VND, thời điểm ISO 8601, ngày nghiệp vụ theo Asia/Ho_Chi_Minh.")

    cols = [
        ("GIAO DIỆN", BLUE, [
            ("React", "18.3"), ("TypeScript strict", "5.7"), ("Vite", "6.0"),
            ("React Router", "6.28"), ("TanStack Query", "5.62"), ("Zustand", "5.0"),
            ("react-hook-form + zod", "7.54 / 3.24"), ("Tailwind CSS", "3.4"),
        ]),
        ("MÁY CHỦ & DỮ LIỆU", BRAND, [
            ("Express", "5.3"), ("MySQL / MariaDB", "8"), ("mysql2", "3.24"),
            ("Vitest", "2.1"), ("Node.js", "24.19"), ("158 hàm nghiệp vụ", ""),
            ("29 bảng", ""), ("Ghi tuần tự", ""),
        ]),
    ]
    x = ML
    for tag, col, items in cols:
        _, tf = textbox(s, x, 1.86, 3.4, 0.26, name="A3")
        p = par(tf, first=True, line=1.0)
        run(p, tag, size=8.5, color=col, bold=True, spc=140)
        y = 2.18
        for name, ver in items:
            row = rounded(s, x, y, 3.45, 0.42, fill=SURF, line=LINE, radius=0.12)
            _, tf = textbox(s, x + 0.16, y + 0.08, 2.35, 0.26, name="A30")
            p = par(tf, first=True, line=1.0)
            run(p, name, size=9.3, color=SOFT, bold=True)
            if ver:
                _, tf = textbox(s, x + 2.55, y + 0.08, 0.78, 0.26, name="A31")
                p = par(tf, first=True, align=PP_ALIGN.RIGHT, line=1.0)
                run(p, ver, size=8.6, color=col, bold=True)
            y += 0.50
        x += 3.62

    framed_picture(s, "02-movie-list", 8.02, 1.86, 4.58, 2.86,
                   caption="Danh sách phim — lọc trạng thái, thể loại, nhãn tuổi")

    _, tf = textbox(s, 8.02, 5.14, 4.58, 0.24, name="A35")
    p = par(tf, first=True, line=1.0)
    run(p, "THƯ VIỆN NGHIỆP VỤ", size=8, color=GOLD, bold=True, spc=140)
    libs = ["qrcode.react 4.2", "html5-qrcode 2.3", "recharts 2.15", "dayjs 1.11", "canvas-confetti 1.9"]
    x = 8.02
    y = 5.44
    for lib in libs:
        w = 1.34 if len(lib) < 16 else 1.62
        if x + w > 12.7:
            x = 8.02
            y += 0.40
        chip(s, x, y, w, 0.30, lib, size=7.8, fill=SURF2, border=LINE, color=SOFT)
        x += w + 0.08

    _, tf = textbox(s, 8.02, 6.28, 4.58, 0.42, name="A36")
    p = par(tf, first=True, line=1.2)
    run(p, "QR vé + QR chuyển khoản, đọc mã bằng camera, biểu đồ quản trị và múi giờ Việt Nam.",
        size=8.5, color=MUTED)

    footer(s, 12)
    return s


def slide_tests(prs):
    s = new_slide(prs)
    title_block(s, "12 · Kiểm thử & kết quả", "Bốn kịch bản đạt, mười sáu tiêu chí nghiệm thu",
                sub="Kiểm thử tích hợp trên engine nghiệp vụ với cơ sở dữ liệu tạm; giao diện kiểm tra thủ công theo danh sách màn hình.")

    tests = [
        ("Luồng đặt vé đầy đủ", "Giữ ghế → voucher → chốt đơn → biên lai → duyệt → phát hành vé → soát vé.", GREEN),
        ("Hết hạn giữ ghế", "Đơn quá hạn chuyển expired, ghế được nhả và bán lại cho khách khác.", GREEN),
        ("POS và hoàn tiền", "Đơn tại quầy, thanh toán tiền mặt, hoàn toàn phần; kiểm tra vé, điểm, voucher.", GREEN),
        ("Chống trùng & biên lai trùng", "SHOWTIME_OVERLAP và PAYMENT_PROOF_DUPLICATE đều bị chặn đúng.", GREEN),
    ]
    y = 1.88
    for i, (t, d, col) in enumerate(tests):
        box = rounded(s, ML, y, 6.55, 0.96, fill=SURF, line=LINE, radius=0.07, name=f"A5{i}")
        circ = oval(s, ML + 0.16, y + 0.24, 0.42, 0.42, fill="DCFCE7", line=GREEN)
        tf = circ.text_frame
        tf.margin_left = tf.margin_right = Emu(0)
        tf.vertical_anchor = MSO_ANCHOR.MIDDLE
        p = tf.paragraphs[0]
        p.alignment = PP_ALIGN.CENTER
        run(p, "✓", size=12, color=GREEN, bold=True)
        _, tf = textbox(s, ML + 0.72, y + 0.14, 5.7, 0.26, name=f"A5{i}")
        p = par(tf, first=True, line=1.0)
        run(p, t, size=11, color=WHITE, bold=True)
        _, tf = textbox(s, ML + 0.72, y + 0.42, 5.65, 0.48, name=f"A5{i}")
        p = par(tf, first=True, line=1.12)
        run(p, d, size=8.6, color=MUTED)
        y += 1.04

    # KPI row
    kpis = [("4/4", "kịch bản đạt", BRAND), ("~7s", "thời gian chạy", BLUE),
            ("13/16", "AC đạt tuyệt đối", GREEN), ("15", "màn hình chụp", GOLD)]
    x = ML
    for num, label, col in kpis:
        c = rounded(s, x, 6.10, 1.58, 0.66, fill=SURF2, line=LINE, radius=0.10)
        tf = c.text_frame
        tf.margin_left = Emu(int(0.14 * 914400))
        tf.vertical_anchor = MSO_ANCHOR.MIDDLE
        p = tf.paragraphs[0]
        p.line_spacing = 0.95
        run(p, num, size=15, color=col, bold=True)
        p = tf.add_paragraph()
        p.line_spacing = 0.95
        run(p, label, size=7.6, color=MUTED)
        x += 1.66

    framed_picture(s, "12-admin-orders", 7.60, 1.88, 5.00, 3.13,
                   caption="Đơn hàng — trạng thái đơn và thanh toán trên cùng một hàng")

    note = rounded(s, 7.60, 5.44, 5.00, 0.72, fill=SURF, line=LINE, radius=0.07)
    _, tf = textbox(s, 7.80, 5.54, 4.6, 0.54, name="A40")
    p = par(tf, first=True, line=1.12)
    run(p, "Chưa có Testing Library · Playwright · axe-core. ", size=8.5, color=GOLD, bold=True)
    run(p, "Đã ghi ở mục hạn chế và lộ trình phát triển.", size=8.5, color=MUTED)

    footer(s, 13)
    return s


def slide_end(prs):
    s = new_slide(prs)
    title_block(s, "13 · Kết luận", "Đã làm được gì, và bước tiếp theo",
                sub="Đối chiếu với mục tiêu ban đầu của hồ sơ: nghiệp vụ, kỹ thuật, chất lượng và giao diện.")

    # left: achieved
    _, tf = textbox(s, ML, 1.86, 5.6, 0.28, name="A2")
    p = par(tf, first=True, line=1.0)
    run(p, "ĐÃ ĐẠT ĐƯỢC", size=8.5, color=GREEN, bold=True, spc=140)
    done = [
        "Mô hình hóa đúng vòng đời đơn, thanh toán, vé, suất chiếu và hoàn tiền.",
        "158 hàm nghiệp vụ sau một điểm vào API · 56 tuyến · 29 bảng.",
        "Bốn kịch bản kiểm thử đều đạt, phủ ghế – tiền – vé và các nhánh lỗi.",
        "Giao diện theo trạng thái, token nhất quán, ưu tiên di động.",
        "Dữ liệu mẫu đủ lớn: 42 phim · 1.352 suất · 800 đơn.",
    ]
    _, tf = textbox(s, ML, 2.18, 5.65, 3.7, name="A3")
    first = True
    for t in done:
        p = par(tf, first=first, line=1.25, before=0 if first else 7, bullet="✓", indent=0.0)
        run(p, t, size=9.6, color=SOFT)
        first = False

    # right: roadmap
    _, tf = textbox(s, 6.95, 1.86, 5.6, 0.28, name="A4")
    p = par(tf, first=True, line=1.0)
    run(p, "BƯỚC TIẾP THEO", size=8.5, color=BRAND, bold=True, spc=140)
    nexts = [
        "Cổng thanh toán thật + webhook có xác thực chữ ký, đối soát tự động.",
        "Testing Library, MSW, Playwright, axe-core và CI cho mỗi thay đổi.",
        "Đưa khóa ngoại và unique (showtime, seat) xuống cơ sở dữ liệu.",
        "argon2id, cookie httpOnly, rate limit, siết CORS.",
        "Hàng đợi có khóa phân tán + SSE cho sơ đồ ghế và hàng đợi duyệt.",
        "Hoàn thiện P2/P3: giá động, hóa đơn điện tử, bản tiếng Anh, mobile.",
    ]
    _, tf = textbox(s, 6.95, 2.18, 5.7, 3.9, name="A5")
    first = True
    for t in nexts:
        p = par(tf, first=first, line=1.25, before=0 if first else 7, bullet="→", indent=0.0)
        run(p, t, size=9.3, color=MUTED)
        first = False

    # three takeaways
    pillars = [
        ("Trạng thái đúng", "Máy trạng thái và ràng buộc ghế – tiền – vé được cưỡng chế ở máy chủ.", GOLD),
        ("Hợp đồng rõ", "Một điểm vào API, phong bì lỗi ổn định, giao diện không tự suy luận.", BLUE),
        ("Kiểm thử theo quy tắc", "Bốn kịch bản tích hợp và mười sáu tiêu chí nghiệm thu làm thước đo.", GREEN),
    ]
    px, pw = ML, 3.80
    for i, (t, d, col) in enumerate(pillars):
        rounded(s, px, 3.84, pw, 1.22, fill=SURF, line=LINE, radius=0.06, name=f"A8{i}")
        rect(s, px, 3.84, pw, 0.05, fill=col)
        _, tf = textbox(s, px + 0.22, 3.98, pw - 0.44, 0.28, name=f"A8{i}")
        p = par(tf, first=True, line=1.0)
        run(p, t, size=11.5, color=WHITE, bold=True)
        _, tf = textbox(s, px + 0.22, 4.28, pw - 0.42, 0.70, name=f"A8{i}")
        p = par(tf, first=True, line=1.2)
        run(p, d, size=8.8, color=MUTED)
        px += pw + 0.245

    _, tf = textbox(s, ML, 5.36, 11.85, 0.44, name="A9")
    p = par(tf, first=True, line=1.0, align=PP_ALIGN.CENTER)
    run(p, "“Mô hình trạng thái đúng quan trọng hơn một giao diện đẹp.”", size=13,
        color=SOFT, italic=True)

    # closing band
    band = rounded(s, ML, 6.02, 11.89, 0.80, fill=SURF, line=BRAND, radius=0.08, lw=1.0)
    _, tf = textbox(s, ML + 0.30, 6.12, 8.4, 0.6, name="A6")
    p = par(tf, first=True, line=1.1)
    run(p, "Xin cảm ơn!", size=17, color=WHITE, bold=True)
    run(p, "   Em mong nhận được ý kiến đóng góp của quý thầy cô.", size=10, color=MUTED)
    s.shapes.add_picture(str(LOGO), Inches(11.52), Inches(6.14), Inches(0.52),
                         Inches(0.52 * 0.905)).name = "A7"

    footer(s, 14)
    return s


def build():
    prs = Presentation()
    prs.slide_width = Inches(SW)
    prs.slide_height = Inches(SH)
    TMP.mkdir(exist_ok=True)
    slide_cover(prs)
    slide_problem(prs)
    slide_roles(prs)
    slide_arch(prs)
    slide_booking(prs)
    slide_hold(prs)
    slide_payment(prs)
    slide_ticket(prs)
    slide_states(prs)
    slide_admin(prs)
    slide_data(prs)
    slide_tech(prs)
    slide_tests(prs)
    slide_end(prs)
    prs.core_properties.title = "PXU Cinema — Hệ thống đặt vé và quản lý rạp chiếu phim"
    prs.core_properties.author = "Nguyễn Văn Bin"
    prs.core_properties.subject = "Báo cáo đồ án kết thúc học phần — Web Front End nâng cao"
    prs.save(OUTPUT)
    print("saved", OUTPUT, OUTPUT.stat().st_size, "slides", len(prs.slides))


if __name__ == "__main__":
    build()
