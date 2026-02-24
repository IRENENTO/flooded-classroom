const TEXTURES = {
    floor: 'https://threejs.org/examples/textures/hardwood2_diffuse.jpg',
    wall: 'https://threejs.org/examples/textures/brick_diffuse.jpg',
    door: 'https://threejs.org/examples/textures/crate.gif'
};

const SETTINGS = {
    moveSpeed: 0.1,
    runMultiplier: 2.0,
    jumpForce: 0.15,
    mouseSensitivity: 0.002,
    gravity: 0.005,
    playerHeight: 1.8,
    crouchHeight: 1.0
};

let scene, camera, renderer, waterBox, player;
let pitchObject;
let yawObject;
let textureLoader;
const keys = {};
window.isPaused = false;
let moveVelocity;
let isGrounded = true;
let canInteractWith = null;
let droplets = [];
let classroomDoor = null;
let studentsGroup;
let hazardsGroup = new THREE.Group();
let isWinSequenceActive = false;

function init3D() {
    if (typeof THREE === 'undefined') {
        console.error('Three.js not loaded!');
        return;
    }

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x221100);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    
    textureLoader = new THREE.TextureLoader();
    moveVelocity = new THREE.Vector3();
    studentsGroup = new THREE.Group();

    // Third-Person Camera Setup
    yawObject = new THREE.Object3D();
    pitchObject = new THREE.Object3D();
    
    // Add player model to the yawObject so we can see it
    const playerModel = createCharacterModel("Player_Model");
    yawObject.add(playerModel);
    
    // Position camera behind and above the player
    camera.position.set(0, 3, 5); 
    camera.lookAt(0, 1, 0);
    pitchObject.add(camera);
    yawObject.add(pitchObject);
    
    yawObject.position.set(0, 0, 0); // Start in the middle of the room
    scene.add(yawObject);
    player = yawObject;

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    const canvasContainer = document.getElementById('threejs-canvas');
    if (canvasContainer) {
        canvasContainer.appendChild(renderer.domElement);
    } else {
        console.error('Canvas container not found!');
        document.body.appendChild(renderer.domElement);
    }

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    
    const pointLight1 = new THREE.PointLight(0xffffff, 0.5);
    pointLight1.position.set(5, 8, 5);
    scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0xffffff, 0.5);
    pointLight2.position.set(-5, 8, -5);
    scene.add(pointLight2);

    createClassroom();
    createCharacters();
    createWaterSystem();
    scene.add(hazardsGroup);

    setupInput();
    animate();
}

function setupInput() {
    window.addEventListener('keydown', (e) => {
        keys[e.code] = true;
        if (e.code === 'KeyE' || e.code === 'KeyT') handleInteraction();
        if (e.code === 'Escape') togglePause();
    });
    window.addEventListener('keyup', (e) => keys[e.code] = false);

    document.addEventListener('mousemove', (e) => {
        if (window.isPaused || !document.pointerLockElement) return;

        yawObject.rotation.y -= e.movementX * SETTINGS.mouseSensitivity;
        pitchObject.rotation.x -= e.movementY * SETTINGS.mouseSensitivity;
        pitchObject.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitchObject.rotation.x));
    });

    renderer.domElement.addEventListener('click', () => {
        if (!window.isPaused) renderer.domElement.requestPointerLock();
    });
}

function createClassroom() {
    // Main Building Floor (Large Plaza)
    const buildingFloorGeo = new THREE.PlaneGeometry(100, 100);
    const buildingFloorMat = new THREE.MeshPhongMaterial({ color: 0x222222 });
    const buildingFloor = new THREE.Mesh(buildingFloorGeo, buildingFloorMat);
    buildingFloor.rotation.x = -Math.PI / 2;
    buildingFloor.position.y = -0.01;
    scene.add(buildingFloor);

    // Classroom Floor (Tiles)
    const floorGeo = new THREE.PlaneGeometry(20, 20);
    const floorMat = new THREE.MeshPhongMaterial({ 
        color: 0xaaaaaa, // Light grey for tiles
        side: THREE.DoubleSide
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    // Add a Grid for Tiled Effect
    const grid = new THREE.GridHelper(20, 20, 0x444444, 0x888888);
    grid.position.y = 0.01;
    scene.add(grid);

    // Ceiling
    const ceilingGeo = new THREE.PlaneGeometry(20, 20);
    const ceilingMat = new THREE.MeshPhongMaterial({ color: 0xeeeeee, side: THREE.DoubleSide });
    const ceiling = new THREE.Mesh(ceilingGeo, ceilingMat);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = 10;
    scene.add(ceiling);

    // Walls (Brick Red)
    const wallMat = new THREE.MeshPhongMaterial({ 
        color: 0x8b0000, // Dark Brick Red
        side: THREE.DoubleSide 
    });
    
    // Back Wall
    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(20, 10), wallMat);
    backWall.position.set(0, 5, -10);
    scene.add(backWall);

    // Side Walls
    const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(20, 10), wallMat);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.position.set(-10, 5, 0);
    scene.add(leftWall);

    const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(20, 10), wallMat);
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.position.set(10, 5, 0);
    scene.add(rightWall);

    const frontWall = new THREE.Mesh(new THREE.PlaneGeometry(20, 10), wallMat);
    frontWall.rotation.y = Math.PI;
    frontWall.position.set(0, 5, 10);
    scene.add(frontWall);

    // Add Windows
    for (let i = -1; i <= 1; i++) {
        const winGeo = new THREE.PlaneGeometry(3, 4);
        const winMat = new THREE.MeshPhongMaterial({ color: 0xadd8e6, transparent: true, opacity: 0.6 });
        const leftWin = new THREE.Mesh(winGeo, winMat);
        leftWin.position.set(-9.9, 6, i * 6);
        leftWin.rotation.y = Math.PI / 2;
        scene.add(leftWin);

        const rightWin = new THREE.Mesh(winGeo, winMat);
        rightWin.position.set(9.9, 6, i * 6);
        rightWin.rotation.y = -Math.PI / 2;
        scene.add(rightWin);
    }

    // Door (Repositioned and Bright Yellow)
    const doorGroup = new THREE.Group();
    const doorGeo = new THREE.BoxGeometry(0.3, 6, 3); // Thicker door
    const doorMat = new THREE.MeshPhongMaterial({ color: 0xffff00 }); // BRIGHT YELLOW
    const doorMesh = new THREE.Mesh(doorGeo, doorMat);
    doorMesh.position.y = 3;
    doorGroup.add(doorMesh);
    
    // Door Handle
    const handle = new THREE.Mesh(new THREE.SphereGeometry(0.1), new THREE.MeshPhongMaterial({ color: 0x000000 }));
    handle.position.set(0.2, 3, 1);
    doorGroup.add(handle);

    // EXIT Sign
    const signGeo = new THREE.PlaneGeometry(2, 0.8);
    const signMat = new THREE.MeshPhongMaterial({ color: 0x00ff00 }); // GREEN SIGN
    const sign = new THREE.Mesh(signGeo, signMat);
    sign.position.set(0.2, 6.5, 0);
    sign.rotation.y = Math.PI / 2;
    doorGroup.add(sign);

    doorGroup.position.set(-9.8, 0, -5); 
    doorGroup.name = "ClassroomDoor";
    classroomDoor = doorGroup;
    scene.add(doorGroup);

    // Projector and Screen
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(8, 5), new THREE.MeshPhongMaterial({ color: 0xeeeeee }));
    screen.position.set(0, 7, -9.8);
    scene.add(screen);

    const projector = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.4, 0.8), new THREE.MeshPhongMaterial({ color: 0x333333 }));
    projector.position.set(0, 9, 0);
    scene.add(projector);

    // CCTV Camera
    const cctv = new THREE.Mesh(new THREE.SphereGeometry(0.2), new THREE.MeshPhongMaterial({ color: 0x000000 }));
    cctv.position.set(9.5, 9.5, -9.5);
    scene.add(cctv);

    // Decorations: Flowers on Teacher Desk
    const tDesk = new THREE.Mesh(new THREE.BoxGeometry(4, 1, 2), new THREE.MeshPhongMaterial({ color: 0x5c4033 }));
    tDesk.position.set(0, 0.5, -8);
    tDesk.name = "TeacherDesk";
    scene.add(tDesk);

    const desktop = createDesktop();
    desktop.position.set(-1, 1, -8);
    scene.add(desktop);

    const tBook = createBook();
    tBook.position.set(1, 1.05, -7.5);
    scene.add(tBook);

    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.15, 0.3), new THREE.MeshPhongMaterial({ color: 0x8b4513 }));
    pot.position.set(1.5, 1.15, -8.5);
    scene.add(pot);
    const flower = new THREE.Mesh(new THREE.SphereGeometry(0.15), new THREE.MeshPhongMaterial({ color: 0xff00ff }));
    flower.position.set(1.5, 1.4, -8);
    scene.add(flower);

    // Artificial Trees in Corners
    const treePos = [[-9, -9], [9, -9]];
    treePos.forEach(pos => {
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 2), new THREE.MeshPhongMaterial({ color: 0x442211 }));
        trunk.position.set(pos[0], 1, pos[1]);
        scene.add(trunk);
        const leaves = new THREE.Mesh(new THREE.ConeGeometry(1, 3, 8), new THREE.MeshPhongMaterial({ color: 0x228b22 }));
        leaves.position.set(pos[0], 3, pos[1]);
        scene.add(leaves);
    });

    // Board
    const board = new THREE.Mesh(new THREE.PlaneGeometry(10, 5), new THREE.MeshPhongMaterial({ color: 0x113311 }));
    board.position.set(0, 4, -9.9);
    scene.add(board);

    // Bookshelf (Required for Level 1 and 4)
    const bookshelf = new THREE.Mesh(new THREE.BoxGeometry(4, 6, 1), new THREE.MeshPhongMaterial({ color: 0x4b3621 }));
    bookshelf.position.set(8, 3, -9);
    bookshelf.name = "Bookshelf";
    scene.add(bookshelf);

    // Desks and Chairs
    let deskCount = 1;
    for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 2; col++) {
            createDeskAndChair(-4 + col * 8, -6 + row * 3.5, `Desk ${deskCount++}`);
        }
    }
}

function createLaptop() {
    const group = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.05, 0.6), new THREE.MeshPhongMaterial({ color: 0x333333 }));
    group.add(base);
    const screen = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.05), new THREE.MeshPhongMaterial({ color: 0x111111 }));
    screen.position.set(0, 0.3, -0.3);
    screen.rotation.x = -Math.PI / 10;
    group.add(screen);
    return group;
}

function createDesktop() {
    const group = new THREE.Group();
    const monitor = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 0.1), new THREE.MeshPhongMaterial({ color: 0x222222 }));
    monitor.position.y = 0.6;
    group.add(monitor);
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.4), new THREE.MeshPhongMaterial({ color: 0x555555 }));
    stand.position.y = 0.2;
    group.add(stand);
    const keyboard = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.02, 0.3), new THREE.MeshPhongMaterial({ color: 0x111111 }));
    keyboard.position.set(0, 0.01, 0.5);
    group.add(keyboard);
    return group;
}

function createBook() {
    const colors = [0xff0000, 0x0000ff, 0x00ff00, 0xffff00];
    const group = new THREE.Group();
    const cover = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.08, 0.5), new THREE.MeshPhongMaterial({ color: colors[Math.floor(Math.random() * colors.length)] }));
    group.add(cover);
    const pages = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.06, 0.48), new THREE.MeshPhongMaterial({ color: 0xffffff }));
    pages.position.y = 0.01;
    group.add(pages);
    return group;
}

function createPen() {
    const pen = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.2), new THREE.MeshPhongMaterial({ color: 0x000000 }));
    pen.rotation.z = Math.PI / 2;
    return pen;
}

function createDeskAndChair(x, z, name) {
    const desk = new THREE.Mesh(new THREE.BoxGeometry(2.5, 1, 1.2), new THREE.MeshPhongMaterial({ color: 0x8B4513 }));
    desk.position.set(x, 0.5, z);
    desk.name = name;
    scene.add(desk);

    const chair = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.8), new THREE.MeshPhongMaterial({ color: 0x442211 }));
    chair.position.set(x, 0.25, z + 1.5);
    scene.add(chair);

    // Add School Bag next to the desk
    const bag = createBag();
    bag.position.set(1, -0.3, 0.5);
    desk.add(bag);

    // Randomly add laptop or book/pen
    if (Math.random() > 0.5) {
        const laptop = createLaptop();
        laptop.position.set(0, 0.525, 0);
        desk.add(laptop);
    } else {
        const book = createBook();
        book.position.set(-0.4, 0.55, 0);
        book.rotation.y = Math.random() * 0.5;
        desk.add(book);
        const pen = createPen();
        pen.position.set(0.2, 0.55, 0.2);
        desk.add(pen);
    }
}

function createBag() {
    const group = new THREE.Group();
    const bagColor = Math.random() * 0xffffff;
    
    // Main bag body
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.2), new THREE.MeshPhongMaterial({ color: bagColor }));
    body.position.y = 0.3;
    group.add(body);
    
    // Front pocket
    const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.3, 0.1), new THREE.MeshPhongMaterial({ color: bagColor }));
    pocket.position.set(0, 0.2, 0.1);
    group.add(pocket);
    
    // Straps
    const strapGeo = new THREE.BoxGeometry(0.05, 0.4, 0.05);
    const leftStrap = new THREE.Mesh(strapGeo, new THREE.MeshPhongMaterial({ color: 0x222222 }));
    leftStrap.position.set(-0.15, 0.4, -0.1);
    group.add(leftStrap);
    
    const rightStrap = new THREE.Mesh(strapGeo, new THREE.MeshPhongMaterial({ color: 0x222222 }));
    rightStrap.position.set(0.15, 0.4, -0.1);
    group.add(rightStrap);
    
    return group;
}

async function createCharacters() {
    scene.add(studentsGroup);
    
    try {
        const response = await fetch('/update_state', { 
            method: 'POST', 
            headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify({}) 
        });
        const state = await response.json();
        const students = state.students;
        
        // Clear existing students
        while(studentsGroup.children.length > 0){ 
            studentsGroup.remove(studentsGroup.children[0]); 
        }
        
        // Full list of names to maintain consistent positions
        const allNames = ["Alex", "Blake", "Casey", "Drew", "Emery"];
        
        // Position students at desks only if they are still in the rotation
        allNames.forEach((name, i) => {
            if (students.includes(name)) {
                const char = createCharacterModel(name);
                const row = Math.floor(i / 2);
                const col = i % 2;
                const x = -4 + col * 8;
                const z = -6 + row * 3.5;
                
                char.position.set(x, -0.2, z + 1.5); // Sitting position
                char.rotation.y = Math.PI; // Face the desk
                studentsGroup.add(char);
            }
        });
    } catch (e) {
        console.error("Error creating characters:", e);
    }

    // Add Lecturer if not already there
    if (!scene.getObjectByName("Lecturer")) {
        const lecturer = createCharacterModel("Lecturer");
        lecturer.position.set(-1, 0, -6.5);
        lecturer.name = "Lecturer";
        scene.add(lecturer);
    }
}

function createCharacterModel(name) {
    const group = new THREE.Group();
    const skinColor = 0x8D5524;
    const clothingColor = Math.random() * 0xffffff;

    // Torso
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, 0.3), new THREE.MeshPhongMaterial({ color: clothingColor }));
    torso.position.y = 1.05;
    group.add(torso);

    // Head
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.35), new THREE.MeshPhongMaterial({ color: skinColor }));
    head.position.y = 1.55;
    group.add(head);

    // Legs
    const legGeo = new THREE.BoxGeometry(0.2, 0.7, 0.2);
    const legMat = new THREE.MeshPhongMaterial({ color: 0x333333 });
    
    const leftLeg = new THREE.Mesh(legGeo, legMat);
    leftLeg.position.set(-0.15, 0.35, 0);
    group.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, legMat);
    rightLeg.position.set(0.15, 0.35, 0);
    group.add(rightLeg);

    // Arms
    const armGeo = new THREE.BoxGeometry(0.15, 0.6, 0.15);
    const leftArm = new THREE.Mesh(armGeo, new THREE.MeshPhongMaterial({ color: clothingColor }));
    leftArm.position.set(-0.4, 1.1, 0);
    group.add(leftArm);

    const rightArm = new THREE.Mesh(armGeo, new THREE.MeshPhongMaterial({ color: clothingColor }));
    rightArm.position.set(0.4, 1.1, 0);
    group.add(rightArm);

    group.name = name;
    return group;
}

function createWaterSystem() {
    const waterGeo = new THREE.BoxGeometry(20, 1, 20);
    const waterMat = new THREE.MeshPhongMaterial({ color: 0x0077ff, transparent: true, opacity: 0.6 });
    waterBox = new THREE.Mesh(waterGeo, waterMat);
    waterBox.position.y = -0.5;
    scene.add(waterBox);

    // Pipe in corner
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 10), new THREE.MeshPhongMaterial({ color: 0x777777 }));
    pipe.position.set(-9.5, 5, -9.5);
    scene.add(pipe);
}

function createHazards() {
    hazardsGroup.clear();
    if (typeof currentLevel !== 'undefined' && currentLevel === 2) {
        for (let i = 0; i < 5; i++) {
            const hazardGeo = new THREE.CircleGeometry(2, 32);
            const hazardMat = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.4 });
            const hazard = new THREE.Mesh(hazardGeo, hazardMat);
            hazard.rotation.x = -Math.PI / 2;
            hazard.position.set(Math.random() * 16 - 8, 0.02, Math.random() * 16 - 8);
            hazardsGroup.add(hazard);
        }
    }
}

function animate() {
    requestAnimationFrame(animate);
    if (window.isPaused) return;

    handleMovement();
    checkInteractions();
    
    // Level 2 Hazard Check
    if (typeof currentLevel !== 'undefined' && currentLevel === 2 && hazardsGroup.children.length > 0) {
        hazardsGroup.children.forEach(hazard => {
            const dist = new THREE.Vector2(yawObject.position.x - hazard.position.x, yawObject.position.z - hazard.position.z).length();
            if (dist < 2) {
                // Flash Red and damage health
                renderer.setClearColor(0x550000, 1);
                setTimeout(() => renderer.setClearColor(0x221100, 1), 50);
                
                fetch('/update_state', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ health_change: -0.5 })
                });
            }
        });
    }

    // Water rise logic (client side simulation)
    if (!isWinSequenceActive && waterBox && waterBox.scale && waterBox.position.y < 5) {
        waterBox.scale.y += 0.0005;
        waterBox.position.y = (waterBox.scale.y / 2) - 0.5;
    }

    // Droplets logic
    if (!isWinSequenceActive && Math.random() < 0.1) {
        const dropGeo = new THREE.SphereGeometry(0.05);
        const dropMat = new THREE.MeshPhongMaterial({ color: 0x0077ff });
        const drop = new THREE.Mesh(dropGeo, dropMat);
        drop.position.set(-9.5, 9, -9.5);
        scene.add(drop);
        droplets.push(drop);
    }

    for (let i = droplets.length - 1; i >= 0; i--) {
        droplets[i].position.y -= 0.1;
        if (droplets[i].position.y < (waterBox ? waterBox.position.y + waterBox.scale.y / 2 : 0)) {
            scene.remove(droplets[i]);
            droplets.splice(i, 1);
        }
    }

    renderer.render(scene, camera);
}

function handleMovement() {
    let speed = SETTINGS.moveSpeed;
    if (keys['ShiftLeft']) speed *= SETTINGS.runMultiplier;
    
    const playerModel = yawObject.children.find(c => c.name === "Player_Model");
    
    if (keys['ControlLeft']) {
        speed *= 0.5;
        if (playerModel) playerModel.scale.y = THREE.MathUtils.lerp(playerModel.scale.y, 0.6, 0.1);
    } else {
        if (playerModel) playerModel.scale.y = THREE.MathUtils.lerp(playerModel.scale.y, 1.0, 0.1);
    }

    const direction = new THREE.Vector3();
    if (keys['KeyW'] || keys['ArrowUp']) direction.z -= 1;
    if (keys['KeyS'] || keys['ArrowDown']) direction.z += 1;
    if (keys['KeyA'] || keys['ArrowLeft']) direction.x -= 1;
    if (keys['KeyD'] || keys['ArrowRight']) direction.x += 1;

    if (direction.length() > 0) {
        direction.normalize().applyQuaternion(yawObject.quaternion);
        moveVelocity.x = direction.x * speed;
        moveVelocity.z = direction.z * speed;
        
        // Footsteps sound trigger
        if (isGrounded && Math.random() < 0.05 && typeof playSound === 'function') {
            playSound('footsteps');
        }
    } else {
        moveVelocity.x *= 0.9; // Friction
        moveVelocity.z *= 0.9;
    }

    // Jump
    if (keys['Space'] && isGrounded) {
        moveVelocity.y = SETTINGS.jumpForce;
        isGrounded = false;
    }

    // Gravity
    if (!isGrounded) {
        moveVelocity.y -= SETTINGS.gravity;
        if (yawObject.position.y + moveVelocity.y <= SETTINGS.playerHeight && !keys['ControlLeft']) {
            moveVelocity.y = 0;
            isGrounded = true;
        }
    }

    yawObject.position.add(moveVelocity);
    
    // Bounds
    yawObject.position.x = Math.max(-9.5, Math.min(9.5, yawObject.position.x));
    yawObject.position.z = Math.max(-9.5, Math.min(9.5, yawObject.position.z));
}

function checkInteractions() {
    if (!camera || !scene) return;
    const raycaster = new THREE.Raycaster();
    
    // Use camera position and direction
    const worldPos = new THREE.Vector3();
    camera.getWorldPosition(worldPos);
    const worldDir = new THREE.Vector3();
    camera.getWorldDirection(worldDir);
    
    raycaster.set(worldPos, worldDir);
    
    // Intersect everything but filter out the player
    const allIntersects = raycaster.intersectObjects(scene.children, true);
    const intersects = allIntersects.filter(i => {
        let obj = i.object;
        while (obj) {
            if (obj.name === "Player_Model" || obj === yawObject) return false;
            obj = obj.parent;
        }
        return true;
    });

    const prompt = document.getElementById('interaction-prompt');
    
    // Distance increased because camera is offset behind player
    if (intersects.length > 0 && intersects[0].distance < 10) {
        let obj = intersects[0].object;
        // Search up the hierarchy for a named object
        let interactionName = obj.name;
        while (!interactionName && obj.parent) {
            obj = obj.parent;
            interactionName = obj.name;
        }

        const studentNames = ["Alex", "Blake", "Casey", "Drew", "Emery"];
        if (studentNames.includes(interactionName)) {
            if (typeof currentLevel !== 'undefined' && currentLevel === 3) {
                canInteractWith = interactionName;
                prompt.style.display = 'block';
                document.getElementById('interact-action').innerText = "save student";
                return;
            } else {
                const index = studentNames.indexOf(interactionName);
                interactionName = `Desk ${index + 1}`;
            }
        }

        const validObjects = ['Desk', 'Bookshelf', 'ClassroomDoor', 'Drain'];
        if (interactionName && (validObjects.some(vo => interactionName.includes(vo)))) {
            canInteractWith = interactionName;
            prompt.style.display = 'block';
            let actionText = "search / interact";
            if (interactionName === 'ClassroomDoor') actionText = "open door";
            if (interactionName === 'Drain') actionText = "use drain";
            document.getElementById('interact-action').innerText = actionText;
            return;
        }
    }
    
    canInteractWith = null;
    prompt.style.display = 'none';
}

function handleInteraction() {
    if (canInteractWith) {
        console.log("Interacting with:", canInteractWith);
        performAction(canInteractWith);
    }
}

function togglePause() {
    window.isPaused = !window.isPaused;
    document.getElementById('pause-menu').style.display = window.isPaused ? 'block' : 'none';
    if (window.isPaused) document.exitPointerLock();
}

function updateWaterLevel(percentage) {
    if (!waterBox) return;
    const targetHeight = (percentage / 100) * 8;
    waterBox.scale.y = targetHeight + 0.1;
    waterBox.position.y = (targetHeight / 2) - 0.5;
}

function triggerWinSequence() {
    isWinSequenceActive = true;
    
    // Open Door
    if (classroomDoor) {
        // Rotate around its edge
        classroomDoor.rotation.y = Math.PI / 2;
    }
    
    // Characters exit
    studentsGroup.children.forEach((child, i) => {
        setTimeout(() => {
            const exitInterval = setInterval(() => {
                // Move towards the door at (-9.9, 0, -5)
                child.position.x = THREE.MathUtils.lerp(child.position.x, -11, 0.05); 
                child.position.z = THREE.MathUtils.lerp(child.position.z, -5, 0.05);
                
                // Once close to the wall/door, they disappear
                if (child.position.x < -9.5) {
                    clearInterval(exitInterval);
                    scene.remove(child);
                }
            }, 16);
        }, i * 300); 
    });
}

function resetPlayerStyle() {
    fetch('/update_state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
    })
    .then(r => r.json())
    .then(state => {
        const playerModel = yawObject.children.find(c => c.name === "Player_Model");
        if (playerModel) {
            const studentIdx = state.current_student_idx;
            const colors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff, 0xffa500, 0x800080, 0x008000, 0x000080];
            const newColor = colors[studentIdx % colors.length];

            // Update Torso and Arms color
            playerModel.children.forEach(child => {
                if (child.material && child.geometry.type === "BoxGeometry") {
                    // Head and Legs shouldn't change to the clothing color
                    if (child.position.y > 0.8 && child.position.y < 1.5) {
                         child.material.color.setHex(newColor);
                    }
                }
            });
            
            // Also change scale slightly to differentiate
            const scales = [1.0, 1.1, 0.9, 1.05, 0.95, 1.1, 0.85, 1.0, 1.2, 0.9];
            playerModel.scale.setScalar(scales[studentIdx % scales.length]);
        }
    });
}

window.addEventListener('resize', () => {
    if (camera && renderer) {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }
});

document.addEventListener('DOMContentLoaded', init3D);
