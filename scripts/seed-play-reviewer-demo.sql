-- Seed sample data for the GOOGLE PLAY review demo account (playwright-test@roofsip.test).
--
-- The "Sign in details" declaration in Play Console promises a reviewer that the
-- account is "loaded with three sample homeowners and two storm alerts so every
-- screen has content". The three homeowners and two storm alerts were already
-- there, but Calendar, Hot leads, the call list and the per-homeowner message
-- history were all empty, which makes those screens look broken. This fills them.
--
-- Idempotent: clears only the rows this script owns, then re-inserts. It does NOT
-- touch the three seeded homeowners (is_test = true, 555-01xx numbers) — the
-- weather cron filters on is_test = false, so nothing here can ever text a real
-- person. Note the mobile Calendar and Home read pending_bookings (status
-- 'confirmed', proposed_slot), NOT the bookings table.
do $$
declare
  rid uuid;
  dana uuid;
  marcus uuid;
  priya uuid;
begin
  select id into rid from auth.users where email = 'playwright-test@roofsip.test';
  if rid is null then
    raise exception 'playwright-test@roofsip.test not found';
  end if;

  select id into dana   from homeowners where roofer_id = rid and name = 'Dana Whitfield';
  select id into marcus from homeowners where roofer_id = rid and name = 'Marcus Ellery';
  select id into priya  from homeowners where roofer_id = rid and name = 'Priya Raman';

  update profiles set pm_name = coalesce(nullif(pm_name, ''), 'Alex Moreno') where id = rid;

  delete from pending_bookings where roofer_id = rid;
  delete from sms_logs         where roofer_id = rid;
  delete from notifications    where roofer_id = rid and type in ('hot_lead', 'call_needed');

  -- Two confirmed inspections: one tomorrow morning, one later in the week.
  -- Stored in UTC: 16:00Z = 9:00 AM MST, 21:00Z = 2:00 PM MST. slots mirrors
  -- proposed_slot so the two never disagree.
  insert into pending_bookings (roofer_id, homeowner_id, slots, status, proposed_slot) values
    (rid, dana,  jsonb_build_array(to_char((current_date + 1) + time '16:00', 'YYYY-MM-DD"T"HH24:MI:SS.000"Z"')),
       'confirmed', (current_date + 1) + time '16:00'),
    (rid, priya, jsonb_build_array(to_char((current_date + 4) + time '21:00', 'YYYY-MM-DD"T"HH24:MI:SS.000"Z"')),
       'confirmed', (current_date + 4) + time '21:00');

  -- Hot lead + call-needed so Home and the Hot leads screen are not empty.
  insert into notifications (roofer_id, homeowner_id, type, message, read, created_at) values
    (rid, dana, 'hot_lead',
     'Dana Whitfield confirmed a free inspection — tomorrow 9:00 AM. 4118 W Sandra Ter',
     false, now() - interval '3 hours'),
    (rid, marcus, 'call_needed',
     'Marcus Ellery could not schedule over text — give them a call. 555-0177 · 9210 N 63rd Ave',
     false, now() - interval '1 day');

  -- A full thread for Dana (storm -> reply -> booked) and a one-sided one for Marcus.
  insert into sms_logs (roofer_id, homeowner_id, message, direction, status, message_type, sent_at) values
    (rid, dana,
     'Hi Dana, this is Alex with Test Roofing Co. NOAA just reported hail over your neighborhood. Want me to swing by and take a look at the roof? No charge.',
     'outbound', 'sent', 'storm_alert', now() - interval '5 hours'),
    (rid, dana, 'Yes please, is tomorrow morning open?', 'inbound', 'received', null, now() - interval '4 hours 40 minutes'),
    (rid, dana, 'Tomorrow at 9:00 AM works. You are on the calendar — see you then.',
     'outbound', 'sent', 'reply', now() - interval '4 hours 30 minutes'),
    (rid, marcus,
     'Hi Marcus, this is Alex with Test Roofing Co. NOAA reported 60 mph winds over your address last night. Want a free look at the roof?',
     'outbound', 'sent', 'storm_alert', now() - interval '1 day 2 hours');
end $$;
