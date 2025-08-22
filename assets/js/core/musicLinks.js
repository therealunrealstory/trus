// /assets/js/core/musicLinks.js
export const MUSIC_LINKS = {
  EN: 'https://ditto.com/trus-en',
  ES: 'https://ditto.fm/nuestra-historia-real-e-irreal',
  FR: 'https://ditto.com/trus-fr',
  IT: 'https://ditto.com/trus-it',
  DE: 'https://ditto.com/trus-de',
  PT: 'https://ditto.com/trus-pt',
  RU: 'https://ditto.com/trus-ru',
  CN: 'https://ditto.com/trus-cn',
  AR: 'https://ditto.com/trus-ar',
};

export function getMusicLink(locale) {
  const L = (locale || 'EN').toUpperCase();
  return MUSIC_LINKS[L] || MUSIC_LINKS.EN;
}
