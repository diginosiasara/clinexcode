/** Acceso seguro a localStorage (puede estar bloqueado). */
export const store = {
  get(key) { try { return localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch { /* ignorar */ } },
  remove(key) { try { localStorage.removeItem(key); } catch { /* ignorar */ } },
};
