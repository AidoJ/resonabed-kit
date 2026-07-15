import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUserContext } from "@/lib/user-context.functions";
import { updateOrgSettings, getSignedLogoUrl } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  head: () => ({ meta: [{ title: "Settings — Admin — ResonaBed" }] }),
  component: SettingsAdmin,
});

function SettingsAdmin() {
  const fetchCtx = useServerFn(getCurrentUserContext);
  const saveOrg = useServerFn(updateOrgSettings);
  const signLogo = useServerFn(getSignedLogoUrl);
  const qc = useQueryClient();
  const { data: ctx } = useQuery({ queryKey: ["user-context"], queryFn: () => fetchCtx() });

  const [name, setName] = useState("");
  const [brand, setBrand] = useState("#000000");
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (ctx?.org) {
      setName(ctx.org.name);
      setBrand(ctx.org.brandColor ?? "#000000");
    }
  }, [ctx?.org]);

  useEffect(() => {
    (async () => {
      if (ctx?.org?.logoPath) {
        try {
          const { url } = await signLogo({ data: { path: ctx.org.logoPath } });
          setLogoPreview(url);
        } catch {
          setLogoPreview(null);
        }
      } else {
        setLogoPreview(null);
      }
    })();
  }, [ctx?.org?.logoPath, signLogo]);

  const onSaveDetails = async () => {
    try {
      await saveOrg({ data: { name, brand_color: brand } });
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["user-context"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const onUploadLogo = async (file: File) => {
    if (!ctx?.org?.id) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
      const path = `${ctx.org.id}/logo.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("org-logos")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw new Error(upErr.message);
      await saveOrg({ data: { logo_path: path } });
      toast.success("Logo updated");
      qc.invalidateQueries({ queryKey: ["user-context"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>Organisation</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>Brand colour</Label>
            <div className="flex items-center gap-2">
              <Input
                type="color"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className="w-16 h-10 p-1"
              />
              <Input value={brand} onChange={(e) => setBrand(e.target.value)} className="font-mono" />
              <div
                className="h-10 w-10 rounded-md border"
                style={{ backgroundColor: brand }}
                aria-label="Brand colour preview"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Tints primary buttons, focus rings, and chart accents across the app for
              everyone in your organisation. Save to apply — the change is live immediately.
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={onSaveDetails}>Save</Button>
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  await saveOrg({ data: { name, brand_color: null } });
                  setBrand("#884bc7");
                  toast.success("Brand colour reset");
                  qc.invalidateQueries({ queryKey: ["user-context"] });
                } catch (e) {
                  toast.error((e as Error).message);
                }
              }}
            >
              Reset to ResonaBed default
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Logo</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {logoPreview ? (
            <img src={logoPreview} alt="Logo" className="max-h-32 border rounded" />
          ) : (
            <p className="text-sm text-muted-foreground">No logo uploaded.</p>
          )}
          <Input
            type="file"
            accept="image/*"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onUploadLogo(f);
            }}
          />
          <p className="text-xs text-muted-foreground">
            Stored privately, per-org. Only your organisation can view this logo.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
