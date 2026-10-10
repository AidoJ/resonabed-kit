import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getHomeContext } from "@/lib/home.functions";
import { TableSetupVideos } from "@/components/table-setup-videos";
import logo from "@/assets/resonabed-logo.svg.asset.json";

export const Route = createFileRoute("/home/setup")({
  head: () => ({
    meta: [
      { title: "Table setup, Resonabed Home" },
      { name: "robots", content: "noindex" },
    ],
  }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/home/login" });
    const ctx = await getHomeContext();
    // Home users only; clinic accounts use the clinic app's Table setup page.
    if (ctx.kind !== "home") throw redirect({ to: "/table-setup" });
  },
  component: HomeSetupPage,
});

function HomeSetupPage() {
  return (
    <div className="min-h-dvh bg-background px-5 py-8">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-8 flex items-center justify-between">
          <img src={logo.url} alt="Resonabed" className="h-9 w-auto" />
          <Link
            to="/home"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to sessions
          </Link>
        </div>
        <TableSetupVideos />
      </div>
    </div>
  );
}
