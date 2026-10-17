-- PENDING: not yet applied to the clarion-ai project.
-- The Supabase connector timed out waiting for approval of the DROP POLICY
-- statements. Apply it from the Supabase SQL editor or with `supabase db push`.
-- It only clears a performance advisor warning; access rules are unchanged.

-- One policy per action, so reads are not checked twice.
drop policy "Deck owners manage cards" on public.flashcards;
create policy "Deck owners add cards" on public.flashcards
  for insert to authenticated
  with check (exists (select 1 from public.flashcard_decks d where d.id = deck_id and d.owner_id = (select auth.uid())));
create policy "Deck owners edit cards" on public.flashcards
  for update to authenticated
  using (exists (select 1 from public.flashcard_decks d where d.id = deck_id and d.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.flashcard_decks d where d.id = deck_id and d.owner_id = (select auth.uid())));
create policy "Deck owners delete cards" on public.flashcards
  for delete to authenticated
  using (exists (select 1 from public.flashcard_decks d where d.id = deck_id and d.owner_id = (select auth.uid())));

drop policy "Admins manage rewards" on public.rewards;
create policy "Admins add rewards" on public.rewards
  for insert to authenticated
  with check (school_id = (select private.my_school_id()) and (select private.my_role()) = 'admin');
create policy "Admins edit rewards" on public.rewards
  for update to authenticated
  using (school_id = (select private.my_school_id()) and (select private.my_role()) = 'admin')
  with check (school_id = (select private.my_school_id()) and (select private.my_role()) = 'admin');
create policy "Admins remove rewards" on public.rewards
  for delete to authenticated
  using (school_id = (select private.my_school_id()) and (select private.my_role()) = 'admin');
