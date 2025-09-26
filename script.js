// --- CONFIGURACIÓN ---
// La URI de redirección se obtiene dinámicamente.
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

/**
 * Inicia el flujo de autenticación OAuth 2.0.
 */
function handleLogin() {
    const CLIENT_ID = '0oaqqj19wrudozUJm5d7';
    const scopes = 'ag1 org1 eq1 files offline_access';

    // --- CAMBIO 1: GENERAR Y GUARDAR EL PARÁMETRO 'state' ---
    // Generamos una cadena aleatoria para el estado.
    const state = Math.random().toString(36).substring(2);
    // La guardamos en la sesión del navegador para verificarla al volver.
    sessionStorage.setItem('oauth_state', state);

    // Añadimos el parámetro 'state' a la URL de autorización.
    const authUrl = `https://signin.johndeere.com/oauth2/aus78tnlaysMraFhC1t7/v1/authorize?response_type=code&client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&scope=${scopes}&state=${state}`;
    
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
    const error = urlParams.get('error');
    const returnedState = urlParams.get('state');

    // Limpiamos la URL para que los parámetros no queden visibles
    window.history.replaceState({}, document.title, window.location.pathname);

    if (error) {
        const errorDescription = urlParams.get('error_description') || 'Ocurrió un error durante la autorización.';
        displayError(`Error de John Deere: ${errorDescription}`);
        return;
    }

    if (authCode) {
        // --- CAMBIO 2: VERIFICAR EL PARÁMETRO 'state' ---
        const storedState = sessionStorage.getItem('oauth_state');
        // Limpiamos el state de la sesión para que no se pueda reutilizar.
        sessionStorage.removeItem('oauth_state');

        if (!storedState || storedState !== returnedState) {
            displayError('Error de seguridad: el parámetro "state" no coincide. Intenta iniciar sesión de nuevo.');
            // Mostramos el botón de login de nuevo para que el usuario pueda reintentar
            setTimeout(showLoginButton, 3000); 
            return;
        }

        // Si el state es correcto, procedemos a obtener el token.
        getToken(authCode);
    } else {
        showLoginButton();
    }
};