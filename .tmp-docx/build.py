import os, re, sys, zipfile, shutil
from PIL import Image
from docx import Document
from docx.shared import Pt, Emu, Inches, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.section import WD_SECTION
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

BASE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(BASE, ".."))
SAMPLE = os.path.join(ROOT, "Đồ án_Xây dựng hệ thống đặt và quản lý tour du lịch-bin.docx")
OUT = os.path.join(ROOT, "PXU_CINEMA_BAO_CAO_DO_AN.docx")
CONTENT = [os.path.join(BASE, "content", n) for n in ("a.txt", "b.txt", "c.txt", "d.txt")]
FIGS = os.path.join(BASE, "figs")

# ---------------------------------------------------------------- logo
def extract_logo():
    path = os.path.join(BASE, "logo.png")
    if os.path.exists(path):
        return path
    z = zipfile.ZipFile(SAMPLE)
    drawing = z.read("word/document.xml").decode("utf-8")
    rels = z.read("word/_rels/document.xml.rels").decode("utf-8")
    # first image relationship used by the cover drawing
    rid = re.search(r'<a:blip r:embed="(rId\d+)"', drawing).group(1)
    target = re.search(r'Id="%s"[^>]*Target="([^"]+)"' % rid, rels).group(1)
    data = z.read("word/" + target.lstrip("/").replace("..", ""))
    with open(path, "wb") as f:
        f.write(data)
    return path

# ---------------------------------------------------------------- helpers
TBLPR_ORDER = [
    "tblStyle", "tblpPr", "tblOverlap", "bidiVisual", "tblStyleRowBandSize",
    "tblStyleColBandSize", "tblW", "jc", "tblCellSpacing", "tblInd", "tblBorders",
    "shd", "tblLayout", "tblCellMar", "tblLook", "tblCaption", "tblDescription",
]

def normalize_tblpr(table):
    tblPr = table._tbl.tblPr
    children = list(tblPr)
    children.sort(key=lambda el: TBLPR_ORDER.index(el.tag.split("}")[-1])
                  if el.tag.split("}")[-1] in TBLPR_ORDER else len(TBLPR_ORDER))
    for el in children:
        tblPr.remove(el)
    for el in children:
        tblPr.append(el)

def set_cell_margins(table, top=60, bottom=60, left=90, right=90):
    tblPr = table._tbl.tblPr
    mar = OxmlElement("w:tblCellMar")
    for tag, val in (("top", top), ("left", left), ("bottom", bottom), ("right", right)):
        node = OxmlElement("w:" + tag)
        node.set(qn("w:w"), str(val))
        node.set(qn("w:type"), "dxa")
        mar.append(node)
    tblPr.append(mar)

def repeat_header(row):
    trPr = row._tr.get_or_add_trPr()
    el = OxmlElement("w:tblHeader")
    el.set(qn("w:val"), "true")
    trPr.append(el)

def no_split(row):
    trPr = row._tr.get_or_add_trPr()
    el = OxmlElement("w:cantSplit")
    el.set(qn("w:val"), "true")
    trPr.append(el)

def add_page_field(paragraph):
    run = paragraph.add_run()
    fld = OxmlElement("w:fldChar"); fld.set(qn("w:fldCharType"), "begin")
    run._r.append(fld)
    run2 = paragraph.add_run()
    instr = OxmlElement("w:instrText"); instr.set(qn("xml:space"), "preserve"); instr.text = " PAGE "
    run2._r.append(instr)
    run3 = paragraph.add_run()
    sep = OxmlElement("w:fldChar"); sep.set(qn("w:fldCharType"), "separate")
    run3._r.append(sep)
    run4 = paragraph.add_run("1")
    run5 = paragraph.add_run()
    end = OxmlElement("w:fldChar"); end.set(qn("w:fldCharType"), "end")
    run5._r.append(end)

def add_toc(paragraph):
    run = paragraph.add_run()
    begin = OxmlElement("w:fldChar"); begin.set(qn("w:fldCharType"), "begin"); begin.set(qn("w:dirty"), "true")
    run._r.append(begin)
    run2 = paragraph.add_run()
    instr = OxmlElement("w:instrText"); instr.set(qn("xml:space"), "preserve")
    instr.text = ' TOC \\o "1-2" \\h \\z \\u '
    run2._r.append(instr)
    run3 = paragraph.add_run()
    sep = OxmlElement("w:fldChar"); sep.set(qn("w:fldCharType"), "separate")
    run3._r.append(sep)
    run4 = paragraph.add_run("Nhấn chuột phải và chọn Update Field để cập nhật mục lục.")
    run5 = paragraph.add_run()
    end = OxmlElement("w:fldChar"); end.set(qn("w:fldCharType"), "end")
    run5._r.append(end)

def clear_body(doc):
    body = doc.element.body
    for child in list(body):
        if child.tag == qn("w:sectPr"):
            continue
        body.remove(child)

# ---------------------------------------------------------------- document
doc = Document(SAMPLE)
clear_body(doc)

sec0 = doc.sections[0]
sec0.left_margin = sec0.right_margin = Emu(720090)
sec0.top_margin = sec0.bottom_margin = Emu(720090)

def para(text="", size=12, bold=False, color=None, align=None, before=0, after=0,
         line=None, indent=None, italic=False, style=None):
    p = doc.add_paragraph(style=style)
    if align is not None:
        p.alignment = align
    pf = p.paragraph_format
    pf.space_before = Pt(before)
    pf.space_after = Pt(after)
    if line is not None:
        pf.line_spacing = line
    if indent is not None:
        pf.first_line_indent = indent
    if text:
        r = p.add_run(text)
        r.font.size = Pt(size)
        r.bold = bold
        r.italic = italic
        if color is not None:
            r.font.color.rgb = color
    return p

# ---- cover
para("   BỘ GIÁO DỤC VÀ ĐÀO TẠO", 15, align=WD_ALIGN_PARAGRAPH.CENTER, before=5.65, line=1.0)
para("TRƯỜNG ĐẠI HỌC PHÚ XUÂN", 15, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, before=0, line=1.0)
p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
p.paragraph_format.space_before = Pt(22.7); p.paragraph_format.space_after = Pt(0)
p.paragraph_format.line_spacing = 1.0
p.add_run().add_picture(extract_logo(), width=Inches(1.55))
para("BÁO CÁO ĐỒ ÁN KẾT THÚC HỌC PHẦN", 20, color=RGBColor(0xFF, 0, 0),
     align=WD_ALIGN_PARAGRAPH.CENTER, before=65, line=1.0)
para("WEB FRONT END NÂNG CAO", 14, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, before=17, line=1.0)
para("ĐỀ TÀI: XÂY DỰNG HỆ THỐNG ĐẶT VÉ VÀ QUẢN LÝ RẠP CHIẾU PHIM", 14, bold=True,
     align=WD_ALIGN_PARAGRAPH.CENTER, before=17, line=1.0)
p = doc.add_paragraph()
p.paragraph_format.space_before = Pt(102); p.paragraph_format.space_after = Pt(0)
p.paragraph_format.left_indent = Emu(2016125); p.paragraph_format.line_spacing = 1.0
r = p.add_run("Giảng viên hướng dẫn: "); r.bold = True; r.font.size = Pt(14)
r2 = p.add_run("Trương Ngọc Duy"); r2.font.size = Pt(14)
p = doc.add_paragraph()
p.paragraph_format.space_before = Pt(5.65); p.paragraph_format.space_after = Pt(0)
p.paragraph_format.left_indent = Emu(2016125); p.paragraph_format.line_spacing = 1.0
r = p.add_run("Sinh viên thực hiện: "); r.bold = True; r.font.size = Pt(14)
r2 = p.add_run("Nguyễn Văn Bin"); r2.font.size = Pt(14)
for _ in range(5):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(0); p.paragraph_format.space_after = Pt(0)
    p.paragraph_format.left_indent = Emu(2016125); p.paragraph_format.line_spacing = 1.0
para("Thành phố Huế, tháng 11, năm 2026", 14, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER,
     before=119, line=1.0)

# ---- main section with page numbers
main = doc.add_section(WD_SECTION.NEW_PAGE)
main.left_margin = main.right_margin = Emu(720090)
main.top_margin = main.bottom_margin = Emu(720090)
main.footer.is_linked_to_previous = False
fp = main.footer.paragraphs[0]
fp.alignment = WD_ALIGN_PARAGRAPH.CENTER
add_page_field(fp)
sectPr = main._sectPr
pg = OxmlElement("w:pgNumType"); pg.set(qn("w:start"), "1")
cols = sectPr.find(qn("w:cols"))
if cols is not None:
    cols.addprevious(pg)
else:
    sectPr.append(pg)

# cover page: no footer at all
cover_sectPr = doc.sections[0]._sectPr
for ref in list(cover_sectPr.findall(qn("w:footerReference"))):
    cover_sectPr.remove(ref)
# cover page: template frame (same decorative border as the reference report)
borders = OxmlElement("w:pgBorders")
borders.set(qn("w:display"), "firstPage")
borders.set(qn("w:offsetFrom"), "page")
for side in ("top", "left", "bottom", "right"):
    el = OxmlElement("w:" + side)
    el.set(qn("w:val"), "twistedLines1")
    el.set(qn("w:sz"), "31")
    el.set(qn("w:space"), "31")
    el.set(qn("w:color"), "auto")
    borders.append(el)
anchor = None
for tag in ("pgNumType", "cols"):
    anchor = cover_sectPr.find(qn("w:" + tag))
    if anchor is not None:
        break
if anchor is not None:
    anchor.addprevious(borders)
else:
    cover_sectPr.append(borders)

# ---------------------------------------------------------------- content blocks
def heading(text, level, break_before=False):
    p = doc.add_paragraph(style="Heading %d" % level)
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(6)
    if break_before:
        p.paragraph_format.page_break_before = True
    p.add_run(text)
    return p

def left_bullet(text):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(6)
    p.paragraph_format.first_line_indent = Emu(360045)
    p.add_run("- " + text)
    return p

def body(text):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(6)
    p.paragraph_format.first_line_indent = Emu(360045)
    p.add_run(text)
    return p

def bullet(text):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(6)
    p.paragraph_format.first_line_indent = Emu(360045)
    p.add_run("- " + text)
    return p

counter = {"n": 0}

def numbered(text):
    counter["n"] += 1
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(6)
    p.paragraph_format.first_line_indent = Emu(360045)
    p.add_run("%d.\t%s" % (counter["n"], text))
    return p

TABLE_SPECS = []

def add_table(widths, rows):
    TABLE_SPECS.append(widths)
    ncols = len(widths)
    table = doc.add_table(rows=len(rows), cols=ncols)
    table.style = "Table Grid"
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    tblW = table._tbl.tblPr.find(qn("w:tblW"))
    if tblW is None:
        tblW = OxmlElement("w:tblW"); table._tbl.tblPr.append(tblW)
    tblW.set(qn("w:w"), "9581"); tblW.set(qn("w:type"), "dxa")
    layout = OxmlElement("w:tblLayout"); layout.set(qn("w:type"), "fixed")
    table._tbl.tblPr.append(layout)
    set_cell_margins(table)
    normalize_tblpr(table)
    total = sum(widths)
    colw = [int(9581 * w / total) for w in widths]
    grid = table._tbl.tblGrid
    for i, gc in enumerate(grid.findall(qn("w:gridCol"))):
        gc.set(qn("w:w"), str(colw[i]))
    for r, cells in enumerate(rows):
        row = table.rows[r]
        no_split(row)
        if r == 0:
            repeat_header(row)
        for c, text in enumerate(cells):
            cell = row.cells[c]
            cell.width = Emu(int(colw[c] * 635))
            p = cell.paragraphs[0]
            p.paragraph_format.space_before = Pt(0)
            p.paragraph_format.space_after = Pt(0)
            p.paragraph_format.line_spacing = 1.0
            if r == 0:
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            run = p.add_run(text)
            run.font.size = Pt(11)
            if r == 0:
                run.bold = True
    global pending_pad
    pending_pad = True

fig_no = 0
def add_figure(name, caption):
    png = os.path.join(FIGS, name + ".png")
    if not os.path.exists(png):
        Image.open(os.path.join(FIGS, name + ".webp")).save(png)
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(6)
    p.paragraph_format.space_after = Pt(0)
    p.paragraph_format.line_spacing = 1.0
    p.add_run().add_picture(png, width=Inches(5.85))
    cp = doc.add_paragraph()
    cp.alignment = WD_ALIGN_PARAGRAPH.CENTER
    cp.paragraph_format.space_before = Pt(2)
    cp.paragraph_format.space_after = Pt(10)
    r = cp.add_run(caption)
    r.italic = True
    r.font.size = Pt(11)

prev_pb = True
first_h1 = True
pending_break = False
pending_pad = False

def flush_break():
    global pending_break
    if pending_break:
        pb = doc.add_paragraph()
        pb.add_run().add_break(WD_BREAK.PAGE)
        pending_break = False

def flush_pad():
    global pending_pad
    if pending_pad:
        para("", 11, line=1.0)
        pending_pad = False

for path in CONTENT:
    with open(path, encoding="utf-8") as f:
        lines = f.read().splitlines()
    i = 0
    while i < len(lines):
        line = lines[i]
        i += 1
        if not line.strip():
            continue
        tag, _, payload = line.partition("|")
        if tag == "#TBL":
            flush_break()
            widths = [int(x) for x in payload.split(",")]
            rows = []
            while i < len(lines) and lines[i].startswith("#ROW|"):
                cells = [c.replace("\\t", "").strip() for c in lines[i][5:].split("|")]
                rows.append(cells)
                i += 1
            add_table(widths, rows)
            prev_pb = True
        elif tag == "#H1":
            pending_pad = False
            heading(payload, 1, break_before=(not first_h1) or pending_break)
            pending_break = False
            first_h1 = False
            counter["n"] = 0
            prev_pb = False
        elif tag == "#H2":
            flush_pad(); flush_break()
            heading(payload, 2)
            counter["n"] = 0
            prev_pb = False
        elif tag == "#H3":
            flush_pad(); flush_break()
            heading(payload, 3)
            counter["n"] = 0
            prev_pb = False
        elif tag == "#P":
            flush_pad(); flush_break()
            body(payload)
            prev_pb = False
        elif tag == "#B":
            flush_pad(); flush_break()
            bullet(payload)
            prev_pb = False
        elif tag == "#BL":
            flush_pad(); flush_break()
            left_bullet(payload)
            prev_pb = False
        elif tag == "#N":
            flush_pad(); flush_break()
            numbered(payload)
            prev_pb = False
        elif tag == "#EMPTY":
            para("", 11, line=1.0)
            prev_pb = True
        elif tag == "#PB":
            pending_break = True
        elif tag == "#FIG":
            flush_pad(); flush_break()
            name, _, caption = payload.partition("|")
            add_figure(name, caption)
            prev_pb = True
        else:
            raise SystemExit("unknown tag %r in %s" % (tag, path))

# ---- table of contents goes into the MỤC LỤC heading (second H1)
target = None
for p in doc.paragraphs:
    if p.style.name == "Heading 1" and p.text.strip() == "MỤC LỤC":
        target = p
        break
assert target is not None, "MỤC LỤC heading not found"
toc_par = doc.add_paragraph()
toc_par.paragraph_format.space_before = Pt(0)
toc_par.paragraph_format.space_after = Pt(0)
add_toc(toc_par)
target._p.addnext(toc_par._p)

import json
with open(os.path.join(BASE, "tables.json"), "w", encoding="utf-8") as f:
    json.dump(TABLE_SPECS, f)
doc.save(OUT)
print("saved", OUT, os.path.getsize(OUT), "tables", len(TABLE_SPECS))
