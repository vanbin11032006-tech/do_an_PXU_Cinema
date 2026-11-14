#!/usr/bin/env python3
"""Bơm hiệu ứng động vào PXU_CINEMA_BAO_CAO.pptx bằng PowerPoint COM.

- Mỗi cụm shape cùng tên (vd. card + tiêu đề + mô tả) vào cùng một nhịp.
- Tiêu đề slide: Rise Up. Nội dung, ảnh, card: Fade, so le 0.05s.
- Trigger "With Previous" để cả slide tự diễn khi vào, không cần bấm.

Chạy sau scripts/build_pptx.py.
"""
from __future__ import annotations

import os
from pathlib import Path

import win32com.client as win32

ROOT = Path(__file__).resolve().parent.parent
DECK = ROOT / "PXU_CINEMA_BAO_CAO.pptx"

FADE = 10
RISE_UP = 28
WITH_PREVIOUS = 2


def main() -> None:
    app = win32.DispatchEx("PowerPoint.Application")
    pres = None
    try:
        pres = app.Presentations.Open(str(DECK), WithWindow=False)
        for idx in range(1, pres.Slides.Count + 1):
            slide = pres.Slides(idx)
            groups: dict[int, list] = {}
            for shape in slide.Shapes:
                name = shape.Name
                if len(name) > 1 and name[0] == "A" and name[1:].isdigit():
                    num = int(name[1:])
                    if num >= 97:  # frames, footer rules
                        continue
                    groups.setdefault(num, []).append(shape)
            for order, num in enumerate(sorted(groups)):
                shapes = groups[num]
                effect_id = RISE_UP if num == 2 else FADE
                for k, shape in enumerate(shapes):
                    eff = slide.TimeLine.MainSequence.AddEffect(
                        shape, effect_id, 0, WITH_PREVIOUS)
                    eff.Timing.Duration = 0.55 if num == 2 else 0.45
                    eff.Timing.TriggerDelayTime = min(0.05 * order, 0.70)
            print(f"slide {idx:02d}: {len(groups)} groups, "
                  f"{slide.TimeLine.MainSequence.Count} effects")
        pres.Save()
        print("saved", DECK)
    finally:
        if pres is not None:
            pres.Close()
        app.Quit()


if __name__ == "__main__":
    main()
