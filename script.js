const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const leftScoreEl = document.getElementById("leftScore");
const rightScoreEl = document.getElementById("rightScore");

const game = {
  width: canvas.width,
  height: canvas.height,
  leftScore: 0,
  rightScore: 0,
  lastTime: 0,
  keys: {}
};

const leftPaddle = {
  width: 12,
  height: 90,
  x: 18,
  y: (game.height - 90) / 2,
  speed: 7
};

const rightPaddle = {
  width: 12,
  height: 90,
  x: game.width - 18 - 12,
  y: (game.height - 90) / 2,
  speed: 5.5
};

const ball = {
  radius: 10,
  x: game.width / 2,
  y: game.height / 2,
  vx: 5,
  vy: 3,
  speed: 6
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function resetBall(direction = 1) {
  ball.x = game.width / 2;
  ball.y = game.height / 2;
  ball.vx = direction * (4 + Math.random() * 2);
  ball.vy = (Math.random() * 4 - 2);

  if (Math.abs(ball.vy) < 1.1) {
    ball.vy = 1.1 * (ball.vy >= 0 ? 1 : -1);
  }
}

function updateScores() {
  leftScoreEl.textContent = game.leftScore;
  rightScoreEl.textContent = game.rightScore;
}

function updateLeftPaddle() {
  const moveUp = game.keys.ArrowUp;
  const moveDown = game.keys.ArrowDown;

  if (moveUp) leftPaddle.y -= leftPaddle.speed;
  if (moveDown) leftPaddle.y += leftPaddle.speed;

  leftPaddle.y = clamp(leftPaddle.y, 0, game.height - leftPaddle.height);
}

function updateRightPaddle() {
  const targetY = ball.y - rightPaddle.height / 2;
  const diff = targetY - rightPaddle.y;
  const move = diff * 0.12;

  rightPaddle.y += move;
  rightPaddle.y = clamp(rightPaddle.y, 0, game.height - rightPaddle.height);
}

function handleWallCollision() {
  if (ball.y - ball.radius <= 0) {
    ball.y = ball.radius;
    ball.vy *= -1;
  }

  if (ball.y + ball.radius >= game.height) {
    ball.y = game.height - ball.radius;
    ball.vy *= -1;
  }
}

function handlePaddleCollision(paddle) {
  const ballLeft = ball.x - ball.radius;
  const ballRight = ball.x + ball.radius;
  const ballTop = ball.y - ball.radius;
  const ballBottom = ball.y + ball.radius;

  const paddleLeft = paddle.x;
  const paddleRight = paddle.x + paddle.width;
  const paddleTop = paddle.y;
  const paddleBottom = paddle.y + paddle.height;

  const colliding =
    ballRight >= paddleLeft &&
    ballLeft <= paddleRight &&
    ballBottom >= paddleTop &&
    ballTop <= paddleBottom;

  if (!colliding) return;

  const impact = (ball.y - (paddle.y + paddle.height / 2)) / (paddle.height / 2);
  const angle = impact * (Math.PI / 3);

  const direction = ball.x < game.width / 2 ? 1 : -1;
  const speed = Math.min(Math.hypot(ball.vx, ball.vy) + 0.3, 11);

  ball.vx = direction * Math.cos(angle) * speed;
  ball.vy = Math.sin(angle) * speed;

  if (direction === 1) {
    ball.x = paddle.x + paddle.width + ball.radius;
  } else {
    ball.x = paddle.x - ball.radius;
  }
}

function updateBall() {
  ball.x += ball.vx;
  ball.y += ball.vy;

  handleWallCollision();
  handlePaddleCollision(leftPaddle);
  handlePaddleCollision(rightPaddle);

  if (ball.x + ball.radius < 0) {
    game.rightScore += 1;
    updateScores();
    resetBall(1);
  }

  if (ball.x - ball.radius > game.width) {
    game.leftScore += 1;
    updateScores();
    resetBall(-1);
  }
}

function drawPaddle(paddle) {
  ctx.fillStyle = "#edf4ff";
  ctx.fillRect(paddle.x, paddle.y, paddle.width, paddle.height);
}

function drawBall() {
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
  ctx.fillStyle = "#f8fbff";
  ctx.fill();
  ctx.closePath();
}

function drawCenterLine() {
  ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
  ctx.lineWidth = 2;
  ctx.setLineDash([12, 14]);
  ctx.beginPath();
  ctx.moveTo(game.width / 2, 0);
  ctx.lineTo(game.width / 2, game.height);
  ctx.stroke();
  ctx.setLineDash([]);
}

function draw() {
  ctx.clearRect(0, 0, game.width, game.height);
  drawCenterLine();
  drawPaddle(leftPaddle);
  drawPaddle(rightPaddle);
  drawBall();
}

function gameLoop(timestamp) {
  const delta = timestamp - game.lastTime;
  game.lastTime = timestamp;

  updateLeftPaddle();
  updateRightPaddle();
  updateBall();
  draw();

  requestAnimationFrame(gameLoop);
}

window.addEventListener("keydown", (event) => {
  game.keys[event.code] = true;
});

window.addEventListener("keyup", (event) => {
  game.keys[event.code] = false;
});

canvas.addEventListener("mousemove", (event) => {
  const rect = canvas.getBoundingClientRect();
  const mouseY = ((event.clientY - rect.top) / rect.height) * canvas.height;
  leftPaddle.y = clamp(mouseY - leftPaddle.height / 2, 0, game.height - leftPaddle.height);
});

updateScores();
resetBall(1);
requestAnimationFrame(gameLoop);
