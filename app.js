const firebaseConfig = {
    apiKey: "AIzaSyBVP3ZOpwIh5rtCFLufaQCI3JLVNEgWUhI",
    authDomain: "healthpetapp-8f789.firebaseapp.com",
    databaseURL: "https://healthpetapp-8f789-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "healthpetapp-8f789",
    storageBucket: "healthpetapp-8f789.firebasestorage.app",
    messagingSenderId: "843879413986",
    appId: "1:843879413986:web:f4c4acdf0fdf04f5cc06bb",
    measurementId: "G-F0WL6577RB"
};
      
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.database();


// 2. DỮ LIỆU CỐ ĐỊNH & GAMIFICATION

const ZODIAC_ANIMALS = [
    { name: "Khỉ ", icon: "fa-cat" }, { name: "Gà ", icon: "fa-crow" },
    { name: "Chó ", icon: "fa-dog" }, { name: "Heo ", icon: "fa-piggy-bank" },
    { name: "Chuột ", icon: "fa-mouse" }, { name: "Trâu ", icon: "fa-hippo" },
    { name: "Hổ ", icon: "fa-cat" }, { name: "Mèo ", icon: "fa-cat" },
    { name: "Rồng ", icon: "fa-dragon" }, { name: "Rắn ", icon: "fa-worm" },
    { name: "Ngựa ", icon: "fa-horse" }, { name: "Dê ", icon: "fa-horse-head" }
];

// Bài tập được nâng cấp: Có XP và Level
// DANH SÁCH BÀI TẬP (Đã cập nhật mới)
const EXERCISES = [
    { 
        id: 'e1', type: 'cardio', name: "Chạy Nâng Cao Đùi", 
        xp: 15, time: 30, 
        desc: "Đứng thẳng, chạy tại chỗ và nâng đùi cao ngang hông, giữ nhịp thở đều.", 
        img: "https://media.giphy.com/media/l2JhvASuBqgC4c9fG/giphy.gif" 
    },
    { 
        id: 'e2', type: 'strength', name: "Chống Đẩy (Push-Up)", 
        xp: 20, time: 20, 
        desc: "Nằm sấp, chống tay, hạ thấp người đến khi ngực gần chạm đất rồi đẩy lên.", 
        img: "https://media.giphy.com/media/KHM1e9f1a0T8k/giphy.gif" 
    },
    { 
        id: 'e3', type: 'strength', name: "Squats & Lunges", 
        xp: 25, time: 40, 
        desc: "Kết hợp: Hạ người như ngồi ghế (Squat) + Bước chân gập gối (Lunge).", 
        img: "https://media.giphy.com/media/10HvUaG0nF93Bm/giphy.gif" 
    },
    { 
        id: 'e4', type: 'fullbody', name: "Plank & Biến Thể", 
        xp: 30, time: 45, 
        desc: "Chống khuỷu tay, siết cơ bụng, giữ thẳng lưng. Thử nghiêng người nếu được.", 
        img: "https://media.giphy.com/media/xT5LMyTvq0Kx2cCNMc/giphy.gif" 
    }
];

let currentUser = null;
let userData = {};
let timerInterval = null;
let currentEx = null;
// Biến quản lý Modal tập luyện để khóa/mở
let workoutModalInstance = null;
// Biến cho phần Test Sức Khỏe
let healthData = { visionScore: 0, pushups: 0, lungTime: 0 };
let currentVisionIndex = 0;
let lungInterval = null;
let lungStartTime = 0;
let isHoldingBreath = false;
const VISION_LEVELS = [
    { size: '80px', score: 2 }, { size: '50px', score: 4 }, 
    { size: '30px', score: 6 }, { size: '15px', score: 8 }, { size: '10px', score: 10 }
];

// 3. QUẢN LÝ ĐĂNG NHẬP

auth.onAuthStateChanged((user) => {
    if (user) {
        console.log("Logged in:", user.email);
        currentUser = user;
        document.getElementById('auth-screen').classList.add('d-none');
        document.getElementById('app-screen').classList.add('d-none');
        loadUserData();
    } else {
        console.log("No user");
        currentUser = null;
        document.getElementById('auth-screen').classList.remove('d-none');
        document.getElementById('app-screen').classList.add('d-none');
    }
});

const btnLogin = document.getElementById('google-login-btn');
if(btnLogin) btnLogin.addEventListener('click', () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch(e => alert("Lỗi: " + e.message));
});

const btnLogout = document.getElementById('logout-btn');
if(btnLogout) btnLogout.addEventListener('click', () => auth.signOut());

// 4. LOGIC DỮ LIỆU USER (LOAD & SAVE)

function loadUserData() {
    if (!currentUser) return;
    
    db.ref('users/' + currentUser.uid).once('value').then((snapshot) => {
        const data = snapshot.val();
        if (!data) {
            openSetupModal(true); 
        } else {
            userData = data;
            if(!userData.level) { 
                userData.level = 1; 
                userData.currentXP = 0; 
                userData.maxXP = 100; 
                userData.totalMinutes = 0; 
            }
            
            document.getElementById('app-screen').classList.remove('d-none');
            checkPenalty();
            renderUI();
            renderExercises();
        }
    }).catch(err => alert("Lỗi tải data: " + err.message));
}

function openSetupModal(isForce = false) {
    const modalEl = document.getElementById('setupModal');
    const closeBtn = document.getElementById('btn-close-setup');
    
    if (closeBtn) {
        closeBtn.style.display = isForce ? 'none' : 'block';
    }

    const options = isForce ? { backdrop: 'static', keyboard: false } : {};
    new bootstrap.Modal(modalEl, options).show();
}


function openEditProfile() {
    if (!userData) return;

    document.getElementById('inp-name').value = userData.name || "";
    document.getElementById('inp-year').value = userData.birthYear || "";
    document.getElementById('inp-height').value = (userData.height * 100) || ""; 
    document.getElementById('inp-weight').value = userData.startWeight || "";
    openSetupModal(false);
}

function saveUserProfile() {
    const name = document.getElementById('inp-name').value;
    const year = parseInt(document.getElementById('inp-year').value);
    const h = parseFloat(document.getElementById('inp-height').value) / 100; 
    const w = parseFloat(document.getElementById('inp-weight').value);

    if (!name || !year || !h || !w) { alert("Vui lòng nhập đủ!"); return; }

    const zodiacIndex = year % 12;
    const bmi = (w / (h * h)).toFixed(1);

    // CẬP NHẬT DỮ LIỆU
    userData = {
        ...userData, 
        
        name: name, 
        birthYear: year, 
        height: h, 
        startWeight: w, 
        bmi: bmi,
        petType: zodiacIndex,

        level: userData.level || 1, 
        currentXP: userData.currentXP || 0, 
        maxXP: userData.maxXP || 100,
        totalMinutes: userData.totalMinutes || 0,
        lastLogin: userData.lastLogin || Date.now(), 
        streak: userData.streak || 0
    };

    saveToDB();
    
    const modalEl = document.getElementById('setupModal');
    const modalInstance = bootstrap.Modal.getInstance(modalEl);
    if (modalInstance) modalInstance.hide();
    
    document.getElementById('app-screen').classList.remove('d-none');
    renderUI();
    renderExercises();
}

function saveToDB() {
    if(currentUser) db.ref('users/' + currentUser.uid).update(userData);
}

function checkPenalty() {
    const now = Date.now();
    const last = userData.lastLogin || now;
    const diffHours = (now - last) / (1000 * 60 * 60);

    // Nếu vắng quá 24h: Trừ XP
    if (diffHours > 24) {
        const daysMissed = Math.floor(diffHours / 24);
        const penaltyXP = daysMissed * 10;
        
        if (userData.currentXP > 0) {
            userData.currentXP = Math.max(0, userData.currentXP - penaltyXP);
            alert(`Vắng mặt ${daysMissed} ngày! Pet bị trừ ${penaltyXP} XP 😢`);
        }
        userData.streak = 0; 
        userData.lastLogin = now;
        saveToDB();
    }
}             

// 5. RENDER GIAO DIỆN (UI)

function renderUI() {
    if (!userData || userData.petType === undefined) return;
    const animal = ZODIAC_ANIMALS[userData.petType];
    
    // Thông tin cơ bản
    document.getElementById('pet-name-display').innerText = animal.name + ` (Level ${userData.level})`;
    document.getElementById('bmi-badge').innerText = `BMI: ${userData.bmi}`;
    document.getElementById('streak-days').innerText = userData.streak || 0;
    document.getElementById('total-minutes').innerText = userData.totalMinutes || 0;
    document.getElementById('user-weight').innerText = userData.startWeight;

    // Hiển thị Pet Icon & Status
    const iconEl = document.getElementById('pet-icon');
    const statusText = document.getElementById('pet-status-text');
    iconEl.className = `fas ${animal.icon} fa-6x`;
    
    // Thay đổi màu sắc/hiệu ứng theo Level
    if (userData.level >= 10) {
        iconEl.classList.add('text-warning'); // Vàng (Huyền thoại)
        statusText.innerText = "Trạng thái: Bậc Thầy Thể Hình";
    } else if (userData.level >= 5) {
        iconEl.classList.add('text-primary'); // Xanh (Chuyên nghiệp)
        statusText.innerText = "Trạng thái: Rất khỏe mạnh";
    } else {
        iconEl.classList.add('text-secondary'); // Xám (Tân thủ)
        statusText.innerText = "Trạng thái: Đang luyện tập...";
    }

    // Thanh XP
    document.getElementById('lvl-display').innerText = `LV.${userData.level}`;
    document.getElementById('xp-text').innerText = `${userData.currentXP}/${userData.maxXP} XP`;
    const xpPercent = (userData.currentXP / userData.maxXP) * 100;
    document.getElementById('xp-bar').style.width = `${xpPercent}%`;
}

function renderExercises() {
    const list = document.getElementById('exercise-list');
    list.innerHTML = "";
    
    EXERCISES.forEach(ex => {
        let badgeColor = 'bg-primary';
        if(ex.type === 'strength') badgeColor = 'bg-danger';
        if(ex.type === 'yoga') badgeColor = 'bg-info';

        list.innerHTML += `
            <div class="col-md-12">
                <div class="workout-card p-3 d-flex align-items-center" onclick="openWorkout('${ex.id}')">
                    <img src="${ex.img}" class="rounded-circle border" width="60" height="60" style="object-fit:cover; margin-right: 15px;">
                    <div class="flex-grow-1">
                        <h6 class="fw-bold mb-0">${ex.name}</h6>
                        <small class="text-muted">${ex.desc}</small>
                    </div>
                    <div class="text-end">
                        <span class="badge ${badgeColor} mb-1">+${ex.xp} XP</span><br>
                        <small class="fw-bold">${ex.time}s</small>
                    </div>
                </div>
            </div>
        `;
    });
}

// 6. LOGIC TẬP LUYỆN (WORKOUT)
// --- HÀM MỚI: Hiện bảng thông báo đẹp thay cho alert ---
function showRewardPopup(title, message) {
    document.getElementById('reward-title').innerText = title;
    document.getElementById('reward-msg').innerText = message;
    
    const modalEl = document.getElementById('rewardModal');
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
}

function openWorkout(id) {
    currentEx = EXERCISES.find(e => e.id === id);
    if(!currentEx) return;

    // 1. Điền thông tin vào Modal
    document.getElementById('ex-title').innerText = currentEx.name;
    document.getElementById('ex-desc').innerText = currentEx.desc;
    document.getElementById('ex-img').src = currentEx.img;
    document.getElementById('ex-badge').innerText = `Thưởng: +${currentEx.xp} XP`;
    
    // Reset đồng hồ hiển thị
    const display = document.getElementById('timer-display');
    display.innerText = `00:${currentEx.time}`;
    display.className = "display-1 fw-bold text-success my-3"; 

    // 2. Reset trạng thái nút bấm
    resetWorkoutButton();

    // 3. Mở Modal (Chế độ static: không tắt khi bấm ra ngoài)
    const modalEl = document.getElementById('workoutModal');
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl, { backdrop: 'static', keyboard: false });
    modal.show();
}

function resetWorkoutButton() {
    const btn = document.getElementById('btn-action');
    btn.innerText = "Bắt đầu tập";
    btn.className = "btn btn-primary btn-lg w-100 rounded-pill";
    btn.onclick = startTimer;
    btn.disabled = false;
}

function startTimer() {
    const btn = document.getElementById('btn-action');
    const display = document.getElementById('timer-display');
    let timeLeft = currentEx.time;

    // Đổi nút thành "Hủy"
    btn.innerText = "⛔ Dừng & Thoát (Không tính điểm)";
    btn.className = "btn btn-outline-danger btn-lg w-100 rounded-pill"; 
    btn.onclick = cancelWorkout;

    if(timerInterval) clearInterval(timerInterval);
    
    timerInterval = setInterval(() => {
        timeLeft--;
        display.innerText = `00:${timeLeft < 10 ? '0'+timeLeft : timeLeft}`;
        
        if(timeLeft < 10) {
            display.classList.remove('text-success');
            display.classList.add('text-danger');
        }

        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            finishWorkout();
        }
    }, 1000);
}

function cancelWorkout() {
    if(timerInterval) clearInterval(timerInterval);

    const confirmQuit = confirm("Bạn chưa tập xong! Thoát bây giờ sẽ không có điểm đâu 😢");
    
    if (confirmQuit) {
        const modalEl = document.getElementById('workoutModal');
        const modal = bootstrap.Modal.getInstance(modalEl);
        if(modal) modal.hide();
        resetWorkoutButton();
    } else {
        startTimer(); // Nếu không thoát thì đếm lại (hoặc giữ nguyên tùy logic)
    }
}

function finishWorkout() {
    if(timerInterval) clearInterval(timerInterval);

    // 1. Đóng Modal Bài tập trước
    const modalEl = document.getElementById('workoutModal');
    const modal = bootstrap.Modal.getInstance(modalEl);
    if(modal) modal.hide();

    resetWorkoutButton();

    // 2. Cộng thời gian & Điểm
    if(!userData.totalMinutes) userData.totalMinutes = 0;
    userData.totalMinutes += Math.ceil(currentEx.time / 60); 
    
    addXP(currentEx.xp); // Gọi hàm cộng điểm
    
    // Update Streak
    const now = new Date();
    const last = new Date(userData.lastLogin || 0);
    if(now.getDate() !== last.getDate()) {
        userData.streak = (userData.streak || 0) + 1;
    }
    userData.lastLogin = Date.now();

    saveToDB();
    renderUI();
    
    // 3. HIỆN BẢNG CHÚC MỪNG MỚI (Thay vì alert)
    // Dùng setTimeout nhỏ để modal cũ tắt hẳn thì modal mới hiện lên cho mượt
    setTimeout(() => {
        showRewardPopup("HOÀN THÀNH!", `Bạn vừa tập xong bài "${currentEx.name}"\nPhần thưởng: +${currentEx.xp} XP`);
    }, 300);
}

// --- HÀM CỘNG XP (QUAN TRỌNG: Đừng xóa hàm này) ---
function addXP(amount) {
    if (!userData.currentXP) userData.currentXP = 0;
    if (!userData.maxXP) userData.maxXP = 100;
    if (!userData.level) userData.level = 1;

    userData.currentXP += amount;

    // Logic lên cấp
    if(userData.currentXP >= userData.maxXP) {
        userData.currentXP = userData.currentXP - userData.maxXP;
        userData.level++;
        userData.maxXP = Math.floor(userData.maxXP * 1.2); 
        
        // Hiện thông báo Lên cấp (Sau thông báo tập luyện 1 chút)
        setTimeout(() => {
            showRewardPopup("LÊN CẤP ĐỘ MỚI! 🌟", `Chúc mừng! Pet đã đạt Level ${userData.level}.\nSức mạnh đã tăng cường!`);
        }, 2000); // Hiện sau 2 giây để người dùng đọc xong cái thông báo tập luyện đã
    }
}
// 5. TÍNH NĂNG CHẠY BỘ VỚI MAP (LEAFLET)


let map, jogPath, jogMarker;
let watchId = null;
let totalDistance = 0; // Đơn vị: mét
let lastLat = null, lastLng = null;

// Hàm mở chế độ chạy bộ
function startJoggingMode() {
    // Ẩn màn hình chính, hiện màn hình chạy
    document.getElementById('app-screen').classList.add('d-none');
    document.getElementById('jogging-screen').classList.remove('d-none');

    // Reset chỉ số
    totalDistance = 0;
    lastLat = null; lastLng = null;
    updateJogStats();

    // Khởi tạo bản đồ (nếu chưa có)
    if (!map) {
        map = L.map('map').setView([10.762622, 106.660172], 16); // Mặc định HCM
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap'
        }).addTo(map);
    }
    
    // Tạo đường vẽ quãng đường (Polyline)
    if(jogPath) map.removeLayer(jogPath);
    jogPath = L.polyline([], {color: 'blue', weight: 5}).addTo(map);

    // Bắt đầu theo dõi GPS
    if (navigator.geolocation) {
        watchId = navigator.geolocation.watchPosition(
            updatePosition, 
            (err) => alert("Lỗi GPS: " + err.message), 
            { enableHighAccuracy: true } // Yêu cầu chính xác cao
        );
    } else {
        alert("Thiết bị không hỗ trợ GPS!");
        stopJogging();
    }
}

// Hàm cập nhật vị trí khi di chuyển
function updatePosition(position) {
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;

    // 1. Vẽ marker vị trí hiện tại
    if (!jogMarker) {
        jogMarker = L.marker([lat, lng]).addTo(map);
    } else {
        jogMarker.setLatLng([lat, lng]);
    }
    
    // Center map vào người dùng
    map.setView([lat, lng]);

    // 2. Tính khoảng cách
    if (lastLat != null) {
        // Công thức tính khoảng cách giữa 2 điểm GPS
        const dist = map.distance([lastLat, lastLng], [lat, lng]);
        
        // Chỉ cộng nếu di chuyển đáng kể (> 2 mét) để tránh GPS nhảy lung tung khi đứng yên
        if (dist > 2) {
            totalDistance += dist;
            // Vẽ thêm đường vào bản đồ
            jogPath.addLatLng([lat, lng]);
        }
    }

    lastLat = lat;
    lastLng = lng;
    updateJogStats();
}

// Hàm hiển thị số liệu lên màn hình
function updateJogStats() {
    // Giả sử 1 bước chân trung bình = 0.7 mét
    const steps = Math.floor(totalDistance / 0.7);
    
    // Quy tắc: 100 bước = 10 XP => 10 bước = 1 XP
    const xpEarned = Math.floor(steps / 10); 

    document.getElementById('jog-distance').innerText = Math.floor(totalDistance) + "m";
    document.getElementById('jog-steps').innerText = steps;
    document.getElementById('jog-xp').innerText = "+" + xpEarned;
}

// Hàm kết thúc chạy
function stopJogging() {
    if (watchId) navigator.geolocation.clearWatch(watchId);

    const steps = Math.floor(totalDistance / 0.7);
    const xpEarned = Math.floor(steps / 10);

    if (xpEarned > 0) {
        addXP(xpEarned);
        userData.totalMinutes += Math.floor(steps / 100);
        
        saveToDB();
        renderUI();

        // Thay alert bằng Popup mới
        showRewardPopup("KẾT THÚC CHẠY BỘ", `Quãng đường: ${Math.floor(totalDistance)}m\nSố bước: ${steps}\nPhần thưởng: +${xpEarned} XP`);

    } else {
        alert("Bạn chưa chạy đủ để nhận quà!"); // Cái này giữ alert thường hoặc dùng popup tùy bạn
    }

    document.getElementById('jogging-screen').classList.add('d-none');
    document.getElementById('app-screen').classList.remove('d-none');
}
// 7. LOGIC KIỂM TRA SỨC KHỎE (HEALTH CHECK)

function openHealthCheck() {
    healthData = { visionScore: 0, pushups: 0, lungTime: 0 };
    currentVisionIndex = 0;
    
    // Reset UI
    ['step-vision', 'step-strength', 'step-lung', 'step-result'].forEach(id => {
        const el = document.getElementById(id);
        if(id === 'step-vision') el.classList.remove('d-none');
        else el.classList.add('d-none');
    });

    loadVisionChar();
    new bootstrap.Modal(document.getElementById('healthCheckModal')).show();
}

function loadVisionChar() {
    const chars = "ABCDEFGHJKLMNOPQRSTUVWXYZ";
    const randomChar = chars.charAt(Math.floor(Math.random() * chars.length));
    const el = document.getElementById('vision-char');
    el.innerText = randomChar;
    el.style.fontSize = VISION_LEVELS[currentVisionIndex].size;
}

function visionPass() {
    healthData.visionScore = VISION_LEVELS[currentVisionIndex].score;
    currentVisionIndex++;
    if (currentVisionIndex < VISION_LEVELS.length) {
        loadVisionChar();
    } else {
        goToStep('step-strength');
    }
}

function visionFail() {
    goToStep('step-strength');
}

function submitStrength() {
    const val = parseInt(document.getElementById('inp-pushup').value);
    if (isNaN(val) || val < 0) { alert("Nhập số đúng nha!"); return; }
    healthData.pushups = val;
    goToStep('step-lung');
}

function toggleLungTest() {
    const btn = document.getElementById('btn-lung-action');
    const display = document.getElementById('lung-timer');

    if (!isHoldingBreath) {
        isHoldingBreath = true;
        btn.innerText = "🛑 Dừng (Hết hơi)";
        btn.classList.replace('btn-success', 'btn-danger');
        
        lungStartTime = Date.now();
        lungInterval = setInterval(() => {
            const diff = (Date.now() - lungStartTime) / 1000;
            display.innerText = diff.toFixed(2);
        }, 100);
    } else {
        isHoldingBreath = false;
        clearInterval(lungInterval);
        healthData.lungTime = (Date.now() - lungStartTime) / 1000;
        
        btn.classList.add('d-none');
        document.getElementById('btn-lung-next').classList.remove('d-none');
    }
}

function finishHealthCheck() {
    goToStep('step-result');
    
    // Hiển thị kết quả
    document.getElementById('res-vision').innerText = `${healthData.visionScore}/10`;
    document.getElementById('res-strength').innerText = `${healthData.pushups} cái`;
    document.getElementById('res-lung').innerText = `${healthData.lungTime.toFixed(1)}s`;

    // Đánh giá & Thưởng
    const adviceEl = document.getElementById('health-advice');
    let bonusXP = 0;
    
    if (healthData.pushups > 20 || healthData.lungTime > 30) {
        adviceEl.className = "alert alert-success";
        adviceEl.innerText = "Cơ thể bạn rất tráng kiện! Pet thưởng nóng 50 XP!";
        bonusXP = 50;
    } else {
        adviceEl.className = "alert alert-warning";
        adviceEl.innerText = "Cần rèn luyện thêm nhé! Pet tặng bạn 10 XP khích lệ.";
        bonusXP = 10;
    }
    
    addXP(bonusXP);
    saveToDB();
    renderUI();
}

function goToStep(stepId) {
    ['step-vision', 'step-strength', 'step-lung', 'step-result'].forEach(id => {
        document.getElementById(id).classList.add('d-none');
    });
    document.getElementById(stepId).classList.remove('d-none');
}
