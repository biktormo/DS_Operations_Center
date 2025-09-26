const fetch = require('node-fetch');

// La URL base DEBE terminar en barra para que la resolución de URL funcione correctamente.
const API_BASE_URL = 'https://sandboxapi.deere.com/platform/';

exports.handler = async (event) => {
    const endpoint = event.queryStringParameters.endpoint;
    const accessToken = event.headers['x-jd-access-token'];

    if (!accessToken) {
        return { statusCode: 401, body: JSON.stringify({ error: 'Access token is missing.' }) };
    }
    if (!endpoint) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Endpoint is missing.' }) };
    }

    try {
        // --- CAMBIO CLAVE: Usar el constructor URL para unir la base y el endpoint ---
        // Esto maneja correctamente las barras (/) y otros caracteres,
        // evitando problemas como las dobles barras (//).
        const apiUrl = new URL(endpoint, API_BASE_URL).toString();

        // Log para depuración en Netlify (puedes quitarlo después)
        console.log(`[PROXY] Calling API: ${apiUrl}`);

        const response = await fetch(apiUrl, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/vnd.deere.axiom.v3+json',
            },
        });

        // Importante: La API de JD puede devolver una respuesta no-JSON en caso de error.
        // Primero verificamos el status y luego intentamos parsear.
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Error from John Deere API for endpoint ${endpoint}:`, errorText);
            // Intentamos parsear como JSON, si falla, devolvemos el texto plano.
            try {
                const errorJson = JSON.parse(errorText);
                return { statusCode: response.status, body: JSON.stringify(errorJson) };
            } catch (e) {
                return { statusCode: response.status, body: JSON.stringify({ error: 'API Error', message: errorText }) };
            }
        }
        
        const data = await response.json();

        return {
            statusCode: 200,
            body: JSON.stringify(data),
        };

    } catch (error) {
        console.error('Proxy function error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'An internal error occurred in the proxy function.' }),
        };
    }
};