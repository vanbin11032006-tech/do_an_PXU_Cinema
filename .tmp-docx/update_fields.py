import json, os
import win32com.client as win32

BASE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(BASE, ".."))
DOCX = os.path.join(ROOT, "PXU_CINEMA_BAO_CAO_DO_AN.docx")
PDF = os.path.join(BASE, "preview.pdf")

with open(os.path.join(BASE, "tables.json"), encoding="utf-8") as f:
    specs = json.load(f)

TOTAL_PT = 9581 / 20.0  # 6.65 in text width

word = win32.Dispatch("Word.Application")
word.Visible = False
word.DisplayAlerts = 0
doc = word.Documents.Open(DOCX)
try:
    assert doc.Tables.Count == len(specs), (doc.Tables.Count, len(specs))
    for index, widths in enumerate(specs, start=1):
        table = doc.Tables(index)
        table.PreferredWidthType = 2
        table.PreferredWidth = 100
        table.AutoFitBehavior(0)
        table.AllowAutoFit = False
        total = sum(widths)
        for col, weight in enumerate(widths, start=1):
            table.Columns(col).SetWidth(ColumnWidth=TOTAL_PT * weight / total, RulerStyle=0)
    doc.Fields.Update()
    for toc in doc.TablesOfContents:
        toc.Update()
    doc.Repaginate()
    doc.Save()
    doc.ExportAsFixedFormat(PDF, 17)
    print("pages:", doc.ComputeStatistics(2), "tables:", doc.Tables.Count)
finally:
    doc.Close(False)
    word.Quit()
print("pdf", os.path.getsize(PDF))
