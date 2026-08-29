-- Ensure the hosted catalog contains the complete Piercing Corner service list.
-- This is intentionally separate from the schema migration so it is safe to
-- run against projects that already have the service columns.
create unique index if not exists services_name_unique_ci
  on public.services (lower(name));

insert into public.services (
  name, description, body_area, category, duration_minutes, price_cents,
  min_price_cents, max_price_cents, price_unit, is_active, sort_order
)
values
  ('Lobe', 'Basic surgical steel jewelry is included. Customers may upgrade to higher-grade implant titanium.', 'Ear', 'Ear Piercings', 60, 50000, null, null, null, true, 100),
  ('Double Lobe', 'Basic surgical steel jewelry is included. Customers may upgrade to higher-grade implant titanium.', 'Ear', 'Ear Piercings', 60, 95000, null, null, null, true, 101),
  ('Triple Lobe', 'Basic surgical steel jewelry is included. Customers may upgrade to higher-grade implant titanium.', 'Ear', 'Ear Piercings', 60, 140000, null, null, null, true, 102),
  ('Auricle', 'Basic surgical steel jewelry is included. Customers may upgrade to higher-grade implant titanium.', 'Ear', 'Ear Piercings', 60, 60000, null, null, null, true, 103),
  ('Helix', 'Basic surgical steel jewelry is included. Customers may upgrade to higher-grade implant titanium.', 'Ear', 'Ear Piercings', 60, 60000, null, null, null, true, 104),
  ('Hidden Helix', 'Basic surgical steel jewelry is included. Customers may upgrade to higher-grade implant titanium.', 'Ear', 'Ear Piercings', 60, 70000, null, null, null, true, 105),
  ('Tragus', 'Basic surgical steel jewelry is included. Customers may upgrade to higher-grade implant titanium.', 'Ear', 'Ear Piercings', 60, 70000, null, null, null, true, 106),
  ('Conch', 'Basic surgical steel jewelry is included. Customers may upgrade to higher-grade implant titanium.', 'Ear', 'Ear Piercings', 60, 70000, null, null, null, true, 107),
  ('Daith', 'Basic surgical steel jewelry is included. Customers may upgrade to higher-grade implant titanium.', 'Ear', 'Ear Piercings', 60, 75000, null, null, null, true, 108),
  ('Rook', 'Basic surgical steel jewelry is included. Customers may upgrade to higher-grade implant titanium.', 'Ear', 'Ear Piercings', 60, 70000, null, null, null, true, 109),
  ('Forward Helix', 'Basic surgical steel jewelry is included. Customers may upgrade to higher-grade implant titanium.', 'Ear', 'Ear Piercings', 60, 70000, null, null, null, true, 110),
  ('Flat', 'Basic surgical steel jewelry is included. Customers may upgrade to higher-grade implant titanium.', 'Ear', 'Ear Piercings', 60, 60000, null, null, null, true, 111),
  ('Snug', 'Basic surgical steel jewelry is included. Customers may upgrade to higher-grade implant titanium.', 'Ear', 'Ear Piercings', 60, 70000, null, null, null, true, 112),
  ('Anti-Tragus', 'Basic surgical steel jewelry is included. Customers may upgrade to higher-grade implant titanium.', 'Ear', 'Ear Piercings', 60, 70000, null, null, null, true, 113),
  ('Industrial', 'Basic surgical steel jewelry is included. Customers may upgrade to higher-grade implant titanium.', 'Ear', 'Ear Piercings', 60, 110000, null, null, null, true, 114),
  ('Nostril', 'Basic surgical steel jewelry is included. Customers may upgrade to higher-grade implant titanium.', 'Face & Body', 'Face & Body Piercings', 60, 80000, null, null, null, true, 200),
  ('Septum', 'Basic surgical steel jewelry is included. Customers may upgrade to higher-grade implant titanium.', 'Face & Body', 'Face & Body Piercings', 60, 100000, null, null, null, true, 201),
  ('Eyebrow', 'Basic surgical steel jewelry is included. Customers may upgrade to higher-grade implant titanium.', 'Face & Body', 'Face & Body Piercings', 60, 90000, null, null, null, true, 202),
  ('Navel', 'Basic surgical steel jewelry is included. Customers may upgrade to higher-grade implant titanium.', 'Face & Body', 'Face & Body Piercings', 60, 90000, null, null, null, true, 203),
  ('Bridge', 'Basic surgical steel jewelry is included. Customers may upgrade to higher-grade implant titanium.', 'Face & Body', 'Face & Body Piercings', 60, 95000, null, null, null, true, 204),
  ('Surface', 'Basic surgical steel jewelry is included. Customers may upgrade to higher-grade implant titanium.', 'Face & Body', 'Face & Body Piercings', 60, 280000, null, null, null, true, 205),
  ('Lip Piercing', E'Examples: Labret, Monroe, Medusa, etc.\nBasic surgical steel jewelry is included. Customers may upgrade to higher-grade implant titanium.', 'Face & Body', 'Face & Body Piercings', 60, 95000, null, null, null, true, 206),
  ('Oral Piercing', E'Examples: Tongue, Dimple, Smiley, etc.\nBasic surgical steel jewelry is included. Customers may upgrade to higher-grade implant titanium.', 'Face & Body', 'Face & Body Piercings', 60, 120000, null, null, null, true, 207),
  ('Nipple', 'Basic surgical steel jewelry is included. Customers may upgrade to higher-grade implant titanium.', 'Face & Body', 'Face & Body Piercings', 60, 100000, null, null, null, true, 208),
  ('Dermal', 'Basic surgical steel jewelry is included. Customers may upgrade to higher-grade implant titanium.', 'Face & Body', 'Face & Body Piercings', 60, 280000, null, null, null, true, 209),
  ('Genital', 'Basic surgical steel jewelry is included. Customers may upgrade to higher-grade implant titanium.', 'Face & Body', 'Face & Body Piercings', 60, 300000, null, null, null, true, 210),
  ('Curation / Earscape', null, null, 'Other Services', 60, null, 10000, 50000, null, true, 300),
  ('Removal / Replacement / Downsize / Cleaning', null, null, 'Other Services', 30, null, 10000, 50000, null, true, 301),
  ('Bump Treatment', null, null, 'Other Services', 30, null, 20000, 50000, null, true, 302),
  ('Authentic No-Pull Disc', null, null, 'Other Services', 15, 25000, null, null, null, true, 303),
  ('Titanium Anodizing', null, null, 'Other Services', 30, null, 20000, 25000, 'per process', true, 304),
  ('Ultrasonic Jewelry Cleaning', E'Supported materials:\nSurgical Steel\nTitanium\nReal Gold (yellow or white)\nDiamonds\n925 Silver', null, 'Other Services', 30, null, 20000, 35000, 'per process', true, 305)
on conflict (lower(name)) do update set
  description = excluded.description,
  body_area = excluded.body_area,
  category = excluded.category,
  duration_minutes = excluded.duration_minutes,
  price_cents = excluded.price_cents,
  min_price_cents = excluded.min_price_cents,
  max_price_cents = excluded.max_price_cents,
  price_unit = excluded.price_unit,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into public.service_staff (service_id, staff_id)
select s.id, sp.user_id
from public.services s
cross join public.staff_profiles sp
where s.is_active and sp.active and sp.role = 'piercer'
on conflict do nothing;
