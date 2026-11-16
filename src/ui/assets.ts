/**
 * Imágenes que pone el jugador: logos de equipo, fotos y cascos de pilotos.
 * El juego no trae ninguna (son marcas y material de terceros). Hay dos vías:
 *   1. subirlas desde Ajustes → se guardan en IndexedDB (este módulo),
 *   2. copiarlas a public/assets/logos|drivers|helmets con el id como nombre.
 * Si no hay imagen, cada componente dibuja una versión generada.
 */
import Dexie, { type Table } from 'dexie';
import { useEffect, useState } from 'react';
import { create } from 'zustand';

export type AssetKind = 'logo' | 'driver' | 'helmet';

interface AssetRow {
  key: string;
  blob: Blob;
}

class AssetDb extends Dexie {
  assets!: Table<AssetRow, string>;
  constructor() {
    super('paddock-assets');
    this.version(1).stores({ assets: 'key' });
  }
}

const db = new AssetDb();
const keyOf = (kind: AssetKind, id: string) => `${kind}:${id}`;

export const MAX_ASSET_BYTES = 3 * 1024 * 1024;

interface AssetState {
  /** key → URL de objeto lista para usar en <img>. */
  urls: Record<string, string>;
  load: () => Promise<void>;
  put: (kind: AssetKind, id: string, file: Blob) => Promise<void>;
  remove: (kind: AssetKind, id: string) => Promise<void>;
}

export const useAssets = create<AssetState>((set, get) => ({
  urls: {},
  load: async () => {
    try {
      const rows = await db.assets.toArray();
      set({ urls: Object.fromEntries(rows.map((r) => [r.key, URL.createObjectURL(r.blob)])) });
    } catch {
      // IndexedDB no disponible (modo privado): se sigue con las imágenes generadas.
    }
  },
  put: async (kind, id, file) => {
    const key = keyOf(kind, id);
    await db.assets.put({ key, blob: file });
    const old = get().urls[key];
    if (old) URL.revokeObjectURL(old);
    set({ urls: { ...get().urls, [key]: URL.createObjectURL(file) } });
  },
  remove: async (kind, id) => {
    const key = keyOf(kind, id);
    await db.assets.delete(key);
    const { [key]: old, ...rest } = get().urls;
    if (old) URL.revokeObjectURL(old);
    set({ urls: rest });
  },
}));

export function isAcceptableImage(file: File): boolean {
  return file.type.startsWith('image/') && file.size <= MAX_ASSET_BYTES;
}

// ------------------------------------------------------------ Carpeta public/

const FOLDER: Record<AssetKind, { dir: string; ext: string[] }> = {
  logo: { dir: 'logos', ext: ['svg', 'png'] },
  driver: { dir: 'drivers', ext: ['png', 'jpg'] },
  helmet: { dir: 'helmets', ext: ['png', 'jpg'] },
};

/** Resultado de buscar el archivo en public/: se comprueba una sola vez por sesión. */
const probes = new Map<string, Promise<string | null>>();

function probe(kind: AssetKind, id: string): Promise<string | null> {
  const key = keyOf(kind, id);
  let pending = probes.get(key);
  if (!pending) {
    const { dir, ext } = FOLDER[kind];
    pending = (async () => {
      for (const e of ext) {
        const url = `${import.meta.env.BASE_URL}assets/${dir}/${id}.${e}`;
        const ok = await new Promise<boolean>((resolve) => {
          const img = new Image();
          img.onload = () => resolve(true);
          img.onerror = () => resolve(false);
          img.src = url;
        });
        if (ok) return url;
      }
      return null;
    })();
    probes.set(key, pending);
  }
  return pending;
}

/** URL de la imagen del jugador para ese elemento, o undefined si hay que dibujar la generada. */
export function useAsset(kind: AssetKind, id: string): string | undefined {
  const uploaded = useAssets((s) => s.urls[keyOf(kind, id)]);
  const [fromFolder, setFromFolder] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setFromFolder(null);
    void probe(kind, id).then((url) => {
      if (alive) setFromFolder(url);
    });
    return () => {
      alive = false;
    };
  }, [kind, id]);
  return uploaded ?? fromFolder ?? undefined;
}

export const hasUploadedAsset = (urls: Record<string, string>, kind: AssetKind, id: string) => keyOf(kind, id) in urls;
