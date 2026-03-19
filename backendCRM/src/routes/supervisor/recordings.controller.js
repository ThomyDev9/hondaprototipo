import { pool, isabelPool } from "../../services/db.multi.js";
import agenteQueries from "../../services/queries/agente.queries.js";

// Obtener grabaciones por número de teléfono (panel supervisor)
export async function getRecordingsByPhone(req, res) {
    try {
        const { phone } = req.query;
        // --- Consulta 1: Base principal (pool)
        let query1 = `SELECT CampaignId, ContactName, ContactAddress, ImportId, Agent, ResultLevel1 
                        FROM bancopichinchaencuesta_dev.gestionfinal 
                        WHERE ContactAddress IS NOT null and ContactAddress !='' 
                        and ResultLevel1 !='' and CampaignId in('COBRANZA CACPECO','COBRANZA CACPE ZAMORA',
'BVF ENCUESTAS DE SATISFACCION','LUCHA_CAMPESINA_ENCUESTAS_CRD',
'COBRANZA MUTUALISTA AMBATO','COBRANZA MUTUALISTA TC','LUCHA_CAMPESINA_RECLAMOS',
'BVF ENCUESTAS POSTVENTA','LUCHA_CAMPESINA_ENCUESTAS_PRV','LUCHA_CAMPESINA_SEGUROS') `;
        let params1 = [];
        if (phone) {
            query1 += ` AND ContactAddress = ?`;
            params1 = [phone];
        }
        query1 += ` ORDER BY Id DESC LIMIT 100`;
        const [gestionRows1] = await pool.query(query1, params1);

        // --- Consulta 2: bancopichinchaencuesta (pool, pero forzar schema)
        let query2 = `SELECT CampaignId, ContactName, ContactAddress, ImportId, Agent, ResultLevel1 
                        FROM bancopichinchaencuesta.gestionfinal 
                        WHERE ContactAddress IS NOT null and ContactAddress !='' 
                        and ResultLevel1 !='' and CampaignId in('COBRANZA CACPECO','COBRANZA CACPE ZAMORA',
'BVF ENCUESTAS DE SATISFACCION','LUCHA_CAMPESINA_ENCUESTAS_CRD',
'COBRANZA MUTUALISTA AMBATO','COBRANZA MUTUALISTA TC','LUCHA_CAMPESINA_RECLAMOS',
'BVF ENCUESTAS POSTVENTA','LUCHA_CAMPESINA_ENCUESTAS_PRV','LUCHA_CAMPESINA_SEGUROS')`;
        let params2 = [];
        if (phone) {
            query2 += ` AND ContactAddress = ?`;
            params2 = [phone];
        }
        query2 += ` ORDER BY Id DESC LIMIT 100`;
        const [gestionRows2] = await pool.query(query2, params2);

        // Unir resultados (puedes limitar el total si quieres)
        const gestionRows = [...gestionRows1, ...gestionRows2];
        if (!gestionRows.length) return res.json([]);

        // Obtener grabaciones de cdr para los teléfonos encontrados (igual que antes)
        const phones = gestionRows.map((g) => g.ContactAddress).filter(Boolean);
        let recordings = [];
        if (phones.length) {
            const placeholders = phones.map(() => "?").join(",");
            const cdrQuery = `
        SELECT calldate, src, dst, disposition, recordingfile
        FROM cdr
        WHERE recordingfile IS NOT NULL
          AND dst IN (${placeholders}) and dst != '' and dst != 'null'
        ORDER BY calldate DESC
        LIMIT 200
      `;
            const [cdrRows] = await isabelPool.query(cdrQuery, phones);
            recordings = gestionRows.map((g) => {
                const cdr = cdrRows.find((c) => c.dst === g.ContactAddress);
                let recordingfile = null;
                if (cdr?.recordingfile && cdr?.calldate) {
                    const date = new Date(cdr.calldate);
                    const yyyy = date.getFullYear();
                    const mm = String(date.getMonth() + 1).padStart(2, "0");
                    const dd = String(date.getDate()).padStart(2, "0");
                    recordingfile = `${yyyy}/${mm}/${dd}/${cdr.recordingfile}`;
                }
                return {
                    ...g,
                    calldate: cdr?.calldate || null,
                    src: cdr?.src || null,
                    dst: cdr?.dst || null,
                    disposition: cdr?.disposition || null,
                    duration: cdr?.duration || null,
                    recordingfile,
                };
            });
        } else {
            recordings = gestionRows;
        }
        res.json(recordings);
    } catch (err) {
        console.error("Error al obtener grabaciones:", err);
        res.status(500).json({ error: "Error al obtener grabaciones" });
    }
}
