
import {
    getTrafficDecision,
    getTrafficStatistics
} from "../intelligence/traffic_engine.js";

const initialQueues = {
    N: 8,
    E: 3,
    S: 5,
    W: 6
};

let queues = { ...initialQueues };

let waitingTimes = {
    N: 0,
    E: 0,
    S: 0,
    W: 0
};

let currentLane = "N";
let clearedVehicles = 0;
let mode = "adaptive";
let emergencyLane = null;

let timer = 12;
let phaseDuration = 12;
let simulationInterval = null;

const directions = {
    N: "NORTH",
    E: "EAST",
    S: "SOUTH",
    W: "WEST"
};

const $ = id => document.getElementById(id);

// Activity log
function log(message) {
    const logBox = $("activityLog");
    const entry = document.createElement("div");

    entry.textContent =
        `[${new Date().toLocaleTimeString()}] ${message}`;

    logBox.prepend(entry);

    while (logBox.children.length > 30) {
        logBox.lastChild.remove();
    }
}

// Update traffic lights
function renderSignals() {
    Object.keys(directions).forEach(direction => {
        const lights = $(`signal-${direction}`).querySelectorAll("i");

        lights.forEach(light => {
            light.className = "";
        });

        if (direction === currentLane) {
            lights[2].className = "green";
        } else {
            lights[0].className = "red";
        }
    });
}

// Display vehicles
function renderQueues() {
    Object.keys(directions).forEach(direction => {
        const container = $(`queue-${direction}`);

        container.innerHTML = "";

        const count = Math.min(queues[direction], 15);

        for (let i = 0; i < count; i++) {
            const vehicle = document.createElement("div");
            vehicle.className = "car";
            container.appendChild(vehicle);
        }
    });
}

// Display lane information
function renderLanes() {
    $("laneGrid").innerHTML = Object.keys(directions)
        .map(direction => `
            <div class="lane ${
                direction === currentLane ? "active" : ""
            }">
                <b>${directions[direction]}</b>
                <strong>${queues[direction]}</strong>
                <small>
                    ${direction === currentLane
                        ? "GREEN SIGNAL"
                        : "WAITING: " + waitingTimes[direction] + "s"}
                </small>
            </div>
        `).join("");
}

// Display density analysis
function renderDensity() {
    const total = Object.values(queues).reduce(
        (sum, value) => sum + value,
        0
    );

    $("densityBars").innerHTML = Object.keys(directions)
        .map(direction => {
            const percentage = total === 0
                ? 0
                : queues[direction] / Math.max(40, total) * 100;

            return `
                <div class="density-row">
                    <b>${directions[direction]}</b>

                    <div class="density-track">
                        <div class="density-fill"
                             style="width:${Math.min(100, percentage)}%">
                        </div>
                    </div>

                    <span>${queues[direction]}</span>
                </div>
            `;
        }).join("");
}

// Refresh dashboard
function updateDashboard() {
    const stats = getTrafficStatistics(queues);

    $("activeLane").textContent = directions[currentLane];
    $("totalVehicles").textContent = stats.totalVehicles;
    $("clearedVehicles").textContent = clearedVehicles;
    $("controlMode").textContent = mode.toUpperCase();

    $("currentSignal").textContent = directions[currentLane];
    $("timer").textContent = timer;

    $("progressBar").style.width =
        `${((phaseDuration - timer) / phaseDuration) * 100}%`;

    renderSignals();
    renderQueues();
    renderLanes();
    renderDensity();
}

// Ask intelligence engine for the next signal
function changeSignal() {
    const decision = getTrafficDecision(
        queues,
        currentLane,
        mode,
        emergencyLane,
        waitingTimes
    );

    currentLane = decision.lane;
    phaseDuration = decision.greenTime;
    timer = phaseDuration;

    if (emergencyLane === currentLane) {
        log(`Emergency priority granted to ${directions[currentLane]}.`);
        emergencyLane = null;
    } else {
        log(`AI selected ${directions[currentLane]}: ${decision.reason}`);
    }

    $("decisionText").textContent =
        `${directions[currentLane]} selected. ${decision.reason}`;

    updateDashboard();
}

// One-second simulation cycle
function tick() {
    timer--;

    // Increase waiting time for red-signal roads
    Object.keys(directions).forEach(direction => {
        if (direction !== currentLane) {
            waitingTimes[direction]++;
        }
    });

    // Reset waiting time for the green-signal road
    waitingTimes[currentLane] = 0;

    // Vehicles leave the green-signal road
    const cleared = Math.min(queues[currentLane], 2);

    queues[currentLane] -= cleared;
    clearedVehicles += cleared;

    // Simulate incoming vehicles
    Object.keys(directions).forEach(direction => {
        if (Math.random() < 0.28) {
            queues[direction] = Math.min(
                40,
                queues[direction] + 1
            );
        }
    });

    if (timer <= 0) {
        changeSignal();
    } else {
        updateDashboard();
    }
}

// Start simulation
function startSimulation() {
    if (simulationInterval) return;

    simulationInterval = setInterval(tick, 1000);

    $("startBtn").textContent = "Ⅱ Pause Simulation";

    log("Traffic simulation started.");
}

// Pause simulation
function pauseSimulation() {
    clearInterval(simulationInterval);
    simulationInterval = null;

    $("startBtn").textContent = "▶ Start Simulation";

    log("Traffic simulation paused.");
}

// Start / Pause button
$("startBtn").addEventListener("click", () => {
    if (simulationInterval) {
        pauseSimulation();
    } else {
        startSimulation();
    }
});

// Manually change signal
$("stepBtn").addEventListener("click", () => {
    pauseSimulation();
    changeSignal();
});

// Add simulated traffic
$("addTrafficBtn").addEventListener("click", () => {
    const lanes = Object.keys(directions);

    const randomLane = lanes[
        Math.floor(Math.random() * lanes.length)
    ];

    queues[randomLane] = Math.min(
        40,
        queues[randomLane] + 3
    );

    log(`Three vehicles added to ${directions[randomLane]}.`);

    updateDashboard();
});

// Emergency vehicle priority
$("emergencyBtn").addEventListener("click", () => {
    const lanes = Object.keys(directions).filter(
        direction => direction !== currentLane
    );

    emergencyLane = lanes[
        Math.floor(Math.random() * lanes.length)
    ];

    queues[emergencyLane] = Math.max(
        queues[emergencyLane],
        1
    );

    log(`Emergency vehicle detected on ${directions[emergencyLane]}.`);

    $("decisionText").textContent =
        `Emergency vehicle detected on ${directions[emergencyLane]}. Priority requested.`;

    updateDashboard();
});

// Adaptive control mode
$("adaptiveBtn").addEventListener("click", () => {
    mode = "adaptive";

    $("adaptiveBtn").classList.add("selected");
    $("fixedBtn").classList.remove("selected");

    log("Adaptive traffic control activated.");

    $("decisionText").textContent =
        "Selecting road using vehicle density and waiting time.";

    updateDashboard();
});

// Fixed-time control mode
$("fixedBtn").addEventListener("click", () => {
    mode = "fixed";

    $("fixedBtn").classList.add("selected");
    $("adaptiveBtn").classList.remove("selected");

    log("Fixed-time traffic control activated.");

    $("decisionText").textContent =
        "Fixed-time signal rotation activated.";

    updateDashboard();
});

// Reset everything
$("resetBtn").addEventListener("click", () => {
    pauseSimulation();

    queues = { ...initialQueues };

    waitingTimes = {
        N: 0,
        E: 0,
        S: 0,
        W: 0
    };

    currentLane = "N";
    clearedVehicles = 0;
    emergencyLane = null;

    timer = 12;
    phaseDuration = 12;

    $("activityLog").innerHTML = "";

    $("decisionText").textContent =
        "Traffic monitoring restarted.";

    log("Simulation reset.");

    updateDashboard();
});

// Initialize dashboard
log("TRAFFICMIND AI initialized.");
log("Adaptive traffic intelligence connected.");
log("Vehicle density monitoring started.");

updateDashboard();
// =====================================
// YOLO VIDEO DETECTION CONNECTION
// =====================================

const detectionForm = document.getElementById("detectionForm");

if (detectionForm) {
    detectionForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const videoInput = document.getElementById("trafficVideo");
        const button = document.getElementById("detectButton");
        const status = document.getElementById("detectionStatus");
        const resultsPanel = document.getElementById("detectionResults");

        const file = videoInput.files[0];

        if (!file) {
            status.textContent = "Please select a traffic video.";
            return;
        }

        if (file.size > 100 * 1024 * 1024) {
            status.textContent = "Video must be smaller than 100 MB.";
            return;
        }

        const formData = new FormData();
        formData.append("video", file);

        button.disabled = true;
        button.textContent = "Analyzing...";
        status.textContent = "Uploading video and detecting vehicles. Please wait...";
        resultsPanel.hidden = true;

        try {
            const response = await fetch(
                "http://127.0.0.1:5000/api/detect",
                {
                    method: "POST",
                    body: formData
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Detection failed.");
            }

            document.getElementById("totalVehicles").textContent =
                data.total_vehicles;

            document.getElementById("trafficDensity").textContent =
                data.density;

            document.getElementById("carCount").textContent =
                data.counts.car;

            document.getElementById("motorcycleCount").textContent =
                data.counts.motorcycle;

            document.getElementById("busCount").textContent =
                data.counts.bus;

            document.getElementById("truckCount").textContent =
                data.counts.truck;

            document.getElementById("framesProcessed").textContent =
                data.frames_processed;

            const processedVideo = document.getElementById("processedVideo");
            processedVideo.src = data.video_url + "?t=" + Date.now();
            processedVideo.load();

            resultsPanel.hidden = false;
            status.textContent = "Vehicle detection completed successfully!";

        } catch (error) {
            status.textContent = "Error: " + error.message;
        } finally {
            button.disabled = false;
            button.textContent = "Analyze Traffic Video";
        }
    });
}