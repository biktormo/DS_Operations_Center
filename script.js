// --- CONFIGURACIÓN ---
const REDIRECT_URI = window.location.origin;
const CLIENT_ID = '0oaqqj19wrudozUJm5d7';
const DEALER_ORG_NAME = "DAVID SARTOR E HIJOS SA"; // <- El nombre de tu concesionario

// --- ESTADO DE LA APLICACIÓN ---
let accessToken = null;
let dealerOrg = null;
let allEquipment = [];
let allFields = [];

// --- ELEMENTOS DEL DOM ---
const loginContainer = document.getElementById('login-container');
const appContainer = document.getElementById('app-container');
const dealerNameDisplay = document.getElementById('dealer-name');
const equipmentGrid = document.getElementById('equipment-grid');
const fieldList = document.getElementById('field-list');
const fieldDetails = document.getElementById('field-details');
const mainHeaderTitle = document.getElementById('main-header-title');
const modal = document.getElementById('details-modal');
const modalBody = document.getElementById('modal-body');
const modalCloseBtn = document.getElementById('modal-close-btn');

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

// Carga los datos iniciales para el concesionario
async function loadDealerDashboard() {
    try {
        appContainer.style.display = 'flex';
        loginContainer.style.display = 'none';

        // 1. Obtener todas las organizaciones conectadas
        const orgsResponse = await fetchWithToken('organizations');
        const orgsData = await orgsResponse.json();
        const connectedOrgs = orgsData.values || [];

        // 2. Encontrar la organización del concesionario
        dealerOrg = connectedOrgs.find(org => org.name === DEALER_ORG_NAME);
        if (!dealerOrg) {
            alert(`Organización "${DEALER_ORG_NAME}" no encontrada o no conectada.`);
            return;
        }
        dealerNameDisplay.textContent = dealerOrg.name;

        // 3. Cargar todos los equipos y campos en paralelo
        showLoader(equipmentGrid, 'Cargando datos...');
        showLoader(fieldList, '');

        const [equipmentResponse, fieldsResponse] = await Promise.all([
            fetchWithToken('equipment?status=all'),
            fetchWithToken(`organizations/${dealerOrg.id}/fields?status=all`)
        ]);

        const equipmentData = await equipmentResponse.json();
        const fieldsData = await fieldsResponse.json();

        allEquipment = equipmentData.values || [];
        allFields = fieldsData.values || [];

        // 4. Mostrar la página de equipos por defecto
        showPage('equipment-page');

    } catch (error) {
        console.error("Error al cargar el dashboard:", error);
        alert(`Error: ${error.message}`);
    }
}

// --- NUEVA FUNCIONALIDAD: Mostrar detalles del equipo ---
async function showEquipmentDetails(equipmentId) {
    modal.style.display = 'flex';
    modalBody.innerHTML = '<div class="loader"></div>';

    try {
        // Hacemos las llamadas para detalles y horas de motor en paralelo
        const [detailsResponse, hoursResponse] = await Promise.all([
            fetchWithToken(`equipment/${equipmentId}`),
            fetchWithToken(`equipment/${equipmentId}/engineHours`)
        ]);

        const details = await detailsResponse.json();
        const hoursData = await hoursResponse.json();
        const engineHours = hoursData.values?.[0]?.reading?.value || 'No disponible';

        modalBody.innerHTML = `
            <h3>${details.title}</h3>
            <p><strong>VIN:</strong> ${details.identificationNumber || 'N/A'}</p>
            <p><strong>Tipo:</strong> ${details.equipmentType || 'N/A'}</p>
            <p><strong>Modelo:</strong> ${details.model || 'N/A'}</p>
            <p><strong>Horas de Motor:</strong> ${engineHours}</p>
        `;
    } catch (error) {
        console.error("Error al obtener detalles del equipo:", error);
        modalBody.innerHTML = `<p style="color: red;">Error al cargar los detalles: ${error.message}</p>`;
    }
}

// --- FUNCIONES DE RENDERIZADO Y UI ---
function displayEquipment() {
    equipmentGrid.innerHTML = '';
    if (allEquipment.length === 0) {
        equipmentGrid.innerHTML = '<p>No se encontraron equipos para esta organización.</p>';
        return;
    }
    allEquipment.forEach(eq => {
        if (String(eq.organization.id) === String(dealerOrg.id)) {
            const card = document.createElement('div');
            card.className = 'equipment-card';
            card.innerHTML = `
                <h4>${eq.title || eq.name}</h4>
                <p>ID: ${eq.principalId}</p>
                <p>VIN: ${eq.identificationNumber || 'No disponible'}</p>
            `;
            card.addEventListener('click', () => showEquipmentDetails(eq.id));
            equipmentGrid.appendChild(card);
        }
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
        // Futuro: añadir listener para mostrar detalles/operaciones del campo
        // fieldItem.addEventListener('click', () => showFieldDetails(field.id));
        fieldList.appendChild(fieldItem);
    });
}

function showPage(pageId) {
    // Ocultar todas las páginas y activar la correcta
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');

    // Actualizar el link activo en la barra lateral
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.toggle('active', link.dataset.page === pageId);
    });
    
    // Actualizar título y renderizar contenido
    switch (pageId) {
        case 'dashboard-page':
            mainHeaderTitle.textContent = 'Dashboard';
            break;
        case 'equipment-page':
            mainHeaderTitle.textContent = 'Equipos';
            displayEquipment(); // Renderizar equipos
            break;
        case 'fields-page':
            mainHeaderTitle.textContent = 'Campos';
            displayFields(); // Renderizar campos
            break;
    }
}

// --- INICIALIZACIÓN Y MANEJO DE AUTENTICACIÓN ---
function showLoginButton() {
    appContainer.style.display = 'none';
    loginContainer.innerHTML = `
        <div class="login-box">
            <img src="./assets/logo.svg" alt="Logo SARTOR" style="height: 50px; margin-bottom: 20px;">
            <h2>Operation Center Dashboard</h2>
            <p>Conéctate para ver la información de tu concesionario.</p>
            <a href="#" id="login-btn" class="login-button">Conectar con John Deere</a>
        </div>
    `;
    document.getElementById('login-btn').addEventListener('click', (e) => {
        e.preventDefault();
        // Lógica de login
        const scopes = 'ag3 org2 eq2 files offline_access';
        const state = Math.random().toString(36).substring(2);
        sessionStorage.setItem('oauth_state', state);
        const authUrl = `https://signin.johndeere.com/oauth2/aus78tnlaysMraFhC1t7/v1/authorize?response_type=code&client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&scope=${scopes}&state=${state}`;
        window.location.href = authUrl;
    });
}

function showLoader(container, text = '') {
    container.innerHTML = `<div class="loader"></div><p style="text-align:center;">${text}</p>`;
}

// --- EVENT LISTENERS ---
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        showPage(e.target.dataset.page);
    });
});

modalCloseBtn.addEventListener('click', () => {
    modal.style.display = 'none';
});

// Punto de Entrada Principal
window.onload = async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const authCode = urlParams.get('code');

    if (authCode) {
        window.history.replaceState({}, document.title, window.location.pathname);
        try {
            const response = await fetch('/.netlify/functions/get-token', { method: 'POST', body: JSON.stringify({ code }) });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'No se pudo obtener el token.');
            
            accessToken = data.access_token;
            sessionStorage.setItem('jd_access_token', accessToken); // Guardamos el token
            
            loadDealerDashboard();

        } catch (error) {
            console.error(error);
            showLoginButton();
            alert(`Error de autenticación: ${error.message}`);
        }
    } else {
        // Comprobar si ya tenemos un token guardado
        accessToken = sessionStorage.getItem('jd_access_token');
        if (accessToken) {
            loadDealerDashboard();
        } else {
            showLoginButton();
        }
    }
};

// TODO: Lógica para el botón "Legacy View"
document.getElementById('legacy-view-btn').addEventListener('click', () => {
    alert('Esta funcionalidad te llevará a la vista multi-organización. Aún por implementar.');
});