-- ===========================================================================
-- DormDrop — catalogue seed
--
-- ~31 realistic items across all categories at UK student-budget prices
-- (slightly marked up from Tesco to cover the catalogue margin).
--
-- Idempotent: each row is only inserted if an item with the same name doesn't
-- already exist, so it's safe to run repeatedly.
--
-- Tip: for a clean catalogue (removing the small demo seed in 0001), run
--   delete from public.items;
-- before this script. There are no orders referencing items on a fresh DB.
-- ===========================================================================

insert into public.items (name, description, price, category)
select v.name, v.description, v.price, v.category::public.item_category
from (values
  -- ---------------------------- SNACKS ----------------------------
  ('Doritos (Cool Original)',        'Cool Original tortilla chips, sharing bag',  1.75, 'snacks'),
  ('Pringles (Original)',            'Original flavour, 185g tube',                2.50, 'snacks'),
  ('Cadbury Dairy Milk',             'Milk chocolate bar, 110g',                   1.75, 'snacks'),
  ('Kit Kat Chunky',                 'Milk chocolate wafer bar',                   0.85, 'snacks'),
  ('Haribo Tangfastics',            'Sour fruit gums, 160g bag',                  1.50, 'snacks'),
  ('McCoy''s (Flame Grilled Steak)', 'Ridge cut crisps, grab bag',                 1.25, 'snacks'),
  ('Walkers (Cheese & Onion)',       'Classic crisps, grab bag',                   1.10, 'snacks'),
  ('Galaxy Caramel',                 'Smooth milk chocolate with caramel',         1.20, 'snacks'),
  ('Percy Pigs',                     'Fruity gums, 170g bag',                      1.75, 'snacks'),
  ('Snickers',                       'Peanut & caramel chocolate bar',             0.95, 'snacks'),

  -- ---------------------------- DRINKS ----------------------------
  ('Red Bull (250ml)',               'Energy drink, 250ml can',                    1.75, 'drinks'),
  ('Monster Energy',                 'Energy drink, 500ml can',                    1.85, 'drinks'),
  ('Coca-Cola (500ml)',              'Classic Coke, 500ml bottle',                 1.85, 'drinks'),
  ('Lucozade Original',              'Energy drink, 380ml bottle',                 1.50, 'drinks'),
  ('Ribena',                         'Blackcurrant juice drink, 500ml',            1.40, 'drinks'),
  ('Volvic Water (1L)',              'Still natural mineral water, 1 litre',       1.20, 'drinks'),
  ('Oasis Citrus Punch',             'Citrus juice drink, 500ml bottle',           1.50, 'drinks'),
  ('Tropicana Orange Juice',         'Smooth orange juice, 300ml',                 1.95, 'drinks'),

  -- -------------------------- ESSENTIALS --------------------------
  ('Paracetamol',                    'Pain relief, 16 tablets',                    1.25, 'essentials'),
  ('Toilet Roll (4-pack)',           'Soft toilet tissue, 4 rolls',                2.50, 'essentials'),
  ('Washing Up Liquid',              'Original, 450ml',                            1.50, 'essentials'),
  ('Bin Bags',                       'Tie-handle bin liners, 20 pack',             2.00, 'essentials'),
  ('Kitchen Roll',                   'Absorbent kitchen towel, 2 rolls',           2.25, 'essentials'),
  ('Milk (1 pint)',                  'Fresh semi-skimmed milk, 568ml',             0.95, 'essentials'),

  -- -------------------------- STATIONERY --------------------------
  ('Black Biro Pens (pack of 5)',    'Smooth ballpoint pens, black ink',           2.00, 'stationery'),
  ('A4 Notebook',                    'Ruled, 80 sheets',                           2.50, 'stationery'),
  ('Highlighters (pack of 4)',       'Assorted neon highlighters',                 3.00, 'stationery'),
  ('USB-C Cable',                    'Fast-charge USB-C cable, 1m',                6.50, 'stationery'),

  -- ------------------------- PERSONAL CARE ------------------------
  ('Toothpaste',                     'Fluoride toothpaste, 75ml',                  2.50, 'personal_care'),
  ('Deodorant (Sure)',               'Anti-perspirant spray, 150ml',               3.00, 'personal_care'),
  ('Hand Sanitiser',                 'Antibacterial gel, 50ml',                    1.75, 'personal_care')
) as v(name, description, price, category)
where not exists (
  select 1 from public.items i where i.name = v.name
);
