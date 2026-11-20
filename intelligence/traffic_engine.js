
const DIRECTIONS = ["N", "E", "S", "W"];

const MIN_GREEN = 7;
const MAX_GREEN = 25;
const FIXED_GREEN = 15;

// Calculate adaptive green duration
export function calculateGreenTime(vehicleCount) {
    return Math.min(
        MAX_GREEN,
        Math.max(MIN_GREEN, 7 + vehicleCount * 1.4)
    );
}

// Select the road with the highest vehicle density
export function selectNextLane(queues, currentLane, emergencyLane = null) {

    // Emergency vehicle receives priority
    if (emergencyLane && queues[emergencyLane] !== undefined) {
        return emergencyLane;
    }

    const candidates = DIRECTIONS.filter(
        direction => direction !== currentLane
    );

    candidates.sort((a, b) => queues[b] - queues[a]);

    return candidates[0];
}

// Main traffic decision engine
export function getTrafficDecision(
    queues,
    currentLane,
    mode = "adaptive",
    emergencyLane = null
) {
    const nextLane = selectNextLane(
        queues,
        currentLane,
        emergencyLane
    );

    const vehicleCount = queues[nextLane];

    const greenTime = mode === "fixed"
        ? FIXED_GREEN
        : calculateGreenTime(vehicleCount);

    let reason;

    if (emergencyLane === nextLane) {
        reason = "Emergency vehicle priority activated.";
    } else {
        reason = `${vehicleCount} vehicles detected on ${nextLane}.`;
    }

    return {
        lane: nextLane,
        greenTime,
        vehicleCount,
        reason,
        mode
    };
}

// Calculate overall traffic density
export function calculateDensity(queues) {
    const total = Object.values(queues).reduce(
        (sum, count) => sum + count,
        0
    );

    if (total < 15) return "Low";
    if (total < 35) return "Moderate";

    return "High";
}

// Get traffic statistics
export function getTrafficStatistics(queues) {
    const totalVehicles = Object.values(queues).reduce(
        (sum, count) => sum + count,
        0
    );

    const busiestLane = Object.keys(queues).reduce(
        (a, b) => queues[a] > queues[b] ? a : b
    );

    return {
        totalVehicles,
        busiestLane,
        busiestCount: queues[busiestLane],
        density: calculateDensity(queues)
    };
}
