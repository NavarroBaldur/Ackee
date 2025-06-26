'use strict'

const KnownError = require('../utils/KnownError')
const normalizeUrl = require('../utils/normalizeUrl')
const identifier = require('../utils/identifier')
const messages = require('../utils/messages')
const domains = require('../database/domains')
const records = require('../database/records')
const { sendToSupabase } = require('../utils/proxy') // Asegúrate de que esta ruta sea correcta

const normalizeSiteLocation = (siteLocation) => {
    if (siteLocation == null) {
        // Pre-validate siteLocation and imitate MongoDB error
        throw new KnownError(`Path \`siteLocation\` is required`)
    }

    try {
        return normalizeUrl(siteLocation)
    } catch (error) {
        throw new KnownError(`Failed to normalize \`siteLocation\``, error)
    }
}

const normalizeSiteReferrer = (siteReferrer) => {
    // The siteReferrer is optional
    if (siteReferrer == null) return siteReferrer

    try {
        return normalizeUrl(siteReferrer)
    } catch (error) {
        throw new KnownError(`Failed to normalize \`siteReferrer\``, error)
    }
}

const polish = (obj) => {
    return Object.entries(obj).reduce((acc, [ key, value ]) => {
        value = typeof value === 'string' ? value.trim() : value
        value = value == null ? undefined : value
        value = value === '' ? undefined : value

        if (key === 'siteLocation') value = normalizeSiteLocation(value)
        if (key === 'siteReferrer') value = normalizeSiteReferrer(value)

        acc[key] = value
        return acc
    }, {})
}

module.exports = {
    Mutation: {
        createRecord: async (parent, { domainId, input }, { ip, userAgent, isIgnored }) => {
            // Ignorar tus propios registros cuando estás logueado
            if (isIgnored === true) {
                return {
                    success: true,
                    payload: {
                        id: '88888888-8888-8888-8888-888888888888', // ID de marcador de posición
                    },
                }
            }

            const clientId = identifier(ip, userAgent, domainId)
            const data = polish({ ...input, clientId, domainId })

            const domain = await domains.get(domainId)

            if (domain == null) throw new KnownError('Unknown domain')

            let entry

            try {
                // Primero, añade el registro a la base de datos de Ackee (MongoDB)
                entry = await records.add(data)

                // --- INICIO DE LA MODIFICACIÓN ---
                // Prepara los objetos 'req', 'domain' y 'body' para la función sendToSupabase
                // utilizando los datos disponibles en este resolver.
                const simulatedReq = {
                    headers: {
                        'user-agent': userAgent, // 'userAgent' viene del contexto del resolver
                        'referer': input.siteReferrer || '' // 'siteReferrer' viene del 'input'
                    },
                    connection: {
                        remoteAddress: ip // 'ip' viene del contexto del resolver
                    }
                };

                const simulatedBody = {
                    screenWidth: input.screenWidth,
                    screenHeight: input.screenHeight,
                    language: input.language,
                    pathname: input.pathname,
                    duration: input.duration
                    // No es necesario incluir domainId, siteLocation ni siteReferrer aquí,
                    // ya que se manejan por separado o se extraen del simulatedReq.
                };

                // Llama a sendToSupabase con los objetos con la estructura esperada
                await sendToSupabase({
                    req: simulatedReq,
                    domain: { _id: domainId }, // Necesita un objeto 'domain' con la propiedad '_id'
                    body: simulatedBody
                });
                // --- FIN DE LA MODIFICACIÓN ---

            } catch (error) {
                if (error.name === 'ValidationError') {
                    throw new KnownError(messages(error.errors))
                }

                // Si ocurre un error aquí (incluyendo errores de Supabase propagados),
                // lo registramos y lo lanzamos para que se maneje aguas arriba.
                console.error('Error durante la creación del registro o envío a Supabase:', error);
                throw error
            }

            // Anonimiza entradas antiguas con el mismo clientId para evitar la reconstrucción
            // del historial de navegación de un usuario. Se omite si no hay entradas anteriores.
            await records.anonymize(clientId, entry.id)

            return {
                success: true,
                payload: entry,
            }
        },
        updateRecord: async (parent, { id }, { isIgnored }) => {
            // Ignorar tus propios registros cuando estás logueado
            if (isIgnored === true) {
                return {
                    success: true,
                }
            }

            let entry

            try {
                entry = await records.update(id)
            } catch (error) {
                if (error.name === 'ValidationError') {
                    throw new KnownError(messages(error.errors))
                }

                throw error
            }

            if (entry == null) {
                throw new KnownError('Unknown record')
            }

            return {
                success: true,
            }
        },
    },
}