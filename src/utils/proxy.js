const fetch = require('node-fetch');
const UAParser = require('ua-parser-js');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_API_KEY = process.env.SUPABASE_API_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_API_KEY);

const sendToSupabase = async ({ req, body }) => {
  try {
    const userIp = req?.headers?.['x-forwarded-for']?.split(',')[0].trim() || req?.socket?.remoteAddress || 'unknown';
    const userAgentHeader = req?.headers?.['user-agent'] || '';
    const referrerHeader = req?.headers?.referer || body.siteReferrer || '';

    const parser = new UAParser(userAgentHeader);
    const uaResult = parser.getResult();

    let geo = {};
    try {
      const geoResponse = await fetch('https://ipapi.co/json', { timeout: 3000 });
      if (geoResponse.ok) {
        geo = await geoResponse.json();
      } else {
        console.warn(`Advertencia: ipapi.co respondió con estado ${geoResponse.status}`);
      }
    } catch (geoError) {
      console.warn('Advertencia al obtener geolocalización (ipapi.co):', geoError.message);
    }

    const { eventType, deviceId, sessionId, siteLocation, pathname, duration, screenWidth, screenHeight, language, domainId } = body;

    const commonData = {
      domain_id: domainId,
      site_location: siteLocation || '',
      pathname: pathname || '',
      referrer: referrerHeader,
      user_ip: userIp,
      device_id: deviceId,
      session_id: sessionId,
      user_agent: userAgentHeader,
      device_type: uaResult.device?.type || 'desktop',
      browser: uaResult.browser?.name || '',
      os: uaResult.os?.name || '',
      country: geo.country_name || '',
      region: geo.region || '',
    };

    if (eventType === 'initial') {
      const { error: insertError } = await supabase
        .from('visitas')
        .insert([{
          ...commonData,
          duration: 0, // Duración inicial es 0
        }]);

      if (insertError) {
        console.error('Error al insertar visita inicial en Supabase:', insertError);
      } else {
        console.log('Visita inicial registrada en Supabase.');
      }
    } else if (eventType === 'heartbeat' || eventType === 'unload') {
      const { data: existingRecords, error: fetchError } = await supabase
        .from('visitas')
        .select('id')
        .eq('session_id', sessionId)
        .eq('device_id', deviceId)
        .order('created_at', { ascending: false }) // Tomar la más reciente si hay varias
        .limit(1);

      if (fetchError) {
        console.error('Error al buscar registro existente para actualización:', fetchError);
        return;
      }

      if (existingRecords && existingRecords.length > 0) {
        const recordIdToUpdate = existingRecords[0].id;
        const { error: updateError } = await supabase
          .from('visitas')
          .update({
            duration: duration, // ¡Aquí se actualiza la duración enviada por el frontend!
            last_active_at: new Date().toISOString(),
          })
          .eq('id', recordIdToUpdate);

        if (updateError) {
          console.error(`Error al actualizar registro ${eventType} en Supabase (${recordIdToUpdate}):`, updateError);
        } else {
          console.log(`Registro ${eventType} actualizado en Supabase para ID: ${recordIdToUpdate}.`);
        }
      } else {
        // Fallback: Si no se encuentra un registro, se inserta uno nuevo.
        console.warn(`Registro no encontrado para session ${sessionId}. Insertando nuevo (fallback).`);
        const { error: insertFallbackError } = await supabase
          .from('visitas')
          .insert([{
            ...commonData,
            duration: duration,
            last_active_at: new Date().toISOString(),
          }]);

        if (insertFallbackError) {
          console.error('Error al insertar nuevo registro (fallback) en Supabase:', insertFallbackError);
        } else {
          console.log('Nuevo registro insertado (fallback) en Supabase.');
        }
      }
    } else {
      console.warn('Tipo de evento desconocido recibido:', eventType, body);
    }

  } catch (error) {
    console.error('Error general en sendToSupabase:', error.message);
  }
};

module.exports = { sendToSupabase };