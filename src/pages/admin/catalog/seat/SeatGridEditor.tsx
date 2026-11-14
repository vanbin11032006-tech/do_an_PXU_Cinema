import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Armchair, ArrowLeftRight, Ban, Crown, Eraser, Heart, Redo2, RotateCcw, Save, Square, Undo2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Seat, SeatType } from '@/types/domain';
import type { SeatLayoutCell } from '@/api';
import { cn } from '@/lib/format';
import { Button, Card, ConfirmDialog, Tooltip } from '@/components/ui';

export interface EditorCell extends SeatLayoutCell {
  y: number;
}

const TOOLS: { value: SeatType; label: string; icon: LucideIcon }[] = [
  { value: 'standard', label: 'Ghế thường', icon: Armchair },
  { value: 'vip', label: 'Ghế VIP', icon: Crown },
  { value: 'couple', label: 'Ghế đôi', icon: Heart },
  { value: 'disabled', label: 'Không bán', icon: Ban },
  { value: 'aisle', label: 'Lối đi', icon: ArrowLeftRight },
  { value: 'blank', label: 'Xóa ô', icon: Eraser },
];

const CELL_CLASS: Record<SeatType, string> = {
  standard: 'border-slate-500/80 bg-slate-600/85 text-white hover:border-sky-300/70',
  vip: 'border-gold/70 bg-brand/85 text-white hover:bg-brand',
  couple: 'border-pink-200/70 bg-couple/85 text-white hover:bg-couple',
  disabled: 'border-slate-700 bg-slate-900/80 text-slate-600 line-through',
  aisle: 'border-dashed border-line/80 bg-base/30 text-muted',
  blank: 'border-dashed border-line/40 bg-transparent text-transparent',
};

function buildModel(seats: Seat[]): { cells: EditorCell[]; rowLabels: string[]; cols: number } {
  const maxY = seats.length ? Math.max(...seats.map((seat) => seat.y)) : 7;
  const rows = Math.max(maxY + 1, 8);
  const cols = Math.max(seats.length ? Math.max(...seats.map((seat) => seat.x + seat.span)) : 14, 12);
  const seatByRow = new Map(seats.map((seat) => [seat.y, seat]));
  const usedLabels = new Set(seats.map((seat) => seat.row));
  let fallbackIndex = 0;
  const rowLabels = Array.from({ length: rows }, (_, y) => {
    const seat = seatByRow.get(y);
    if (seat) return seat.row;
    let label = String.fromCharCode(65 + fallbackIndex);
    while (usedLabels.has(label)) {
      fallbackIndex += 1;
      label = String.fromCharCode(65 + fallbackIndex);
    }
    fallbackIndex += 1;
    usedLabels.add(label);
    return label;
  });
  return { cells: seats.map((seat) => ({ ...seat })), rowLabels, cols };
}

function signatureOf(cells: EditorCell[]): string {
  return cells
    .map((cell) => `${cell.y}:${cell.x}:${cell.span}:${cell.type}:${cell.code}`)
    .sort()
    .join('|');
}

export function SeatGridEditor({ roomName, seats, saving, onSave, onCellsChange }: {
  roomName: string;
  seats: Seat[];
  saving: boolean;
  onSave: (cells: SeatLayoutCell[]) => void;
  onCellsChange: (cells: SeatLayoutCell[]) => void;
}) {
  const model = useMemo(() => buildModel(seats), [seats]);
  const [cells, setCells] = useState<EditorCell[]>(model.cells);
  const [tool, setTool] = useState<SeatType>('standard');
  const [past, setPast] = useState<EditorCell[][]>([]);
  const [future, setFuture] = useState<EditorCell[][]>([]);
  const [resetOpen, setResetOpen] = useState(false);
  const cellsRef = useRef(cells);
  const paintingRef = useRef(false);
  const strokeRecordedRef = useRef(false);
  const initialSignature = useRef(signatureOf(model.cells));

  useEffect(() => { cellsRef.current = cells; onCellsChange(cells); }, [cells, onCellsChange]);

  useEffect(() => {
    const stop = () => { paintingRef.current = false; strokeRecordedRef.current = false; };
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    return () => {
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
    };
  }, []);

  const paint = (y: number, x: number, recordHistory: boolean) => {
    const current = cellsRef.current;
    const row = model.rowLabels[y];
    if (!row) return;
    const span = tool === 'couple' ? 2 : 1;
    if (x + span > model.cols) return;
    const covering = current.find((cell) => cell.y === y && x >= cell.x && x < cell.x + cell.span);
    if (tool === 'blank') {
      if (!covering) return;
    } else if (covering && covering.x === x && covering.span === span && covering.type === tool) {
      return;
    }

    const taken = new Set(current.map((cell) => cell.code).filter(Boolean));
    const usedCols = new Set(current.filter((cell) => cell.y === y).map((cell) => cell.col));
    const makeCol = (start: number) => {
      let col = Math.max(1, start);
      while (usedCols.has(col)) col += 1;
      usedCols.add(col);
      return col;
    };
    const makeCode = (start: number) => {
      let index = Math.max(1, start);
      let code = `${row}${String(index).padStart(2, '0')}`;
      while (taken.has(code)) {
        index += 1;
        code = `${row}${String(index).padStart(2, '0')}`;
      }
      taken.add(code);
      return code;
    };

    const remaining = current.filter((cell) => !(cell.y === y && x < cell.x + cell.span && cell.x < x + span));
    let next = remaining;
    if (tool !== 'blank') {
      const keepCode = covering && covering.x === x && covering.span === span && covering.code;
      const code = tool === 'couple'
        ? `${makeCode(x + 1)}-${makeCode(x + 2)}`
        : tool === 'aisle'
          ? ''
          : keepCode
            ? covering.code
            : makeCode(x + 1);
      next = [...remaining, {
        row,
        col: keepCode && covering ? covering.col : makeCol(x + 1),
        x,
        y,
        span,
        type: tool,
        code,
      }];
    }
    next.sort((a, b) => a.y - b.y || a.x - b.x);
    if (recordHistory || (paintingRef.current && !strokeRecordedRef.current)) {
      setPast((history) => [...history.slice(-49), current]);
      setFuture([]);
      strokeRecordedRef.current = true;
    }
    cellsRef.current = next;
    setCells(next);
  };

  const undo = () => {
    if (!past.length) return;
    const current = cellsRef.current;
    const previous = past[past.length - 1];
    setPast(past.slice(0, -1));
    setFuture([current, ...future]);
    cellsRef.current = previous;
    setCells(previous);
  };

  const redo = () => {
    if (!future.length) return;
    const current = cellsRef.current;
    const next = future[0];
    setPast([...past.slice(-49), current]);
    setFuture(future.slice(1));
    cellsRef.current = next;
    setCells(next);
  };

  const stats = cells.reduce<Record<SeatType, number>>((acc, cell) => {
    acc[cell.type] += 1;
    return acc;
  }, { standard: 0, vip: 0, couple: 0, disabled: 0, aisle: 0, blank: 0 });
  const seatCount = stats.standard + stats.vip + stats.couple;
  const dirty = signatureOf(cells) !== initialSignature.current;
  const activeTool = TOOLS.find((item) => item.value === tool) ?? TOOLS[0];

  const sortedCells = [...cells].sort((a, b) => a.y - b.y || a.x - b.x);

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-line/70 bg-base/40 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {TOOLS.map((item) => (
              <Tooltip key={item.value} content={item.label}>
                <button
                  type="button"
                  aria-pressed={tool === item.value}
                  aria-label={item.label}
                  onClick={() => setTool(item.value)}
                  className={cn(
                    'inline-flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-semibold transition',
                    tool === item.value ? 'border-brand bg-brand/15 text-brand' : 'border-line bg-surface text-ink2 hover:border-brand/40 hover:text-ink',
                  )}
                >
                  <item.icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{item.label}</span>
                </button>
              </Tooltip>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="icon" aria-label="Hoàn tác" disabled={!past.length} onClick={undo}><Undo2 className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" aria-label="Làm lại" disabled={!future.length} onClick={redo}><Redo2 className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" aria-label="Đặt lại sơ đồ" disabled={!dirty} onClick={() => setResetOpen(true)}><RotateCcw className="h-4 w-4" /></Button>
            <Button size="sm" icon={<Save className="h-3.5 w-3.5" />} disabled={!dirty || saving} loading={saving} onClick={() => onSave(sortedCells)}>
              Lưu sơ đồ
            </Button>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-muted">
          Đang tô: <span className="font-semibold text-ink">{activeTool.label}</span> · Kéo chuột để tô liên tục · Nhấn Enter/Space để tô một ô · Ô đôi chiếm 2 cột.
        </p>
      </div>

      <div className="overflow-x-auto p-3 sm:p-4">
        <div className="mx-auto touch-none" style={{ width: 'max-content', minWidth: '100%' }}>
          {model.rowLabels.map((rowLabel, y) => {
            const startCells = cells
              .filter((cell) => cell.y === y)
              .reduce<Record<number, EditorCell>>((acc, cell) => { acc[cell.x] = cell; return acc; }, {});
            return (
              <div key={`${rowLabel}-${y}`} className="flex items-center gap-1.5 py-0.5">
                <span className="w-5 shrink-0 text-center text-[10px] font-bold uppercase text-muted">{rowLabel}</span>
                <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${model.cols}, minmax(26px, 32px))` }}>
                  {(() => {
                    const nodes = [];
                    let x = 0;
                    while (x < model.cols) {
                      const cell = startCells[x];
                      if (cell) {
                        nodes.push(
                          <button
                            key={`${y}-${x}`}
                            type="button"
                            aria-label={cell.type === 'aisle' || cell.type === 'blank'
                              ? `${rowLabel}${x + 1} ${cell.type === 'aisle' ? 'lối đi' : 'ô trống'}`
                              : `Ghế ${cell.code}, hàng ${rowLabel} cột ${x + 1}`}
                            style={{ gridColumn: `span ${Math.min(cell.span, model.cols - x)}` }}
                            onPointerDown={(event) => {
                              event.preventDefault();
                              paintingRef.current = true;
                              strokeRecordedRef.current = false;
                              paint(y, x, true);
                            }}
                            onPointerEnter={() => { if (paintingRef.current) paint(y, x, false); }}
                            onKeyDown={(event) => {
                              if (event.key !== 'Enter' && event.key !== ' ') return;
                              event.preventDefault();
                              paint(y, x, true);
                            }}
                            className={cn(
                              'relative flex h-8 items-center justify-center rounded-md border text-[9px] font-bold transition',
                              CELL_CLASS[cell.type],
                              cell.type === 'aisle' && 'text-[8px] tracking-[0.2em]',
                            )}
                          >
                            {cell.type === 'couple' ? <Heart className="h-3 w-3" />
                              : cell.type === 'aisle' ? <span className="text-[8px]">LỐI</span>
                                : cell.type === 'disabled' ? <Ban className="h-3 w-3" />
                                  : <span className="truncate px-0.5">{cell.code.replace(rowLabel, '')}</span>}
                          </button>,
                        );
                        x += cell.span;
                      } else {
                        nodes.push(
                          <button
                            key={`${y}-${x}`}
                            type="button"
                            aria-label={`Ô trống hàng ${rowLabel} cột ${x + 1}`}
                            onPointerDown={(event) => {
                              event.preventDefault();
                              paintingRef.current = true;
                              strokeRecordedRef.current = false;
                              paint(y, x, true);
                            }}
                            onPointerEnter={() => { if (paintingRef.current) paint(y, x, false); }}
                            onKeyDown={(event) => {
                              if (event.key !== 'Enter' && event.key !== ' ') return;
                              event.preventDefault();
                              paint(y, x, true);
                            }}
                            className="flex h-8 items-center justify-center rounded-md border border-dashed border-line/40 bg-transparent text-[9px] text-transparent transition hover:border-brand/40 hover:bg-white/5 focus-visible:border-brand focus-visible:text-brand"
                          >
                            <Square className="h-2.5 w-2.5 opacity-0" />
                          </button>,
                        );
                        x += 1;
                      }
                    }
                    return nodes;
                  })()}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 border-t border-line/70 bg-base/30 px-3 py-3 sm:grid-cols-4">
        <div className="rounded-lg border border-line/60 bg-surface/70 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-muted">Tổng ghế bán</p>
          <p className="font-display text-lg font-bold text-ink">{seatCount}</p>
        </div>
        <div className="rounded-lg border border-line/60 bg-surface/70 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-muted">Thường / VIP</p>
          <p className="font-display text-lg font-bold text-ink">{stats.standard} / {stats.vip}</p>
        </div>
        <div className="rounded-lg border border-line/60 bg-surface/70 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-muted">Ghế đôi</p>
          <p className="font-display text-lg font-bold text-ink">{stats.couple}</p>
        </div>
        <div className="rounded-lg border border-line/60 bg-surface/70 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-muted">Không bán / lối đi</p>
          <p className="font-display text-lg font-bold text-ink">{stats.disabled} / {stats.aisle}</p>
        </div>
      </div>

      <ConfirmDialog
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        onConfirm={() => {
          const fresh = model.cells.map((cell) => ({ ...cell }));
          cellsRef.current = fresh;
          setCells(fresh);
          setPast([]);
          setFuture([]);
          setResetOpen(false);
        }}
        title="Đặt lại sơ đồ?"
        description={`Mọi thay đổi chưa lưu của ${roomName} sẽ bị hủy và quay về sơ đồ đang lưu trên hệ thống.`}
        confirmText="Đặt lại"
        danger
      />
    </Card>
  );
}
