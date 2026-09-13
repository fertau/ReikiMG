-- =====================================================================
-- ReikiMG · 0004 · Catálogos iniciales
-- Todo lo que se carga acá es editable después desde Administración.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Etiquetas de estado
-- ---------------------------------------------------------------------
insert into public.workflow_statuses (scope, code, label, color, sort_order) values
  ('project', 'pendiente',      'Pendiente',      'slate',  10),
  ('project', 'en_medicion',    'En medición',    'blue',   20),
  ('project', 'relevado',       'Relevado',       'cyan',   30),
  ('project', 'a_revisar',      'A revisar',      'amber',  40),
  ('project', 'corregir',       'Corregir',       'red',    50),
  ('project', 'aprobado',       'Aprobado',       'green',  60),
  ('project', 'en_produccion',  'En producción',  'violet', 70),
  ('project', 'finalizado',     'Finalizado',     'zinc',   80),
  ('measurement', 'en_curso',       'En curso',        'blue',   10),
  ('measurement', 'a_revisar',      'A revisar',       'amber',  20),
  ('measurement', 'corregir',       'Corregir',        'red',    30),
  ('measurement', 'aprobado',       'Aprobado',        'green',  40),
  ('measurement', 'orden_generada', 'Orden generada',  'violet', 50),
  ('measurement', 'anulado',        'Anulado',         'zinc',   60),
  ('order', 'generada',      'Generada',      'blue',   10),
  ('order', 'en_produccion', 'En producción', 'violet', 20),
  ('order', 'finalizada',    'Finalizada',    'green',  30),
  ('order', 'anulada',       'Anulada',       'zinc',   40)
on conflict (scope, code) do nothing;

-- ---------------------------------------------------------------------
-- Categorías de fotografía
-- ---------------------------------------------------------------------
insert into public.photo_categories (code, label, sort_order) values
  ('general',   'Vista general',     10),
  ('lat_izq',   'Lateral izquierdo', 20),
  ('lat_der',   'Lateral derecho',   30),
  ('piso',      'Piso',              40),
  ('techo',     'Techo',             50),
  ('detalle',   'Detalle',           60),
  ('croquis',   'Croquis',           70),
  ('otro',      'Otro',              80)
on conflict (code) do nothing;

-- ---------------------------------------------------------------------
-- Catálogos de materiales
-- ---------------------------------------------------------------------
insert into public.material_categories (key, name, description, sort_order) values
  ('tipo_vidrio', 'Tipos de vidrio', 'Templado, laminado, float, etc.',        10),
  ('espesor',     'Espesores',       'Espesor de vidrio en milímetros',        20),
  ('color',       'Colores',         'Colores de herrajes, perfiles y vidrio', 30),
  ('terminacion', 'Terminaciones',   'Terminación de canto y superficie',      40),
  ('perfileria',  'Perfilería',      'Perfiles de aluminio y accesorios',      50),
  ('herraje',     'Herrajes',        'Herrajes y accesorios',                  60),
  ('material',    'Otros materiales','Siliconas, burletes, fijaciones',        70)
on conflict (key) do nothing;

insert into public.materials (category_id, code, name, sort_order)
select c.id, v.code, v.name, v.sort_order
from (values
  ('tipo_vidrio', 'TPL',      'Templado incoloro',            10),
  ('tipo_vidrio', 'TPL-BR',   'Templado bronce',              20),
  ('tipo_vidrio', 'TPL-GR',   'Templado gris',                30),
  ('tipo_vidrio', 'TPL-SAT',  'Templado satinado / esmerilado',40),
  ('tipo_vidrio', 'LAM',      'Laminado 3+3',                 50),
  ('tipo_vidrio', 'LAM-44',   'Laminado 4+4',                 60),
  ('tipo_vidrio', 'FLOAT',    'Float incoloro',               70),
  ('tipo_vidrio', 'ESP',      'Espejo',                       80),
  ('tipo_vidrio', 'ESP-BR',   'Espejo bronce',                90),
  ('tipo_vidrio', 'DVH',      'DVH',                         100),
  ('espesor', '4',  '4 mm',  10),
  ('espesor', '5',  '5 mm',  20),
  ('espesor', '6',  '6 mm',  30),
  ('espesor', '8',  '8 mm',  40),
  ('espesor', '10', '10 mm', 50),
  ('espesor', '12', '12 mm', 60),
  ('color', 'NAT',   'Aluminio natural',  10),
  ('color', 'BLA',   'Blanco',            20),
  ('color', 'NEG',   'Negro',             30),
  ('color', 'NEG-M', 'Negro mate',        40),
  ('color', 'CRO',   'Cromado',           50),
  ('color', 'ACE',   'Acero inoxidable',  60),
  ('color', 'BRO',   'Bronce',            70),
  ('color', 'DOR',   'Dorado',            80),
  ('terminacion', 'PUL',  'Canto pulido',       10),
  ('terminacion', 'BIS',  'Bisel',              20),
  ('terminacion', 'MAT',  'Mateado',            30),
  ('terminacion', 'SIN',  'Sin terminación',    40),
  ('perfileria', 'U-20',   'Perfil U 20x20',        10),
  ('perfileria', 'U-25',   'Perfil U 25x25',        20),
  ('perfileria', 'ANG-30', 'Ángulo 30x30',          30),
  ('perfileria', 'TUB-40', 'Tubo 40x40',            40),
  ('perfileria', 'BAR-PAS','Pasamanos barandas',    50),
  ('herraje', 'BIS-VV',  'Bisagra vidrio-vidrio',      10),
  ('herraje', 'BIS-PV',  'Bisagra pared-vidrio',       20),
  ('herraje', 'TIR-30',  'Tirador 300 mm',             30),
  ('herraje', 'TIR-60',  'Tirador 600 mm',             40),
  ('herraje', 'CER-PP',  'Cerradura puerta de vidrio', 50),
  ('herraje', 'KIT-COR', 'Kit corredizo',              60),
  ('herraje', 'ARA-4',   'Araña 4 puntas',             70),
  ('herraje', 'BOT-REG', 'Botón regulable',            80),
  ('material', 'SIL-NEU', 'Silicona neutra',        10),
  ('material', 'SIL-EST', 'Silicona estructural',   20),
  ('material', 'BUR-U',   'Burlete U',              30),
  ('material', 'BUR-H',   'Burlete H',              40),
  ('material', 'TAR-8',   'Tarugo + tornillo 8 mm', 50)
) as v (cat_key, code, name, sort_order)
join public.material_categories c on c.key = v.cat_key
on conflict do nothing;

-- ---------------------------------------------------------------------
-- Familias y productos
-- ---------------------------------------------------------------------
insert into public.product_families (code, name, icon, sort_order) values
  ('frentes',     'Frentes',                     'frente',     10),
  ('templado',    'Sistemas de cristal templado','templado',   20),
  ('mamparas',    'Mamparas',                    'mampara',    30),
  ('barandas',    'Barandas',                    'baranda',    40),
  ('espejos',     'Espejos',                     'espejo',     50),
  ('vidrios',     'Vidrios',                     'vidrio',     60),
  ('cerramientos','Cerramientos vidriados',      'cerramiento',70),
  ('techos',      'Techos vidriados',            'techo',      80),
  ('especiales',  'Trabajos especiales',         'especial',   90)
on conflict (code) do nothing;

insert into public.product_types (family_id, code, name, requires_depth, sort_order)
select f.id, v.code, v.name, v.requires_depth, v.sort_order
from (values
  ('frentes',     'frente_vidriado',   'Frente vidriado',          false, 10),
  ('templado',    'sistema_templado',  'Sistema de cristal templado', false, 10),
  ('mamparas',    'mampara_fija',      'Mampara fija',             false, 10),
  ('mamparas',    'mampara_corrediza', 'Mampara corrediza',        false, 20),
  ('mamparas',    'mampara_batiente',  'Mampara batiente',         false, 30),
  ('barandas',    'baranda_vidrio',    'Baranda de vidrio',        false, 10),
  ('espejos',     'espejo',            'Espejo',                   false, 10),
  ('vidrios',     'vidrio_simple',     'Vidrio simple',            false, 10),
  ('cerramientos','cerramiento',       'Cerramiento vidriado',     true,  10),
  ('techos',      'techo_vidriado',    'Techo vidriado',           false, 10),
  ('especiales',  'trabajo_especial',  'Trabajo especial',         true,  10)
) as v (family_code, code, name, requires_depth, sort_order)
join public.product_families f on f.code = v.family_code
on conflict (code) do nothing;

-- ---------------------------------------------------------------------
-- Campos dinámicos por producto
-- Cantidad, ancho, alto, profundidad y observaciones son campos base del
-- ítem y se muestran siempre; acá se define lo específico de cada producto.
-- ---------------------------------------------------------------------
create or replace function public._seed_field(
  p_product text, p_key text, p_label text, p_type public.field_type,
  p_section text, p_sort integer,
  p_unit text default null, p_options jsonb default null,
  p_catalog text default null, p_required boolean default false
) returns void language plpgsql as $$
begin
  insert into public.product_fields (
    product_type_id, field_key, label, field_type, section, unit,
    options, catalog_key, is_required, sort_order)
  select pt.id, p_key, p_label, p_type, p_section, p_unit,
         p_options, p_catalog, p_required, p_sort
  from public.product_types pt
  where pt.code = p_product
  on conflict (product_type_id, field_key) do nothing;
end;
$$;

-- Mampara (los tres tipos comparten definición)
do $$
declare p text;
begin
  foreach p in array array['mampara_fija', 'mampara_corrediza', 'mampara_batiente'] loop
    perform public._seed_field(p, 'tipo_vidrio',    'Tipo de vidrio',     'catalog', 'Vidrio', 10, null, null, 'tipo_vidrio', true);
    perform public._seed_field(p, 'espesor',        'Espesor',            'catalog', 'Vidrio', 20, 'mm', null, 'espesor', true);
    perform public._seed_field(p, 'color_herrajes', 'Color de herrajes',  'catalog', 'Herrajes', 30, null, null, 'color');
    perform public._seed_field(p, 'tipo_herrajes',  'Tipo de herrajes',   'catalog', 'Herrajes', 40, null, null, 'herraje');
    perform public._seed_field(p, 'tipo_fijacion',  'Tipo de fijación',   'select',  'Montaje', 50, null,
      '["A pared","A piso","Pared y piso","A techo","Perfil U","Botones"]'::jsonb);
    perform public._seed_field(p, 'apertura',       'Apertura',           'select',  'Montaje', 60, null,
      '["Fija","Corrediza","Batiente izquierda","Batiente derecha","Plegable"]'::jsonb);
  end loop;
end;
$$;

-- Espejo
select public._seed_field('espejo', 'tipo_vidrio',   'Tipo de espejo',   'catalog', 'Vidrio', 10, null, null, 'tipo_vidrio', true);
select public._seed_field('espejo', 'espesor',       'Espesor',          'catalog', 'Vidrio', 20, 'mm', null, 'espesor', true);
select public._seed_field('espejo', 'tipo_canto',    'Tipo de canto',    'catalog', 'Terminación', 30, null, null, 'terminacion');
select public._seed_field('espejo', 'perforaciones', 'Perforaciones',    'number',  'Terminación', 40, 'u');
select public._seed_field('espejo', 'detalle_perforaciones', 'Detalle de perforaciones', 'text', 'Terminación', 50);
select public._seed_field('espejo', 'led',           'LED',              'boolean', 'Extras', 60);
select public._seed_field('espejo', 'touch',         'Touch',            'boolean', 'Extras', 70);

-- Frente vidriado
select public._seed_field('frente_vidriado', 'cantidad_panos',  'Cantidad de paños',  'number', 'Configuración', 10, 'u', null, null, true);
select public._seed_field('frente_vidriado', 'panos_fijos',     'Paños fijos',        'number', 'Configuración', 20, 'u');
select public._seed_field('frente_vidriado', 'panos_moviles',   'Paños móviles',      'number', 'Configuración', 30, 'u');
select public._seed_field('frente_vidriado', 'ubicacion_puerta','Ubicación de puerta','select', 'Puerta', 40, null,
  '["Izquierda","Centro","Derecha","Sin puerta"]'::jsonb);
select public._seed_field('frente_vidriado', 'ancho_puerta',    'Ancho de puerta',    'number', 'Puerta', 50, 'mm');
select public._seed_field('frente_vidriado', 'sentido_apertura','Sentido de apertura','select', 'Puerta', 60, null,
  '["Hacia afuera","Hacia adentro","Doble acción","Corrediza"]'::jsonb);
select public._seed_field('frente_vidriado', 'tipo_vidrio',     'Tipo de vidrio',     'catalog','Vidrio', 70, null, null, 'tipo_vidrio', true);
select public._seed_field('frente_vidriado', 'espesor',         'Espesor',            'catalog','Vidrio', 80, 'mm', null, 'espesor', true);
select public._seed_field('frente_vidriado', 'tipo_herrajes',   'Tipo de herrajes',   'catalog','Herrajes', 90, null, null, 'herraje');
select public._seed_field('frente_vidriado', 'terminacion',     'Terminación',        'catalog','Terminación', 100, null, null, 'terminacion');

-- Sistema de cristal templado
select public._seed_field('sistema_templado', 'cantidad_panos',   'Cantidad de paños',       'number',  'Configuración', 10, 'u', null, null, true);
select public._seed_field('sistema_templado', 'configuracion',    'Configuración del sistema','select', 'Configuración', 20, null,
  '["Fijo","Fijo + puerta","Puerta doble","Corredizo","Plegable","Escaparate","Otro"]'::jsonb);
select public._seed_field('sistema_templado', 'posicion_panos',   'Posición de paños fijos y móviles', 'textarea', 'Configuración', 30);
select public._seed_field('sistema_templado', 'puerta',           'Puerta',                  'select',  'Puerta', 40, null,
  '["Sin puerta","Simple","Doble","Corrediza"]'::jsonb);
select public._seed_field('sistema_templado', 'sentido_apertura', 'Sentido de apertura',     'select',  'Puerta', 50, null,
  '["Hacia afuera","Hacia adentro","Doble acción","Corrediza"]'::jsonb);
select public._seed_field('sistema_templado', 'tipo_vidrio',      'Tipo de vidrio',          'catalog', 'Vidrio', 60, null, null, 'tipo_vidrio', true);
select public._seed_field('sistema_templado', 'espesor',          'Espesor',                 'catalog', 'Vidrio', 70, 'mm', null, 'espesor', true);
select public._seed_field('sistema_templado', 'color_accesorios', 'Color de accesorios',     'catalog', 'Herrajes', 80, null, null, 'color');
select public._seed_field('sistema_templado', 'tipo_herrajes',    'Tipo de herrajes',        'catalog', 'Herrajes', 90, null, null, 'herraje');
select public._seed_field('sistema_templado', 'fijaciones',       'Fijaciones',              'select',  'Montaje', 100, null,
  '["Perfil U piso","Perfil U techo","Botones","Araña","Pinzas","Mixta"]'::jsonb);
select public._seed_field('sistema_templado', 'obs_tecnicas',     'Observaciones técnicas',  'textarea','Montaje', 110);

-- Baranda
select public._seed_field('baranda_vidrio', 'cantidad_panos', 'Cantidad de paños', 'number',  'Configuración', 10, 'u');
select public._seed_field('baranda_vidrio', 'tipo_vidrio',    'Tipo de vidrio',    'catalog', 'Vidrio', 20, null, null, 'tipo_vidrio', true);
select public._seed_field('baranda_vidrio', 'espesor',        'Espesor',           'catalog', 'Vidrio', 30, 'mm', null, 'espesor', true);
select public._seed_field('baranda_vidrio', 'tipo_fijacion',  'Tipo de fijación',  'select',  'Montaje', 40, null,
  '["Perfil U a piso","Perfil U lateral","Botones","Pinzas","Anclaje a losa"]'::jsonb);
select public._seed_field('baranda_vidrio', 'pasamanos',      'Pasamanos',         'select',  'Montaje', 50, null,
  '["Sin pasamanos","Superior","Perimetral","Tubo redondo","Tubo cuadrado"]'::jsonb);
select public._seed_field('baranda_vidrio', 'color',          'Color',             'catalog', 'Terminación', 60, null, null, 'color');

-- Vidrio simple
select public._seed_field('vidrio_simple', 'tipo_vidrio',   'Tipo de vidrio', 'catalog', 'Vidrio', 10, null, null, 'tipo_vidrio', true);
select public._seed_field('vidrio_simple', 'espesor',       'Espesor',        'catalog', 'Vidrio', 20, 'mm', null, 'espesor', true);
select public._seed_field('vidrio_simple', 'tipo_canto',    'Tipo de canto',  'catalog', 'Terminación', 30, null, null, 'terminacion');
select public._seed_field('vidrio_simple', 'perforaciones', 'Perforaciones',  'number',  'Terminación', 40, 'u');

-- Cerramiento vidriado
select public._seed_field('cerramiento', 'cantidad_panos', 'Cantidad de paños', 'number',  'Configuración', 10, 'u');
select public._seed_field('cerramiento', 'tipo_apertura',  'Tipo de apertura',  'select',  'Configuración', 20, null,
  '["Fijo","Corredizo","Batiente","Plegable","Guillotina"]'::jsonb);
select public._seed_field('cerramiento', 'tipo_vidrio',    'Tipo de vidrio',    'catalog', 'Vidrio', 30, null, null, 'tipo_vidrio', true);
select public._seed_field('cerramiento', 'espesor',        'Espesor',           'catalog', 'Vidrio', 40, 'mm', null, 'espesor', true);
select public._seed_field('cerramiento', 'perfileria',     'Perfilería',        'catalog', 'Perfilería', 50, null, null, 'perfileria');
select public._seed_field('cerramiento', 'color',          'Color',             'catalog', 'Terminación', 60, null, null, 'color');

-- Techo vidriado
select public._seed_field('techo_vidriado', 'cantidad_panos', 'Cantidad de paños', 'number',  'Configuración', 10, 'u');
select public._seed_field('techo_vidriado', 'estructura',     'Estructura',        'select',  'Configuración', 20, null,
  '["Hierro","Aluminio","Madera","Sin estructura"]'::jsonb);
select public._seed_field('techo_vidriado', 'pendiente',      'Pendiente',         'text',    'Configuración', 30, '%');
select public._seed_field('techo_vidriado', 'tipo_vidrio',    'Tipo de vidrio',    'catalog', 'Vidrio', 40, null, null, 'tipo_vidrio', true);
select public._seed_field('techo_vidriado', 'espesor',        'Espesor',           'catalog', 'Vidrio', 50, 'mm', null, 'espesor', true);

-- Trabajo especial
select public._seed_field('trabajo_especial', 'descripcion_trabajo', 'Descripción del trabajo', 'textarea', 'Configuración', 10, null, null, null, true);
select public._seed_field('trabajo_especial', 'tipo_vidrio',         'Tipo de vidrio',          'catalog',  'Vidrio', 20, null, null, 'tipo_vidrio');
select public._seed_field('trabajo_especial', 'espesor',             'Espesor',                 'catalog',  'Vidrio', 30, 'mm', null, 'espesor');

drop function public._seed_field(text, text, text, public.field_type, text, integer, text, jsonb, text, boolean);
