// --- CONFIGURACIÓN ---
const REDIRECT_URI = window.location.origin + '/legacy.html'; // Apunta a esta misma página
const CLIENT_ID = '0oaqqj19wrudozUJm5d7';

// --- ESTADO DE LA APLICACIÓN ---
let accessToken = null;

// --- ELEMENTOS DEL DOM ---
const dashboard = document.getElementById('dashboard');
const orgList = document.getElementById('org-list');
const machineList = document.getElementById('machine-list');
const fieldList = document.getElementById('field-list');
const operationList = document.getElementById('operation-list');
const tabs = document.querySelector('.tabs');

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

async function fetchOrganizations() {
    showLoader(orgList);
    try {
        const response = await fetchWithToken('organizations');
        const data = await response.json();
        const connectedOrgs = data.values || [];
        if (connectedOrgs.length > 0) {
            displayOrganizations(connectedOrgs);
        } else {
             orgList.innerHTML = '<p class="placeholder">No hay organizaciones conectadas.</p>';
        }
    } catch (error) {
        handleApiError(error, orgList, 'organizaciones');
    }
}

async function handleOrgSelection(orgId) {
    operationList.innerHTML = '<p class="placeholder">Selecciona un campo para ver sus operaciones.</p>';
    machineList.innerHTML = '<div class="loader-text">Cargando equipos...</div>';
    fieldList.innerHTML = '<div class="loader-text">Cargando campos...</div>';
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

// ... (El resto de las funciones son iguales)
async function fetchFieldOperations(fieldId, orgId) { showLoader(operationList, 'Cargando operaciones...'); try { const response = await fetchWithToken(`organizations/${orgId}/fields/${fieldId}/fieldOperations`); const data = await response.json(); displayFieldOperations(data.values); } catch (error) { handleApiError(error, operationList, 'operaciones de campo', orgId); } }
function handleApiError(error, container, resourceName, orgId = null) { console.error(`Error al obtener ${resourceName}:`, error); if (error.status === 403) { const manageConnectionUrl = `https://connections.deere.com/connections/${CLIENT_ID}/connections-dialog${orgId ? `?orgId=${orgId}` : ''}`; const messageHtml = `<p><strong>Acceso denegado (403).</strong></p><p>Parece que los permisos para esta organización no están bien configurados. Por favor, haz clic en el botón de abajo para ir directamente a la gestión de permisos.</p><a href="${manageConnectionUrl}" target="_blank" class="permission-link">Gestionar Permisos para esta Organización</a><p style="margin-top:15px; font-size: 0.9em; color: #718096;">En la nueva pestaña, haz clic en "Editar", asigna todos los permisos (Nivel 3), guarda, y luego vuelve aquí y haz clic de nuevo en la organización.</p>`; displayError(messageHtml, container, true); return; } displayError(`No se pudieron cargar los ${resourceName}. ${error.message}`, container); }
function displayOrganizations(organizations) { if (!organizations || organizations.length === 0) { return; } orgList.innerHTML = ''; organizations.forEach(org => { const orgItem = document.createElement('div'); orgItem.className = 'list-item'; orgItem.textContent = org.name; orgItem.dataset.orgId = org.id; orgItem.addEventListener('click', () => { document.querySelectorAll('#org-list .list-item.active').forEach(item => item.classList.remove('active')); orgItem.classList.add('active'); handleOrgSelection(org.id); }); orgList.appendChild(orgItem); }); }
function displayMachines(equipment) { machineList.innerHTML = ''; if (!equipment || equipment.length === 0) { machineList.innerHTML = '<p class="placeholder">Esta organización no tiene equipos conectados.</p>'; return; } equipment.forEach(eq => { const card = document.createElement('div'); card.className = 'machine-card'; card.innerHTML = `<h4>${eq.title || eq.name}</h4><p>ID: ${eq.principalId}</p><p>VIN: ${eq.identificationNumber || 'No disponible'}</p>`; machineList.appendChild(card); }); }
function displayFields(fields, orgId) { fieldList.innerHTML = ''; if (!fields || fields.length === 0) { fieldList.innerHTML = '<p class="placeholder">Esta organización no tiene campos registrados.</p>'; return; } fields.forEach(field => { const fieldItem = document.createElement('div'); fieldItem.className = 'list-item'; fieldItem.textContent = field.name; fieldItem.addEventListener('click', () => { document.querySelectorAll('#field-list .list-item.active').forEach(item => item.classList.remove('active')); fieldItem.classList.add('active'); fetchFieldOperations(field.id, orgId); }); fieldList.appendChild(fieldItem); }); }
function displayFieldOperations(operations) { if (!operations || operations.length === 0) { operationList.innerHTML = '<p class="placeholder">No se encontraron operaciones para este campo.</p>'; return; } operationList.innerHTML = ''; operations.forEach(op => { const card = document.createElement('div'); card.className = 'operation-card'; card.innerHTML = `<h4>${op.name}</h4>`; operationList.appendChild(card); }); }
tabs.addEventListener('click', (e) => { if (!e.target.classList.contains('tab-button')) return; const tabName = e.target.dataset.tab; tabs.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active')); document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active')); e.target.classList.add('active'); if (tabName === 'machines') { document.getElementById('machine-list').classList.add('active'); } else if (tabName === 'fields') { document.getElementById('field-list').classList.add('active'); } });
function showLoader(container, text = '') { container.innerHTML = `<div class="loader">${text}</div>`; }
function displayError(message, container, isHtml = false) { if (isHtml) { container.innerHTML = `<div class="error-inline">${message}</div>`; } else { container.innerHTML = `<div class="error-inline">${message}</div>`; } }

// Lógica de carga para esta página
window.onload = () => {
    // Reutiliza el token de la sesión principal
    accessToken = sessionStorage.getItem('jd_access_token');

    if (accessToken) {
        fetchOrganizations();
    } else {
        // Si no hay token, redirige a la página principal para iniciar sesión
        alert("Por favor, inicia sesión desde la página principal primero.");
        window.location.href = '/';
    }
};