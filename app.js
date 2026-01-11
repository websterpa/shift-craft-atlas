// Data storage
let employees = [];
let shifts = [];
let idCounter = Date.now();

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    renderEmployees();
    renderSchedule();
    updateEmployeeSelect();
    setDefaultDate();
});

// Set default date to today
function setDefaultDate() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('shiftDate').value = today;
}

// Load data from localStorage
function loadData() {
    try {
        const savedEmployees = localStorage.getItem('employees');
        const savedShifts = localStorage.getItem('shifts');
        
        if (savedEmployees) {
            employees = JSON.parse(savedEmployees);
        }
        
        if (savedShifts) {
            shifts = JSON.parse(savedShifts);
        }
    } catch (error) {
        console.error('Error loading data from localStorage:', error);
        // Reset to empty arrays if data is corrupted
        employees = [];
        shifts = [];
        localStorage.removeItem('employees');
        localStorage.removeItem('shifts');
    }
}

// Save data to localStorage
function saveData() {
    localStorage.setItem('employees', JSON.stringify(employees));
    localStorage.setItem('shifts', JSON.stringify(shifts));
}

// Employee Management
function addEmployee() {
    const nameInput = document.getElementById('employeeName');
    const roleInput = document.getElementById('employeeRole');
    
    const name = nameInput.value.trim();
    const role = roleInput.value.trim();
    
    if (!name) {
        alert('Please enter employee name');
        return;
    }
    
    const employee = {
        id: ++idCounter,
        name: name,
        role: role || 'Staff'
    };
    
    employees.push(employee);
    saveData();
    
    nameInput.value = '';
    roleInput.value = '';
    
    renderEmployees();
    updateEmployeeSelect();
}

function deleteEmployee(id) {
    if (confirm('Are you sure you want to delete this employee? All their shifts will also be removed.')) {
        employees = employees.filter(emp => emp.id !== id);
        shifts = shifts.filter(shift => shift.employeeId !== id);
        saveData();
        renderEmployees();
        updateEmployeeSelect();
        renderSchedule();
    }
}

function renderEmployees() {
    const container = document.getElementById('employeeList');
    
    if (employees.length === 0) {
        container.innerHTML = '<div class="empty-state">No employees added yet</div>';
        return;
    }
    
    container.innerHTML = employees.map(emp => `
        <div class="employee-item">
            <div class="employee-info">
                <div class="employee-name">${escapeHtml(emp.name)}</div>
                <div class="employee-role">${escapeHtml(emp.role)}</div>
            </div>
            <button class="delete-btn" onclick="deleteEmployee(${emp.id})">Delete</button>
        </div>
    `).join('');
}

function updateEmployeeSelect() {
    const select = document.getElementById('shiftEmployee');
    const currentValue = select.value;
    
    select.innerHTML = '<option value="">Select employee</option>' + 
        employees.map(emp => `
            <option value="${emp.id}">${escapeHtml(emp.name)} - ${escapeHtml(emp.role)}</option>
        `).join('');
    
    if (currentValue) {
        select.value = currentValue;
    }
}

// Shift Management
function addShift() {
    const employeeId = document.getElementById('shiftEmployee').value;
    const date = document.getElementById('shiftDate').value;
    const startTime = document.getElementById('shiftStartTime').value;
    const endTime = document.getElementById('shiftEndTime').value;
    const role = document.getElementById('shiftRole').value.trim();
    
    if (!employeeId) {
        alert('Please select an employee');
        return;
    }
    
    if (!date) {
        alert('Please select a date');
        return;
    }
    
    if (!startTime || !endTime) {
        alert('Please enter start and end times');
        return;
    }
    
    const employee = employees.find(emp => emp.id === parseInt(employeeId));
    
    const shift = {
        id: ++idCounter,
        employeeId: parseInt(employeeId),
        employeeName: employee.name,
        date: date,
        startTime: startTime,
        endTime: endTime,
        role: role || employee.role
    };
    
    shifts.push(shift);
    saveData();
    
    document.getElementById('shiftRole').value = '';
    
    renderSchedule();
    alert('Shift created successfully!');
}

function deleteShift(id) {
    if (confirm('Are you sure you want to delete this shift?')) {
        shifts = shifts.filter(shift => shift.id !== id);
        saveData();
        renderSchedule();
    }
}

function renderSchedule() {
    const container = document.getElementById('scheduleContainer');
    const filterDate = document.getElementById('filterDate').value;
    
    let filteredShifts = shifts;
    
    if (filterDate) {
        filteredShifts = shifts.filter(shift => shift.date === filterDate);
    }
    
    if (filteredShifts.length === 0) {
        container.innerHTML = '<div class="empty-state">No shifts scheduled' + 
            (filterDate ? ' for this date' : '') + '</div>';
        return;
    }
    
    // Sort by date and start time
    filteredShifts.sort((a, b) => {
        if (a.date !== b.date) {
            return a.date.localeCompare(b.date);
        }
        return a.startTime.localeCompare(b.startTime);
    });
    
    container.innerHTML = filteredShifts.map(shift => {
        const duration = calculateDuration(shift.startTime, shift.endTime);
        return `
            <div class="shift-card">
                <div class="shift-info">
                    <div class="shift-employee">${escapeHtml(shift.employeeName)}</div>
                    <div class="shift-details">
                        <span class="shift-time">📅 ${formatDate(shift.date)}</span> | 
                        <span class="shift-time">🕐 ${shift.startTime} - ${shift.endTime}</span> 
                        (${duration})
                    </div>
                    <div class="shift-details">👔 ${escapeHtml(shift.role)}</div>
                </div>
                <button class="delete-btn" onclick="deleteShift(${shift.id})">Delete</button>
            </div>
        `;
    }).join('');
}

function clearFilter() {
    document.getElementById('filterDate').value = '';
    renderSchedule();
}

// Utility functions
function calculateDuration(startTime, endTime) {
    const start = new Date(`2000-01-01T${startTime}`);
    let end = new Date(`2000-01-01T${endTime}`);
    
    // Handle shifts that cross midnight
    if (end <= start) {
        end = new Date(`2000-01-02T${endTime}`);
    }
    
    const diff = (end - start) / (1000 * 60 * 60);
    return `${diff}h`;
}

function formatDate(dateString) {
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('en-US', { 
        weekday: 'short', 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
