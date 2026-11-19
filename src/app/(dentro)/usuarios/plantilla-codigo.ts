/**
 * El correo con la contraseña temporal de quien da de alta la administración.
 *
 * Va junto a `plantillaVerificacion` en `@/lib/correo/plantillas`: muévala ahí
 * y ajuste lo que devuelve (`asunto`, `html`, `texto`) a la forma que esperan
 * `enviarCorreo` y las otras plantillas.
 */

function escapar(texto: string) {
    return texto
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

export function plantillaCodigoDeAcceso({
    nombre,
    correo,
    contrasena,
    enlaceEntrada,
}: {
    nombre?: string;
    correo: string;
    contrasena: string;
    enlaceEntrada: string;
}) {
    const saludo = nombre ? `Hola, ${nombre}.` : "Hola.";
    const asunto = "Su acceso a Mileo";

    const texto = [
        saludo,
        "",
        "La administración de Mileo le dio de alta.",
        "",
        `Entre en ${enlaceEntrada} con estos datos:`,
        `Correo: ${correo}`,
        `Contraseña temporal: ${contrasena}`,
        "",
        "Al entrar le pediremos que elija su propia contraseña. La temporal deja de servir en ese momento.",
        "Si no esperaba este correo, ignórelo.",
    ].join("\n");

    const html = `
<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;color:#111">
  <p>${escapar(saludo)}</p>
  <p>La administración de Mileo le dio de alta. Entre con estos datos:</p>
  <p style="margin:0">Correo: <strong>${escapar(correo)}</strong></p>
  <p style="margin:12px 0 0">Contraseña temporal:</p>
  <p style="font-size:22px;letter-spacing:2px;font-weight:600;font-family:ui-monospace,monospace;margin:4px 0 12px">${escapar(contrasena)}</p>
  <p><a href="${escapar(enlaceEntrada)}">Entrar a Mileo</a></p>
  <p style="color:#555;font-size:14px">Al entrar le pediremos que elija su propia contraseña. La temporal deja de servir en ese momento. Si no esperaba este correo, ignórelo.</p>
</div>`;

    return { asunto, texto, html };
}