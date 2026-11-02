import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Loader2, RotateCcw, Save, Upload, ZoomIn, ZoomOut } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { getSignedLogoUrl } from "@/lib/admin.functions";
import { saveFlyerDesign } from "@/lib/flyer-design.functions";
import { applyPalette, contrast, defaultFlyerDesign, flyerDesignSchema, hexRgb, paletteVariants, PANEL_IDS, PANEL_NAMES, readFlyerDesign, rgbHex, type FlyerDesign, type PanelColours, type PanelId } from "@/lib/flyer-design";
import { buildPanelFlyer, type FlyerIdentity } from "@/lib/flyer-panel-pdf";
import ownerLogo from "@/assets/resonabed-logo.png.asset.json";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

interface Clinic { id: string; name: string; public_contact_phone: string | null; public_contact_email: string | null; slug: string | null; logo_path: string | null; flyer_design: unknown; }
const ROLES: { key: keyof PanelColours; label: string }[] = [{ key: "background", label: "Panel background" }, { key: "accent", label: "Headings & accents" }, { key: "text", label: "Body text" }, { key: "box", label: "Inset / logo backing" }, { key: "boxText", label: "Inset text" }];

async function suggestColours(url: string): Promise<string[]> {
  const response = await fetch(url); if (!response.ok) return [];
  const objectUrl = URL.createObjectURL(await response.blob());
  try {
    const image = new Image(); await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = reject; image.src = objectUrl; });
    const canvas = document.createElement("canvas"); canvas.width = 100; canvas.height = 100;
    const ctx = canvas.getContext("2d", { willReadFrequently: true }); if (!ctx) return [];
    ctx.drawImage(image, 0, 0, 100, 100); const data = ctx.getImageData(0, 0, 100, 100).data;
    const bins = new Map<string, { count: number; r: number; g: number; b: number }>();
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i] ?? 0, g = data[i + 1] ?? 0, b = data[i + 2] ?? 0;
      if ((data[i + 3] ?? 0) < 180 || Math.max(r, g, b) - Math.min(r, g, b) < 25) continue;
      const key = [r, g, b].map((v) => Math.floor(v / 24)).join(","); const bin = bins.get(key) ?? { count: 0, r: 0, g: 0, b: 0 };
      bin.count++; bin.r += r; bin.g += g; bin.b += b; bins.set(key, bin);
    }
    return [...bins.values()].sort((a, b) => b.count - a.count).slice(0, 3).map((v) => rgbHex(v.r / v.count, v.g / v.count, v.b / v.count));
  } finally { URL.revokeObjectURL(objectUrl); }
}

export function FlyerEditor({ clinic }: { clinic: Clinic | null }) {
  const [design, setDesign] = useState<FlyerDesign>(() => defaultFlyerDesign());
  const [panel, setPanel] = useState<PanelId>("F1");
  const [view, setView] = useState<"both" | "front" | "back">("both");
  const [logoUrl, setLogoUrl] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [base, setBase] = useState("");
  const [busy, setBusy] = useState(false);
  const [rendering, setRendering] = useState(true);
  const [error, setError] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [saved, setSaved] = useState("");
  const [zoom, setZoom] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const save = useServerFn(saveFlyerDesign); const sign = useServerFn(getSignedLogoUrl);
  const current = design.panels[panel];
  const valid = flyerDesignSchema.safeParse(design).success;
  useEffect(() => {
    const initial = readFlyerDesign(clinic?.flyer_design, clinic?.public_contact_phone ?? "", clinic?.logo_path ?? null);
    setDesign(initial); setSaved(JSON.stringify(initial));
  }, [clinic?.id, clinic?.flyer_design]);
  useEffect(() => {
    let cancelled = false;
    setLogoUrl("");
    if (!design.logoPath) { if (!clinic) setLogoUrl(ownerLogo.url); return; }
    sign({ data: { path: design.logoPath } }).then((result) => { if (!cancelled) setLogoUrl(result.url); }).catch(() => { if (!cancelled) toast.error("Clinic logo could not be loaded."); });
    return () => { cancelled = true; };
  }, [design.logoPath, clinic?.id, sign]);
  useEffect(() => {
    let cancelled = false;
    suggestColours(logoUrl || ownerLogo.url).then((colours) => { if (!cancelled) { setSuggestions(colours); setBase(colours[0] ?? ""); } }).catch(() => { if (!cancelled) setSuggestions([]); });
    return () => { cancelled = true; };
  }, [logoUrl]);
  const identity = useMemo<FlyerIdentity>(() => ({ name: clinic?.name ?? "", email: clinic?.public_contact_email ?? "", website: clinic?.slug ? `resonabed.com/o/${clinic.slug}` : "", bookingUrl: clinic?.slug ? `https://resonabed.com/o/${clinic.slug}` : "", logoUrl }), [clinic?.name, clinic?.public_contact_email, clinic?.slug, logoUrl]);
  useEffect(() => {
    if (!valid) { setRendering(false); return; }
    let cancelled = false;
    setRendering(true); setError("");
    const timer = window.setTimeout(async () => {
      try {
        const blob = await buildPanelFlyer(design, identity);
        if (cancelled) return;
        const pdfjs = await import("pdfjs-dist/build/pdf.mjs"); pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
        const doc = await pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
        const next: string[] = [];
        try {
          for (let n = 1; n <= 2; n++) {
            const page = await doc.getPage(n); const viewport = page.getViewport({ scale: 1.7 }); const canvas = document.createElement("canvas"); canvas.width = viewport.width; canvas.height = viewport.height;
            const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("Preview unavailable");
            await page.render({ canvasContext: ctx, canvas, viewport }).promise;
            next.push(canvas.toDataURL("image/png"));
          }
          if (!cancelled) setImages(next);
        } finally { await doc.destroy(); }
      } catch (e) { if (!cancelled) setError(e instanceof Error ? e.message : "Preview unavailable"); }
      finally { if (!cancelled) setRendering(false); }
    }, 400);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [design, identity, valid]);
  const change = (key: keyof PanelColours, value: string) => setDesign((d) => ({ ...d, panels: { ...d.panels, [panel]: { ...d.panels[panel], [key]: value } } }));
  const upload = async (file: File) => {
    if (!clinic) return;
    if (!["image/png", "image/jpeg", "image/webp", "image/svg+xml"].includes(file.type) || file.size > 10 * 1024 * 1024) { toast.error("Choose a PNG, JPEG, WebP or SVG logo up to 10 MB."); return; }
    setBusy(true);
    try {
      const extension = file.type === "image/svg+xml" ? "svg" : file.type.split("/")[1]; const path = `${clinic.id}/flyer-${crypto.randomUUID()}.${extension}`;
      const { error } = await supabase.storage.from("org-logos").upload(path, file, { contentType: file.type }); if (error) throw error;
      setDesign((d) => ({ ...d, logoPath: path })); toast.success("Logo added to flyer. Save design to keep it.");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Logo upload failed"); } finally { setBusy(false); if (input.current) input.current.value = ""; }
  };
  const download = async () => {
    setBusy(true);
    try { const blob = await buildPanelFlyer(design, identity, true); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `resonabed-flyer-${(clinic?.name ?? "preview").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.pdf`; a.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Download failed"); } finally { setBusy(false); }
  };
  const dirty = saved !== JSON.stringify(design);
  const lowContrast = valid && (contrast(current.text, current.background) < 4.5 || contrast(current.accent, current.background) < 3 || contrast(current.boxText, current.box) < 4.5);
  const variants = base ? paletteVariants(base) : [];
  return <div className="space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-semibold">Client flyer</h1><p className="mt-1 text-sm text-muted-foreground">DL · Six-panel design</p></div><div className="flex flex-wrap gap-2">
      <Button variant="outline" disabled={busy} onClick={() => setDesign(defaultFlyerDesign(design.phone, design.logoPath))}><RotateCcw className="mr-2 h-4 w-4" />Reset colours</Button>
      <Button variant="outline" disabled={busy || !valid || !clinic || !dirty} onClick={async () => { setBusy(true); try { await save({ data: design }); setSaved(JSON.stringify(design)); toast.success("Flyer design saved."); } catch (e) { toast.error(e instanceof Error ? e.message : "Save failed"); } finally { setBusy(false); } }}><Save className="mr-2 h-4 w-4" />Save design</Button>
      <Button disabled={busy || !valid || rendering || !!error} onClick={download}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}Download PDF</Button>
    </div></header>
    <div className="grid items-start gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="space-y-6 border-b pb-6 xl:border-b-0 xl:border-r xl:pr-6">
        <section className="space-y-3"><h2 className="font-semibold">Clinic identity</h2>{logoUrl && <img src={logoUrl} alt={clinic ? "Clinic logo" : "Resonabed reference logo"} className="h-20 max-w-full object-contain object-left" />}
          <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) void upload(file); }} />
          <Button variant="outline" className="w-full" disabled={!clinic || busy} onClick={() => input.current?.click()}><Upload className="mr-2 h-4 w-4" />Upload clinic logo</Button>
          <div className="space-y-1.5"><Label htmlFor="flyer-phone">Phone number</Label><Input id="flyer-phone" value={design.phone} maxLength={60} disabled={!clinic} onChange={(e) => setDesign((d) => ({ ...d, phone: e.target.value }))} /></div>
          {clinic && <p className="text-sm text-muted-foreground">{clinic.name}</p>}
          {!clinic && <p className="text-sm text-muted-foreground">Resonabed mock-up · Choose a clinic to save its logo and phone.</p>}
        </section>
        <section className="space-y-3 border-t pt-5"><h2 className="font-semibold">Logo palette</h2><div className="flex flex-wrap gap-2">{suggestions.map((hex) => <Button key={hex} variant="outline" size="icon" title={hex} aria-label={`Suggest palette from ${hex}`} onClick={() => setBase(hex)} className={base === hex ? "ring-2 ring-ring" : ""}><span className="h-6 w-6 rounded-full border" style={{ backgroundColor: hex }} /></Button>)}</div>
          {variants.length > 0 && <><div className="flex h-8 overflow-hidden rounded border">{variants.map((hex) => <span key={hex} className="flex-1" style={{ backgroundColor: hex }} title={hex} />)}</div><Button variant="outline" className="w-full" onClick={() => setDesign((d) => applyPalette(d, base))}>Apply logo palette</Button></>}
        </section>
        <section className="space-y-4 border-t pt-5"><div><h2 className="font-semibold">{panel} · {PANEL_NAMES[panel]}</h2></div>
          {ROLES.filter((role) => !["box", "boxText"].includes(role.key) || ["F1", "F3", "B2"].includes(panel)).map(({ key, label }) => <div key={key} className="space-y-1.5"><Label htmlFor={`panel-${key}`}>{label}</Label><div className="flex gap-2"><Input type="color" aria-label={`${panel} ${label} picker`} className="h-10 w-12 shrink-0 p-1" value={/^#[\da-f]{6}$/i.test(current[key]) ? current[key] : "#000000"} onChange={(e) => change(key, e.target.value)} /><Input id={`panel-${key}`} aria-label={`${panel} ${label}`} className="font-mono uppercase" maxLength={7} value={current[key]} onChange={(e) => change(key, e.target.value.startsWith("#") ? e.target.value : `#${e.target.value}`)} /></div><div className="flex flex-wrap gap-1">{[...new Set([...variants, ...suggestions, "#ffffff", "#000000"])].map((hex) => <Button key={hex} variant="outline" size="icon" className="h-6 w-6" title={hex} aria-label={`Set ${label} to ${hex}`} onClick={() => change(key, hex)}><span className="h-4 w-4 rounded-full" style={{ backgroundColor: hex }} /></Button>)}</div></div>)}
          {!valid && <p role="alert" className="text-sm text-destructive">Enter complete six-digit colour codes.</p>}
          {lowContrast && <p role="status" className="text-sm text-destructive">Some text may be difficult to read against these colours.</p>}
        </section>
      </aside>
      <main className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex gap-1">{(["both", "front", "back"] as const).map((v) => <Button key={v} variant={view === v ? "secondary" : "ghost"} size="sm" aria-pressed={view === v} onClick={() => setView(v)}>{v === "both" ? "Both sides" : v === "front" ? "Front" : "Back"}</Button>)}</div><div className="flex items-center gap-3"><span className="text-xs text-muted-foreground" role="status">{rendering ? <span className="flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />Updating preview…</span> : dirty ? "Unsaved changes" : "Saved design"}</span><Button variant="outline" size="icon" title={zoom ? "Fit page" : "Zoom preview"} aria-label={zoom ? "Fit page" : "Zoom preview"} onClick={() => setZoom(!zoom)}>{zoom ? <ZoomOut className="h-4 w-4" /> : <ZoomIn className="h-4 w-4" />}</Button></div></div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="overflow-x-auto pb-3"><div className={zoom ? "min-w-[1200px] space-y-6" : "space-y-6"}>
          {[0, 1].filter((side) => view === "both" || (view === "front" ? side === 0 : side === 1)).map((side) => <section key={side} className="space-y-2"><h2 className="text-sm font-semibold">{side === 0 ? "Front / outside" : "Back / inside"}</h2><div className="grid grid-cols-3 gap-1">{PANEL_IDS.slice(side * 3, side * 3 + 3).map((id) => <Button key={id} variant={panel === id ? "secondary" : "outline"} className="h-auto min-h-10 flex-wrap gap-1 text-xs" aria-pressed={panel === id} onClick={() => setPanel(id)}><strong>{id}</strong><span className="hidden sm:inline">{PANEL_NAMES[id]}</span></Button>)}</div>
            <div className="relative aspect-[841.92/595.92] overflow-hidden border bg-muted">{images[side] ? <img src={images[side]} alt={`${side === 0 ? "Front" : "Back"} flyer preview`} className="h-full w-full" /> : <div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}<div className="absolute inset-0 grid grid-cols-3">{PANEL_IDS.slice(side * 3, side * 3 + 3).map((id) => <Button key={id} variant="ghost" aria-label={`Select ${id} ${PANEL_NAMES[id]}`} onClick={() => setPanel(id)} className={`h-full w-full rounded-none bg-transparent hover:bg-transparent ${panel === id ? "ring-2 ring-inset ring-ring" : "border-r border-border/30 last:border-r-0"}`} />)}</div></div>
          </section>)}
        </div></div>
      </main>
    </div>
  </div>;
}