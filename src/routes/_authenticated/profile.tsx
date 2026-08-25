import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getMyProfile, updateMyProfile } from "@/lib/profile.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { User } from "lucide-react";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "My profile, ResonaBed" },
      {
        name: "description",
        content: "Update your ResonaBed display name, contact number, bio and headshot.",
      },
      { property: "og:title", content: "My profile, ResonaBed" },
      {
        property: "og:description",
        content: "Update your ResonaBed display name, contact number, bio and headshot.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MyProfilePage,
});

function MyProfilePage() {
  const fetchProfile = useServerFn(getMyProfile);
  const save = useServerFn(updateMyProfile);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => fetchProfile(),
  });

  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [pwBusy, setPwBusy] = useState(false);

  const pwRuleResults = passwordRules.map((r) => ({ ...r, ok: r.test(pw) }));
  const pwAllPass = pwRuleResults.every((r) => r.ok);
  const canChangePw = pwAllPass && pw === pw2 && !pwBusy;

  useEffect(() => {
    if (!data) return;
    setDisplayName(data.displayName ?? "");
    setPhone(data.phone ?? "");
    setBio(data.bio ?? "");
  }, [data]);

  const onFile = (f: File | null) => {
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  };

  const onSave = async () => {
    if (!data) return;
    if (!displayName.trim()) {
      toast.error("Display name is required");
      return;
    }
    setSaving(true);
    try {
      let avatar_path: string | undefined;
      if (file) {
        const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
        const folder = data.orgId ?? "platform";
        const path = `${folder}/${data.userId}.${ext}`;
        const { error } = await supabase.storage
          .from("team-avatars")
          .upload(path, file, { upsert: true, contentType: file.type });
        if (error) throw new Error(error.message);
        avatar_path = path;
      }
      await save({
        data: {
          display_name: displayName,
          phone,
          bio,
          ...(avatar_path ? { avatar_path } : {}),
        },
      });
      toast.success("Profile updated");
      setFile(null);
      setPreview(null);
      qc.invalidateQueries({ queryKey: ["my-profile"] });
      qc.invalidateQueries({ queryKey: ["user-context"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (isLoading || !data) {
    return <Skeleton className="h-64 w-full max-w-2xl" />;
  }

  const initials = (displayName || data.email || "?")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">My profile</h1>
        <p className="text-sm text-muted-foreground">
          {data.orgName ?? "Resonabed platform"} · {data.email}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
          <CardDescription>
            Your display name appears across the app and on clinic-facing screens.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src={preview ?? data.avatarSignedUrl ?? undefined} alt={displayName} />
              <AvatarFallback>{initials || <User className="h-6 w-6" />}</AvatarFallback>
            </Avatar>
            <div className="space-y-2">
              <Label htmlFor="avatar">Headshot</Label>
              <Input
                id="avatar"
                type="file"
                accept="image/*"
                onChange={(e) => onFile(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="display_name">Display name</Label>
            <Input
              id="display_name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={120}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Contact number</Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={40}
              placeholder="Optional"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio">Short bio</Label>
            <Textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={5}
              maxLength={2000}
              placeholder="A few lines about your background and approach."
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button onClick={onSave} disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
