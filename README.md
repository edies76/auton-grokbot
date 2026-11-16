# Auton — escritorio local

Primera versión de una app de escritorio inspirada en el flujo de Grok Bot. Está hecha con Tauri 2 (Rust) y React/TypeScript. El proyecto prioriza la interfaz y los flujos locales: chats, bots, actividad, aprobaciones, rutinas y una vista previa de Computer.

## Requisitos

- Node.js 20 o posterior
- Rust estable y las dependencias de sistema de Tauri 2 para tu plataforma

## Ejecutar en desarrollo

```sh
npm install
npm run tauri dev
```

Para abrir la interfaz en navegador durante el desarrollo: `npm run dev`.

## Estado de esta versión

- Los bots, mensajes, aprobaciones y rutinas se guardan en un archivo local `workspace.json` dentro del directorio de datos de Auton. La vista web usa `localStorage` como respaldo.
- Las respuestas del chat son locales de demostración. No se conecta a Grok ni a otro proveedor de modelos.
- La aprobación de acciones cambia el estado visual local; no ejecuta acciones externas.
- Computer muestra una maqueta de escritorio. La captura y el control remoto requieren integrar un agente local.
- La pantalla y los controles están preparados para iterar sobre la referencia proporcionada; no incluye el servicio en la nube ni las capacidades remotas de la aplicación original.
