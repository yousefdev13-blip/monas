const socket = io();

const cards = [
  { q: "What does HTML stand for?", a: "HyperText Markup Language. It gives a web page its structure." },
  { q: "What is CSS used for?", a: "Cascading Style Sheets. CSS controls the design, layout, colors, and responsiveness of a page." },
  { q: "What does JavaScript add to a website?", a: "Interactivity and dynamic behavior, such as menus, form validation, and updating content." },
  { q: "What is the DOM?", a: "The Document Object Model. It represents the page as objects that JavaScript can read and change." },
  { q: "What is a variable?", a: "A named place to store a value that your program can use." },
  { q: "What does API stand for?", a: "Application Programming Interface. It allows different software systems to communicate." },
  { q: "What is responsive design?", a: "A design approach that makes a website adapt to different screen sizes and devices." },
  { q: "What is Git used for?", a: "Version control. Git tracks code changes and helps developers collaborate." }
];

let current = 0;
let flipped = false;
let studying = false;
let correct = 0;
let completed = new Set();
let userName = localStorage.getItem("focuscards-name") || "Yousef";

const $ = (id) => document.getElementById(id);
const question = $("cardQuestion");

function showToast(message, icon = "✦") {
  const toast = document.createElement("div");
  toast.className = "toast";
  const symbol = document.createElement("span");
  symbol.className = "toast-icon";
  symbol.textContent = icon;
  const text = document.createElement("span");
  text.textContent = message;
  toast.append(symbol, text);
  $("toastRegion").appendChild(toast);
  setTimeout(() => toast.remove(), 4200);
}

function updateProfile() {
  $("profileName").textContent = userName;
  $("profileAvatar").textContent = userName.charAt(0).toUpperCase();
}

function renderCard() {
  const card = cards[current];
  question.textContent = flipped ? card.a : card.q;
  $("cardCounter").innerHTML = `${String(current + 1).padStart(2, "0")} <i>/</i> ${String(cards.length).padStart(2, "0")}`;
  $("progressFill").style.width = `${((current + 1) / cards.length) * 100}%`;
  $("totalCards").textContent = cards.length;
  $("masteredCount").textContent = completed.size;
  $("flipBtn").textContent = flipped ? "Show question" : "Reveal answer";
  $("flashcard").querySelector(".tag").textContent = flipped ? "ANSWER SIDE" : "FRONT SIDE";
  $("flashcard").setAttribute("aria-label", flipped ? "Flashcard answer" : "Flashcard question. Click to reveal answer.");
}

function emitActivity(action) {
  socket.emit("study:activity", { name: userName, action, card: current + 1 });
}

function flipCard() {
  flipped = !flipped;
  renderCard();
  if (flipped) emitActivity("revealed a flashcard answer");
}

function startStudying() {
  if (studying) {
    $("deck").scrollIntoView({ behavior: "smooth" });
    return;
  }
  studying = true;
  $("sessionStatus").textContent = "In progress";
  $("startBtn").innerHTML = 'Continue studying <span>→</span>';
  socket.emit("study:presence", { name: userName, studying: true });
  socket.emit("study:activity", { name: userName, action: "started a study session" });
  showToast("Your study session has started!", "✦");
  $("deck").scrollIntoView({ behavior: "smooth" });
}

function nextCard() {
  if (!flipped) {
    showToast("Reveal the answer before moving on.", "!");
    return;
  }
  if (!completed.has(current)) {
    completed.add(current);
    correct++;
  }
  if (current === cards.length - 1) {
    finishSession();
    return;
  }
  current++;
  flipped = false;
  renderCard();
  if (studying) emitActivity("moved to the next flashcard");
}

function previousCard() {
  if (current === 0) return;
  current--;
  flipped = false;
  renderCard();
  if (studying) emitActivity("reviewed a previous flashcard");
}

function finishSession() {
  studying = false;
  $("sessionStatus").textContent = "Completed";
  $("startBtn").innerHTML = 'Study again <span>→</span>';
  socket.emit("study:finish", { name: userName, total: cards.length, correct });
  showToast(`Session complete! You reviewed ${correct}/${cards.length} cards.`, "✓");
  current = 0;
  flipped = false;
  completed.clear();
  correct = 0;
  renderCard();
}

function addActivity(message, time = "Just now") {
  const feed = $("activityFeed");
  const empty = feed.querySelector(".empty-activity");
  if (empty) empty.remove();

  const item = document.createElement("div");
  item.className = "activity-item";
  const avatar = document.createElement("div");
  avatar.className = "activity-avatar";
  avatar.textContent = message.trim().charAt(0).toUpperCase();
  const copy = document.createElement("div");
  copy.className = "activity-copy";
  const strong = document.createElement("strong");
  strong.textContent = message;
  const small = document.createElement("small");
  small.textContent = time;
  copy.append(strong, small);
  item.append(avatar, copy);
  feed.prepend(item);
  while (feed.children.length > 12) feed.lastElementChild.remove();
}

function openNameModal() {
  $("nameInput").value = userName;
  $("nameModal").classList.add("show");
  $("nameInput").focus();
}

function saveName() {
  const nextName = $("nameInput").value.trim().slice(0, 24);
  if (!nextName) return showToast("Please enter a name first.", "!");
  userName = nextName;
  localStorage.setItem("focuscards-name", userName);
  updateProfile();
  $("nameModal").classList.remove("show");
  showToast(`Welcome, ${userName}!`);
}

$("startBtn").addEventListener("click", startStudying);
$("flipBtn").addEventListener("click", flipCard);
$("flashcard").addEventListener("click", flipCard);
$("flashcard").addEventListener("keydown", (event) => {
  if (event.key === "Enter") flipCard();
});
$("nextBtn").addEventListener("click", nextCard);
$("prevBtn").addEventListener("click", previousCard);
$("editName").addEventListener("click", openNameModal);
$("saveName").addEventListener("click", saveName);
$("closeModal").addEventListener("click", () => $("nameModal").classList.remove("show"));
$("nameModal").addEventListener("click", (event) => {
  if (event.target === $("nameModal")) $("nameModal").classList.remove("show");
});
$("nameInput").addEventListener("keydown", (event) => {
  if (event.key === "Enter") saveName();
});

document.addEventListener("keydown", (event) => {
  if (event.target.tagName === "INPUT") return;
  if (event.key === "ArrowRight") nextCard();
  if (event.key === "ArrowLeft") previousCard();
  if (event.code === "Space") {
    event.preventDefault();
    flipCard();
  }
});

socket.on("connect", () => {
  $("onlineCount").textContent = socket.connected ? "1" : "0";
  showToast("Connected to the live study room.", "●");
});

socket.on("online:count", ({ count }) => {
  $("onlineCount").textContent = count;
});

socket.on("study:presence", (data) => {
  addActivity(data.message);
  showToast(data.message, data.studying ? "▶" : "●");
});

socket.on("study:activity", (data) => {
  addActivity(data.message);
  showToast(data.message, "✦");
});

socket.on("study:finish", (data) => {
  addActivity(data.message);
  showToast(data.message, "✓");
});

socket.on("disconnect", () => {
  showToast("Connection lost. Reconnecting…", "!");
});

$("todayLabel").textContent = new Intl.DateTimeFormat("en", { weekday: "long", month: "long", day: "numeric" }).format(new Date()).toUpperCase();
updateProfile();
renderCard();
