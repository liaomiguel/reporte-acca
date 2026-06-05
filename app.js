/**
 * ACCA Student Dashboard - Core Application Logic
 * Implements CSV loading, strict date filtering (>= 2026-01-01),
 * pre-built analytical charts, drag-and-drop pivot builder, and table explorer.
 */

// Application State
const state = {
  rawCsvText: '',
  rawBuffer: null,
  encoding: 'UTF-8',
  startDateFilter: '2026-01-01',
  records: [],         // All parsed records (sanitized)
  filteredRecords: [], // Filtered records (Fecha >= startDateFilter)
  
  // Charts
  charts: {
    cursos: null,
    niveles: null,
    profesorFecha: null,
    builder: null
  },
  
  // Builder Configuration
  builder: {
    xField: null,
    legendField: null,
    chartType: 'bar'
  },
  
  // Table Explorer Configuration
  explorer: {
    search: '',
    filterNivel: 'all',
    filterProfesor: 'all',
    sortBy: 'Fecha',
    sortDir: 'desc',
    page: 1,
    pageSize: 15
  },
  
  // Summary Table Configuration
  summary: {
    sortBy: 'count',
    sortDir: 'desc',
    filterNivel: 'all',
    filterModalidad: 'all',
    filterTipo: 'all',
    filterFecha: 'all',
    filterProfesor: 'all'
  }
};

// Available fields translation map for user display in builder
const fieldDisplayNames = {
  'Código': 'Código Curso',
  'Nivel': 'Nivel',
  'Profesor': 'Profesor',
  'Fecha': 'Fecha',
  'Mes': 'Mes',
  'Tipo': 'Tipo',
  'Día': 'Día',
  'Modalidad': 'Modalidad',
  'Horario': 'Horario'
};

// Theme color palette for charts (Harmonious, premium glowing dark colors)
const chartColors = [
  'rgba(92, 98, 245, 0.85)',   // Indigo Glow
  'rgba(157, 78, 221, 0.85)',  // Purple Glow
  'rgba(16, 185, 129, 0.85)',  // Emerald Green
  'rgba(245, 158, 11, 0.85)',  // Amber Orange
  'rgba(6, 182, 212, 0.85)',   // Cyan Accent
  'rgba(236, 72, 153, 0.85)',  // Pink Accent
  'rgba(244, 63, 94, 0.85)',   // Rose Red
  'rgba(99, 102, 241, 0.85)',  // Light Indigo
  'rgba(168, 85, 247, 0.85)',  // Violet
  'rgba(34, 197, 94, 0.85)',   // Green
  'rgba(234, 179, 8, 0.85)',   // Yellow
  'rgba(14, 165, 233, 0.85)'   // Sky Blue
];

const chartBorderColors = [
  '#5c62f5', '#9d4edd', '#10b981', '#f59e0b', '#06b6d4', '#ec4899', '#f43f5e', '#6366f1', '#a855f7', '#22c55e', '#eab308', '#0ea5e9'
];

// Helper to get active theme-dependent colors for Chart.js
function getThemeColors() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  return {
    grid: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.06)',
    ticks: isDark ? '#9ca3af' : '#475569',
    text: isDark ? '#f3f4f6' : '#1e293b',
    border: isDark ? '#0f111a' : '#ffffff',
    tooltipBg: isDark ? 'rgba(15, 17, 26, 0.95)' : 'rgba(255, 255, 255, 0.98)',
    tooltipBorder: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
    tooltipText: isDark ? '#f3f4f6' : '#1e293b',
    tooltipTitle: isDark ? '#ffffff' : '#0f172a'
  };
}

// Helper to update theme toggle button icon
function updateThemeIcon() {
  const themeIcon = document.getElementById('theme-icon');
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  if (themeIcon) {
    themeIcon.setAttribute('data-lucide', isDark ? 'sun' : 'moon');
    initLucide(); // Refresh icons
  }
}

// Register Chart.js DataLabels plugin globally if available
if (typeof ChartDataLabels !== 'undefined') {
  Chart.register(ChartDataLabels);
}

// Initialize application on load
window.addEventListener('DOMContentLoaded', () => {
  initLucide();
  setupTabNavigation();
  setupEventListeners();
  setupSidebarToggle();
  checkAuthentication();
});

// Setup Lucide Icons
function initLucide() {
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

// Check and manage authentication
function checkAuthentication() {
  const isAuth = sessionStorage.getItem('dashboard_authenticated') === 'true';
  const loginScreen = document.getElementById('login-screen');
  const appContainer = document.querySelector('.app-container');

  if (isAuth) {
    loginScreen.classList.add('hidden');
    appContainer.classList.remove('hidden');
    // If charts already exist, resize them so they fit the parent containers correctly
    Object.keys(state.charts).forEach(key => {
      if (state.charts[key]) {
        state.charts[key].resize();
      }
    });
    loadDataAutomatically();
  } else {
    loginScreen.classList.remove('hidden');
    appContainer.classList.add('hidden');
    initLucide();
  }
}

// Handle login submission
function handleLogin(e) {
  e.preventDefault();
  const usernameInput = document.getElementById('login-username').value.trim();
  const passwordInput = document.getElementById('login-password').value;
  const errorMsg = document.getElementById('login-error');

  // In Vite, environment variables are loaded via import.meta.env
  // Provide safe fallback credentials in case .env is missing or not configured
  const expectedUser = import.meta.env.VITE_DASHBOARD_USER || 'admin';
  const expectedPass = import.meta.env.VITE_DASHBOARD_PASSWORD || 'acca2026';

  if (usernameInput === expectedUser && passwordInput === expectedPass) {
    errorMsg.classList.add('hidden');
    sessionStorage.setItem('dashboard_authenticated', 'true');
    checkAuthentication();
  } else {
    errorMsg.classList.remove('hidden');
    // Clear password input
    document.getElementById('login-password').value = '';
  }
}

// Handle logout
function handleLogout() {
  sessionStorage.removeItem('dashboard_authenticated');
  // Clear inputs and error
  document.getElementById('login-username').value = '';
  document.getElementById('login-password').value = '';
  document.getElementById('login-error').classList.add('hidden');
  checkAuthentication();
}

// Setup Header & Sidebar Tab Navigation
function setupTabNavigation() {
  const tabs = document.querySelectorAll('.nav-btn');
  const panels = document.querySelectorAll('.tab-panel');
  const pageTitle = document.getElementById('page-title');
  const pageSubtitle = document.getElementById('page-subtitle');
  
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Remove active from all tabs
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      // Show matching panel
      const targetTab = tab.getAttribute('data-tab');
      panels.forEach(panel => {
        panel.classList.remove('active');
        if (panel.id === `panel-${targetTab}`) {
          panel.classList.add('active');
        }
      });
      
      // Update page title/subtitle
      if (targetTab === 'general') {
        pageTitle.textContent = 'Resumen General';
        pageSubtitle.textContent = 'Análisis de inscripciones y distribución de alumnos a partir del 1 de Enero de 2026';
      } else if (targetTab === 'builder') {
        pageTitle.textContent = 'Constructor Pivot';
        pageSubtitle.textContent = 'Arrastra campos para cruzar variables, contar alumnos y generar reportes dinámicos';
        // Resize Chart.js if visible to redraw correctly
        if (state.charts.builder) {
          state.charts.builder.resize();
        }
      } else if (targetTab === 'explorer') {
        pageTitle.textContent = 'Explorador de Datos';
        pageSubtitle.textContent = 'Listado y búsqueda de todos los alumnos registrados (Filtrado para fechas ≥ 01/01/2026)';
      }
    });
  });
}

// Main setup for UI interactive listeners
function setupEventListeners() {
  // Login Form Submission
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
  }

  // Logout Button
  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }

  // Theme Toggle Button
  const toggleThemeBtn = document.getElementById('btn-toggle-theme');
  if (toggleThemeBtn) {
    updateThemeIcon();
    toggleThemeBtn.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', newTheme);
      localStorage.setItem('dashboard_theme', newTheme);
      updateThemeIcon();
      
      // Re-render charts
      if (state.filteredRecords.length > 0) {
        renderCursosChart();
        renderNivelesChart();
        renderProfesorFechaChart();
        updateBuilderVisualization();
      }
    });
  }

  // Reload Button
  document.getElementById('btn-reload-file').addEventListener('click', () => {
    // Clear custom CSV from localStorage to force reloading the default one
    localStorage.removeItem('acca_custom_csv');
    localStorage.removeItem('acca_custom_encoding');
    loadDataAutomatically();
  });

  // Import CSV Button in header
  document.getElementById('btn-import-csv').addEventListener('click', () => {
    document.getElementById('csv-file-input').click();
  });

  // Date Filter Picker Change
  document.getElementById('filter-date-input').addEventListener('change', (e) => {
    state.startDateFilter = e.target.value;
    // Re-filter and update
    filterAndRefreshData();
  });
  
  // Encoding Select change
  document.getElementById('encoding-select').addEventListener('click', (e) => {
    e.stopPropagation(); // Avoid dropdown glitch
  });
  document.getElementById('encoding-select').addEventListener('change', (e) => {
    state.encoding = e.target.value;
    
    // If there is a custom CSV in localStorage, update its saved encoding
    if (localStorage.getItem('acca_custom_csv')) {
      localStorage.setItem('acca_custom_encoding', state.encoding);
    }
    
    if (state.rawBuffer) {
      decodeAndProcessCsv(state.rawBuffer);
    } else {
      loadDataAutomatically();
    }
  });

  // Limit count selector for Courses Chart
  document.getElementById('course-limit-select').addEventListener('change', () => {
    renderCursosChart();
  });
  
  // Teacher selector filter for general trends chart
  document.getElementById('teacher-filter-select').addEventListener('change', () => {
    renderProfesorFechaChart();
  });

  // Trigger file selection manual click
  document.getElementById('btn-trigger-upload').addEventListener('click', () => {
    document.getElementById('csv-file-input').click();
  });

  // Manual File Select Change
  document.getElementById('csv-file-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      readLocalFile(file);
    }
  });

  // Setup Drag & Drop files on upload zone
  const uploadZone = document.getElementById('upload-zone');
  uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.classList.add('drag-over');
  });

  uploadZone.addEventListener('dragleave', () => {
    uploadZone.classList.remove('drag-over');
  });

  uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.csv')) {
      readLocalFile(file);
    } else {
      alert('Por favor, selecciona un archivo con extensión .csv');
    }
  });

  // Setup Drag & Drop Builder fields listeners
  setupDragAndDropBuilder();

  // Explorer search input listener
  document.getElementById('explorer-search').addEventListener('input', (e) => {
    state.explorer.search = e.target.value;
    state.explorer.page = 1; // reset page
    updateExplorerTable();
  });

  // Explorer filter dropdowns
  document.getElementById('filter-nivel-select').addEventListener('change', (e) => {
    state.explorer.filterNivel = e.target.value;
    state.explorer.page = 1;
    updateExplorerTable();
  });

  document.getElementById('filter-profesor-select').addEventListener('change', (e) => {
    state.explorer.filterProfesor = e.target.value;
    state.explorer.page = 1;
    updateExplorerTable();
  });

  // Explorer sorting
  const headers = document.querySelectorAll('#table-explorer th[data-sort]');
  headers.forEach(header => {
    header.addEventListener('click', () => {
      const field = header.getAttribute('data-sort');
      if (state.explorer.sortBy === field) {
        // Toggle direction
        state.explorer.sortDir = state.explorer.sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        state.explorer.sortBy = field;
        state.explorer.sortDir = 'asc';
      }
      
      // Update sorted arrow displays
      headers.forEach(h => {
        const icon = h.querySelector('.sort-icon');
        if (h === header) {
          icon.setAttribute('data-lucide', state.explorer.sortDir === 'asc' ? 'chevron-up' : 'chevron-down');
        } else {
          icon.setAttribute('data-lucide', 'chevrons-up-down');
        }
      });
      initLucide();
      
      updateExplorerTable();
    });
  });

  // Pagination buttons
  document.getElementById('pag-prev').addEventListener('click', () => {
    if (state.explorer.page > 1) {
      state.explorer.page--;
      updateExplorerTable();
    }
  });

  document.getElementById('pag-next').addEventListener('click', () => {
    const totalPages = Math.ceil(getFilteredExplorerRecords().length / state.explorer.pageSize);
    if (state.explorer.page < totalPages) {
      state.explorer.page++;
      updateExplorerTable();
    }
  });

  // Export buttons
  document.getElementById('btn-export-explorer').addEventListener('click', () => {
    exportToCsv('explorador_acca_filtrado.csv', getFilteredExplorerRecords());
  });

  document.getElementById('btn-export-builder').addEventListener('click', () => {
    exportBuilderPivotData();
  });

  // Export general summary table to CSV
  document.getElementById('btn-export-general-summary').addEventListener('click', () => {
    const courses = getFilteredSummaryCourses();
    const total = state.filteredRecords.length;
    if (courses.length === 0) {
      alert("No hay datos para exportar.");
      return;
    }
    
    // Map to export format (excluding Porcentaje column)
    const exportData = courses.map(c => ({
      "Código Curso": c.code,
      "Tipo": c.tipo,
      "Nivel": c.nivel,
      "Día": c.dia,
      "Fecha": c.fecha,
      "Modalidad": c.modalidad,
      "Profesor": c.profesor,
      "Alumnos": c.count
    }));
    
    exportToCsv('resumen_alumnos_por_curso.csv', exportData);
  });

  // Summary Table filters dropdown listeners
  document.getElementById('summary-filter-nivel').addEventListener('change', (e) => {
    state.summary.filterNivel = e.target.value;
    renderGeneralSummaryTable();
  });
  document.getElementById('summary-filter-modalidad').addEventListener('change', (e) => {
    state.summary.filterModalidad = e.target.value;
    renderGeneralSummaryTable();
  });
  document.getElementById('summary-filter-tipo').addEventListener('change', (e) => {
    state.summary.filterTipo = e.target.value;
    renderGeneralSummaryTable();
  });
  document.getElementById('summary-filter-fecha').addEventListener('change', (e) => {
    state.summary.filterFecha = e.target.value;
    renderGeneralSummaryTable();
  });
  document.getElementById('summary-filter-profesor').addEventListener('change', (e) => {
    state.summary.filterProfesor = e.target.value;
    renderGeneralSummaryTable();
  });

  // Summary Table sorting headers listeners
  const summaryHeaders = document.querySelectorAll('#table-general-summary th[data-sort]');
  summaryHeaders.forEach(header => {
    header.addEventListener('click', () => {
      const field = header.getAttribute('data-sort');
      if (state.summary.sortBy === field) {
        state.summary.sortDir = state.summary.sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        state.summary.sortBy = field;
        state.summary.sortDir = 'asc';
      }
      
      // Update visual icon classes
      summaryHeaders.forEach(h => {
        const icon = h.querySelector('.sort-icon');
        if (h === header) {
          icon.setAttribute('data-lucide', state.summary.sortDir === 'asc' ? 'chevron-up' : 'chevron-down');
        } else {
          icon.setAttribute('data-lucide', 'chevrons-up-down');
        }
      });
      initLucide();
      
      renderGeneralSummaryTable();
    });
  });
}

// Fetch CSV automatically from workspace folder or localStorage
async function loadDataAutomatically() {
  updateStatus('pulse yellow', 'Intentando cargar CSV...');
  
  // Check if there is a saved CSV in localStorage
  const savedCsv = localStorage.getItem('acca_custom_csv');
  const savedEncoding = localStorage.getItem('acca_custom_encoding') || 'UTF-8';
  
  if (savedCsv) {
    try {
      state.encoding = savedEncoding;
      document.getElementById('encoding-select').value = savedEncoding;
      state.rawCsvText = savedCsv;
      
      // Convert string to arrayBuffer for compatibility with encoding changes
      const encoder = new TextEncoder();
      state.rawBuffer = encoder.encode(savedCsv).buffer;
      processCsvContent(savedCsv);
      
      // Hide upload zone as custom CSV succeeded
      document.getElementById('upload-zone').classList.add('hidden');
      updateStatus('green pulse', 'Carga de base guardada completada');
      return;
    } catch (e) {
      console.error("Error loading saved CSV:", e);
      localStorage.removeItem('acca_custom_csv');
      localStorage.removeItem('acca_custom_encoding');
    }
  }

  // Fallback to default CSV
  try {
    // Vite will serve files in workspace directory (moved to public/Alumnos-Acca.csv)
    const response = await fetch('./Alumnos-Acca.csv');
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }
    
    // We fetch as ArrayBuffer first to support multiple encodings
    const arrayBuffer = await response.arrayBuffer();
    decodeAndProcessCsv(arrayBuffer);
    
    // Hide upload zone as automatic load succeeded
    document.getElementById('upload-zone').classList.add('hidden');
    updateStatus('green pulse', 'Carga automática completada');
  } catch (error) {
    console.warn("Could not load CSV automatically:", error);
    // Show manual upload zone
    document.getElementById('upload-zone').classList.remove('hidden');
    updateStatus('red', 'Esperando archivo CSV manual');
  }
}

// Helper to read local dropped/selected file
function readLocalFile(file) {
  updateStatus('pulse yellow', `Leyendo archivo: ${file.name}...`);
  const reader = new FileReader();
  
  reader.onload = (e) => {
    const arrayBuffer = e.target.result;
    decodeAndProcessCsv(arrayBuffer);
    
    // Save to localStorage if size is reasonable (up to ~4.5MB)
    try {
      const decoder = new TextDecoder(state.encoding);
      const text = decoder.decode(arrayBuffer);
      localStorage.setItem('acca_custom_csv', text);
      localStorage.setItem('acca_custom_encoding', state.encoding);
    } catch (err) {
      console.warn("Could not save to localStorage (file might be too large):", err);
      if (err.name === 'QuotaExceededError') {
        alert("El archivo es demasiado grande para guardarse de forma permanente en el navegador. Se ha cargado solo para esta sesión.");
      }
    }
    
    // Success - hide drop zone
    document.getElementById('upload-zone').classList.add('hidden');
    updateStatus('green pulse', 'Archivo manual cargado');
  };
  
  reader.onerror = () => {
    updateStatus('red', 'Error al leer el archivo');
    alert('Error al leer el archivo seleccionado.');
  };
  
  reader.readAsArrayBuffer(file);
}

// Decode buffer with chosen encoding and process
function decodeAndProcessCsv(arrayBuffer) {
  state.rawBuffer = arrayBuffer;
  const decoder = new TextDecoder(state.encoding);
  const text = decoder.decode(arrayBuffer);
  state.rawCsvText = text;
  processCsvContent(text);
}

// Update Status Card
function updateStatus(dotClass, text) {
  const statusDot = document.getElementById('status-dot');
  const statusText = document.getElementById('status-text');
  statusDot.className = `dot ${dotClass}`;
  statusText.textContent = text;
}

// Core business logic: Parse CSV, clean encodings/BOM, apply Date Filters
function processCsvContent(csvString) {
  // Pre-process headers to clean BOM, accents, duplicates and encoding glitches
  const lines = csvString.split(/\r?\n/);
  if (lines.length === 0 || !lines[0]) {
    alert("El archivo CSV está vacío.");
    return;
  }
  
  let headerLine = lines[0];
  
  // Clean BOM and sanitize accents/typos
  headerLine = headerLine.replace(/^\uFEFF/, ''); // Strip BOM
  
  // Replace characters with known replacements if encoding was broken
  headerLine = headerLine.replace(/Ao/g, 'Año');
  headerLine = headerLine.replace(/Cdigo/g, 'Código');
  headerLine = headerLine.replace(/Da/g, 'Día');
  
  // Split header values by semicolon
  const headers = headerLine.split(';');
  
  // Semicolon values check
  if (headers.length < 2) {
    alert("El CSV no parece estar separado por punto y coma ';'. Por favor, verifica el formato.");
    return;
  }
  
  // Clean individual headers
  const cleanedHeaders = headers.map((h, index) => {
    let clean = h.trim();
    // Rename 10th column if duplicate of Fecha (Index 9)
    if (clean === 'Fecha' && index === 9) {
      return 'DiaMes';
    }
    return clean;
  });
  
  // Replace the first line in the CSV text
  lines[0] = cleanedHeaders.join(';');
  const sanitizedCsv = lines.join('\n');
  
  // Parse with PapaParse
  Papa.parse(sanitizedCsv, {
    delimiter: ";",
    header: true,
    skipEmptyLines: true,
    complete: function(results) {
      if (results.errors.length > 0) {
        console.warn("PapaParse errors:", results.errors);
      }
      
      // Clean and sanitize row keys/values
      state.records = results.data.map(row => {
        const sanitized = {};
        for (const key in row) {
          const cleanKey = key.trim();
          sanitized[cleanKey] = row[key] ? row[key].trim() : '';
        }
        return sanitized;
      });
      
      // Apply Date Filter from state
      filterAndRefreshData();
    }
  });
}

// Filter records based on state date and refresh metrics
function filterAndRefreshData() {
  state.filteredRecords = state.records.filter(row => {
    const fecha = row.Fecha;
    return fecha && fecha >= state.startDateFilter;
  });
  updateDashboardData();
}

// Compute general statistics and populate UI + Charts
function updateDashboardData() {
  const count = state.filteredRecords.length;
  document.getElementById('record-count').textContent = count;
  document.getElementById('kpi-alumnos').textContent = count;
  
  // Update date displays dynamically based on the current filter date
  const parts = state.startDateFilter.split('-');
  const formattedDate = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : state.startDateFilter;
  
  const kpiDateEl = document.getElementById('kpi-alumnos-date');
  if (kpiDateEl) {
    kpiDateEl.textContent = formattedDate;
  }
  
  const statusDateEl = document.getElementById('status-filter-date');
  if (statusDateEl) {
    statusDateEl.textContent = `≥ ${formattedDate}`;
  }
  
  // Compute unique values
  const uniqueCursos = new Set();
  const uniqueProfesores = new Set();
  const uniqueNiveles = new Set();
  
  state.filteredRecords.forEach(row => {
    if (row.Código) uniqueCursos.add(row.Código);
    if (row.Profesor) uniqueProfesores.add(row.Profesor);
    if (row.Nivel) uniqueNiveles.add(row.Nivel);
  });
  
  document.getElementById('kpi-cursos').textContent = uniqueCursos.size;
  document.getElementById('kpi-profesores').textContent = uniqueProfesores.size;
  document.getElementById('kpi-niveles').textContent = uniqueNiveles.size;
  
  // Update dropdown filter selectors
  populateDropdownFilters(uniqueNiveles, uniqueProfesores);
  
  // Render Tab 1 Charts
  renderCursosChart();
  renderNivelesChart();
  renderProfesorFechaChart();
  
  // Render Tab 1 Summary Table
  populateSummaryDropdownFilters();
  renderGeneralSummaryTable();
  
  // Initialize/Refresh Tab 2 Builder
  resetPivotBuilder();
  
  // Initialize Tab 3 Data Explorer
  state.explorer.page = 1;
  updateExplorerTable();
}

// Populate filters inside Explorer
function populateDropdownFilters(niveles, profesores) {
  const nivelSelect = document.getElementById('filter-nivel-select');
  const profSelect = document.getElementById('filter-profesor-select');
  const generalProfSelect = document.getElementById('teacher-filter-select');
  
  // Keep first option "Todos"
  nivelSelect.innerHTML = '<option value="all">Todos</option>';
  profSelect.innerHTML = '<option value="all">Todos</option>';
  generalProfSelect.innerHTML = '<option value="all">Todos los Profesores</option>';
  
  // Populate Niveles
  Array.from(niveles).sort().forEach(nivel => {
    nivelSelect.innerHTML += `<option value="${nivel}">${nivel}</option>`;
  });
  
  // Populate Profesores
  Array.from(profesores).sort().forEach(prof => {
    profSelect.innerHTML += `<option value="${prof}">${prof}</option>`;
    generalProfSelect.innerHTML += `<option value="${prof}">${prof}</option>`;
  });
}

// Destroy a chart safely
function destroyChart(chartKey) {
  if (state.charts[chartKey]) {
    state.charts[chartKey].destroy();
    state.charts[chartKey] = null;
  }
}

// Chart 1: Alumnos por Curso (Troncal)
function renderCursosChart() {
  destroyChart('cursos');
  
  // Aggregate data
  const counts = {};
  state.filteredRecords.forEach(row => {
    const curso = row.Código;
    if (curso) {
      counts[curso] = (counts[curso] || 0) + 1;
    }
  });
  
  // Sort descending
  let sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  
  // Limit count
  const limitVal = document.getElementById('course-limit-select').value;
  if (limitVal !== 'all') {
    const limit = parseInt(limitVal, 10);
    sorted = sorted.slice(0, limit);
  }
  
  const labels = sorted.map(x => x[0]);
  const data = sorted.map(x => x[1]);
  
  const ctx = document.getElementById('chart-cursos').getContext('2d');
  const colors = getThemeColors();
  
  state.charts.cursos = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Cantidad de Alumnos',
        data: data,
        backgroundColor: 'rgba(92, 98, 245, 0.45)',
        borderColor: '#5c62f5',
        borderWidth: 2,
        borderRadius: 6,
        hoverBackgroundColor: 'rgba(92, 98, 245, 0.7)'
      }]
    },
    options: {
      indexAxis: 'y', // Horizontal bars
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        datalabels: {
          color: '#ffffff',
          anchor: 'end',
          align: 'start',
          offset: 4,
          font: { family: 'Outfit', weight: 'bold', size: 10 },
          formatter: Math.round
        },
        tooltip: {
          padding: 12,
          backgroundColor: colors.tooltipBg,
          titleColor: colors.tooltipTitle,
          bodyColor: colors.tooltipText,
          borderColor: colors.tooltipBorder,
          borderWidth: 1,
          titleFont: { family: 'Outfit', size: 13 },
          bodyFont: { family: 'Outfit', size: 12 }
        }
      },
      scales: {
        x: {
          grid: { color: colors.grid },
          ticks: { color: colors.ticks, font: { family: 'Outfit' } }
        },
        y: {
          grid: { display: false },
          ticks: { color: colors.ticks, font: { family: 'Outfit', size: 11 } }
        }
      }
    }
  });
}

// Chart 2: Distribución por Nivel
function renderNivelesChart() {
  destroyChart('niveles');
  
  // Aggregate data
  const counts = {};
  state.filteredRecords.forEach(row => {
    const nivel = row.Nivel;
    if (nivel) {
      counts[nivel] = (counts[nivel] || 0) + 1;
    }
  });
  
  // Sort descending
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const labels = sorted.map(x => x[0]);
  const data = sorted.map(x => x[1]);
  
  const ctx = document.getElementById('chart-niveles').getContext('2d');
  const colors = getThemeColors();
  
  state.charts.niveles = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: chartColors.slice(0, labels.length),
        borderColor: colors.border,
        borderWidth: 2,
        hoverOffset: 12
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: colors.text,
            font: { family: 'Outfit', size: 12 },
            padding: 16
          }
        },
        datalabels: {
          color: '#ffffff',
          font: { family: 'Outfit', weight: 'bold', size: 11 },
          formatter: (value, ctx) => {
            let sum = 0;
            let dataArr = ctx.chart.data.datasets[0].data;
            dataArr.map(data => { sum += data; });
            let percentage = (value * 100 / sum).toFixed(0);
            return percentage > 3 ? `${value}\n(${percentage}%)` : '';
          },
          textAlign: 'center'
        },
        tooltip: {
          padding: 12,
          backgroundColor: colors.tooltipBg,
          titleColor: colors.tooltipTitle,
          bodyColor: colors.tooltipText,
          borderColor: colors.tooltipBorder,
          borderWidth: 1,
          titleFont: { family: 'Outfit', size: 13 },
          bodyFont: { family: 'Outfit', size: 12 },
          callbacks: {
            label: function(context) {
              const val = context.raw;
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const percent = ((val / total) * 100).toFixed(1);
              return ` Alumnos: ${val} (${percent}%)`;
            }
          }
        }
      },
      cutout: '65%'
    }
  });
}

// Chart 3: Alumnos por Profesor y Fecha (Timeline Trend)
function renderProfesorFechaChart() {
  destroyChart('profesorFecha');
  
  // Get active teacher filter
  const filterTeacher = document.getElementById('teacher-filter-select').value;
  
  // Group by Date, and if filter is 'all', show overall trend, otherwise show specific teacher trend
  const counts = {};
  state.filteredRecords.forEach(row => {
    const fecha = row.Fecha;
    const teacher = row.Profesor;
    
    if (fecha) {
      if (filterTeacher === 'all' || teacher === filterTeacher) {
        counts[fecha] = (counts[fecha] || 0) + 1;
      }
    }
  });
  
  // Sort dates chronologically
  const sorted = Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0]));
  const labels = sorted.map(x => {
    // Format YYYY-MM-DD to DD/MM/YYYY for UI friendliness
    const parts = x[0].split('-');
    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : x[0];
  });
  const data = sorted.map(x => x[1]);
  
  const ctx = document.getElementById('chart-profesor-fecha').getContext('2d');
  const colors = getThemeColors();
  
  state.charts.profesorFecha = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: filterTeacher === 'all' ? 'Inscripciones Totales' : `Inscripciones para ${filterTeacher}`,
        data: data,
        borderColor: '#9d4edd',
        backgroundColor: 'rgba(157, 78, 221, 0.12)',
        borderWidth: 3,
        fill: true,
        tension: 0.35,
        pointBackgroundColor: '#9d4edd',
        pointBorderColor: colors.border,
        pointHoverRadius: 7,
        pointHoverBackgroundColor: '#9d4edd',
        pointHoverBorderColor: colors.border,
        pointBorderWidth: 2,
        pointRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        datalabels: {
          color: colors.ticks,
          anchor: 'end',
          align: 'top',
          offset: 4,
          font: { family: 'Outfit', weight: '600', size: 9 },
          display: function(context) {
            const count = context.chart.data.labels.length;
            if (count > 25) {
              return context.dataIndex % 2 === 0;
            }
            return true;
          }
        },
        tooltip: {
          padding: 12,
          backgroundColor: colors.tooltipBg,
          titleColor: colors.tooltipTitle,
          bodyColor: colors.tooltipText,
          borderColor: colors.tooltipBorder,
          borderWidth: 1,
          titleFont: { family: 'Outfit', size: 13 },
          bodyFont: { family: 'Outfit', size: 12 }
        }
      },
      scales: {
        x: {
          grid: { color: colors.grid },
          ticks: { color: colors.ticks, font: { family: 'Outfit' }, maxRotation: 45 }
        },
        y: {
          grid: { color: colors.grid },
          ticks: { color: colors.ticks, font: { family: 'Outfit' } },
          min: 0
        }
      }
    }
  });
}

// Get summary table courses filtered and sorted
function getFilteredSummaryCourses() {
  const records = state.filteredRecords;
  const total = records.length;
  
  // Aggregate by Código
  const coursesMap = {};
  records.forEach(row => {
    const code = row.Código;
    if (!code) return;
    
    if (!coursesMap[code]) {
      coursesMap[code] = {
        code: code,
        tipo: row.Tipo || '-',
        nivel: row.Nivel || '-',
        dia: row.Día || '-',
        fecha: row.Fecha || '-',
        modalidad: row.Modalidad || '-',
        profesor: row.Profesor || '-',
        count: 0
      };
    }
    coursesMap[code].count++;
  });
  
  let coursesArray = Object.values(coursesMap);
  
  // Apply Filters
  if (state.summary.filterNivel !== 'all') {
    coursesArray = coursesArray.filter(c => c.nivel === state.summary.filterNivel);
  }
  if (state.summary.filterModalidad !== 'all') {
    coursesArray = coursesArray.filter(c => c.modalidad === state.summary.filterModalidad);
  }
  if (state.summary.filterTipo !== 'all') {
    coursesArray = coursesArray.filter(c => c.tipo === state.summary.filterTipo);
  }
  if (state.summary.filterFecha !== 'all') {
    coursesArray = coursesArray.filter(c => c.fecha === state.summary.filterFecha);
  }
  if (state.summary.filterProfesor !== 'all') {
    coursesArray = coursesArray.filter(c => c.profesor === state.summary.filterProfesor);
  }
  
  // Apply Sorting
  const sortBy = state.summary.sortBy;
  const sortDir = state.summary.sortDir;
  
  coursesArray.sort((a, b) => {
    let valA = a[sortBy];
    let valB = b[sortBy];
    
    if (sortBy === 'percentage') {
      valA = a.count;
      valB = b.count;
    }
    
    let comparison = 0;
    if (typeof valA === 'number' && typeof valB === 'number') {
      comparison = valA - valB;
    } else {
      comparison = String(valA).localeCompare(String(valB), 'es', { sensitivity: 'base' });
    }
    
    return sortDir === 'asc' ? comparison : -comparison;
  });
  
  return coursesArray;
}

// Populate the summary table dynamic filter dropdowns
function populateSummaryDropdownFilters() {
  const nivelSelect = document.getElementById('summary-filter-nivel');
  const modSelect = document.getElementById('summary-filter-modalidad');
  const tipoSelect = document.getElementById('summary-filter-tipo');
  const fechaSelect = document.getElementById('summary-filter-fecha');
  const profSelect = document.getElementById('summary-filter-profesor');
  
  if (!nivelSelect) return;
  
  const uniqueNiveles = new Set();
  const uniqueModalidades = new Set();
  const uniqueTipos = new Set();
  const uniqueFechas = new Set();
  const uniqueProfesores = new Set();
  
  state.filteredRecords.forEach(row => {
    if (row.Nivel) uniqueNiveles.add(row.Nivel);
    if (row.Modalidad) uniqueModalidades.add(row.Modalidad);
    if (row.Tipo) uniqueTipos.add(row.Tipo);
    if (row.Fecha) uniqueFechas.add(row.Fecha);
    if (row.Profesor) uniqueProfesores.add(row.Profesor);
  });
  
  const currentNivel = state.summary.filterNivel;
  const currentMod = state.summary.filterModalidad;
  const currentTipo = state.summary.filterTipo;
  const currentFecha = state.summary.filterFecha;
  const currentProf = state.summary.filterProfesor;
  
  nivelSelect.innerHTML = '<option value="all">Todos los Niveles</option>';
  Array.from(uniqueNiveles).sort().forEach(val => {
    nivelSelect.innerHTML += `<option value="${val}">${val}</option>`;
  });
  
  modSelect.innerHTML = '<option value="all">Todas las Modalidades</option>';
  Array.from(uniqueModalidades).sort().forEach(val => {
    modSelect.innerHTML += `<option value="${val}">${val}</option>`;
  });
  
  tipoSelect.innerHTML = '<option value="all">Todos los Tipos</option>';
  Array.from(uniqueTipos).sort().forEach(val => {
    tipoSelect.innerHTML += `<option value="${val}">${val}</option>`;
  });
  
  fechaSelect.innerHTML = '<option value="all">Todas las Fechas</option>';
  Array.from(uniqueFechas).sort().forEach(val => {
    const parts = val.split('-');
    const formatted = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : val;
    fechaSelect.innerHTML += `<option value="${val}">${formatted}</option>`;
  });
  
  profSelect.innerHTML = '<option value="all">Todos los Profesores</option>';
  Array.from(uniqueProfesores).sort().forEach(val => {
    profSelect.innerHTML += `<option value="${val}">${val}</option>`;
  });
  
  // Keep values if they still exist in new dataset
  state.summary.filterNivel = uniqueNiveles.has(currentNivel) ? currentNivel : 'all';
  state.summary.filterModalidad = uniqueModalidades.has(currentMod) ? currentMod : 'all';
  state.summary.filterTipo = uniqueTipos.has(currentTipo) ? currentTipo : 'all';
  state.summary.filterFecha = uniqueFechas.has(currentFecha) ? currentFecha : 'all';
  state.summary.filterProfesor = uniqueProfesores.has(currentProf) ? currentProf : 'all';
  
  nivelSelect.value = state.summary.filterNivel;
  modSelect.value = state.summary.filterModalidad;
  tipoSelect.value = state.summary.filterTipo;
  fechaSelect.value = state.summary.filterFecha;
  profSelect.value = state.summary.filterProfesor;
}

// Render General Summary Table at the bottom of Resumen General tab
function renderGeneralSummaryTable() {
  const tbody = document.getElementById('general-summary-tbody');
  if (!tbody) return;
  
  const coursesArray = getFilteredSummaryCourses();
  const total = state.filteredRecords.length;
  
  if (coursesArray.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted py-4">No hay datos que coincidan con los filtros seleccionados.</td></tr>`;
    return;
  }
  
  // Render table rows (excluding Porcentaje column)
  tbody.innerHTML = '';
  coursesArray.forEach(course => {
    tbody.innerHTML += `
      <tr>
        <td><code class="date-badge">${course.code}</code></td>
        <td>${course.tipo}</td>
        <td>${course.nivel}</td>
        <td>${course.dia}</td>
        <td><strong>${course.fecha}</strong></td>
        <td>${course.modalidad}</td>
        <td>${course.profesor}</td>
        <td><strong>${course.count}</strong></td>
      </tr>
    `;
  });
}

// ================= PIVOT BUILDER (DRAG & DROP) LOGIC =================

function setupDragAndDropBuilder() {
  const fields = document.querySelectorAll('#builder-fields .field-pill');
  const dropZones = document.querySelectorAll('.drop-zone');
  
  // Drag start
  fields.forEach(field => {
    field.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', field.getAttribute('data-field'));
      field.classList.add('dragging');
    });
    
    field.addEventListener('dragend', () => {
      field.classList.remove('dragging');
    });
    
    // Tap/Click support for mobile/click workflow
    field.addEventListener('click', () => {
      const fieldName = field.getAttribute('data-field');
      onFieldClicked(fieldName);
    });
  });
  
  // Drag over zones
  dropZones.forEach(zone => {
    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      zone.classList.add('drag-over');
    });
    
    zone.addEventListener('dragleave', () => {
      zone.classList.remove('drag-over');
    });
    
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      
      const fieldName = e.dataTransfer.getData('text/plain');
      const zoneType = zone.getAttribute('data-zone');
      
      assignFieldToZone(fieldName, zoneType);
    });
  });
  
  // Reset Builder Button
  document.getElementById('btn-reset-builder').addEventListener('click', () => {
    resetPivotBuilder();
  });
  
  // Builder Chart type change
  document.getElementById('builder-chart-type').addEventListener('change', (e) => {
    state.builder.chartType = e.target.value;
    updateBuilderVisualization();
  });
}

// Click callback to automatically place a pill
function onFieldClicked(fieldName) {
  // If X is empty, place it there
  if (!state.builder.xField) {
    assignFieldToZone(fieldName, 'x');
  } 
  // Otherwise if Legend is empty and it's not the same field, place in Legend
  else if (!state.builder.legendField && state.builder.xField !== fieldName) {
    assignFieldToZone(fieldName, 'legend');
  }
}

// Bind field to zone and redraw
function assignFieldToZone(fieldName, zoneType) {
  if (zoneType === 'x') {
    // If it was in legend, clear legend
    if (state.builder.legendField === fieldName) {
      state.builder.legendField = null;
    }
    state.builder.xField = fieldName;
  } else if (zoneType === 'legend') {
    // If it was in X, clear X
    if (state.builder.xField === fieldName) {
      state.builder.xField = null;
    }
    state.builder.legendField = fieldName;
  }
  
  updateBuilderPills();
  updateBuilderVisualization();
}

// Remove pill from configuration
function removeFieldFromZone(zoneType) {
  if (zoneType === 'x') {
    state.builder.xField = null;
  } else if (zoneType === 'legend') {
    state.builder.legendField = null;
  }
  
  updateBuilderPills();
  updateBuilderVisualization();
}

// Redraw draggable visual pills inside drop zones
function updateBuilderPills() {
  const zones = {
    'x': document.getElementById('drop-x'),
    'legend': document.getElementById('drop-legend')
  };
  
  for (const zoneKey in zones) {
    const zone = zones[zoneKey];
    const fieldName = zoneKey === 'x' ? state.builder.xField : state.builder.legendField;
    
    if (fieldName) {
      zone.innerHTML = `
        <div class="field-pill" style="width:100%; justify-content: space-between;">
          <span><i data-lucide="hash"></i> ${fieldDisplayNames[fieldName] || fieldName}</span>
          <button class="btn-remove-pill" onclick="event.stopPropagation(); removeFieldFromZone('${zoneKey}')">
            <i data-lucide="x"></i>
          </button>
        </div>
      `;
    } else {
      const placeholder = zoneKey === 'x' 
        ? 'Arrastra un campo aquí (ej: Código)' 
        : 'Arrastra un campo para sub-agrupar';
      zone.innerHTML = `<span class="placeholder-text">${placeholder}</span>`;
    }
  }
  initLucide();
}

// Reset builder
function resetPivotBuilder() {
  state.builder.xField = null;
  state.builder.legendField = null;
  
  updateBuilderPills();
  updateBuilderVisualization();
}

// Make global context helper accessible to HTML click
window.removeFieldFromZone = removeFieldFromZone;

// Process aggregated dynamic data and render builder charts + pivot table
function updateBuilderVisualization() {
  destroyChart('builder');
  
  const emptyState = document.getElementById('builder-chart-empty');
  const canvasEl = document.getElementById('chart-builder');
  const exportBtn = document.getElementById('btn-export-builder');
  const tableBody = document.querySelector('#table-builder tbody');
  const tableHead = document.querySelector('#table-builder thead');
  
  // Safe guards
  if (!state.builder.xField) {
    emptyState.classList.remove('hidden');
    canvasEl.classList.add('hidden');
    exportBtn.classList.add('hidden');
    
    tableHead.innerHTML = `<tr><th>Eje X</th><th>Alumnos</th><th>Porcentaje</th></tr>`;
    tableBody.innerHTML = `<tr><td colspan="3" class="text-center text-muted py-4">Configura los campos para poblar la tabla.</td></tr>`;
    return;
  }
  
  emptyState.classList.add('hidden');
  canvasEl.classList.remove('hidden');
  exportBtn.classList.remove('hidden');
  
  const records = state.filteredRecords;
  const xCol = state.builder.xField;
  const lCol = state.builder.legendField;
  
  // Aggregate logic
  if (!lCol) {
    // SINGLE GROUP BY
    const counts = {};
    let total = 0;
    
    records.forEach(row => {
      const val = row[xCol] || '(Vacío)';
      counts[val] = (counts[val] || 0) + 1;
      total++;
    });
    
    // Sort descending
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const labels = sorted.map(x => x[0]);
    const data = sorted.map(x => x[1]);
    
    // Render Chart
    const ctx = canvasEl.getContext('2d');
    const isPie = state.builder.chartType === 'pie';
    const colors = getThemeColors();
    
    state.charts.builder = new Chart(ctx, {
      type: isPie ? 'doughnut' : (state.builder.chartType === 'horizontalBar' ? 'bar' : state.builder.chartType),
      data: {
        labels: labels,
        datasets: [{
          label: 'Alumnos',
          data: data,
          backgroundColor: isPie ? chartColors.slice(0, labels.length) : 'rgba(92, 98, 245, 0.5)',
          borderColor: isPie ? colors.border : '#5c62f5',
          borderWidth: 2,
          borderRadius: isPie ? 0 : 5
        }]
      },
      options: {
        indexAxis: state.builder.chartType === 'horizontalBar' ? 'y' : 'x',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: isPie, position: 'right', labels: { color: colors.text, font: { family: 'Outfit' } } },
          datalabels: {
            color: '#ffffff',
            font: { family: 'Outfit', weight: 'bold', size: 10 },
            anchor: 'end',
            align: (context) => {
              const chartType = context.chart.config.type;
              const indexAxis = context.chart.options.indexAxis;
              if (chartType === 'line') return 'top';
              if (chartType === 'bar' && indexAxis === 'y') return 'start';
              return 'start';
            },
            formatter: (value, ctx) => {
              if (value === 0) return '';
              const chartType = ctx.chart.config.type;
              if (chartType === 'pie' || chartType === 'doughnut') {
                let sum = 0;
                let dataArr = ctx.chart.data.datasets[0].data;
                dataArr.map(data => { sum += data; });
                let percentage = (value * 100 / sum).toFixed(0);
                return percentage > 4 ? `${value}\n(${percentage}%)` : '';
              }
              return value;
            },
            textAlign: 'center',
            display: function(context) {
              const dataCount = context.chart.data.labels.length;
              return dataCount <= 35;
            }
          }
        },
        scales: isPie ? {} : {
          x: { grid: { color: colors.grid }, ticks: { color: colors.ticks, font: { family: 'Outfit' } } },
          y: { grid: { color: colors.grid }, ticks: { color: colors.ticks, font: { family: 'Outfit' } }, min: 0 }
        }
      }
    });
    
    // Render Table
    tableHead.innerHTML = `
      <tr>
        <th>${fieldDisplayNames[xCol] || xCol}</th>
        <th>Alumnos</th>
        <th>Porcentaje</th>
      </tr>
    `;
    
    tableBody.innerHTML = '';
    sorted.forEach(([label, val]) => {
      const pct = ((val / total) * 100).toFixed(1);
      tableBody.innerHTML += `
        <tr>
          <td><strong>${label}</strong></td>
          <td>${val}</td>
          <td><span class="date-badge">${pct}%</span></td>
        </tr>
      `;
    });
    
    // Total Row
    tableBody.innerHTML += `
      <tr style="border-top: 2px solid var(--border-card); font-weight: 700; background: rgba(255,255,255,0.02)">
        <td>Total General</td>
        <td>${total}</td>
        <td>100%</td>
      </tr>
    `;
  } 
  else {
    // TWO-DIMENSIONAL AGGREGATION (PIVOT TABLE)
    const pivot = {}; // { [xVal]: { [lVal]: count } }
    const allX = new Set();
    const allL = new Set();
    let total = 0;
    
    records.forEach(row => {
      const xVal = row[xCol] || '(Vacío)';
      const lVal = row[lCol] || '(Vacío)';
      
      allX.add(xVal);
      allL.add(lVal);
      total++;
      
      if (!pivot[xVal]) pivot[xVal] = {};
      pivot[xVal][lVal] = (pivot[xVal][lVal] || 0) + 1;
    });
    
    const sortedX = Array.from(allX).sort();
    const sortedL = Array.from(allL).sort();
    
    // Datasets generation
    const datasets = sortedL.map((lVal, index) => {
      const data = sortedX.map(xVal => {
        return pivot[xVal] ? (pivot[xVal][lVal] || 0) : 0;
      });
      
      return {
        label: lVal,
        data: data,
        backgroundColor: chartColors[index % chartColors.length],
        borderColor: chartBorderColors[index % chartBorderColors.length],
        borderWidth: 2,
        borderRadius: 4
      };
    });
    
    // Render Chart (Bar/Stacked, Line)
    const ctx = canvasEl.getContext('2d');
    let chartType = state.builder.chartType;
    if (chartType === 'pie') {
      chartType = 'bar'; // Pie doesn't support stacked pivot data, fallback to bar
    }
    const colors = getThemeColors();
    
    state.charts.builder = new Chart(ctx, {
      type: chartType === 'horizontalBar' ? 'bar' : chartType,
      data: {
        labels: sortedX,
        datasets: datasets
      },
      options: {
        indexAxis: chartType === 'horizontalBar' ? 'y' : 'x',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true, position: 'top', labels: { color: colors.text, font: { family: 'Outfit' } } },
          datalabels: {
            color: '#ffffff',
            font: { family: 'Outfit', weight: 'bold', size: 9 },
            anchor: 'center',
            align: 'center',
            formatter: (value) => {
              return value > 0 ? value : '';
            },
            display: function(context) {
              const dataCount = context.chart.data.labels.length;
              return dataCount <= 25;
            }
          }
        },
        scales: {
          x: { 
            stacked: true, 
            grid: { color: colors.grid }, 
            ticks: { color: colors.ticks, font: { family: 'Outfit' } } 
          },
          y: { 
            stacked: true, 
            grid: { color: colors.grid }, 
            ticks: { color: colors.ticks, font: { family: 'Outfit' } }, 
            min: 0 
          }
        }
      }
    });
    
    // Render Pivot Table Header
    let headHtml = `<tr><th>${fieldDisplayNames[xCol] || xCol}</th>`;
    sortedL.forEach(lVal => {
      headHtml += `<th>${lVal}</th>`;
    });
    headHtml += `<th>Total General</th></tr>`;
    tableHead.innerHTML = headHtml;
    
    // Render Pivot Table Body
    tableBody.innerHTML = '';
    
    // X-Row Totals
    const colTotals = {};
    sortedL.forEach(l => colTotals[l] = 0);
    
    sortedX.forEach(xVal => {
      let rowHtml = `<tr><td><strong>${xVal}</strong></td>`;
      let rowTotal = 0;
      
      sortedL.forEach(lVal => {
        const val = pivot[xVal] ? (pivot[xVal][lVal] || 0) : 0;
        rowTotal += val;
        colTotals[lVal] += val;
        rowHtml += `<td>${val === 0 ? '-' : val}</td>`;
      });
      
      rowHtml += `<td class="text-muted"><strong>${rowTotal}</strong></td></tr>`;
      tableBody.innerHTML += rowHtml;
    });
    
    // Column Totals Bottom Row
    let totalRowHtml = `
      <tr style="border-top: 2px solid var(--border-card); font-weight: 700; background: rgba(255,255,255,0.02)">
        <td>Total General</td>
    `;
    let grandTotal = 0;
    sortedL.forEach(lVal => {
      grandTotal += colTotals[lVal];
      totalRowHtml += `<td>${colTotals[lVal]}</td>`;
    });
    totalRowHtml += `<td>${grandTotal}</td></tr>`;
    tableBody.innerHTML += totalRowHtml;
  }
}

// Export Builder dynamic data to CSV
function exportBuilderPivotData() {
  const table = document.getElementById('table-builder');
  const rows = table.querySelectorAll('tr');
  const csv = [];
  
  rows.forEach(row => {
    const cols = row.querySelectorAll('th, td');
    const rowData = [];
    cols.forEach(col => {
      // Escape commas and spaces
      let val = col.innerText.trim();
      val = val.replace(/"/g, '""');
      rowData.push(`"${val}"`);
    });
    csv.push(rowData.join(';')); // Maintain semicolon for Latin Excel
  });
  
  const csvContent = csv.join('\n');
  const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `pivot_${state.builder.xField}_vs_${state.builder.legendField || 'count'}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ================= TAB: EXPLORADOR DE DATOS LOGIC =================

// Filter logic based on Search and Selected filters
function getFilteredExplorerRecords() {
  let records = state.filteredRecords;
  
  // Apply Search
  const query = state.explorer.search.toLowerCase().trim();
  if (query) {
    records = records.filter(row => {
      return (
        (row.Alumno && row.Alumno.toLowerCase().includes(query)) ||
        (row.Profesor && row.Profesor.toLowerCase().includes(query)) ||
        (row.Código && row.Código.toLowerCase().includes(query)) ||
        (row.Nivel && row.Nivel.toLowerCase().includes(query)) ||
        (row.Modalidad && row.Modalidad.toLowerCase().includes(query)) ||
        (row.Fecha && row.Fecha.toLowerCase().includes(query))
      );
    });
  }
  
  // Apply Nivel Filter
  if (state.explorer.filterNivel !== 'all') {
    records = records.filter(row => row.Nivel === state.explorer.filterNivel);
  }
  
  // Apply Profesor Filter
  if (state.explorer.filterProfesor !== 'all') {
    records = records.filter(row => row.Profesor === state.explorer.filterProfesor);
  }
  
  // Apply Sorting
  const sortBy = state.explorer.sortBy;
  const sortDir = state.explorer.sortDir;
  
  records.sort((a, b) => {
    const valA = a[sortBy] || '';
    const valB = b[sortBy] || '';
    
    // Chronological date sort or string alphabetical sort
    let comparison = 0;
    if (sortBy === 'Fecha' || sortBy === 'Horario') {
      comparison = valA.localeCompare(valB);
    } else {
      comparison = valA.localeCompare(valB, 'es', { sensitivity: 'base' });
    }
    
    return sortDir === 'asc' ? comparison : -comparison;
  });
  
  return records;
}

// Redraw paginated explorer table
function updateExplorerTable() {
  const records = getFilteredExplorerRecords();
  const total = records.length;
  
  const start = (state.explorer.page - 1) * state.explorer.pageSize;
  const end = Math.min(start + state.explorer.pageSize, total);
  
  const paginated = records.slice(start, end);
  const tbody = document.getElementById('explorer-tbody');
  
  // Update footer labels
  document.getElementById('pag-start').textContent = total === 0 ? 0 : start + 1;
  document.getElementById('pag-end').textContent = end;
  document.getElementById('pag-total').textContent = total;
  
  // Toggle pagination buttons disabled state
  document.getElementById('pag-prev').disabled = state.explorer.page <= 1;
  document.getElementById('pag-next').disabled = end >= total;
  
  // Draw table body
  if (total === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted py-4">No se encontraron registros que coincidan con la búsqueda.</td></tr>`;
    drawPaginationControls(0);
    return;
  }
  
  tbody.innerHTML = '';
  paginated.forEach(row => {
    tbody.innerHTML += `
      <tr>
        <td><strong>${row.Fecha || '-'}</strong></td>
        <td><code class="date-badge">${row.Código || '-'}</code></td>
        <td>${row.Alumno || '-'}</td>
        <td>${row.Nivel || '-'}</td>
        <td>${row.Día || '-'}</td>
        <td>${row.Horario || '-'}</td>
        <td>${row.Modalidad || '-'}</td>
        <td>${row.Profesor || '-'}</td>
      </tr>
    `;
  });
  
  const totalPages = Math.ceil(total / state.explorer.pageSize);
  drawPaginationControls(totalPages);
}

// Render page numbers (1, 2, ..., N)
function drawPaginationControls(totalPages) {
  const container = document.getElementById('pag-numbers');
  container.innerHTML = '';
  
  if (totalPages <= 1) return;
  
  const current = state.explorer.page;
  const maxButtons = 5;
  let startPage = Math.max(1, current - 2);
  let endPage = Math.min(totalPages, startPage + maxButtons - 1);
  
  if (endPage - startPage < maxButtons - 1) {
    startPage = Math.max(1, endPage - maxButtons + 1);
  }
  
  // First page button
  if (startPage > 1) {
    container.innerHTML += `<button class="page-num" onclick="setExplorerPage(1)">1</button>`;
    if (startPage > 2) {
      container.innerHTML += `<span class="page-dots">...</span>`;
    }
  }
  
  // Middle buttons
  for (let i = startPage; i <= endPage; i++) {
    container.innerHTML += `
      <button class="page-num ${i === current ? 'active' : ''}" onclick="setExplorerPage(${i})">${i}</button>
    `;
  }
  
  // Last page button
  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      container.innerHTML += `<span class="page-dots">...</span>`;
    }
    container.innerHTML += `<button class="page-num" onclick="setExplorerPage(${totalPages})">${totalPages}</button>`;
  }
}

// Direct change page callback from page button click
function setExplorerPage(page) {
  state.explorer.page = page;
  updateExplorerTable();
}
window.setExplorerPage = setExplorerPage;

// Helper to export general collections to CSV
function exportToCsv(filename, dataRows) {
  if (dataRows.length === 0) {
    alert("No hay datos para exportar.");
    return;
  }
  
  // Get keys from first item
  const keys = Object.keys(dataRows[0]);
  const csv = [];
  
  // Header row
  csv.push(keys.map(k => `"${k}"`).join(';'));
  
  // Data rows
  dataRows.forEach(row => {
    const rowValues = keys.map(k => {
      let val = row[k] !== undefined && row[k] !== null ? String(row[k]) : '';
      val = val.replace(/"/g, '""');
      return `"${val}"`;
    });
    csv.push(rowValues.join(';'));
  });
  
  const csvContent = csv.join('\n');
  const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Sidebar collapse/expand functionality
function setupSidebarToggle() {
  const container = document.querySelector('.app-container');
  const toggleBtn = document.getElementById('btn-toggle-sidebar');
  if (!toggleBtn || !container) return;
  
  // Load saved state from localStorage
  const isCollapsed = localStorage.getItem('sidebar_collapsed') === 'true';
  if (isCollapsed) {
    container.classList.add('sidebar-collapsed');
    toggleBtn.innerHTML = '<i data-lucide="chevron-right"></i>';
    toggleBtn.title = "Expandir menú";
  } else {
    container.classList.remove('sidebar-collapsed');
    toggleBtn.innerHTML = '<i data-lucide="chevron-left"></i>';
    toggleBtn.title = "Colapsar menú";
  }
  initLucide();
  
  toggleBtn.addEventListener('click', () => {
    const collapsedNow = container.classList.toggle('sidebar-collapsed');
    localStorage.setItem('sidebar_collapsed', collapsedNow ? 'true' : 'false');
    
    if (collapsedNow) {
      toggleBtn.innerHTML = '<i data-lucide="chevron-right"></i>';
      toggleBtn.title = "Expandir menú";
    } else {
      toggleBtn.innerHTML = '<i data-lucide="chevron-left"></i>';
      toggleBtn.title = "Colapsar menú";
    }
    initLucide();
    
    // Trigger window resize event so Chart.js charts redraw and fit the new content area perfectly
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 300); // Wait for CSS transition
  });
}
