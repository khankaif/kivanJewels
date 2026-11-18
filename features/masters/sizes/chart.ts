// Size chart rules, pure. Tested in tests/sizes.test.ts.

export type ShapeRef = { shape: string; code: string };

/** A size as the chart holds it. width2 is a tapered baguette's narrow end. */
export type SizeFields = {
  shape: string;
  length_mm: number; width_mm: number; width2_mm: number | null;
  min_ct: number; max_ct: number;
  active: boolean;
};
export type SavedSize = SizeFields & { id: string; used: number };

/** The columns the import reads and the export writes, in order. */
export const SIZE_COLUMNS = ['size_id', 'shape', 'length_mm', 'width_mm', 'width2_mm', 'carats', 'active'] as const;

/** 4.00 -> "4", 1.30 -> "1.3": mm and carats as people write them. */
export const trim = (n: number) => String(Number(n.toFixed(4)));

/**
 * The Size ID a new size gets: shape code + mm. A round (length = width)
 * shows one figure: RBC-1.3, PS-4X2.5, TBAG-6.3X3.15X1.89.
 */
export function baseId(code: string, s: Pick<SizeFields, 'length_mm' | 'width_mm' | 'width2_mm'>) {
  const mm = s.width2_mm != null
    ? [s.length_mm, s.width_mm, s.width2_mm]
    : s.length_mm === s.width_mm ? [s.length_mm] : [s.length_mm, s.width_mm];
  return `${code}-${mm.map(trim).join('X')}`;
}

/**
 * An unused ID for a new size. When the chart already has that mm at another
 * weight (square cushion 5.3 x 5.3 is 0.75 and 0.80 ct), the carats are
 * appended: CMB-5.3-0.8.
 */
export function newId(code: string, s: SizeFields, taken: Set<string>) {
  const base = baseId(code, s);
  return taken.has(base) ? `${base}-${trim(s.min_ct)}` : base;
}

/**
 * Single carat weight per stone, e.g. "0.014" or "0.0145".
 * If a legacy file supplies a range (e.g. "0.014-0.015"), Option A takes the minimum (0.014).
 */
export function parseCarats(raw: string): { min_ct: number; max_ct: number } | null {
  const m = raw.trim().match(/^(\d*\.?\d+)\s*(?:[-–]\s*(\d*\.?\d+))?\s*(?:ct)?$/i);
  if (!m) return null;
  const ct = Number(m[1]);
  return ct > 0 && ct <= 100 ? { min_ct: ct, max_ct: ct } : null;
}

/** Single nominal carat weight for this size. */
export const nominalCarats = (s: Pick<SizeFields, 'min_ct' | 'max_ct'>) => s.min_ct;

export const caratsLabel = (s: Pick<SizeFields, 'min_ct' | 'max_ct'>) =>
`${trim(s.min_ct)} ct`;

export const mmLabel = (s: Pick<SizeFields, 'length_mm' | 'width_mm' | 'width2_mm'>) =>
  s.width2_mm != null ? `${trim(s.length_mm)} × ${trim(s.width_mm)}/${trim(s.width2_mm)} mm`
    : s.length_mm === s.width_mm ? `⌀ ${trim(s.length_mm)} mm`
      : `${trim(s.length_mm)} × ${trim(s.width_mm)} mm`;

const mmValue = (raw: string | undefined, label: string, required: boolean): number | null | string => {
  const t = String(raw ?? '').trim();
  if (!t) return required ? `${label} is required.` : null;
  const n = Number(t);
  return Number.isFinite(n) && n > 0 && n < 1000 ? Math.round(n * 100) / 100 : `${label} "${t}" is not a size in mm.`;
};

/** One size from a form or CSV row, or the reason it can't be one. */
export function readSize(
  get: (c: (typeof SIZE_COLUMNS)[number]) => string | undefined,
  shapes: ShapeRef[],
): { size: SizeFields; id: string | null } | { error: string } {
  const shapeRaw = String(get('shape') ?? '').trim().toLowerCase();
  const shape = shapes.find((s) => s.shape.toLowerCase() === shapeRaw || s.code.toLowerCase() === shapeRaw);
  if (!shape) return { error: shapeRaw ? `"${get('shape')}" is not a shape in the master.` : 'Shape is required.' };

  const length = mmValue(get('length_mm'), 'Length', true);
  const width = mmValue(get('width_mm'), 'Width', true);
  const width2 = mmValue(get('width2_mm'), 'Narrow width', false);
  for (const v of [length, width, width2]) if (typeof v === 'string') return { error: v };

  const carats = parseCarats(String(get('carats') ?? ''));
  if (!carats) return { error: `Carats "${get('carats') ?? ''}" must be a number (e.g. 0.014 or 0.0145).` };

  const activeRaw = String(get('active') ?? '').trim().toLowerCase();
  if (activeRaw && !['yes', 'no', 'y', 'n', '1', '0', 'true', 'false'].includes(activeRaw)) {
    return { error: `Active "${get('active')}" must be yes or no.` };
  }
  const id = String(get('size_id') ?? '').trim().toUpperCase() || null;
  if (id && !/^[A-Z0-9][A-Z0-9.X-]{0,23}$/.test(id)) return { error: `Size ID "${id}": letters, digits, dots and dashes.` };

  return {
    id,
    size: {
      shape: shape.shape,
      length_mm: length as number, width_mm: width as number, width2_mm: width2 as number | null,
      ...carats,
      active: !['no', 'n', '0', 'false'].includes(activeRaw),
    },
  };
}

const sameSize = (a: SizeFields, b: SizeFields) =>
  a.shape === b.shape && a.length_mm === b.length_mm && a.width_mm === b.width_mm
  && (a.width2_mm ?? null) === (b.width2_mm ?? null) && a.min_ct === b.min_ct && a.max_ct === b.max_ct;
const sameFields = (a: SizeFields, b: SizeFields) => sameSize(a, b) && a.active === b.active;

export type SizePlan = {
  add: (SizeFields & { id: string })[];
  update: { id: string; before: SavedSize; after: SizeFields }[];
  unchanged: number;
  errors: string[];
};

/**
 * What importing these rows would do to the saved chart, without doing it.
 *
 * A row with a size_id edits that size; without one it adds a size, or
 * matches one already saved with the same shape, mm and carats (so the
 * client's chart can be uploaded twice: the import is idempotent). Sizes the
 * file leaves out are kept: lots stand on them, so removing is a deliberate
 * delete or retire on the page, never a side effect of a shorter file.
 */
export function planSizes(
  rows: { line: number; read: ReturnType<typeof readSize> }[],
  saved: SavedSize[],
  shapes: ShapeRef[],
): SizePlan {
  const plan: SizePlan = { add: [], update: [], unchanged: 0, errors: [] };
  const byId = new Map(saved.map((s) => [s.id, s]));
  const taken = new Set(saved.map((s) => s.id));
  const seen: { line: number; size: SizeFields }[] = [];
  const codeOf = new Map(shapes.map((s) => [s.shape, s.code]));

  for (const { line, read } of rows) {
    if ('error' in read) { plan.errors.push(`Row ${line}: ${read.error}`); continue; }
    const { size, id } = read;
    const dup = seen.find((s) => sameSize(s.size, size));
    if (dup) { plan.errors.push(`Row ${line}: same size as row ${dup.line}.`); continue; }
    seen.push({ line, size });

    const before = id ? byId.get(id) : saved.find((s) => sameSize(s, size));
    if (id && !before) {
      plan.errors.push(`Row ${line}: no saved size ${id}. Leave size_id blank to add a new size.`);
    } else if (before) {
      if (before.shape !== size.shape) {
        plan.errors.push(`Row ${line}: ${before.id} is a ${before.shape}; a size can't change shape. Add a new size instead.`);
      } else if (sameFields(before, size)) plan.unchanged++;
      else plan.update.push({ id: before.id, before, after: size });
    } else {
      const nid = newId(codeOf.get(size.shape)!, size, taken);
      if (taken.has(nid)) { plan.errors.push(`Row ${line}: Size ID ${nid} is taken; give this row a size_id.`); continue; }
      taken.add(nid);
      plan.add.push({ ...size, id: nid });
    }
  }
  return plan;
}
