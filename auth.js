const authForm = document.getElementById("authForm");
const authTitle = document.getElementById("authTitle");
const authSubmit = document.getElementById("authSubmit");
const switchModeBtn = document.getElementById("switchMode");
const switchLabel = document.getElementById("switchLabel");
const emailField = document.getElementById("email");
const passwordField = document.getElementById("password");
const roleField = document.getElementById("role");

let mode = window.location.hash === "#signup" ? "signup" : "login";

function setMode(nextMode) {
  mode = nextMode;
  if (mode === "signup") {
    authTitle.textContent = "Create your account";
    authSubmit.textContent = "Signup";
    switchLabel.textContent = "Already have an account?";
    switchModeBtn.textContent = "Login";
  } else {
    authTitle.textContent = "Login to continue";
    authSubmit.textContent = "Login";
    switchLabel.textContent = "New to MediFliers?";
    switchModeBtn.textContent = "Create account";
  }
}

function getUsers() {
  return storage.get("mf_users", []);
}

function saveSession(user) {
  storage.set("mf_session", {
    userId: user.id,
    role: user.role,
    email: user.email,
    isLoggedIn: true
  });
}

function ensureSeedData() {
  const users = getUsers();
  if (!users.length) {
    storage.set("mf_users", [
      {
        id: crypto.randomUUID(),
        email: "admin@medifliers.com",
        password: "medifliers123",
        role: "Hospital",
        createdAt: new Date().toISOString()
      }
    ]);
  }
}

authForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const email = emailField.value.trim().toLowerCase();
  const password = passwordField.value.trim();
  const role = roleField.value;

  if (!email || !password || password.length < 6) {
    showToast("Enter a valid email and password (min 6 chars).", "error");
    return;
  }

  const users = getUsers();

  if (mode === "signup") {
    const exists = users.find((user) => user.email === email);
    if (exists) {
      showToast("Account already exists. Please login.", "error");
      return;
    }
    const user = {
      id: crypto.randomUUID(),
      email,
      password,
      role,
      createdAt: new Date().toISOString()
    };
    users.push(user);
    storage.set("mf_users", users);
    saveSession(user);
    showToast("Signup successful. Redirecting...", "success");
    setTimeout(() => (window.location.href = "dashboard.html"), 600);
    return;
  }

  const found = users.find((user) => user.email === email && user.password === password && user.role === role);
  if (!found) {
    showToast("Invalid credentials or role mismatch.", "error");
    return;
  }
  saveSession(found);
  showToast("Login successful. Redirecting...", "success");
  setTimeout(() => (window.location.href = "dashboard.html"), 600);
});

switchModeBtn?.addEventListener("click", () => {
  setMode(mode === "login" ? "signup" : "login");
});

document.addEventListener("DOMContentLoaded", () => {
  ensureSeedData();
  setMode(mode);
});
