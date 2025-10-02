// --- CONFIGURACIÓN ---
const REDIRECT_URI = window.location.origin;
const CLIENT_ID = '0oaqqj19wrudozUJm5d7';

// --- ESTADO DE LA APLICACIÓN ---
let accessToken = null;

// --- ELEMENTOS DEL DOM ---
const mainContent = document.getElementById('main-content');
const dashboard = document.getElementById('dashboard');
const orgPanel = document.getElementById('org-panel');
const dataPanel = document.getElementById('data-panel');
const detailsPanel = document.getElementById('details-panel');
const orgList = document.getElementById('org-list');
const machineList = document.getElementById('machine-list');
const fieldList = document.getElementById('field-list');
const operationList = document.getElementById('operation-list');
const tabs = document.querySelector('.tabs');
const loader = document.getElementById('loader');
const errorMessage = document.getElementById('error-message');

// --- LÓGICA DE LA API ---
async function fetchWithToken(endpoint) {
    if (!accessToken) throw new Error("No hay token de acceso disponible.");
    const proxyUrl = `/.netlify/functions/get-token?endpoint=${encodeURIComponent(endpoint)}`;
    const response = await fetch(proxyUrl, { method: 'GET', headers: { 'x-jd-access-token': accessToken } });
    if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try { errorData = JSON.parse(errorText); } catch (e) { errorData = { message: errorText }; }
        const error = new Error(errorData.message || errorData.error_description || `Error de API (${response.status})`);
        error.status = response.status;
        error.body = errorData;
        throw error;
    }
    return response;
}

// Lógica de inicio simple: solo obtiene las organizaciones
async function fetchOrganizations() {
    showLoader(orgList);
    try {
        const response = await fetchWithToken('organizations');
        const data = await response.json();
        const hasConnectedOrgs = data.values && data.values.length > 0;
        if (hasConnectedOrgs) {
            dashboard.classList.add('three-columns');
            dataPanel.style.display = 'block';
            detailsPanel.style.display = 'block';
            displayOrganizations(data.values);
        } else {
            const connectionUrl = `https://connections.deere.com/connections/add-connection/${CLIENT_ID}`;
            const messageHtml = `<h2>Paso Final: Conecta tus Organizaciones</h2><p>Parece que no has conectado ninguna organización a SARTOR. Por favor, haz clic en el botón de abajo para configurar tus conexiones.</p><a href="${connectionUrl}" target="_blank" class="permission-link" style="display:block; text-align:center; margin-top:20px;">Configurar Conexiones</a>`;
            orgList.innerHTML = `<div class="setup-message">${messageHtml}</div>`;
        }
    } catch (error) {
        handleApiError(error, orgList, 'organizaciones');
    }
}

// Se ejecuta cada vez que se selecciona una organización
async function handleOrgSelection(orgId) {
    // Poner ambos paneles en estado de carga para evitar condiciones de carrera
    operationList.innerHTML = '<p class="placeholder">Selecciona un campo para ver sus operaciones.</p>';
    machineList.innerHTML = '<div class="loader-text">Cargando equipos...</div>';
    fieldList.innerHTML = '<div class="loader-text">Cargando campos...</div>';

    // Ejecutar ambas llamadas en paralelo y esperar a que terminen
    await Promise.all([
        fetchEquipmentForOrg(orgId),
        fetchFields(orgId)
    ]);
}

async function fetchEquipmentForOrg(orgId) {
    try {
        const response = await fetchWithToken('equipment?status=all');
        const data = await response.json();
        const allEquipment = data.values || [];
        const equipmentForOrg = allEquipment.filter(eq => eq.organization && String(eq.organization.id) === String(orgId));
        displayMachines(equipmentForOrg);
    } catch (error) {
        handleApiError(error, machineList, 'equipos', orgId);
    }
}

async function fetchFields(orgId) {
    try {
        const response = await fetchWithToken(`organizations/${orgId}/fields?status=all`);
        const data = await response.json();
        displayFields(data.values, orgId);
    } catch (error) {
        handleApiError(error, fieldList, 'campos', orgId);
    }
}

async function fetchFieldOperations(fieldId, orgId) {
    showLoader(operationList, 'Cargando operaciones...');
    try {
        const response = await fetchWithToken(`organizations/${orgId}/fields/${fieldId}/fieldOperations`);
        const data = await response.json();
        displayFieldOperations(data.values);
    } catch (error) {
        handleApiError(error, operationList, 'operaciones de campo', orgId);
    }
}

function handleApiError(error, container, resourceName, orgId = null) {
    console.error(`Error al obtener ${resourceName}:`, error);
    if (error.status === 403) {
        const manageConnectionUrl = `https://connections.deere.com/connections/${CLIENT_ID}/connections-dialog${orgId ? `?orgId=${orgId}` : ''}`;
        const messageHtml = `<p><strong>Acceso denegado (403).</strong></p><p>Parece que los permisos para esta organización no están bien configurados. Por favor, haz clic en el botón de abajo para ir directamente a la gestión de permisos.</p><a href="${manageConnectionUrl}" target="_blank" class="permission-link">Gestionar Permisos para esta Organización</a><p style="margin-top:15px; font-size: 0.9em; color: #718096;">En la nueva pestaña, haz clic en "Editar", asigna todos los permisos (Nivel 3), guarda, y luego vuelve aquí y haz clic de nuevo en la organización.</p>`;
        displayError(messageHtml, container, true);
        return;
    }
    displayError(`No se pudieron cargar los ${resourceName}. ${error.message}`, container);
}

function displayOrganizations(organizations) {
    if (!organizations || organizations.length === 0) { return; }
    orgList.innerHTML = '';
    organizations.forEach(org => {
        const orgItem = document.createElement('div');
        orgItem.className = 'list-item';
        orgItem.textContent = org.name;
        orgItem.dataset.orgId = org.id;
        orgItem.addEventListener('click', () => {
            document.querySelectorAll('#org-list .list-item.active').forEach(item => item.classList.remove('active'));
            orgItem.classList.add('active');
            handleOrgSelection(org.id);
        });
        orgList.appendChild(orgItem);
    });
}

function displayMachines(equipment) {
    machineList.innerHTML = '';
    if (!equipment || equipment.length === 0) {
        machineList.innerHTML = '<p class="placeholder">Esta organización no tiene equipos conectados.</p>';
        return;
    }
    equipment.forEach(eq => {
        const card = document.createElement('div');
        card.className = 'machine-card';
        card.innerHTML = `<h4>${eq.title || eq.name}</h4><p>ID: ${eq.principalId}</p><p>VIN: ${eq.identificationNumber || 'No disponible'}</p>`;
        machineList.appendChild(card);
    });
}

function displayFields(fields, orgId) {
    fieldList.innerHTML = '';
    if (!fields || fields.length === 0) {
        fieldList.innerHTML = '<p class="placeholder">Esta organización no tiene campos registrados.</p>';
        return;
    }
    fields.forEach(field => {
        const fieldItem = document.createElement('div');
        fieldItem.className = 'list-item';
        fieldItem.textContent = field.name;
        fieldItem.addEventListener('click', () => {
            document.querySelectorAll('#field-list .list-item.active').forEach(item => item.classList.remove('active'));
            fieldItem.classList.add('active');
            fetchFieldOperations(field.id, orgId);
        });
        fieldList.appendChild(fieldItem);
    });
}

function displayFieldOperations(operations) {
    if (!operations || operations.length === 0) {
        operationList.innerHTML = '<p class="placeholder">No se encontraron operaciones para este campo.</p>';
        return;
    }
    operationList.innerHTML = '';
    operations.forEach(op => {
        const card = document.createElement('div');
        card.className = 'operation-card';
        card.innerHTML = `<h4>${op.name}</h4>`;
        operationList.appendChild(card);
    });
}

// --- INICIO DE LA CORRECCIÓN FINAL ---
tabs.addEventListener('click', (e) => {
    if (!e.target.classList.contains('tab-button')) return;

    const tabName = e.target.dataset.tab; // 'machines' o 'fields'

    // Desactivar todo primero
    tabs.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

    // Activar el botón correcto
    e.target.classList.add('active');

    // Activar el panel correcto usando el ID correcto
    if (tabName === 'machines') {
        document.getElementById('machine-list').classList.add('active');
    } else if (tabName === 'fields') {
        document.getElementById('field-list').classList.add('active');
    }
});
// --- FIN DE LA CORRECCIÓN FINAL ---


function showLoginButton() { mainContent.innerHTML = `<a href="#" id="login-btn" class="login-button">Conectar con John Deere</a>`; document.getElementById('login-btn').addEventListener('click', (e) => { e.preventDefault(); handleLogin(); }); }
function showDashboard() { mainContent.style.display = 'none'; dashboard.style.display = 'grid'; }
function showLoader(container, text = 'Cargando...') { hideError(); container.innerHTML = `<div class="loader-text">${text}</div>`; }
function hideLoader() {}
function displayError(message, container = null, isHtml = false) { if (container) { if (isHtml) { container.innerHTML = `<div class="error-inline">${message}</div>`; } else { container.innerHTML = `<div class="error-inline">${message}</div>`; } } else { mainContent.innerHTML = ''; if (isHtml) { errorMessage.innerHTML = message; } else { errorMessage.textContent = message; } errorMessage.style.display = 'block'; } hideLoader(); }
function hideError() { errorMessage.style.display = 'none'; }
function handleLogin() { const scopes = 'ag3 org2 eq2 files offline_access'; const state = Math.random().toString(36).substring(2); sessionStorage.setItem('oauth_state', state); const authUrl = `https://signin.johndeere.com/oauth2/aus78tnlaysMraFhC1t7/v1/authorize?response_type=code&client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&scope=${scopes}&state=${state}`; window.location.href = authUrl; }
async function getToken(code) { showLoader(mainContent); try { const response = await fetch('/.netlify/functions/get-token', { method: 'POST', body: JSON.stringify({ code }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || 'No se pudo obtener el token.'); accessToken = data.access_token; showDashboard(); fetchOrganizations(); } catch (error) { console.error('Error al obtener el token:', error); displayError(`Error de autenticación: ${error.message}`); } }
window.onload = () => { const urlParams = new URLSearchParams(window.location.search); const authCode = urlParams.get('code'); const error = urlParams.get('error'); const returnedState = urlParams.get('state'); window.history.replaceState({}, document.title, window.location.pathname); if (error) { const errorDescription = urlParams.get('error_description') || 'Ocurrió un error.'; displayError(`Error de John Deere: ${errorDescription}`); return; } if (authCode) { const storedState = sessionStorage.getItem('oauth_state'); sessionStorage.removeItem('oauth_state'); if (!storedState || storedState !== returnedState) { displayError('Error de seguridad: el "state" no coincide.'); setTimeout(showLoginButton, 3000); return; } getToken(authCode); } else { showLoginButton(); } };