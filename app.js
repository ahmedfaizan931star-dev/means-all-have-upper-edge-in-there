/**
 * Veritas Academy - Unified Logical Controller
 * Handles client-side view management, automated state transitions, 
 * Easypaisa dynamic merchant-payload QR generation, and real-time Supabase sync.
 */

const STATE = {
    students: [],
    transactions: [],
    supabase: null,
    isCloud: false
};

// Initial Seed Dataset for out-of-the-box operation
const DEMO_STUDENTS = [
    { id: 'VER-2023-101', name: 'Faizan Ahmed', email: 'faizan@example.com', phone: '+92 300 1234567', grade: 'O-Levels', outstanding_balance: 15000, sync_method: 'local' },
    { id: 'VER-2023-102', name: 'Zainab Bibi', email: 'zainab@example.com', phone: '+92 321 9876543', grade: 'A-Levels', outstanding_balance: 20000, sync_method: 'local' }
];

const DEMO_TRANSACTIONS = [
    { id: 'TXN-901842', student_id: 'VER-2023-101', amount: 15000, reference: 'EP-REF-8910', timestamp: new Date(Date.now() - 3600000 * 24).toLocaleString() }
];

// Initialize system on lock
document.addEventListener('DOMContentLoaded', () => {
    initStorage();
    setupNavigation();
    setupAdmissionForm();
    setupPaymentSystem();
    setupAdminConsole();
    renderAdminTables();
});

// 1. DATA SYNCHRONIZATION ENGINE
function initStorage() {
    const sbUrl = localStorage.getItem('supabase_url');
    const sbKey = localStorage.getItem('supabase_key');

    if (sbUrl && sbKey) {
        try {
            // Instantiates real Supabase SDK integration
            STATE.supabase = window.supabase.createClient(sbUrl, sbKey);
            STATE.isCloud = true;
            document.getElementById('sb-url').value = sbUrl;
            document.getElementById('sb-key').value = sbKey;
            updateDatabaseStatus(true);
            pullFromCloud();
            return;
        } catch (e) {
            console.error('Supabase failed initialization. Reverting safely to local container.', e);
        }
    }

    // Offline Local Engine Fallback
    updateDatabaseStatus(false);
    if (!localStorage.getItem('local_students')) {
        localStorage.setItem('local_students', JSON.stringify(DEMO_STUDENTS));
        localStorage.setItem('local_transactions', JSON.stringify(DEMO_TRANSACTIONS));
    }
    STATE.students = JSON.parse(localStorage.getItem('local_students'));
    STATE.transactions = JSON.parse(localStorage.getItem('local_transactions'));
}

function updateDatabaseStatus(isOnline) {
    const badge = document.getElementById('db-status-badge');
    if (isOnline) {
        badge.textContent = 'Supabase Cloud Sync';
        badge.className = 'db-badge online';
    } else {
        badge.textContent = 'Local Sandbox Active';
        badge.className = 'db-badge offline';
    }
}

async function pullFromCloud() {
    if (!STATE.isCloud) return;
    try {
        let { data: students, error: stdError } = await STATE.supabase.from('students').select('*');
        let { data: txns, error: txnError } = await STATE.supabase.from('transactions').select('*');

        if (stdError || txnError) throw new Error('Query error');
        
        STATE.students = students || [];
        STATE.transactions = txns || [];
        renderAdminTables();
    } catch (err) {
        console.warn('Could not complete query on custom Supabase setup. Using local fallback schemas.', err);
        STATE.isCloud = false;
        updateDatabaseStatus(false);
    }
}

async function saveStudent(student) {
    STATE.students.push(student);
    if (STATE.isCloud) {
        try {
            await STATE.supabase.from('students').insert([student]);
        } catch (e) {
            console.error('Failed pushing to cloud db. Saving locally.', e);
        }
    }
    localStorage.setItem('local_students', JSON.stringify(STATE.students));
    renderAdminTables();
}

async function updateOutstandingBalance(studentId, deductionAmount) {
    const student = STATE.students.find(s => s.id === studentId);
    if (student) {
        student.outstanding_balance = Math.max(0, student.outstanding_balance - deductionAmount);
        
        if (STATE.isCloud) {
            try {
                await STATE.supabase
                    .from('students')
                    .update({ outstanding_balance: student.outstanding_balance })
                    .eq('id', studentId);
            } catch (e) {
                console.error('Failed syncing updated balance to cloud.', e);
            }
        }
        localStorage.setItem('local_students', JSON.stringify(STATE.students));
        renderAdminTables();
    }
}

async function saveTransaction(txn) {
    STATE.transactions.unshift(txn);
    if (STATE.isCloud) {
        try {
            await STATE.supabase.from('transactions').insert([txn]);
        } catch (e) {
            console.error('Failed pushing transaction history to cloud.', e);
        }
    }
    localStorage.setItem('local_transactions', JSON.stringify(STATE.transactions));
    renderAdminTables();
}

// 2. NAV CONTROLS
function setupNavigation() {
    const navButtons = document.querySelectorAll('.nav-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');

    navButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            const targetTab = e.currentTarget.getAttribute('data-tab');
            
            navButtons.forEach(btn => btn.classList.remove('active'));
            tabPanes.forEach(pane => pane.classList.remove('active'));

            e.currentTarget.classList.add('active');
            document.getElementById(`${targetTab}-tab`).classList.add('active');
        });
    });
}

// 3. ADMISSION CALCULATOR
function setupAdmissionForm() {
    const form = document.getElementById('admission-form');
    const gradeSelect = document.getElementById('student-grade');
    
    const summaryProgram = document.getElementById('summary-program');
    const summaryAdmission = document.getElementById('summary-admission-fee');
    const summaryTuition = document.getElementById('summary-tuition-fee');
    const summaryTotal = document.getElementById('summary-total');

    // Auto calculate initial dues display based on choice selection
    gradeSelect.addEventListener('change', () => {
        const selectedOption = gradeSelect.options[gradeSelect.selectedIndex];
        const admissionFee = parseInt(selectedOption.getAttribute('data-admission-fee')) || 0;
        const tuitionFee = parseInt(selectedOption.getAttribute('data-tuition-fee')) || 0;
        const total = admissionFee + tuitionFee;

        summaryProgram.textContent = selectedOption.value;
        summaryAdmission.textContent = `PKR ${admissionFee.toLocaleString()}`;
        summaryTuition.textContent = `PKR ${tuitionFee.toLocaleString()}`;
        summaryTotal.textContent = `PKR ${total.toLocaleString()}`;
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const name = document.getElementById('student-name').value.trim();
        const email = document.getElementById('student-email').value.trim();
        const phone = document.getElementById('student-phone').value.trim();
        const address = document.getElementById('student-address').value.trim();
        const gradeOption = gradeSelect.options[gradeSelect.selectedIndex];
        
        const admissionFee = parseInt(gradeOption.getAttribute('data-admission-fee')) || 0;
        const tuitionFee = parseInt(gradeOption.getAttribute('data-tuition-fee')) || 0;
        const initialDues = admissionFee + tuitionFee;

        // Unique ID Generation pattern
        const uniqueId = `VER-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;

        const newStudent = {
            id: uniqueId,
            name,
            email,
            phone,
            address,
            grade: gradeOption.value,
            outstanding_balance: initialDues,
            sync_method: STATE.isCloud ? 'cloud' : 'local'
        };

        await saveStudent(newStudent);

        alert(`Application Submitted!\nStudentID Generated: ${uniqueId}\nOutstanding Balance set to PKR ${initialDues.toLocaleString()}`);
        
        form.reset();
        summaryProgram.textContent = 'None';
        summaryAdmission.textContent = 'PKR 0';
        summaryTuition.textContent = 'PKR 0';
        summaryTotal.textContent = 'PKR 0';

        // Auto-pivot to fee portal panel with prefilled student credentials
        document.querySelector('[data-tab="payment"]').click();
        document.getElementById('search-student-id').value = uniqueId;
        document.getElementById('btn-search-student').click();
    });
}

// 4. EASYPAISA QR BILLING ENGINE
function setupPaymentSystem() {
    const btnSearch = document.getElementById('btn-search-student');
    const searchInput = document.getElementById('search-student-id');
    const paymentPanel = document.getElementById('payment-student-info');
    const emptyState = document.getElementById('lookup-empty-state');
    
    const payName = document.getElementById('pay-student-name');
    const payDetails = document.getElementById('pay-student-details');
    const payOutstanding = document.getElementById('pay-outstanding-bal');
    
    const customAmountInput = document.getElementById('custom-pay-amount');
    const presetButtons = document.querySelectorAll('.preset-btn');
    const presetFullDue = document.getElementById('preset-full-due');

    const qrCard = document.getElementById('qr-payment-card');
    const qrShield = document.querySelector('.qr-shield-overlay');
    const qrImg = document.getElementById('easypaisa-qr-img');
    const invoiceAmount = document.getElementById('invoice-amount-display');
    const invoiceRef = document.getElementById('invoice-ref-code');
    const btnConfirm = document.getElementById('btn-confirm-payment');

    let activeStudent = null;
    let calculatedPayment = 0;
    let generatedRefCode = '';

    btnSearch.addEventListener('click', () => {
        const searchId = searchInput.value.trim().toUpperCase();
        const student = STATE.students.find(s => s.id.toUpperCase() === searchId);

        if (!student) {
            alert('Record not found. Search for a valid ID (like: VER-2023-101) or register a new applicant.');
            paymentPanel.classList.add('hidden');
            emptyState.classList.remove('hidden');
            lockPaymentInvoice();
            return;
        }

        activeStudent = student;
        payName.textContent = student.name;
        payDetails.textContent = `${student.grade} | ${student.email}`;
        payOutstanding.textContent = `PKR ${student.outstanding_balance.toLocaleString()}`;

        paymentPanel.classList.remove('hidden');
        emptyState.classList.add('hidden');
        
        customAmountInput.value = '';
        customAmountInput.max = student.outstanding_balance;
        lockPaymentInvoice();
    });

    presetButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (!activeStudent) return;
            const amount = parseInt(e.currentTarget.getAttribute('data-amount'));
            customAmountInput.value = Math.min(amount, activeStudent.outstanding_balance);
            triggerQRGeneration();
        });
    });

    presetFullDue.addEventListener('click', () => {
        if (!activeStudent) return;
        customAmountInput.value = activeStudent.outstanding_balance;
        triggerQRGeneration();
    });

    customAmountInput.addEventListener('input', () => {
        triggerQRGeneration();
    });

    // Dynamic QR generation
    function triggerQRGeneration() {
        const payVal = parseInt(customAmountInput.value);
        if (!payVal || payVal <= 0) {
            lockPaymentInvoice();
            return;
        }

        if (payVal > activeStudent.outstanding_balance) {
            alert('Payment value cannot exceed current outstanding balance.');
            customAmountInput.value = activeStudent.outstanding_balance;
            triggerQRGeneration();
            return;
        }

        calculatedPayment = payVal;
        generatedRefCode = `VR-${Math.floor(100000 + Math.random() * 900000)}`;

        qrCard.classList.remove('locked');
        qrShield.classList.add('hidden');
        qrImg.classList.remove('hidden');
        
        invoiceAmount.textContent = `PKR ${calculatedPayment.toLocaleString()}`;
        invoiceRef.textContent = generatedRefCode;
        btnConfirm.disabled = false;

        // Custom mobile schema uri query pointing to merchant account (re-generated on amount change)
        const merchantPayload = `easypaisa://pay?merchant=031024345&amount=${calculatedPayment}&ref=${generatedRefCode}`;
        qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(merchantPayload)}&color=0b0f19&bgcolor=ffffff`;
    }

    function lockPaymentInvoice() {
        qrCard.classList.add('locked');
        qrShield.classList.remove('hidden');
        qrImg.classList.add('hidden');
        invoiceAmount.textContent = 'PKR 0';
        invoiceRef.textContent = '-';
        btnConfirm.disabled = true;
    }

    // Instant bank settlement animation
    btnConfirm.addEventListener('click', async () => {
        if (!activeStudent || calculatedPayment <= 0) return;

        btnConfirm.disabled = true;
        btnConfirm.textContent = 'Settling funds...';

        setTimeout(async () => {
            const newTxnId = `TXN-${Math.floor(100000 + Math.random() * 900000)}`;
            const newTxn = {
                id: newTxnId,
                student_id: activeStudent.id,
                amount: calculatedPayment,
                reference: generatedRefCode,
                timestamp: new Date().toLocaleString()
            };

            await saveTransaction(newTxn);
            await updateOutstandingBalance(activeStudent.id, calculatedPayment);

            // Populate Success Modal e-Receipt
            document.getElementById('rec-id').textContent = newTxnId;
            document.getElementById('rec-stud-id').textContent = activeStudent.id;
            document.getElementById('rec-stud-name').textContent = activeStudent.name;
            document.getElementById('rec-amount').textContent = `PKR ${calculatedPayment.toLocaleString()}`;
            document.getElementById('rec-ref').textContent = generatedRefCode;
            document.getElementById('rec-date').textContent = newTxn.timestamp;

            document.getElementById('receipt-modal').classList.add('active');

            // Form Reset
            btnConfirm.textContent = 'Simulate Scan & Confirm';
            lockPaymentInvoice();
            paymentPanel.classList.add('hidden');
            emptyState.classList.remove('hidden');
            searchInput.value = '';
        }, 1500);
    });

    document.getElementById('btn-close-receipt').addEventListener('click', () => {
        document.getElementById('receipt-modal').classList.remove('active');
    });
}

// 5. ADMIN UTILS
function setupAdminConsole() {
    const btnSave = document.getElementById('btn-save-db-config');
    const btnReset = document.getElementById('btn-reset-demo-db');

    btnSave.addEventListener('click', () => {
        const url = document.getElementById('sb-url').value.trim();
        const key = document.getElementById('sb-key').value.trim();

        if (!url || !key) {
            alert('Both URL and Public key are mandatory for live Supabase integration.');
            return;
        }

        localStorage.setItem('supabase_url', url);
        localStorage.setItem('supabase_key', key);
        alert('Supabase credentials locked. Attempting live DB sync...');
        initStorage();
    });

    btnReset.addEventListener('click', () => {
        if (confirm('Revert back to isolated Sandbox fallback storage?')) {
            localStorage.removeItem('supabase_url');
            localStorage.removeItem('supabase_key');
            localStorage.removeItem('local_students');
            localStorage.removeItem('local_transactions');
            document.getElementById('sb-url').value = '';
            document.getElementById('sb-key').value = '';
            initStorage();
            alert('Reverted to secure sandbox database model.');
        }
    });
}

// Programmatic DOM construction to ensure absolute immunity against XSS injection vulnerabilities
function renderAdminTables() {
    const studentBody = document.getElementById('admin-students-tbody');
    const txnBody = document.getElementById('admin-transactions-tbody');

    studentBody.innerHTML = '';
    txnBody.innerHTML = '';

    if (STATE.students.length === 0) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 5;
        td.style.textAlign = 'center';
        td.textContent = 'No Students Registered';
        tr.appendChild(td);
        studentBody.appendChild(tr);
    } else {
        STATE.students.forEach(student => {
            const tr = document.createElement('tr');

            const tdId = document.createElement('td');
            const strongId = document.createElement('strong');
            strongId.textContent = student.id;
            tdId.appendChild(strongId);

            const tdName = document.createElement('td');
            tdName.textContent = student.name;

            const tdGrade = document.createElement('td');
            tdGrade.textContent = student.grade;

            const tdBalance = document.createElement('td');
            tdBalance.textContent = `PKR ${student.outstanding_balance.toLocaleString()}`;

            const tdSync = document.createElement('td');
            const spanBadge = document.createElement('span');
            spanBadge.className = `db-badge ${STATE.isCloud ? 'online' : 'offline'}`;
            spanBadge.textContent = STATE.isCloud ? 'Synced to Cloud' : 'Sandbox Only';
            tdSync.appendChild(spanBadge);

            tr.appendChild(tdId);
            tr.appendChild(tdName);
            tr.appendChild(tdGrade);
            tr.appendChild(tdBalance);
            tr.appendChild(tdSync);

            studentBody.appendChild(tr);
        });
    }

    if (STATE.transactions.length === 0) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 5;
        td.style.textAlign = 'center';
        td.textContent = 'No Transactions Ledgered';
        tr.appendChild(td);
        txnBody.appendChild(tr);
    } else {
        STATE.transactions.forEach(txn => {
            const tr = document.createElement('tr');

            const tdTxnId = document.createElement('td');
            const strongTxnId = document.createElement('strong');
            strongTxnId.textContent = txn.id;
            tdTxnId.appendChild(strongTxnId);

            const tdStudId = document.createElement('td');
            tdStudId.textContent = txn.student_id;

            const tdAmount = document.createElement('td');
            tdAmount.className = 'success-color';
            tdAmount.textContent = `PKR ${txn.amount.toLocaleString()}`;

            const tdRef = document.createElement('td');
            tdRef.textContent = txn.reference;

            const tdTime = document.createElement('td');
            tdTime.textContent = txn.timestamp;

            tr.appendChild(tdTxnId);
            tr.appendChild(tdStudId);
            tr.appendChild(tdAmount);
            tr.appendChild(tdRef);
            tr.appendChild(tdTime);

            txnBody.appendChild(tr);
        });
    }
}