-- Starting an AI Helper chat failed: inserting a conversation and reading
-- back its id (insert ... returning) is checked against the select policy,
-- and can_review_conversation() looks the conversation up by id, which it
-- cannot see yet inside the same statement. Owners now read their own chats
-- by user_id directly; class teachers still read through the helper.
drop policy "Owners and class teachers read chats" on public.ai_conversations;
create policy "Owners and class teachers read chats" on public.ai_conversations
  for select to authenticated
  using (user_id = (select auth.uid()) or private.can_review_conversation(id));
