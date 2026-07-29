import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCurrentUserContext } from "@/lib/user-context.functions";
import { DEFAULT_TIMEZONE } from "@/lib/timezone";

/**
 * The organisation's IANA timezone — the ONLY timezone the clinic UI may use
 * to interpret or display booking/availability times. Never read the device
 * timezone for anything an operator acts on.
 *
 * Falls back to the platform default until the user context has loaded.
 */
export function useOrgTimezone(): string {
  const ctxFn = useServerFn(getCurrentUserContext);
  const { data: ctx } = useQuery({ queryKey: ["user-context"], queryFn: () => ctxFn() });
  return ctx?.org?.timezone || DEFAULT_TIMEZONE;
}
