grant usage on sequence public.beta_usage_events_id_seq to authenticated;

comment on sequence public.beta_usage_events_id_seq is
  'Allows authenticated users to allocate beta usage event identity values; table RLS still restricts inserts to auth.uid().';
