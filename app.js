const inputText = document.getElementById('inputText');
const speedRange = document.getElementById('speedRange');
const speedReadout = document.getElementById('speedReadout');
const speedLabel = document.getElementById('speedLabel');
const statusReadout = document.getElementById('statusReadout');
const charReadout = document.getElementById('charReadout');
const liveStatus = document.getElementById('liveStatus');
const preview = document.getElementById('preview');
const playBtn = document.getElementById('playBtn');
const pauseBtn = document.getElementById('pauseBtn');
const stopBtn = document.getElementById('stopBtn');

const state = {
  rate: Number(speedRange.value),
  isRunning: false,
  isPaused: false,
  currentIndex: 0,
  activeIndex: -1,
  currentUtterance: null,
  timerId: null,
  voices: [],
};

const punctuationMap = new Map([
  ['.', 'punto'],
  [',', 'coma'],
  [';', 'punto y coma'],
  [':', 'dos puntos'],
  ['(', 'abre paréntesis'],
  [')', 'cierra paréntesis'],
  ['[', 'abre corchete'],
  [']', 'cierra corchete'],
  ['{', 'abre llave'],
  ['}', 'cierra llave'],
  ['-', 'guion'],
  ['_', 'guion bajo'],
  ['/', 'barra'],
  ['\\', 'barra invertida'],
  ['=', 'igual'],
  ['+', 'más'],
  ['*', 'asterisco'],
  ['#', 'almohadilla'],
  ['@', 'arroba'],
  ['%', 'porcentaje'],
  ['&', 'y comercial'],
  ['?', 'signo de interrogación'],
  ['!', 'signo de exclamación'],
  ['<', 'menor que'],
  ['>', 'mayor que'],
  ['"', 'comillas dobles'],
  ["'", 'comillas simples'],
  ['|', 'barra vertical'],
  ['$', 'dólar'],
]);

function normalizeText(value) {
  return value.replace(/\r\n?/g, '\n');
}

function getTokens() {
  return Array.from(normalizeText(inputText.value));
}

function getPreferredVoice() {
  const voices = window.speechSynthesis?.getVoices?.() ?? [];
  if (!voices.length) {
    return null;
  }

  return pickPreferredVoice(voices);
}

function pickPreferredVoice(voices) {
  return (
    voices.find((voice) => voice.lang?.toLowerCase().startsWith('es')) ||
    voices.find((voice) => voice.lang?.toLowerCase().includes('es')) ||
    voices[0] ||
    null
  );
}

function describeChar(char) {
  if (char === '\n') return 'Abajo';
  if (char === ' ') return 'Espacio';
  if (punctuationMap.has(char)) return punctuationMap.get(char);
  return char;
}

function prettySpeedLabel(rate) {
  if (rate < 0.8) return 'Muy lento';
  if (rate < 1.1) return 'Normal';
  if (rate < 1.5) return 'Rápido';
  return 'Muy rápido';
}

function setStatus(text) {
  statusReadout.textContent = text;
  liveStatus.textContent = text;
}

function refreshButtons() {
  const hasText = getTokens().length > 0;

  playBtn.disabled = !hasText || (state.isRunning && !state.isPaused);
  pauseBtn.disabled = !state.isRunning || state.isPaused;
  stopBtn.disabled = !state.isRunning && !state.isPaused;

  playBtn.textContent = state.isPaused ? 'Reanudar' : 'Reproducir';
}

function updateCurrentCharLabel(tokens) {
  if (state.activeIndex < 0 || state.activeIndex >= tokens.length) {
    charReadout.textContent = '-';
    return;
  }

  const char = tokens[state.activeIndex];
  charReadout.textContent = describeChar(char);
}

function renderPreview() {
  const tokens = getTokens();
  preview.innerHTML = '';

  if (!tokens.length) {
    const empty = document.createElement('div');
    empty.className = 'preview-empty';
    empty.textContent = 'El texto aparecerá aquí mientras escribes o pegas contenido.';
    preview.appendChild(empty);
    charReadout.textContent = '-';
    return;
  }

  tokens.forEach((token, index) => {
    if (token === '\n') {
      const newline = document.createElement('span');
      newline.className = `token newline${index === state.activeIndex ? ' current' : ''}`;

      const mark = document.createElement('span');
      mark.className = 'newline-mark';
      mark.textContent = 'Abajo';

      const icon = document.createElement('span');
      icon.textContent = '↵';

      newline.append(icon, mark);
      preview.appendChild(newline);
      return;
    }

    const span = document.createElement('span');
    span.className = `token${token === ' ' ? ' space' : ''}${index === state.activeIndex ? ' current' : ''}`;
    if (token !== ' ') {
      span.textContent = token;
    }
    preview.appendChild(span);
  });

  updateCurrentCharLabel(tokens);
}

function clearTimer() {
  if (state.timerId) {
    window.clearTimeout(state.timerId);
    state.timerId = null;
  }
}

function cancelSpeech() {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
  state.currentUtterance = null;
  clearTimer();
}

function finishPlayback(message = 'Listo') {
  cancelSpeech();
  state.isRunning = false;
  state.isPaused = false;
  state.currentIndex = 0;
  state.activeIndex = -1;
  setStatus(message);
  renderPreview();
  refreshButtons();
}

function queueNextChar(delay = 0) {
  clearTimer();
  state.timerId = window.setTimeout(() => {
    state.timerId = null;
    speakNext();
  }, delay);
}

function speakToken(token, onComplete) {
  const utterance = new SpeechSynthesisUtterance(token);
  const voice = state.voices.length ? pickPreferredVoice(state.voices) : getPreferredVoice();

  if (voice) {
    utterance.voice = voice;
    utterance.lang = voice.lang || 'es-ES';
  } else {
    utterance.lang = 'es-ES';
  }

  utterance.rate = state.rate;
  utterance.pitch = 1;
  utterance.volume = 1;

  utterance.onend = onComplete;
  utterance.onerror = onComplete;

  state.currentUtterance = utterance;
  window.speechSynthesis.speak(utterance);
}

function speakNext() {
  if (!state.isRunning || state.isPaused) {
    return;
  }

  const tokens = getTokens();

  if (!tokens.length) {
    finishPlayback('Sin texto');
    return;
  }

  if (state.currentIndex >= tokens.length) {
    finishPlayback('Terminado');
    return;
  }

  const token = tokens[state.currentIndex];
  state.activeIndex = state.currentIndex;
  renderPreview();

  if (token === ' ') {
    setStatus('Pausa por espacio');
    state.currentIndex += 1;
    queueNextChar(Math.max(850, Math.round(1200 / state.rate)));
    refreshButtons();
    return;
  }

  if (token === '\n') {
    setStatus('Leyendo salto de línea');
    speakToken('Abajo', () => {
      if (!state.isRunning || state.isPaused) {
        return;
      }

      state.currentUtterance = null;
      state.currentIndex += 1;
      queueNextChar(Math.max(1200, Math.round(1800 / state.rate)));
    });
    refreshButtons();
    return;
  }

  setStatus(`Leyendo ${describeChar(token)}`);
  speakToken(describeChar(token), () => {
    if (!state.isRunning || state.isPaused) {
      return;
    }

    state.currentUtterance = null;
    state.currentIndex += 1;
    queueNextChar(500);
  });

  refreshButtons();
}

function startPlayback(fromBeginning = true) {
  const tokens = getTokens();

  if (!tokens.length) {
    renderPreview();
    setStatus('Agrega texto primero');
    refreshButtons();
    return;
  }

  if (fromBeginning) {
    cancelSpeech();
    state.currentIndex = 0;
    state.activeIndex = -1;
  }

  state.isRunning = true;
  state.isPaused = false;
  state.voices = window.speechSynthesis?.getVoices?.() || [];

  setStatus(fromBeginning ? 'Reproduciendo' : 'Reanudado');
  renderPreview();
  refreshButtons();
  speakNext();
}

function pausePlayback() {
  if (!state.isRunning || state.isPaused) {
    return;
  }

  state.isPaused = true;
  clearTimer();
  if ('speechSynthesis' in window) {
    window.speechSynthesis.pause();
  }
  setStatus('Pausado');
  refreshButtons();
}

function stopPlayback() {
  finishPlayback('Detenido');
}

function syncSpeedLabel() {
  const rate = Number(speedRange.value);
  state.rate = rate;
  speedReadout.textContent = `${rate.toFixed(1)}x`;
  speedLabel.textContent = prettySpeedLabel(rate);
}

inputText.addEventListener('input', () => {
  renderPreview();
  refreshButtons();
});

speedRange.addEventListener('input', () => {
  syncSpeedLabel();
  if (state.currentUtterance) {
    state.currentUtterance.rate = state.rate;
  }
});

playBtn.addEventListener('click', () => {
  if (state.isPaused) {
    state.isPaused = false;
    if ('speechSynthesis' in window) {
      window.speechSynthesis.resume();
    }

    if (!state.currentUtterance) {
      speakNext();
    }

    setStatus('Reanudado');
    refreshButtons();
    return;
  }

  startPlayback(true);
});

pauseBtn.addEventListener('click', pausePlayback);
stopBtn.addEventListener('click', stopPlayback);

window.speechSynthesis?.addEventListener?.('voiceschanged', () => {
  state.voices = window.speechSynthesis.getVoices();
});

syncSpeedLabel();
renderPreview();
refreshButtons();
setStatus('Listo');