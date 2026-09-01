import { TarjetaDeCasoCargando } from "@/componentes/TarjetaDeCaso";
import { REJILLA_DE_CASOS } from "@/componentes/RejillaDeCasos";

/**
 * Lo que se ve mientras cargan los casos.
 *
 * Son las mismas tarjetas, del mismo tamaño exacto, en gris. Cuando llegan los
 * datos nada se mueve de lugar: el doctor no pierde el renglón que estaba
 * mirando (SKILL.md §5.5).
 */
export default function Cargando() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
      <div className="h-9 w-48 rounded-control bg-superficie-suave motion-safe:animate-pulse" />
      <div className={REJILLA_DE_CASOS} aria-busy="true">
        <span className="sr-only">Estoy cargando sus casos.</span>
        {[0, 1, 2, 3, 4, 5].map((n) => (
          <TarjetaDeCasoCargando key={n} />
        ))}
      </div>
    </div>
  );
}
