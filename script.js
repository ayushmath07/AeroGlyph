// Drone Fleet Management System
const canvas = document.getElementById('droneCanvas');
const ctx = canvas.getContext('2d');

// Configuration
const DRONE_COUNT = 50;
const DRONE_SIZE = 8;
const TRANSITION_SPEED = 0.015;

// State
let drones = [];
let currentFormation = 'circle';
let batteryModeEnabled = false;
let simulationRunning = false;
let animationId = null;

// Initialize canvas size
function resizeCanvas() {
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Drone class
class Drone {
    constructor(id) {
        this.id = id;
        this.name = `Drone-${String(id + 1).padStart(2, '0')}`;
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.targetX = this.x;
        this.targetY = this.y;
        this.battery = Math.floor(Math.random() * 40) + 60; // Start with 60-100% battery
        this.baseAltitude = 0;
        this.altitude = 0;
        this.speed = 0;
        this.status = 'Armed';
        this.task = 'Idle';
        this.lastUpdate = 0;
        this.formationRow = 0;
    }

    getRandomTask() {
        const tasks = ['Patrol', 'Hover', 'Idle', 'Survey', 'Return'];
        return tasks[Math.floor(Math.random() * tasks.length)];
    }

    update() {
        // Smooth transition to target position
        const dx = this.targetX - this.x;
        const dy = this.targetY - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        this.x += dx * TRANSITION_SPEED;
        this.y += dy * TRANSITION_SPEED;

        // Calculate realistic speed based on movement
        if (distance > 1) {
            const pixelsPerFrame = distance * TRANSITION_SPEED;
            this.speed = Math.round(pixelsPerFrame * 3); // Convert to kph
            this.task = 'Moving';
        } else {
            this.speed = 0;
            this.task = 'Hover';
        }

        // Set altitude based on formation row/position
        this.altitude = this.baseAltitude;

        // Update simulation data
        if (simulationRunning) {
            this.lastUpdate++;

            // Battery drain - base rate + speed-based drain
            // Base: ~1% per 30 seconds, Speed: faster movement = faster drain
            const baseDrainChance = 0.0005; // ~1% per 30 seconds
            const speedDrainChance = (this.speed / 100) * 0.001; // Extra drain based on speed
            const totalDrainChance = baseDrainChance + speedDrainChance;
            
            if (Math.random() < totalDrainChance && this.battery > 0) {
                this.battery = Math.max(0, this.battery - 1);
            }

            // Update status based on battery
            this.status = this.battery > 20 ? 'Armed' : 'Disarmed';

            // Occasionally change task when hovering
            if (this.speed === 0 && Math.random() < 0.005) {
                const tasks = ['Patrol', 'Hover', 'Idle', 'Survey'];
                this.task = tasks[Math.floor(Math.random() * tasks.length)];
            }
        }
    }

    draw() {
        // Don't draw if off-screen (hidden drone)
        if (this.x < 0 || this.y < 0) return;
        
        let color;

        if (batteryModeEnabled) {
            // Battery color mode
            if (this.battery > 30) {
                color = '#6bcf7f'; // Green
            } else if (this.battery > 10) {
                color = '#ffe66d'; // Yellow
            } else {
                color = '#ff6b6b'; // Red
            }
        } else {
            // Formation color mode
            color = getFormationColor(currentFormation);
        }

        // Draw drone with cartoon style
        ctx.beginPath();
        ctx.arc(this.x, this.y, DRONE_SIZE, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        // Add black border
        ctx.strokeStyle = '#691e06';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Add highlight
        ctx.beginPath();
        ctx.arc(this.x - 2, this.y - 2, DRONE_SIZE * 0.3, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.fill();
    }

    setTarget(x, y) {
        this.targetX = x;
        this.targetY = y;
    }
}

// Formation color mapping
function getFormationColor(formation) {
    const colors = {
        circle: '#ca5310',
        square: '#bb4d00',
        heart: '#8f250c',
        star: '#ca5310',
        spiral: '#bb4d00',
        hello: '#8f250c'
    };
    return colors[formation] || '#ca5310';
}

// Formation generators
const formations = {
    circle: (index, total) => {
        const angle = (index / total) * Math.PI * 2;
        const radius = Math.min(canvas.width, canvas.height) * 0.35;
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        return {
            x: centerX + Math.cos(angle) * radius,
            y: centerY + Math.sin(angle) * radius
        };
    },

    square: (index, total) => {
        // Make a perfect 7x7 square (49 drones), hide the 50th
        const side = 7;
        if (index >= 49) {
            // Hide the 50th drone off-screen
            return { x: -100, y: -100 };
        }
        const size = Math.min(canvas.width, canvas.height) * 0.7;
        const spacing = size / (side - 1);
        const row = Math.floor(index / side);
        const col = index % side;
        const offsetX = (canvas.width - size) / 2;
        const offsetY = (canvas.height - size) / 2;
        return {
            x: offsetX + col * spacing,
            y: offsetY + row * spacing
        };
    },

    heart: (index, total) => {
        const t = (index / total) * Math.PI * 2;
        const scale = Math.min(canvas.width, canvas.height) * 0.028;
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const x = 16 * Math.pow(Math.sin(t), 3);
        const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
        return {
            x: centerX + x * scale,
            y: centerY + y * scale
        };
    },

    star: (index, total) => {
        const points = 5;
        const innerRadius = Math.min(canvas.width, canvas.height) * 0.15;
        const outerRadius = Math.min(canvas.width, canvas.height) * 0.3;
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;

        const anglePerPoint = (Math.PI * 2) / points;
        const pointIndex = Math.floor((index / total) * points * 2);
        const isOuter = pointIndex % 2 === 0;
        const radius = isOuter ? outerRadius : innerRadius;
        const angle = (pointIndex / 2) * anglePerPoint;
        const progress = ((index / total) * points * 2) % 1;

        const currentAngle = angle - Math.PI / 2;
        const nextAngle = currentAngle + anglePerPoint / 2;
        const currentRadius = isOuter ? outerRadius : innerRadius;
        const nextRadius = isOuter ? innerRadius : outerRadius;

        const finalAngle = currentAngle + (nextAngle - currentAngle) * progress;
        const finalRadius = currentRadius + (nextRadius - currentRadius) * progress;

        return {
            x: centerX + Math.cos(finalAngle) * finalRadius,
            y: centerY + Math.sin(finalAngle) * finalRadius
        };
    },

    spiral: (index, total) => {
        const turns = 3;
        const t = (index / total) * turns * Math.PI * 2;
        const radius = (index / total) * Math.min(canvas.width, canvas.height) * 0.4;
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        return {
            x: centerX + Math.cos(t) * radius,
            y: centerY + Math.sin(t) * radius
        };
    },

    hello: (index, total) => {
        const text = 'HELLO';
        const letterSpacing = Math.min(canvas.width, canvas.height) * 0.15;
        const totalWidth = (text.length - 1) * letterSpacing;
        const startX = (canvas.width - totalWidth) / 2;
        const centerY = canvas.height / 2;

        const letterPatterns = {
            'H': [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [1, 2], [2, 0], [2, 1], [2, 2], [2, 3], [2, 4]],
            'E': [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [1, 0], [1, 2], [1, 4], [2, 0], [2, 2], [2, 4]],
            'L': [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [1, 4], [2, 4]],
            'O': [[0, 1], [0, 2], [0, 3], [1, 0], [1, 4], [2, 1], [2, 2], [2, 3]]
        };

        let points = [];
        text.split('').forEach((letter, letterIndex) => {
            const pattern = letterPatterns[letter] || [];
            pattern.forEach(([x, y]) => {
                points.push({
                    x: startX + letterIndex * letterSpacing + x * 8,
                    y: centerY - 16 + y * 8
                });
            });
        });

        if (index < points.length) {
            return points[index];
        }

        // Extra drones form a circle around the text
        const extraIndex = index - points.length;
        const extraTotal = total - points.length;
        const angle = (extraIndex / extraTotal) * Math.PI * 2;
        const radius = Math.min(canvas.width, canvas.height) * 0.45;
        return {
            x: canvas.width / 2 + Math.cos(angle) * radius,
            y: canvas.height / 2 + Math.sin(angle) * radius
        };
    }
};

// Initialize drones
function initDrones() {
    drones = [];
    for (let i = 0; i < DRONE_COUNT; i++) {
        drones.push(new Drone(i));
    }
    updateFormation(currentFormation);
}

// Update formation
function updateFormation(formation) {
    currentFormation = formation;
    const formationFunc = formations[formation];

    drones.forEach((drone, index) => {
        const pos = formationFunc(index, DRONE_COUNT);
        drone.setTarget(pos.x, pos.y);

        // Set altitude based on formation type
        if (formation === 'square') {
            const side = 7;
            if (index >= 49) {
                drone.baseAltitude = 0; // Hidden drone
            } else {
                const row = Math.floor(index / side);
                drone.baseAltitude = 30 + (row * 10);
                drone.formationRow = row;
            }
        } else if (formation === 'circle') {
            const angle = (index / DRONE_COUNT) * Math.PI * 2;
            drone.baseAltitude = 40 + Math.floor(Math.sin(angle) * 20);
        } else if (formation === 'heart') {
            const t = (index / DRONE_COUNT) * Math.PI * 2;
            drone.baseAltitude = 35 + Math.floor(Math.abs(Math.sin(t)) * 25);
        } else if (formation === 'star') {
            const points = 5;
            const pointIndex = Math.floor((index / DRONE_COUNT) * points * 2);
            const isOuter = pointIndex % 2 === 0;
            drone.baseAltitude = isOuter ? 60 : 35;
        } else if (formation === 'spiral') {
            drone.baseAltitude = 20 + Math.floor((index / DRONE_COUNT) * 60);
        } else if (formation === 'hello') {
            const letterIndex = Math.floor(index / 10);
            drone.baseAltitude = 30 + (letterIndex * 8);
        }
    });
}

// Animation loop
function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drones.forEach(drone => {
        drone.update();
        drone.draw();
    });

    animationId = requestAnimationFrame(animate);
}

// Update drone table
function updateDroneTable() {
    const tbody = document.getElementById('droneTableBody');
    tbody.innerHTML = '';

    // Show all drones, not just first 20
    drones.forEach(drone => {
        const row = document.createElement('tr');
        const timeAgo = Math.floor(drone.lastUpdate / 60);

        row.innerHTML = `
            <td>${drone.name}</td>
            <td>${drone.battery}%</td>
            <td>${drone.altitude}m</td>
            <td>${drone.speed}kph</td>
            <td><span class="status-badge status-${drone.status.toLowerCase()}">${drone.status}</span></td>
            <td>${drone.task}</td>
            <td>${timeAgo}s ago</td>
        `;
        tbody.appendChild(row);
    });

    // Update fleet stats
    document.getElementById('totalDrones').textContent = DRONE_COUNT;
    document.getElementById('activeDrones').textContent = drones.filter(d => d.status === 'Armed').length;
    document.getElementById('lowBattery').textContent = drones.filter(d => d.battery < 30).length;
}

// Event listeners
document.querySelectorAll('.formation-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.formation-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        updateFormation(btn.dataset.formation);
    });
});

document.getElementById('batteryMode').addEventListener('click', (e) => {
    batteryModeEnabled = !batteryModeEnabled;
    e.target.textContent = `Battery Mode: ${batteryModeEnabled ? 'ON' : 'OFF'}`;
    e.target.classList.toggle('active', batteryModeEnabled);
});

document.getElementById('startStop').addEventListener('click', (e) => {
    simulationRunning = !simulationRunning;
    e.target.textContent = simulationRunning ? 'Pause Simulation' : 'Start Simulation';
});

document.getElementById('resetBtn').addEventListener('click', () => {
    // Reset battery for all drones
    drones.forEach(drone => {
        drone.battery = Math.floor(Math.random() * 40) + 60;
        drone.status = 'Armed';
        drone.lastUpdate = 0;
    });
    simulationRunning = false;
    document.getElementById('startStop').textContent = 'Start Simulation';
    updateDroneTable();
});

document.getElementById('sidebarToggle').addEventListener('click', () => {
    const sidebar = document.getElementById('sidebar');
    const arrow = document.querySelector('.arrow');
    sidebar.classList.toggle('closed');
    arrow.textContent = sidebar.classList.contains('closed') ? '◀' : '▶';
});

// Update table periodically
setInterval(updateDroneTable, 1000);

// Initialize
initDrones();
animate();
updateDroneTable();
