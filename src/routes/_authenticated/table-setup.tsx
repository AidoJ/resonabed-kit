import { createFileRoute } from "@tanstack/react-router";
import { PlayCircle, Wrench } from "lucide-react";
import introVideo from "@/assets/table-setup-1-intro.mp4.asset.json";
import cablesVideo from "@/assets/table-setup-2-cables.mp4.asset.json";
import appVideo from "@/assets/table-setup-4-app.mp4.asset.json";

export const Route = createFileRoute("/_authenticated/table-setup")({
  head: () => ({
    meta: [
      { title: "Table setup, ResonaBed" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TableSetupPage,
});

type TrainingVideo = {
  num: number;
  title: string;
  description: string;
  url: string | null;
};

const VIDEOS: TrainingVideo[] = [
  {
    num: 1,
    title: "Intro and what's in the box",
    description: "Meet your Resonabed kit and check off everything that arrives with it.",
    url: introVideo.url,
  },
  {
    num: 2,
    title: "Preparing the cables and connectors",
    description: "Get the cables and connectors ready before fitting anything to the table.",
    url: cablesVideo.url,
  },
  {
    num: 3,
    title: "Install transducers and amplifier",
    description: "Mount the transducers under the tabletop and position the amplifier.",
    url: null,
  },
  {
    num: 4,
    title: "Connecting the cables and the app",
    description: "Wire everything together and connect the app for your first session.",
    url: null,
  },
];

function TableSetupPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Wrench className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">Table setup</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Four short training videos that take you from unboxing your Resonabed kit to
            running your first session.
          </p>
        </div>
      </div>

      <ol className="space-y-6">
        {VIDEOS.map((v) => (
          <li key={v.num} className="overflow-hidden rounded-2xl border bg-card">
            <div className="flex items-center gap-3 border-b px-5 py-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                {v.num}
              </span>
              <div className="min-w-0">
                <h2 className="font-medium leading-tight">{v.title}</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">{v.description}</p>
              </div>
            </div>
            {v.url ? (
              <video
                src={v.url}
                controls
                preload="metadata"
                className="aspect-video w-full bg-black"
              />
            ) : (
              <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 bg-muted/50 text-muted-foreground">
                <PlayCircle className="h-10 w-10 opacity-40" />
                <p className="text-sm">Video coming soon</p>
              </div>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
