(() => {
  'use strict';

  const music = document.querySelector('.music');
  const player = document.querySelector('#song-audio');
  if (!music || !player) return;

  const playButton = music.querySelector('.play-toggle');
  const muteButton = music.querySelector('.mute-toggle');
  const seek = music.querySelector('.seek');
  const elapsed = music.querySelector('.elapsed');
  const durationLabel = music.querySelector('.duration');
  const status = music.querySelector('.player-status');
  let seeking = false;

  const formatTime = seconds => {
    if (!Number.isFinite(seconds)) return '0:00';
    const whole = Math.max(0, Math.floor(seconds));
    return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
  };

  const updateProgress = () => {
    if (Number.isFinite(player.duration) && player.duration > 0) {
      durationLabel.textContent = formatTime(player.duration);
      seek.max = String(player.duration);
      if (!seeking) {
        seek.value = String(player.currentTime);
        seek.style.setProperty('--position', `${Math.min(100, player.currentTime / player.duration * 100)}%`);
      }
      seek.setAttribute('aria-valuetext', `${formatTime(player.currentTime)} of ${formatTime(player.duration)}`);
    }
    elapsed.textContent = formatTime(player.currentTime);
  };

  player.addEventListener('loadedmetadata', () => {
    player.volume = 0.7;
    playButton.disabled = false;
    muteButton.disabled = false;
    seek.disabled = false;
    updateProgress();
  });

  player.addEventListener('timeupdate', updateProgress);
  player.addEventListener('durationchange', updateProgress);

  player.addEventListener('play', () => {
    music.dataset.playing = 'true';
    playButton.setAttribute('aria-label', 'Pause Idolize');
    status.textContent = 'now playing ♡';
  });

  player.addEventListener('pause', () => {
    music.dataset.playing = 'false';
    playButton.setAttribute('aria-label', 'Play Idolize');
    if (!player.ended) status.textContent = 'paused';
  });

  player.addEventListener('ended', () => {
    music.dataset.playing = 'false';
    playButton.setAttribute('aria-label', 'Play Idolize again');
    status.textContent = 'play it again? ♡';
  });

  player.addEventListener('error', () => {
    playButton.disabled = true;
    muteButton.disabled = true;
    seek.disabled = true;
    status.textContent = 'the song could not load — use the youtube link above instead ♡';
  });

  playButton.addEventListener('click', async () => {
    if (player.paused) {
      try {
        await player.play();
      } catch {
        status.textContent = 'press play once more, or use the youtube link above ♡';
      }
    } else {
      player.pause();
    }
  });

  muteButton.addEventListener('click', () => {
    player.muted = !player.muted;
    music.dataset.muted = String(player.muted);
    muteButton.setAttribute('aria-label', player.muted ? 'Unmute' : 'Mute');
  });

  seek.addEventListener('input', () => {
    seeking = true;
    elapsed.textContent = formatTime(Number(seek.value));
    seek.style.setProperty('--position', `${Number(seek.value) / Number(seek.max) * 100}%`);
  });

  seek.addEventListener('change', () => {
    player.currentTime = Number(seek.value);
    seeking = false;
    updateProgress();
  });

  if (player.readyState >= HTMLMediaElement.HAVE_METADATA) {
    player.dispatchEvent(new Event('loadedmetadata'));
  } else {
    player.load();
  }
})();
