begin;
-- 100 players * 10,000 server-accepted taps/day * 120 days = 120m maximum.
-- Level 20 at 100m leaves room for missed days while targeting roughly four months.
update public.city_levels set required_contribution=0 where level=1;
update public.city_levels set required_contribution=20000 where level=2;
update public.city_levels set required_contribution=60000 where level=3;
update public.city_levels set required_contribution=130000 where level=4;
update public.city_levels set required_contribution=250000 where level=5;
update public.city_levels set required_contribution=450000 where level=6;
update public.city_levels set required_contribution=750000 where level=7;
update public.city_levels set required_contribution=1200000 where level=8;
update public.city_levels set required_contribution=1900000 where level=9;
update public.city_levels set required_contribution=2900000 where level=10;
update public.city_levels set required_contribution=4300000 where level=11;
update public.city_levels set required_contribution=6200000 where level=12;
update public.city_levels set required_contribution=8700000 where level=13;
update public.city_levels set required_contribution=12000000 where level=14;
update public.city_levels set required_contribution=16500000 where level=15;
update public.city_levels set required_contribution=22500000 where level=16;
update public.city_levels set required_contribution=30500000 where level=17;
update public.city_levels set required_contribution=42000000 where level=18;
update public.city_levels set required_contribution=65000000 where level=19;
update public.city_levels set required_contribution=100000000 where level=20;
commit;