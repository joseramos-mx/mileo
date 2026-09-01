import type { Metadata } from "next";
import { Marca } from "@/componentes/Marca";
import { Boton, BotonEnlace } from "@/componentes/Boton";
import { salir } from "@/app/acciones-sesion";

export const metadata: Metadata = { title: "Salir · Mileo" };

export default function PaginaDeSalida() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6">
      <Marca />
      <h1 className="text-titulo font-semibold text-primario">
        ¿Quiere salir de Mileo?
      </h1>
      <p className="text-cuerpo text-secundario">
        Sus casos y sus borradores se quedan guardados. Puede volver a entrar
        cuando quiera.
      </p>
      <div className="flex flex-col gap-3">
        <form action={salir}>
          <Boton type="submit" tono="principal" ancho="completo">
            Salir
          </Boton>
        </form>
        <BotonEnlace href="/" tono="texto" ancho="completo">
          Mejor seguir aquí
        </BotonEnlace>
      </div>
    </main>
  );
}
