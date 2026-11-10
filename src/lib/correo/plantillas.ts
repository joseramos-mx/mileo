/**
 * Los correos de Mileo, escritos en código.
 *
 * HTML a la antigua a propósito (tablas y estilos en línea): es lo único que
 * se ve igual en Gmail, Outlook y el correo del celular. Cada correo lleva
 * también su versión en texto plano, que ayuda a que no caiga en spam.
 *
 * Los colores están aquí abajo, en un solo lugar, para ajustarlos a la marca.
 */

export type CorreoListo = { asunto: string; html: string; texto: string };

const color = {
  fondo: "#f4f4f5",
  tarjeta: "#ffffff",
  titulo: "#18181b",
  texto: "#3f3f46",
  suave: "#71717a",
  boton: "#18181b",
  textoBoton: "#ffffff",
};

function esc(valor: string): string {
  return valor
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type Contenido = {
  vistaPrevia: string;
  titulo: string;
  parrafos: string[];
  boton?: { texto: string; enlace: string };
  pie: string;
};

function armarHtml(c: Contenido): string {
  const parrafos = c.parrafos
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-size:16px;line-height:24px;color:${color.texto};">${esc(p)}</p>`,
    )
    .join("");

  const boton = c.boton
    ? `<p style="margin:28px 0;"><a href="${esc(c.boton.enlace)}" style="display:inline-block;background:${color.boton};color:${color.textoBoton};text-decoration:none;font-size:16px;font-weight:600;padding:14px 28px;border-radius:10px;">${esc(c.boton.texto)}</a></p>` +
      `<p style="margin:0 0 16px;font-size:13px;line-height:20px;color:${color.suave};">Si el botón no funciona, copie este enlace en su navegador:<br><span style="word-break:break-all;">${esc(c.boton.enlace)}</span></p>`
    : "";

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(c.titulo)}</title>
</head>
<body style="margin:0;padding:0;background:${color.fondo};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(c.vistaPrevia)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${color.fondo};">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:${color.tarjeta};border-radius:16px;">
<tr><td style="padding:36px 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<p style="margin:0 0 24px;font-size:20px;font-weight:700;letter-spacing:0.5px;color:${color.titulo};">Mileo</p>
<h1 style="margin:0 0 16px;font-size:22px;line-height:30px;font-weight:600;color:${color.titulo};">${esc(c.titulo)}</h1>
${parrafos}
${boton}
<p style="margin:24px 0 0;font-size:13px;line-height:20px;color:${color.suave};">${esc(c.pie)}</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function armarTexto(c: Contenido): string {
  const partes = [c.titulo, "", ...c.parrafos];
  if (c.boton) partes.push("", `${c.boton.texto}: ${c.boton.enlace}`);
  partes.push("", c.pie);
  return partes.join("\n");
}

function listo(asunto: string, c: Contenido): CorreoListo {
  return { asunto, html: armarHtml(c), texto: armarTexto(c) };
}

/** El correo con el enlace para confirmar la cuenta nueva. */
export function plantillaVerificacion(datos: {
  nombre: string;
  enlace: string;
}): CorreoListo {
  return listo("Confirme su correo para entrar a Mileo", {
    vistaPrevia: "Un paso más y puede mandar su primer caso.",
    titulo: `Hola, ${datos.nombre}`,
    parrafos: [
      "Gracias por registrar su clínica en Mileo. Confirme su correo para empezar a mandar sus casos.",
      "El enlace es de un solo uso y vence pronto. Si ya venció, vuelva a registrarse con este mismo correo y le mandamos otro.",
    ],
    boton: { texto: "Confirmar mi correo", enlace: datos.enlace },
    pie: "Si usted no creó esta cuenta, ignore este mensaje: no se activa nada sin su confirmación.",
  });
}

/**
 * Cuando alguien intenta registrarse con un correo que ya tiene cuenta.
 * La pantalla no lo dice (para no regalar la lista de clínicas); el dueño del
 * correo sí se entera, por aquí.
 */
export function plantillaYaTieneCuenta(datos: {
  nombre?: string;
  enlaceEntrada: string;
}): CorreoListo {
  return listo("Ya tiene una cuenta en Mileo", {
    vistaPrevia: "Alguien intentó registrarse con este correo.",
    titulo: datos.nombre ? `Hola, ${datos.nombre}` : "Ya tiene una cuenta",
    parrafos: [
      "Alguien intentó crear una cuenta en Mileo con este correo, pero ya existe una.",
      "Si fue usted, solo inicie sesión.",
    ],
    boton: { texto: "Entrar a Mileo", enlace: datos.enlaceEntrada },
    pie: "Si no fue usted, ignore este mensaje: su cuenta sigue segura y no se cambió nada.",
  });
}
