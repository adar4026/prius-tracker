// Фото автомобиля. Хранится в IndexedDB (localStorage не рассчитан на
// бинарные данные такого размера) и в резервную копию не входит.
//
// Перед сохранением снимок уменьшается до PHOTO_MAX_SIDE по большей стороне
// и пережимается в JPEG — многомегабайтный оригинал с камеры не хранится.

import { useCallback, useEffect, useRef, useState } from "react";

const DB_NAME = "lexcar";
const DB_VERSION = 1;
const STORE = "photos";
export const VEHICLE_PHOTO_KEY = "vehicle";

export const PHOTO_MAX_SIDE = 1600;
const PHOTO_QUALITY = 0.85;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const PHOTO_ACCEPT = ACCEPTED_TYPES.join(",");

const hasIndexedDb = () => typeof window !== "undefined" && !!window.indexedDB;

function openDb() {
  return new Promise((resolve, reject) => {
    if (!hasIndexedDb()) {
      reject(new Error("IndexedDB недоступна"));
      return;
    }
    const req = window.indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("Не удалось открыть хранилище"));
    req.onblocked = () => reject(new Error("Хранилище занято другой вкладкой"));
  });
}

/** Одна операция над хранилищем; соединение закрывается после транзакции. */
async function withStore(mode, run) {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = run(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req ? req.result : undefined);
      tx.onerror = () => reject(tx.error || new Error("Ошибка хранилища"));
      tx.onabort = () => reject(tx.error || new Error("Операция отменена"));
    });
  } finally {
    db.close();
  }
}

export const readPhoto = (key = VEHICLE_PHOTO_KEY) =>
  withStore("readonly", (store) => store.get(key)).then((v) => (v instanceof Blob ? v : null));

export const writePhoto = (blob, key = VEHICLE_PHOTO_KEY) =>
  withStore("readwrite", (store) => store.put(blob, key));

export const removePhoto = (key = VEHICLE_PHOTO_KEY) =>
  withStore("readwrite", (store) => store.delete(key));

/* ---------------- подготовка снимка ---------------- */

/** Понятная ошибка вместо тихого отказа при неподходящем файле. */
export function checkPhotoFile(file) {
  if (!file) return "Файл не выбран";
  // type бывает пустым, если система не распознала файл — тогда смотрим расширение
  const type = (file.type || "").toLowerCase();
  const ext = (file.name || "").toLowerCase().match(/\.(jpe?g|png|webp)$/);
  if (type ? !ACCEPTED_TYPES.includes(type) : !ext) {
    return "Подходят только фотографии JPEG, PNG или WebP";
  }
  return "";
}

const loadImage = (file) =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Не удалось прочитать изображение")); };
    img.src = url;
  });

/**
 * Уменьшает изображение до PHOTO_MAX_SIDE по большей стороне с сохранением
 * пропорций и возвращает JPEG-blob. Ориентация из EXIF применяется
 * браузером при декодировании, поэтому отдельно не обрабатывается.
 */
export async function compressPhoto(file) {
  const img = await loadImage(file);
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  if (!w || !h) throw new Error("Не удалось прочитать изображение");

  const scale = Math.min(1, PHOTO_MAX_SIDE / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext("2d");
  // прозрачность PNG ложится на белый фон, а не на чёрный
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Не удалось сжать изображение"))),
      "image/jpeg",
      PHOTO_QUALITY
    );
  });
}

/* ---------------- хук ---------------- */

/**
 * Фото автомобиля для всего приложения: { url, loading, save, remove }.
 * url — object URL текущего снимка или null; save(blob) и remove()
 * записывают в IndexedDB и сразу обновляют url.
 */
export function useVehiclePhoto() {
  const [url, setUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const urlRef = useRef(null);

  const swap = useCallback((blob) => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = blob ? URL.createObjectURL(blob) : null;
    setUrl(urlRef.current);
  }, []);

  useEffect(() => {
    let alive = true;
    readPhoto()
      .then((blob) => { if (alive) swap(blob); })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => {
      alive = false;
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, [swap]);

  const save = useCallback(async (blob) => {
    await writePhoto(blob);
    swap(blob);
  }, [swap]);

  const remove = useCallback(async () => {
    await removePhoto();
    swap(null);
  }, [swap]);

  return { url, loading, save, remove };
}
