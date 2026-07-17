-- Allow org_admins to update their own organisation's settings (branding, policies, identity).
-- Previously only super_admin could update, so logo/theme/policy saves silently no-op'd for org_admin.
DROP POLICY IF EXISTS organisations_update ON public.organisations;
CREATE POLICY organisations_update ON public.organisations
  FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_org_admin(auth.uid(), id))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.is_org_admin(auth.uid(), id));