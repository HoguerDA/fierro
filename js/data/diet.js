// Dieta base. Valores por 100 g: kcal, proteína, carbohidrato, grasa.
// Pesos en crudo salvo arroz y papa (cocidos).

export const FOODS = {
  'Plátano': [89, 1.1, 23, 0.3],
  'Proteína en polvo (whey)': [400, 80, 7, 5],
  'Leche alta en proteína': [55, 6, 4.5, 1.5],
  'Queso cottage light': [80, 11, 4, 2],
  'Pan integral': [250, 12, 43, 3.5],
  'Miel': [304, 0.3, 82, 0],
  'Pechuga de pavo Kirkland': [107, 23, 2, 1],
  'Pechuga de pollo cocida': [165, 31, 0, 3.6],
  'Arroz cocido': [130, 2.7, 28, 0.3],
  'Papa cocida u horneada': [93, 2.5, 21, 0.1],
  'Jitomate': [18, 0.9, 3.9, 0.2],
  'Espinaca': [23, 2.9, 3.6, 0.4],
  'Aguacate': [160, 2, 9, 15],
  'Aceite de oliva': [884, 0, 0, 100],
  'Yogurt griego natural sin grasa': [59, 10, 3.6, 0.4],
  'Fruta (fresa, manzana, papaya)': [40, 0.7, 10, 0.3],
  'Almendras o nuez': [600, 20, 20, 52],
  'Pescado blanco (tilapia, basa)': [96, 20, 0, 1.7],
  'Salmón': [208, 20, 0, 13],
  'Verduras (calabaza, zanahoria, cebolla)': [35, 1.2, 8, 0.2],
  'Tortilla de maíz': [218, 5.7, 45, 2.9],
  'Salmas': [380, 9, 78, 3],
  'Huevo entero': [155, 13, 1.1, 11],
  'Carne de res magra': [180, 26, 0, 8],
  'Atún en agua (escurrido)': [116, 26, 0, 1],
};

const it = (alimento, gramos, nota = '') => ({ alimento, gramos, nota });

// Carbohidratos que se mueven con el ajuste automático. paso = gramos de una pieza;
// unidad = cómo se cuenta; papa = gramos de papa por gramo del alimento, para la alternativa.
const AJUSTABLES = {
  'Arroz cocido': { paso: 10, min: 60, papa: 1.2 },
  'Pan integral': { paso: 40, min: 40, unidad: ['rebanada', 'rebanadas'] },
  'Tortilla de maíz': { paso: 30, min: 30, unidad: ['tortilla', 'tortillas'], papa: 2.5 },
  'Salmas': { paso: 6.25, min: 12.5, unidad: ['pieza', 'piezas'] },
};

const redondea = (g, paso) => Math.round(g / paso) * paso;

function notaAjustada(x, cfg) {
  const partes = [];
  if (cfg.unidad) { const n = Math.round(x.gramos / cfg.paso); partes.push(`${n} ${cfg.unidad[n === 1 ? 0 : 1]}`); }
  if (cfg.papa) partes.push(`${cfg.unidad ? 'o' : 'O'} ${redondea(x.gramos * cfg.papa, 10)} g de papa`);
  return partes.join(', ');
}

// El plan del día con las porciones de carbohidrato movidas `delta` kcal (negativo = menos comida).
// Escala todos los ajustables por igual, en piezas enteras, y el arroz absorbe lo que falte.
export function planDelDia(tipo, delta = 0) {
  const base = PLANS[tipo];
  if (!delta || Math.abs(delta) < 20) return base;
  const plan = { ...base, comidas: base.comidas.map((c) => ({ ...c, items: c.items.map((x) => ({ ...x })) })) };
  const items = plan.comidas.flatMap((c) => c.items).filter((x) => AJUSTABLES[x.alimento]);
  const kcalDe = (x) => FOODS[x.alimento][0] * x.gramos / 100;
  const total = items.reduce((a, x) => a + kcalDe(x), 0);
  if (!total) return base;
  const f = Math.max(0, 1 + delta / total);
  for (const x of items) {
    const cfg = AJUSTABLES[x.alimento];
    if (x.alimento !== 'Arroz cocido') x.gramos = Math.max(cfg.min, redondea(x.gramos * f, cfg.paso));
  }
  const objetivo = total + delta;
  const arroces = items.filter((x) => x.alimento === 'Arroz cocido');
  const resto = items.filter((x) => x.alimento !== 'Arroz cocido').reduce((a, x) => a + kcalDe(x), 0);
  const porArroz = Math.max(0, objetivo - resto) / arroces.length;
  for (const x of arroces) x.gramos = Math.max(AJUSTABLES['Arroz cocido'].min, redondea(porArroz / FOODS['Arroz cocido'][0] * 100, 10));
  for (const x of items) {
    const orig = base.comidas.flatMap((c) => c.items).find((o) => o.alimento === x.alimento && o.nota === x.nota);
    if (orig && orig.gramos === x.gramos) continue;
    x.gramos = Math.round(x.gramos);
    x.nota = notaAjustada(x, AJUSTABLES[x.alimento]);
  }
  return plan;
}

export const PLANS = {
  entreno: {
    nombre: 'Día de entreno',
    descripcion: '3 comidas más la toma pre-entreno. El carbohidrato se concentra alrededor del gym.',
    ajusteKcal: +100,
    comidas: [
      { nombre: 'Pre-entreno', hora: '5:40', items: [
        it('Plátano', 120),
        it('Proteína en polvo (whey)', 30, 'Con 5 g de creatina. Agua, no leche: cae más ligero antes de entrenar.'),
      ]},
      { nombre: 'Post-entreno (desayuno real)', hora: '7:45', items: [
        it('Leche alta en proteína', 250),
        it('Queso cottage light', 150),
        it('Pan integral', 80, '2 rebanadas'),
        it('Fruta (fresa, manzana, papaya)', 150),
        it('Miel', 15, '1 cucharada, sobre el cottage o la fruta'),
      ]},
      { nombre: 'Comida', hora: '13:00', items: [
        it('Pechuga de pavo Kirkland', 250, 'O 200 g de pollo'),
        it('Arroz cocido', 250, 'O 300 g de papa'),
        it('Jitomate', 100),
        it('Espinaca', 40),
        it('Aguacate', 120, 'Un aguacate chico'),
        it('Aceite de oliva', 10, '1 cucharada para la espinaca'),
      ]},
      { nombre: 'Cena', hora: '20:00', items: [
        it('Salmón', 230, 'A la plancha o al horno sin aceite: el salmón ya trae su grasa. Si no hay, 300 g de pescado blanco con 1 cucharada de aceite.'),
        it('Verduras (calabaza, zanahoria, cebolla)', 250),
        it('Tortilla de maíz', 60, '2 tortillas, o 150 g de papa'),
        it('Salmas', 25, '4 piezas'),
      ]},
    ],
  },
  descanso: {
    nombre: 'Día de descanso',
    descripcion: '3 comidas, sin pre-entreno. Proteína igual: el músculo se construye también en descanso.',
    ajusteKcal: -100,
    comidas: [
      { nombre: 'Desayuno', hora: '7:30', items: [
        it('Leche alta en proteína', 250),
        it('Queso cottage light', 150),
        it('Pan integral', 80, '2 rebanadas'),
        it('Plátano', 120),
      ]},
      { nombre: 'Comida', hora: '13:00', items: [
        it('Pechuga de pavo Kirkland', 330, 'O 260 g de pollo'),
        it('Arroz cocido', 270, 'O 330 g de papa'),
        it('Jitomate', 100),
        it('Espinaca', 40),
        it('Aguacate', 120),
        it('Aceite de oliva', 10),
      ]},
      { nombre: 'Cena', hora: '20:00', items: [
        it('Salmón', 230, 'A la plancha o al horno sin aceite'),
        it('Verduras (calabaza, zanahoria, cebolla)', 250),
        it('Salmas', 25, '4 piezas'),
        it('Fruta (fresa, manzana, papaya)', 100, 'De postre, para el antojo de dulce en la noche'),
      ]},
    ],
  },
};

export const SWAPS = [
  ['Proteína magra', '250 g pavo Kirkland = 200 g pechuga de pollo = 220 g pescado blanco = 170 g salmón (más grasa, quita el aceite ese día) = 200 g res magra = 200 g atún en agua = 5 claras + 2 huevos'],
  ['Carbohidrato', '200 g arroz cocido = 250 g papa = 3 tortillas de maíz = 80 g pasta en seco = 2 rebanadas de pan integral + 1 plátano = 10 Salmas'],
  ['Grasa', '120 g aguacate = 1 cucharada y media de aceite = 30 g almendras'],
  ['Fruta', '150 g fresa = 1 manzana = 200 g papaya = 1 plátano chico = 150 g uvas'],
  ['Comida fuera, bien', 'Tacos de bistec o pollo asado, 4 piezas sin tortilla doble, con salsa y cebolla, sin queso ni crema: cuenta como la Comida.'],
  ['Comida fuera, bien', 'Sushi: rollos sin tempura ni queso crema, sashimi o bowl de arroz con salmón. Cuenta como Cena.'],
  ['Comida fuera, bien', 'Pollo rostizado del súper o Costco, medio pollo sin piel + ensalada. Cuenta como Comida con carbo si agregas tortillas.'],
];

export const RULES = [
  'Una comida libre a la semana, planeada el día antes. Se registra como cualquier otra: no es trampa, es parte del plan.',
  'Si te saltas una comida no la "recuperes" comiendo doble. Sigue con la siguiente.',
  'Los gramos de proteína no se negocian. Carbohidrato y grasa se mueven si hace falta.',
  'Lo que importa es el promedio de la semana, no el día. Un día malo no rompe nada; una semana mala sí.',
  'Agua: 3 litros al día mínimo. Café sin azúcar, el que quieras hasta las 2 pm.',
  'Pésate todos los días al despertar, después del baño y antes de comer. La app saca el promedio.',
  'Cada 2 semanas la app revisa tu promedio de peso. Si no bajó 0.4 kg o más, te pregunta si seguiste la dieta: si sí, quita 150 kcal de carbohidrato y las porciones salen ajustadas; si la rompiste, el plan no cambia.',
  'Cada 9 semanas la app pone sola una semana de descanso de dieta: comes a mantenimiento, con más carbohidrato en las mismas comidas. Luego regresa al plan normal.',
];

// Macros de una lista de items [{alimento, gramos}] → {kcal, p, c, f}
export function macros(items) {
  const t = { kcal: 0, p: 0, c: 0, f: 0 };
  for (const { alimento, gramos } of items) {
    const f = FOODS[alimento];
    if (!f) continue;
    const k = gramos / 100;
    t.kcal += f[0] * k; t.p += f[1] * k; t.c += f[2] * k; t.f += f[3] * k;
  }
  return t;
}
