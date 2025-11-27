// Token management
function setToken(token) {
  localStorage.setItem("token", token);
}

function getToken() {
  return localStorage.getItem("token");
}

function clearAuth() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}

// User information management
function setUser(user) {
  localStorage.setItem("user", JSON.stringify(user));
}

function getUser() {
  const userStr = localStorage.getItem("user");
  return userStr ? JSON.parse(userStr) : null;
}

// Authentication check
function isAuthenticated() {
  return !!getToken();
}
