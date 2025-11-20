// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyD_tEDufGFMQRbnV34gkk5w2pEY7Eqysyk",
    authDomain: "test-cmt-2.firebaseapp.com",
    projectId: "test-cmt-2",
    storageBucket: "test-cmt-2.firebasestorage.app",
    messagingSenderId: "586264056540",
    appId: "1:586264056540:web:33a752e8f5aee76d255a19",
    measurementId: "G-GHEG5ZR4FY"
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Rate limiting to prevent spam
let lastSubmissionTime = 0;
const SUBMISSION_COOLDOWN = 10000; // 10 seconds between submissions

// Variables for edit functionality
let currentlyEditingId = null;

// ===== ការកំណត់សិទ្ធិ =====
// អ្នកដែលមានសិទ្ធិកែសម្រួល (អាចកែបានតាម IP, user ID, ឬ admin)
const ALLOWED_EDITORS = {
    // អ្នកគ្រប់គ្រង (Admin) - អាចកែសម្រួលគ្រប់សារ
    admin: true,
    
    // អ្នកប្រើប្រាស់ធម្មតា - អាចកែសម្រួលតែសាររបស់ខ្លួន
    user: 'own'
};

// តាមដានអ្នកប្រើប្រាស់បច្ចុប្បន្ន (អាចប្រើ IP, localStorage, ឬ user session)
let currentUser = {
    id: null,
    name: null,
    type: 'user' // 'user' ឬ 'admin'
};

// មុខងារកំណត់អត្តសញ្ញាណអ្នកប្រើប្រាស់
function initializeUser() {
    // ពិនិត្យថាតើអ្នកប្រើប្រាស់ជា admin ឬទេ
    // អ្នកអាចកែតម្រូវផ្នែកនេះតាមតម្រូវការ
    const isAdmin = checkIfAdmin();
    
    if (isAdmin) {
        currentUser.type = 'admin';
        currentUser.id = 'admin';
        currentUser.name = 'អ្នកគ្រប់គ្រង';
        showDebugInfo('អ្នកជា admin - អាចកែសម្រួលគ្រប់សារ');
    } else {
        // សម្រាប់អ្នកប្រើប្រាស់ធម្មតា ប្រើ IP ឬ session
        currentUser.id = generateUserIdentifier();
        currentUser.type = 'user';
        showDebugInfo('អ្នកជាអ្នកប្រើប្រាស់ធម្មតា - អាចកែសម្រួលតែសាររបស់អ្នក');
    }
}

// មុខងារពិនិត្យថាតើអ្នកប្រើប្រាស់ជា admin ឬទេ
function checkIfAdmin() {
    // អ្នកអាចកែតម្រូវផ្នែកនេះតាមតម្រូវការ
    // ឧទាហរណ៍៖ ពិនិត្យ URL parameter, localStorage, ឬ authentication
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('admin') === 'true' || localStorage.getItem('isAdmin') === 'true';
}

// បង្កើតអត្តសញ្ញាណអ្នកប្រើប្រាស់ (ប្រើ IP + user agent)
function generateUserIdentifier() {
    let userIdentifier = localStorage.getItem('userIdentifier');
    
    if (!userIdentifier) {
        // បង្កើតអត្តសញ្ញាណថ្មី (អាចប្រើ IP បើមាន)
        userIdentifier = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('userIdentifier', userIdentifier);
    }
    
    return userIdentifier;
}

// ពិនិត្យសិទ្ធិកែសម្រួល
function canEditComment(commentData) {
    // Admin អាចកែសម្រួលគ្រប់សារ
    if (currentUser.type === 'admin') {
        return true;
    }
    
    // អ្នកប្រើប្រាស់ធម្មតាអាចកែសម្រួលតែសាររបស់ខ្លួន
    // ពិនិត្យតាម user identifier
    if (commentData.userId === currentUser.id) {
        return true;
    }
    
    return false;
}

// ពិនិត្យសិទ្ធិលុប
function canDeleteComment(commentData) {
    return canEditComment(commentData); // សិទ្ធិលុបដូចគ្នានឹងសិទ្ធិកែសម្រួល
}

// ===== មុខងារជួយ =====

// ពិនិត្យ rate limiting
function canSubmit() {
    const now = Date.now();
    if (now - lastSubmissionTime < SUBMISSION_COOLDOWN) {
        const remainingTime = Math.ceil((SUBMISSION_COOLDOWN - (now - lastSubmissionTime)) / 1000);
        showError(`សូមរង់ចាំ ${remainingTime} វិនាទីមុនពេលផ្ញើសារថ្មី`);
        return false;
    }
    return true;
}

// បង្ហាញព័ត៌មាន Debug
function showDebugInfo(message) {
    console.log('DEBUG:', message);
    const debugInfo = document.getElementById('debugInfo');
    const debugContent = document.getElementById('debugContent');
    if (debugContent) {
        debugContent.textContent = message;
        debugInfo.style.display = 'block';
    }
}

// បង្ហាញសារបរាជ័យ
function showError(message) {
    const errorMessage = document.getElementById('errorMessage');
    if (errorMessage) {
        errorMessage.textContent = '❌ ' + message;
        errorMessage.style.display = 'block';
        setTimeout(() => {
            errorMessage.style.display = 'none';
        }, 5000);
    }
}

// បង្ហាញសារជោគជ័យ
function showSuccessMessage() {
    const successMessage = document.getElementById('successMessage');
    if (successMessage) {
        successMessage.style.display = 'block';
        setTimeout(() => {
            successMessage.style.display = 'none';
        }, 3000);
    }
}

// ការពារ HTML និងពិនិត្យ input
function sanitizeInput(input, maxLength = 500) {
    if (!input) return '';
    
    // Trim and limit length
    let sanitized = input.trim().substring(0, maxLength);
    
    // Escape HTML
    sanitized = sanitized
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    
    return sanitized;
}

// បន្ថែម emoji
function addEmoji(emoji) {
    const textarea = document.getElementById('comment');
    if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = textarea.value;
        const newText = text.substring(0, start) + emoji + text.substring(end);
        
        textarea.value = newText;
        textarea.focus();
        textarea.selectionStart = textarea.selectionEnd = start + emoji.length;
    }
}

// ===== មុខងារ Firebase =====

// បន្ថែមសារថ្មី
async function addCommentToFirebase(name, email, comment) {
    try {
        showDebugInfo('កំពុងបន្ថែមសារទៅកាន់ Firebase...');
        
        // Validate inputs
        if (name.length < 2 || name.length > 50) {
            throw new Error('ឈ្មោះត្រូវតែមានចន្លោះពី ២ ទៅ ៥០ តួអក្សរ');
        }
        
        if (comment.length < 1 || comment.length > 500) {
            throw new Error('សារត្រូវតែមានចន្លោះពី ៥ ទៅ ៥០០ តួអក្សរ');
        }
        
        await db.collection("weddingComments").add({
            name: sanitizeInput(name, 50),
            email: sanitizeInput(email, 100),
            comment: sanitizeInput(comment, 500),
            userId: currentUser.id, // រក្សាទុក user ID
            userType: currentUser.type, // រក្សាទុក user type
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        lastSubmissionTime = Date.now();
        showDebugInfo('សារត្រូវបានបន្ថែមដោយជោគជ័យ!');
        return true;
    } catch (error) {
        showDebugInfo('កំហុសក្នុងការបន្ថែមសារ: ' + error.message);
        console.error('Error details:', error);
        showError('មិនអាចផ្ញើសារបាន: ' + error.message);
        return false;
    }
}

// ធ្វើបច្ចុប្បន្នភាពសារ
async function updateCommentInFirebase(commentId, newComment) {
    try {
        showDebugInfo('កំពុងធ្វើបច្ចុប្បន្នភាពសារ...');
        
        if (newComment.length < 5 || newComment.length > 500) {
            throw new Error('សារត្រូវតែមានចន្លោះពី ៥ ទៅ ៥០០ តួអក្សរ');
        }
        
        await db.collection("weddingComments").doc(commentId).update({
            comment: sanitizeInput(newComment, 500),
            lastEdited: firebase.firestore.FieldValue.serverTimestamp(),
            editedBy: currentUser.id // កត់ត្រាថាតើអ្នកណាកែសម្រួល
        });
        
        showDebugInfo('សារត្រូវបានធ្វើបច្ចុប្បន្នភាពដោយជោគជ័យ!');
        return true;
    } catch (error) {
        showDebugInfo('កំហុសក្នុងការធ្វើបច្ចុប្បន្នភាពសារ: ' + error.message);
        console.error('Error details:', error);
        showError('មិនអាចកែសម្រួលសារបាន: ' + error.message);
        return false;
    }
}

// ទាញយកសារពី Firebase (Real-time listener)
function setupCommentsListener() {
    try {
        showDebugInfo('កំពុងដំឡើង real-time listener...');
        
        const loadingMessage = document.getElementById('loadingMessage');
        const noComments = document.getElementById('noComments');
        
        if (loadingMessage) loadingMessage.style.display = 'block';
        
        return db.collection("weddingComments")
            .orderBy("timestamp", "desc")
            .limit(50)
            .onSnapshot(snapshot => {
                const commentsList = document.getElementById('commentsList');
                if (!commentsList) return;
                
                // Clear existing comments but keep the title
                const commentsTitle = commentsList.querySelector('h3');
                commentsList.innerHTML = '';
                if (commentsTitle) {
                    commentsList.appendChild(commentsTitle);
                }
                
                if (loadingMessage) loadingMessage.style.display = 'none';
                
                if (snapshot.empty) {
                    if (noComments) {
                        noComments.style.display = 'block';
                        commentsList.appendChild(noComments);
                    }
                    showDebugInfo('មិនមានសារណាមួយនៅក្នុង database');
                    return;
                }
                
                if (noComments) noComments.style.display = 'none';
                showDebugInfo('រកឃើញ ' + snapshot.size + ' សារ');
                
                snapshot.forEach((doc) => {
                    const data = doc.data();
                    displayComment({
                        id: doc.id,
                        name: data.name,
                        email: data.email,
                        comment: data.comment,
                        userId: data.userId,
                        userType: data.userType,
                        date: data.timestamp?.toDate() || new Date(),
                        lastEdited: data.lastEdited?.toDate(),
                        editedBy: data.editedBy
                    });
                });
                
            }, error => {
                console.error('Error in comments listener:', error);
                if (loadingMessage) loadingMessage.style.display = 'none';
                showError('មិនអាចផ្ទុកសារបាន: ' + error.message);
            });
        
    } catch (error) {
        showDebugInfo('កំហុសក្នុងការដំឡើង listener: ' + error.message);
        console.error('Error details:', error);
    }
}

// បង្ហាញសារនៅលើវេបសាយ
function displayComment(commentData) {
    const commentsList = document.getElementById('commentsList');
    if (!commentsList) return;
    
    const commentItem = document.createElement('div');
    commentItem.className = 'comment-item';
    commentItem.id = commentData.id;
    
    const dateString = commentData.date.toLocaleDateString('km-KH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    const editedInfo = commentData.lastEdited ? 
        `<div class="comment-edited">(កែសម្រួលចុងក្រោយ: ${commentData.lastEdited.toLocaleDateString('km-KH', { hour: '2-digit', minute: '2-digit' })})</div>` : '';
    
    // ពិនិត្យសិទ្ធិកែសម្រួល
    const canEdit = canEditComment(commentData);
    const canDelete = canDeleteComment(commentData);
    
    // បង្ហាញប៊ូតុងតាមសិទ្ធិ
    const actionButtons = canEdit || canDelete ? `
        <div class="comment-actions">
            ${canEdit ? `<button type="button" class="edit-btn">កែសម្រួល</button>` : ''}
            ${canDelete ? `<button type="button" class="delete-btn">លុប</button>` : ''}
        </div>
    ` : '';
    
    commentItem.innerHTML = `
        <div class="comment-header">
            <strong>${commentData.name}</strong>
            <span class="comment-date">${dateString}</span>
        </div>
        <div class="comment-content">${commentData.comment}</div>
        ${editedInfo}
        ${commentData.email ? `<div class="comment-email">អ៊ីមែល: ${commentData.email}</div>` : ''}
        
        <!-- Edit Form (hidden by default) -->
        <div class="edit-form">
            <textarea class="edit-textarea">${commentData.comment}</textarea>
            <div class="edit-actions">
                <button type="button" class="cancel-edit-btn">បោះបង់</button>
                <button type="button" class="save-edit-btn">រក្សាទុក</button>
            </div>
        </div>
        
        ${actionButtons}
    `;
    
    // Add event listeners ត្រឹមតែបើមានសិទ្ធិ
    if (canEdit) {
        const editBtn = commentItem.querySelector('.edit-btn');
        editBtn.addEventListener('click', () => startEdit(commentData.id));
    }
    
    if (canDelete) {
        const deleteBtn = commentItem.querySelector('.delete-btn');
        deleteBtn.addEventListener('click', () => deleteComment(commentData.id));
    }
    
    // បន្ថែម event listeners សម្រាប់ edit form (តែបើមានសិទ្ធិកែសម្រួល)
    if (canEdit) {
        const cancelBtn = commentItem.querySelector('.cancel-edit-btn');
        const saveBtn = commentItem.querySelector('.save-edit-btn');
        
        cancelBtn.addEventListener('click', () => cancelEdit(commentData.id));
        saveBtn.addEventListener('click', () => saveEdit(commentData.id));
    }
    
    commentsList.appendChild(commentItem);
}

// ចាប់ផ្តើមកែសម្រួល
function startEdit(commentId) {
    // Cancel any ongoing edit
    if (currentlyEditingId && currentlyEditingId !== commentId) {
        cancelEdit(currentlyEditingId);
    }
    
    const commentElement = document.getElementById(commentId);
    if (!commentElement) return;
    
    commentElement.classList.add('editing');
    
    // Focus on textarea
    const textarea = commentElement.querySelector('.edit-textarea');
    if (textarea) {
        textarea.focus();
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    }
    
    currentlyEditingId = commentId;
}

// បោះបង់ការកែសម្រួល
function cancelEdit(commentId) {
    const commentElement = document.getElementById(commentId);
    if (!commentElement) return;
    
    commentElement.classList.remove('editing');
    currentlyEditingId = null;
}

// រក្សាទុកការកែសម្រួល
async function saveEdit(commentId) {
    const commentElement = document.getElementById(commentId);
    if (!commentElement) return;
    
    const textarea = commentElement.querySelector('.edit-textarea');
    if (!textarea) return;
    
    const newComment = textarea.value.trim();
    
    if (!newComment) {
        showError('សូមបញ្ចូលសារជូនពរ!');
        return;
    }
    
    if (newComment.length < 5 || newComment.length > 500) {
        showError('សារត្រូវតែមានចន្លោះពី ៥ ទៅ ៥០០ តួអក្សរ');
        return;
    }
    
    const saveBtn = commentElement.querySelector('.save-edit-btn');
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = 'កំពុងរក្សាទុក...';
    }
    
    try {
        const success = await updateCommentInFirebase(commentId, newComment);
        
        if (success) {
            // បិទទម្រង់កែសម្រួល
            cancelEdit(commentId);
            
            // បង្ហាញសារជោគជ័យ
            showSuccessMessage();
            
            showDebugInfo('សារត្រូវបានកែសម្រួលដោយជោគជ័យ!');
        }
    } catch (error) {
        console.error('Error saving edit:', error);
        showError('មិនអាចរក្សាទុកការកែសម្រួលបាន: ' + error.message);
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = 'រក្សាទុក';
        }
    }
}

// លុបសារ
async function deleteComment(commentId) {
    if (confirm('តើអ្នកពិតជាចង់លុបសារជូនពរនេះមែនទេ?')) {
        try {
            await db.collection("weddingComments").doc(commentId).delete();
            showDebugInfo('សារត្រូវបានលុបដោយជោគជ័យ');
        } catch (error) {
            showDebugInfo('កំហុសក្នុងការលុបសារ: ' + error.message);
            showError('មិនអាចលុបសារបាន - ត្រូវការការអនុញ្ញាត');
        }
    }
}

// ===== ចាប់ផ្ដើម =====
document.addEventListener('DOMContentLoaded', async function() {
    showDebugInfo('កំពុងចាប់ផ្ដើម...');
    
    // ចាប់ផ្តើមការកំណត់អត្តសញ្ញាណអ្នកប្រើប្រាស់
    initializeUser();
    
    const commentForm = document.getElementById('commentForm');
    if (!commentForm) {
        showError('មិនអាចរកទម្រង់សារបាន');
        return;
    }

    // តេស្តការភ្ជាប់ Firebase
    try {
        showDebugInfo('កំពុងតេស្តការភ្ជាប់ Firebase...');
        const testQuery = await db.collection("weddingComments").limit(1).get();
        showDebugInfo('Firebase ភ្ជាប់បានជោគជ័យ! រកឃើញ ' + testQuery.size + ' សារ');
    } catch (error) {
        showDebugInfo('បរាជ័យក្នុងការភ្ជាប់ Firebase: ' + error.message);
        showError('មិនអាចភ្ជាប់ទៅកាន់ database បាន: ' + error.message);
        return;
    }

    // ដំឡើង real-time listener
    setupCommentsListener();

    // ការដាក់ស្នើទម្រង់
    commentForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        if (!canSubmit()) {
            return;
        }
        
        const name = document.getElementById('name')?.value.trim();
        const email = document.getElementById('email')?.value.trim();
        const comment = document.getElementById('comment')?.value.trim();
        
        if (name && comment) {
            const submitBtn = commentForm.querySelector('.submit-btn');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'កំពុងផ្ញើ...';
            }
            
            showDebugInfo('កំពុងផ្ញើសារ: ' + name);
            
            try {
                const success = await addCommentToFirebase(name, email, comment);
                
                if (success) {
                    commentForm.reset();
                    showSuccessMessage();
                    showDebugInfo('សារបានផ្ញើដោយជោគជ័យ!');
                }
            } catch (error) {
                showDebugInfo('កំហុសក្នុងការផ្ញើសារ: ' + error.message);
                showError('កំហុស: ' + error.message);
            }
            
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = '📨 ផ្ញើសារជូនពរ';
            }
        } else {
            showError('សូមបំពេញឈ្មោះ និងសារជូនពរ!');
        }
    });
});

// ===== មុខងារសម្រាប់ Admin =====
// មុខងារសម្រាប់ប្តូរទៅជា admin (សម្រាប់តេស្ត)
function enableAdminMode() {
    currentUser.type = 'admin';
    currentUser.id = 'admin';
    currentUser.name = 'អ្នកគ្រប់គ្រង';
    localStorage.setItem('isAdmin', 'true');
    showSuccessMessage();
    showDebugInfo('បានប្តូរទៅជា admin mode - អាចកែសម្រួលគ្រប់សារ');
    // Reload comments to update buttons
    setupCommentsListener();
}

// មុខងារសម្រាប់បិទ admin mode
function disableAdminMode() {
    currentUser.type = 'user';
    currentUser.id = generateUserIdentifier();
    localStorage.removeItem('isAdmin');
    showSuccessMessage();
    showDebugInfo('បានបិទ admin mode - អាចកែសម្រួលតែសាររបស់អ្នក');
    // Reload comments to update buttons
    setupCommentsListener();
}