// --- CONFIGURACIÓN ---
const REDIRECT_URI = window.location.origin;

// --- ESTADO DE LA APLICACIÓN ---
let accessToken = null;

// --- ELEMENTOS DEL DOM ---
const mainContent = document.getElementById('main-content');
const dashboard = document.getElementById('dashboard');
const orgList = document.getElementById('org-list');
const machineList = document.getElementById('machine-list');
const loader = document.getElementById('loader');
const errorMessage = document.getElementById('error-message');

// --- LÓGICA DE LA API ---

function handleLogin() {
    const CLIENT_ID = '0oaqqj19wrudozUJm5d7';
    const scopes = 'ag1 org1 eq1 files offline_access';
    const state = Math.random().toString(36).substring(2);
    sessionStorage.setItem('oauth_state', state);
    const authUrl = `https://signin.johndeere.com/oauth2/aus78tnlaysMraFhC1t7/v1/authorize?response_type=code&client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&scope=${scopes}&state=${state}`;
    window.location.href = authUrl;
}

async function getToken(code) {
    showLoader(mainContent);
    try {
        const response = await fetch('/.netlify/functions/get-token', {
            method: 'POST',
            body: JSON.stringify({ code }),
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'No se pudo obtener el token.');
        }
        accessToken = data.access_token;
        showDashboard();
        fetchOrganizations();
    } catch (error) {
        console.error('Error al obtener el token:', error);
        displayError(`Error de autenticación: ${error.message}`);
    }
}

// --- CAMBIO CLAVE: fetchWithToken ahora usa el proxy ---
/**
 * Helper para hacer llamadas a la API de John Deere a través de nuestro proxy.
 * @param {string} endpoint - El endpoint de la API a consultar (ej: 'organizations').
 * @returns {Promise<Response>}
 */
async function fetchWithToken(endpoint) {
    if (!accessToken) {
        throw new Error("No hay token de acceso disponible.");
    }

    // La URL de nuestra función proxy, pasándole el endpoint como parámetro
    const proxyUrl = `/.netlify/functions/api-proxy?endpoint=${endpoint}`;

    const response = await fetch(proxyUrl, {
        headers: {
            // Enviamos el token en un header personalizado para que el proxy lo use
            'x-jd-access-token': accessToken,
        },
    });

    if (!response.ok) {
        // El proxy nos devolverá el error original de la API
        const errorData = await response.json();
        throw new Error(errorData.message || errorData.error_description || `Error de API (${response.status})`);
    }
    // No necesitamos `response.json()` aquí si fetchOrganizations y fetchMachines lo hacen.
    return response;
}


async function fetchOrganizations() {
    showLoader(orgList);
    try {
        // Ahora llamamos con el nombre del endpoint, no la URL completa
        const response = await fetchWithToken('organizations');
        const data = await response.json();
        displayOrganizations(data.values);
    } catch (error) {
        console.error('Error en la llamada a la API de Organizaciones:', error);
        displayError(`Error al obtener organizaciones: ${error.message}`, orgList);
    }
}


async function fetchMachines(orgId) {
    showLoader(machineList, 'Cargando máquinas...');
    try {
        // Construimos el endpoint relativo
        const endpoint = `organizations/${orgId}/machines`;
        const response = await fetchWithToken(endpoint);
        const data = await response.json();
        displayMachines(data.values);
    } catch (error) {
        console.error(`Error al obtener máquinas para la org ${orgId}:`, error);
        displayError(`No se pudieron cargar las máquinas. ${error.message}`, machineList);
    }
}

// --- RENDERIZADO DE UI (sin cambios) ---

function showLoginButton() {
    mainContent.innerHTML = `<a href="#" id="login-btn" class="login-button">Conectar con John Deere</a>`;
    document.getElementById('login-btn').addEventListener('click', (e) => { e.preventDefault(); handleLogin(); });
}

function showDashboard() {
    mainContent.style.display = 'none';
    dashboard.style.display = 'grid';
}

function displayOrganizations(organizations) {
    orgList.innerHTML = '';
    if (!organizations || organizations.length === 0) {
        orgList.innerHTML = '<p class="placeholder">No se encontraron organizaciones.</p>';
        return;
    }
    organizations.forEach(org => {
        const orgItem = document.createElement('div');
        orgItem.className = 'list-item';
        orgItem.textContent = org.name;
        orgItem.dataset.orgId = org.id;
        orgItem.addEventListener('click', () => {
            document.querySelectorAll('.list-item.active').forEach(item => item.classList.remove('active'));
            orgItem.classList.add('active');
            fetchMachines(org.id);
        });
        orgList.appendChild(orgItem);
    });
}

function displayMachines(machines) {
    machineList.innerHTML = '';
    if (!machines || machines.length === 0) {
        machineList.innerHTML = '<p class="placeholder">Esta organización no tiene máquinas conectadas.</p>';
        return;
    }
    machines.forEach(machine => {
        const card = document.createElement('div');
        card.className = 'machine-card';
        card.innerHTML = `<h4>${machine.name}</h4><p>ID: ${machine.id}</p><p>VIN: ${machine.vin || 'No disponible'}</p>`;
        machineList.appendChild(card);
    });
}

function showLoader(container, text = 'Cargando...') {
    hideError();
    container.innerHTML = `<div class="loader-text">${text}</div>`;
    loader.style.display = 'block';
}

function hideLoader() {
    loader.style.display = 'none';
}

function displayError(message, container = null) {
    if (container) {
        container.innerHTML = `<div class="error-inline">${message}</div>`;
    } else {
        mainContent.innerHTML = '';
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
    }
    hideLoader();
}

function hideError() {
    errorMessage.style.display = 'none';
}

// --- PUNTO DE ENTRADA (sin cambios) ---
window.onload = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const authCode = urlParams.get('code');
    const error = urlParams.get('error');
    const returnedState = urlParams.get('state');
    window.history.replaceState({}, document.title, window.location.pathname);
    if (error) {
        const errorDescription = urlParams.get('error_description') || 'Ocurrió un error durante la autorización.';
        displayError(`Error de John Deere: ${errorDescription}`);
        return;
    }
    if (authCode) {
        const storedState = sessionStorage.getItem('oauth_state');
        sessionStorage.removeItem('oauth_state');
        if (!storedState || storedState !== returnedState) {
            displayError('Error de seguridad: el parámetro "state" no coincide. Intenta iniciar sesión de nuevo.');
            setTimeout(showLoginButton, 3000); 
            return;
        }
        getToken(authCode);
    } else {
        showLoginButton();
    }
};