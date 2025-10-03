// --- CONFIGURACIÓN ---
const REDIRECT_URI = window.location.origin;
const CLIENT_ID = '0oaqqj19wrudozUJm5d7';
const DEALER_ORG_NAME = "DAVID SARTOR E HIJOS SA";

// --- ESTADO DE LA APLICACIÓN ---
let accessToken = null;
let dealerOrg = null;
let allOrganizations = [];
let allEquipment = [];
let allFields = [];
let dashboardMap = null;
let fieldMap = null;

// --- ELEMENTOS DEL DOM ---
const loginContainer = document.getElementById('login-container');
const appContainer = document.getElementById('app-container');
const kpiCards = document.getElementById('kpi-cards');
const dealerNameDisplay = document.getElementById('dealer-name');
const equipmentGrid = document.getElementById('equipment-grid');
const fieldList = document.getElementById('field-list');
const fieldDetails = document.getElementById('field-details');
const mainHeaderTitle = document.getElementById('main-header-title');
const modal = document.getElementById('details-modal');
const modalBody = document.getElementById('modal-body');
const modalCloseBtn = document.getElementById('modal-close-btn');
const orgFilter = document.getElementById('org-filter');
const typeFilter = document.getElementById('type-filter');
const modelFilter = document.getElementById('model-filter');

// --- LÓGICA DE LA API ---
async function fetchWithToken(endpoint) {
    if (!accessToken) throw new Error("No hay token de acceso.");
    const proxyUrl = `/.netlify/functions/get-token?endpoint=${encodeURIComponent(endpoint)}`;
    const response = await fetch(proxyUrl, { method: 'GET', headers: { 'x-jd-access-token': accessToken } });
    if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try { errorData = JSON.parse(errorText); } catch (e) { errorData = { message: errorText }; }
        const error = new Error(errorData.message || `Error de API (${response.status})`);
        error.status = response.status;
        error.body = errorData;
        throw error;
    }
    return response;
}

async function loadDealerDashboard() {
    try {
        appContainer.style.display = 'flex';
        loginContainer.style.display = 'none';
        showLoader(kpiCards, 'Cargando datos...');
        showLoader(document.getElementById('dashboard-map'));

        const orgsResponse = await fetchWithToken('organizations');
        const orgsData = await orgsResponse.json();
        allOrganizations = orgsData.values || [];

        dealerOrg = allOrganizations.find(org => org.name === DEALER_ORG_NAME);
        if (!dealerOrg) throw new Error(`Organización "${DEALER_ORG_NAME}" no encontrada.`);
        dealerNameDisplay.textContent = dealerOrg.name;

        const [equipmentResponse, fieldsResponse] = await Promise.all([
            fetchWithToken('equipment?status=all'),
            fetchWithToken(`organizations/${dealerOrg.id}/fields?status=all`)
        ]);

        const equipmentData = await equipmentResponse.json();
        allEquipment = equipmentData.values || [];
        allFields = (await fieldsResponse.json()).values || [];

        populateFilters();
        displayDashboardKPIs();
        fetchAndDisplayMachineLocations();
        showPage('dashboard-page');

    } catch (error) {
        console.error("Error al cargar el dashboard:", error);
        alert(`Error: ${error.message}`);
        sessionStorage.removeItem('jd_access_token');
        showLoginButton();
    }
}

async function fetchAndDisplayMachineLocations() {
    if (!dashboardMap) {
        dashboardMap = L.map('dashboard-map').setView([-27.0, -62.0], 5);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(dashboardMap);
    } else {
        dashboardMap.eachLayer(layer => { if (layer instanceof L.Marker) dashboardMap.removeLayer(layer); });
    }

    const tractorIcon = L.divIcon({ className: 'tractor-icon', html: '🚜', iconSize: [24, 24] });
    const dealerEquipment = allEquipment.filter(eq => eq.organization && String(eq.organization.id) === String(dealerOrg.id));
    
    if (dealerEquipment.length === 0) {
        document.getElementById('dashboard-map').innerHTML = '<p class="placeholder">No hay equipos con datos de ubicación.</p>';
        return;
    }

    // CORRECCIÓN: Usamos /equipments/ (plural)
    const locationPromises = dealerEquipment.map(eq => fetchWithToken(`equipments/${eq.id}/locations`).then(res => res.json()));
    const locationResults = await Promise.all(locationPromises);
    const markers = [];

    locationResults.forEach((locData, index) => {
        const point = locData.values?.[0]?.point;
        if (point) {
            const lat = point.lat;
            const lon = point.lon;
            const machineName = dealerEquipment[index].title;
            const marker = L.marker([lat, lon], { icon: tractorIcon }).addTo(dashboardMap);
            marker.bindPopup(`<b>${machineName}</b>`);
            markers.push(marker);
        }
    });

    if (markers.length > 0) {
        const group = new L.featureGroup(markers);
        dashboardMap.fitBounds(group.getBounds().pad(0.5));
    } else {
         document.getElementById('dashboard-map').innerHTML = '<p class="placeholder">No hay equipos con datos de ubicación.</p>';
    }
}

async function showFieldDetails(fieldId, orgId) {
    const fieldMapContainer = document.getElementById('field-map');
    showLoader(fieldDetails, 'Cargando límites...');
    fieldMapContainer.style.display = 'block';

    if (!fieldMap) {
        fieldMap = L.map('field-map').setView([-27.0, -62.0], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(fieldMap);
    } else {
        fieldMap.eachLayer(layer => { if (!!layer.toGeoJSON) fieldMap.removeLayer(layer); });
    }
    
    try {
        const response = await fetchWithToken(`organizations/${orgId}/fields/${fieldId}/boundaries`);
        const data = await response.json();
        const boundary = data.values?.[0];

        if (boundary && boundary.geometries) {
            fieldDetails.innerHTML = `<h4>Límite del Campo</h4><div id="field-map" class="map-container"></div>`;
            const coordinates = boundary.geometries[0].rings[0].map(p => [p.lat, p.lon]);
            const polygon = L.polygon(coordinates, { color: 'purple' }).addTo(fieldMap);
            fieldMap.fitBounds(polygon.getBounds());
            setTimeout(() => {
                const newMapElement = document.getElementById('field-map');
                if (newMapElement) {
                    fieldMap.invalidateSize();
                }
            }, 10);
        } else {
            fieldDetails.innerHTML = '<p>No se encontraron límites para este campo.</p>';
        }
    } catch (error) {
        console.error("Error al obtener límites:", error);
        fieldDetails.innerHTML = `<p style="color:red;">Error al cargar los límites: ${error.message}</p>`;
    }
}

async function showEquipmentDetails(equipmentId) {
    modal.style.display = 'flex';
    modalBody.innerHTML = '<div class="loader"></div>';
    try {
        // CORRECCIÓN: Usamos /equipments/ (plural)
        const [detailsResponse, hoursResponse] = await Promise.all([
            fetchWithToken(`equipments/${equipmentId}`),
            fetchWithToken(`equipments/${equipmentId}/engineHours`)
        ]);
        const details = await detailsResponse.json();
        const hoursData = await hoursResponse.json();
        const engineHours = hoursData.values?.[0]?.reading?.value || 'No disponible';
        modalBody.innerHTML = `<h3>${details.title}</h3><p><strong>VIN:</strong> ${details.identificationNumber || 'N/A'}</p><p><strong>Tipo:</strong> ${details.equipmentType || 'N/A'}</p><p><strong>Modelo:</strong> ${details.model?.name || 'N/A'}</p><p><strong>Horas de Motor:</strong> ${engineHours}</p>`;
    } catch (error) {
        console.error("Error al obtener detalles del equipo:", error);
        modalBody.innerHTML = `<p style="color: red;">Error al cargar los detalles: ${error.message}</p>`;
    }
}

function populateFilters() {
    orgFilter.innerHTML = '<option value="">Todas las Organizaciones</option>';
    typeFilter.innerHTML = '<option value="">Todos los Tipos</option>';
    modelFilter.innerHTML = '<option value="">Todos los Modelos</option>';

    allOrganizations.forEach(org => {
        const option = document.createElement('option');
        option.value = org.id;
        option.textContent = org.name;
        orgFilter.appendChild(option);
    });

    const types = new Set();
    const models = new Set();
    allEquipment.forEach(eq => {
        if (eq.equipmentType) types.add(eq.equipmentType);
        if (eq.model?.name) models.add(eq.model.name);
    });

    Array.from(types).sort().forEach(type => {
        const option = document.createElement('option');
        option.value = type;
        option.textContent = type;
        typeFilter.appendChild(option);
    });

    Array.from(models).sort().forEach(model => {
        const option = document.createElement('option');
        option.value = model;
        option.textContent = model;
        modelFilter.appendChild(option);
    });
}

function applyFiltersAndRender() {
    const selectedOrg = orgFilter.value;
    const selectedType = typeFilter.value;
    const selectedModel = modelFilter.value;

    let filteredEquipment = allEquipment;

    if (selectedOrg) {
        filteredEquipment = filteredEquipment.filter(eq => eq.organization?.id === selectedOrg);
    }
    if (selectedType) {
        filteredEquipment = filteredEquipment.filter(eq => eq.equipmentType === selectedType);
    }
    if (selectedModel) {
        filteredEquipment = filteredEquipment.filter(eq => eq.model?.name === selectedModel);
    }
    
    displayEquipment(filteredEquipment);
}

function displayDashboardKPIs() {
    kpiCards.innerHTML = `<div class="kpi-card"><p class="value">${allOrganizations.length}</p><p class="label">Organizaciones Conectadas</p></div><div class="kpi-card"><p class="value">${allEquipment.length}</p><p class="label">Equipos Totales</p></div><div class="kpi-card"><p class="value">${allFields.length}</p><p class="label">Campos Gestionados</p></div>`;
}

function displayEquipment(equipmentList) {
    equipmentGrid.innerHTML = '';
    if (equipmentList.length === 0) {
        equipmentGrid.innerHTML = '<p>No se encontraron equipos que coincidan con los filtros.</p>';
        return;
    }
    equipmentList.forEach(eq => {
        const card = document.createElement('div');
        card.className = 'equipment-card';
        card.innerHTML = `<h4>${eq.title || eq.name}</h4><p>ID: ${eq.principalId || 'No disponible'}</p><p>VIN: ${eq.identificationNumber || 'No disponible'}</p>`;
        
        card.addEventListener('click', () => showEquipmentDetails(eq.id)); 
        
        equipmentGrid.appendChild(card);
    });
}

function displayFields() {
    fieldList.innerHTML = '';
    if (allFields.length === 0) {
        fieldList.innerHTML = '<p>No se encontraron campos.</p>';
        return;
    }
    allFields.forEach(field => {
        const fieldItem = document.createElement('div');
        fieldItem.className = 'list-item';
        fieldItem.textContent = field.name;
        fieldItem.addEventListener('click', () => {
            document.querySelectorAll('#field-list .list-item.active').forEach(item => item.classList.remove('active'));
            fieldItem.classList.add('active');
            showFieldDetails(field.id, dealerOrg.id);
        });
        fieldList.appendChild(fieldItem);
    });
}

function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.toggle('active', link.dataset.page === pageId);
    });
    
    switch (pageId) {
        case 'dashboard-page': mainHeaderTitle.textContent = 'Dashboard'; break;
        case 'equipment-page':
            mainHeaderTitle.textContent = 'Equipos';
            applyFiltersAndRender();
            break;
        case 'fields-page':
            mainHeaderTitle.textContent = 'Campos';
            displayFields();
            break;
    }
}

function showLoginButton() {
    appContainer.style.display = 'none';
    loginContainer.style.display = 'flex';
    loginContainer.innerHTML = `<div class="login-box"><img src="./assets/logo.svg" alt="Logo SARTOR" style="height: 50px; margin-bottom: 20px;"><h2>Operation Center Dashboard</h2><p>Conéctate para ver la información de tu concesionario.</p><a href="#" id="login-btn" class="login-button">Conectar con John Deere</a></div>`;
    document.getElementById('login-btn').addEventListener('click', (e) => {
        e.preventDefault();
        const scopes = 'ag3 org2 eq2 files offline_access';
        const state = Math.random().toString(36).substring(2);
        sessionStorage.setItem('oauth_state', state);
        const authUrl = `https://signin.johndeere.com/oauth2/aus78tnlaysMraFhC1t7/v1/authorize?response_type=code&client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&scope=${scopes}&state=${state}`;
        window.location.href = authUrl;
    });
}

function showLoader(container, text = '') { container.innerHTML = `<div class="loader"></div><p style="text-align:center;">${text}</p>`; }

document.querySelectorAll('.nav-link').forEach(link => { link.addEventListener('click', (e) => { e.preventDefault(); showPage(e.target.dataset.page); }); });
modalCloseBtn.addEventListener('click', () => { modal.style.display = 'none'; });
orgFilter.addEventListener('change', applyFiltersAndRender);
typeFilter.addEventListener('change', applyFiltersAndRender);
modelFilter.addEventListener('change', applyFiltersAndRender);

window.onload = async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const authCode = urlParams.get('code');
    if (authCode) {
        window.history.replaceState({}, document.title, window.location.pathname);
        try {
            const response = await fetch('/.netlify/functions/get-token', { method: 'POST', body: JSON.stringify({ code: authCode }) });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'No se pudo obtener el token.');
            accessToken = data.access_token;
            sessionStorage.setItem('jd_access_token', accessToken);
            loadDealerDashboard();
        } catch (error) {
            console.error(error);
            showLoginButton();
            alert(`Error de autenticación: ${error.message}`);
        }
    } else {
        accessToken = sessionStorage.getItem('jd_access_token');
        if (accessToken) {
            loadDealerDashboard();
        } else {
            showLoginButton();
        }
    }
};

document.getElementById('legacy-view-btn').addEventListener('click', () => { window.location.href = '/legacy.html'; });