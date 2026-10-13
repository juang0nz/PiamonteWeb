"use client";

// Alerta sonora breve para pedidos nuevos.
// Se genera con la Web Audio API para no depender de archivos ni de servicios externos.

const REPETICIONES = 2;
const DURACION_TONO_S = 0.22;
const SEPARACION_TONOS_S = 0.32;
const FRECUENCIAS_HZ = [784, 1046] as const;
const VOLUMEN_MAXIMO = 0.4;
// La envolvente nunca llega a cero porque exponentialRampToValueAtTime no lo admite.
const VOLUMEN_SILENCIO = 0.0001;

let contexto: AudioContext | null = null;

function obtenerContexto(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (contexto?.state === "closed") contexto = null;
  if (contexto) return contexto;
  const ConstructorAudio =
    window.AudioContext ??
    (
      window as typeof window & {
        webkitAudioContext?: typeof AudioContext;
      }
    ).webkitAudioContext;
  if (!ConstructorAudio) return null;
  contexto = new ConstructorAudio();
  return contexto;
}

// Los navegadores sólo permiten reproducir audio después de una interacción del usuario,
// por eso el panel ofrece un botón explícito que llama a esta función.
export async function habilitarSonido(): Promise<boolean> {
  const audio = obtenerContexto();
  if (!audio) return false;
  try {
    await audio.resume();
  } catch {
    return false;
  }
  return audio.state === "running";
}

// Reproduce una prueba al habilitar el sonido para confirmar que el navegador lo permitió.
export async function probarSonido(): Promise<boolean> {
  const habilitado = await habilitarSonido();
  return habilitado ? reproducirAlerta() : false;
}

// Emite dos tonos cortos y reactiva el contexto si el navegador lo suspendió.
export async function reproducirAlerta(): Promise<boolean> {
  const audio = contexto;
  if (!audio) return false;
  if (audio.state !== "running") {
    try {
      await audio.resume();
    } catch {
      return false;
    }
  }
  if (audio.state !== "running") return false;

  for (let repeticion = 0; repeticion < REPETICIONES; repeticion += 1) {
    const inicio = audio.currentTime + repeticion * SEPARACION_TONOS_S;
    const fin = inicio + DURACION_TONO_S;
    const oscilador = audio.createOscillator();
    const volumen = audio.createGain();

    oscilador.type = "triangle";
    oscilador.frequency.setValueAtTime(
      FRECUENCIAS_HZ[repeticion % FRECUENCIAS_HZ.length],
      inicio,
    );

    // Envolvente corta: evita el chasquido al empezar y apaga el tono por sí sola.
    volumen.gain.setValueAtTime(VOLUMEN_SILENCIO, inicio);
    volumen.gain.exponentialRampToValueAtTime(VOLUMEN_MAXIMO, inicio + 0.02);
    volumen.gain.exponentialRampToValueAtTime(VOLUMEN_SILENCIO, fin);

    oscilador.connect(volumen);
    volumen.connect(audio.destination);

    oscilador.start(inicio);
    // El tono se detiene solo al terminar la envolvente: nunca queda sonando.
    oscilador.stop(fin + 0.02);
    oscilador.onended = () => {
      oscilador.disconnect();
      volumen.disconnect();
    };
  }

  return true;
}
