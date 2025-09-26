// --- CONFIGURACIÓN ---
const REDIRECT_URI = window.location.origin;

// --- ESTADO DE LA APLICACIÓN ---
let accessToken = null;

// --- ELEMENTOS DEL DOM ---
const mainContent = document.getElementById('main-content');
const dashboard = document.getElementById('dashboard');
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
    const proxyUrl = `/.netlify/functions/api-proxy?endpoint=${encodeURIComponent(endpoint)}`;
    const response = await fetch(proxyUrl, { headers: { 'x-jd-access-token': accessToken } });

    if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        let errorMessage;
        try {
            errorData = JSON.parse(errorText);
            errorMessage = errorData.message || errorData.error_description || `Error de API (${response.status})`;
        } catch (e) {
            errorData = { message: errorText };
            errorMessage = errorText;
        }
        const error = new Error(errorMessage);
        error.status = response.status;
        error.body = errorData;
        throw error;
    }
    return response;
}

function handleLogin() { const CLIENT_ID = '0oaqqj19wrudozUJm5d7'; const scopes = 'ag1 org1 eq1 files offline_access'; const state = Math.random().toString(36).substring(2); sessionStorage.setItem('oauth_state', state); const authUrl = `https://signin.johndeere.com/oauth2/aus78tnlaysMraFhC1t7/v1/authorize?response_type=code&client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&scope=${scopes}&state=${state}`; window.location.href = authUrl; }
async function getToken(code) { showLoader(mainContent); try { const response = await fetch('/.netlify/functions/get-token', { method: 'POST', body: JSON.stringify({ code }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || 'No se pudo obtener el token.'); accessToken = data.access_token; showDashboard(); fetchOrganizations(); } catch (error) { console.error('Error al obtener el token:', error); displayError(`Error de autenticación: ${error.message}`); } }
async function fetchOrganizations() { showLoader(orgList); try { const response = await fetchWithToken('organizations'); const data = await response.json(); displayOrganizations(data.values); } catch (error) { handleApiError(error, orgList, 'organizaciones'); } }
async function handleOrgSelection(orgId) { machineList.innerHTML = '<p class="placeholder">Cargando...</p>'; fieldList.innerHTML = '<p class="placeholder">Cargando...</p>'; operationList.innerHTML = '<p class="placeholder">Selecciona un campo para ver sus operaciones.</p>'; fetchMachines(orgId); fetchFields(orgId); }
async function fetchMachines(orgId) { showLoader(machineList, 'Cargando máquinas...'); try { const response = await fetchWithToken(`organizations/${orgId}/machines`); const data = await response.json(); displayMachines(data.values); } catch (error) { handleApiError(error, machineList, 'máquinas'); } }
async function fetchFields(orgId) { showLoader(fieldList, 'Cargando campos...'); try { const response = await fetchWithToken(`organizations/${orgId}/fields`); const data = await response.json(); displayFields(data.values, orgId); } catch (error) { handleApiError(error, fieldList, 'campos'); } }
async function fetchFieldOperations(fieldId, orgId) { showLoader(operationList, 'Cargando operaciones...'); try { const response = await fetchWithToken(`organizations/${orgId}/fields/${fieldId}/fieldOperations`); const data = await response.json(); displayFieldOperations(data.values); } catch (error) { handleApiError(error, operationList, 'operaciones de campo'); } }

// --- RENDERIZADO Y MANEJO DE UI ---
function handleApiError(error, container, resourceName) { console.error(`Error al obtener ${resourceName}:`, error); if (error.status === 403 && error.body && error.body.links) { const connectionLink = error.body.links.find(link => link.rel === 'connections'); if (connectionLink) { const messageHtml = `Se requieren permisos. <a href="${connectionLink.uri}" target="_blank" class="permission-link">Habilita el acceso aquí</a> y reintenta.`; displayError(messageHtml, container, true); return; } } displayError(`No se pudieron cargar los ${resourceName}. ${error.message}`, container); }
function displayOrganizations(organizations) { if (!organizations || organizations.length === 0) { orgList.innerHTML = '<p class="placeholder">No se encontraron organizaciones.</p>'; return; } orgList.innerHTML = ''; organizations.forEach(org => { const orgItem = document.createElement('div'); orgItem.className = 'list-item'; orgItem.textContent = org.name; orgItem.addEventListener('click', () => { document.querySelectorAll('#org-list .list-item.active').forEach(item => item.classList.remove('active')); orgItem.classList.add('active'); handleOrgSelection(org.id); }); orgList.appendChild(orgItem); }); }
function displayMachines(machines) { if (!machines || machines.length === 0) { machineList.innerHTML = '<p class="placeholder">Esta organización no tiene máquinas conectadas.</p>'; return; } machineList.innerHTML = ''; machines.forEach(machine => { const card = document.createElement('div'); card.className = 'machine-card'; card.innerHTML = `<h4>${machine.name}</h4><p>ID: ${machine.id}</p><p>VIN: ${machine.vin || 'No disponible'}</p>`; machineList.appendChild(card); }); }
function displayFields(fields, orgId) { if (!fields || fields.length === 0) { fieldList.innerHTML = '<p class="placeholder">Esta organización no tiene campos registrados.</p>'; return; } fieldList.innerHTML = ''; fields.forEach(field => { const fieldItem = document.createElement('div'); fieldItem.className = 'list-item'; fieldItem.textContent = field.name; fieldItem.addEventListener('click', () => { document.querySelectorAll('#field-list .list-item.active').forEach(item => item.classList.remove('active')); fieldItem.classList.add('active'); fetchFieldOperations(field.id, orgId); }); fieldList.appendChild(fieldItem); }); }
function displayFieldOperations(operations) { if (!operations || operations.length === 0) { operationList.innerHTML = '<p class="placeholder">No se encontraron operaciones para este campo.</p>'; return; } operationList.innerHTML = ''; operations.forEach(op => { const card = document.createElement('div'); card.className = 'operation-card'; card.innerHTML = `<h4>${op.name}</h4>`; operationList.appendChild(card); }); }
tabs.addEventListener('click', (e) => { if (!e.target.classList.contains('tab-button')) return; const tabName = e.target.dataset.tab; tabs.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active')); e.target.classList.add('active'); document.querySelectorAll('.tab-content').forEach(content => { if (content.id === `${tabName}-list`) { content.classList.add('active'); } else { content.classList.remove('active'); } }); });
function showLoginButton() { mainContent.innerHTML = `<a href="#" id="login-btn" class="login-button">Conectar con John Deere</a>`; document.getElementById('login-btn').addEventListener('click', (e) => { e.preventDefault(); handleLogin(); }); }
function showDashboard() { mainContent.style.display = 'none'; dashboard.style.display = 'grid'; }
function showLoader(container, text = 'Cargando...') { hideError(); container.innerHTML = `<div class="loader-text">${text}</div>`; }
function hideLoader() { }
function displayError(message, container = null, isHtml = false) { if (container) { if (isHtml) { container.innerHTML = `<div class="error-inline">${message}</div>`; } else { container.innerHTML = `<div class="error-inline">${message}</div>`; } } else { mainContent.innerHTML = ''; if (isHtml) { errorMessage.innerHTML = message; } else { errorMessage.textContent = message; } errorMessage.style.display = 'block'; } hideLoader(); }
function hideError() { errorMessage.style.display = 'none'; }
window.onload = () => { const urlParams = new URLSearchParams(window.location.search); const authCode = urlParams.get('code'); const error = urlParams.get('error'); const returnedState = urlParams.get('state'); window.history.replaceState({}, document.title, window.location.pathname); if (error) { const errorDescription = urlParams.get('error_description') || 'Ocurrió un error.'; displayError(`Error de John Deere: ${errorDescription}`); return; } if (authCode) { const storedState = sessionStorage.getItem('oauth_state'); sessionStorage.removeItem('oauth_state'); if (!storedState || storedState !== returnedState) { displayError('Error de seguridad: el "state" no coincide.'); setTimeout(showLoginButton, 3000); return; } getToken(authCode); } else { showLoginButton(); } };