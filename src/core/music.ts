const musicVolume = 0.35;

export function setupMusicToggle(): void {
  const button = document.querySelector<HTMLButtonElement>('#music-toggle');

  if (button === null) {
    return;
  }

  if (import.meta.env.DEV) {
    button.classList.add('music-toggle--dev');
  }

  const audio = new Audio(`${import.meta.env.BASE_URL}audio/halloween-music.mp3`);
  audio.loop = true;
  audio.preload = 'auto';
  audio.volume = musicVolume;

  const setPlaying = (playing: boolean) => {
    button.setAttribute('aria-pressed', String(playing));
    button.setAttribute('aria-label', playing ? 'Pause music' : 'Play music');
    button.title = playing ? 'Pause music' : 'Play music';
  };

  button.addEventListener('click', () => {
    if (audio.paused) {
      void audio.play().then(
        () => setPlaying(true),
        () => setPlaying(false),
      );
      return;
    }

    audio.pause();
    setPlaying(false);
  });

  audio.addEventListener('play', () => setPlaying(true));
  audio.addEventListener('pause', () => setPlaying(false));
  audio.addEventListener('error', () => setPlaying(false));

  setPlaying(false);
}
