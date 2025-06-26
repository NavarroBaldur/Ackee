const fetch = require('node-fetch');
const UAParser = require('ua-parser-js');

// >>>>> IMPORTANTE: MUEVE ESTAS CLAVES A VARIABLES DE ENTORNO EN RENDER <<<<<
// SUPABASE_URL=https://ehtwuxuwinsoyrsusuyu.supabase.co
// SUPABASE_API_KEY=tu_clave_anon_publica_aqui
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ehtwuxuwinsoyrsusuyu.supabase.co';
const SUPABASE_API_KEY = process.env.SUPABASE_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVodHd1eHV3aW5zb3lyc3VzdXl1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDczNDI4MzksImV4cCI6MjA2MjkxODgzOX0.Kc7LC8JvLmR503o4XIYUhMf-OET2EAy70a5tEWb5H80'; // Asegúrate de que esta sea tu clave 'anon public' real

const sendToSupabase = async ({ req, body }) => { // Eliminamos 'domain' si no lo usamos
  try {
    // 1. Obtener la IP del usuario (desde x-forwarded-for que usa Render)
    const userIp = req?.headers?.['x-forwarded-for']?.split(',')[0].trim() || req?.socket?.remoteAddress || 'unknown';
    // 'x-forwarded-for' puede contener múltiples IPs (proxy, CDN, etc.). Tomamos la primera.
    // req.socket.remoteAddress es un fallback para entornos sin x-forwarded-for.

    const userAgentHeader = req?.headers?.['user-agent'] || '';
    // Asegúrate de que 'siteReferrer' viene del body del frontend si es lo que quieres guardar
    // O si prefieres el 'referrer' HTTP completo:
    const referrerHeader = req?.headers?.referer || body.siteReferrer || ''; // Primero header, luego body

    const parser = new UAParser(userAgentHeader);
    const uaResult = parser.getResult();

    // 2. Intentar obtener la geolocalización (con un timeout y manejo de errores)
    let geo = {};
    try {
      const geoResponse = await fetch('https://ipapi.co/json', { timeout: 3000 }); // Añadir timeout
      if (geoResponse.ok) {
        geo = await geoResponse.json();
      } else {
        console.warn(`Advertencia: ipapi.co respondió con estado ${geoResponse.status}`);
      }
    } catch (geoError) {
      console.warn('Advertencia al obtener geolocalización (ipapi.co):', geoError.message);
      // No es un error fatal si la geolocalización falla
    }

    // 3. Generar o recibir un identificador de dispositivo
    // IDEAL: Que el frontend envíe un UUID persistente (guardado en localStorage)
    const deviceId = body.deviceId || null; // Si el frontend lo envía

    // Si el frontend NO envía deviceId, podrías generarlo aquí (pero no sería persistente)
    // const deviceId = body.deviceId || crypto.randomUUID(); // Necesita Node.js 14.17+ para crypto.randomUUID()
    // O un hash de IP + UserAgent + otros si quieres intentarlo, pero NO es un identificador único real.
    // La mejor práctica es que el frontend genere y persista su propio ID.

    const data = {
      // Usamos body.domainId que viene del frontend, que es el ID de Ackee
      domain_id: body.domainId || null,
      site_location: body.siteLocation || '', // URL completa de la página
      pathname: body.pathname || '', // Pathname de la página
      referrer: referrerHeader, // Referer de la página
      duration: body.duration || 0, // Duración de la visita en segundos
      screen_width: body.screenWidth || null,
      screen_height: body.screenHeight || null,
      language: body.language || '',
      // Datos adicionales capturados
      user_ip: userIp, // La IP del usuario
      device_id: deviceId, // Identificador único del dispositivo (si lo implementas)
      user_agent: userAgentHeader,
      device_type: uaResult.device?.type || 'desktop',
      browser: uaResult.browser?.name || '',
      os: uaResult.os?.name || '',
      country: geo.country_name || '',
      region: geo.region || '',
    };

    const supabaseResponse = await fetch(`${SUPABASE_URL}/rest/v1/visitas`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_API_KEY,
        'Authorization': `Bearer ${SUPABASE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data)
    });

    if (!supabaseResponse.ok) {
      const errorText = await supabaseResponse.text();
      console.error(`Error de Supabase (HTTP ${supabaseResponse.status}):`, errorText);
    } else {
      console.log('Datos enviados a Supabase con éxito.');
    }

  } catch (error) {
    console.error('Error general en sendToSupabase:', error.message);
  }
};

module.exports = { sendToSupabase };