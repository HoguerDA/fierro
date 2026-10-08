// Rutina base: 4 días Superior / Inferior.
// La rutina es una SECUENCIA, no un calendario: la siguiente sesión es la que sigue
// en la lista sin importar qué día de la semana sea.
//
// reps: rango [mínimo, máximo]. rir: repeticiones en reserva objetivo al terminar la serie.
// descanso en segundos. clave: ejercicios donde se agregan series primero en el bloque.
// tipo: 'superior' | 'inferior' decide el incremento de carga (2.5 kg / 5 kg).

export const SEQUENCE = ['sup_a', 'inf_a', 'sup_b', 'inf_b'];

export const SESSIONS = {
  sup_a: {
    id: 'sup_a',
    nombre: 'Superior A',
    enfasis: 'Pecho y hombro',
    ejercicios: [
      ex('Press de banca con barra', 'Pecho', 4, [5, 8], 2, 150, 'superior', true,
        ['Press plano con mancuernas', 'Press de pecho en máquina'],
        'Escápulas juntas, pies firmes, barra baja al esternón.'),
      ex('Jalón al pecho', 'Espalda', 3, [8, 10], 2, 120, 'superior', true,
        ['Dominadas asistidas', 'Jalón con mancuerna en banco'],
        'Pecho arriba, codos hacia las costillas.'),
      ex('Press inclinado con mancuernas', 'Pecho', 3, [8, 12], 1, 120, 'superior', false,
        ['Press inclinado en máquina', 'Flexiones con pies elevados'],
        'Banco a 30°, no más.'),
      ex('Remo con mancuerna a una mano', 'Espalda', 3, [10, 12], 1, 90, 'superior', false,
        ['Remo en máquina', 'Remo con barra'],
        'Jala con el codo, no con la mano.'),
      ex('Elevaciones laterales con mancuernas', 'Hombro', 4, [12, 15], 1, 75, 'superior', false,
        ['Elevaciones laterales en polea', 'Elevaciones laterales en máquina'],
        'Codos un poco flexionados, sin balanceo.'),
      ex('Extensión de tríceps en polea', 'Tríceps', 3, [10, 15], 1, 75, 'superior', false,
        ['Extensión de tríceps con mancuerna sobre la cabeza', 'Fondos en banco'],
        'Codos pegados al cuerpo.'),
      ex('Curl de bíceps con barra', 'Bíceps', 3, [10, 12], 1, 75, 'superior', false,
        ['Curl de bíceps con mancuernas', 'Curl de bíceps en polea'],
        'Sin impulso de espalda.'),
    ],
  },
  inf_a: {
    id: 'inf_a',
    nombre: 'Inferior A',
    enfasis: 'Cuádriceps',
    ejercicios: [
      ex('Sentadilla con barra', 'Cuádriceps', 4, [5, 8], 2, 180, 'inferior', true,
        ['Prensa de piernas', 'Sentadilla goblet con mancuerna pesada'],
        'Baja hasta que el muslo pase la horizontal si la movilidad lo permite.'),
      ex('Peso muerto rumano', 'Isquios', 3, [8, 10], 2, 120, 'inferior', true,
        ['Peso muerto rumano con mancuernas', 'Buenos días con barra'],
        'Cadera atrás, espalda neutra, siente el estiramiento.'),
      ex('Prensa de piernas', 'Cuádriceps', 3, [10, 12], 1, 120, 'inferior', false,
        ['Sentadilla hack', 'Zancadas con mancuernas'],
        'Pies a mitad de la plataforma.'),
      ex('Curl femoral tumbado', 'Isquios', 3, [10, 12], 1, 90, 'inferior', false,
        ['Curl femoral sentado', 'Curl nórdico asistido'],
        'Controla la bajada 2 segundos.'),
      ex('Elevación de talones de pie', 'Gemelos', 4, [10, 15], 1, 75, 'inferior', false,
        ['Gemelo en prensa', 'Gemelo en escalón con mancuerna'],
        'Pausa de 1 s abajo, estirado.'),
      ex('Crunch en polea alta', 'Abdomen', 3, [10, 15], 1, 60, 'superior', false,
        ['Crunch con disco en el pecho', 'Rueda abdominal'],
        'Flexiona la columna, no la cadera.'),
    ],
  },
  sup_b: {
    id: 'sup_b',
    nombre: 'Superior B',
    enfasis: 'Espalda y brazos',
    ejercicios: [
      ex('Dominadas', 'Espalda', 4, [6, 10], 2, 150, 'superior', true,
        ['Jalón al pecho pesado', 'Dominadas asistidas'],
        'Rango completo, barbilla sobre la barra. Lastradas si sacas más de 10. El peso es el lastre; 0 si es solo tu cuerpo.'),
      ex('Press militar con barra de pie', 'Hombro', 4, [6, 8], 2, 150, 'superior', true,
        ['Press de hombro con mancuernas sentado', 'Press de hombro en máquina'],
        'Glúteo y abdomen apretados para no arquear.'),
      ex('Remo con barra', 'Espalda', 3, [8, 12], 1, 120, 'superior', false,
        ['Remo en máquina', 'Remo en polea baja'],
        'Torso a 45°, barra al ombligo.'),
      ex('Press plano con mancuernas', 'Pecho', 3, [8, 12], 1, 120, 'superior', false,
        ['Press de pecho en máquina', 'Flexiones lastradas'],
        'Baja hasta sentir el estiramiento del pecho.'),
      ex('Face pull en polea', 'Hombro', 3, [12, 15], 1, 60, 'superior', false,
        ['Pájaros con mancuernas'],
        'Jala hacia la cara, codos altos.'),
      ex('Curl inclinado con mancuernas', 'Bíceps', 3, [10, 12], 1, 75, 'superior', false,
        ['Curl de bíceps con barra', 'Curl de bíceps en polea'],
        'Banco a 45°, brazos colgando.'),
      ex('Press francés', 'Tríceps', 3, [8, 12], 1, 90, 'superior', false,
        ['Fondos en paralelas', 'Extensión de tríceps en polea con cuerda'],
        'Si eliges fondos, torso recto para cargar tríceps.'),
    ],
  },
  inf_b: {
    id: 'inf_b',
    nombre: 'Inferior B',
    enfasis: 'Cadena posterior y glúteo',
    ejercicios: [
      ex('Peso muerto convencional', 'Isquios', 4, [4, 6], 2, 180, 'inferior', true,
        ['Hip thrust pesado', 'Peso muerto con trap bar'],
        'Barra pegada a las espinillas, espalda neutra siempre.'),
      ex('Sentadilla búlgara', 'Cuádriceps', 3, [8, 10], 1, 90, 'inferior', true,
        ['Zancadas caminando', 'Prensa a una pierna'],
        'Reps por pierna. Torso un poco inclinado al frente para cargar glúteo.', true),
      ex('Hip thrust', 'Glúteo', 3, [8, 12], 1, 120, 'inferior', false,
        ['Puente de glúteo con barra en el piso'],
        'Barbilla al pecho, pausa 1 s arriba.'),
      ex('Extensión de cuádriceps', 'Cuádriceps', 3, [12, 15], 1, 75, 'inferior', false,
        ['Sentadilla sissy', 'Sentadilla goblet con pausa'],
        'Aprieta arriba 1 s.'),
      ex('Curl femoral sentado', 'Isquios', 3, [10, 12], 1, 90, 'inferior', false,
        ['Curl femoral tumbado', 'Curl femoral con mancuerna entre los pies'],
        'Inclínate al frente para estirar más.'),
      ex('Gemelo sentado', 'Gemelos', 4, [12, 15], 1, 60, 'inferior', false,
        ['Gemelo de pie con pausa'],
        'Pausa abajo, no rebotes.'),
      ex('Rueda abdominal', 'Abdomen', 3, [8, 12], 1, 60, 'superior', false,
        ['Plancha con peso 45-60 s', 'Crunch en polea alta'],
        'Cadera neutra, no la dejes caer.'),
    ],
  },
};

// Mínimo de series directas por músculo a la semana (para el semáforo de volumen).
export const MIN_SERIES = {
  Pecho: 10, Espalda: 10, Hombro: 8, 'Bíceps': 6, 'Tríceps': 6,
  'Cuádriceps': 10, Isquios: 8, 'Glúteo': 3, Gemelos: 6, Abdomen: 4,
};

export const BLOCK_WEEKS = 5;          // semanas 1-4 cargan, semana 5 descarga
export const SESSIONS_PER_WEEK = SEQUENCE.length;
export const REENTRY_DAYS = 10;        // más de 10 días sin entrenar = sesión de regreso

function ex(nombre, musculo, series, reps, rir, descanso, tipo, clave, sustitutos, nota, unilateral = false) {
  return { id: slug(nombre), nombre, musculo, series, reps, rir, descanso, tipo, clave, sustitutos, nota, unilateral };
}

export function slug(s) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}
