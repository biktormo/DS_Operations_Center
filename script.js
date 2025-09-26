// --- CONFIGURACIÓN ---
// YA NO NECESITAMOS EL CLIENT_ID AQUÍ, lo usará la Netlify Function.

// La URI de redirección se obtiene dinámicamente.
// Asegúrate de configurar la URL correcta en tu App de John Deere y en las variables de entorno de Netlify.
const REDIRECT_URI = window.location.origin + window.location.pathname;

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

/**
 * Inicia el flujo de autenticación OAuth 2.0.
 */
function handleLogin() {
    // TU CLIENT_ID DE JOHN DEERE. Es seguro tenerlo en el frontend.
    const CLIENT_ID = '0oaqqj19wrudozUJm5d7';
    const scopes = 'ag1 org1 eq1 files offline_access';
    const authUrl = `https://signin.johndeere.com/oauth2/aus78tnlaysMraFhC1t7/v1/authorize?response_type=code&client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&scope=${scopes}`;
    window.location.href = authUrl;
}

/**
 * Intercambia el código de autorización por un token de acceso llamando a nuestra Netlify Function.
 * @param {string} code - El código de autorización de la URL.
 */
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
        // En una app real, aquí también guardarías el refresh_token y expires_in en localStorage
        // para manejar la expiración del token.
        
        showDashboard();
        fetchOrganizations();

    } catch (error) {
        console.error('Error al obtener el token:', error);
        displayError(`Error de autenticación: ${error.message}`);
    }
}

/**
 * Obtiene y muestra la lista de organizaciones del usuario.
 */
async function fetchOrganizations() {
    showLoader(orgList);
    try {
        const response = await fetchWithToken('https://sandboxapi.deere.com/platform/organizations');
        const data = await response.json();
        displayOrganizations(data.values);
    } catch (error) {
        console.error('Error en la llamada a la API de Organizaciones:', error);
        displayError(`Error al obtener organizaciones: ${error.message}`, orgList);
    }
}

/**
 * Obtiene las máquinas para una organización específica.
 * @param {string} orgId - El ID de la organización.
 */
async function fetchMachines(orgId) {
    showLoader(machineList, 'Cargando máquinas...');
    try {
        const url = `https://sandboxapi.deere.com/platform/organizations/${orgId}/machines`;
        const response = await fetchWithToken(url);
        const data = await response.json();
        displayMachines(data.values);
    } catch (error) {
        console.error(`Error al obtener máquinas para la org ${orgId}:`, error);
        displayError(`No se pudieron cargar las máquinas. ${error.message}`, machineList);
    }
}


/**
 * Helper para hacer llamadas a la API con el token de acceso.
 * @param {string} url - La URL del endpoint de la API.
 * @returns {Promise<Response>}
 */
async function fetchWithToken(url) {
    if (!accessToken) {
        throw new Error("No hay token de acceso disponible.");
    }
    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/vnd.deere.axiom.v3+json',
        },
    });

    if (!response.ok) {
        if (response.status === 401) {
            // Aquí implementarías la lógica de refresh token.
            throw new Error('Token no autorizado o expirado. Por favor, vuelve a iniciar sesión.');
        }
        const errorData = await response.text();
        throw new Error(`Error de API (${response.status}): ${errorData}`);
    }
    return response;
}


// --- RENDERIZADO DE UI ---

function showLoginButton() {
    mainContent.innerHTML = `
        <a href="#" id="login-btn" class="login-button">Conectar con John Deere</a>
    `;
    document.getElementById('login-btn').addEventListener('click', (e) => {
        e.preventDefault();
        handleLogin();
    });
}

function showDashboard() {
    mainContent.style.display = 'none';
    dashboard.style.display = 'grid';
}

function displayOrganizations(organizations) {
    orgList.innerHTML = ''; // Limpiar loader
    if (!organizations || organizations.length === 0) {
        orgList.innerHTML = '<p class="placeholder">No se encontraron organizaciones.</p>';
        return;
    }

    organizations.forEach(org => {
        const orgItem = document.createElement('div');
        orgItem.className = 'list-item';
        orgItem.textContent = org.name;
        orgItem.dataset.orgId = org.id; // Guardamos el ID para usarlo después

        orgItem.addEventListener('click', () => {
            // Marcar como activo
            document.querySelectorAll('.list-item.active').forEach(item => item.classList.remove('active'));
            orgItem.classList.add('active');
            
            // Cargar máquinas
            fetchMachines(org.id);
        });
        orgList.appendChild(orgItem);
    });
}

function displayMachines(machines) {
    machineList.innerHTML = ''; // Limpiar loader o placeholder
    if (!machines || machines.length === 0) {
        machineList.innerHTML = '<p class="placeholder">Esta organización no tiene máquinas conectadas.</p>';
        return;
    }
    
    machines.forEach(machine => {
        const card = document.createElement('div');
        card.className = 'machine-card';
        card.innerHTML = `
            <h4>${machine.name}</h4>
            <p>ID: ${machine.id}</p>
            <p>VIN: ${machine.vin || 'No disponible'}</p>
        `;
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

// --- PUNTO DE ENTRADA ---
window.onload = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const authCode = urlParams.get('code');

    if (authCode) {
        window.history.replaceState({}, document.title, window.location.pathname);
        getToken(authCode);
    } else {
        showLoginButton();
    }
};