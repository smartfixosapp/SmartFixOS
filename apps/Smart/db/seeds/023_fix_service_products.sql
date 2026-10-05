UPDATE public.product
   SET tipo_principal = 'servicios',
       subcategoria = 'piezas_servicios'
 WHERE type = 'service'
   AND COALESCE(tipo_principal, '') <> 'servicios';
