// DOM элементы
const startShiftBtn = document.getElementById('startShift');
const endShiftBtn = document.getElementById('endShift');
const addShiftBtn = document.getElementById('addShift');
const hourlyRateInput = document.getElementById('hourlyRate');
const paidLunchInput = document.getElementById('paidLunch');
const taxDeductionInput = document.getElementById('taxDeduction');
const taxRateInput = document.getElementById('taxRate');
const taxRateContainer = document.getElementById('taxRateContainer');
const taxPresetBtns = document.querySelectorAll('.tax-preset-btn');
const currentStatus = document.getElementById('currentStatus');
const currentShiftTime = document.getElementById('currentShiftTime');
const shiftsTableBody = document.getElementById('shiftsTableBody');
const totalTimeElement = document.getElementById('totalTime');
const totalEarnedElement = document.getElementById('totalEarned');
const tabButtons = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');
const shiftModal = document.getElementById('shiftModal');
const shiftForm = document.getElementById('shiftForm');
const closeModalBtn = document.getElementById('closeModal');
const saveShiftBtn = document.getElementById('saveShift');
const themeSwitch = document.getElementById('themeSwitch');
const toolsBtn = document.getElementById('toolsBtn');
const toolsContent = document.getElementById('toolsContent');
const calendarTab = document.getElementById('calendar');
const currencySelector = document.getElementById('currencySelector');
const notificationBar = document.createElement('div');
notificationBar.className = 'notification-bar';
document.body.appendChild(notificationBar);
const lunchDurationInput = document.getElementById('lunchDurationInput');

// Состояние приложения
let shifts = JSON.parse(localStorage.getItem('shifts')) || [];
let currentShift = null;
let timerInterval = null;
let editingShiftId = null;
let settings = JSON.parse(localStorage.getItem('settings')) || {
    theme: 'light',
    currency: 'UAH',
    conversionRates: {}
};
let notifications = [];
let calendarState = {
    currentMonth: new Date().getMonth(),
    currentYear: new Date().getFullYear()
};
let workplaces = JSON.parse(localStorage.getItem('workplaces')) || [];
let archivedTables = JSON.parse(localStorage.getItem('archivedTables')) || [];

// Добавляем глобальные переменные для пагинации мобильной версии
let mobilePage = 1;
const mobileShiftsPerPage = 10;

// Инициализация приложения
function init() {
    renderShiftsTable();
    updateSummary();
    setupCharts();
    setupEventListeners();
    loadSettings();
    
    // Инициализация состояния галочки налога
    if (taxDeductionInput.checked) {
        taxRateContainer.classList.add('active');
    }
    
    // Загрузка статистики
    updateStatistics();
    
    // Check for upcoming shifts and display notifications
    checkUpcomingShifts();
    
    // Initialize calendar tab
    setupCalendarTab();
    
    // Initialize currency selector with current value
    if (currencySelector) {
        currencySelector.value = settings.currency || 'UAH';
    }
    
    // Load exchange rates
    fetchExchangeRates();
    
    // Schedule next notification check
    setTimeout(checkNotifications, 60000); // Check every minute
    
    updateGlobalWorkplaceDropdown();
}

// Настройка обработчиков событий
function setupEventListeners() {
    startShiftBtn.addEventListener('click', startShift);
    endShiftBtn.addEventListener('click', endShift);
    addShiftBtn.addEventListener('click', openAddShiftModal);
    hourlyRateInput.addEventListener('change', updateSummary);
    paidLunchInput.addEventListener('change', updateSummary);
    taxDeductionInput.addEventListener('change', function() {
        taxRateContainer.classList.toggle('active', this.checked);
        updateSummary();
    });
    taxRateInput.addEventListener('change', updateSummary);
    
    // Обработчики для кнопок предустановленных ставок налога
    taxPresetBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const rate = parseInt(btn.dataset.rate);
            taxRateInput.value = rate;
            
            taxPresetBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            updateSummary();
        });
    });
    
    closeModalBtn.addEventListener('click', closeModal);
    shiftForm.addEventListener('submit', (e) => {
        e.preventDefault();
        saveShift();
    });
    
    // Закрытие модального окна при клике вне его
    window.addEventListener('click', (e) => {
        if (e.target === shiftModal) {
            closeModal();
        }
    });
    
    // Переключение вкладок
    const allTabButtons = document.querySelectorAll('.tab-btn');
    
    // Setup consistent tab event listeners for all tab buttons
    allTabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.dataset.tab;
            
            allTabButtons.forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
            
            button.classList.add('active');
            document.getElementById(tabName).classList.add('active');
            
            if (tabName === 'charts') {
                setupCharts();
            } else if (tabName === 'statistics') {
                updateStatistics();
            } else if (tabName === 'calendar') {
                renderCalendar();
            }
        });
    });
    
    document.getElementById('shiftTaxDeduction').addEventListener('change', function() {
        toggleModalTaxRateVisibility();
    });
    
    // Theme switch
    themeSwitch.addEventListener('change', toggleTheme);
    
    // Tools dropdown
    toolsBtn.addEventListener('click', function() {
        toolsContent.classList.toggle('show');
    });
    
    // Close the dropdown when clicking outside
    window.addEventListener('click', function(e) {
        if (!e.target.matches('.tools-btn') && !toolsContent.contains(e.target)) {
            toolsContent.classList.remove('show');
        }
    });
    
    // Backup and restore
    document.getElementById('backupData').addEventListener('click', backupData);
    document.getElementById('restoreData').addEventListener('click', restoreData);
    document.getElementById('clearData').addEventListener('click', confirmClearData);
    
    // Add event listeners for calendar
    document.getElementById('prevMonth').addEventListener('click', () => {
        calendarState.currentMonth--;
        if (calendarState.currentMonth < 0) {
            calendarState.currentMonth = 11;
            calendarState.currentYear--;
        }
        renderCalendar();
    });

    document.getElementById('nextMonth').addEventListener('click', () => {
        calendarState.currentMonth++;
        if (calendarState.currentMonth > 11) {
            calendarState.currentMonth = 0;
            calendarState.currentYear++;
        }
        renderCalendar();
    });
    
    // Currency selector event
    if (currencySelector) {
        currencySelector.addEventListener('change', function() {
            settings.currency = this.value;
            saveSettings();
            updateSummary();
            updateStatistics();
            showNotification("Валюта змінена", `Валюта змінена на ${getCurrencySymbol(settings.currency)}`);
        });
    }
    
    // Обработчики для управління місцями роботи
    setupWorkplaceEventListeners();
    
    const useWorkplaceCheckbox = document.getElementById('useWorkplace');
    if (useWorkplaceCheckbox) {
        useWorkplaceCheckbox.addEventListener('change', function() {
            const workplaceContainer = document.getElementById('workplaceContainer');
            if (this.checked) {
                workplaceContainer.style.display = 'block';
            } else {
                workplaceContainer.style.display = 'none';
                document.getElementById('shiftWorkplace').value = "";
            }
        });
    }
    
    const useGlobalWorkplace = document.getElementById('useGlobalWorkplace');
    const globalWorkplaceContainer = document.getElementById('globalWorkplaceContainer');
    if (useGlobalWorkplace) {
        globalWorkplaceContainer.style.display = useGlobalWorkplace.checked ? 'block' : 'none';
        useGlobalWorkplace.addEventListener('change', function() {
            globalWorkplaceContainer.style.display = this.checked ? 'block' : 'none';
        });
    }
    
    const openWorkplaceModalBtn = document.getElementById('openWorkplaceModalBtn');
    if (openWorkplaceModalBtn) {
        openWorkplaceModalBtn.addEventListener('click', openWorkplaceModal);
    }
    
    // Archive functionality
    document.getElementById('openArchive').addEventListener('click', openArchiveModal);
    document.getElementById('closeArchiveModal').addEventListener('click', closeArchiveModal);
    document.getElementById('saveToArchive').addEventListener('click', saveCurrentTableToArchive);
    document.getElementById('archiveSearch').addEventListener('input', filterArchiveList);
    document.getElementById('archiveSort').addEventListener('change', sortArchiveList);
    
    document.querySelectorAll('.spoiler-toggle').forEach(button => {
        button.addEventListener('click', () => {
            const spoilerContent = button.closest('.spoiler').querySelector('.spoiler-content');
            if (spoilerContent) {
                spoilerContent.style.display = (spoilerContent.style.display === 'none' || spoilerContent.style.display === '') ? 'block' : 'none';
            }
        });
    });
}

function renderShiftsTable() {
    shiftsTableBody.innerHTML = '';
    const mobileShiftsContainer = document.getElementById('mobileShiftsContainer');
    mobileShiftsContainer.innerHTML = '';
    
    const sortedShifts = shifts.slice().sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
    
    // Отрисовка десктопной таблицы (без изменений):
    sortedShifts.forEach(shift => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${shift.date}</td>
            <td>${shift.workplaceId ? (workplaces.find(w => String(w.id) === String(shift.workplaceId))?.label || '') : ''}</td>
            <td>${formatMoney(shift.rateUsed)}</td>
            <td>${new Date(shift.startTime).toLocaleTimeString('ru-RU')}</td>
            <td>${new Date(shift.endTime).toLocaleTimeString('ru-RU')}</td>
            <td>${formatDuration(shift.duration)}</td>
            <td>${formatMoney(shift.earned)}</td>
            <td>${shift.paidLunch ? 'Да' : 'Нет'}</td>
            <td class="action-buttons">
                <button class="action-btn edit-btn" data-id="${shift.id}">✏️</button>
                <button class="action-btn delete-btn" data-id="${shift.id}">🗑️</button>
            </td>
        `;
        shiftsTableBody.appendChild(row);
    });
    
    // Отрисовка мобильной версии с пагинацией
    let pageShifts = [];
    if (sortedShifts.length > mobileShiftsPerPage) {
        const totalPages = Math.ceil(sortedShifts.length / mobileShiftsPerPage);
        if (mobilePage > totalPages) mobilePage = totalPages;
        const startIndex = (mobilePage - 1) * mobileShiftsPerPage;
        const endIndex = mobilePage * mobileShiftsPerPage;
        pageShifts = sortedShifts.slice(startIndex, endIndex);
        
        const paginationDiv = document.getElementById('mobilePagination');
        paginationDiv.innerHTML = '';
        const prevBtn = document.createElement('button');
        prevBtn.textContent = 'Предыдущая';
        prevBtn.disabled = mobilePage === 1;
        prevBtn.addEventListener('click', () => {
            mobilePage--;
            renderShiftsTable();
        });
        const pageIndicator = document.createElement('span');
        pageIndicator.textContent = ` Страница ${mobilePage} из ${totalPages} `;
        const nextBtn = document.createElement('button');
        nextBtn.textContent = 'Следующая';
        nextBtn.disabled = mobilePage === totalPages;
        nextBtn.addEventListener('click', () => {
            mobilePage++;
            renderShiftsTable();
        });
        paginationDiv.appendChild(prevBtn);
        paginationDiv.appendChild(pageIndicator);
        paginationDiv.appendChild(nextBtn);
    } else {
        pageShifts = sortedShifts;
        const paginationDiv = document.getElementById('mobilePagination');
        if (paginationDiv) {
            paginationDiv.innerHTML = '';
        }
    }
    
    // Отрисовка мобильных карточек для выбранной страницы
    pageShifts.forEach(shift => {
        const mobileCard = document.createElement('div');
        mobileCard.className = 'mobile-shift-card';
        mobileCard.innerHTML = `
            <div class="mobile-shift-header">
                <div class="mobile-shift-date">${shift.date}</div>
                <div>${formatMoney(shift.earned)}</div>
            </div>
            <div class="mobile-shift-row">
                <div class="mobile-shift-label">Место работы</div>
                <div class="mobile-shift-value">${shift.workplaceId ? (workplaces.find(w => String(w.id) === String(shift.workplaceId))?.label || '') : ''}</div>
            </div>
            <div class="mobile-shift-row">
                <div class="mobile-shift-label">Ставка</div>
                <div class="mobile-shift-value">${formatMoney(shift.rateUsed)}</div>
            </div>
            <div class="mobile-shift-row">
                <div class="mobile-shift-label">Время</div>
                <div class="mobile-shift-value">
                    ${new Date(shift.startTime).toLocaleTimeString('ru-RU', {hour: '2-digit', minute:'2-digit'})} - 
                    ${new Date(shift.endTime).toLocaleTimeString('ru-RU', {hour: '2-digit', minute:'2-digit'})}
                </div>
            </div>
            <div class="mobile-shift-row">
                <div class="mobile-shift-label">Длительность</div>
                <div class="mobile-shift-value">${formatDuration(shift.duration)}</div>
            </div>
            <div class="mobile-shift-row">
                <div class="mobile-shift-label">Оплачиваемый обед</div>
                <div class="mobile-shift-value">${shift.paidLunch ? 'Да' : 'Нет'}</div>
            </div>
            ${shift.taxDeduction ? `
            <div class="mobile-shift-row">
                <div class="mobile-shift-label">Налог (${shift.taxRate}%)</div>
                <div class="mobile-shift-value">${formatMoney(shift.taxAmount || 0)}</div>
            </div>` : ''}
            <div class="mobile-shift-actions">
                <button class="action-btn edit-btn" data-id="${shift.id}">✏️</button>
                <button class="action-btn delete-btn" data-id="${shift.id}">🗑️</button>
            </div>
        `;
        mobileShiftsContainer.appendChild(mobileCard);
    });
    
    // Повесить обработчики для кнопок редактирования и удаления
    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            openEditShiftModal(parseInt(btn.dataset.id));
        });
    });
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            deleteShift(parseInt(btn.dataset.id));
        });
    });
}

// Сохранение данных о местах работы
function saveWorkplaces() {
    localStorage.setItem('workplaces', JSON.stringify(workplaces));
}

// Обновление выпадающего списка мест работы
function updateWorkplaceDropdown() {
    const workplaceSelect = document.getElementById('shiftWorkplace');
    if (!workplaceSelect) return;
    workplaceSelect.innerHTML = '<option value="">Глобальна ставка</option>';
    let workplacesToShow = workplaces;
    // If no workplaces have been set in localStorage, use default entries
    if (!workplacesToShow || workplacesToShow.length === 0) {
        workplacesToShow = [
            { id: "1741647898929", label: "Мак", rate: 340 },
            { id: "1741647911510", label: "Глобус", rate: 470 }
        ];
    }
    workplacesToShow.forEach(wp => {
        const option = document.createElement('option');
        option.value = wp.id;
        option.textContent = `${wp.label} (${wp.rate} грн/год)`;
        workplaceSelect.appendChild(option);
    });
}

// Add new function to update the global workplace dropdown
function updateGlobalWorkplaceDropdown() {
    const globalSelector = document.getElementById('globalWorkplaceSelector');
    if (!globalSelector) return;
    globalSelector.innerHTML = '<option value="">Глобальна ставка</option>';
    let workplacesToShow = workplaces;
    // Use default entries if no workplaces exist in localStorage
    if (!workplacesToShow || workplacesToShow.length === 0) {
        workplacesToShow = [
            { id: "1741647898929", label: "Мак", rate: 340 },
            { id: "1741647911510", label: "Глобус", rate: 470 }
        ];
    }
    workplacesToShow.forEach(wp => {
        const option = document.createElement('option');
        option.value = wp.id;
        option.textContent = `${wp.label} (${wp.rate} грн/год)`;
        globalSelector.appendChild(option);
    });
}

// Notification system
function showNotification(title, message, duration = 5000) {
    notificationBar.innerHTML = `
        <div class="notification-title">
            ${title}
            <span class="close-notification">&times;</span>
        </div>
        <div class="notification-content">${message}</div>
        <div class="notification-actions">
            <button class="notification-btn">Ок</button>
        </div>
    `;
    
    notificationBar.classList.add('show');
    
    const closeBtn = notificationBar.querySelector('.close-notification');
    closeBtn.addEventListener('click', () => {
        notificationBar.classList.remove('show');
    });
    
    const okBtn = notificationBar.querySelector('.notification-btn');
    if (okBtn) {
        okBtn.addEventListener('click', () => {
            notificationBar.classList.remove('show');
        });
    }
    
    if (duration) {
        setTimeout(() => {
            notificationBar.classList.remove('show');
        }, duration);
    }
}

function checkUpcomingShifts() {
    // Check if there are any upcoming shifts (added manually for future dates)
    const now = new Date();
    const today = now.toLocaleDateString('ru-RU');
    
    // Find shifts that are scheduled for today but haven't started yet
    const todayShifts = shifts.filter(shift => {
        const shiftDate = new Date(shift.startTime);
        return shift.date === today && shiftDate > now;
    });
    
    if (todayShifts.length > 0) {
        const nextShift = todayShifts.sort((a, b) => new Date(a.startTime) - new Date(b.startTime))[0];
        const startTime = new Date(nextShift.startTime).toLocaleTimeString('ru-RU');
        
        notifications.push({
            title: "Предстояща зміна",
            message: `У вас запланована зміна сьогодні в ${startTime}`,
            timestamp: now
        });
    }
}

function checkNotifications() {
    if (notifications.length > 0) {
        const notification = notifications.shift(); // Get and remove the first notification
        showNotification(notification.title, notification.message);
    }
    
    // Schedule next check
    setTimeout(checkNotifications, 60000); // Check every minute
}

function setupAchievementsTab() {
    const achievementsTab = document.getElementById('achievements');
    
    achievementsTab.innerHTML = `
        <h2>Ваши досягнення</h2>
        <p>Відслідковуйте свій прогрес і розблокуйте досягнення.</p>
        
        <div class="achievements-list">
            <!-- Achievements will be populated here -->
        </div>
    `;
    
    updateAchievementsTab();
}

function updateAchievementsTab() {
    const achievementsList = document.querySelector('.achievements-list');
    if (!achievementsList) return;
    
    achievementsList.innerHTML = `
        <div class="achievement-card">
            <div class="achievement-icon">🏆</div>
            <div class="achievement-title">Перша зміна</div>
            <div class="achievement-desc">Запишіть свою першу робочу зміну</div>
            <div class="achievement-progress">
                <div class="achievement-progress-bar" style="width: 0%"></div>
            </div>
        </div>
    `;
}

function setupPerformanceTab() {
    const performanceTab = document.getElementById('performance');
    
    performanceTab.innerHTML = `
        <h2>Аналіз продуктивності</h2>
        <p>Детальна статистика вашої роботи за різні періоди.</p>
        
        <div class="performance-metrics">
            <!-- Performance metrics will be populated here -->
        </div>
        
        <div class="chart-container">
            <canvas id="performanceChart"></canvas>
        </div>
    `;
    
    updatePerformanceTab();
}

function updatePerformanceTab() {
    const performanceMetrics = document.querySelector('.performance-metrics');
    if (!performanceMetrics) return;
    
    const now = new Date();
    
    // This week data
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    
    const thisWeekShifts = shifts.filter(shift => new Date(shift.startTime) >= startOfWeek);
    const thisWeekHours = thisWeekShifts.reduce((total, shift) => total + (shift.duration / 3600), 0);
    const thisWeekEarnings = thisWeekShifts.reduce((total, shift) => total + shift.earned, 0);
    
    // Last week data
    const startOfLastWeek = new Date(startOfWeek);
    startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);
    
    const endOfLastWeek = new Date(startOfWeek);
    endOfLastWeek.setMilliseconds(endOfLastWeek.getMilliseconds() - 1);
    
    const lastWeekShifts = shifts.filter(shift => {
        const shiftDate = new Date(shift.startTime);
        return shiftDate >= startOfLastWeek && shiftDate < endOfLastWeek;
    });
    
    const lastWeekHours = lastWeekShifts.reduce((total, shift) => total + (shift.duration / 3600), 0);
    const lastWeekEarnings = lastWeekShifts.reduce((total, shift) => total + shift.earned, 0);
    
    const hoursChange = lastWeekHours > 0 ? ((thisWeekHours - lastWeekHours) / lastWeekHours) * 100 : 0;
    const earningsChange = lastWeekEarnings > 0 ? ((thisWeekEarnings - lastWeekEarnings) / lastWeekEarnings) * 100 : 0;
    
    // Best day
    const dayEarnings = {};
    shifts.forEach(shift => {
        const day = new Date(shift.startTime).toLocaleDateString('ru-RU');
        dayEarnings[day] = (dayEarnings[day] || 0) + shift.earned;
    });
    
    let bestDay = '';
    let bestDayEarnings = 0;
    
    for (const [day, earnings] of Object.entries(dayEarnings)) {
        if (earnings > bestDayEarnings) {
            bestDayEarnings = earnings;
            bestDay = day;
        }
    }
    
    performanceMetrics.innerHTML = `
        <div class="performance-card">
            <div class="performance-title">Години на цій неділі</div>
            <div class="performance-value">${thisWeekHours.toFixed(1)}</div>
            <div class="performance-change ${hoursChange >= 0 ? 'positive-change' : 'negative-change'}">
                ${hoursChange.toFixed(1)}% ${hoursChange >= 0 ? '↑' : '↓'} від попередньої недели
            </div>
        </div>
        
        <div class="performance-card">
            <div class="performance-title">Заробіток на цій неділі</div>
            <div class="performance-value">${formatMoney(thisWeekEarnings)}</div>
            <div class="performance-change ${earningsChange >= 0 ? 'positive-change' : 'negative-change'}">
                ${earningsChange.toFixed(1)}% ${earningsChange >= 0 ? '↑' : '↓'} від попередньої недели
            </div>
        </div>
        
        <div class="performance-card">
            <div class="performance-title">Кращий день</div>
            <div class="performance-value">${bestDay}</div>
            <div class="performance-change positive-change">
                ${formatMoney(bestDayEarnings)}
            </div>
        </div>
        
        <div class="performance-card">
            <div class="performance-title">Середній заробіток в годину</div>
            <div class="performance-value">${formatMoney(calculateAverageHourlyRate())}</div>
            <div class="performance-change">
                За весь час
            </div>
        </div>
    `;
    
    // Update performance chart
    createPerformanceChart();
}

function calculateAverageHourlyRate() {
    const totalHours = shifts.reduce((total, shift) => total + (shift.duration / 3600), 0);
    const totalEarnings = shifts.reduce((total, shift) => total + shift.earned, 0);
    
    return totalHours > 0 ? totalEarnings / totalHours : 0;
}

function createPerformanceChart() {
    const ctx = document.getElementById('performanceChart');
    if (!ctx) return;
    
    // Collect data for the last 30 days
    const days = [];
    const earnings = [];
    const hours = [];
    
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    
    for (let i = 29; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toLocaleDateString('ru-RU');
        days.push(dateStr);
        
        // Collect shifts for this day
        const dayStart = new Date(date);
        dayStart.setHours(0, 0, 0, 0);
        
        const dayEnd = new Date(date);
        dayEnd.setHours(23, 59, 59, 999);
        
        const dayShifts = shifts.filter(shift => {
            const shiftDate = new Date(shift.startTime);
            return shiftDate >= dayStart && shiftDate <= dayEnd;
        });
        
        const dayHours = dayShifts.reduce((total, shift) => total + (shift.duration / 3600), 0);
        const dayEarnings = dayShifts.reduce((total, shift) => total + shift.earned, 0);
        
        hours.push(dayHours);
        earnings.push(dayEarnings);
    }
    
    // Create chart
    if (ctx.chart) {
        ctx.chart.destroy();
    }
    
    ctx.chart = new window.Chart(ctx, {
        type: 'line',
        data: {
            labels: days,
            datasets: [
                {
                    label: 'Години',
                    data: hours,
                    borderColor: 'rgba(54, 162, 235, 1)',
                    backgroundColor: 'rgba(54, 162, 235, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.1
                },
                {
                    label: 'Заробіток (₴)',
                    data: earnings,
                    borderColor: 'rgba(75, 192, 192, 1)',
                    backgroundColor: 'rgba(75, 192, 192, 0.1)',
                    borderWidth: 2,
                    yAxisID: 'y1',
                    fill: true,
                    tension: 0.1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Продуктивність за останні 30 днів'
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Години'
                    }
                },
                y1: {
                    beginAtZero: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: 'Заробіток (₴)'
                    },
                    grid: {
                        drawOnChartArea: false
                    }
                }
            }
        }
    });
}

// Theme toggle function
function toggleTheme() {
    if (themeSwitch.checked) {
        document.body.classList.add('dark-mode');
        settings.theme = 'dark';
    } else {
        document.body.classList.remove('dark-mode');
        settings.theme = 'light';
    }
    saveSettings();
}

// Load settings
function loadSettings() {
    // Apply theme
    if (settings.theme === 'dark') {
        document.body.classList.add('dark-mode');
        themeSwitch.checked = true;
    }
}

// Save settings
function saveSettings() {
    localStorage.setItem('settings', JSON.stringify(settings));
}

// Export generateReport to window object
window.generateReport = generateReport;

function generateReport(format) {
    if (shifts.length === 0) {
        showNotification('Помилка', 'Немає даних для створення звіту', 3000);
        return;
    }
    
    const hourlyRate = parseFloat(hourlyRateInput.value) || 0;
    
    switch (format) {
        case 'csv':
            generateCSV(hourlyRate);
            break;
        case 'print':
            printReport();
            break;
        case 'pdf':
            generatePDF(hourlyRate);
            break;
    }
}

function generateCSV(hourlyRate) {
    let csvContent = 'Дата,Початок,Закінчення,Тривалість (год),Оплачуваний обід,Податок (%),Зароблено (₴)\n';
    
    shifts.forEach(shift => {
        const startTime = new Date(shift.startTime).toLocaleTimeString('ru-RU');
        const endTime = new Date(shift.endTime).toLocaleTimeString('ru-RU');
        const duration = (shift.duration / 3600).toFixed(2);
        const paidLunch = shift.paidLunch ? 'Да' : 'Нет';
        const taxRate = shift.taxDeduction ? shift.taxRate : 0;
        
        csvContent += `${shift.date},${startTime},${endTime},${duration},${paidLunch},${taxRate},${formatMoney(shift.earned)}\n`;
    });
    
    const totalDuration = shifts.reduce((sum, shift) => sum + shift.duration, 0) / 3600;
    const totalEarned = shifts.reduce((sum, shift) => sum + shift.earned, 0);
    
    csvContent += `\nВсього,,,${totalDuration.toFixed(2)},,,"${formatMoney(totalEarned)}"\n`;
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `report-${new Date().toLocaleDateString('ru-RU')}.csv`);
    link.click();
    URL.revokeObjectURL(url);
}

function printReport() {
    const printWindow = window.open('', '_blank');
    
    let html = `
        <html>
        <head>
            <title>Звіт по робочому часу - ${new Date().toLocaleDateString('ru-RU')}</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                h1 { text-align: center; margin-bottom: 20px; }
                table { width: 100%; border-collapse: collapse; }
                th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
                th { background-color: #f2f2f2; }
                .footer { margin-top: 30px; text-align: right; font-weight: bold; }
                @media print {
                    button { display: none; }
                }
            </style>
        </head>
        <body>
            <button onclick="window.print()">Друк</button>
            <h1>Звіт по робочому часу</h1>
            <p>Сформований: ${new Date().toLocaleString('ru-RU')}</p>
            
            <table>
                <thead>
                    <tr>
                        <th>Дата</th>
                        <th>Початок</th>
                        <th>Закінчення</th>
                        <th>Тривалість (год)</th>
                        <th>Оплачуваний обід</th>
                        <th>Податок (%)</th>
                        <th>Зароблено</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    shifts.forEach(shift => {
        const startTime = new Date(shift.startTime).toLocaleTimeString('ru-RU');
        const endTime = new Date(shift.endTime).toLocaleTimeString('ru-RU');
        const duration = (shift.duration / 3600).toFixed(2);
        const paidLunch = shift.paidLunch ? 'Да' : 'Нет';
        const taxRate = shift.taxDeduction ? shift.taxRate : 0;
        
        html += `
            <tr>
                <td>${shift.date}</td>
                <td>${startTime}</td>
                <td>${endTime}</td>
                <td>${duration}</td>
                <td>${paidLunch}</td>
                <td>${taxRate}%</td>
                <td>${formatMoney(shift.earned)}</td>
            </tr>
        `;
    });
    
    const totalDuration = shifts.reduce((sum, shift) => sum + shift.duration, 0) / 3600;
    const totalEarned = shifts.reduce((sum, shift) => sum + shift.earned, 0);
    
    html += `
                </tbody>
            </table>
            
            <div class="footer">
                <p>Всього відпрацьовано: ${totalDuration.toFixed(2)} годин</p>
                <p>Всього зароблено: ${formatMoney(totalEarned)}</p>
            </div>
        </body>
        </html>
    `;
    
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
}

function generatePDF(hourlyRate) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Set up table columns and data
    const data = shifts.map(shift => {
        const startTime = new Date(shift.startTime);
        const endTime = new Date(shift.endTime);
        const duration = (shift.duration / 3600).toFixed(2);
        const paidLunch = shift.paidLunch ? 'Да' : 'Нет';
        const earned = formatMoney(shift.earned);
        
        return [shift.date, startTime.toLocaleTimeString('ru-RU'), endTime.toLocaleTimeString('ru-RU'), duration, earned, paidLunch];
    });
    
    // Calculate table width and column positions
    const margin = 10;
    const pageWidth = doc.internal.pageSize.width - 2 * margin;
    const colWidth = pageWidth / 6;
    
    // Add data rows
    doc.setFont('helvetica', 'normal');
    data.forEach((row, i) => {
        row.forEach((cell, j) => {
            doc.text(String(cell), margin + j * colWidth, 20 + i * 10);
        });
    });
    
    // Save the PDF
    doc.save(`work-shifts-report-${new Date().toLocaleDateString('ru-RU')}.pdf`);
}

function openAddShiftModal() {
    editingShiftId = null;
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    document.getElementById('shiftModalTitle').textContent = 'Додати зміну';
    document.getElementById('shiftDate').value = today;
    document.getElementById('shiftStart').value = '09:00';
    document.getElementById('shiftEnd').value = '18:00';
    document.getElementById('shiftPaidLunch').checked = paidLunchInput.checked;
    document.getElementById('shiftTaxDeduction').checked = taxDeductionInput.checked;
    document.getElementById('shiftTaxRate').value = taxRateInput.value;
    // Устанавливаем селектор мест работы в режим "глобальная ставка"
    const workplaceSelect = document.getElementById('shiftWorkplace');
    if (workplaceSelect) {
        workplaceSelect.value = '';
        updateWorkplaceDropdown();
    }
    // Устанавливаем значение длительности обеда по умолчанию (1 час)
    document.getElementById('shiftLunchDuration').value = "60";
    
    toggleModalTaxRateVisibility();
    const useWorkplace = document.getElementById('useWorkplace');
    if (useWorkplace) {
        useWorkplace.checked = false;
        document.getElementById('workplaceContainer').style.display = 'none';
    }
    
    const useGlobal = document.getElementById('useGlobalWorkplace')?.checked;
    if (useGlobal) {
        const globalSelector = document.getElementById('globalWorkplaceSelector');
        if (globalSelector && globalSelector.value) {
            const workplaceSelect = document.getElementById('shiftWorkplace');
            if (workplaceSelect) {
                updateWorkplaceDropdown();
                workplaceSelect.value = globalSelector.value;
            }
            const useWorkplaceModal = document.getElementById('useWorkplace');
            if (useWorkplaceModal) {
                useWorkplaceModal.checked = true;
                document.getElementById('workplaceContainer').style.display = 'block';
            }
        }
    }
    
    shiftModal.style.display = 'block';
}

function openEditShiftModal(shiftId) {
    const shift = shifts.find(s => s.id === shiftId);
    if (!shift) return;
    
    editingShiftId = shiftId;
    
    const shiftDate = new Date(shift.startTime);
    const formattedDate = shiftDate.toISOString().split('T')[0];
    const startTime = formatTimeForInput(new Date(shift.startTime));
    const endTime = formatTimeForInput(new Date(shift.endTime));
    
    document.getElementById('shiftModalTitle').textContent = 'Редагувати зміну';
    document.getElementById('shiftDate').value = formattedDate;
    document.getElementById('shiftStart').value = startTime;
    document.getElementById('shiftEnd').value = endTime;
    document.getElementById('shiftPaidLunch').checked = shift.paidLunch;
    document.getElementById('shiftTaxDeduction').checked = shift.taxDeduction || false;
    document.getElementById('shiftTaxRate').value = shift.taxRate || taxRateInput.value;
    // Устанавливаем выбранное место работы, если оно есть
    updateWorkplaceDropdown();
    document.getElementById('shiftWorkplace').value = shift.workplaceId || '';
    // Устанавливаем выбранную длительность обеда (если не задана – по умолчанию 1 час)
    const lunchDurationSelect = document.getElementById('shiftLunchDuration');
    if (lunchDurationSelect) {
        lunchDurationSelect.value = shift.lunchDuration ? shift.lunchDuration.toString() : "60";
    }
    
    toggleModalTaxRateVisibility();
    const useWorkplace = document.getElementById('useWorkplace');
    if (useWorkplace) {
         if (shift.workplaceId) {
             useWorkplace.checked = true;
             document.getElementById('workplaceContainer').style.display = 'block';
         } else {
             useWorkplace.checked = false;
             document.getElementById('workplaceContainer').style.display = 'none';
         }
    }
    shiftModal.style.display = 'block';
}

function formatTimeForInput(date) {
    return `${padZero(date.getHours())}:${padZero(date.getMinutes())}`;
}

function closeModal() {
    shiftModal.style.display = 'none';
}

function saveShift() {
    const dateValue = document.getElementById('shiftDate').value;
    const startValue = document.getElementById('shiftStart').value;
    const endValue = document.getElementById('shiftEnd').value;
    const paidLunchValue = document.getElementById('shiftPaidLunch').checked;
    const taxDeductionValue = document.getElementById('shiftTaxDeduction').checked;
    const taxRateValue = parseFloat(document.getElementById('shiftTaxRate').value) || 0;
    // Считываем выбранную длительность обеда из модального окна (в минутах)
    const lunchDurationValue = parseInt(document.getElementById('shiftLunchDuration').value) || 60;
    
    if (!dateValue || !startValue || !endValue) {
        alert('Пожалуйста, заполните все поля');
        return;
    }
    
    const startDate = new Date(dateValue);
    const [startHours, startMinutes] = startValue.split(':').map(Number);
    startDate.setHours(startHours, startMinutes, 0);
    
    const endDate = new Date(dateValue);
    const [endHours, endMinutes] = endValue.split(':').map(Number);
    endDate.setHours(endHours, endMinutes, 0);
    
    if (endDate <= startDate) {
        alert('Время окончания должно быть позже времени начала');
        return;
    }
    
    const shift = {
        id: editingShiftId || Date.now(),
        startTime: startDate,
        endTime: endDate,
        date: startDate.toLocaleDateString('ru-RU'),
        duration: (endDate - startDate) / 1000,
        paidLunch: paidLunchValue,
        taxDeduction: taxDeductionValue,
        taxRate: taxRateValue
    };
    
    // Добавляем длительность обеда в объект смены
    shift.lunchDuration = lunchDurationValue;
    
    const useWorkplace = document.getElementById('useWorkplace');
    if (useWorkplace && !useWorkplace.checked) {
         shift.workplaceId = null;
    } else {
         const workplaceSelect = document.getElementById('shiftWorkplace');
         shift.workplaceId = workplaceSelect.value !== "" ? workplaceSelect.value : null;
    }
    
    let grossEarned = 0;
    let rateUsed = parseFloat(hourlyRateInput.value) || 0;
    if (shift.workplaceId) {
        const wp = workplaces.find(w => String(w.id) === String(shift.workplaceId));
        if (wp) {
            rateUsed = wp.rate;
        }
    }
    
    if (shift.paidLunch) {
        grossEarned = (shift.duration / 3600) * rateUsed;
    } else {
        const lunchDeductionHours = lunchDurationValue / 60;
        const paidHours = Math.max(0, (shift.duration / 3600) - lunchDeductionHours);
        grossEarned = paidHours * rateUsed;
    }
    
    shift.grossEarned = grossEarned;
    
    if (shift.taxDeduction) {
        const taxAmount = grossEarned * (shift.taxRate / 100);
        shift.earned = grossEarned - taxAmount;
        shift.taxAmount = taxAmount;
    } else {
        shift.earned = grossEarned;
        shift.taxAmount = 0;
    }
    
    shift.rateUsed = rateUsed;
    shift.finalized = true;
    
    if (editingShiftId) {
        const index = shifts.findIndex(s => s.id === editingShiftId);
        if (index !== -1) {
            shifts[index] = shift;
        }
    } else {
        shifts.push(shift);
    }
    
    saveShifts();
    renderShiftsTable();
    updateSummary();
    setupCharts();
    if (document.getElementById('calendar') && document.getElementById('calendar').classList.contains('active')) {
        renderCalendar();
    }
    closeModal();
}

function deleteShift(shiftId) {
    if (confirm('Ви впевнені, що хочете видалити цю зміну?')) {
        shifts = shifts.filter(shift => shift.id !== shiftId);
        saveShifts();
        renderShiftsTable();
        updateSummary();
        setupCharts();
        if (document.getElementById('calendar') && document.getElementById('calendar').classList.contains('active')) {
            renderCalendar();
        }
    }
}

function updateCurrentShiftTime() {
    if (!currentShift) return;
    
    const now = new Date();
    const elapsedSeconds = Math.floor((now - currentShift.startTime) / 1000);
    
    const hours = Math.floor(elapsedSeconds / 3600);
    const minutes = Math.floor((elapsedSeconds % 3600) / 60);
    const seconds = elapsedSeconds % 60;
    
    currentShiftTime.textContent = `Поточна зміна: ${padZero(hours)}:${padZero(minutes)}:${padZero(seconds)}`;
}

// Вспомогательные функции
function padZero(num) {
    return num.toString().padStart(2, '0');
}

function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours} год ${minutes} хв`;
}

function formatMoney(amount) {
    const currencyCode = settings.currency || 'UAH';
    // Ensure the amount is a valid number; if not, default to 0
    const numberAmount = (typeof amount === 'number' && !isNaN(amount)) ? amount : Number(amount) || 0;
    const convertedAmount = convertCurrency(numberAmount, 'RUB', currencyCode);
    return convertedAmount.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$& ') + ' ' + getCurrencySymbol(currencyCode);
}

function saveShifts() {
    localStorage.setItem('shifts', JSON.stringify(shifts));
}

// Отображение данных
function updateSummary() {
    renderShiftsTable();
    
    const totalSeconds = shifts.reduce((total, shift) => total + shift.duration, 0);
    const totalEarned = shifts.reduce((total, shift) => total + shift.earned, 0);
    
    totalTimeElement.textContent = formatDuration(totalSeconds);
    totalEarnedElement.textContent = formatMoney(totalEarned);
}

// Графики
function setupCharts() {
    createWeeklyChart();
    createMonthlyChart();
}

function createWeeklyChart() {
    const ctx = document.getElementById('weeklyChart');
    
    const last7Days = getLast7Days();
    const weeklyData = getAggregatedData(last7Days);
    
    if (ctx.chart) {
        ctx.chart.destroy();
    }
    
    ctx.chart = new window.Chart(ctx, {
        type: 'bar',
        data: {
            labels: weeklyData.labels,
            datasets: [
                {
                    label: 'Години роботи',
                    data: weeklyData.hours,
                    backgroundColor: 'rgba(54, 162, 235, 0.6)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1
                },
                {
                    label: 'Заробіток (₴)',
                    data: weeklyData.earnings,
                    backgroundColor: 'rgba(75, 192, 192, 0.6)',
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 1,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Статистика за останні 7 днів'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Години'
                    }
                },
                y1: {
                    beginAtZero: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: 'Заробіток (₴)'
                    },
                    grid: {
                        drawOnChartArea: false
                    }
                }
            }
        }
    });
}

function createMonthlyChart() {
    const ctx = document.getElementById('monthlyChart');
    
    const currentMonth = getCurrentMonthDays();
    const monthlyData = getAggregatedData(currentMonth);
    
    if (ctx.chart) {
        ctx.chart.destroy();
    }
    
    ctx.chart = new window.Chart(ctx, {
        type: 'line',
        data: {
            labels: monthlyData.labels,
            datasets: [
                {
                    label: 'Години роботи',
                    data: monthlyData.hours,
                    borderColor: 'rgba(54, 162, 235, 1)',
                    backgroundColor: 'rgba(54, 162, 235, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.1
                },
                {
                    label: 'Заробіток (₴)',
                    data: monthlyData.earnings,
                    borderColor: 'rgba(75, 192, 192, 1)',
                    backgroundColor: 'rgba(75, 192, 192, 0.1)',
                    borderWidth: 2,
                    yAxisID: 'y1',
                    fill: true,
                    tension: 0.1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Статистика за поточний місяць'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Години'
                    }
                },
                y1: {
                    beginAtZero: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: 'Заробіток (₴)'
                    },
                    grid: {
                        drawOnChartArea: false
                    }
                }
            }
        }
    });
}

function getLast7Days() {
    const dates = [];
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        dates.push(date.toLocaleDateString('ru-RU'));
    }
    return dates;
}

function getCurrentMonthDays() {
    const dates = [];
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    for (let i = 1; i <= daysInMonth; i++) {
        const date = new Date(year, month, i);
        dates.push(date.toLocaleDateString('ru-RU'));
    }
    
    return dates;
}

function getAggregatedData(dates) {
    const hoursData = Array(dates.length).fill(0);
    const earningsData = Array(dates.length).fill(0);
    
    shifts.forEach(shift => {
        const dateIndex = dates.indexOf(shift.date);
        if (dateIndex !== -1) {
            hoursData[dateIndex] += shift.duration / 3600;
            earningsData[dateIndex] += shift.earned;
        }
    });
    
    return {
        labels: dates,
        hours: hoursData,
        earnings: earningsData
    };
}

function toggleModalTaxRateVisibility() {
    const taxChecked = document.getElementById('shiftTaxDeduction').checked;
    const modalTaxContainer = document.getElementById('shiftTaxRateContainer');
    modalTaxContainer.style.display = taxChecked ? 'block' : 'none';
}

// Statistics
function updateStatistics() {
    const statsTab = document.getElementById('statistics');
    if (!statsTab || !statsTab.classList.contains('active')) return;
    
    const totalShifts = shifts.length;
    const totalHours = shifts.reduce((total, shift) => total + (shift.duration / 3600), 0);
    const totalEarnings = shifts.reduce((total, shift) => total + shift.earned, 0);
    
    let avgHoursPerDay = 0;
    let avgEarningsPerDay = 0;
    let avgEarningsPerHour = 0;
    
    if (totalShifts > 0) {
        avgHoursPerDay = totalHours / totalShifts;
        avgEarningsPerDay = totalEarnings / totalShifts;
        avgEarningsPerHour = totalHours > 0 ? totalEarnings / totalHours : 0;
    }
    
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    
    const currentWeekShifts = shifts.filter(shift => new Date(shift.startTime) >= startOfWeek);
    const weekHours = currentWeekShifts.reduce((total, shift) => total + (shift.duration / 3600), 0);
    const weekEarnings = currentWeekShifts.reduce((total, shift) => total + shift.earned, 0);
    
    document.getElementById('statTotalShifts').textContent = totalShifts;
    document.getElementById('statTotalHours').textContent = totalHours.toFixed(1);
    document.getElementById('statTotalEarnings').textContent = formatMoney(totalEarnings);
    document.getElementById('statAvgHoursPerDay').textContent = avgHoursPerDay.toFixed(1);
    document.getElementById('statAvgEarningsPerDay').textContent = formatMoney(avgEarningsPerDay);
    document.getElementById('statAvgEarningsPerHour').textContent = formatMoney(avgEarningsPerHour);
    document.getElementById('statWeekHours').textContent = weekHours.toFixed(1);
    document.getElementById('statWeekEarnings').textContent = formatMoney(weekEarnings);
    
    updatePerformanceMetrics();
    createPerformanceChart();
    updateProductivityTrends();
}

function updatePerformanceMetrics() {
    const performanceMetrics = document.querySelector('.performance-metrics');
    if (!performanceMetrics) return;
    
    const now = new Date();
    
    // This week data
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    
    const thisWeekShifts = shifts.filter(shift => new Date(shift.startTime) >= startOfWeek);
    const thisWeekHours = thisWeekShifts.reduce((total, shift) => total + (shift.duration / 3600), 0);
    const thisWeekEarnings = thisWeekShifts.reduce((total, shift) => total + shift.earned, 0);
    
    // Last week data
    const startOfLastWeek = new Date(startOfWeek);
    startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);
    
    const endOfLastWeek = new Date(startOfWeek);
    endOfLastWeek.setMilliseconds(endOfLastWeek.getMilliseconds() - 1);
    
    const lastWeekShifts = shifts.filter(shift => {
        const shiftDate = new Date(shift.startTime);
        return shiftDate >= startOfLastWeek && shiftDate < endOfLastWeek;
    });
    
    const lastWeekHours = lastWeekShifts.reduce((total, shift) => total + (shift.duration / 3600), 0);
    const lastWeekEarnings = lastWeekShifts.reduce((total, shift) => total + shift.earned, 0);
    
    const hoursChange = lastWeekHours > 0 ? ((thisWeekHours - lastWeekHours) / lastWeekHours) * 100 : 0;
    const earningsChange = lastWeekEarnings > 0 ? ((thisWeekEarnings - lastWeekEarnings) / lastWeekEarnings) * 100 : 0;
    
    // Find best day by earnings
    let bestDay = '';
    let bestDayEarnings = 0;
    
    const earningsByDate = {};
    shifts.forEach(shift => {
        const date = shift.date;
        earningsByDate[date] = (earningsByDate[date] || 0) + shift.earned;
        
        if (earningsByDate[date] > bestDayEarnings) {
            bestDayEarnings = earningsByDate[date];
            bestDay = date;
        }
    });
    
    performanceMetrics.innerHTML = `
        <div class="performance-card">
            <div class="performance-title">Години на цій неділі</div>
            <div class="performance-value">${thisWeekHours.toFixed(1)}</div>
            <div class="performance-change ${hoursChange >= 0 ? 'positive-change' : 'negative-change'}">
                ${hoursChange.toFixed(1)}% ${hoursChange >= 0 ? '↑' : '↓'} від попередньої недели
            </div>
        </div>
        
        <div class="performance-card">
            <div class="performance-title">Заробіток на цій неділі</div>
            <div class="performance-value">${formatMoney(thisWeekEarnings)}</div>
            <div class="performance-change ${earningsChange >= 0 ? 'positive-change' : 'negative-change'}">
                ${earningsChange.toFixed(1)}% ${earningsChange >= 0 ? '↑' : '↓'} від попередньої недели
            </div>
        </div>
        
        <div class="performance-card">
            <div class="performance-title">Кращий день</div>
            <div class="performance-value">${bestDay}</div>
            <div class="performance-change positive-change">
                ${formatMoney(bestDayEarnings)}
            </div>
        </div>
        
        <div class="performance-card">
            <div class="performance-title">Середній заробіток в годину</div>
            <div class="performance-value">${formatMoney(calculateAverageHourlyRate())}</div>
            <div class="performance-change">
                За весь час
            </div>
        </div>
    `;
}

function calculateEfficiency() {
    if (shifts.length === 0) return 0;
    
    const standardWorkDay = 8;
    
    const totalHours = shifts.reduce((total, shift) => total + (shift.duration / 3600), 0);
    const avgHoursPerDay = totalHours / shifts.length;
    
    return (avgHoursPerDay / standardWorkDay) * 100;
}

function updateProductivityTrends() {
    const dayStats = {0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0};
    const dayNames = ['Неділя', 'Понеділок', 'Вівторок', 'Середа', 'Четвер', 'П\'ятниця', 'Субота'];
    
    shifts.forEach(shift => {
        const shiftDate = new Date(shift.startTime);
        const dayOfWeek = shiftDate.getDay();
        dayStats[dayOfWeek] += shift.duration / 3600;
    });
    
    let bestDay = 0;
    let bestHours = 0;
    
    for (let day = 0; day < 7; day++) {
        if (dayStats[day] > bestHours) {
            bestDay = day;
            bestHours = dayStats[day];
        }
    }
    
    const bestDayElement = document.getElementById('bestDayValue');
    const productiveDayElement = document.getElementById('productiveDayValue');
    
    if (bestDayElement && productiveDayElement) {
        if (bestHours > 0) {
            productiveDayElement.textContent = `${dayNames[bestDay]} (${bestHours.toFixed(1)} год)`;
        } else {
            productiveDayElement.textContent = 'Недостатньо даних';
        }
        
        let bestEarningDate = '';
        let bestEarning = 0;
        
        const earningsByDate = {};
        shifts.forEach(shift => {
            const date = shift.date;
            earningsByDate[date] = (earningsByDate[date] || 0) + shift.earned;
            
            if (earningsByDate[date] > bestEarning) {
                bestEarning = earningsByDate[date];
                bestEarningDate = date;
            }
        });
        
        if (bestEarningDate) {
            bestDayElement.textContent = `${bestEarningDate} (${formatMoney(bestEarning)})`;
        } else {
            bestDayElement.textContent = 'Недостатньо даних';
        }
    }
}

// New calendar functions
function setupCalendarTab() {
    renderCalendar();
}

function renderCalendar() {
    const calendarDays = document.getElementById('calendarDays');
    const monthYearHeader = document.getElementById('currentMonthYear');
    
    if (!calendarDays || !monthYearHeader) return;
    
    const months = ['Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень', 
                    'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'];
    
    monthYearHeader.textContent = `${months[calendarState.currentMonth]} ${calendarState.currentYear}`;
    
    calendarDays.innerHTML = '';
    
    const firstDay = new Date(calendarState.currentYear, calendarState.currentMonth, 1);
    const lastDay = new Date(calendarState.currentYear, calendarState.currentMonth + 1, 0);
    
    let startingDayOfWeek = firstDay.getDay();
    
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
        const dayElement = document.createElement('div');
        dayElement.className = 'calendar-day other-month';
        dayElement.innerHTML = `<div class="day-number">${lastDay.getDate() - i}</div>`;
        calendarDays.appendChild(dayElement);
    }
    
    const shiftsByDate = {};
    shifts.forEach(shift => {
        const shiftDate = new Date(shift.startTime);
        const dateKey = `${shiftDate.getFullYear()}-${shiftDate.getMonth()}-${shiftDate.getDate()}`;
        
        if (!shiftsByDate[dateKey]) {
            shiftsByDate[dateKey] = [];
        }
        
        shiftsByDate[dateKey].push(shift);
    });
    
    for (let i = 1; i <= lastDay.getDate(); i++) {
        const dayElement = document.createElement('div');
        dayElement.className = 'calendar-day';
        
        const today = new Date();
        if (today.getDate() === i && 
            today.getMonth() === calendarState.currentMonth && 
            today.getFullYear() === calendarState.currentYear) {
            dayElement.classList.add('today');
        }
        
        const dateKey = `${calendarState.currentYear}-${calendarState.currentMonth}-${i}`;
        const dayShifts = shiftsByDate[dateKey] || [];
        
        if (dayShifts.length > 0) {
            dayElement.classList.add('has-shifts');
        }
        
        let dayContent = `<div class="day-number">${i}</div>`;
        
        if (dayShifts.length > 0) {
            dayContent += `<div class="day-shifts">`;
            dayShifts.slice(0, 2).forEach(shift => {
                const duration = formatDuration(shift.duration);
                
                dayContent += `<div class="day-shift-item">${duration}</div>`;
            });
            
            if (dayShifts.length > 2) {
                dayContent += `<div class="day-shift-item">+${dayShifts.length - 2} ще</div>`;
            }
            
            dayContent += `</div>`;
        }
        
        dayElement.innerHTML = dayContent;
        
        dayElement.addEventListener('click', () => {
            showCalendarDayDetails(i, calendarState.currentMonth, calendarState.currentYear);
        });
        
        calendarDays.appendChild(dayElement);
    }
    
    const totalCells = 42; 
    const remainingCells = totalCells - (startingDayOfWeek + lastDay.getDate());
    
    for (let i = 1; i <= remainingCells; i++) {
        const dayElement = document.createElement('div');
        dayElement.className = 'calendar-day other-month';
        dayElement.innerHTML = `<div class="day-number">${i}</div>`;
        calendarDays.appendChild(dayElement);
    }
}

function showCalendarDayDetails(day, month, year) {
    const detailsContainer = document.getElementById('calendarDetails');
    if (!detailsContainer) return;
    
    const date = new Date(year, month, day);
    const dateString = date.toLocaleDateString('ru-RU', {
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric'
    });
    
    const dayShifts = shifts.filter(shift => {
        const shiftDate = new Date(shift.startTime);
        return shiftDate.getDate() === day && 
               shiftDate.getMonth() === month && 
               shiftDate.getFullYear() === year;
    });
    
    if (dayShifts.length === 0) {
        detailsContainer.innerHTML = `
            <h3>${dateString}</h3>
            <p>Немає змін цього дня</p>
            <button class="primary-btn" onclick="openAddShiftForDate(${year}, ${month}, ${day})">
                Додати зміну
            </button>
        `;
        return;
    }
    
    const totalHours = dayShifts.reduce((total, shift) => total + (shift.duration / 3600), 0);
    const totalEarnings = dayShifts.reduce((total, shift) => total + shift.earned, 0);
    
    let shiftsHTML = '';
    
    dayShifts.forEach(shift => {
        const startTime = new Date(shift.startTime);
        const endTime = new Date(shift.endTime);
        const duration = formatDuration(shift.duration);
        const wpLabel = shift.workplaceId 
            ? (workplaces.find(w => String(w.id) === String(shift.workplaceId))?.label || '')
            : '';
        const formattedEarned = formatMoney(shift.earned);
        
        shiftsHTML += `
            <div class="calendar-shift-item">
                <div class="calendar-shift-time">${startTime.toLocaleTimeString('ru-RU')} - ${endTime.toLocaleTimeString('ru-RU')} (${duration})</div>
                ${wpLabel ? `<div class="calendar-shift-workplace">Місце роботи: ${wpLabel}</div>` : ''}
                <div class="calendar-shift-info">
                    <span>Зароблено: ${formattedEarned}</span>
                    <span>Оплачуваний обід: ${shift.paidLunch ? 'Так' : 'Ні'}</span>
                </div>
                <div class="mobile-shift-actions">
                    <button class="action-btn edit-btn" data-id="${shift.id}">✏️</button>
                    <button class="action-btn delete-btn" data-id="${shift.id}">🗑️</button>
                </div>
            </div>
        `;
    });
    
    detailsContainer.innerHTML = `
        <h3>${dateString}</h3>
        <div class="calendar-day-summary">
            <div>Всього годин: ${totalHours.toFixed(1)}</div>
            <div>Всього зароблено: ${formatMoney(totalEarnings)}</div>
        </div>
        <div class="calendar-shift-list">
            ${shiftsHTML}
        </div>
        <button class="primary-btn" onclick="openAddShiftForDate(${year}, ${month}, ${day})">
            Додати зміну
        </button>
    `;
    
    detailsContainer.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            openEditShiftModal(parseInt(btn.dataset.id));
        });
    });
    
    detailsContainer.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            deleteShift(parseInt(btn.dataset.id));
            showCalendarDayDetails(day, month, year); 
        });
    });
}

window.openAddShiftForDate = function(year, month, day) {
    editingShiftId = null;
    
    const dateObj = new Date(year, month, day);
    const formattedDate = dateObj.toISOString().split('T')[0];
    
    document.getElementById('shiftModalTitle').textContent = 'Додати зміну';
    document.getElementById('shiftDate').value = formattedDate;
    document.getElementById('shiftStart').value = '09:00';
    document.getElementById('shiftEnd').value = '18:00';
    document.getElementById('shiftPaidLunch').checked = paidLunchInput.checked;
    document.getElementById('shiftTaxDeduction').checked = taxDeductionInput.checked;
    document.getElementById('shiftTaxRate').value = taxRateInput.value;
    
    // Обновляем выбор места работы, аналогично openAddShiftModal
    const workplaceSelect = document.getElementById('shiftWorkplace');
    if (workplaceSelect) {
         workplaceSelect.value = '';
         updateWorkplaceDropdown();
    }
    const useWorkplace = document.getElementById('useWorkplace');
    if (useWorkplace) {
         useWorkplace.checked = false;
         const workplaceContainer = document.getElementById('workplaceContainer');
         if (workplaceContainer) {
             workplaceContainer.style.display = 'none';
         }
    }
    const useGlobal = document.getElementById('useGlobalWorkplace');
    if (useGlobal && useGlobal.checked) {
         const globalSelector = document.getElementById('globalWorkplaceSelector');
         if (globalSelector && globalSelector.value) {
             if (workplaceSelect) {
                 updateWorkplaceDropdown();
                 workplaceSelect.value = globalSelector.value;
             }
             useWorkplace.checked = true;
             const workplaceContainer = document.getElementById('workplaceContainer');
             if (workplaceContainer) {
                 workplaceContainer.style.display = 'block';
             }
         }
    }
    
    toggleModalTaxRateVisibility();
    shiftModal.style.display = 'block';
};

// Exchange rates functions
function fetchExchangeRates() {
    const baseUrl = 'https://api.exchangerate-api.com/v4/latest/RUB';
    
    fetch(baseUrl)
        .then(response => response.json())
        .then(data => {
            if (data && data.rates) {
                settings.conversionRates = data.rates;
                settings.lastRatesUpdate = new Date().toISOString();
                saveSettings();
                console.log('Exchange rates updated successfully');
            }
        })
        .catch(error => {
            console.error('Error fetching exchange rates:', error);
        });
}

function convertCurrency(amount, from = 'RUB', to = settings.currency) {
    if (from === to) return amount;
    
    if (!settings.conversionRates || Object.keys(settings.conversionRates).length === 0) {
        return amount; 
    }
    
    let amountInRUB = amount;
    if (from !== 'RUB') {
        amountInRUB = amount / settings.conversionRates[from];
    }
    
    if (to !== 'RUB') {
        return amountInRUB * settings.conversionRates[to];
    }
    
    return amountInRUB;
}

function getCurrencySymbol(currencyCode) {
    const currencySymbols = {
        'UAH': '₴',
        'USD': '$',
        'EUR': '€',
        'GBP': '£',
        'JPY': '¥',
        'CNY': '¥',
    };
    
    return currencySymbols[currencyCode] || currencyCode;
}

// Функции для работы со сменами
function startShift() {
    const now = new Date();
    currentShift = {
        id: Date.now(),
        startTime: now,
        date: now.toLocaleDateString('ru-RU'),
        paidLunch: paidLunchInput.checked,
        taxDeduction: taxDeductionInput.checked,
        taxRate: parseFloat(taxRateInput.value) || 0
    };
    
    // Считываем длительность обеда из основной формы (если не задано – по умолчанию 60 минут)
    const lunchDurationValue = parseInt(lunchDurationInput ? lunchDurationInput.value : '60') || 60;
    currentShift.lunchDuration = lunchDurationValue;
    
    // If the global "указать место работы" checkbox is checked, use its rate
    const useGlobalWorkplace = document.getElementById('useGlobalWorkplace');
    if (useGlobalWorkplace && useGlobalWorkplace.checked) {
        const globalWorkplaceSelector = document.getElementById('globalWorkplaceSelector');
        if (globalWorkplaceSelector && globalWorkplaceSelector.value !== "") {
            currentShift.workplaceId = globalWorkplaceSelector.value;
        }
    }
    
    startShiftBtn.disabled = true;
    endShiftBtn.disabled = false;
    currentStatus.textContent = 'Статус: Працюєте';
    currentShiftTime.classList.remove('hidden');
    
    timerInterval = setInterval(updateCurrentShiftTime, 1000);
    updateCurrentShiftTime();
    
    localStorage.setItem('currentShift', JSON.stringify(currentShift));
}

function endShift() {
    if (!currentShift) return;
    
    clearInterval(timerInterval);
    
    const now = new Date();
    currentShift.endTime = now;
    currentShift.duration = (now - currentShift.startTime) / 1000; 
    
    let grossEarned = 0;
    let rateUsed = parseFloat(hourlyRateInput.value) || 0;
    if (currentShift.workplaceId) {
        const wp = workplaces.find(w => String(w.id) === String(currentShift.workplaceId));
        if (wp) {
            rateUsed = wp.rate;
        }
    }
    
    if (currentShift.paidLunch) {
        grossEarned = (currentShift.duration / 3600) * rateUsed;
    } else {
        const lunchDeductionHours = (currentShift.lunchDuration || 60) / 60;
        const paidHours = Math.max(0, (currentShift.duration / 3600) - lunchDeductionHours);
        grossEarned = paidHours * rateUsed;
    }
    
    currentShift.grossEarned = grossEarned;
    
    if (currentShift.taxDeduction) {
        const taxAmount = grossEarned * (currentShift.taxRate / 100);
        currentShift.earned = grossEarned - taxAmount;
        currentShift.taxAmount = taxAmount;
    } else {
        currentShift.earned = grossEarned;
        currentShift.taxAmount = 0;
    }
    
    currentShift.rateUsed = rateUsed;
    currentShift.finalized = true;
    
    shifts.push(currentShift);
    saveShifts();
    
    startShiftBtn.disabled = false;
    endShiftBtn.disabled = true;
    currentStatus.textContent = 'Статус: Не працюєте';
    currentShiftTime.classList.add('hidden');
    
    localStorage.removeItem('currentShift');
    
    currentShift = null;
    renderShiftsTable();
    updateSummary();
    setupCharts();
    if (document.getElementById('calendar') && document.getElementById('calendar').classList.contains('active')) {
        renderCalendar();
    }
}

// Управление местами работы
function openWorkplaceModal() {
    const modal = document.getElementById('workplaceModal');
    if (modal) {
        modal.style.display = 'block';
        renderWorkplaceList();
    }
}

function closeWorkplaceModal() {
    const modal = document.getElementById('workplaceModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function saveWorkplace(e) {
    e.preventDefault();
    const nameInput = document.getElementById('workplaceName');
    const rateInput = document.getElementById('workplaceRate');
    const idInput = document.getElementById('workplaceId');
    const name = nameInput.value.trim();
    const rate = parseFloat(rateInput.value);
    if (!name || isNaN(rate)) {
        alert('Пожалуйста, заполните все поля корректно.');
        return;
    }
    if (idInput.value) {
        // Редактирование существующего места работы
        const id = idInput.value;
        const wp = workplaces.find(w => String(w.id) === String(id));
        if (wp) {
            wp.label = name;
            wp.rate = rate;
        }
    } else {
        // Добавление нового места работы
        const wp = {
            id: Date.now().toString(),
            label: name,
            rate: rate
        };
        workplaces.push(wp);
    }
    saveWorkplaces();
    updateWorkplaceDropdown();
    renderWorkplaceList();
    nameInput.value = '';
    rateInput.value = '';
    idInput.value = '';
    updateGlobalWorkplaceDropdown();
}

function renderWorkplaceList() {
    const listContainer = document.getElementById('workplaceList');
    if (!listContainer) return;
    listContainer.innerHTML = '';
    workplaces.forEach(wp => {
        const div = document.createElement('div');
        div.className = 'workplace-item';
        div.innerHTML = `
            <span>${wp.label} (${wp.rate} грн/год)</span>
            <div class="workplace-actions">
                <button class="edit-workplace-btn" data-id="${wp.id}">✏️</button>
                <button class="delete-workplace-btn" data-id="${wp.id}">🗑️</button>
            </div>
        `;
        listContainer.appendChild(div);
    });
    document.querySelectorAll('.edit-workplace-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            const wp = workplaces.find(w => String(w.id) === String(id));
            if (wp) {
                document.getElementById('workplaceId').value = wp.id;
                document.getElementById('workplaceName').value = wp.label;
                document.getElementById('workplaceRate').value = wp.rate;
            }
        });
    });
    document.querySelectorAll('.delete-workplace-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            if(confirm('Ви впевнені, що хочете видалити це місце роботи?')) {
                workplaces = workplaces.filter(w => String(w.id) !== String(id));
                saveWorkplaces();
                updateWorkplaceDropdown();
                renderWorkplaceList();
                updateGlobalWorkplaceDropdown();
            }
        });
    });
}

function setupWorkplaceEventListeners() {
    const manageWorkplacesBtn = document.getElementById('manageWorkplaces');
    if(manageWorkplacesBtn) {
        manageWorkplacesBtn.addEventListener('click', openWorkplaceModal);
    }
    const closeWPBtn = document.getElementById('closeWorkplaceModal');
    if(closeWPBtn) {
        closeWPBtn.addEventListener('click', closeWorkplaceModal);
    }
    const workplaceForm = document.getElementById('workplaceForm');
    if(workplaceForm) {
        workplaceForm.addEventListener('submit', saveWorkplace);
    }
}

// Закрытие модального окна управления местами работы при клике вне его
window.addEventListener('click', (e) => {
    const wpModal = document.getElementById('workplaceModal');
    if (wpModal && e.target === wpModal) {
        wpModal.style.display = 'none';
    }
});

function confirmClearData() {
    const dialog = document.createElement('div');
    dialog.className = 'confirmation-dialog';
    dialog.innerHTML = `
        <div class="confirmation-content">
            <h3>Підтвердіть дію</h3>
            <p>Ви впевнені, що хочете очистити таблицю?</p>
            <div class="confirmation-buttons">
                <button id="cancelClearData" class="close-btn">Скасувати</button>
                <button id="confirmClearData" class="secondary-btn">Так, очистити</button>
            </div>
        </div>
    `;
    document.body.appendChild(dialog);

    document.getElementById('cancelClearData').addEventListener('click', () => {
        document.body.removeChild(dialog);
    });

    document.getElementById('confirmClearData').addEventListener('click', () => {
        shifts = [];
        saveShifts();
        renderShiftsTable();
        updateSummary();
        document.body.removeChild(dialog);
        showNotification('Таблиця очищена', 'Дані видалені', 3000);
    });
}

// Функции для резервного копирования данных
function backupData() {
    const backup = {
        shifts: shifts,
        workplaces: workplaces,
        settings: settings,
        archivedTables: archivedTables
    };
    const dataStr = JSON.stringify(backup, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function restoreData() {
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "application/json";
    fileInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function (ev) {
            try {
                const backup = JSON.parse(ev.target.result);
                if (backup.shifts) {
                    shifts = backup.shifts;
                    saveShifts();
                }
                if (backup.workplaces) {
                    workplaces = backup.workplaces;
                    saveWorkplaces();
                }
                if (backup.settings) {
                    settings = backup.settings;
                    saveSettings();
                }
                if (backup.archivedTables) {
                    archivedTables = backup.archivedTables;
                    saveArchivedTables();
                }
                showNotification("Дані відновлені", "Ваши дані успішно відновлені.");
                renderShiftsTable();
                updateSummary();
                setupCharts();
                if (document.getElementById("calendar") && document.getElementById("calendar").classList.contains("active")) {
                    renderCalendar();
                }
                updateGlobalWorkplaceDropdown();
            } catch (error) {
                alert("Помилка відновлення даних: " + error.message);
            }
        };
        reader.readAsText(file);
    });
    fileInput.click();
}

function openArchiveModal() {
    const modal = document.getElementById('archiveModal');
    if (modal) {
        modal.style.display = 'block';
        renderArchiveList();
    }
    toolsContent.classList.remove('show');
}

function closeArchiveModal() {
    const modal = document.getElementById('archiveModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function saveCurrentTableToArchive() {
    const nameInput = document.getElementById('archiveTableName');
    const tableName = nameInput.value.trim();
    
    if (!tableName) {
        showNotification('Помилка', 'Будь ласка, введіть назву для таблиці', 3000);
        return;
    }
    
    if (shifts.length === 0) {
        showNotification('Помилка', 'Поточна таблиця пуста', 3000);
        return;
    }
    
    showConfirmation(
        'Ви впевнені, що хочете додати поточну таблицю в архів? Дані будуть видалені з головної сторінки.',
        function() {
            const archivedTable = {
                id: Date.now().toString(),
                name: tableName,
                date: new Date().toISOString(),
                shifts: JSON.parse(JSON.stringify(shifts)),
                workplaces: JSON.parse(JSON.stringify(workplaces)),
                statisticsData: {
                    totalShifts: shifts.length,
                    totalHours: shifts.reduce((total, shift) => total + (shift.duration / 3600), 0),
                    totalEarnings: shifts.reduce((total, shift) => total + shift.earned, 0)
                }
            };

            archivedTables.push(archivedTable);
            saveArchivedTables();

            // Clear current data
            shifts = [];
            saveShifts();
            renderShiftsTable();
            updateSummary();
            nameInput.value = '';
            renderArchiveList();
            showNotification('Архів', 'Таблиця успішно додана в архів', 3000);
        }
    );
}

function saveArchivedTables() {
    localStorage.setItem('archivedTables', JSON.stringify(archivedTables));
}

function renderArchiveList() {
    const archiveList = document.getElementById('archiveList');
    if (!archiveList) return;
    
    if (archivedTables.length === 0) {
        archiveList.innerHTML = '<p>В архіві поки немає збережених таблиць</p>';
        return;
    }
    
    // Apply current filter and sort
    let filteredTables = filterTables();
    filteredTables = sortTables(filteredTables);
    
    archiveList.innerHTML = '';
    filteredTables.forEach(table => {
        const tableDate = new Date(table.date);
        const formattedDate = tableDate.toLocaleDateString('ru-RU') + ' ' + 
                             tableDate.toLocaleTimeString('ru-RU', {hour: '2-digit', minute:'2-digit'});
        
        const totalHours = table.statisticsData && table.statisticsData.totalHours != null
                           ? table.statisticsData.totalHours.toFixed(1)
                           : "0";
        const totalEarnings = table.statisticsData && table.statisticsData.totalEarnings != null
                              ? formatMoney(table.statisticsData.totalEarnings)
                              : formatMoney(0);
        const totalShifts = table.statisticsData && table.statisticsData.totalShifts != null
                            ? table.statisticsData.totalShifts
                            : 0;
        const tableName = table.name || "Без назви";
        
        const item = document.createElement('div');
        item.className = 'archive-item';
        item.innerHTML = `
            <div class="archive-item-info">
                <div class="archive-item-title">${tableName}</div>
                <div class="archive-item-date">Додано: ${formattedDate}</div>
                <div class="archive-item-meta">${totalShifts} змін, ${totalHours} годин, ${totalEarnings}</div>
            </div>
            <div class="archive-item-actions">
                <button class="action-btn" data-action="load" data-id="${table.id}">📂 Завантажити</button>
                <button class="action-btn delete-btn" data-action="delete" data-id="${table.id}">🗑️</button>
            </div>
        `;
        archiveList.appendChild(item);
    });
    
    // Add event listeners to buttons
    document.querySelectorAll('.archive-item-actions button').forEach(btn => {
        btn.addEventListener('click', handleArchiveAction);
    });
}

function handleArchiveAction(e) {
    const action = e.target.dataset.action;
    const tableId = e.target.dataset.id;
    const table = archivedTables.find(t => t.id === tableId);
    
    if (!table) return;
    
    if (action === 'load') {
        loadTableFromArchive(table);
    } else if (action === 'delete') {
        deleteTableFromArchive(tableId);
    }
}

function loadTableFromArchive(table) {
    if (shifts.length > 0) {
        showConfirmation('Завантаження таблиці з архіву замінить поточні дані. Продовжити?', function(){
            performArchiveLoad(table);
        });
    } else {
        performArchiveLoad(table);
    }
}

function performArchiveLoad(table) {
    shifts = JSON.parse(JSON.stringify(table.shifts));
    if (table.workplaces && table.workplaces.length > 0) {
        workplaces = JSON.parse(JSON.stringify(table.workplaces));
        saveWorkplaces();
        updateWorkplaceDropdown();
        updateGlobalWorkplaceDropdown();
    }
    saveShifts();
    renderShiftsTable();
    updateSummary();
    setupCharts();
    showNotification("Архів", `Таблиця "${table.name}" успішно завантажена`, 3000);
    closeArchiveModal();
}

function deleteTableFromArchive(tableId) {
    showConfirmation('Ви впевнені, що хочете видалити цю таблицю з архіву?', function(){
        archivedTables = archivedTables.filter(t => t.id !== tableId);
        saveArchivedTables();
        renderArchiveList();
        showNotification('Архів', 'Таблиця видалена з архіву', 3000);
    });
}

function filterArchiveList() {
    renderArchiveList();
}

function sortArchiveList() {
    renderArchiveList();
}

function filterTables() {
    const searchInput = document.getElementById('archiveSearch');
    if (!searchInput) return archivedTables;
    
    const searchTerm = searchInput.value.toLowerCase().trim();
    if (!searchTerm) return archivedTables;
    
    return archivedTables.filter(table => 
        table.name.toLowerCase().includes(searchTerm)
    );
}

function sortTables(tables) {
    const sortSelect = document.getElementById('archiveSort');
    if (!sortSelect) return tables;
    
    const sortValue = sortSelect.value;
    
    switch (sortValue) {
        case 'date-desc':
            return [...tables].sort((a, b) => new Date(b.date) - new Date(a.date));
        case 'date-asc':
            return [...tables].sort((a, b) => new Date(a.date) - new Date(b.date));
        case 'name-asc':
            return [...tables].sort((a, b) => a.name.localeCompare(b.name));
        case 'name-desc':
            return [...tables].sort((a, b) => b.name.localeCompare(a.name));
        default:
            return tables;
    }
}

// Add event listener for window click to close the archive modal when clicking outside of it
window.addEventListener('click', (e) => {
    const archiveModal = document.getElementById('archiveModal');
    if (archiveModal && e.target === archiveModal) {
        closeArchiveModal();
    }
});

// New function for custom confirmation dialog
function showConfirmation(message, onConfirm, onCancel) {
    const confirmationDialog = document.createElement('div');
    confirmationDialog.className = 'confirmation-dialog';
    confirmationDialog.innerHTML = `
        <div class="confirmation-content">
            <h3>Підтвердіть дію</h3>
            <p>${message}</p>
            <div class="confirmation-buttons">
                <button class="secondary-btn" id="confirmYes">Так</button>
                <button class="close-btn" id="confirmNo">Ні</button>
            </div>
        </div>
    `;
    document.body.appendChild(confirmationDialog);
    
    confirmationDialog.querySelector('#confirmYes').addEventListener('click', () => {
       document.body.removeChild(confirmationDialog);
       if (onConfirm) onConfirm();
    });
    
    confirmationDialog.querySelector('#confirmNo').addEventListener('click', () => {
       document.body.removeChild(confirmationDialog);
       if (onCancel) onCancel();
    });
}

init();