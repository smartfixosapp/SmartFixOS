drop trigger if exists order_items_preserve_costing_trg on public."order";

create trigger order_items_preserve_costing_trg
  before update of order_items on public."order"
  for each row
  when (new.order_items is distinct from old.order_items)
  execute function public.order_items_preserve_costing();
