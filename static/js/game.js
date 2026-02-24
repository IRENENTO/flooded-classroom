let currentLevel = 1;
let timeRemaining = 60;
let health = 100;
let waterLevel = 0;
let gameInterval;
let isGameActive = false;

// Fixed Audio Assets
const SOUNDS = {
    water: new Audio('https://assets.mixkit.co/active_storage/sfx/2004/2004-preview.mp3'),
    footsteps: new Audio('https://assets.mixkit.co/active_storage/sfx/28/28-preview.mp3'),
    alarm: new Audio('https://assets.mixkit.co/active_storage/sfx/951/951-preview.mp3')
};

function playSound(name, loop = false) {
    const s = SOUNDS[name];
    if (s) {
        s.loop = loop;
        s.play().catch(e => console.warn("Audio playback failed:", e));
    }
}

// Hint System
window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyH') {
        requestHint();
    }
});

async function requestHint() {
    try {
        const response = await fetch('/get_hint');
        const data = await response.json();
        
        if (response.status === 403) {
            showMessage(data.error);
        } else if (data.hint) {
            showMessage(`HINT: ${data.hint}`);
        }
    } catch (error) {
        console.error('Error fetching hint:', error);
    }
}

async function startGame() {
    playSound('water', true);
    try {
        const response = await fetch('/start_level', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ level: currentLevel })
        });
        const data = await response.json();

        if (data.status === 'started') {
            isGameActive = true;
            window.isPaused = false;
            document.getElementById('start-screen').style.display = 'none';
            document.getElementById('message-box').style.display = 'none';
            document.getElementById('level-num').innerText = currentLevel;
            
            // Get current student name
            const stateResp = await fetch('/update_state', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({}) });
            const stateData = await stateResp.json();
            document.getElementById('current-student').innerText = stateData.students[stateData.current_student_idx];

            if (typeof resetPlayerStyle === 'function') resetPlayerStyle();
            if (typeof createCharacters === 'function') createCharacters();
            if (typeof isWinSequenceActive !== 'undefined') isWinSequenceActive = false;
            updateLevelUI(data.config);
            startTimer();
            requestPointerLock();
        }
    } catch (error) {
        console.error('Error starting game:', error);
    }
}

function updateLevelUI(config) {
    document.getElementById('objective-title').innerText = `LEVEL ${currentLevel}`;
    document.getElementById('objective-text').innerText = config.objective;
    timeRemaining = config.time;
    updateHUD();
}

function startTimer() {
    clearInterval(gameInterval);
    gameInterval = setInterval(async () => {
        if (window.isPaused) return;

        timeRemaining--;
        if (typeof isWinSequenceActive === 'undefined' || !isWinSequenceActive) {
            waterLevel += (0.1 * currentLevel); 
        }
        
        if (currentLevel === 2 && waterLevel > 20) {
            health -= 0.5;
        }

        updateHUD();

        if (timeRemaining <= 0 || health <= 0 || waterLevel >= 100) {
            endGame(false);
        }

        if (timeRemaining % 5 === 0) {
            syncState();
        }
    }, 1000);
}

function updateHUD() {
    document.getElementById('timer').innerText = timeRemaining;
    document.getElementById('health-bar').style.width = `${health}%`;
    document.getElementById('water-bar').style.width = `${waterLevel}%`;
    
    if (waterLevel > 80) {
        playSound('alarm');
    }
    
    if (typeof updateWaterLevel === 'function') {
        updateWaterLevel(waterLevel);
    }
}

async function syncState() {
    await fetch('/update_state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ time_tick: true, water_increment: 0, health_change: 0 })
    });
}

async function performAction(target) {
    if (!isGameActive || window.isPaused) return;

    let action = 'pickup';
    const studentNames = ["Alex", "Blake", "Casey", "Drew", "Emery"];
    if (studentNames.includes(target) && currentLevel === 3) {
        action = 'save_student';
    } else if (target === 'Drain') {
        action = 'use_drain';
    }

    try {
        const response = await fetch('/interact', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: action, target: target })
        });
        const data = await response.json();

        if (data.result.message) {
            showMessage(data.result.message);
            if (data.result.escape) {
                endGame(true);
            }
            if (data.result.reveal_drain && typeof revealDrain === 'function') {
                revealDrain();
            }
        }
    } catch (error) {
        console.error('Error performing action:', error);
    }
}

function showMessage(text) {
    const msgBox = document.getElementById('message-box');
    document.getElementById('message-text').innerText = text;
    msgBox.style.display = 'block';
}

async function endGame(success) {
    isGameActive = false;
    clearInterval(gameInterval);
    document.exitPointerLock();
    SOUNDS.water.pause();
    
    const msgBox = document.getElementById('message-box');
    const msgText = document.getElementById('message-text');
    const nextBtn = document.getElementById('next-btn');
    const restartBtn = document.getElementById('restart-btn');

    if (!success && currentLevel === 1) {
        // Switch to next student turn
        const turnResp = await fetch('/next_turn', { method: 'POST' });
        const turnData = await turnResp.json();
        
        if (turnData.game_state.students && turnData.game_state.students.length > 0) {
            const nextStudent = turnData.game_state.students[turnData.game_state.current_student_idx];
            msgText.innerText = `Turn Failed! Now it's ${nextStudent}'s turn.`;
            restartBtn.innerText = "Next Student";
            restartBtn.style.display = 'inline-block';
        } else {
            msgText.innerText = "ALL STUDENTS FAILED! GAME OVER!";
            restartBtn.innerText = "Retry Level";
            restartBtn.style.display = 'inline-block';
            currentLevel = 1; // Reset to level 1
            // We should probably reset the whole state on the server too, but location.reload() might be enough if we use /start_level
        }
    } else if (success) {
        msgText.innerText = `LEVEL ${currentLevel} COMPLETE!`;
        nextBtn.style.display = 'inline-block';
        restartBtn.style.display = 'none';
        if (typeof triggerWinSequence === 'function') triggerWinSequence();
    } else {
        msgText.innerText = "GAME OVER! You failed to escape.";
        nextBtn.style.display = 'none';
        restartBtn.style.display = 'inline-block';
        restartBtn.innerText = "Retry";
    }
    msgBox.style.display = 'block';
}

async function goToNextLevel() {
    const response = await fetch('/next_level', { method: 'POST' });
    const data = await response.json();
    
    if (data.status === 'progressing') {
        currentLevel = data.next_level;
        document.getElementById('next-btn').style.display = 'none';
        startGame();
    } else {
        showMessage("CONGRATULATIONS! You escaped the school!");
    }
}

function togglePause() {
    if (typeof window.togglePause === 'function') {
        window.togglePause();
    }
}

function restartLevel() {
    location.reload();
}

function requestPointerLock() {
    const canvas = document.querySelector('canvas');
    if (canvas) canvas.requestPointerLock();
}
