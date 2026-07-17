import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const PRESET_SWATCHES: { hex: string; name: string }[] = [
  { hex: "#26106c", name: "Deep indigo" },
  { hex: "#884bc7", name: "Violet" },
  { hex: "#4f46e5", name: "Indigo" },
  { hex: "#2563eb", name: "Blue" },
  { hex: "#0891b2", name: "Cyan" },
  { hex: "#0d9488", name: "Teal" },
  { hex: "#059669", name: "Emerald" },
  { hex: "#65a30d", name: "Lime" },
  { hex: "#ca8a04", name: "Amber" },
  { hex: "#ea580c", name: "Orange" },
  { hex: "#dc2626", name: "Red" },
  { hex: "#db2777", name: "Pink" },
  { hex: "#9333ea", name: "Purple" },
  { hex: "#525252", name: "Graphite" },
  { hex: "#1f2937", name: "Ink" },
  { hex: "#000000", name: "Black" },
];

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export function BrandColorPicker({
  id,
  label = "Brand colour",
  description = "Pick a swatch, use the picker, or paste a hex code.",
  value,
  onChange,
}: {
  id?: string;
  label?: string;
  description?: string;
  value: string;
  onChange: (hex: string) => void;
}) {
  const current = HEX_RE.test(value) ? value : "";
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <Label htmlFor={id}>{label}</Label>
        {current && (
          <span className="font-mono text-[11px] uppercase text-muted-foreground">{current}</span>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>
      <div className="flex items-center gap-2">
        <Input
          type="color"
          value={current || "#884bc7"}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-14 shrink-0 cursor-pointer p-1"
          aria-label="Colour picker"
        />
        <Input
          id={id}
          placeholder="#884bc7"
          value={value}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "" || /^#?[0-9a-fA-F]{0,6}$/.test(v)) {
              onChange(v.startsWith("#") || v === "" ? v : `#${v}`);
            }
          }}
          className="font-mono uppercase"
          maxLength={7}
        />
      </div>
      <div className="grid grid-cols-8 gap-1.5 pt-1">
        {PRESET_SWATCHES.map((s) => {
          const selected = current.toLowerCase() === s.hex.toLowerCase();
          return (
            <button
              key={s.hex}
              type="button"
              onClick={() => onChange(s.hex)}
              title={`${s.name} · ${s.hex}`}
              aria-label={`Use ${s.name}`}
              className={`h-7 w-7 rounded-full border transition-transform hover:scale-110 ${
                selected ? "ring-2 ring-offset-2 ring-ring border-transparent" : "border-border"
              }`}
              style={{ backgroundColor: s.hex }}
            />
          );
        })}
      </div>
    </div>
  );
}
