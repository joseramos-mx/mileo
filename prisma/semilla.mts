/**
 * Semilla de Mileo.
 *
 * Idempotente: se puede correr las veces que haga falta. En produccion crea
 * unicamente al equipo del laboratorio; el caso de demostracion solo aparece en
 * desarrollo. Si las llaves de Supabase Auth estan configuradas, tambien da de
 * alta o sincroniza las cuentas en `auth.users` y enlaza `supabaseId`.
 */
import { createClient } from "@supabase/supabase-js";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { registrarEvento } from "../src/lib/bitacora.js";
import { cargarAmbiente } from "../scripts/ambiente.mjs";

const ambiente = cargarAmbiente();

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const CONTRASENA_DEMO = "mileo1234";
const VERSION_AVISO_PRIVACIDAD = "2026-01";

function crearAdminSupabaseOpcional() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const claveServicio = (
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
  )?.trim();

  if (!url || !claveServicio) return null;

  return createClient(url, claveServicio, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function main() {
  const supabaseAdmin = crearAdminSupabaseOpcional();
  const mapaAuthPorCorreo = new Map<string, string>();

  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      perPage: 1000,
    });
    if (error) {
      throw new Error(`No pude consultar Supabase Auth: ${error.message}`);
    }
    for (const u of data.users) {
      if (u.email) mapaAuthPorCorreo.set(u.email.toLowerCase(), u.id);
    }
  } else {
    console.warn(
      "Aviso: faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en su .env. " +
        "Se sembraran los perfiles en PostgreSQL, pero corra de nuevo `npm run bd:semilla` " +
        "cuando agregue las llaves para crear las cuentas en Supabase Auth.",
    );
  }

  async function asegurarEnSupabaseAuth(
    correo: string,
    nombreCompleto: string,
  ): Promise<string | undefined> {
    if (!supabaseAdmin) return undefined;
    const existente = mapaAuthPorCorreo.get(correo.toLowerCase());
    if (existente) return existente;

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: correo,
      password: CONTRASENA_DEMO,
      email_confirm: true,
      user_metadata: { nombreCompleto },
    });
    if (error || !data.user) {
      throw new Error(
        `No pude crear ${correo} en Supabase Auth: ${error?.message ?? "sin respuesta"}`,
      );
    }
    mapaAuthPorCorreo.set(correo.toLowerCase(), data.user.id);
    return data.user.id;
  }

  // --- Administración y laboratorio -----------------------------------------
  const equipo = [
    {
      correo: "direccion@rmszahn.mx",
      nombreCompleto: "Rosa Maria Salas",
      rol: "ADMIN" as const,
    },
    {
      correo: "admision@rmszahn.mx",
      nombreCompleto: "Luis Trevino",
      rol: "LABORATORIO" as const,
    },
    {
      correo: "diseno@rmszahn.mx",
      nombreCompleto: "Karla Nunez",
      rol: "LABORATORIO" as const,
    },
    {
      correo: "calidad@rmszahn.mx",
      nombreCompleto: "Hector Rios",
      rol: "LABORATORIO" as const,
    },
  ];

  const equipoCreado = [];
  for (const persona of equipo) {
    const supabaseId = await asegurarEnSupabaseAuth(
      persona.correo,
      persona.nombreCompleto,
    );
    const usuario = await prisma.usuario.upsert({
      where: { correo: persona.correo },
      update: {
        rol: persona.rol,
        ...(supabaseId ? { supabaseId } : {}),
      },
      create: {
        ...persona,
        ...(supabaseId ? { supabaseId } : {}),
        avisoPrivacidadVersion: VERSION_AVISO_PRIVACIDAD,
        avisoPrivacidadAceptadoEn: new Date(),
      },
    });
    equipoCreado.push(usuario);
  }
  const adminPrincipal = equipoCreado[0];
  console.log(`Equipo del laboratorio listo (${equipoCreado.length} personas).`);

  if (ambiente === "produccion") {
    console.log("Ambiente de produccion: no se siembra caso de demostracion.");
    return;
  }

  // --- Una clinica con sus cuentas de rol CLINICA ---------------------------
  const clinica = await prisma.clinica.upsert({
    where: { id: "clinica-prodental" },
    update: {},
    create: {
      id: "clinica-prodental",
      nombre: "Clinica Prodental",
      ciudad: "Durango",
    },
  });

  // El escaner en comodato de la clinica, para la tarjeta del inicio.
  const escanerDeDemostracion = {
    marca: "3Shape",
    modelo: "TRIOS 5",
    fotoUrl: "/escaners/trios 5.png",
  };
  await prisma.escaner.upsert({
    where: { clinicaId: clinica.id },
    update: escanerDeDemostracion,
    create: {
      clinicaId: clinica.id,
      ...escanerDeDemostracion,
      estado: "LISTO",
      licenciaVenceEn: new Date(Date.now() + 122 * 24 * 60 * 60 * 1000),
    },
  });

  const supabaseIdDoctor = await asegurarEnSupabaseAuth(
    "juan.valverde@prodental.mx",
    "Juan Valverde",
  );
  const doctor = await prisma.usuario.upsert({
    where: { correo: "juan.valverde@prodental.mx" },
    update: {
      rol: "CLINICA",
      ...(supabaseIdDoctor ? { supabaseId: supabaseIdDoctor } : {}),
    },
    create: {
      correo: "juan.valverde@prodental.mx",
      nombreCompleto: "Juan Valverde",
      telefono: "+526181234567",
      rol: "CLINICA",
      ...(supabaseIdDoctor ? { supabaseId: supabaseIdDoctor } : {}),
      clinicaId: clinica.id,
      invitadoPorId: adminPrincipal.id,
      avisoPrivacidadVersion: VERSION_AVISO_PRIVACIDAD,
      avisoPrivacidadAceptadoEn: new Date(),
    },
  });

  const supabaseIdRecepcion = await asegurarEnSupabaseAuth(
    "recepcion@prodental.mx",
    "Ana Beltran",
  );
  await prisma.usuario.upsert({
    where: { correo: "recepcion@prodental.mx" },
    update: {
      rol: "CLINICA",
      ...(supabaseIdRecepcion ? { supabaseId: supabaseIdRecepcion } : {}),
    },
    create: {
      correo: "recepcion@prodental.mx",
      nombreCompleto: "Ana Beltran",
      rol: "CLINICA",
      ...(supabaseIdRecepcion ? { supabaseId: supabaseIdRecepcion } : {}),
      clinicaId: clinica.id,
      invitadoPorId: doctor.id,
      avisoPrivacidadVersion: VERSION_AVISO_PRIVACIDAD,
      avisoPrivacidadAceptadoEn: new Date(),
    },
  });

  // --- Un caso de 3 unidades con materiales distintos (criterio de O-0) ----
  const folio = "C-2026-0001";
  const yaExiste = await prisma.caso.findUnique({ where: { folio } });
  if (yaExiste) {
    console.log(`El caso ${folio} ya existia. Semilla lista.`);
    return;
  }

  const paciente = await prisma.paciente.upsert({
    where: { clinicaId_folio: { clinicaId: clinica.id, folio: "932" } },
    update: {},
    create: {
      clinicaId: clinica.id,
      folio: "932",
      iniciales: "M.L.R.",
    },
  });

  await prisma.$transaction(async (bd) => {
    const caso = await bd.caso.create({
      data: {
        folio,
        clinicaId: clinica.id,
        doctorId: doctor.id,
        creadoPorId: doctor.id,
        pacienteId: paciente.id,
        indicacion: "CORONA_Y_PUENTE",
        etapa: "RECIBIDO",
        esBorrador: false,
        enviadoEn: new Date(),
        unidades: {
          create: [
            {
              diente: 11,
              rol: "CORONA_ANATOMICA",
              material: "ZIRCONIO_MONOLITICO",
              color: "A1",
            },
            {
              diente: 12,
              rol: "CARILLA",
              material: "DISILICATO_DE_LITIO",
              color: "A1",
            },
            {
              diente: 13,
              rol: "CORONA_CASCARON",
              material: "PMMA",
              color: "A2",
            },
          ],
        },
      },
      include: { unidades: true },
    });

    await registrarEvento(bd, {
      tipo: "CASO_CREADO",
      resumen: `El doctor ${doctor.nombreCompleto} creo el caso ${caso.folio} con ${caso.unidades.length} unidades.`,
      casoId: caso.id,
      usuarioId: doctor.id,
      etapaNueva: "RECIBIDO",
    });

    for (const unidad of caso.unidades) {
      await registrarEvento(bd, {
        tipo: "UNIDAD_AGREGADA",
        resumen: `Se agrego el diente ${unidad.diente}: ${unidad.rol} en ${unidad.material}.`,
        casoId: caso.id,
        usuarioId: doctor.id,
        datos: {
          diente: unidad.diente,
          rol: unidad.rol,
          material: unidad.material,
          color: unidad.color,
        },
      });
    }

    await registrarEvento(bd, {
      tipo: "CASO_ENVIADO",
      resumen: `La clinica envio el caso ${caso.folio} al laboratorio.`,
      casoId: caso.id,
      usuarioId: doctor.id,
    });

    console.log(`Caso ${caso.folio} creado con ${caso.unidades.length} unidades.`);
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
