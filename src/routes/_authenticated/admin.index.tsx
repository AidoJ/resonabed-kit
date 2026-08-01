import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [{ title: "Admin overview, ResonaBed" }] }),
  component: AdminIndex,
});

function AdminIndex() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <Card>
        <CardHeader><CardTitle>Services</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Set up the services you offer, their duration, and price.
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Team</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Invite practitioners and other admins, change roles, deactivate accounts.
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Clients</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Search your client base, edit details, and view session history.
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Reports</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Sessions per week/month, revenue by payment method, unpaid sessions, top frequencies.
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Settings</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Organisation name, logo, and brand colour.
        </CardContent>
      </Card>
    </div>
  );
}
