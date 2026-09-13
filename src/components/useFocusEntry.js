import { useEffect, useLayoutEffect, useRef, useState } from "react";

const FLASH_MS = 1800;

/**
 * Переход к конкретной записи из глобального поиска.
 *
 * focus — { id } или null. При появлении запроса вызывается prepare()
 * (сброс локальных фильтров вкладки, чтобы запись точно была в списке),
 * затем карточка с DOM-id `${prefix}-${id}` прокручивается в центр экрана
 * и ненадолго подсвечивается. Возвращает id подсвеченной записи.
 */
export default function useFocusEntry(focus, prefix, prepare, onDone) {
  const [flashId, setFlashId] = useState(null);
  const timer = useRef(null);

  // фильтры сбрасываются до отрисовки списка, чтобы не было лишнего кадра
  useLayoutEffect(() => {
    if (focus) prepare();
    // prepare — сеттеры состояния вкладки, focus — единственный триггер
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus]);

  useEffect(() => {
    if (!focus) return undefined;
    const frame = requestAnimationFrame(() => {
      const node = document.getElementById(`${prefix}-${focus.id}`);
      if (node) node.scrollIntoView({ block: "center", behavior: "smooth" });
      setFlashId(focus.id);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setFlashId(null), FLASH_MS);
      // запрос выполнен — родитель сбрасывает focus, подсветка живёт своим таймером
      onDone();
    });
    return () => cancelAnimationFrame(frame);
    // onDone — стабильный колбэк родителя
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, prefix]);

  useEffect(() => () => clearTimeout(timer.current), []);

  return flashId;
}
