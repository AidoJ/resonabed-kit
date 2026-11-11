import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { DirectoryClinic } from "./directory.server";

export type { DirectoryClinic };

/** Public: every clinic opted into the directory. */
export const getDirectoryClinics = createServerFn({ method: "GET" }).handler(
  async (): Promise<DirectoryClinic[]> => {
    const { fetchDirectoryClinics } = await import("./directory.server");
    return fetchDirectoryClinics();
  },
);

/** Public: the directory entry for one clinic page, or null when not listed. */
export const getDirectoryClinic = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ slug: z.string().min(1).max(64) }).parse(d))
  .handler(async ({ data }): Promise<DirectoryClinic | null> => {
    const { fetchDirectoryClinic } = await import("./directory.server");
    return fetchDirectoryClinic(data.slug);
  });
