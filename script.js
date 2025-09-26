// --- CONFIGURACIÓN ---
// REEMPLAZA ESTE VALOR CON TU APPLICATION ID DE JOHN DEERE
const CLIENT_ID = '0oaqqj19wrudozUJm5d7'; 

// URIs de redirección. La correcta se usará dependiendo del entorno.
const REDIRECT_URI_DEV = 'https://stackblitz.com/~/github.com/biktormo/DS_Operations_Center'; // Ej: https://project-name-xyz.stackblitz.io
const REDIRECT_URI_PROD = 'https://opcentersartor.netlify.app/'; // Ej: https://mi-app-jd.netlify.app

// --- ELEMENTOS DEL DOM ---
const mainContent = document.getElementById('main-content');
const loader = document.getElementById('loader');
const errorMessage = document.getElementById('error-message');

// --- LÓGICA DE LA APLICACIÓN ---

/**
 * Determina la URI de redirección correcta basada en el hostname.
 * @returns {string} La URI de redirección.
 */
function getRedirectUri() {
    if (window.location.hostname.includes('stackblitz')) {
        return REDIRECT_URI_DEV;
    }
    return REDIRECT_URI_PROD;
}

/**
 * Inicia el flujo de autenticación OAuth 2.0.
 */
function handleLogin() {
    const scopes = 'ag1 org1 eq1 files offline_access';
    const authUrl = `https://signin.johndeere.com/oauth2/aus78tnlaysMraFhC1t7/v1/authorize?response_type=code&client_id=${CLIENT_ID}&redirect_uri=${getRedirectUri()}&scope=${scopes}`;
    window.location.href = authUrl;
}

/**
 * Muestra un mensaje de error en la interfaz.
 * @param {string} message - El mensaje de error a mostrar.
 */
function displayError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    loader.style.display = 'none';
}

/**
 * Intercambia el código de autorización por un token de acceso llamando a nuestra Netlify Function.
 * @param {string} code - El código de autorización de la URL.
 */
async function getToken(code) {
    showLoader();
    try {
        // La URL de la función es relativa a la raíz del sitio.
        const response = await fetch('/.netlify/functions/get-token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ code: code }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'No se pudo obtener el token.');
        }

        const data = await response.json();
        // Guardamos el token para usarlo. En una app real, usa localStorage o sessionStorage.
        fetchOrganizations(data.access_token);

    } catch (error) {
        console.error('Error al obtener el token:', error);
        displayError(`Error al obtener el token: ${error.message}`);
    }
}

/**
 * Obtiene y muestra la lista de organizaciones del usuario.
 * @param {string} accessToken - El token de acceso para autenticar la llamada a la API.
 */
async function fetchOrganizations(accessToken) {
    showLoader();
    try {
        const response = await fetch('https://sandboxapi.deere.com/platform/organizations', {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/vnd.deere.axiom.v3+json',
            },
        });

        if (!response.ok) {
            // Si el token es inválido o expiró, la API devolverá un error.
             if (response.status === 401) {
                // En una app real, aquí deberías usar el refresh_token para obtener un nuevo access_token.
                throw new Error('Token no autorizado o expirado.');
            }
            throw new Error('Error al obtener las organizaciones.');
        }

        const data = await response.json();
        displayOrganizations(data.values);

    } catch (error) {
        console.error('Error en la llamada a la API:', error);
        displayError(`Error al obtener datos de la API: ${error.message}`);
    }
}

/**
 * Renderiza la lista de organizaciones en el DOM.
 * @param {Array} organizations - Un array de objetos de organización.
 */
function displayOrganizations(organizations) {
    mainContent.innerHTML = ''; // Limpiar contenido anterior
    loader.style.display = 'none';

    if (organizations && organizations.length > 0) {
        const orgList = document.createElement('div');
        orgList.className = 'org-list';
        orgList.innerHTML = '<h2>Tus Organizaciones</h2>';
        
        const ul = document.createElement('ul');
        organizations.forEach(org => {
            const li = document.createElement('li');
            li.textContent = `${org.name} (ID: ${org.id})`;
            ul.appendChild(li);
        });

        orgList.appendChild(ul);
        mainContent.appendChild(orgList);
    } else {
        mainContent.innerHTML = '<p>No se encontraron organizaciones.</p>';
    }
}


/**
 * Muestra el botón de inicio de sesión inicial.
 */
function showLoginButton() {
     mainContent.innerHTML = `
        <a href="#" id="login-btn" class="login-button">Conectar con John Deere</a>
    `;
    document.getElementById('login-btn').addEventListener('click', (e) => {
        e.preventDefault();
        handleLogin();
    });
}

/**
 * Muestra el indicador de carga.
 */
function showLoader() {
    mainContent.innerHTML = ''; // Limpiar para solo mostrar el loader
    loader.style.display = 'block';
    errorMessage.style.display = 'none';
}


// --- PUNTO DE ENTRADA ---

/**
 * Se ejecuta cuando la página se carga.
 * Comprueba si la URL contiene un `code` para saber si estamos volviendo de John Deere.
 */
window.onload = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const authCode = urlParams.get('code');

    if (authCode) {
        // Si tenemos un código, lo intercambiamos por un token.
        // Limpiamos la URL para que el código no quede visible.
        window.history.replaceState({}, document.title, window.location.pathname);
        getToken(authCode);
    } else {
        // Si no hay código, mostramos el botón de login.
        showLoginButton();
    }
};