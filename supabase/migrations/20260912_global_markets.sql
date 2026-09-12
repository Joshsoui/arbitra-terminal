insert into markets(code, name, currency, region) values
  ('US', 'United States', 'USD', 'North America'),
  ('CA', 'Canada', 'CAD', 'North America'),
  ('MX', 'Mexico', 'MXN', 'North America'),
  ('BR', 'Brazil', 'BRL', 'Latin America'),
  ('UK', 'United Kingdom', 'GBP', 'Europe'),
  ('DE', 'Germany', 'EUR', 'Europe'),
  ('FR', 'France', 'EUR', 'Europe'),
  ('NL', 'Netherlands', 'EUR', 'Europe'),
  ('BE', 'Belgium', 'EUR', 'Europe'),
  ('ES', 'Spain', 'EUR', 'Europe'),
  ('IT', 'Italy', 'EUR', 'Europe'),
  ('SE', 'Sweden', 'SEK', 'Europe'),
  ('PL', 'Poland', 'PLN', 'Europe'),
  ('AU', 'Australia', 'AUD', 'Asia Pacific'),
  ('JP', 'Japan', 'JPY', 'Asia Pacific'),
  ('KR', 'South Korea', 'KRW', 'Asia Pacific'),
  ('IN', 'India', 'INR', 'South Asia')
on conflict (code) do update set
  name = excluded.name,
  currency = excluded.currency,
  region = excluded.region;
