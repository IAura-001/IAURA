create function public.recognize_beta_invite(invite_token text)
returns boolean
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  supplied_hash text;
begin
  if invite_token is null or char_length(invite_token) < 32 then
    return false;
  end if;

  supplied_hash := encode(
    extensions.digest(convert_to(invite_token, 'UTF8'), 'sha256'),
    'hex'
  );

  return exists (
    select 1
    from public.beta_invites
    where token_hash = supplied_hash
      and revoked_at is null
      and expires_at > now()
      and claim_count < max_claims
  );
end;
$$;

revoke all on function public.recognize_beta_invite(text) from public;
grant execute on function public.recognize_beta_invite(text) to anon, authenticated;

comment on function public.recognize_beta_invite(text) is
  'Returns only whether a raw invite token is currently recognizable; does not consume or disclose invitation state.';
