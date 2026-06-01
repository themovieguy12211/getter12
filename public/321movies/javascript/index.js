(function () {
  var params = new URLSearchParams(window.location.search);
  var mediaId = params.get("id");
  if (!mediaId) {
    console.error("Missing media id in 321movies embed URL");
    return;
  }

  var season = params.get("season");
  var episode = params.get("episode") || "1";
  var startAt = Number(params.get("startAt") || "0");
  var mediaType = season ? "tv" : "movie";
  var video = document.getElementById("v");
  var playButton = document.getElementById("btn-play-main");
  var playIcon = document.getElementById("play-btn-icon");
  var volumeSlider = document.getElementById("volume-slider");
  var volumeIcon = document.getElementById("volume-icon");
  var track = document.getElementById("track");
  var buf = document.getElementById("buf");
  var prog = document.getElementById("prog");
  var thumb = document.getElementById("thumb");
  var curTimeLabel = document.getElementById("t-cur");
  var durTimeLabel = document.getElementById("t-dur");
  var lblSource = document.getElementById("lbl-source");
  var lblQuality = document.getElementById("lbl-quality");
  var titleText = document.getElementById("title-text");
  var epBadge = document.getElementById("ep-badge");
  var settingsOverlay = document.getElementById("settings-overlay-backdrop");
  var settingsWrap = document.getElementById("settings-modal-wrap");
  var settingsTiles = document.querySelectorAll(".settings-tile[data-nav]");
  var settingsBackButtons = document.querySelectorAll(".settings-back-btn");
  var settingsViews = document.querySelectorAll(".settings-view");
  var sourceTile = document.querySelector(".settings-tile[data-nav='sources']");
  var sourceList = document.getElementById("sources-opts");
  var srcDetailBack = document.getElementById("src-detail-back");
  var srcDetailTitle = document.getElementById("src-detail-title");
  var srcDetailBody = document.getElementById("src-detail-body");
  var settingsButton = document.getElementById("btn-settings");
  var sourceFindNext = document.getElementById("src-find-next-btn");
  var subtitleShortcut = document.getElementById("btn-subtitles-shortcut");
  var sourceOffRow = document.getElementById("sub-off-row");

  var sources = [];
  var currentSourceIndex = 0;
  var hlsPlayer = null;
  var isUserSeeking = false;
  var lastSeekTime = 0;

  function formatTime(seconds) {
    var sec = Math.max(0, Math.round(seconds));
    var minutes = Math.floor(sec / 60);
    var remaining = sec % 60;
    return minutes + ":" + String(remaining).padStart(2, "0");
  }

  function setTitle() {
    if (mediaType === "tv") {
      titleText.textContent = "Episode " + episode;
      epBadge.textContent = "S" + season + " • E" + episode;
    } else {
      titleText.textContent = "Movie " + mediaId;
      epBadge.textContent = "";
    }
  }

  function setVolume(value) {
    var normalized = Math.min(1, Math.max(0, value));
    video.volume = normalized;
    if (volumeSlider) volumeSlider.value = String(Math.round(normalized * 100));
    if (volumeIcon) {
      if (normalized === 0) {
        volumeIcon.textContent = "🔇";
      } else if (normalized < 0.5) {
        volumeIcon.textContent = "🔈";
      } else {
        volumeIcon.textContent = "🔊";
      }
    }
  }

  function updatePlayIcon() {
    if (!playIcon) return;
    playIcon.className = video.paused ? "fa-solid fa-play" : "fa-solid fa-pause";
  }

  function updateProgress() {
    if (!video.duration || video.duration === Infinity) return;
    var percent = (video.currentTime / video.duration) * 100;
    if (prog) prog.style.width = percent + "%";
    if (thumb) thumb.style.left = percent + "%";
    if (curTimeLabel) curTimeLabel.textContent = formatTime(video.currentTime);
    if (durTimeLabel) durTimeLabel.textContent = formatTime(video.duration);
  }

  function showError(message) {
    var errorText = document.querySelector(".err-text");
    if (errorText) {
      errorText.textContent = message;
      errorText.style.display = "block";
    }
    console.error(message);
  }

  function setSourceLabel(index) {
    var source = sources[index];
    if (!source) return;
    if (lblSource) {
      lblSource.textContent = source.label || source.provider || source.type || "Source";
    }
    if (lblQuality) {
      lblQuality.textContent = source.type === "mp4" ? "MP4" : "Auto";
    }
  }

  function tearDownHls() {
    if (hlsPlayer) {
      try {
        hlsPlayer.destroy();
      } catch (err) {
        console.warn("Failed to destroy Hls instance", err);
      }
      hlsPlayer = null;
    }
  }

  function loadSource(index) {
    var source = sources[index];
    if (!source || !video) return;

    currentSourceIndex = index;
    setSourceLabel(index);

    tearDownHls();
    video.src = "";
    video.load();

    if (source.type === "hls" && window.Hls && window.Hls.isSupported()) {
      hlsPlayer = new window.Hls({
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        enableWorker: true,
      });
      hlsPlayer.loadSource(source.file);
      hlsPlayer.attachMedia(video);
      hlsPlayer.on(window.Hls.Events.ERROR, function (event, data) {
        console.warn("HLS error", data);
        if (data.fatal) {
          showError("Playback error on HLS source. Trying next source...");
          selectNextSource();
        }
      });
    } else {
      video.src = source.file;
    }

    video.addEventListener("loadedmetadata", function onLoaded() {
      video.removeEventListener("loadedmetadata", onLoaded);
      if (startAt > 0 && Number.isFinite(video.duration) && video.duration > startAt) {
        video.currentTime = Math.min(startAt, Math.max(0, video.duration - 2));
      }
    });

    video.play().catch(function () {
      updatePlayIcon();
    });
  }

  function renderSourceList() {
    if (!sourceList) return;
    sourceList.innerHTML = "";
    sources.forEach(function (source, index) {
      var item = document.createElement("button");
      item.type = "button";
      item.className = "settings-list-item";
      if (index === currentSourceIndex) item.classList.add("active");
      item.textContent = source.label || source.provider || "Source " + (index + 1);
      item.addEventListener("click", function () {
        var previous = sourceList.querySelector(".settings-list-item.active");
        if (previous) previous.classList.remove("active");
        item.classList.add("active");
        loadSource(index);
      });
      sourceList.appendChild(item);
    });
  }

  function selectNextSource() {
    if (!sources.length) return;
    var nextIndex = currentSourceIndex + 1;
    if (nextIndex >= sources.length) nextIndex = 0;
    loadSource(nextIndex);
    renderSourceList();
  }

  function openSettingsView(viewId) {
    if (!settingsWrap || !settingsOverlay) return;
    settingsWrap.classList.add("open");
    settingsOverlay.classList.add("open");
    settingsViews.forEach(function (view) {
      view.classList.toggle("active", view.id === viewId);
    });
  }

  function closeSettings() {
    if (!settingsWrap || !settingsOverlay) return;
    settingsWrap.classList.remove("open");
    settingsOverlay.classList.remove("open");
    settingsViews.forEach(function (view) {
      view.classList.remove("active");
    });
    var main = document.getElementById("settings-view-main");
    if (main) main.classList.add("active");
  }

  function initSettingsNavigation() {
    settingsTiles.forEach(function (tile) {
      tile.addEventListener("click", function () {
        var target = tile.dataset.nav;
        if (!target) return;
        if (target === "sources") {
          openSettingsView("settings-view-sources");
        } else {
          openSettingsView("settings-view-main");
        }
      });
    });

    settingsBackButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        if (button.closest("#src-detail-view") && srcDetailBody && srcDetailBody.children.length > 0) {
          openSettingsView("settings-view-sources");
        } else {
          closeSettings();
        }
      });
    });

    if (settingsOverlay) {
      settingsOverlay.addEventListener("click", closeSettings);
    }

    if (settingsButton) {
      settingsButton.addEventListener("click", function () {
        openSettingsView("settings-view-main");
      });
    }

    if (sourceTile) {
      sourceTile.addEventListener("click", function () {
        openSettingsView("settings-view-sources");
      });
    }

    if (sourceFindNext) {
      sourceFindNext.addEventListener("click", function () {
        selectNextSource();
      });
    }

    if (subtitleShortcut) {
      subtitleShortcut.addEventListener("click", function () {
        openSettingsView("settings-view-subtitles");
      });
    }
  }

  function setupControls() {
    if (!video) return;
    if (playButton) {
      playButton.addEventListener("click", function () {
        if (video.paused) {
          video.play().catch(function () {});
        } else {
          video.pause();
        }
        updatePlayIcon();
      });
    }

    video.addEventListener("play", updatePlayIcon);
    video.addEventListener("pause", updatePlayIcon);
    video.addEventListener("timeupdate", function () {
      if (!isUserSeeking) updateProgress();
      var now = Date.now();
      if (now - lastSeekTime > 1000) {
        updateProgress();
        lastSeekTime = now;
      }
    });
    video.addEventListener("durationchange", updateProgress);
    video.addEventListener("loadedmetadata", updateProgress);

    if (volumeSlider) {
      volumeSlider.addEventListener("input", function () {
        setVolume(Number(volumeSlider.value) / 100);
      });
    }

    if (volumeIcon) {
      volumeIcon.addEventListener("click", function () {
        if (video.muted || video.volume === 0) {
          video.muted = false;
          setVolume(0.75);
        } else {
          video.muted = true;
          volumeIcon.textContent = "🔇";
        }
      });
    }

    if (track) {
      track.addEventListener("click", function (event) {
        if (!video.duration) return;
        var rect = track.getBoundingClientRect();
        var ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
        video.currentTime = ratio * video.duration;
        updateProgress();
      });
    }
  }

  async function getPlaylistSources() {
    var url = new URL("/api/player/vixsrc-playlist", window.location.origin);
    url.searchParams.set("type", mediaType);
    url.searchParams.set("id", mediaId);
    if (mediaType === "tv") {
      url.searchParams.set("season", season || "1");
      url.searchParams.set("episode", episode || "1");
    }

    var res = await fetch(url.toString());
    if (!res.ok) {
      throw new Error("Failed to load sources: " + res.status);
    }
    var data = await res.json();
    if (!data || !Array.isArray(data.playlist) || data.playlist.length === 0) {
      throw new Error("No sources returned");
    }

    var playlistSources = [];
    data.playlist.forEach(function (item) {
      if (!item || !Array.isArray(item.sources)) return;
      item.sources.forEach(function (source) {
        if (!source || !source.file) return;
        if (source.type !== "hls" && source.type !== "mp4") return;
        playlistSources.push({
          label: source.label || source.provider || (source.type === "hls" ? "HLS" : "MP4"),
          provider: source.provider || "",
          file: source.file,
          type: source.type,
          default: Boolean(source.default),
        });
      });
    });
    return playlistSources;
  }

  async function init() {
    setTitle();
    initSettingsNavigation();
    setupControls();
    setVolume(0.75);

    try {
      sources = await getPlaylistSources();
      if (!sources.length) {
        showError("No playable sources were found.");
        return;
      }

      currentSourceIndex = sources.findIndex(function (source) {
        return Boolean(source.default);
      });
      if (currentSourceIndex < 0) currentSourceIndex = 0;

      renderSourceList();
      loadSource(currentSourceIndex);
    } catch (error) {
      showError(error instanceof Error ? error.message : String(error));
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
