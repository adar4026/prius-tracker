import React, { useCallback, useEffect, useRef, useState } from "react";

/**
 * Короткое всплывающее подтверждение («Скопировано», «Сохранено»).
 * const [toast, showToast] = useToast(); … {toast}
 */
export function useToast(duration = 1800) {
  const [message, setMessage] = useState("");
  const timer = useRef(null);

  const show = useCallback((text) => {
    clearTimeout(timer.current);
    setMessage(text);
    timer.current = setTimeout(() => setMessage(""), duration);
  }, [duration]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const node = (
    <div className={`toast ${message ? "toast--visible" : ""}`} role="status" aria-live="polite">
      {message}
    </div>
  );
  return [node, show];
}
