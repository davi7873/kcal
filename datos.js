'use strict';
/* =====================================================================
   CALORÍAS Y MACROS · PWA sin dependencias · datos en localStorage
   Secciones: 1 Utilidades · 2 Datos por defecto · 3 Estado y cálculo
              4 Hojas/diálogos · 5 Vistas · 6 Eventos · 7 Arranque
   ===================================================================== */

/* ---------- 1. Utilidades ---------- */
const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const pad = n => String(n).padStart(2, '0');
const clone = o => JSON.parse(JSON.stringify(o));
const dkey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseKey = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (k, n) => { const d = parseKey(k); d.setDate(d.getDate() + n); return dkey(d); };
const today = () => dkey(new Date());
const mondayOf = k => { const d = parseKey(k); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return dkey(d); };
/* Acepta coma o punto decimal */
const num = v => { const n = parseFloat(String(v ?? '').replace(',', '.')); return isFinite(n) ? n : 0; };
const fmt = (n, dec = 0) => Number(n || 0).toLocaleString('es-ES', { minimumFractionDigits: dec, maximumFractionDigits: dec });
const plain = n => String(Math.round(n * 100) / 100).replace('.', ',');
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const norm = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const dateLabel = k => {
  const s = parseKey(k).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  return (k === today() ? 'Hoy · ' : '') + cap(s);
};
let toastTimer;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}

/* ---------- 2. Datos por defecto ---------- */
const MEALS = [
  { id: 'desayuno', name: 'Desayuno', icon: '☕' },
  { id: 'media', name: 'Media mañana', icon: '🍎' },
  { id: 'almuerzo', name: 'Almuerzo', icon: '🍽️' },
  { id: 'cena', name: 'Cena', icon: '🌙' }
];
const KEY = 'kcal-macros-v1';

/* Alimento: valores por 100 g. approx=true → pendiente de corregir con la etiqueta. */
const F = (id, name, kcal, p, f, c, fiber, approx, unit, note) =>
  ({ id, name, kcal, p, f, c, fiber, approx: !!approx, unit: unit || null, note: note || '' });
const SEED_FOODS = [
  F('arroz-basmati', 'Arroz basmati Hacendado cocido', 147, 3.2, 2.7, 27.5, 0.8, true, { name: 'ración', g: 125 },
    'Etiqueta: 185 kcal y 3,4 g de grasa por ración de 125 g. Proteína, carbos y fibra estimados.'),
  F('arroz-integral', 'Arroz integral Sabroz cocido', 164, 3.8, 2.2, 31, 2.8, false),
  F('quinoa', 'Quinoa Sabroz cocida', 151, 5.4, 1.7, 27, 3.5, false),
  F('lenteja', 'Lenteja cocida Hacendado (tarro)', 89, 8.2, 0.4, 10.7, 7.5, true, null,
    'Fibra no indicada en la etiqueta: estimada ~7-8 g.'),
  F('pavo', 'Pechuga de pavo', 108, 22, 2, 1, 0, true, null, 'Aproximado: ~108 kcal y ~22 g de proteína. Grasa y carbos estimados.'),
  F('queso-fresco', 'Queso fresco', 90, 11, 4, 3.5, 0, true, null, 'Aproximado: ~90 kcal y ~11 g de proteína. Grasa y carbos estimados.'),
  F('huevo', 'Huevo', 125, 10.8, 8.3, 0.7, 0, true, { name: 'pieza', g: 60 }, 'Pieza ~60 g: ~75 kcal y ~6,5 g de proteína.'),
  F('pan-centeno', 'Pan de centeno', 245, 8.5, 1.5, 46, 7, true, { name: 'rebanada', g: 30 }, 'Valores típicos; revisa tu marca.'),
  F('caña-lomo', 'Caña de lomo', 230, 36, 9, 1, 0, true, null, 'Valores típicos; revisa tu marca.'),
  F('aceite-oliva', 'Aceite de oliva', 900, 0, 100, 0, 0, true, { name: 'cucharada', g: 10 }),
  F('yogur-griego', 'Yogur griego', 125, 5.5, 9, 4, 0, true, { name: 'yogur', g: 125 }, 'Valores típicos; revisa tu marca.'),
  F('manzana', 'Manzana', 52, 0.3, 0.2, 13.8, 2.4, true, { name: 'pieza', g: 180 }),
  F('platano', 'Plátano', 90, 1.1, 0.3, 20, 2.6, true, { name: 'pieza', g: 110 }, 'Peso de la pieza ya pelada.'),
  F('cafe-leche', 'Café con leche con azúcar', 33, 1.7, 0.9, 4.9, 0, true, { name: 'taza', g: 200 },
    'Leche semidesnatada + 1 sobre de azúcar. Ajusta a tu caso.')
];


/* ---------- Catálogo base offline ----------
   Alimentos genéricos con valores APROXIMADOS por 100 g (tipo tablas de composición; carbohidratos "disponibles",
   sin fibra, como en las etiquetas europeas). No se mezclan con tu base: al buscar aparecen aparte y, al usar uno,
   se copia a tu base marcado como "aprox." para que lo corrijas cuando quieras.
   Formato: [nombre, kcal, proteína, grasa, carbos, fibra, unidad?, gramos de la unidad?] */
const CATALOG = [
  // Carnes y aves
  ['Pechuga de pollo (cruda)', 110, 23, 1.5, 0, 0], ['Pechuga de pollo (cocinada a la plancha)', 165, 31, 3.6, 0, 0],
  ['Muslo de pollo sin piel (crudo)', 120, 20, 4.5, 0, 0], ['Pollo entero con piel (crudo)', 215, 17, 16, 0, 0],
  ['Pechuga de pavo (cruda)', 105, 24, 1, 0, 0], ['Muslo de pavo (crudo)', 115, 20, 3.5, 0, 0],
  ['Ternera magra, filete (cruda)', 125, 21, 4.5, 0, 0], ['Ternera picada (cruda)', 200, 18, 14, 0, 0],
  ['Solomillo de ternera (crudo)', 135, 21, 5.5, 0, 0], ['Cerdo, lomo (crudo)', 145, 21, 6.5, 0, 0],
  ['Cerdo, solomillo (crudo)', 120, 21, 3.5, 0, 0], ['Cerdo, chuleta (cruda)', 200, 19, 13, 0, 0],
  ['Cerdo, carne picada (cruda)', 230, 17, 18, 0, 0], ['Cordero, pierna (cruda)', 170, 19, 10, 0, 0],
  ['Conejo (crudo)', 135, 21, 5.5, 0, 0], ['Hígado de ternera (crudo)', 135, 20, 3.6, 3.9, 0],
  ['Hamburguesa de ternera (cruda)', 230, 17, 17, 1, 0, 'hamburguesa', 120], ['Salchicha fresca de cerdo (cruda)', 270, 13, 23, 2, 0],
  ['Jamón cocido extra', 105, 17, 3.5, 1, 0, 'loncha', 20], ['Jamón serrano', 250, 31, 14, 0, 0, 'loncha', 15],
  ['Fiambre de pavo', 100, 17, 2, 2, 0, 'loncha', 20], ['Chorizo', 400, 22, 34, 2, 0, 'rodaja', 8],
  ['Salchichón', 410, 26, 34, 1, 0, 'rodaja', 8], ['Fuet', 430, 26, 35, 3, 0], ['Beicon / bacon', 340, 15, 31, 1, 0, 'loncha', 12],
  // Pescados y mariscos
  ['Salmón (crudo)', 200, 20, 13, 0, 0], ['Salmón ahumado', 180, 22, 10, 0, 0], ['Atún fresco', 130, 23, 4.5, 0, 0],
  ['Atún en lata al natural (escurrido)', 110, 25, 1, 0, 0, 'lata', 52], ['Atún en lata en aceite (escurrido)', 190, 26, 10, 0, 0, 'lata', 52],
  ['Merluza (cruda)', 80, 17, 1.2, 0, 0], ['Bacalao fresco (crudo)', 82, 18, 0.7, 0, 0], ['Dorada (cruda)', 100, 19, 2.5, 0, 0],
  ['Lubina (cruda)', 100, 18, 2.5, 0, 0], ['Lenguado (crudo)', 85, 17, 1.5, 0, 0], ['Rape (crudo)', 75, 15, 1.5, 0, 0],
  ['Trucha (cruda)', 120, 20, 4, 0, 0], ['Sardina (cruda)', 175, 19, 11, 0, 0], ['Boquerón (crudo)', 130, 17, 6.5, 0, 0],
  ['Caballa (cruda)', 205, 19, 14, 0, 0], ['Pez espada (crudo)', 140, 20, 6, 0, 0], ['Gambas / langostinos (crudos)', 85, 18, 1, 0.5, 0],
  ['Calamar (crudo)', 75, 15, 1, 2, 0], ['Pulpo (crudo)', 80, 15, 1, 2, 0], ['Sepia (cruda)', 80, 16, 1, 1, 0],
  ['Mejillones (cocidos)', 85, 12, 2, 3.5, 0], ['Almejas (crudas)', 70, 12, 1, 2.5, 0], ['Surimi / palitos de cangrejo', 95, 8, 1, 14, 0],
  ['Anchoas en aceite (escurridas)', 210, 25, 11, 0, 0],
  // Huevos y lácteos
  ['Clara de huevo', 50, 11, 0.2, 0.7, 0, 'clara', 33], ['Yema de huevo', 320, 16, 28, 0.3, 0, 'yema', 18],
  ['Huevo cocido', 150, 12.5, 10.5, 1, 0, 'huevo', 55], ['Tortilla francesa (2 huevos)', 190, 12.5, 15, 1, 0, 'tortilla', 110],
  ['Leche entera', 65, 3.2, 3.6, 4.7, 0, 'vaso', 200], ['Leche semidesnatada', 46, 3.3, 1.6, 4.8, 0, 'vaso', 200],
  ['Leche desnatada', 35, 3.4, 0.2, 4.9, 0, 'vaso', 200], ['Yogur natural entero', 62, 3.8, 3.3, 4.7, 0, 'yogur', 125],
  ['Yogur natural desnatado', 40, 4.3, 0.2, 5.5, 0, 'yogur', 125], ['Yogur griego 0%', 57, 10, 0.2, 3.5, 0, 'yogur', 125],
  ['Yogur de sabores / frutas', 90, 3.5, 2.5, 13, 0, 'yogur', 125], ['Skyr natural', 63, 11, 0.2, 4, 0, 'tarrina', 150],
  ['Requesón', 98, 11, 4, 3.5, 0], ['Queso batido 0%', 47, 8, 0.2, 4, 0, 'tarrina', 125], ['Mozzarella fresca', 250, 18, 19, 1, 0],
  ['Queso curado', 400, 26, 33, 0.5, 0, 'cuña', 30], ['Queso semicurado', 350, 24, 28, 0.5, 0, 'cuña', 30], ['Queso emmental', 380, 28, 29, 0, 0],
  ['Queso parmesano', 390, 36, 26, 0, 0], ['Queso de cabra', 270, 18, 22, 1, 0], ['Queso feta', 265, 14, 21, 4, 0],
  ['Queso de untar', 250, 6, 23, 4, 0, 'porción', 20], ['Cuajada', 90, 6, 5, 5, 0], ['Kéfir', 52, 3.5, 2, 4.5, 0, 'vaso', 200],
  ['Nata para cocinar', 195, 2.5, 19, 3.5, 0], ['Mantequilla', 740, 0.7, 82, 0.6, 0, 'porción', 10], ['Leche condensada', 330, 8, 9, 55, 0],
  ['Flan de huevo', 130, 4.5, 4, 19, 0, 'flan', 100], ['Helado de nata', 205, 3.5, 11, 23, 0, 'bola', 50],
  // Cereales, pan, pasta y arroz
  ['Arroz blanco (crudo)', 350, 7, 0.6, 78, 1.3], ['Arroz blanco (cocido)', 130, 2.7, 0.3, 28, 0.4], ['Arroz basmati (crudo)', 350, 8.5, 0.7, 77, 1.3],
  ['Arroz integral (crudo)', 360, 7.5, 2.7, 76, 3.5], ['Arroz integral (cocido)', 125, 2.7, 1, 26, 1.8],
  ['Pasta (cruda)', 360, 12.5, 1.5, 72, 3], ['Pasta (cocida)', 140, 5, 0.9, 28, 1.8], ['Pasta integral (cruda)', 340, 13, 2.5, 64, 8],
  ['Pasta integral (cocida)', 125, 5.5, 1, 24, 4.5], ['Cuscús (crudo)', 360, 13, 1.5, 72, 5], ['Cuscús (cocido)', 112, 3.8, 0.2, 23, 1.4],
  ['Quinoa (cruda)', 370, 14, 6, 64, 7], ['Quinoa (cocida)', 120, 4.4, 1.9, 21, 2.8], ['Avena (copos)', 370, 13, 7, 60, 10],
  ['Muesli', 360, 10, 6, 64, 8], ['Cereales de maíz (copos)', 375, 7, 1, 84, 3], ['Harina de trigo', 350, 10, 1, 73, 3],
  ['Maicena', 350, 0.3, 0.1, 87, 0], ['Pan blanco (barra)', 265, 9, 3, 50, 2.5, 'rebanada', 30], ['Pan integral', 245, 9, 3, 43, 7, 'rebanada', 30],
  ['Pan de molde blanco', 270, 8, 4, 50, 3, 'rebanada', 25], ['Pan de molde integral', 245, 9, 4, 41, 6.5, 'rebanada', 25],
  ['Pan de pita', 275, 9, 1.2, 55, 2.2, 'pita', 60], ['Tortilla de trigo (wrap)', 310, 8.5, 8, 50, 3, 'tortilla', 45],
  ['Biscotes', 400, 11, 6, 72, 4, 'biscote', 9], ['Tortitas de arroz', 385, 8, 3, 80, 3.5, 'tortita', 9], ['Galletas María', 430, 7, 10, 76, 3, 'galleta', 6],
  ['Croissant', 400, 8, 21, 45, 2, 'pieza', 60], ['Patata (cruda)', 80, 2, 0.1, 17, 2, 'patata', 170], ['Patata (cocida)', 86, 1.8, 0.1, 20, 1.8],
  ['Patatas fritas caseras', 300, 3.5, 15, 37, 3], ['Patatas fritas de bolsa', 540, 6, 34, 50, 4, 'bolsa pequeña', 40],
  ['Boniato (crudo)', 86, 1.6, 0.1, 20, 3], ['Maíz dulce en lata (escurrido)', 80, 2.5, 1, 15, 2.5],
  // Legumbres y derivados
  ['Garbanzos (crudos)', 360, 20, 5, 50, 15], ['Garbanzos (cocidos)', 130, 7.5, 2.6, 18, 5.5], ['Lentejas (crudas)', 330, 24, 1.5, 50, 11],
  ['Lentejas (cocidas)', 110, 8, 0.5, 16, 7.5], ['Alubias blancas (cocidas)', 105, 7, 0.5, 15, 6], ['Alubias (crudas)', 320, 22, 1.5, 46, 15],
  ['Guisantes (cocidos)', 80, 5.5, 0.4, 10, 5.5], ['Tofu', 120, 13, 7, 2, 1], ['Tempeh', 190, 19, 11, 8, 5],
  ['Hummus', 230, 7, 17, 12, 5, 'cucharada', 20],
  // Verduras y hortalizas
  ['Tomate', 20, 0.9, 0.2, 3.5, 1.2, 'tomate', 120], ['Lechuga', 14, 1.2, 0.2, 1.5, 1.3], ['Espinacas', 23, 2.9, 0.4, 1.5, 2.2],
  ['Brócoli', 34, 2.8, 0.4, 4.5, 2.6], ['Coliflor', 25, 2, 0.3, 3, 2.3], ['Zanahoria', 36, 0.9, 0.2, 7.5, 2.8, 'zanahoria', 80],
  ['Cebolla', 36, 1.1, 0.1, 7.5, 1.7, 'cebolla', 120], ['Pimiento rojo', 31, 1, 0.3, 6, 2, 'pimiento', 150], ['Pimiento verde', 22, 0.9, 0.2, 3.5, 1.8, 'pimiento', 150],
  ['Calabacín', 17, 1.2, 0.3, 2, 1], ['Berenjena', 25, 1, 0.2, 4, 3], ['Pepino', 15, 0.7, 0.1, 2.5, 0.6], ['Champiñones', 22, 3, 0.3, 1, 1.5],
  ['Judías verdes', 31, 1.8, 0.2, 5, 3], ['Espárragos', 20, 2.2, 0.2, 2, 1.5], ['Alcachofa', 50, 3, 0.2, 5, 5], ['Calabaza', 27, 1, 0.1, 5.5, 1],
  ['Puerro', 30, 2, 0.3, 5, 2], ['Ajo', 150, 6, 0.5, 28, 2, 'diente', 4], ['Remolacha (cocida)', 44, 1.7, 0.2, 8, 2], ['Col / repollo', 27, 1.5, 0.1, 4, 2.5],
  ['Apio', 16, 0.7, 0.2, 2, 1.6], ['Rúcula', 25, 2.6, 0.7, 2, 1.6], ['Acelgas', 20, 1.8, 0.2, 2, 1.6], ['Tomate triturado', 25, 1.2, 0.2, 4, 1.2],
  ['Tomate frito', 85, 1.5, 4.5, 9, 1.5, 'cucharada', 20], ['Aceitunas verdes', 145, 1, 15, 0.5, 3], ['Pepinillos en vinagre', 12, 0.5, 0.2, 2, 1],
  // Frutas
  ['Naranja', 45, 0.9, 0.2, 9, 2.2, 'pieza', 150], ['Mandarina', 42, 0.8, 0.2, 9, 1.8, 'pieza', 80], ['Pera', 57, 0.4, 0.1, 12, 3, 'pieza', 170],
  ['Fresas', 32, 0.7, 0.3, 6, 2], ['Uvas', 70, 0.7, 0.2, 16, 0.9], ['Melón', 34, 0.8, 0.2, 7.5, 0.9], ['Sandía', 30, 0.6, 0.2, 7, 0.4],
  ['Piña', 50, 0.5, 0.1, 11, 1.4], ['Kiwi', 60, 1.1, 0.5, 12, 3, 'pieza', 75], ['Melocotón', 40, 0.9, 0.3, 8.5, 1.5, 'pieza', 150],
  ['Nectarina', 44, 1.1, 0.3, 9, 1.7, 'pieza', 140], ['Albaricoque', 48, 1.4, 0.4, 9, 2, 'pieza', 45], ['Ciruela', 46, 0.7, 0.3, 10, 1.4, 'pieza', 60],
  ['Cerezas', 63, 1, 0.2, 13, 2.1], ['Arándanos', 57, 0.7, 0.3, 12, 2.4], ['Frambuesas', 52, 1.2, 0.7, 5.5, 6.5], ['Mango', 60, 0.8, 0.4, 14, 1.6],
  ['Papaya', 43, 0.5, 0.3, 9, 1.7], ['Higos', 74, 0.8, 0.3, 16, 2.9, 'higo', 50], ['Granada', 83, 1.7, 1.2, 14, 4], ['Limón', 29, 1.1, 0.3, 3, 2.8],
  ['Aguacate', 160, 2, 15, 2, 6.7, 'pieza', 150], ['Caqui', 70, 0.6, 0.2, 16, 3.6, 'pieza', 160], ['Dátiles', 280, 2.5, 0.4, 64, 7, 'dátil', 8],
  ['Pasas', 300, 3, 0.5, 69, 4, 'puñado', 30],
  // Frutos secos, semillas y dulces
  ['Almendras', 600, 21, 52, 6, 12, 'puñado', 30], ['Nueces', 650, 15, 65, 3, 6.7, 'puñado', 30], ['Cacahuetes tostados', 600, 26, 49, 8, 8, 'puñado', 30],
  ['Pistachos', 570, 20, 45, 10, 10, 'puñado', 30], ['Avellanas', 650, 15, 61, 5, 10, 'puñado', 30], ['Anacardos', 580, 18, 44, 22, 3.3, 'puñado', 30],
  ['Pipas de girasol peladas', 580, 21, 49, 10, 8], ['Semillas de chía', 490, 17, 31, 6, 34, 'cucharada', 12], ['Semillas de lino', 530, 18, 42, 2, 27, 'cucharada', 10],
  ['Semillas de calabaza', 560, 30, 46, 3, 6], ['Crema de cacahuete', 600, 25, 50, 10, 6, 'cucharada', 16],
  ['Chocolate negro 70%', 580, 8, 42, 33, 11, 'onza', 10], ['Chocolate con leche', 540, 7, 31, 57, 2, 'onza', 10],
  ['Cacao en polvo sin azúcar', 230, 20, 12, 12, 30, 'cucharada', 8], ['Crema de cacao con avellanas', 540, 6, 31, 57, 3, 'cucharada', 15],
  ['Miel', 305, 0.4, 0, 76, 0, 'cucharadita', 7], ['Azúcar', 400, 0, 0, 100, 0, 'cucharadita', 5], ['Mermelada', 240, 0.4, 0, 60, 1, 'cucharada', 20],
  // Grasas y salsas
  ['Aceite de girasol', 900, 0, 100, 0, 0, 'cucharada', 10], ['Margarina', 720, 0.2, 80, 0.5, 0, 'porción', 10],
  ['Mayonesa', 700, 1, 76, 2, 0, 'cucharada', 15], ['Kétchup', 115, 1.2, 0.2, 26, 0.8, 'cucharada', 17],
  // Bebidas y suplementos
  ['Café solo', 2, 0.1, 0, 0.3, 0, 'taza', 50], ['Café con leche semidesnatada (sin azúcar)', 25, 1.6, 0.8, 2.4, 0, 'taza', 200],
  ['Vino tinto', 85, 0.1, 0, 0.3, 0, 'copa', 150], ['Refresco de cola', 42, 0, 0, 10.6, 0, 'lata', 330], ['Refresco de cola zero', 0.3, 0, 0, 0, 0, 'lata', 330],
  ['Zumo de naranja', 45, 0.7, 0.2, 10, 0.2, 'vaso', 200], ['Bebida de avena', 45, 0.5, 1.5, 7, 0.8, 'vaso', 200], ['Bebida de soja', 35, 3.3, 1.8, 0.5, 0.4, 'vaso', 200],
  ['Bebida de almendras', 24, 0.8, 1.1, 2.5, 0.3, 'vaso', 200], ['Batido de chocolate', 70, 3, 1.5, 11, 0.3, 'brik', 200], ['Gazpacho', 45, 0.9, 3, 3.5, 0.8, 'vaso', 250],
  ['Proteína whey en polvo', 390, 78, 6, 6, 0, 'cacito', 30], ['Barrita proteica', 360, 30, 12, 32, 3, 'barrita', 45],
  // Platos y preparados (muy variables: ajústalos a los tuyos)
  ['Paella mixta', 150, 7, 5, 19, 0.8, 'plato', 350], ['Tortilla de patata', 190, 7, 13, 12, 1.2, 'ración', 150], ['Croquetas de jamón', 230, 7, 14, 19, 0.8, 'croqueta', 30],
  ['Lentejas estofadas con verduras', 90, 5.5, 2.5, 11, 4, 'plato', 300], ['Macarrones con tomate (cocinados)', 150, 5, 3, 25, 2, 'plato', 300],
  ['Pizza margarita', 260, 11, 9, 33, 2, 'porción', 125], ['Ensaladilla rusa', 190, 3, 15, 10, 1.2, 'ración', 150], ['Sándwich mixto', 270, 13, 12, 27, 1.5, 'sándwich', 150],
  ['Empanadilla de atún', 300, 8, 17, 30, 1.5, 'pieza', 50], ['Patatas bravas', 190, 2.5, 10, 23, 2, 'ración', 150]
];
const catId = name => 'cat-' + norm(name).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
/* Índices del catálogo que encajan con la búsqueda y aún no están en tu base */
function catalogMatches(q, max = 12) {
  const terms = norm(q).split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const have = new Set(state.foods.map(f => norm(f.name)));
  const out = [];
  for (let i = 0; i < CATALOG.length && out.length < max; i++) {
    const n = norm(CATALOG[i][0]);
    if (terms.every(t => n.includes(t)) && !have.has(n) && !foodById(catId(CATALOG[i][0]))) out.push(i);
  }
  return out;
}
/* Copia un alimento del catálogo a tu base (marcado como aproximado) y lo devuelve */
function addCatalog(i) {
  const c = CATALOG[i], id = catId(c[0]);
  let f = foodById(id);
  if (!f) {
    f = { id, name: c[0], kcal: c[1], p: c[2], f: c[3], c: c[4], fiber: c[5], approx: true,
          note: 'Catálogo base: valor aproximado de tablas de composición. Revísalo con tu etiqueta.',
          unit: c[6] ? { name: c[6], g: c[7] } : null };
    state.foods.push(f); save();
  }
  return f;
}
function catalogSectionHTML(q) {
  const idx = catalogMatches(q, 12);
  if (!idx.length) return '';
  return '<h2 style="margin-top:14px">Catálogo base</h2>' + idx.map(i => { const c = CATALOG[i];
    return `<button class="entry" data-a="catAdd" data-i="${i}"><span class="grow"><b>${esc(c[0])}</b>
      <span class="sub">${fmt(c[1])} kcal · P ${fmt(c[2], 1)} · G ${fmt(c[3], 1)} · C ${fmt(c[4], 1)} /100 g</span></span><span class="badge">＋ añadir</span></button>`; }).join('');
}

/* Rutinas del documento "Rutina de entrenamiento". Cada rutina lleva su duración de fuerza, intensidad (MET),
   cardio en cinta y los días de la semana en que se propone (0 dom … 6 sáb). Los minutos son una suposición editable. */
const mkRoutine = (id, name, dows, strengthMin, cardioMin, rows) => ({
  id, name, dows, strengthMin, met: 5, cardioMin, cardioSpeed: 8,
  rows: rows.map((r, i) => ({ id: `${id}-${i}`, block: r[0], name: r[1], sets: r[2], plan: r[3] }))
});
const SEED_ROUTINES = [
  mkRoutine('rut-1', 'Día 1 · Espalda, bíceps, prensa y full body', [1], 40, 20, [
    ['Superserie 1', 'Dorsales', '3x10', '40 kg + máquina'],
    ['Superserie 1', 'Bíceps paralelo al cuerpo', '3x10', '12,5 kg cada mano'],
    ['Superserie 2', 'Espalda posterior (cuerda hacia la cara en multipower)', '3x10', '60 kg'],
    ['Superserie 2', 'Prensa', '3x10', '180 kg + máquina'],
    ['Full body', 'Molino de pared', '3x10 (10 pases por mano)', '5 kg']]),
  mkRoutine('rut-2', 'Día 2 · Pecho, tríceps, zancada y full body', [2], 40, 20, [
    ['Superserie 1', 'Pecho plano', '3x10', '25 kg cada mano'],
    ['Superserie 1', 'Tríceps paralelo al cuerpo', '3x10', '50 kg'],
    ['Superserie 2', 'Pecho apertura', '3x10', '55 kg en máquina o 15 kg cada mano en banco'],
    ['Superserie 2', 'Zancada', '3x10', '20 kg cada mano'],
    ['Full body', 'Molino de pared', '3x10 (10 pases por mano)', '5 kg']]),
  mkRoutine('rut-3', 'Día 3 · Hombro, abdomen, sentadilla y peso muerto', [4], 60, 0, [
    ['Superserie 1', 'Hombro frontal (press militar)', '3x10', '17,5 kg cada mano'],
    ['Superserie 1', 'Abdominales (elevación de piernas rectas en máquina)', '3x10', 'Libre'],
    ['Superserie 2', 'Hombro lateral', '3x10', '40 kg en máquina o 10 kg cada mano con mancuerna'],
    ['Superserie 2', 'Oblicuos', '3x10', 'Libre, solo movimiento'],
    ['Pierna', 'Sentadilla', '3x10', 'Barra de 20 kg + 25 kg por lado (70 kg)'],
    ['Pierna', 'Peso muerto', '3x10', 'Barra de 20 kg + 35 kg por lado (90 kg)']])
];
/* Intensidad de la sesión de fuerza (MET aproximado) */
const INTENSITY = [['Suave', 3.5], ['Moderada', 5], ['Intensa', 6], ['Circuito intenso', 8]];
/* Deportes frecuentes (MET aproximado, Compendium of Physical Activities) */
const SPORTS = [['Fútbol', 7], ['Pádel', 6], ['Tenis', 7.3], ['Baloncesto', 6.5], ['Ciclismo moderado', 8],
                ['Natación', 6], ['Senderismo', 6], ['Bailar', 5], ['Yoga', 2.5]];
const MOLINO = [
  'Apoya la espalda en la pared y baja a posición de sentadilla, sin silla, con la espalda recta.',
  'Abre los brazos en cruz y sujeta una pesa de 5 kg en una mano.',
  'Sin doblar los codos, gira el torso para llevar la pesa a la otra mano.',
  'Abre de nuevo en cruz; la otra mano devuelve la pesa a la primera.',
  'Repite 20 pases por serie (10 con cada mano) y haz 3 series.'
];

function defaults() {
  return {
    v: 2,
    onboarded: false,   // false = usuario nuevo: se muestra la pantalla de bienvenida
    profile: {
      sex: 'M', age: 36, height: 180, weight: 83.5,   // valores iniciales; los cambios posteriores van en profileLog
      birth: '',               // fecha de nacimiento (AAAA-MM-DD); si está, la edad se calcula sola
      activity: 1.35,          // factor de actividad diario (trabajo sentado + ~4,2 km andando)
      alarm: 700,              // déficit a partir del cual se avisa en rojo
      deficitGoal: 500,        // déficit diario que buscas (para "te quedan X kcal")
      beerKcal: 95,            // kcal por caña de 200 ml
      gym: { 0: 350, 1: 350, 2: 350, 3: 350, 4: 250, 5: 350, 6: 350 },   // solo para datos antiguos sin sesión
      targets: { p: 150, f: 65, c: 190, fiber: 30 }   // objetivos diarios en gramos
    },
    // Historial del perfil: cada entrada vale desde su fecha ('from') hasta la siguiente
    profileLog: [{ from: '0000-00-00', sex: 'M', age: 36, height: 180, activity: 1.35 }],
    foods: [],        // vacía para usuarios nuevos (usan el catálogo base, el escáner u Open Food Facts)
    meals: [],        // comidas guardadas: {id, name, items:[{foodId, grams}]}
    // Día: {train, alcohol, entries:{…}, session:{routineId, strengthMin, met, cardioMin, cardioSpeed, kg:{rowId:'texto'}},
    //       activities:[{id, name, min, met, kcalManual, speed}]}
    days: {},
    weights: [],      // [{date, kg}]
    routines: [],
    lastGrams: {},    // última cantidad usada por alimento
    recent: [],       // ids de alimentos usados recientemente
    theme: 'auto',
    created: today(), // primer uso (para recordar la copia de seguridad)
    lastExport: '',   // fecha de la última copia exportada
    snooze: ''        // el aviso de copia se oculta hasta esta fecha
  };
}

/* ---------- 3. Estado, persistencia y cálculos ---------- */
/* Convierte el formato antiguo de rutinas (una por día de la semana) al nuevo */
function migrateRoutines(old) {
  return Object.keys(old).map(k => {
    const o = old[k], rows = o.rows || [], cardio = rows.find(x => x[0] === 'Cardio'), id = 'rut-' + k;
    return { id, name: o.title || 'Rutina', dows: [+k], strengthMin: 45, met: 5, cardioMin: cardio ? num(cardio[2]) : 0, cardioSpeed: 8,
      rows: rows.filter(x => x[0] !== 'Cardio').map((r, i) => ({ id: `${id}-${i}`, block: r[0] || '', name: r[1] || '', sets: r[2] || '', plan: r[3] || '' })) };
  });
}
function normalize(s) {
  const d = defaults(), sp = s.profile || {};
  const out = Object.assign({}, d, s);
  out.profile = Object.assign({}, d.profile, sp);
  out.profile.gym = Object.assign({}, d.profile.gym, sp.gym || {});
  out.profile.targets = Object.assign({}, d.profile.targets, sp.targets || {});
  ['foods', 'meals', 'weights', 'recent'].forEach(k => { if (!Array.isArray(out[k])) out[k] = d[k]; });
  ['days', 'lastGrams'].forEach(k => { if (!out[k] || typeof out[k] !== 'object') out[k] = d[k]; });
  out.foods = out.foods.filter(f => f && f.id && f.name).map(f => ({
    id: String(f.id), name: String(f.name), kcal: num(f.kcal), p: num(f.p), f: num(f.f), c: num(f.c), fiber: num(f.fiber),
    approx: !!f.approx, note: f.note || '',
    unit: f.unit && f.unit.name && num(f.unit.g) > 0 ? { name: String(f.unit.name), g: num(f.unit.g) } : null
  }));
  // Rutinas: si vienen del formato antiguo se migran; si no hay ninguna, las de serie
  if (!Array.isArray(s.routines)) out.routines = s.routine && typeof s.routine === 'object' ? migrateRoutines(s.routine) : clone(SEED_ROUTINES);
  delete out.routine;
  out.routines = out.routines.filter(r => r && r.id && Array.isArray(r.rows)).map(r => ({
    id: String(r.id), name: String(r.name || 'Rutina'), dows: Array.isArray(r.dows) ? r.dows.map(Number) : [],
    strengthMin: num(r.strengthMin), met: num(r.met) || 5, cardioMin: num(r.cardioMin), cardioSpeed: num(r.cardioSpeed) || 5,
    rows: r.rows.map((x, i) => ({ id: String(x.id || `${r.id}-${i}`), block: x.block || '', name: x.name || '', sets: x.sets || '', plan: x.plan || '' }))
  }));
  // Historial del perfil con fecha (para que un cambio no altere los días anteriores)
  if (!Array.isArray(s.profileLog) || !s.profileLog.length)
    out.profileLog = [{ from: '0000-00-00', sex: out.profile.sex, age: out.profile.age, height: out.profile.height, activity: out.profile.activity }];
  out.profileLog = out.profileLog.slice().sort((a, b) => a.from.localeCompare(b.from));
  if (!out.created) out.created = today();
  out.onboarded = s.onboarded !== undefined ? !!s.onboarded : true;   // datos ya existentes = no es usuario nuevo
  return out;
}
function load() {
  let raw = null;
  try { raw = localStorage.getItem(KEY); } catch (e) {}
  if (!raw) return defaults();
  try { return normalize(JSON.parse(raw)); }
  catch (e) {
    // Datos ilegibles: se guarda una copia por si se pueden recuperar y se arranca limpio
    try { localStorage.setItem(KEY + '-corrupto', raw); } catch (e2) {}
    return defaults();
  }
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch (e) { toast('No se pudo guardar (almacenamiento lleno o bloqueado)'); }
}
let state = load();
/* Estado de la interfaz (no se guarda) */
const ui = { tab: 'diary', date: today(), weekRef: today(), inclToday: false, foodQ: '', foodFilter: 'all',
             wRange: 90, routineOpen: false, calcOpen: false };

const ZERO = () => ({ kcal: 0, p: 0, f: 0, c: 0, fiber: 0 });
const addTo = (a, b) => { a.kcal += b.kcal; a.p += b.p; a.f += b.f; a.c += b.c; a.fiber += b.fiber; return a; };
const foodById = id => state.foods.find(f => f.id === id);
/* Si el alimento se borró, se usa la copia (snap) guardada en la entrada */
const foodOf = e => foodById(e.foodId) || e.snap || null;
function macrosOf(e) {
  const f = foodOf(e); if (!f) return ZERO();
  const k = e.grams / 100;
  return { kcal: f.kcal * k, p: f.p * k, f: f.f * k, c: f.c * k, fiber: f.fiber * k };
}
function ensureDay(key) {
  if (!state.days[key]) state.days[key] = { train: false, alcohol: 0, entries: {} };
  const d = state.days[key];
  if (!d.entries) d.entries = {};
  return d;
}
/* Totales de un día: por comida y total (el total incluye las kcal del alcohol) */
function dayTotals(key) {
  const d = state.days[key], meals = {}, total = ZERO();
  MEALS.forEach(m => {
    const t = ZERO();
    ((d && d.entries && d.entries[m.id]) || []).forEach(e => addTo(t, macrosOf(e)));
    meals[m.id] = t; addTo(total, t);
  });
  const alcohol = d ? (d.alcohol || 0) * state.profile.beerKcal : 0;
  total.kcal += alcohol;
  return { meals, total, alcohol };
}
/* Peso vigente en una fecha: último registro anterior o igual; si no hay, el del perfil */
function weightAt(key) {
  let best = null;
  state.weights.forEach(w => { if (w.date <= key && (!best || w.date > best.date)) best = w; });
  return best ? best.kg : state.profile.weight;
}
/* Perfil vigente en una fecha (sexo, edad, altura, factor de actividad).
   Cada cambio se guarda con su fecha y solo afecta de ese día en adelante. */
function profileAt(key) {
  let best = state.profileLog[0];
  state.profileLog.forEach(e => { if (e.from <= key) best = e; });
  return best;
}
function setProfileField(field, value) {
  const t = today();
  let e = state.profileLog.find(x => x.from === t);
  if (!e) {
    e = Object.assign({}, profileAt(t), { from: t });
    state.profileLog.push(e);
    state.profileLog.sort((a, b) => a.from.localeCompare(b.from));
  }
  e[field] = value;
}
/* Metabolismo basal con Mifflin-St Jeor, con el perfil vigente ese día */
function bmrFor(kg, key) {
  const k = key || today(), q = profileAt(k);
  return 10 * kg + 6.25 * q.height - 5 * ageAt(k) + (q.sex === 'F' ? -161 : 5);
}
/* Edad en una fecha: años cumplidos según la fecha de nacimiento (si no hay, la edad escrita a mano) */
function ageAt(key) {
  const b = state.profile.birth;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b || '')) return profileAt(key).age;
  const [by, bm, bd] = b.split('-').map(Number), [y, m, d] = key.split('-').map(Number);
  return Math.max(0, y - by - ((m < bm || (m === bm && d < bd)) ? 1 : 0));
}
/* MET de caminar/correr según velocidad (km/h), interpolado de la tabla del Compendium of Physical Activities (aprox.) */
const WALK_MET = [[0, 2.0], [3.2, 2.8], [4.0, 3.0], [4.8, 3.5], [5.6, 4.3], [6.4, 5.0], [7.2, 7.0], [8.0, 8.3],
                  [9.7, 9.8], [11.3, 11.0], [12.9, 11.8], [14.5, 12.8]];
function metWalk(v) {
  const t = WALK_MET;
  if (v <= t[0][0]) return t[0][1];
  for (let i = 1; i < t.length; i++) {
    if (v <= t[i][0]) { const [x0, y0] = t[i - 1], [x1, y1] = t[i]; return y0 + (y1 - y0) * (v - x0) / (x1 - x0); }
  }
  return t[t.length - 1][1];
}
/* kcal NETAS = (MET − 1) × kg × horas. Se resta 1 MET porque el reposo ya está dentro de basal × actividad. */
const netKcal = (met, kg, min) => Math.max(0, met - 1) * kg * min / 60;
const routineById = id => state.routines.find(r => r.id === id) || null;
const routineFor = key => { const dow = parseKey(key).getDay(); return state.routines.find(r => (r.dows || []).includes(dow)) || null; };
const sessionFromRoutine = r => r
  ? { routineId: r.id, strengthMin: r.strengthMin, met: r.met, cardioMin: r.cardioMin, cardioSpeed: r.cardioSpeed, kg: {} }
  : { routineId: null, strengthMin: 0, met: 5, cardioMin: 0, cardioSpeed: 5, kg: {} };
/* Sesión del día: se crea al activar "Hoy entreno" con la rutina propuesta para ese día de la semana */
function ensureSession(key) {
  const d = ensureDay(key);
  if (!d.session) { d.session = sessionFromRoutine(routineFor(key)); save(); }
  if (!d.session.kg) d.session.kg = {};
  return d.session;
}
/* Últimos kilos anotados para un ejercicio de una rutina, antes de la fecha dada */
function priorSessions(routineId, key) {
  return Object.keys(state.days).filter(k => k < key && state.days[k].session && state.days[k].session.routineId === routineId).sort().reverse();
}
function lastKg(routineId, rowId, key) {
  for (const k of priorSessions(routineId, key)) { const v = (state.days[k].session.kg || {})[rowId]; if (v) return v; }
  return '';
}
/* Gasto del entrenamiento (fuerza + cinta). Si había "hoy entreno" sin sesión (datos antiguos), se usa el valor fijo de antes. */
function trainParts(key) {
  const d = state.days[key], z = { strength: 0, cardio: 0, total: 0, legacy: false };
  if (!d || !d.train) return z;
  if (!d.session) { const g = num(state.profile.gym[parseKey(key).getDay()]); return { strength: g, cardio: 0, total: g, legacy: true }; }
  const kg = weightAt(key), s = d.session;
  const strength = netKcal(num(s.met) || 5, kg, num(s.strengthMin)), cardio = netKcal(metWalk(num(s.cardioSpeed)), kg, num(s.cardioMin));
  return { strength, cardio, total: strength + cardio, legacy: false };
}
const activityKcal = (a, key) => num(a.kcalManual) > 0 ? num(a.kcalManual) : netKcal(num(a.met), weightAt(key), num(a.min));
function extraKcal(key) {
  const d = state.days[key];
  return d && d.activities ? d.activities.reduce((s, a) => s + activityKcal(a, key), 0) : 0;
}
/* Gasto del día = basal × factor de actividad + entrenamiento + actividad extra (todo con el peso y perfil de ESE día) */
function expenseOf(key) {
  const q = profileAt(key), bmr = bmrFor(weightAt(key), key), base = bmr * q.activity;
  const train = trainParts(key), extra = extraKcal(key);
  return { bmr, base, activity: q.activity, train, extra, total: base + train.total + extra };
}
/* Balance = ingesta − gasto. Negativo = déficit. */
function balanceInfo(key) {
  const intake = dayTotals(key).total.kcal, ex = expenseOf(key).total, bal = intake - ex, deficit = -bal;
  const alarm = state.profile.alarm;
  if (intake <= 0) return { cls: 'none', txt: 'Sin comidas registradas', bal, intake, ex };
  if (deficit > alarm) return { cls: 'danger', txt: `Déficit de ${fmt(deficit)} kcal · supera el límite de ${fmt(alarm)}`, bal, intake, ex };
  if (bal > 0) return { cls: 'warn', txt: `Superávit de ${fmt(bal)} kcal`, bal, intake, ex };
  return { cls: '', txt: `Déficit de ${fmt(deficit)} kcal`, bal, intake, ex };
}
function addEntry(key, mealId, food, grams) {
  const d = ensureDay(key);
  (d.entries[mealId] = d.entries[mealId] || []).push({
    id: uid(), foodId: food.id, grams,
    snap: { name: food.name, kcal: food.kcal, p: food.p, f: food.f, c: food.c, fiber: food.fiber, unit: food.unit }
  });
  state.lastGrams[food.id] = grams;
  state.recent = [food.id, ...state.recent.filter(i => i !== food.id)].slice(0, 15);
}
function addMealToDay(meal, mealId, key, mult = 1) {
  let skipped = 0;
  meal.items.forEach(it => {
    const f = foodById(it.foodId);
    if (f) addEntry(key, mealId, f, Math.round(it.grams * mult * 10) / 10); else skipped++;
  });
  save(); render();
  const x = mult === 1 ? '' : ` (×${plain(mult)})`;
  toast(skipped ? `Añadida${x} (${skipped} alimento(s) ya no existen)` : `"${meal.name}"${x} añadida`);
}
/* Selector de ración (½×, 1×, 1½×, 2×) para las comidas guardadas */
const MULTS = [0.5, 1, 1.5, 2];
const multBar = () => `<div class="chips" id="mchips">${MULTS.map(v => `<button class="chip ${v === 1 ? 'on' : ''}" data-v="${v}">${v === 0.5 ? '½' : v === 1.5 ? '1½' : v}×</button>`).join('')}</div>`;
function bindMult(b, onChange) {
  let m = 1;
  $('#mchips', b).addEventListener('click', ev => {
    const c = ev.target.closest('.chip'); if (!c) return;
    m = +c.dataset.v; b.querySelectorAll('#mchips .chip').forEach(x => x.classList.toggle('on', x === c));
    if (onChange) onChange(m);
  });
  return () => m;
}
const mealTotals = meal => meal.items.reduce((t, it) => {
  const f = foodById(it.foodId); return f ? addTo(t, macrosOf({ foodId: f.id, grams: it.grams })) : t;
}, ZERO());
/* "2 × ración · 250 g" si la cantidad es múltiplo de la unidad del alimento */
function qtyText(e) {
  const f = foodOf(e), u = f && f.unit;
  if (u && u.g > 0) {
    const n = e.grams / u.g;
    if (Math.abs(n * 2 - Math.round(n * 2)) < 1e-6) return `${fmt(n, n % 1 ? 1 : 0)} × ${u.name} · ${fmt(e.grams)} g`;
  }
  return `${fmt(e.grams)} g`;
}
window.__p = (window.__p || 0) + 1;   // marca: este archivo se cargó entero
