import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertCircle, Loader2, ScrollText } from "lucide-react";
import {
  listPolicyTemplates,
  updatePolicyTemplate,
  type PolicyTemplate,
  type PolicyTemplateKind,
} from "@/lib/policy-templates.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/admin/policy-templates")({
  head: () => ({
    meta: [
      { title: "Policy templates, ResonaBed" },
      { name: "description", content: "Edit the policy wording templates new clinics start from." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PolicyTemplatesAdmin,
});

function PolicyTemplatesAdmin() {
  const list = useServerFn(listPolicyTemplates);
  const save = useServerFn(updatePolicyTemplate);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["policy-templates"],
    queryFn: () => list(),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-100">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
        <div className="text-sm">
          <p className="font-medium">Global sample wording, ships with every new clinic</p>
          <p className="text-amber-800/80 dark:text-amber-100/80">
            These templates are seeded into a new organisation's settings on creation.
            Each clinic must edit the wording before they can save their policies, so
            they explicitly own and acknowledge their legal responsibility for the
            final text. Changes here do not retroactively affect existing clinics.
          </p>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="space-y-6">
          {(data ?? []).map((tpl) => (
            <TemplateEditor
              key={tpl.kind}
              tpl={tpl}
              onSave={async (patch) => {
                await save({ data: { kind: tpl.kind, ...patch } });
                toast.success(`${labelFor(tpl.kind)} template saved`);
                qc.invalidateQueries({ queryKey: ["policy-templates"] });
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function labelFor(kind: PolicyTemplateKind) {
  return kind === "consent"
    ? "Consent"
    : kind === "privacy"
      ? "Privacy"
      : "Health & safety";
}

function TemplateEditor({
  tpl,
  onSave,
}: {
  tpl: PolicyTemplate;
  onSave: (patch: { title: string; body: string }) => Promise<void>;
}) {
  const [title, setTitle] = useState(tpl.title);
  const [body, setBody] = useState(tpl.body);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setTitle(tpl.title);
    setBody(tpl.body);
  }, [tpl.title, tpl.body]);
  const dirty = title !== tpl.title || body !== tpl.body;
  const mutation = useMutation({
    mutationFn: () => onSave({ title, body }),
    onSettled: () => setSaving(false),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ScrollText className="h-5 w-5 text-primary" />
          {labelFor(tpl.kind)} template
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <Label>Body (Markdown)</Label>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={16}
            className="font-mono text-xs"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Last updated {new Date(tpl.updated_at).toLocaleString()}
          </p>
        </div>
        <div>
          <Button
            disabled={!dirty || saving}
            onClick={() => {
              setSaving(true);
              mutation.mutate();
            }}
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
              </>
            ) : dirty ? (
              "Save template"
            ) : (
              "Saved"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
