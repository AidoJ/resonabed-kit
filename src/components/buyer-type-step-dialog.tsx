import { useState } from "react";
import { Building2, User } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type BusinessBuyerDetails = {
  businessName: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  abn?: string;
};

export type BuyerTypeContinuePayload =
  | { buyerType: "personal" }
  | { buyerType: "business"; business: BusinessBuyerDetails };

/**
 * The buyer says which they are before paying. Personal buyers go straight to
 * the home-app access code; business buyers go to the clinic onboarding queue.
 * We never infer this after the fact.
 */
export function BuyerTypeStepDialog({
  open,
  onOpenChange,
  packageName,
  onContinue,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  packageName: string;
  onContinue: (payload: BuyerTypeContinuePayload) => void;
}) {
  const [choice, setChoice] = useState<"personal" | "business" | null>(null);
  const [form, setForm] = useState({
    businessName: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    abn: "",
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const businessValid =
    form.businessName.trim().length >= 2 &&
    form.contactName.trim().length >= 1 &&
    /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.contactEmail.trim());

  const handleContinue = () => {
    if (choice === "personal") {
      onContinue({ buyerType: "personal" });
      return;
    }
    if (choice === "business" && businessValid) {
      onContinue({
        buyerType: "business",
        business: {
          businessName: form.businessName.trim(),
          contactName: form.contactName.trim(),
          contactEmail: form.contactEmail.trim(),
          contactPhone: form.contactPhone.trim() || undefined,
          abn: form.abn.trim() || undefined,
        },
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl">
            Before you pay, who is this {packageName} for?
          </DialogTitle>
          <DialogDescription>
            Pick one. It decides how your account is set up after payment, and it does not change
            the price.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setChoice("personal")}
            className={
              "rounded-xl border p-4 text-left transition " +
              (choice === "personal"
                ? "border-brand-violet bg-brand-violet/5 ring-1 ring-brand-violet"
                : "border-border hover:border-brand-violet/50")
            }
          >
            <User className="h-5 w-5 text-brand-violet-strong" />
            <div className="mt-2 text-base font-semibold">For my own use at home</div>
            <p className="mt-1 text-xs text-muted-foreground">
              You are buying it for yourself, family or friends, not to charge clients. We email a
              one-time code the moment you pay, and you set up the personal app yourself in
              minutes. No clinic details needed.
            </p>
          </button>

          <button
            type="button"
            onClick={() => setChoice("business")}
            className={
              "rounded-xl border p-4 text-left transition " +
              (choice === "business"
                ? "border-brand-violet bg-brand-violet/5 ring-1 ring-brand-violet"
                : "border-border hover:border-brand-violet/50")
            }
          >
            <Building2 className="h-5 w-5 text-brand-violet-strong" />
            <div className="mt-2 text-base font-semibold">For my clinic or practice</div>
            <p className="mt-1 text-xs text-muted-foreground">
              You will offer sessions to paying clients. We set up your clinic account, bookings
              and public page by hand, then email your login within one business day.
            </p>
          </button>
        </div>

        {!choice ? (
          <p className="text-center text-xs text-muted-foreground">
            Choose one to continue to payment.
          </p>
        ) : null}

        {choice === "business" ? (
          <div className="space-y-3 rounded-xl border bg-muted/30 p-4">
            <p className="text-xs text-muted-foreground">
              We set each clinic up by hand, so your details are correct from day one. Expect your
              login by email within one business day of payment.
            </p>
            <div className="space-y-1.5">
              <Label>Clinic or business name</Label>
              <Input value={form.businessName} onChange={set("businessName")} maxLength={160} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Contact name</Label>
                <Input value={form.contactName} onChange={set("contactName")} maxLength={120} />
              </div>
              <div className="space-y-1.5">
                <Label>Contact email</Label>
                <Input
                  type="email"
                  value={form.contactEmail}
                  onChange={set("contactEmail")}
                  maxLength={200}
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Phone (optional)</Label>
                <Input value={form.contactPhone} onChange={set("contactPhone")} maxLength={40} />
              </div>
              <div className="space-y-1.5">
                <Label>ABN (optional)</Label>
                <Input value={form.abn} onChange={set("abn")} maxLength={20} />
              </div>
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleContinue}
            disabled={!choice || (choice === "business" && !businessValid)}
          >
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
