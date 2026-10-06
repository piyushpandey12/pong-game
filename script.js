const canvas = document.getElementById("gameCanvas");
const context = canvas.getContext("2d");
const elements = Object.fromEntries([
  "leftScore", "rightScore", "courtOverlay", "overlayKicker", "overlayTitle",
  "overlayDescription", "startButton", "startShortcut", "pauseButton",
  "restartButton", "fullscreenButton", "soundToggle", "difficultyHint",
  "targetLabel", "difficultyLabel", "matchStatus", "countdown", "rallyStat",
  "hitsStat", "timeStat"
].map((name) => [name, document.getElementById(name)]));

const levels = {
  easy: { speed: 235, response: 3.2, ballSpeed: 350, hint: "Find your rhythm. A relaxed place to start." },
  normal: { speed: 350, response: 4.8, ballSpeed: 420, hint: "A fair fight. A little focus goes a long way." },
  hard: { speed: 470, response: 7, ballSpeed: 490, hint: "Quick reflexes required. Bring your A-game." }
};
const game = {
  width: canvas.width, height: canvas.height, state: "ready", difficulty: "normal",
  target: 7, leftScore: 0, rightScore: 0, keys: new Set(), lastTime: 0,
  elapsed: 0, rally: 0, bestRally: 0, returns: 0, countdown: 0,
  serveDirection: 1, sound: false, trail: [], audio: null
};
const leftPaddle = { x: 28, y: 225, width: 9, height: 90 };
const rightPaddle = { x: 963, y: 225, width: 9, height: 90 };
const ball = { x: 500, y: 270, radius: 7, vx: 0, vy: 0 };
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

function playSound(frequency, duration = 0.065) {
  if (!game.sound) return;
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    if (!game.audio) game.audio = new AudioContextClass();
    if (game.audio.state === "suspended") void game.audio.resume().catch(() => {});
    const oscillator = game.audio.createOscillator();
    const gain = game.audio.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.045, game.audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, game.audio.currentTime + duration);
    oscillator.connect(gain);
    gain.connect(game.audio.destination);
    oscillator.start();
    oscillator.stop(game.audio.currentTime + duration);
  } catch {
    game.sound = false;
    elements.soundToggle.setAttribute("aria-checked", "false");
  }
}

function updateStats() {
  elements.leftScore.textContent = game.leftScore;
  elements.rightScore.textContent = game.rightScore;
  elements.rallyStat.textContent = game.bestRally;
  elements.hitsStat.textContent = game.returns;
  const seconds = Math.floor(game.elapsed);
  elements.timeStat.textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function updateSettings() {
  elements.targetLabel.textContent = game.target;
  elements.difficultyLabel.textContent = game.difficulty.toUpperCase();
  elements.difficultyHint.textContent = levels[game.difficulty].hint;
  document.querySelectorAll("[data-difficulty], [data-target]").forEach((button) => {
    const selected = button.dataset.difficulty === game.difficulty || Number(button.dataset.target) === game.target;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
    button.disabled = ["playing", "countdown", "paused"].includes(game.state);
  });
}

function setPauseLabel(paused) {
  elements.pauseButton.setAttribute("aria-label", paused ? "Resume game" : "Pause game");
  elements.pauseButton.title = paused ? "Resume (Space)" : "Pause (Space)";
  elements.pauseButton.querySelector("path").setAttribute("d", paused ? "M8 5l11 7-11 7Z" : "M8 5v14M16 5v14");
}

function showOverlay(kicker, title, description, buttonText, shortcut) {
  elements.overlayKicker.textContent = kicker;
  elements.overlayTitle.textContent = title;
  elements.overlayDescription.textContent = description;
  elements.startButton.innerHTML = `${buttonText} <span aria-hidden="true">↗</span>`;
  elements.startShortcut.textContent = shortcut;
  elements.courtOverlay.hidden = false;
}

function centerBall() {
  ball.x = game.width / 2;
  ball.y = game.height / 2;
  ball.vx = 0;
  ball.vy = 0;
  game.trail = [];
}

function resetMatch() {
  game.state = "ready";
  game.leftScore = 0;
  game.rightScore = 0;
  game.elapsed = 0;
  game.rally = 0;
  game.bestRally = 0;
  game.returns = 0;
  game.keys.clear();
  leftPaddle.y = rightPaddle.y = (game.height - leftPaddle.height) / 2;
  centerBall();
  elements.countdown.hidden = true;
  elements.pauseButton.disabled = true;
  setPauseLabel(false);
  elements.matchStatus.textContent = "WAITING FOR YOUR FIRST SERVE";
  showOverlay("A CLASSIC FOR A REASON", "Ready to rally?", `First to ${game.target}. Keep your eye on the ball.`, "Let's play", "or press Enter to start");
  updateStats();
  updateSettings();
}

function startServe(direction, initial = false) {
  centerBall();
  game.rally = 0;
  game.serveDirection = direction;
  game.state = "countdown";
  game.countdown = initial ? 3 : 1.2;
  elements.courtOverlay.hidden = true;
  elements.countdown.hidden = false;
  elements.countdown.textContent = initial ? "3" : "READY";
  elements.pauseButton.disabled = false;
  setPauseLabel(false);
  elements.matchStatus.textContent = "GET READY TO RALLY";
  updateSettings();
}

function launchBall() {
  const angle = (Math.random() * 0.6 - 0.3);
  const speed = levels[game.difficulty].ballSpeed;
  ball.vx = game.serveDirection * speed * Math.cos(angle);
  ball.vy = speed * Math.sin(angle);
  game.state = "playing";
  elements.countdown.hidden = true;
  elements.matchStatus.textContent = "MATCH IN PLAY";
  playSound(520);
}

function startOrResume() {
  if (game.state === "paused") {
    game.state = game.resumeState;
    elements.courtOverlay.hidden = true;
    elements.countdown.hidden = game.state !== "countdown";
    setPauseLabel(false);
    elements.matchStatus.textContent = game.state === "countdown" ? "GET READY TO RALLY" : "MATCH IN PLAY";
  } else if (game.state === "ready" || game.state === "finished") {
    resetMatch();
    startServe(Math.random() < 0.5 ? -1 : 1, true);
  }
}

function pauseMatch() {
  if (game.state === "paused") {
    startOrResume();
  } else if (game.state === "playing" || game.state === "countdown") {
    game.resumeState = game.state;
    game.state = "paused";
    game.keys.clear();
    elements.countdown.hidden = true;
    setPauseLabel(true);
    showOverlay("TAKE A BREATHER", "Your court can wait.", "Same score. Same rivalry. Ready when you are.", "Resume match", "or press Space to continue");
    elements.matchStatus.textContent = "MATCH PAUSED";
  }
}

function scorePoint(player) {
  game[player === "left" ? "leftScore" : "rightScore"] += 1;
  playSound(player === "left" ? 660 : 220, 0.18);
  updateStats();
  if (game.leftScore >= game.target || game.rightScore >= game.target) {
    game.state = "finished";
    centerBall();
    elements.pauseButton.disabled = true;
    const won = game.leftScore >= game.target;
    showOverlay(won ? "THAT'S YOUR GAME" : "A WORTHY OPPONENT", won ? "Well played, challenger." : "The rematch is yours.", `${game.leftScore} – ${game.rightScore}. ${won ? "A little skill. A lot of satisfaction." : "Every rally makes you better."}`, "Play again", "or press Enter for a rematch");
    elements.matchStatus.textContent = won ? "MATCH COMPLETE · YOU WIN" : "MATCH COMPLETE · CPU WINS";
    updateSettings();
    elements.startButton.focus({ preventScroll: true });
  } else {
    startServe(player === "left" ? -1 : 1);
  }
}

function collidePaddle(paddle, direction) {
  if (ball.vx * direction >= 0) return;
  const overlaps = ball.x + ball.radius >= paddle.x && ball.x - ball.radius <= paddle.x + paddle.width && ball.y + ball.radius >= paddle.y && ball.y - ball.radius <= paddle.y + paddle.height;
  if (!overlaps) return;
  const impact = clamp((ball.y - paddle.y - paddle.height / 2) / (paddle.height / 2), -1, 1);
  const angle = impact * Math.PI / 3;
  const speed = Math.min(Math.hypot(ball.vx, ball.vy) + 23, 830);
  ball.vx = direction * Math.cos(angle) * speed;
  ball.vy = Math.sin(angle) * speed;
  ball.x = direction === 1 ? paddle.x + paddle.width + ball.radius : paddle.x - ball.radius;
  game.rally += 1;
  game.bestRally = Math.max(game.bestRally, game.rally);
  if (direction === 1) game.returns += 1;
  playSound(direction === 1 ? 420 : 340);
  updateStats();
}

function update(delta) {
  if (game.state === "countdown") {
    game.countdown -= delta;
    elements.countdown.textContent = game.countdown > 1 ? Math.ceil(game.countdown) : "GO";
    if (game.countdown <= 0) launchBall();
    return;
  }
  if (game.state !== "playing") return;
  game.elapsed += delta;
  const moveUp = game.keys.has("ArrowUp") || game.keys.has("KeyW");
  const moveDown = game.keys.has("ArrowDown") || game.keys.has("KeyS");
  leftPaddle.y = clamp(leftPaddle.y + (Number(moveDown) - Number(moveUp)) * 590 * delta, 0, game.height - leftPaddle.height);
  const level = levels[game.difficulty];
  const target = ball.vx > 0 ? ball.y - rightPaddle.height / 2 : (game.height - rightPaddle.height) / 2;
  const difference = target - rightPaddle.y;
  rightPaddle.y = clamp(rightPaddle.y + clamp(difference * level.response, -level.speed, level.speed) * delta, 0, game.height - rightPaddle.height);

  const steps = Math.max(1, Math.ceil(Math.hypot(ball.vx, ball.vy) * delta / ball.radius));
  for (let step = 0; step < steps; step += 1) {
    ball.x += ball.vx * delta / steps;
    ball.y += ball.vy * delta / steps;
    if (ball.y < ball.radius || ball.y > game.height - ball.radius) {
      ball.y = clamp(ball.y, ball.radius, game.height - ball.radius);
      ball.vy *= -1;
      playSound(280, 0.04);
    }
    collidePaddle(leftPaddle, 1);
    collidePaddle(rightPaddle, -1);
    if (ball.x < -ball.radius) { scorePoint("right"); break; }
    if (ball.x > game.width + ball.radius) { scorePoint("left"); break; }
  }
  if (!reducedMotion && game.state === "playing") {
    game.trail.push({ x: ball.x, y: ball.y });
    if (game.trail.length > 7) game.trail.shift();
  }
  updateStats();
}

function draw() {
  context.clearRect(0, 0, game.width, game.height);
  context.strokeStyle = "#afc39816";
  context.lineWidth = 1;
  context.setLineDash([5, 11]);
  context.beginPath();
  context.moveTo(game.width / 2, 0);
  context.lineTo(game.width / 2, game.height);
  context.stroke();
  context.setLineDash([]);
  context.beginPath();
  context.arc(game.width / 2, game.height / 2, 66, 0, Math.PI * 2);
  context.stroke();
  context.fillStyle = "#c5e77b";
  context.fillRect(leftPaddle.x, leftPaddle.y, leftPaddle.width, leftPaddle.height);
  context.fillStyle = "#adbd9b";
  context.fillRect(rightPaddle.x, rightPaddle.y, rightPaddle.width, rightPaddle.height);
  game.trail.forEach((point, index) => {
    context.fillStyle = `rgba(197, 231, 123, ${index / game.trail.length * 0.13})`;
    context.beginPath();
    context.arc(point.x, point.y, ball.radius * index / game.trail.length, 0, Math.PI * 2);
    context.fill();
  });
  context.fillStyle = "#e5eed8";
  context.beginPath();
  context.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
  context.fill();
}

function gameLoop(timestamp) {
  const delta = game.lastTime ? Math.min((timestamp - game.lastTime) / 1000, 0.04) : 0;
  game.lastTime = timestamp;
  update(delta);
  draw();
  requestAnimationFrame(gameLoop);
}

function movePointer(event) {
  if (game.state !== "playing" && game.state !== "countdown") return;
  const rect = canvas.getBoundingClientRect();
  const scale = Math.min(rect.width / game.width, rect.height / game.height);
  const offset = (rect.height - game.height * scale) / 2;
  const position = (event.clientY - rect.top - offset) / scale;
  leftPaddle.y = clamp(position - leftPaddle.height / 2, 0, game.height - leftPaddle.height);
}

elements.startButton.addEventListener("click", startOrResume);
elements.pauseButton.addEventListener("click", pauseMatch);
elements.restartButton.addEventListener("click", resetMatch);
elements.soundToggle.addEventListener("click", () => {
  game.sound = !game.sound;
  elements.soundToggle.setAttribute("aria-checked", String(game.sound));
  playSound(480);
});
document.querySelectorAll("[data-difficulty]").forEach((button) => {
  button.addEventListener("click", () => { game.difficulty = button.dataset.difficulty; updateSettings(); });
});
document.querySelectorAll("[data-target]").forEach((button) => {
  button.addEventListener("click", () => {
    game.target = Number(button.dataset.target);
    updateSettings();
    if (game.state === "ready") elements.overlayDescription.textContent = `First to ${game.target}. Keep your eye on the ball.`;
  });
});

elements.fullscreenButton.addEventListener("click", async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.querySelector(".game-shell").requestFullscreen();
  } catch {
    elements.matchStatus.textContent = "FULLSCREEN IS UNAVAILABLE IN THIS BROWSER";
  }
});
if (!document.fullscreenEnabled) {
  elements.fullscreenButton.hidden = true;
}
document.addEventListener("fullscreenchange", () => {
  elements.fullscreenButton.setAttribute("aria-label", document.fullscreenElement ? "Exit fullscreen" : "Enter fullscreen");
  elements.fullscreenButton.title = document.fullscreenElement ? "Exit fullscreen" : "Fullscreen";
});

window.addEventListener("keydown", (event) => {
  if (event.ctrlKey || event.metaKey || event.altKey || event.target.closest("input, textarea, select, [contenteditable]")) return;
  if (["ArrowUp", "ArrowDown", "KeyW", "KeyS"].includes(event.code)) {
    if (["playing", "countdown"].includes(game.state)) {
      event.preventDefault();
      game.keys.add(event.code);
    }
  } else if (event.code === "Space" && !event.repeat && ["playing", "countdown", "paused"].includes(game.state)) {
    if (event.target.closest("button") && event.target !== elements.startButton && event.target !== elements.pauseButton) return;
    event.preventDefault();
    pauseMatch();
  } else if (event.code === "Enter" && !event.repeat && !event.target.closest("button, a")) {
    event.preventDefault();
    startOrResume();
  } else if (event.code === "KeyR" && !event.repeat) {
    event.preventDefault();
    resetMatch();
  }
});
window.addEventListener("keyup", (event) => game.keys.delete(event.code));
window.addEventListener("blur", () => {
  game.keys.clear();
  if (game.state === "playing" || game.state === "countdown") pauseMatch();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && (game.state === "playing" || game.state === "countdown")) pauseMatch();
});
canvas.addEventListener("pointermove", movePointer);
canvas.addEventListener("pointerdown", (event) => {
  canvas.focus({ preventScroll: true });
  canvas.setPointerCapture(event.pointerId);
  movePointer(event);
});

resetMatch();
draw();
requestAnimationFrame(gameLoop);
