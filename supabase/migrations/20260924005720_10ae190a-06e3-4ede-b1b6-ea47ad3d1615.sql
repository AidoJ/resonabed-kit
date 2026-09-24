GRANT DELETE ON public.demo_enquiries TO authenticated;

CREATE POLICY "demo_enquiries_super_admin_delete"
ON public.demo_enquiries
FOR DELETE
TO authenticated
USING (public.is_super_admin(auth.uid()));