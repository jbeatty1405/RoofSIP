-- Seed the Apple reviewer demo account (apple@roofsip.app) with a clean, realistic
-- data set so the iOS app looks fully functional during review.
-- Idempotent: wipes this roofer's data first, then inserts a curated set.
-- All phone numbers are in the fictional 555-01xx range (non-deliverable) so the
-- weather cron can NEVER text a real person from these rows.
do $$
declare rid uuid;
begin
  select id into rid from auth.users where email = 'apple@roofsip.app';

  update profiles
     set pm_name = 'Jordan Reyes',
         company_name = 'Summit Roofing Co.',
         subscription_status = 'active'
   where id = rid;

  -- clean slate (homeowners delete cascades sms_logs / pending_bookings)
  delete from notifications where roofer_id = rid;
  delete from bookings      where roofer_id = rid;
  delete from homeowners    where roofer_id = rid;
  delete from markets       where roofer_id = rid;

  insert into markets (roofer_id, name, cities, auto_schedule, working_days, working_hours_start, working_hours_end) values
    (rid, 'North Phoenix', array['Phoenix','Glendale','Peoria'], true, array[1,2,3,4,5],   '08:00', '17:00'),
    (rid, 'East Valley',   array['Mesa','Gilbert','Chandler'],   true, array[1,2,3,4,5,6], '08:00', '18:00');

  insert into homeowners (roofer_id, name, phone, address, zip_code, tcpa_consent, tcpa_consent_at, sms_confirmed, monitor_only) values
    (rid, 'Maria Hernandez', '+14805550142', '1842 W Glenrosa Ave, Phoenix, AZ',   '85015', true, now(), true, false),
    (rid, 'Tom Becker',      '+16025550178', '3310 E Camelback Rd, Phoenix, AZ',   '85018', true, now(), true, false),
    (rid, 'Dana Whitfield',  '+14805550193', '7245 E Shea Blvd, Scottsdale, AZ',   '85254', true, now(), true, false),
    (rid, 'Greg Olsen',      '+16235550117', '9034 W Union Hills Dr, Peoria, AZ',  '85382', true, now(), true, false),
    (rid, 'Priya Nair',      '+14805550166', '1525 N Gilbert Rd, Gilbert, AZ',     '85234', true, now(), true, false);

  insert into bookings (roofer_id, homeowner_id, scheduled_at, status)
    select rid, id, now() + interval '2 days' + interval '9 hours',  'scheduled' from homeowners where roofer_id = rid and name = 'Maria Hernandez';
  insert into bookings (roofer_id, homeowner_id, scheduled_at, status)
    select rid, id, now() + interval '4 days' + interval '14 hours', 'scheduled' from homeowners where roofer_id = rid and name = 'Dana Whitfield';

  insert into notifications (roofer_id, homeowner_id, type, message, read)
    select rid, id, 'hot_lead', 'Maria Hernandez confirmed a free inspection — Tue 9:00 AM. 1842 W Glenrosa Ave, Phoenix', false from homeowners where roofer_id = rid and name = 'Maria Hernandez';
  insert into notifications (roofer_id, homeowner_id, type, message, read)
    select rid, id, 'hot_lead', 'Dana Whitfield booked an inspection — Thu 2:00 PM. 7245 E Shea Blvd, Scottsdale', false from homeowners where roofer_id = rid and name = 'Dana Whitfield';
  insert into notifications (roofer_id, homeowner_id, type, message, read)
    select rid, id, 'call_needed', 'Tom Becker couldn''t schedule over text — give them a call. +1 602 555 0178 · 3310 E Camelback Rd', false from homeowners where roofer_id = rid and name = 'Tom Becker';
  insert into notifications (roofer_id, homeowner_id, type, message, read)
    select rid, id, 'call_needed', 'Greg Olsen got a storm alert 2 days ago and hasn''t responded — give them a call. +1 623 555 0117', false from homeowners where roofer_id = rid and name = 'Greg Olsen';
end $$;
