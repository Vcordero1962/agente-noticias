# Plan — IA opcional

Orden: primero la red de seguridad (test de claves), luego el dominio, después la interfaz.
- Dominio puro en `js/` (sin DOM, con tests en Node): cliente Gemini con redacción de la clave en errores, y validación de la salida de la IA contra las noticias traídas.
- Interfaz: campo de clave en Ajustes con aviso y «Borrar clave»; botón de organizar.
- Estado honesto H-A en las candidatas; HTML móvil limpio; CSP en `index.html`.
- Cada paso con su test; `node --test "test/**/*.test.js"` en verde antes de cerrar.
