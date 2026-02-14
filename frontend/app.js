const API_BASE = "https://image-search-engine-qxqo.onrender.com";
let accessToken = null;

// ============================
// ON PAGE LOAD
// ============================

window.onload = function () {
    showLogin();
};

// ============================
// UI SWITCHING
// ============================

function showRegister() {
    document.getElementById("registerSection").classList.remove("hidden");
    document.getElementById("loginSection").classList.add("hidden");
}

function showLogin() {
    document.getElementById("registerSection").classList.add("hidden");
    document.getElementById("loginSection").classList.remove("hidden");
}

// ============================
// REGISTER
// ============================

async function register() {
    const username = document.getElementById("regUsername").value;
    const email = document.getElementById("regEmail").value;
    const password = document.getElementById("regPassword").value;

    if (!username || !email || !password) {
        updateStatus("Please fill all fields", true);
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, email, password })
        });

        const data = await response.json();

        if (response.ok) {
            updateStatus("Registration successful! Please login.");
            showLogin();
        } else {
            updateStatus(data.detail || "Registration failed", true);
        }

    } catch (error) {
        updateStatus("Server error", true);
    }
}

// ============================
// LOGIN
// ============================

async function login() {
    const username = document.getElementById("loginUsername").value;
    const password = document.getElementById("loginPassword").value;

    if (!username || !password) {
        updateStatus("Enter username & password", true);
        return;
    }

    const formData = new URLSearchParams();
    formData.append("username", username);
    formData.append("password", password);

    try {
        const response = await fetch(`${API_BASE}/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: formData
        });

        const data = await response.json();

        if (data.access_token) {

            accessToken = data.access_token;

            updateStatus("Login successful!");

            // Hide auth section
            document.getElementById("authSection").classList.add("hidden");

            // Show search section
            document.getElementById("searchSection")
                .classList.remove("hidden");

        } else {
            updateStatus("Invalid credentials", true);
        }

    } catch (error) {
        updateStatus("Server error", true);
    }
}

// ============================
// SEARCH IMAGES (PROTECTED)
// ============================

async function searchImages() {

    if (!accessToken) {
        alert("Login first!");
        return;
    }

    const query = document.getElementById("searchInput").value;

    if (!query) {
        alert("Enter search term");
        return;
    }

    const resultsDiv = document.getElementById("results");
    resultsDiv.innerHTML = "<p>Searching...</p>";

    try {
        const response = await fetch(
            `${API_BASE}/search?query=${encodeURIComponent(query)}`,
            {
                headers: {
                    "Authorization": `Bearer ${accessToken}`
                }
            }
        );

        const data = await response.json();
        resultsDiv.innerHTML = "";

        if (!data.results || data.results.length === 0) {
            resultsDiv.innerHTML = "<p>No results found.</p>";
            return;
        }

        data.results.forEach(item => {

            const card = document.createElement("div");
            card.className = "result-card";

            card.innerHTML = `
                <img src="${item.thumbnail}" />
                <p>${item.title}</p>
                <small>${item.source}</small>
            `;

            card.onclick = () => {
                window.open(item.image_url, "_blank");
            };

            resultsDiv.appendChild(card);
        });

    } catch (error) {
        resultsDiv.innerHTML = "<p>Search failed.</p>";
    }
}

// ============================
// LOGOUT
// ============================

function logout() {

    accessToken = null;

    document.getElementById("searchSection")
        .classList.add("hidden");

    document.getElementById("authSection")
        .classList.remove("hidden");

    updateStatus("Logged out successfully");
}

// ============================
// STATUS HELPER
// ============================

function updateStatus(message, isError = false) {

    const status = document.getElementById("status");

    status.innerText = message;

    if (isError) {
        status.style.color = "#ff4d4d";
    } else {
        status.style.color = "#00ffcc";
    }
}

// ============================
// ENTER KEY SEARCH SUPPORT
// ============================

document.addEventListener("keypress", function (event) {
    if (event.key === "Enter") {
        const activeElement = document.activeElement.id;

        if (activeElement === "searchInput") {
            searchImages();
        }
    }
});
