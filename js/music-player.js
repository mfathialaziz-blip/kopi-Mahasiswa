/**
 * ===================================================
 * KOPI MAHASISWA — ULTRA-MINIMALIST CAPSULE MUSIC PLAYER
 * Layout: [ 🎧 ] [ ⏮ ] [ ▶ / ⏸ ] [ ⏭ ]
 * Features:
 * - 5 YouTube Playlist Array:
 *   1. Lamp - Hakanaki Haru No Ichimaku (nvyYe1P4GD4)
 *   2. Zelda's Lullaby (YHO6EDIbGlk)
 *   3. Kingdom Hearts II - Twilight Town (CSdNxXGUaRU)
 *   4. Saiki K - Sweat, Tears, Friendship (S5p6enoqBEM)
 *   5. Saiki K - Itsuka Kitto (B8IggymJ1TE)
 * - Autoplay strictly OFF on initial web load (starts only on manual user play)
 * - Auto-next continuous sequential playback after first play
 * - Manual Previous (<<) & Next (>>) controls
 * ===================================================
 */

(function () {
  "use strict";

  // Array 5 Lagu YouTube Sesuai Permintaan Pengguna
  const PLAYLIST = [
    {
      id: "nvyYe1P4GD4",
      title: "Lamp - Hakanaki Haru No Ichimaku",
      artist: "Lamp (儚き春の一幕)"
    },
    {
      id: "YHO6EDIbGlk",
      title: "Zelda's Lullaby",
      artist: "The Legend of Zelda"
    },
    {
      id: "CSdNxXGUaRU",
      title: "Kingdom Hearts II - Twilight Town",
      artist: "Kingdom Hearts OST"
    },
    {
      id: "S5p6enoqBEM",
      title: "Saiki K - Sweat, Tears, Friendship",
      artist: "The Disastrous Life of Saiki K."
    },
    {
      id: "B8IggymJ1TE",
      title: "Saiki K - Itsuka Kitto",
      artist: "The Disastrous Life of Saiki K."
    }
  ];

  // State Management
  const state = {
    currentIndex: 0,
    isPlaying: false,
    hasActivated: false, // Wajib false saat pertama buka (Autoplay OFF)
    isReady: false
  };

  let ytPlayer = null;
  let fallbackAudio = null;

  // DOM Elements cache
  let dom = {};

  /**
   * Pastikan wadah bridge iframe tersembunyi tersedia di DOM
   */
  function ensureBridgeElement() {
    let bridge = document.getElementById("kopiYoutubePlayerBridge");
    if (!bridge) {
      bridge = document.createElement("div");
      bridge.id = "kopiYoutubePlayerBridge";
      bridge.setAttribute("aria-hidden", "true");
      bridge.innerHTML = '<div id="kopiYtIframePlaceholder"></div>';
      document.body.appendChild(bridge);
    }
  }

  /**
   * Cache DOM Elements dari Kapsul Header
   */
  function cacheElements() {
    dom = {
      capsule: document.getElementById("headerMusicCapsule"),
      icon: document.getElementById("capsuleIcon"),
      prevBtn: document.getElementById("capsulePrevBtn"),
      playBtn: document.getElementById("capsulePlayBtn"),
      nextBtn: document.getElementById("capsuleNextBtn")
    };

    fallbackAudio = document.getElementById("lofiAudio");
  }

  /**
   * Inisialisasi YouTube Player via IFrame API
   */
  function initYouTubePlayer() {
    if (typeof YT !== "undefined" && YT.Player) {
      try {
        const initialTrack = PLAYLIST[state.currentIndex];
        ytPlayer = new YT.Player("kopiYtIframePlaceholder", {
          height: "100",
          width: "100",
          videoId: initialTrack.id,
          playerVars: {
            autoplay: 0, // AUTOPLAY STRICTLY OFF PADA SAAT PERTAMA DIBUKA
            controls: 0,
            disablekb: 1,
            enablejsapi: 1,
            fs: 0,
            playsinline: 1,
            rel: 0,
            modestbranding: 1
          },
          events: {
            onReady: onPlayerReady,
            onStateChange: onPlayerStateChange,
            onError: onPlayerError
          }
        });
      } catch (err) {
        console.warn("[Music Capsule] YouTube init error:", err);
      }
    }
  }

  function onPlayerReady(event) {
    state.isReady = true;
    event.target.setVolume(75);
    updateTooltip(state.currentIndex);

    // Jika pengguna sudah mengeklik Play sebelum player siap
    if (state.hasActivated && state.isPlaying) {
      playTrack(state.currentIndex);
    }
  }

  function onPlayerStateChange(event) {
    if (typeof YT === "undefined") return;

    if (event.data === YT.PlayerState.PLAYING) {
      setPlayState(true);
    } else if (event.data === YT.PlayerState.PAUSED) {
      setPlayState(false);
    } else if (event.data === YT.PlayerState.ENDED) {
      // AUTO-NEXT: Otomatis memutar lagu berikutnya secara berlanjut!
      console.log("[Music Capsule] Lagu selesai, auto-next ke lagu berikutnya...");
      playNext();
    }
  }

  function onPlayerError(err) {
    console.warn("[Music Capsule] YouTube error, fallback ke audio lokal:", err);
    fallbackPlayAudio();
  }

  /**
   * Fallback Audio Element
   */
  function fallbackPlayAudio() {
    if (fallbackAudio) {
      fallbackAudio.volume = 0.75;
      fallbackAudio
        .play()
        .then(() => setPlayState(true))
        .catch(() => setPlayState(false));
    }
  }

  function fallbackPauseAudio() {
    if (fallbackAudio) {
      fallbackAudio.pause();
    }
  }

  /**
   * Update Tooltip Lagu Aktif pada Ikon Headphone
   */
  function updateTooltip(index) {
    const track = PLAYLIST[index];
    if (!track) return;
    if (dom.icon) {
      dom.icon.setAttribute("title", `${track.title} (${index + 1}/5)`);
    }
  }

  /**
   * Sinkronisasi Status Play / Pause
   */
  function setPlayState(playing) {
    state.isPlaying = playing;
    const track = PLAYLIST[state.currentIndex];

    if (playing) {
      if (dom.capsule) dom.capsule.classList.add("is-playing");
      if (dom.playBtn) {
        dom.playBtn.textContent = "⏸";
        dom.playBtn.setAttribute("title", "Jeda Musik (⏸)");
      }
      if (dom.icon) {
        dom.icon.setAttribute("title", `Memutar: ${track.title} (${state.currentIndex + 1}/5)`);
      }
    } else {
      if (dom.capsule) dom.capsule.classList.remove("is-playing");
      if (dom.playBtn) {
        dom.playBtn.textContent = "▶";
        dom.playBtn.setAttribute("title", "Putar Musik (▶)");
      }
      if (dom.icon) {
        dom.icon.setAttribute("title", `${track.title} (${state.currentIndex + 1}/5)`);
      }
    }
  }

  /**
   * Putar Track dari Index
   */
  function playTrack(index) {
    state.currentIndex = (index + PLAYLIST.length) % PLAYLIST.length;
    const track = PLAYLIST[state.currentIndex];
    state.hasActivated = true;

    updateTooltip(state.currentIndex);

    if (ytPlayer && state.isReady && typeof ytPlayer.loadVideoById === "function") {
      ytPlayer.loadVideoById({
        videoId: track.id,
        suggestedQuality: "small"
      });
      ytPlayer.playVideo();
    } else {
      fallbackPlayAudio();
    }

    setPlayState(true);
    showToastNotification(`Memutar: ${track.title}`);
  }

  /**
   * Toggle Play / Pause
   */
  function togglePlay() {
    if (!state.hasActivated) {
      // Pengguna mengaktifkan pertama kali secara sadar
      state.hasActivated = true;
      playTrack(state.currentIndex);
      return;
    }

    if (state.isPlaying) {
      if (ytPlayer && state.isReady && typeof ytPlayer.pauseVideo === "function") {
        ytPlayer.pauseVideo();
      }
      fallbackPauseAudio();
      setPlayState(false);
    } else {
      if (ytPlayer && state.isReady && typeof ytPlayer.playVideo === "function") {
        ytPlayer.playVideo();
      } else {
        fallbackPlayAudio();
      }
      setPlayState(true);
    }
  }

  /**
   * Putar Lagu Selanjutnya (Auto-Next / Tombol Next >>)
   */
  function playNext() {
    const nextIdx = (state.currentIndex + 1) % PLAYLIST.length;
    playTrack(nextIdx);
  }

  /**
   * Putar Lagu Sebelumnya (Tombol Prev <<)
   */
  function playPrev() {
    const prevIdx = (state.currentIndex - 1 + PLAYLIST.length) % PLAYLIST.length;
    playTrack(prevIdx);
  }

  /**
   * Toast Notifikasi Ringkas
   */
  function showToastNotification(message) {
    const toastContainer = document.getElementById("toastContainer");
    if (!toastContainer) return;

    const toast = document.createElement("div");
    toast.className = "toast show";
    toast.innerHTML = `
      <div class="toast-icon" style="background-color: var(--caramel)">☕</div>
      <div class="toast-body">
        <span class="toast-title">Musik Kopi Mahasiswa</span>
        <span class="toast-msg">${message}</span>
      </div>
    `;
    toastContainer.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  /**
   * Pasang Event Listeners
   */
  function attachEventListeners() {
    if (dom.playBtn) dom.playBtn.addEventListener("click", togglePlay);
    if (dom.prevBtn) dom.prevBtn.addEventListener("click", playPrev);
    if (dom.nextBtn) dom.nextBtn.addEventListener("click", playNext);
  }

  /**
   * Inisialisasi
   */
  function init() {
    ensureBridgeElement();
    cacheElements();
    attachEventListeners();
    updateTooltip(state.currentIndex);

    // Inisialisasi YouTube API
    const checkYtApi = () => {
      if (window.YT && window.YT.Player) {
        initYouTubePlayer();
      } else {
        const prevHandler = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = function () {
          if (typeof prevHandler === "function") prevHandler();
          initYouTubePlayer();
        };
      }
    };

    checkYtApi();
  }

  // Global API
  window.KopiMusicPlayer = {
    play: () => {
      if (!state.isPlaying) togglePlay();
    },
    pause: () => {
      if (state.isPlaying) togglePlay();
    },
    toggle: togglePlay,
    next: playNext,
    prev: playPrev,
    playTrack: playTrack,
    getPlaylist: () => PLAYLIST,
    getState: () => ({ ...state })
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
