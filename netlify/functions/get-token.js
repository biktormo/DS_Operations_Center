// Usamos node-fetch porque es una dependencia en tu package.json
const fetch = require('node-fetch');

// Extraemos las variables de entorno configuradas en Netlify
const { CLIENT_ID, CLIENT_SECRET, REDIRECT_URI } = process.env;

// La URL del token, la tomamos de tu README
const TOKEN_URL = 'https://signin.johndeere.com/oauth2/aus78tnlaysMraFhC1t7/v1/token';

exports.handler = async (event) => {
    // Solo permitimos peticiones POST
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { code } = JSON.parse(event.body);

        if (!code) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Authorization code is missing.' }) };
        }

        // Preparamos la petición para intercambiar el código por un token
        const params = new URLSearchParams();
        params.append('grant_type', 'authorization_code');
        params.append('code', code);
        params.append('redirect_uri', REDIRECT_URI); // La URI debe coincidir exactamente

        // La API de John Deere requiere autenticación Básica (Base64) con el ID y el Secret
        const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');

        const response = await fetch(TOKEN_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${credentials}`,
            },
            body: params,
        });

        const data = await response.json();

        if (!response.ok) {
            // Si la API de John Deere devuelve un error, lo pasamos al frontend
            console.error('Error from John Deere API:', data);
            return { statusCode: response.status, body: JSON.stringify({ error: data.error_description || 'Failed to fetch token.' }) };
        }

        // Si todo va bien, devolvemos los datos del token al frontend
        return {
            statusCode: 200,
            body: JSON.stringify(data),
        };

    } catch (error) {
        console.error('Internal server error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'An internal error occurred.' }),
        };
    }
};