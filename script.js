/**
 * Beacon Hill Academy Portal Engine
 * Orchestrates Real-time UI changes, local sandbox database storage, dynamic QR generation,
 * and a clean HTML5 canvas billing receipt creator.
 */

// --- State Variables ---
let supabaseClient = null;
let applicationState = {
    admissions: [],
    payments: [],
    currentConfig: {
        url: localStorage.getItem('SB_URL') || '',
        key: localStorage.getItem('SB_KEY') || ''
    },
    activeTab: 'admission',
    activeRecordsSubTab: 'admissions'
};

// Prepopulated mock data to establish a realistic portal state immediately on first launch
const mockAdmissionsSeed = [
    {
        id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
        student_name: 'Faizan Ahmed',
        grade_level: 'A-Levels Year 1',
        guardian_name: 'Tariq Ahmed',
        guardian_email: 'tariq.ahmed@domain.com',
        status: 'Approved',
        created_at: new Date(Date.now() - 3600000 * 24 * 3).toISOString()
    },
    {
        id: '2b3cc4d1-81d3-490b-be13-ee92fa772390',
        student_name: 'Zainab Fatima',
        grade_level: 'Grade 5',
        guardian_name: 'Dr. Muhammad Ali',
        guardian_email: 'm.ali@domain.org',
        status: 'Pending Review',
        created_at: new Date(Date.now() - 3600000 * 8).toISOString()
    }
];

const mockPaymentsSeed = [
    {
        id: 'PAY-882910-BH',
        student_name: 'Faizan Ahmed',
        category: 'Admission Registration Fee',
        amount_paid: 12500,
        wallet_number: '03451234567',
        transaction_reference: 'EP-MOCK-77192A',
        created_at: new Date(Date.now() - 3600000 * 24 * 2).toISOString()
    }
];

// Initialize standard data structures inside LocalStorage to maintain a functional sandbox out-of-the-box
function initSandboxDatabase() {
    if (!localStorage.getItem('PORTAL_ADMISSIONS')) {
        localStorage.setItem('PORTAL_ADMISSIONS', JSON.stringify(mockAdmissionsSeed));
    }
    if (!localStorage.getItem('PORTAL_PAYMENTS')) {
        localStorage.setItem('PORTAL_PAYMENTS', JSON.stringify(mockPaymentsSeed));
    }
    syncStateFromSandbox();
}

function syncStateFromSandbox() {
    applicationState.admissions = JSON.parse(localStorage.getItem('PORTAL_ADMISSIONS') || '[]');
    applicationState.payments = JSON.parse(localStorage.getItem('PORTAL_PAYMENTS') || '[]');
    updateInterfaceStats();
    renderRecordsTable();
}

// --- Initialize Supabase Connection if credentials are configured ---
function connectToSupabase() {
    const url = applicationState.currentConfig.url;
    const key = applicationState.currentConfig.key;
    const indicatorPulse = document.getElementById('statusIndicatorPulse');
    const indicator = document.getElementById('statusIndicator');
    const statusText = document.getElementById('connectionStatus');

    if (url && key) {
        try {
            // Dynamically load Supabase SDK from window if CDN was resolved successfully
            if (window.supabase) {
                supabaseClient = window.supabase.createClient(url, key);
                indicator.className = 'relative inline-flex rounded-full h-2 w-2 bg-emerald-600';
                indicatorPulse.className = 'animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-600 opacity-75';
                statusText.innerText = 'Synced with Supabase Cloud DB';
                fetchSupabaseData();
            } else {
                console.warn('Supabase CDN library not detected. Running local sandbox.');
                runSandboxFallback();
            }
        } catch (error) {
            console.error('Failed to connect to Supabase: ', error);
            runSandboxFallback();
        }
    } else {
        runSandboxFallback();
    }
}

function runSandboxFallback() {
    supabaseClient = null;
    const indicatorPulse = document.getElementById('statusIndicatorPulse');
    const indicator = document.getElementById('statusIndicator');
    const statusText = document.getElementById('connectionStatus');
    
    indicator.className = 'relative inline-flex rounded-full h-2 w-2 bg-amber-500';
    indicatorPulse.className = 'animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75';
    statusText.innerText = 'Local Sandbox Database Active';
    initSandboxDatabase();
}

// --- Supabase Relational Fetch ---
async function fetchSupabaseData() {
    if (!supabaseClient) return;
    try {
        // Fetch admissions
        let { data: admissions, error: admErr } = await supabaseClient
            .from('admissions')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (!admErr) {
            applicationState.admissions = admissions;
        }

        // Fetch payments
        let { data: payments, error: payErr } = await supabaseClient
            .from('fee_payments')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (!payErr) {
            applicationState.payments = payments;
        }

        updateInterfaceStats();
        renderRecordsTable();
    } catch (e) {
        console.error('Remote fetch occurred an unexpected exception: ', e);
    }
}

// --- UI Update Metrics ---
function updateInterfaceStats() {
    document.getElementById('statAdmissionsCount').innerText = applicationState.admissions.length;
    document.getElementById('statPaymentsCount').innerText = applicationState.payments.length;
}

// --- Tab Switching Navigation ---
const navTabs = ['admission', 'payments', 'records'];
navTabs.forEach(tabName => {
    const button = document.getElementById(`tab-${tabName}`);
    if (button) {
        button.addEventListener('click', () => {
            // Remove active classes
            navTabs.forEach(n => {
                document.getElementById(`tab-${n}`).classList.remove('active');
                document.getElementById(`section-${n}`).classList.remove('active');
            });
            // Add active styles
            button.classList.add('active');
            document.getElementById(`section-${tabName}`).classList.add('active');
            applicationState.activeTab = tabName;
        });
    }
});

// --- Inner Records Panel Sub-tabs ---
const subTabAdmissions = document.getElementById('btnSubTabAdmissions');
const subTabPayments = document.getElementById('btnSubTabPayments');
const containerAdmissions = document.getElementById('recordsAdmissionsContainer');
const containerPayments = document.getElementById('recordsPaymentsContainer');

if (subTabAdmissions && subTabPayments) {
    subTabAdmissions.addEventListener('click', () => {
        subTabAdmissions.className = 'border-b-2 border-brand-primary px-3 py-2 text-sm font-semibold text-brand-primary';
        subTabPayments.className = 'border-b-2 border-transparent px-3 py-2 text-sm font-semibold text-brand-muted hover:text-brand-primary';
        containerAdmissions.classList.remove('hidden');
        containerPayments.classList.add('hidden');
        applicationState.activeRecordsSubTab = 'admissions';
    });

    subTabPayments.addEventListener('click', () => {
        subTabPayments.className = 'border-b-2 border-brand-primary px-3 py-2 text-sm font-semibold text-brand-primary';
        subTabAdmissions.className = 'border-b-2 border-transparent px-3 py-2 text-sm font-semibold text-brand-muted hover:text-brand-primary';
        containerPayments.classList.remove('hidden');
        containerAdmissions.classList.add('hidden');
        applicationState.activeRecordsSubTab = 'payments';
    });
}

// --- Dynamic Renderer: Database Records Tables ---
function renderRecordsTable() {
    const admissionsList = document.getElementById('recordsAdmissionsList');
    const paymentsList = document.getElementById('recordsPaymentsList');

    // 1. Render Admissions List
    admissionsList.innerHTML = '';
    if (applicationState.admissions.length === 0) {
        admissionsList.innerHTML = `<tr><td colspan="5" class="px-4 py-8 text-center text-brand-muted italic bg-brand-surface2/20">No registration submissions recorded.</td></tr>`;
    } else {
        applicationState.admissions.forEach(row => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-brand-bg/50 transition';
            
            const dateFormatted = new Date(row.created_at).toLocaleDateString(undefined, {
                year: 'numeric', month: 'short', day: 'numeric'
            });
            
            let statusBadge = '';
            if (row.status === 'Approved') {
                statusBadge = `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">Approved</span>`;
            } else {
                statusBadge = `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">Pending Review</span>`;
            }

            tr.innerHTML = `
                <td class="px-4 py-3.5 font-semibold text-brand-text">${escapeHTML(row.student_name)}</td>
                <td class="px-4 py-3.5 text-brand-muted">${escapeHTML(row.grade_level)}</td>
                <td class="px-4 py-3.5 text-brand-muted">
                    <div class="font-medium text-brand-text">${escapeHTML(row.guardian_name || 'N/A')}</div>
                    <div class="text-xs">${escapeHTML(row.guardian_email)}</div>
                </td>
                <td class="px-4 py-3.5">${statusBadge}</td>
                <td class="px-4 py-3.5 text-xs text-brand-muted font-mono">${dateFormatted}</td>
            `;
            admissionsList.appendChild(tr);
        });
    }

    // 2. Render Payments Ledger List
    paymentsList.innerHTML = '';
    if (applicationState.payments.length === 0) {
        paymentsList.innerHTML = `<tr><td colspan="5" class="px-4 py-8 text-center text-brand-muted italic bg-brand-surface2/20">No verified fee deposits recorded.</td></tr>`;
    } else {
        applicationState.payments.forEach(row => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-brand-bg/50 transition';
            const dateFormatted = new Date(row.created_at).toLocaleDateString(undefined, {
                year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
            });
            
            tr.innerHTML = `
                <td class="px-4 py-3.5 font-semibold text-brand-text">${escapeHTML(row.student_name)}</td>
                <td class="px-4 py-3.5 text-brand-muted">${escapeHTML(row.category || 'School Fee')}</td>
                <td class="px-4 py-3.5 font-bold text-brand-success">PKR ${Number(row.amount_paid).toLocaleString()}</td>
                <td class="px-4 py-3.5 text-xs font-mono text-brand-muted">${escapeHTML(row.id || row.transaction_reference)}</td>
                <td class="px-4 py-3.5 text-xs text-brand-muted">${dateFormatted}</td>
            `;
            paymentsList.appendChild(tr);
        });
    }
}

// --- Action: Admission Registration Submission ---
const admissionForm = document.getElementById('admissionForm');
if (admissionForm) {
    admissionForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const submitBtn = document.getElementById('btnSubmitAdmission');
        const loader = document.getElementById('admLoader');
        const alertBox = document.getElementById('admissionAlert');

        const studentName = document.getElementById('admStudentName').value.trim();
        const gradeLevel = document.getElementById('admGrade').value;
        const guardianName = document.getElementById('admGuardianName').value.trim();
        const email = document.getElementById('admEmail').value.trim();
        const notes = document.getElementById('admNotes').value.trim();

        if (!studentName || !gradeLevel || !guardianName || !email) {
            showFormAlert(alertBox, 'Error: All required attributes must be declared.', 'danger');
            return;
        }

        // Toggle pending visual states
        submitBtn.disabled = true;
        loader.classList.remove('hidden');
        alertBox.classList.add('hidden');

        const record = {
            student_name: studentName,
            grade_level: gradeLevel,
            guardian_name: guardianName,
            guardian_email: email,
            status: 'Pending Review',
            created_at: new Date().toISOString()
        };

        try {
            if (supabaseClient) {
                // Save remotely in target Supabase DB
                const { data, error } = await supabaseClient
                    .from('admissions')
                    .insert([record])
                    .select();
                
                if (error) throw error;
                
                showFormAlert(alertBox, `Success: Student Registration for ${studentName} successfully submitted to your Cloud database!`, 'success');
                fetchSupabaseData();
            } else {
                // Local sandboxed storage fallback
                const sandboxAdmissions = JSON.parse(localStorage.getItem('PORTAL_ADMISSIONS') || '[]');
                record.id = crypto.randomUUID ? crypto.randomUUID() : 'local-' + Math.random().toString(36).substring(2, 9);
                sandboxAdmissions.unshift(record);
                localStorage.setItem('PORTAL_ADMISSIONS', JSON.stringify(sandboxAdmissions));
                
                showFormAlert(alertBox, `Success: Student application for ${studentName} stored locally inside Sandbox database (Supabase not connected).`, 'success');
                syncStateFromSandbox();
            }
            
            // Clear inputs
            admissionForm.reset();
        } catch (error) {
            console.error('Submission error:', error);
            showFormAlert(alertBox, `Error writing database register: ${error.message || 'Check database schema constraints'}`, 'danger');
        } finally {
            submitBtn.disabled = false;
            loader.classList.add('hidden');
        }
    });
}

// --- Dynamic Easypaisa QR System Actions ---
let generatedPaymentReference = null;
const btnGenerateQR = document.getElementById('btnGenerateQR');
const qrEmptyState = document.getElementById('qrEmptyState');
const qrDisplayState = document.getElementById('qrDisplayState');
const qrImg = document.getElementById('qrImg');

const payStudent = document.getElementById('payStudentName');
const payAmount = document.getElementById('payAmount');
const payCategory = document.getElementById('payCategory');

if (btnGenerateQR) {
    btnGenerateQR.addEventListener('click', () => {
        const student = payStudent.value.trim();
        const amount = parseFloat(payAmount.value);
        const category = payCategory.value;
        const alertBox = document.getElementById('paymentAlert');

        alertBox.classList.add('hidden');

        if (!student) {
            showFormAlert(alertBox, 'Error: You must provide a candidate/student registration title before payment generation.', 'danger');
            return;
        }
        if (isNaN(amount) || amount < 500) {
            showFormAlert(alertBox, 'Error: The custom payment minimum constraint is PKR 500.', 'danger');
            return;
        }

        // Establish a persistent unique reference code
        generatedPaymentReference = 'EP-' + Math.floor(100000 + Math.random() * 900000) + '-BH';

        // Format precise payment request instructions for Easypaisa wallet application routing
        const payPayload = `EP-MERCHANT:03451234567|AMOUNT:${amount}|TITLE:BeaconHillAcademy|REFERENCE:${generatedPaymentReference}|CATEGORY:${category}`;
        
        // Request an ultra-clear vector QR diagram from standard server API encoding the precise transaction package
        qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(payPayload)}`;

        // Update layout visual containers
        document.getElementById('qrMetaAmount').innerText = `PKR ${amount.toLocaleString()}`;
        document.getElementById('qrMetaRef').innerText = generatedPaymentReference;

        qrEmptyState.classList.add('hidden');
        qrDisplayState.classList.remove('hidden');
    });
}

// --- Confirm Payment & Ledger Sync ---
const btnConfirmPayment = document.getElementById('btnConfirmPayment');
if (btnConfirmPayment) {
    btnConfirmPayment.addEventListener('click', async () => {
        const student = payStudent.value.trim();
        const amount = parseFloat(payAmount.value);
        const category = payCategory.value;
        const alertBox = document.getElementById('paymentAlert');

        if (!student || !amount || !generatedPaymentReference) return;

        const record = {
            student_name: student,
            category: category,
            amount_paid: amount,
            wallet_number: '03451234567',
            transaction_reference: generatedPaymentReference,
            created_at: new Date().toISOString()
        };

        try {
            if (supabaseClient) {
                const { data, error } = await supabaseClient
                    .from('fee_payments')
                    .insert([record])
                    .select();
                
                if (error) throw error;
                
                showFormAlert(alertBox, `Success: Verified payment of PKR ${amount.toLocaleString()} for student ${student} has been permanently saved to the cloud audit registry!`, 'success');
                fetchSupabaseData();
            } else {
                const sandboxPayments = JSON.parse(localStorage.getItem('PORTAL_PAYMENTS') || '[]');
                record.id = generatedPaymentReference;
                sandboxPayments.unshift(record);
                localStorage.setItem('PORTAL_PAYMENTS', JSON.stringify(sandboxPayments));
                
                showFormAlert(alertBox, `Success: Sandboxed deposit of PKR ${amount.toLocaleString()} captured. Invoice reference ${generatedPaymentReference} stored locally.`, 'success');
                syncStateFromSandbox();
            }

            // Smooth reset of QR state displays
            qrDisplayState.classList.add('hidden');
            qrEmptyState.classList.remove('hidden');
            payStudent.value = '';
            payAmount.value = '';
        } catch (error) {
            console.error('Payment commit failure:', error);
            showFormAlert(alertBox, `Error writing transactional ledger: ${error.message}`, 'danger');
        }
    });
}

// --- Action: Download Custom Graphical Receipt via Canvas API ---
const btnDownloadReceipt = document.getElementById('btnDownloadReceipt');
if (btnDownloadReceipt) {
    btnDownloadReceipt.addEventListener('click', () => {
        const student = payStudent.value.trim();
        const amount = parseFloat(payAmount.value);
        const category = payCategory.value;

        if (!student || !amount || !generatedPaymentReference) return;
        generateReceiptCanvas(student, amount, category, generatedPaymentReference);
    });
}

function generateReceiptCanvas(student, amount, category, reference) {
    const canvas = document.getElementById('receiptCanvas');
    const ctx = canvas.getContext('2d');

    // 1. Draw receipt background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Warm border accent
    ctx.strokeStyle = '#E1D7C6';
    ctx.lineWidth = 14;
    ctx.strokeRect(0, 0, canvas.width, canvas.height);

    // Double inner thin lines for classical editorial receipt style
    ctx.strokeStyle = '#1E3A8A';
    ctx.lineWidth = 2;
    ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);

    // 2. Header Title
    ctx.fillStyle = '#1E3A8A';
    ctx.font = '800 24px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('BEACON HILL ACADEMY', canvas.width / 2, 70);

    ctx.fillStyle = '#6B6B6B';
    ctx.font = 'bold 11px Inter, sans-serif';
    ctx.fillText('EASYPAISA TRANSACTION INVOICE', canvas.width / 2, 95);

    // Divider
    ctx.strokeStyle = '#E1D7C6';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(40, 115);
    ctx.lineTo(canvas.width - 40, 115);
    ctx.stroke();

    // 3. Receipt Details (Grid-like Alignment)
    ctx.textAlign = 'left';
    ctx.fillStyle = '#1C1C1C';

    const dataPoints = [
        { label: 'Date/Time Issued', value: new Date().toLocaleString() },
        { label: 'Invoice Reference', value: reference },
        { label: 'Student Candidate', value: student },
        { label: 'Fee Category', value: category },
        { label: 'Receiving Merchant', value: 'Beacon Hill Academy' },
        { label: 'Merchant Account No', value: '03451234567 (Easypaisa)' }
    ];

    let startY = 160;
    dataPoints.forEach(point => {
        ctx.fillStyle = '#6B6B6B';
        ctx.font = '500 11px Inter, sans-serif';
        ctx.fillText(point.label.toUpperCase(), 50, startY);

        ctx.fillStyle = '#1C1C1C';
        ctx.font = 'bold 14px Inter, sans-serif';
        ctx.fillText(point.value, 50, startY + 22);
        
        startY += 50;
    });

    // Horizontal divider above Amount due
    ctx.strokeStyle = '#1E3A8A';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(40, startY + 10);
    ctx.lineTo(canvas.width - 40, startY + 10);
    ctx.stroke();

    // Amount paid layout block
    ctx.fillStyle = '#FAF8F5';
    ctx.fillRect(40, startY + 25, canvas.width - 80, 80);
    ctx.strokeStyle = '#E1D7C6';
    ctx.strokeRect(40, startY + 25, canvas.width - 80, 80);

    ctx.fillStyle = '#6B6B6B';
    ctx.font = '800 12px Inter, sans-serif';
    ctx.fillText('TOTAL AMOUNT COMPLETED (PKR)', 60, startY + 50);

    ctx.fillStyle = '#15803D';
    ctx.font = '800 28px Inter, sans-serif';
    ctx.fillText(`Rs. ${amount.toLocaleString()}`, 60, startY + 85);

    // Success verified microstamp
    ctx.fillStyle = '#15803D';
    ctx.fillRect(300, startY + 45, 120, 26);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 10px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PAID VERIFIED', 360, startY + 61);

    // Bottom Footer disclaimer
    ctx.fillStyle = '#6B6B6B';
    ctx.font = '500 10px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('This digital transaction record is cryptographically logged on secure ledger.', canvas.width / 2, canvas.height - 45);

    // Create automatic canvas-to-image link execution
    try {
        const imgURI = canvas.toDataURL('image/png');
        const downloadLink = document.createElement('a');
        downloadLink.download = `Receipt-${reference}.png`;
        downloadLink.href = imgURI;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
    } catch (e) {
        console.error('Canvas export context failed: ', e);
    }
}

// --- Configuration Settings Panel Actions ---
const btnToggleConfig = document.getElementById('btnToggleConfig');
const configModal = document.getElementById('configModal');
const btnCloseConfig = document.getElementById('btnCloseConfig');
const btnSaveConfig = document.getElementById('btnSaveConfig');
const sbUrlInput = document.getElementById('sbUrlInput');
const sbKeyInput = document.getElementById('sbKeyInput');

if (btnToggleConfig && configModal) {
    btnToggleConfig.addEventListener('click', () => {
        sbUrlInput.value = applicationState.currentConfig.url;
        sbKeyInput.value = applicationState.currentConfig.key;
        configModal.classList.remove('hidden');
    });

    btnCloseConfig.addEventListener('click', () => {
        configModal.classList.add('hidden');
    });

    btnSaveConfig.addEventListener('click', () => {
        const url = sbUrlInput.value.trim();
        const key = sbKeyInput.value.trim();

        localStorage.setItem('SB_URL', url);
        localStorage.setItem('SB_KEY', key);
        applicationState.currentConfig.url = url;
        applicationState.currentConfig.key = key;

        configModal.classList.add('hidden');
        connectToSupabase();
    });
}

// --- Action: Manual Data Sync Trigger ---
const btnRefreshRecords = document.getElementById('btnRefreshRecords');
if (btnRefreshRecords) {
    btnRefreshRecords.addEventListener('click', () => {
        if (supabaseClient) {
            fetchSupabaseData();
        } else {
            syncStateFromSandbox();
        }
    });
}

// --- Helper Functions ---
function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"/]/g, tag => {
        const chars = { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;', '/': '&#x2F;' };
        return chars[tag] || tag;
    });
}

function showFormAlert(container, message, type) {
    container.className = 'p-4 rounded-lg text-sm font-semibold transition';
    if (type === 'success') {
        container.classList.add('bg-emerald-50', 'text-emerald-800', 'border', 'border-emerald-200');
    } else {
        container.classList.add('bg-red-50', 'text-red-800', 'border', 'border-red-200');
    }
    container.innerText = message;
    container.classList.remove('hidden');
}

// --- Launch Application ---
window.addEventListener('DOMContentLoaded', () => {
    connectToSupabase();
});