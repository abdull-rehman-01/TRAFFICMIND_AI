
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

function renderSignals() {
    Object.keys(directions).forEach(direction => {
        const signal = $(`signal-${direction}`);
        const lights = signal.querySelectorAll("i");

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
                        : "WAITING"}
                </small>
            </div>
        `).join("");
}

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

function changeSignal() {
    const decision = getTrafficDecision(
        queues,
        currentLane,
        mode,
        emergencyLane
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

function tick() {
    timer--;

    // Vehicles leave the road receiving green
    const cleared = Math.min(queues[currentLane], 2);

    queues[currentLane] -= cleared;
    clearedVehicles += cleared;

    // Simulate new arriving vehicles
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

function startSimulation() {
    if (simulationInterval) return;

    simulationInterval = setInterval(tick, 1000);

    $("startBtn").textContent = "Ⅱ Pause Simulation";

    log("Traffic simulation started.");
}

function pauseSimulation() {
    clearInterval(simulationInterval);
    simulationInterval = null;

    $("startBtn").textContent = "▶ Start Simulation";

    log("Traffic simulation paused.");
}

$("startBtn").addEventListener("click", () => {
    if (simulationInterval) {
        pauseSimulation();
    } else {
        startSimulation();
    }
});

$("stepBtn").addEventListener("click", () => {
    pauseSimulation();
    changeSignal();
});

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

$("emergencyBtn").addEventListener("click", () => {
    const lanes = Object.keys(directions).filter(
        direction => direction !== currentLane
    );

    emergencyLane = lanes[
        Math.floor(Math.random() * lanes.length)
    ];

    // Ensure the emergency approach has a vehicle
    queues[emergencyLane] = Math.max(
        queues[emergencyLane],
        1
    );

    log(`Emergency vehicle detected on ${directions[emergencyLane]}.`);

    $("decisionText").textContent =
        `Emergency vehicle detected on ${directions[emergencyLane]}. Priority requested.`;

    updateDashboard();
});

$("adaptiveBtn").addEventListener("click", () => {
    mode = "adaptive";

    $("adaptiveBtn").classList.add("selected");
    $("fixedBtn").classList.remove("selected");

    log("Adaptive traffic control activated.");

    $("decisionText").textContent =
        "AI will select the busiest eligible lane.";

    updateDashboard();
});

$("fixedBtn").addEventListener("click", () => {
    mode = "fixed";

    $("fixedBtn").classList.add("selected");
    $("adaptiveBtn").classList.remove("selected");

    log("Fixed-time traffic control activated.");

    $("decisionText").textContent =
        "Each road receives a fixed green duration.";

    updateDashboard();
});

$("resetBtn").addEventListener("click", () => {
    pauseSimulation();

    queues = { ...initialQueues };
    currentLane = "N";
    clearedVehicles = 0;
    emergencyLane = null;
    timer = 12;
    phaseDuration = 12;

    $("activityLog").innerHTML = "";

    log("Simulation reset.");

    updateDashboard();
});

log("TRAFFICMIND AI initialized.");
log("Traffic density monitoring started.");

updateDashboard();
