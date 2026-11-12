"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utilidades";

/**
 * Destellos de luz suaves que se mueven despacio, pintados con WebGL.
 *
 * Es decoración pura: no lleva texto ni significado, así que va oculto para
 * los lectores de pantalla. Con "reducir movimiento" se pinta un solo cuadro
 * quieto, y si la pestaña no está a la vista deja de animarse. Si el navegador
 * no tiene WebGL, simplemente no se ve nada: el fondo oscuro de atrás basta.
 */

/** De lo más oscuro a lo más claro. Por omisión, los azules de Mileo. */
const AZULES = ["#050608", "#04142e", "#0a3f8f", "#0075f4", "#8fc2ff"];

const VERTICES = `
attribute vec2 posicion;
void main() { gl_Position = vec4(posicion, 0.0, 1.0); }
`;

const FRAGMENTOS = `
precision highp float;
uniform vec2 resolucion;
uniform float tiempo;
uniform vec3 colores[5];

float azar(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

// Un destello: una mancha de luz con caída gaussiana, sin orillas.
float destello(vec2 uv, vec2 centro, vec2 tamano) {
  vec2 d = (uv - centro) / tamano;
  return exp(-dot(d, d));
}

void main() {
  vec2 uv = gl_FragCoord.xy / resolucion;
  float t = tiempo;
  vec3 luz = vec3(0.0);

  // Seis resplandores grandes pegados al borde de arriba. Cada uno se mece
  // de lado a lado y respira a su ritmo; juntos se cargan hacia el centro,
  // donde la franja se junta con la foto.
  for (int i = 0; i < 6; i++) {
    float f = float(i);
    float base = 0.18 + f * 0.14;
    // Vaivén de lado a lado: una vuelta completa cada 15 a 25 segundos.
    float x = base + 0.13 * sin(t * (0.25 + 0.06 * f) + f * 1.9);
    float y = 1.08 + 0.08 * sin(t * (0.35 + 0.08 * f) + f * 2.7);
    vec2 tamano = vec2(0.10 + 0.04 * mod(f * 1.7, 3.0), 0.42 + 0.12 * mod(f, 2.0));
    // Respira: sube y baja de brillo cada pocos segundos.
    float pulso = 0.55 + 0.45 * sin(t * (0.7 + 0.15 * f) + f * 2.3);
    vec3 tono = f < 2.0 ? colores[2] : (f < 5.0 ? colores[3] : colores[4]);
    float peso = f == 5.0 ? 0.3 : 0.5;
    luz += tono * destello(uv, vec2(x, y), tamano) * pulso * peso;
  }

  // Se satura con suavidad: los cruces brillan sin quemarse.
  vec3 color = colores[0] + (1.0 - exp(-luz * 1.2));

  // Grano finito, sólo para quitarle lo plástico.
  float grano = azar(gl_FragCoord.xy + fract(t * 7.0) * 113.0) - 0.5;
  color += grano * 0.025;

  gl_FragColor = vec4(color, 1.0);
}
`;

function aRgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function compilar(gl: WebGLRenderingContext, tipo: number, codigo: string) {
  const sombreador = gl.createShader(tipo);
  if (!sombreador) return null;
  gl.shaderSource(sombreador, codigo);
  gl.compileShader(sombreador);
  if (!gl.getShaderParameter(sombreador, gl.COMPILE_STATUS)) {
    gl.deleteShader(sombreador);
    return null;
  }
  return sombreador;
}

export function GradienteVivo({
  colores = AZULES,
  className,
}: {
  colores?: string[];
  className?: string;
}) {
  const lienzo = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = lienzo.current;
    const gl = canvas?.getContext("webgl", { antialias: false, alpha: false });
    if (!canvas || !gl) return;

    const vs = compilar(gl, gl.VERTEX_SHADER, VERTICES);
    const fs = compilar(gl, gl.FRAGMENT_SHADER, FRAGMENTOS);
    const programa = gl.createProgram();
    if (!vs || !fs || !programa) return;
    gl.attachShader(programa, vs);
    gl.attachShader(programa, fs);
    gl.linkProgram(programa);
    if (!gl.getProgramParameter(programa, gl.LINK_STATUS)) return;
    gl.useProgram(programa);

    // Un triángulo que cubre toda la pantalla.
    const bufer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, bufer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    );
    const posicion = gl.getAttribLocation(programa, "posicion");
    gl.enableVertexAttribArray(posicion);
    gl.vertexAttribPointer(posicion, 2, gl.FLOAT, false, 0, 0);

    const uResolucion = gl.getUniformLocation(programa, "resolucion");
    const uTiempo = gl.getUniformLocation(programa, "tiempo");
    gl.uniform3fv(
      gl.getUniformLocation(programa, "colores"),
      new Float32Array(colores.slice(0, 5).flatMap(aRgb)),
    );

    // El grano se ve mejor a 1:1 y así cuesta menos.
    function medir() {
      if (!canvas || !gl) return;
      const ancho = Math.max(1, Math.round(canvas.clientWidth));
      const alto = Math.max(1, Math.round(canvas.clientHeight));
      if (canvas.width !== ancho || canvas.height !== alto) {
        canvas.width = ancho;
        canvas.height = alto;
        gl.viewport(0, 0, ancho, alto);
      }
      gl.uniform2f(uResolucion, ancho, alto);
    }

    function pintar(milisegundos: number) {
      medir();
      gl!.uniform1f(uTiempo, milisegundos / 1000);
      gl!.drawArrays(gl!.TRIANGLES, 0, 3);
    }

    const quieto = window.matchMedia("(prefers-reduced-motion: reduce)");
    let cuadro = 0;
    const inicio = performance.now();

    function bucle(ahora: number) {
      pintar(ahora - inicio + 20000);
      cuadro = requestAnimationFrame(bucle);
    }

    function arrancar() {
      cancelAnimationFrame(cuadro);
      if (quieto.matches || document.hidden) {
        pintar(20000);
      } else {
        cuadro = requestAnimationFrame(bucle);
      }
    }

    const observador = new ResizeObserver(() => {
      if (quieto.matches) pintar(20000);
    });
    observador.observe(canvas);
    document.addEventListener("visibilitychange", arrancar);
    quieto.addEventListener("change", arrancar);
    arrancar();

    return () => {
      cancelAnimationFrame(cuadro);
      observador.disconnect();
      document.removeEventListener("visibilitychange", arrancar);
      quieto.removeEventListener("change", arrancar);
      gl.deleteProgram(programa);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.deleteBuffer(bufer);
    };
  }, [colores]);

  return (
    <canvas
      ref={lienzo}
      aria-hidden="true"
      className={cn("pointer-events-none block size-full", className)}
    />
  );
}
