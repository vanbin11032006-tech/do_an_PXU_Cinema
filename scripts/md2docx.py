#!/usr/bin/env python3
"""Gộp 4 tài liệu Markdown của PXU Cinema thành một file Word duy nhất
có trang bìa, mục lục tự động (TOC field, 3 cấp) và định dạng chuẩn đồ án.

Chạy:  python scripts/md2docx.py
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_TAB_ALIGNMENT, WD_LINE_SPACING
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

ROOT = Path(__file__).resolve().parent.parent
SOURCES = [
    "01_TAI_LIEU_NGHIEP_VU.md",
    "02_TAI_LIEU_GIAO_DIEN_AI.md",
    "03_TAI_LIEU_KY_THUAT_FRONTEND_AI.md",
    "04_TAI_LIEU_KY_THUAT_ADMIN_AI.md",
]
OUTPUT = ROOT / "PXU_CINEMA_TAI_LIEU.docx"

FONT = "Times New Roman"
MONO = "Consolas"
ACCENT = RGBColor(0x1F, 0x38, 0x64)

# Tham số bố cục — chỉnh ở đây để đổi độ dày của tài liệu
BODY_PT = 12.0        # cỡ chữ thân
LINE_SPACING = 1.10   # giãn dòng
TABLE_PT = 10.5       # cỡ chữ trong bảng
CODE_PT = 9.0         # cỡ chữ khối code
TOC_LEVELS = 2        # số cấp trong mục lục


# ---------------------------------------------------------------- XML helpers
PPR_ORDER = [
    "pStyle", "keepNext", "keepLines", "pageBreakBefore", "framePr",
    "widowControl", "numPr", "suppressLineNumbers", "pBdr", "shd", "tabs",
    "suppressAutoHyphens", "kinsoku", "wordWrap", "overflowPunct",
    "topLinePunct", "autoSpaceDE", "autoSpaceDN", "bidi", "adjustRightInd",
    "snapToGrid", "spacing", "ind", "contextualSpacing", "mirrorIndents",
    "suppressOverlap", "jc", "textDirection", "textAlignment",
    "textboxTightWrap", "outlineLvl", "divId", "cnfStyle", "rPr", "sectPr",
    "pPrChange",
]


def _insert_ordered(parent, child, order: list[str]) -> None:
    """Chèn child vào parent đúng thứ tự schema (Word kiểm tra chặt)."""
    tag = child.tag.split("}")[-1]
    rank = order.index(tag)
    for existing in parent:
        name = existing.tag.split("}")[-1]
        if name in order and order.index(name) > rank:
            existing.addprevious(child)
            return
    parent.append(child)


def _shade(element, fill: str, order: list[str] | None = None) -> None:
    for old in element.findall(qn("w:shd")):
        element.remove(old)
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), fill)
    if order is None:
        element.append(shd)
    else:
        _insert_ordered(element, shd, order)


def _shade_paragraph(paragraph, fill: str) -> None:
    _shade(paragraph._p.get_or_add_pPr(), fill, PPR_ORDER)


def _set_run_fonts(run, name: str) -> None:
    run.font.name = name
    rpr = run._element.get_or_add_rPr()
    rfonts = rpr.find(qn("w:rFonts"))
    if rfonts is None:
        rfonts = OxmlElement("w:rFonts")
        rpr.insert(0, rfonts)
    for attr in ("w:ascii", "w:hAnsi", "w:eastAsia", "w:cs"):
        rfonts.set(qn(attr), name)


def _para_border(paragraph, color: str = "B4C6E7") -> None:
    ppr = paragraph._p.get_or_add_pPr()
    borders = OxmlElement("w:pBdr")
    left = OxmlElement("w:left")
    left.set(qn("w:val"), "single")
    left.set(qn("w:sz"), "18")
    left.set(qn("w:space"), "6")
    left.set(qn("w:color"), color)
    borders.append(left)
    for old in ppr.findall(qn("w:pBdr")):
        ppr.remove(old)
    _insert_ordered(ppr, borders, PPR_ORDER)


def _keep_with_next(paragraph) -> None:
    paragraph.paragraph_format.keep_with_next = True


# ------------------------------------------------------------- inline parsing
TOKEN = re.compile(r"(\*\*.+?\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\)|\*[^*\n]+?\*)")


def add_inline(paragraph, text: str, *, bold: bool = False, italic: bool = False,
               size: float | None = None, color: RGBColor | None = None,
               mono_ok: bool = True) -> None:
    """Thêm text có markdown nội tuyến (**bold**, *italic*, `code`, [text](url))."""
    for part in TOKEN.split(text):
        if not part:
            continue
        if part.startswith("**") and part.endswith("**") and len(part) > 4:
            # **đậm** có thể chứa `code` bên trong → đệ quy
            add_inline(paragraph, part[2:-2], bold=True, italic=italic,
                       size=size, color=color)
            continue
        if (part.startswith("*") and part.endswith("*") and len(part) > 2
                and not part.startswith("**")):
            add_inline(paragraph, part[1:-1], bold=bold, italic=True,
                       size=size, color=color)
            continue
        run = paragraph.add_run()
        r_bold, r_italic, r_mono = bold, italic, False
        if part.startswith("`") and part.endswith("`") and len(part) > 2 and mono_ok:
            run.text = part[1:-1]
            r_mono = True
        elif part.startswith("[") and "](" in part:
            run.text = part[1:part.index("]")]
            r_italic = italic
        else:
            run.text = part
        run.bold = r_bold or None
        run.italic = r_italic or None
        if r_mono:
            _set_run_fonts(run, MONO)
            run.font.size = Pt((size or BODY_PT) - 1.5)
            run.font.color.rgb = RGBColor(0xA3, 0x1D, 0x4B)
        else:
            _set_run_fonts(run, FONT)
            if size:
                run.font.size = Pt(size)
            if color:
                run.font.color.rgb = color


def _code_heavy(text: str) -> bool:
    """Dòng có >=50% ký tự nằm trong `code` thì canh trái (tránh giãn chữ)."""
    code_chars = sum(len(m) for m in re.findall(r"`[^`]+`", text))
    return code_chars * 2 >= len(text)


def plain(text: str) -> str:
    """Bỏ markdown nội tuyến, dùng cho heading (mục lục phải sạch)."""
    text = re.sub(r"`([^`]+)`", r"\1", text)
    text = re.sub(r"\*\*(.+?)\*\*", r"\1", text)
    text = re.sub(r"\*([^*]+?)\*", r"\1", text)
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
    return text.strip()


# --------------------------------------------------------------- doc styling
def setup_styles(doc: Document) -> None:
    normal = doc.styles["Normal"]
    normal.font.name = FONT
    normal.font.size = Pt(BODY_PT)
    rpr = normal.element.get_or_add_rPr()
    rfonts = rpr.find(qn("w:rFonts"))
    if rfonts is None:
        rfonts = OxmlElement("w:rFonts")
        rpr.insert(0, rfonts)
    for attr in ("w:ascii", "w:hAnsi", "w:eastAsia", "w:cs"):
        rfonts.set(qn(attr), FONT)
    pf = normal.paragraph_format
    pf.space_before = Pt(0)
    pf.space_after = Pt(2)
    pf.line_spacing = LINE_SPACING
    pf.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY

    specs = {
        "Heading 1": (15, True, False, ACCENT, 0, 7),
        "Heading 2": (13, True, False, ACCENT, 8, 4),
        "Heading 3": (12, True, False, RGBColor(0x2E, 0x54, 0x96), 6, 2),
    }
    for name, (size, bold, italic, color, before, after) in specs.items():
        st = doc.styles[name]
        st.font.name = FONT
        st.font.size = Pt(size)
        st.font.bold = bold
        st.font.italic = italic
        st.font.color.rgb = color
        rpr = st.element.get_or_add_rPr()
        rfonts = rpr.find(qn("w:rFonts"))
        if rfonts is None:
            rfonts = OxmlElement("w:rFonts")
            rpr.insert(0, rfonts)
        for attr in ("w:ascii", "w:hAnsi", "w:eastAsia", "w:cs"):
            rfonts.set(qn(attr), FONT)
        st.paragraph_format.space_before = Pt(before)
        st.paragraph_format.space_after = Pt(after)
        st.paragraph_format.keep_with_next = True
        st.paragraph_format.line_spacing = 1.15
        st.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.LEFT


def setup_page(section) -> None:
    section.page_width = Cm(21)
    section.page_height = Cm(29.7)
    section.top_margin = Cm(1.8)
    section.bottom_margin = Cm(1.8)
    section.left_margin = Cm(3.0)
    section.right_margin = Cm(2.0)


def add_page_number_footer(section, *, restart: int | None = None) -> None:
    section.footer.is_linked_to_previous = False
    para = section.footer.paragraphs[0]
    para.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = para.add_run()
    _set_run_fonts(run, FONT)
    run.font.size = Pt(11)
    begin = OxmlElement("w:fldChar")
    begin.set(qn("w:fldCharType"), "begin")
    instr = OxmlElement("w:instrText")
    instr.set(qn("xml:space"), "preserve")
    instr.text = " PAGE "
    end = OxmlElement("w:fldChar")
    end.set(qn("w:fldCharType"), "end")
    run._r.append(begin)
    run._r.append(instr)
    run._r.append(end)

    if restart is not None:
        pgnum = OxmlElement("w:pgNumType")
        pgnum.set(qn("w:start"), str(restart))
        section._sectPr.append(pgnum)


# ------------------------------------------------------------------ builders
USABLE_WIDTH_CM = 16.0


def _fixed_layout(table) -> None:
    tblpr = table._tbl.tblPr
    for old in tblpr.findall(qn("w:tblLayout")):
        tblpr.remove(old)
    layout = OxmlElement("w:tblLayout")
    layout.set(qn("w:type"), "fixed")
    tblpr.append(layout)


def _no_split_row(row) -> None:
    trpr = row._tr.get_or_add_trPr()
    if trpr.find(qn("w:cantSplit")) is None:
        trpr.append(OxmlElement("w:cantSplit"))


def _column_widths(header: list[str], rows: list[list[str]]) -> list[float]:
    """Chia bề rộng cột theo độ dài nội dung, có chặn dưới/chặn trên."""
    weights = []
    for idx in range(len(header)):
        lengths = [len(plain(header[idx]))]
        lengths += [len(plain(r[idx])) for r in rows if idx < len(r)]
        longest = max(lengths)
        weights.append(min(max(longest, 8), 55))
    total = sum(weights)
    raw = [USABLE_WIDTH_CM * w / total for w in weights]
    floor = min(2.4, USABLE_WIDTH_CM / len(header))
    return [max(floor, w) for w in raw]


def add_table(doc: Document, header: list[str], rows: list[list[str]],
              aligns: list[str]) -> None:
    cols = len(header)
    table = doc.add_table(rows=1, cols=cols)
    table.style = "Table Grid"
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    _fixed_layout(table)
    widths = _column_widths(header, rows)

    def fill(cells, values, *, is_header: bool) -> None:
        for idx, cell in enumerate(cells):
            cell.text = ""
            para = cell.paragraphs[0]
            para.paragraph_format.space_before = Pt(2)
            para.paragraph_format.space_after = Pt(2)
            para.paragraph_format.line_spacing = 1.0
            align = aligns[idx] if idx < len(aligns) else "l"
            para.alignment = {
                "c": WD_ALIGN_PARAGRAPH.CENTER,
                "r": WD_ALIGN_PARAGRAPH.RIGHT,
            }.get(align, WD_ALIGN_PARAGRAPH.LEFT)
            value = values[idx] if idx < len(values) else ""
            add_inline(para, value, bold=is_header, size=TABLE_PT)
            if is_header:
                _shade(cell._tc.get_or_add_tcPr(), "DCE6F1")

    fill(table.rows[0].cells, header, is_header=True)
    trpr = table.rows[0]._tr.get_or_add_trPr()
    hdr = OxmlElement("w:tblHeader")
    trpr.append(hdr)
    for row in rows:
        row_obj = table.add_row()
        fill(row_obj.cells, row, is_header=False)
        _no_split_row(row_obj)

    for row_obj in table.rows:
        for idx, cell in enumerate(row_obj.cells):
            cell.width = Cm(widths[idx])

    spacer = doc.add_paragraph()
    spacer.paragraph_format.space_after = Pt(0)
    spacer.paragraph_format.line_spacing = 1.0
    spacer.add_run().font.size = Pt(4)


def add_code_block(doc: Document, lines: list[str]) -> None:
    for i, line in enumerate(lines):
        para = doc.add_paragraph()
        pf = para.paragraph_format
        pf.space_before = Pt(0)
        pf.space_after = Pt(0)
        pf.line_spacing = 1.0
        pf.left_indent = Cm(0.4)
        pf.alignment = WD_ALIGN_PARAGRAPH.LEFT
        pf.keep_together = True
        if i < len(lines) - 1:
            pf.keep_with_next = True
        _shade_paragraph(para, "F2F2F2")
        run = para.add_run(line if line else " ")
        _set_run_fonts(run, MONO)
        run.font.size = Pt(CODE_PT)
    tail = doc.add_paragraph()
    tail.paragraph_format.space_after = Pt(2)


def add_quote(doc: Document, lines: list[str]) -> None:
    para = doc.add_paragraph()
    pf = para.paragraph_format
    pf.left_indent = Cm(0.6)
    pf.space_before = Pt(4)
    pf.space_after = Pt(6)
    _para_border(para)
    for i, line in enumerate(lines):
        if i:
            para.add_run().add_break()
        add_inline(para, line, italic=True, size=12,
                   color=RGBColor(0x40, 0x40, 0x40))


def add_list_item(doc: Document, text: str, level: int, marker: str,
                  number: str | None = None) -> None:
    para = doc.add_paragraph()
    pf = para.paragraph_format
    indent = 0.75 + 0.6 * level
    pf.left_indent = Cm(indent)
    pf.first_line_indent = Cm(-0.55)
    pf.space_before = Pt(0)
    pf.space_after = Pt(2)
    pf.line_spacing = 1.2
    pf.alignment = WD_ALIGN_PARAGRAPH.LEFT
    pf.tab_stops.add_tab_stop(Cm(indent), WD_TAB_ALIGNMENT.LEFT)
    lead = para.add_run(f"{number}\t" if number else f"{marker}\t")
    _set_run_fonts(lead, FONT)
    lead.font.size = Pt(BODY_PT)
    add_inline(para, text)


def add_heading(doc: Document, text: str, level: int, *, new_page: bool) -> None:
    para = doc.add_paragraph(style=f"Heading {level}")
    if new_page:
        para.paragraph_format.page_break_before = True
    para.add_run(plain(text))


# -------------------------------------------------------------- md → docx
def parse_markdown(doc: Document, md_path: Path) -> None:
    lines = md_path.read_text(encoding="utf-8").splitlines()
    i = 0
    in_code = False
    code: list[str] = []
    quote: list[str] = []

    def flush_quote() -> None:
        nonlocal quote
        if quote:
            add_quote(doc, quote)
            quote = []

    while i < len(lines):
        raw = lines[i]
        line = raw.rstrip()
        stripped = line.strip()

        if in_code:
            if stripped.startswith("```"):
                add_code_block(doc, code)
                code = []
                in_code = False
            else:
                code.append(raw.rstrip("\n"))
            i += 1
            continue

        if stripped.startswith("```"):
            flush_quote()
            in_code = True
            i += 1
            continue

        if not stripped:
            flush_quote()
            i += 1
            continue

        if stripped.startswith("|"):
            flush_quote()
            block = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                block.append(lines[i].strip())
                i += 1
            header = [c.strip() for c in block[0].strip("|").split("|")]
            aligns = []
            body = []
            if len(block) > 1 and re.match(r"^\|[\s:\-|]+\|?$", block[1]):
                for cell in block[1].strip("|").split("|"):
                    c = cell.strip()
                    aligns.append("c" if c.startswith(":") and c.endswith(":")
                                  else "r" if c.endswith(":")
                                  else "l")
                body = block[2:]
            else:
                body = block[1:]
            rows = [[c.strip() for c in r.strip("|").split("|")] for r in body]
            add_table(doc, header, rows, aligns)
            continue

        m = re.match(r"^(#{1,4})\s+(.*)$", stripped)
        if m:
            flush_quote()
            level = len(m.group(1))
            text = m.group(2)
            add_heading(doc, text, level, new_page=level == 1)
            i += 1
            continue

        if stripped.startswith(">"):
            quote.append(stripped[1:].strip())
            i += 1
            continue

        if stripped in ("---", "***", "___"):
            i += 1
            continue

        m = re.match(r"^(\s*)[-*+]\s+(.*)$", raw)
        if m:
            flush_quote()
            level = len(m.group(1)) // 2
            text = m.group(2).strip()
            if text.startswith("[ ]"):
                add_list_item(doc, text[3:].strip(), level, "☐")
            elif text.startswith("[x]") or text.startswith("[X]"):
                add_list_item(doc, text[3:].strip(), level, "☒")
            else:
                add_list_item(doc, text, level, "•" if level == 0 else "◦")
            i += 1
            continue

        m = re.match(r"^(\s*)(\d+)\.\s+(.*)$", raw)
        if m:
            flush_quote()
            level = len(m.group(1)) // 3
            add_list_item(doc, m.group(3).strip(), level, "", number=f"{m.group(2)}.")
            i += 1
            continue

        flush_quote()
        para = doc.add_paragraph()
        if _code_heavy(stripped):
            # dòng chủ yếu là danh sách trường/mã → canh trái cho dễ đọc
            para.alignment = WD_ALIGN_PARAGRAPH.LEFT
        add_inline(para, stripped)
        i += 1

    if in_code and code:
        add_code_block(doc, code)


def add_cover(doc: Document) -> None:
    for _ in range(3):
        doc.add_paragraph()
    title = doc.add_paragraph()
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = title.add_run("HỆ THỐNG QUẢN LÝ ĐẶT VÉ XEM PHIM")
    _set_run_fonts(run, FONT)
    run.font.size = Pt(22)
    run.bold = True
    run.font.color.rgb = ACCENT

    title2 = doc.add_paragraph()
    title2.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = title2.add_run("PXU CINEMA")
    _set_run_fonts(run, FONT)
    run.font.size = Pt(28)
    run.bold = True
    run.font.color.rgb = ACCENT

    sub = doc.add_paragraph()
    sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
    sub.paragraph_format.space_before = Pt(18)
    run = sub.add_run("BỘ TÀI LIỆU PHÂN TÍCH – THIẾT KẾ HỆ THỐNG")
    _set_run_fonts(run, FONT)
    run.font.size = Pt(16)
    run.bold = True

    doc.add_paragraph()
    items = [
        "Tài liệu 1 – Nghiệp vụ hệ thống",
        "Tài liệu 2 – Giao diện (UI/UX)",
        "Tài liệu 3 – Kỹ thuật Frontend (React)",
        "Tài liệu 4 – Kỹ thuật Admin (React)",
    ]
    for item in items:
        para = doc.add_paragraph()
        para.alignment = WD_ALIGN_PARAGRAPH.CENTER
        para.paragraph_format.space_after = Pt(2)
        run = para.add_run(item)
        _set_run_fonts(run, FONT)
        run.font.size = Pt(13)

    for _ in range(6):
        doc.add_paragraph()

    meta = doc.add_paragraph()
    meta.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = meta.add_run("Phiên bản 2.0  ·  03/11/2026")
    _set_run_fonts(run, FONT)
    run.font.size = Pt(12)
    run.italic = True


def add_toc(doc: Document) -> None:
    heading = doc.add_paragraph()
    heading.alignment = WD_ALIGN_PARAGRAPH.CENTER
    heading.paragraph_format.space_after = Pt(8)
    run = heading.add_run("MỤC LỤC")
    _set_run_fonts(run, FONT)
    run.font.size = Pt(16)
    run.bold = True
    run.font.color.rgb = ACCENT

    para = doc.add_paragraph()
    run = para.add_run()
    begin = OxmlElement("w:fldChar")
    begin.set(qn("w:fldCharType"), "begin")
    instr = OxmlElement("w:instrText")
    instr.set(qn("xml:space"), "preserve")
    instr.text = f' TOC \\o "1-{TOC_LEVELS}" \\h \\z \\u '
    sep = OxmlElement("w:fldChar")
    sep.set(qn("w:fldCharType"), "separate")
    placeholder = OxmlElement("w:t")
    placeholder.text = "Mục lục sẽ được cập nhật khi mở bằng Microsoft Word (F9)."
    end = OxmlElement("w:fldChar")
    end.set(qn("w:fldCharType"), "end")
    run._r.append(begin)
    run._r.append(instr)
    run._r.append(sep)
    run._r.append(placeholder)
    run._r.append(end)


TOC_STYLE = {1: (11.5, True), 2: (11, False)}


def finalize_with_word(path: Path, pdf: Path | None) -> bool:
    """Dùng Microsoft Word cập nhật mục lục (sinh số trang thật) rồi lưu lại."""
    try:
        import win32com.client as win32
    except ImportError:
        print("Không có pywin32 – bỏ qua bước cập nhật mục lục.", file=sys.stderr)
        return False

    word = None
    try:
        word = win32.DispatchEx("Word.Application")
        word.Visible = False
        word.DisplayAlerts = 0
        doc = word.Documents.Open(str(path))
        if not doc.TablesOfContents.Count:
            return False
        doc.TablesOfContents(1).Update()
        for level, (size, bold) in TOC_STYLE.items():
            try:
                style = doc.Styles(f"toc {level}")
            except Exception:
                continue
            style.Font.Name = FONT
            style.Font.Size = size
            style.Font.Bold = bold
            style.ParagraphFormat.SpaceBefore = 0
            style.ParagraphFormat.SpaceAfter = 0
            style.ParagraphFormat.LineSpacingRule = 0  # wdLineSpaceSingle
        try:  # mục lục in ra giấy: chữ đen, không gạch chân
            link = doc.Styles("Hyperlink")
            link.Font.Color = -16777216  # wdColorAutomatic
            link.Font.Underline = 0      # wdUnderlineNone
        except Exception:
            pass
        doc.TablesOfContents(1).Update()
        doc.Repaginate()
        doc.Save()
        if pdf is not None:
            doc.ExportAsFixedFormat(str(pdf), 17)  # wdExportFormatPDF
        doc.Close(0)
        return True
    except Exception as exc:  # Word không cài / bị khóa
        print(f"Không cập nhật được mục lục bằng Word: {exc}", file=sys.stderr)
        return False
    finally:
        if word is not None:
            try:
                word.Quit()
            except Exception:
                pass


def main() -> int:
    doc = Document()
    setup_styles(doc)

    cover = doc.sections[0]
    setup_page(cover)
    cover.footer.is_linked_to_previous = False
    add_cover(doc)

    body = doc.add_section(WD_SECTION.NEW_PAGE)
    setup_page(body)
    add_page_number_footer(body, restart=1)

    add_toc(doc)

    for name in SOURCES:
        path = ROOT / name
        if not path.exists():
            print(f"Thiếu file: {path}", file=sys.stderr)
            return 1
        parse_markdown(doc, path)

    target = OUTPUT
    try:
        doc.save(target)
    except PermissionError:
        target = OUTPUT.with_name(f"{OUTPUT.stem}_gon{OUTPUT.suffix}")
        doc.save(target)
        print(f"File gốc đang mở trong Word — ghi bản gọn vào: {target.name}")
    print(f"Đã tạo: {target}")

    pdf = target.with_suffix(".pdf") if "--pdf" in sys.argv else None
    if finalize_with_word(target, pdf):
        print("Đã cập nhật mục lục (số trang thật).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
