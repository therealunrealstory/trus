// /assets/js/core/musicLinks.js
export const MUSIC_LINKS = {
  EN: 'https://ditto.fm/our-real-and-unreal-story',
  ES: 'https://ditto.fm/nuestra-historia-real-e-irreal',
  FR: 'https://music.youtube.com/watch?v=gMWVqQcTbPg&list=OLAK5uy_nBAIdKx4LXM5pNfv9ur8p-OXtblsneFsE',
  IT: 'https://ditto.fm/la-nostra-storia-reale-e-irreale',
  DE: 'https://ditto.fm/unsere-reale-und-irreale-geschichte',
  PT: 'https://ditto.fm/nossa-historia-real-e-irreal',
  RU: 'https://ditto.fm/nasa-realno-nerealnaia-istoriia',
  CN: 'https://ditto.fm/release-4565891',
  AR: 'https://ditto.fm/kstna-alhkyky-oallamaakol',
};

export function getMusicLink(locale) {
  const L = (locale || 'EN').toUpperCase();
  return MUSIC_LINKS[L] || MUSIC_LINKS.EN;
}
