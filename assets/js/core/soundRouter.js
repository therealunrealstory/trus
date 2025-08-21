// assets/js/core/soundRouter.js
// Единая точка правды для всех аудиоссылок.
// Забирает partials/sounds.json и возвращает полные URL по ключу + языку.

let _data = null;
let _loading = null;

function normLang(l) {
  return (l || 'en').toString().trim().toLowerCase();
}

function joinUrl(base, path) {
  if (!base) return path || '';
  if (!path) return base;
  return base.replace(/\/+$/, '') + '/' + path.replace(/^\/+/, '');
}

export async function initSounds() {
  if (_data) return _data;
  if (!_loading) {
    _loading = fetch('/partials/sounds.json', { cache: 'no-cache' })
      .then(r => r.json())
      .then(json => {
        _data = json || {};
        // событие готовности — на случай, если кто-то хочет ждать явно
        window.dispatchEvent(new CustomEvent('trus:sounds:ready', { detail: { ok: true } }));
        return _data;
      })
      .catch(err => {
        console.warn('[soundRouter] Failed to load /partials/sounds.json', err);
        window.dispatchEvent(new CustomEvent('trus:sounds:ready', { detail: { ok: false, err } }));
      });
  }
  return _loading;
}

export function onSoundsReady(cb) {
  if (_data) { try { cb(_data); } catch {} return; }
  const once = (e) => {
    window.removeEventListener('trus:sounds:ready', once);
    try { cb(_data); } catch {}
  };
  window.addEventListener('trus:sounds:ready', once);
}

/**
 * Возвращает ПОЛНЫЙ URL аудио по ключу трека и языку.
 * @param {string} key - "bg" | "announcement" | "short" | "full"
 * @param {string} locale - например "EN", "ru", "de"…
 * @returns {string|null}
 */
export function getSoundUrl(key, locale) {
  if (!_data) {
    // запустим загрузку, если её ещё не было
    if (!_loading) initSounds();
    return null;
  }

  const tracks = _data.tracks || {};
  const item = tracks[key];
  if (!item) return null;

  const lang = normLang(locale);
  const candidate = item[lang] || item[lang.toUpperCase?.()] || item.en || item.EN;
  if (!candidate) return null;

  // абсолютные ссылки пропускаем как есть
  if (/^https?:\/\//i.test(candidate)) return candidate;

  const providers = _data.providers || {};
  const providerId = _data.provider || '';
  const base = providers[providerId] || providerId || '';

  return joinUrl(base, candidate);
}

// автоинициализация — почти моментально на старте приложения
initSounds();
