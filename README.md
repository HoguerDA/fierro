# HOD GYM

App personal de gym y dieta. PWA sin build: HTML, CSS y módulos ES con Preact + htm
empaquetados en `js/vendor/`. Todos los datos viven en el teléfono (IndexedDB);
nada sale del dispositivo.

## Qué hace

- **Hoy**: peso diario con promedio de 7 días, foto de progreso, sesión que toca y
  checklist de comidas del día (entreno / descanso).
- **Entrenar**: rutina de 4 días Superior/Inferior (A/B) en secuencia, no en calendario.
  Sugerencia de peso por doble progresión, series con peso/reps/RIR, cronómetro de
  descanso con vibración, sustitutos cuando no hay la máquina, bloques de 5 semanas
  con descarga, sesión de regreso tras más de 10 días.
- **Dieta**: plan de 3 comidas + pre-entreno con gramos, objetivos recalculados con
  el peso real (Mifflin-St Jeor), cambios equivalentes, reglas, comida libre semanal.
- **Progreso**: gráfica de peso, 1RM estimado por ejercicio, series por músculo,
  sesiones por semana, fotos antes/ahora.
- **Ajustes**: perfil, vista, kg/lb, parámetros de la dieta, respaldo JSON.

## Correr en local

Cualquier servidor estático sirve, por ejemplo `python -m http.server 8080` en esta
carpeta y abrir `http://localhost:8080/`.

## Desplegar

`python deploy.py` sube la versión de `js/version.js` y `sw.js`, hace commit y push a
`main`; GitHub Pages publica desde la raíz.
