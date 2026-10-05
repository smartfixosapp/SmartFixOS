UPDATE public.product
   SET imei = device_imei
 WHERE (imei IS NULL OR imei = '')
   AND device_imei IS NOT NULL
   AND device_imei <> '';
