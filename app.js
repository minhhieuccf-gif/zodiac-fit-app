// --- 1. CẤU HÌNH FIREBASE ---
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
    { name: "Khỉ (Thân)", icon: "fa-cat" }, { name: "Gà (Dậu)", icon: "fa-crow" },
    { name: "Chó (Tuất)", icon: "fa-dog" }, { name: "Heo (Hợi)", icon: "fa-piggy-bank" },
    { name: "Chuột (Tý)", icon: "fa-mouse" }, { name: "Trâu (Sửu)", icon: "fa-hippo" },
    { name: "Hổ (Dần)", icon: "fa-cat" }, { name: "Mèo (Mão)", icon: "fa-cat" },
    { name: "Rồng (Thìn)", icon: "fa-dragon" }, { name: "Rắn (Tỵ)", icon: "fa-worm" },
    { name: "Ngựa (Ngọ)", icon: "fa-horse" }, { name: "Dê (Mùi)", icon: "fa-horse-head" }
];

// Bài tập được nâng cấp: Có XP và Level
const EXERCISES = [
    { 
        id: 'e1', type: 'beginner', name: "Khởi động nhẹ", 
        xp: 10, time: 60, 
        desc: "Xoay khớp cổ tay, chân, vươn vai. Giúp Pet tỉnh ngủ!", 
        img: "https://media.giphy.com/media/l2JhvASuBqgC4c9fG/giphy.gif" 
    },
    { 
        id: 'e2', type: 'strength', name: "Hít đất cơ bản", 
        xp: 20, time: 45, 
        desc: "Thực hiện 2 hiệp, mỗi hiệp 10 cái. Nghỉ giữa hiệp 5s.", 
        img: "https://media.giphy.com/media/KHM1e9f1a0T8k/giphy.gif" 
    },
    { 
        id: 'e3', type: 'cardio', name: "Chạy nâng cao đùi", 
        xp: 25, time: 60, 
        desc: "Chạy tại chỗ tốc độ cao. Đốt cháy năng lượng cho Pet!", 
        img: "https://media.giphy.com/media/l3q2Q3sUEkEqgAn28/giphy.gif" 
    },
    { 
        id: 'e4', type: 'yoga', name: "Rắn hổ mang", 
        xp: 15, time: 60, 
        desc: "Giãn cơ lưng. Giữ nhịp thở đều. Rất tốt cho cột sống.", 
        img: "https://media.giphy.com/media/3oKIPuE14D3yg5C65y/giphy.gif" 
    },
    { 
        id: 'e5', type: 'fullbody', name: "Burpees (Địa ngục)", 
        xp: 40, time: 45, 
        desc: "Bài tập vua! Kết hợp hít đất và bật nhảy. Pet sẽ lên cấp rất nhanh!", 
        img: "https://media.giphy.com/media/l3vRaWp5lLCv49XBC/giphy.gif" 
    }
];

let currentUser = null;
let userData = {};
let timerInterval = null;
let currentEx = null;

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
            openSetupModal(true); // true = Bắt buộc nhập (không tắt được)
        } else {
            userData = data;
            // Di cư dữ liệu cũ nếu chưa có Level (dành cho user cũ)
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
    const h = parseFloat(document.getElementById('inp-height').value) / 100; // Đổi cm sang m
    const w = parseFloat(document.getElementById('inp-weight').value);

    if (!name || !year || !h || !w) { alert("Vui lòng nhập đủ!"); return; }

    const zodiacIndex = year % 12;
    const bmi = (w / (h * h)).toFixed(1);

    // CẬP NHẬT DỮ LIỆU
    userData = {
        ...userData, // 1. Giữ lại dữ liệu cũ (Level, XP, Streak...) TRƯỚC
        
        // 2. Ghi đè thông tin mới nhập VÀO SAU
        name: name, 
        birthYear: year, 
        height: h, 
        startWeight: w, 
        bmi: bmi,
        petType: zodiacIndex,
        
        // 3. Đảm bảo các chỉ số game không bị mất (nếu chưa có thì tạo mới)
        level: userData.level || 1, 
        currentXP: userData.currentXP || 0, 
        maxXP: userData.maxXP || 100,
        totalMinutes: userData.totalMinutes || 0,
        lastLogin: userData.lastLogin || Date.now(), 
        streak: userData.streak || 0
    };

    saveToDB();
    
    // Đóng modal sau khi lưu
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

// 6. LOGIC TẬP LUYỆN 

function openWorkout(id) {
    currentEx = EXERCISES.find(e => e.id === id);
    if(!currentEx) return;

    document.getElementById('ex-title').innerText = currentEx.name;
    document.getElementById('ex-desc').innerText = currentEx.desc;
    document.getElementById('ex-img').src = currentEx.img;
    document.getElementById('ex-badge').innerText = `Thưởng: +${currentEx.xp} XP`;
    document.getElementById('timer-display').innerText = `00:${currentEx.time}`;
    
    const btn = document.getElementById('btn-action');
    btn.innerText = "Bắt đầu tập";
    btn.disabled = false;
    btn.onclick = startTimer;

    new bootstrap.Modal(document.getElementById('workoutModal')).show();
}

function startTimer() {
    const btn = document.getElementById('btn-action');
    const display = document.getElementById('timer-display');
    let timeLeft = currentEx.time;

    btn.disabled = true;
    btn.innerText = "Đang tập... Cố lên!";
    
    if(timerInterval) clearInterval(timerInterval);
    
    timerInterval = setInterval(() => {
        timeLeft--;
        display.innerText = `00:${timeLeft < 10 ? '0'+timeLeft : timeLeft}`;
        
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            finishWorkout();
        }
    }, 1000);
}

function finishWorkout() {
    // 1. Cộng chỉ số
    if(!userData.totalMinutes) userData.totalMinutes = 0;
    userData.totalMinutes += Math.floor(currentEx.time / 60) + 1; // Làm tròn phút
    
    // 2. Cộng XP
    addXP(currentEx.xp);
    
    // 3. Update Streak
    const now = new Date();
    const last = new Date(userData.lastLogin || 0);
    if(now.getDate() !== last.getDate()) {
        userData.streak = (userData.streak || 0) + 1;
    }
    userData.lastLogin = Date.now();

    saveToDB();
    renderUI();
    
    const modalEl = document.getElementById('workoutModal');
    const modalInstance = bootstrap.Modal.getInstance(modalEl);
    if(modalInstance) modalInstance.hide();
    
    alert(`Tuyệt vời! Bạn nhận được ${currentEx.xp} XP.`);
}

function addXP(amount) {
    userData.currentXP += amount;
    if(userData.currentXP >= userData.maxXP) {
        userData.currentXP -= userData.maxXP;
        userData.level++;
        userData.maxXP = Math.floor(userData.maxXP * 1.2); // Tăng độ khó
        alert(`🎉 CHÚC MỪNG! Pet đã lên cấp ${userData.level}!`);
    }
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
