
const DIRECTIONS = ["N", "E", "S", "W"];

const MIN_GREEN = 7;
const MAX_GREEN = 25;
const FIXED_GREEN = 15;

// Calculate adaptive green signal duration
export function calculateGreenTime(vehicleCount) {
    return Math.round(
        Math.min(
            MAX_GREEN,
            Math.max(MIN_GREEN, 7 + vehicleCount * 1.4)
        )
    );
}

// Calculate priority using vehicle density and waiting time
export function calculatePriority(vehicleCount, waitingTime) {
    return (vehicleCount * 2) + (waitingTime * 0.15);
}

// Select the next road
export function selectNextLane(
    queues,
    currentLane,
    emergencyLane = null,
    waitingTimes = {}
) {
    // Emergency vehicle receives priority
    if (emergencyLane && DIRECTIONS.includes(emergencyLane)) {
        return emergencyLane;
    }

    const candidates = DIRECTIONS.filter(
        direction => direction !== currentLane
    );

    candidates.sort((a, b) => {
        const scoreA = calculatePriority(
            queues[a] || 0,
            waitingTimes[a] || 0
        );

        const scoreB = calculatePriority(
            queues[b] || 0,
            waitingTimes[b] || 0
        );

        return scoreB - scoreA;
    });

    return candidates[0];
}

// Main adaptive traffic decision engine
export function getTrafficDecision(
    queues,
    currentLane,
    mode = "adaptive",
    emergencyLane = null,
    waitingTimes = {}
) {
    let nextLane;

    if (emergencyLane && DIRECTIONS.includes(emergencyLane)) {
        nextLane = emergencyLane;
    } else if (mode === "fixed") {
        const currentIndex = DIRECTIONS.indexOf(currentLane);

        nextLane = DIRECTIONS[
            (currentIndex + 1) % DIRECTIONS.length
        ];
    } else {
        nextLane = selectNextLane(
            queues,
            currentLane,
            null,
            waitingTimes
        );
    }

    const vehicleCount = queues[nextLane] || 0;

    const greenTime = mode === "fixed"
        ? FIXED_GREEN
        : calculateGreenTime(vehicleCount);

    const reason = emergencyLane === nextLane
        ? "Emergency priority activated."
        : `${vehicleCount} vehicles and ${
            waitingTimes[nextLane] || 0
        } seconds waiting on ${nextLane}.`;

    return {
        lane: nextLane,
        greenTime,
        vehicleCount,
        reason,
        mode
    };
}

// Calculate total traffic density
export function calculateDensity(queues) {
    const total = Object.values(queues).reduce(
        (sum, count) => sum + count,
        0
    );

    if (total < 15) return "Low";
    if (total < 35) return "Moderate";

    return "High";
}

// Generate traffic statistics
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
