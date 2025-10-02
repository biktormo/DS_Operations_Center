const fetch = require('node-fetch');

// --- Lógica para obtener el token (sin cambios) ---
const handleTokenRequest = async (event) => { /* ... (código sin cambios) ... */ };

// --- Lógica para actuar como proxy (MODIFICADA) ---
const handleProxyRequest = async (event) => {
    // Definimos las dos URLs base
    const PLATFORM_API_BASE_URL = 'https://sandboxapi.deere.com/platform/';
    const EQUIPMENT_API_BASE_URL = 'https://equipmentapi.deere.com/isg/';

    const endpoint = event.queryStringParameters.endpoint;
    const accessToken = event.headers['x-jd-access-token'];

    if (!accessToken || !endpoint) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Missing parameters.' }) };
    }

    let apiUrl;
    let headers;

    // --- CAMBIO CLAVE: Decidimos qué URL base y headers usar ---
    if (endpoint.startsWith('equipment')) {
        apiUrl = new URL(endpoint, EQUIPMENT_API_BASE_URL).toString();
        headers = {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json' // Equipment API usa application/json
        };
    } else {
        apiUrl = new URL(endpoint, PLATFORM_API_BASE_URL).toString();
        headers = {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/vnd.deere.axiom.v3+json', // Platform API usa este header
            'No_paging': 'True'
        };
    }

    const response = await fetch(apiUrl, { headers });

    const responseBodyText = await response.text();
    if (!response.ok) {
        console.error(`Error from John Deere API (proxy for ${endpoint}):`, responseBodyText);
    }
    return { statusCode: response.status, body: responseBodyText };
};

// --- Handler Principal que decide qué hacer ---
exports.handler = async (event) => { /* ... (código sin cambios) ... */ };


// **Para facilitar, aquí está el bloque completo de get-token.js:**
const handleTokenRequest = async (event) => {
    const { CLIENT_ID, CLIENT_SECRET, REDIRECT_URI } = process.env;
    const TOKEN_URL = 'https://signin.johndeere.com/oauth2/aus78tnlaysMraFhC1t7/v1/token';
    const { code } = JSON.parse(event.body);
    if (!code) { return { statusCode: 400, body: JSON.stringify({ error: 'Authorization code is missing.' }) }; }
    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('code', code);
    params.append('redirect_uri', REDIRECT_URI);
    const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
    const response = await fetch(TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': `Basic ${credentials}` }, body: params, });
    const data = await response.json();
    if (!response.ok) { console.error('Error from John Deere API (token):', data); return { statusCode: response.status, body: JSON.stringify({ error: data.error_description || 'Failed to fetch token.' }) }; }
    return { statusCode: 200, body: JSON.stringify(data) };
};

exports.handler = async (event) => {
    try {
        if (event.httpMethod === 'GET') {
            return await handleProxyRequest(event);
        } else if (event.httpMethod === 'POST') {
            return await handleTokenRequest(event);
        } else {
            return { statusCode: 405, body: 'Method Not Allowed' };
        }
    } catch (error) {
        console.error('General function error:', error);
        return { statusCode: 500, body: JSON.stringify({ error: 'An internal error occurred in the function.' }) };
    }
};