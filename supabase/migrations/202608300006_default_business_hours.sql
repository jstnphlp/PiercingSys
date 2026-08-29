-- Demo-friendly weekly hours. Owners can edit these from Settings.
update public.studio_settings
set business_hours = jsonb_build_object(
  '0', jsonb_build_object('open', '10:00', 'close', '20:00', 'closed', false),
  '1', jsonb_build_object('open', '10:00', 'close', '20:00', 'closed', false),
  '2', jsonb_build_object('open', '10:00', 'close', '20:00', 'closed', false),
  '3', jsonb_build_object('open', '10:00', 'close', '20:00', 'closed', false),
  '4', jsonb_build_object('open', '10:00', 'close', '20:00', 'closed', false),
  '5', jsonb_build_object('open', '10:00', 'close', '20:00', 'closed', false),
  '6', jsonb_build_object('open', '10:00', 'close', '20:00', 'closed', false)
), updated_at = now()
where id = 1 and business_hours = '{}'::jsonb;
