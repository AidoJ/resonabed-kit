select cron.schedule(
  'order-tick-daily',
  '17 3 * * *',
  $$
  select net.http_post(
    url:='https://project--2fed58e3-4d88-4192-9c63-c4ffbc643340.lovable.app/api/public/hooks/order-tick',
    headers:='{"Content-Type": "application/json", "apikey": "sb_publishable_JU0XeOqf3uojnWDCbsW3kw_x5NRO8nA"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);