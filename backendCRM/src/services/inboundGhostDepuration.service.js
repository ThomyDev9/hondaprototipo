import { pool, isabelPool, inboundIsabelPool } from "./db.multi.js";

function normalizeRecordingValue(value = "") {
    const raw = String(value || "").trim().replace(/\\/g, "/");
    if (!raw) return "";
    const parts = raw.split("/").filter(Boolean);
    return String(parts[parts.length - 1] || "").trim().toLowerCase();
}

function normalizeQueueToken(value = "") {
    return String(value || "")
        .trim()
        .replace(/\.0+$/, "")
        .replace(/[^\d]/g, "");
}

function buildInboundQueueCandidates(value = "") {
    return String(value || "")
        .split(/[;,|]/)
        .flatMap((entry) =>
            String(entry || "")
                .split(/\s+/)
                .map((token) => normalizeQueueToken(token)),
        )
        .filter(Boolean);
}

function extractInboundQueueFromRecordingFile(recordingfile = "") {
    const normalized = normalizeRecordingValue(recordingfile);
    const match = normalized.match(/^q-(\d+)-/i);
    return String(match?.[1] || "").trim();
}

function parseMysqlDateTime(value) {
    if (!value) return null;
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value;
    }
    const parsed = new Date(String(value).replace(" ", "T"));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateKey(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function buildGhostToken(uniqueid = "") {
    return String(uniqueid || "")
        .trim()
        .replace(/[^\w-]/g, "_");
}

function buildGhostInteractionId(uniqueid = "") {
    return `INB-GHOST-${buildGhostToken(uniqueid)}`;
}

function buildGhostContactId(uniqueid = "") {
    return `INBCL-GHOST-${buildGhostToken(uniqueid)}`;
}

function computeDateRange({ startDate = "", endDate = "", lookbackDays = 1 }) {
    const normalizedStart = String(startDate || "").trim();
    const normalizedEnd = String(endDate || "").trim();
    const baseStartDate = String(
        process.env.INBOUND_GHOST_BASE_START_DATE || "2026-04-01",
    ).trim();

    if (normalizedStart && normalizedEnd) {
        const clampedStart =
            baseStartDate && normalizedStart < baseStartDate
                ? baseStartDate
                : normalizedStart;
        return { startDate: clampedStart, endDate: normalizedEnd };
    }

    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - Math.max(1, Number(lookbackDays) || 1));
    const fallbackStart = formatDateKey(start);
    const resolvedStartDate = baseStartDate || fallbackStart;
    const resolvedEndDate = normalizedEnd || formatDateKey(today);

    return {
        startDate: normalizedStart || resolvedStartDate,
        endDate: resolvedEndDate,
    };
}

async function getInboundQueueMap(connection = pool) {
    const [rows] = await connection.query(`
        SELECT
            child.id AS menuItemId,
            child.id_categoria AS categoryId,
            TRIM(COALESCE(child.nombre_item, '')) AS subcampania,
            TRIM(COALESCE(child.inbound_queue, '')) AS inboundQueue
        FROM menu_items child
        WHERE child.estado = 'activo'
          AND COALESCE(TRIM(child.inbound_queue), '') <> ''
        ORDER BY child.nombre_item ASC
    `);

    const queueMap = new Map();
    for (const row of rows || []) {
        const tokens = buildInboundQueueCandidates(row?.inboundQueue || "");
        const payload = {
            menuItemId: String(row?.menuItemId || "").trim() || null,
            categoryId: String(row?.categoryId || "").trim() || null,
            subcampania:
                String(row?.subcampania || "").trim() || "SIN_SUBCAMPANIA",
            inboundQueue: String(row?.inboundQueue || "").trim(),
        };
        for (const token of tokens) {
            if (!queueMap.has(token)) {
                queueMap.set(token, payload);
            }
        }
    }
    return queueMap;
}

async function queryInboundCdrRows(
    connection,
    { startDate, endDate, limit, thresholdSeconds },
) {
    const [rows] = await connection.query(
        `
        SELECT
            uniqueid,
            calldate,
            src,
            dst,
            disposition,
            COALESCE(billsec, duration, 0) AS duration,
            recordingfile
        FROM cdr
        WHERE calldate >= ?
          AND calldate < DATE_ADD(?, INTERVAL 1 DAY)
          AND COALESCE(recordingfile, '') <> ''
          AND COALESCE(billsec, duration, 0) < ?
          AND (
                LOWER(COALESCE(recordingfile, '')) LIKE 'q-%'
             OR LOWER(COALESCE(recordingfile, '')) LIKE '%/q-%'
             OR LOWER(COALESCE(recordingfile, '')) LIKE '%\\\\q-%'
          )
        ORDER BY calldate DESC, uniqueid DESC
        LIMIT ?
        `,
        [startDate, endDate, thresholdSeconds, limit],
    );
    return Array.isArray(rows) ? rows : [];
}

function dedupeByRecording(rows = []) {
    const map = new Map();
    for (const row of rows) {
        const recordingNorm = normalizeRecordingValue(row?.recordingfile);
        if (!recordingNorm) continue;

        const existing = map.get(recordingNorm);
        if (!existing) {
            map.set(recordingNorm, row);
            continue;
        }

        const existingDate = parseMysqlDateTime(existing?.calldate);
        const currentDate = parseMysqlDateTime(row?.calldate);
        if (!existingDate || (currentDate && currentDate > existingDate)) {
            map.set(recordingNorm, row);
        }
    }
    return Array.from(map.values());
}

async function loadExistingLinkSets(connection, { startDate, endDate }) {
    const [rows] = await connection.query(
        `
        SELECT cdr_uniqueid, interaction_id, recordingfile, recording_path
        FROM management_recording_link
        WHERE (
                (cdr_calldate IS NOT NULL AND cdr_calldate >= ? AND cdr_calldate < DATE_ADD(?, INTERVAL 1 DAY))
             OR (cdr_calldate IS NULL AND linked_at >= ? AND linked_at < DATE_ADD(?, INTERVAL 1 DAY))
        )
        `,
        [startDate, endDate, startDate, endDate],
    );

    const byUniqueid = new Set();
    const byInteraction = new Set();
    const byRecording = new Set();
    for (const row of rows || []) {
        const uniqueid = String(row?.cdr_uniqueid || "").trim();
        if (uniqueid) byUniqueid.add(uniqueid);
        const interactionId = String(row?.interaction_id || "").trim();
        if (interactionId) byInteraction.add(interactionId);
        const rec = normalizeRecordingValue(
            row?.recordingfile || row?.recording_path,
        );
        if (rec) byRecording.add(rec);
    }

    return { byUniqueid, byInteraction, byRecording };
}

async function loadExistingGestionSets(connection, { startDate, endDate }) {
    const [rows] = await connection.query(
        `
        SELECT interaction_id, payload_json
        FROM gestionfinal_inbound
        WHERE tmstmp >= ?
          AND tmstmp < DATE_ADD(?, INTERVAL 1 DAY)
        `,
        [startDate, endDate],
    );

    const byInteraction = new Set();
    const byRecording = new Set();
    for (const row of rows || []) {
        const interactionId = String(row?.interaction_id || "").trim();
        if (interactionId) byInteraction.add(interactionId);

        let payload = {};
        try {
            payload = row?.payload_json ? JSON.parse(row.payload_json) : {};
        } catch {
            payload = {};
        }
        const candidates = [
            payload?.__inbound_current_call_recordingfile,
            payload?.recordingfile,
            payload?.recordingFile,
        ];
        for (const candidate of candidates) {
            const rec = normalizeRecordingValue(candidate);
            if (rec) byRecording.add(rec);
        }
    }

    return { byInteraction, byRecording };
}

async function backfillGhostLinksFromGestiones(
    connection,
    { startDate, endDate, existingLinks },
) {
    const [gestionRows] = await connection.query(
        `
        SELECT
            interaction_id,
            contact_id,
            campaign_id,
            agent,
            celular,
            convencional,
            tmstmp,
            payload_json
        FROM gestionfinal_inbound
        WHERE tmstmp >= ?
          AND tmstmp < DATE_ADD(?, INTERVAL 1 DAY)
          AND (
                agent = 'SYSTEM_DEPURACION'
             OR LOWER(COALESCE(categorizacion, '')) = 'llamada fantasma'
          )
        ORDER BY tmstmp DESC, id DESC
        `,
        [startDate, endDate],
    );

    let repairedLinks = 0;
    for (const row of gestionRows || []) {
        const interactionId = String(row?.interaction_id || "").trim();
        let payload = {};
        try {
            payload = row?.payload_json ? JSON.parse(row.payload_json) : {};
        } catch {
            payload = {};
        }

        const recordingNorm = normalizeRecordingValue(
            payload?.__inbound_current_call_recordingfile ||
                payload?.recordingfile ||
                payload?.recordingFile,
        );

        if (!recordingNorm) continue;
        if (
            (interactionId && existingLinks.byInteraction.has(interactionId)) ||
            existingLinks.byRecording.has(recordingNorm)
        ) {
            continue;
        }

        const callDate = row?.tmstmp || null;
        const parsedDate = parseMysqlDateTime(callDate);
        const recordingPath = parsedDate
            ? `${formatDateKey(parsedDate).replace(/-/g, "/")}/${recordingNorm}`
            : recordingNorm;

        const [linkInsert] = await connection.query(
            `
            INSERT INTO management_recording_link (
                schema_name, gestion_contact_id, gestion_row_id, interaction_id, campaign_id, agent,
                contact_address, management_timestamp, cdr_uniqueid, cdr_calldate, cdr_src, cdr_dst,
                cdr_disposition, cdr_duration, recordingfile, recording_path, linked_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
            ON DUPLICATE KEY UPDATE
                campaign_id = VALUES(campaign_id),
                agent = VALUES(agent),
                contact_address = VALUES(contact_address),
                management_timestamp = VALUES(management_timestamp),
                cdr_calldate = VALUES(cdr_calldate),
                cdr_src = VALUES(cdr_src),
                cdr_dst = VALUES(cdr_dst),
                recordingfile = VALUES(recordingfile),
                recording_path = VALUES(recording_path),
                linked_at = NOW()
            `,
            [
                "asteriskcdrdb",
                String(row?.contact_id || "").trim() || null,
                null,
                interactionId || null,
                String(row?.campaign_id || "").trim() || null,
                String(row?.agent || "").trim() || "SYSTEM_DEPURACION",
                String(row?.celular || row?.convencional || "").trim() || null,
                callDate,
                interactionId || null,
                callDate,
                String(row?.convencional || "").trim() || null,
                String(row?.celular || "").trim() || null,
                null,
                0,
                recordingNorm,
                recordingPath,
            ],
        );

        repairedLinks += Number(linkInsert?.affectedRows || 0) > 0 ? 1 : 0;
        existingLinks.byRecording.add(recordingNorm);
        if (interactionId) {
            existingLinks.byInteraction.add(interactionId);
        }
    }

    return repairedLinks;
}

async function upsertGhostClient(connection, payload) {
    const params = [
        payload.contactId,
        payload.campaignId,
        payload.categoryId,
        payload.menuItemId,
        payload.identification,
        "Cedula",
        "SIN NOMBRE",
        "QUITO",
        "noaplica@gmail.com",
        payload.celular,
        payload.convencional,
        null,
        "Titular",
        "",
        "Inbound",
        payload.campaignId,
        "LLAMADA FANTASMA",
        "LLAMADA FANTASMA",
        "LLAMADA FANTASMA",
        payload.observaciones,
        payload.payloadJson,
        "SYSTEM_DEPURACION",
    ];

    await connection.query(
        `
        INSERT INTO clientes_inbound (
            contact_id, campaign_id, category_id, menu_item_id, identification,
            tipo_identificacion, full_name, city, email, celular, convencional, ticket_id,
            tipo_cliente, relacion, tipo_canal, nombre_cliente_ref,
            categorizacion, motivo, submotivo, observaciones, payload_json, created_by
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            campaign_id = VALUES(campaign_id),
            category_id = VALUES(category_id),
            menu_item_id = VALUES(menu_item_id),
            identification = VALUES(identification),
            celular = VALUES(celular),
            convencional = VALUES(convencional),
            categorizacion = VALUES(categorizacion),
            motivo = VALUES(motivo),
            submotivo = VALUES(submotivo),
            observaciones = VALUES(observaciones),
            payload_json = VALUES(payload_json),
            updated_at = NOW()
        `,
        params,
    );

    const [rows] = await connection.query(
        `SELECT id FROM clientes_inbound WHERE contact_id = ? LIMIT 1`,
        [payload.contactId],
    );
    return Number(rows?.[0]?.id || 0);
}

async function ensureGhostGestionForLink(
    connection,
    linkRow,
    { thresholdSeconds = 40 } = {},
) {
    const uniqueid = String(linkRow?.cdr_uniqueid || "").trim();
    const interactionId = String(
        linkRow?.interaction_id || buildGhostInteractionId(uniqueid),
    ).trim();
    if (!interactionId) return 0;

    const contactId = String(
        linkRow?.gestion_contact_id || buildGhostContactId(uniqueid),
    ).trim();
    const campaignId = String(linkRow?.campaign_id || "SIN_SUBCAMPANIA").trim();
    const categoryId = linkRow?.category_id || null;
    const menuItemId = linkRow?.menu_item_id || null;
    const src = String(linkRow?.cdr_src || "").trim();
    const dst = String(linkRow?.cdr_dst || "").trim();
    const recNorm = normalizeRecordingValue(
        linkRow?.recordingfile || linkRow?.recording_path,
    );
    const identification = String(dst || src || contactId).trim();
    const callDate =
        linkRow?.cdr_calldate ||
        linkRow?.management_timestamp ||
        linkRow?.linked_at ||
        null;
    const observaciones = `Auto depurado (<${thresholdSeconds}s). uniqueid=${uniqueid}`;
    const payloadJson = JSON.stringify({
        auto_depuration: true,
        rule: `duration_lt_${thresholdSeconds}`,
        uniqueid,
        recordingfile: recNorm,
    });

    const clienteInboundId = await upsertGhostClient(connection, {
        contactId,
        campaignId,
        categoryId,
        menuItemId,
        identification,
        celular: dst || null,
        convencional: src || null,
        observaciones,
        payloadJson,
    });

    const [gestionInsert] = await connection.query(
        `
        INSERT IGNORE INTO gestionfinal_inbound (
            contact_id, cliente_inbound_id, campaign_id, category_id, menu_item_id,
            interaction_id, action_order, agent, management_result_code,
            result_level1, result_level2, categorizacion, observaciones,
            fecha_agendamiento, identification, full_name, celular, tipo_cliente,
            tipo_identificacion, tipo_canal, relacion, nombre_cliente_ref, city, email,
            convencional, ticket_id, payload_json, fields_meta_json,
            started_management, tmstmp, intentos
        )
        VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, 1)
        `,
        [
            contactId,
            clienteInboundId,
            campaignId,
            categoryId,
            menuItemId,
            interactionId,
            "SYSTEM_DEPURACION",
            "1009",
            "COMUNICACION",
            "LLAMADA FANTASMA",
            "LLAMADA FANTASMA",
            observaciones,
            identification,
            "SIN NOMBRE",
            dst || null,
            "Titular",
            "Cedula",
            "Inbound",
            "",
            campaignId,
            "QUITO",
            "noaplica@gmail.com",
            src || null,
            payloadJson,
            JSON.stringify({ source: "auto_depuration_inbound_ghost" }),
            callDate,
            callDate,
        ],
    );

    return Number(gestionInsert?.affectedRows || 0);
}

export async function runInboundGhostDepuration({
    startDate = "",
    endDate = "",
    thresholdSeconds = Number(process.env.INBOUND_GHOST_THRESHOLD_SECONDS || 40),
    lookbackDays = Number(process.env.INBOUND_GHOST_LOOKBACK_DAYS || 1),
    limit = Number(process.env.INBOUND_GHOST_MAX_ROWS || 5000),
} = {}) {
    const range = computeDateRange({ startDate, endDate, lookbackDays });
    const normalizedThreshold = Math.max(1, Number(thresholdSeconds) || 40);
    const normalizedLimit = Math.max(100, Math.min(20000, Number(limit) || 5000));

    const queueMap = await getInboundQueueMap(pool);

    const cdrQueryResults = await Promise.allSettled([
        queryInboundCdrRows(isabelPool, {
            ...range,
            limit: normalizedLimit,
            thresholdSeconds: normalizedThreshold,
        }),
        queryInboundCdrRows(inboundIsabelPool, {
            ...range,
            limit: normalizedLimit,
            thresholdSeconds: normalizedThreshold,
        }),
    ]);

    const cdrFailures = cdrQueryResults
        .filter((result) => result.status === "rejected")
        .map((result) => String(result.reason?.message || result.reason));

    if (cdrFailures.length) {
        console.warn(
            "[depuracion-inbound-fantasma] Errores consultando CDR:",
            cdrFailures.join(" | "),
        );
    }

    const cdrRows = dedupeByRecording(
        cdrQueryResults
            .filter((result) => result.status === "fulfilled")
            .flatMap((result) => result.value || []),
    );

    const existingLinks = await loadExistingLinkSets(pool, range);
    const existingGestiones = await loadExistingGestionSets(pool, range);

    const candidates = [];
    let skippedExisting = 0;
    for (const row of cdrRows) {
        const uniqueid = String(row?.uniqueid || "").trim();
        const recordingNorm = normalizeRecordingValue(row?.recordingfile);
        const interactionId = buildGhostInteractionId(uniqueid);
        const alreadyManaged =
            (uniqueid && existingLinks.byUniqueid.has(uniqueid)) ||
            (recordingNorm && existingLinks.byRecording.has(recordingNorm)) ||
            existingGestiones.byInteraction.has(interactionId) ||
            (recordingNorm && existingGestiones.byRecording.has(recordingNorm));

        if (alreadyManaged) {
            skippedExisting += 1;
            continue;
        }
        candidates.push(row);
    }

    let insertedLinks = 0;
    let insertedGestiones = 0;
    let backfilledGestiones = 0;
    let repairedLinksFromGestiones = 0;

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        for (const row of candidates) {
            const uniqueid = String(row?.uniqueid || "").trim();
            const callDate = row?.calldate || null;
            const src = String(row?.src || "").trim();
            const dst = String(row?.dst || "").trim();
            const disposition = String(row?.disposition || "").trim();
            const duration = Number(row?.duration || 0);
            const recNorm = normalizeRecordingValue(row?.recordingfile);
            const queueCode = normalizeQueueToken(
                extractInboundQueueFromRecordingFile(row?.recordingfile),
            );
            const queueMeta = queueMap.get(queueCode) || {};

            const campaignId = String(
                queueMeta?.subcampania || "SIN_SUBCAMPANIA",
            ).trim();
            const categoryId = queueMeta?.categoryId || null;
            const menuItemId = queueMeta?.menuItemId || null;
            const contactId = buildGhostContactId(uniqueid);
            const interactionId = buildGhostInteractionId(uniqueid);

            const identification = String(
                dst || src || `GHOST-${buildGhostToken(uniqueid)}`,
            ).trim();
            const observaciones = `Auto depurado (<${normalizedThreshold}s). uniqueid=${uniqueid}`;
            const payloadJson = JSON.stringify({
                auto_depuration: true,
                rule: `duration_lt_${normalizedThreshold}`,
                uniqueid,
                recordingfile: recNorm,
                queue: queueCode,
            });

            await upsertGhostClient(connection, {
                contactId,
                campaignId,
                categoryId,
                menuItemId,
                identification,
                celular: dst || null,
                convencional: src || null,
                observaciones,
                payloadJson,
            });

            const [linkInsert] = await connection.query(
                `
                INSERT INTO management_recording_link (
                    schema_name, gestion_contact_id, gestion_row_id, interaction_id, campaign_id, agent,
                    contact_address, management_timestamp, cdr_uniqueid, cdr_calldate, cdr_src, cdr_dst,
                    cdr_disposition, cdr_duration, recordingfile, recording_path, linked_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
                ON DUPLICATE KEY UPDATE
                    campaign_id = VALUES(campaign_id),
                    agent = VALUES(agent),
                    contact_address = VALUES(contact_address),
                    management_timestamp = VALUES(management_timestamp),
                    cdr_calldate = VALUES(cdr_calldate),
                    cdr_src = VALUES(cdr_src),
                    cdr_dst = VALUES(cdr_dst),
                    cdr_disposition = VALUES(cdr_disposition),
                    cdr_duration = VALUES(cdr_duration),
                    recordingfile = VALUES(recordingfile),
                    recording_path = VALUES(recording_path),
                    linked_at = NOW()
                `,
                [
                    "asteriskcdrdb",
                    contactId,
                    null,
                    interactionId,
                    campaignId,
                    "SYSTEM_DEPURACION",
                    dst || src || null,
                    callDate,
                    uniqueid,
                    callDate,
                    src || null,
                    dst || null,
                    disposition || null,
                    duration,
                    recNorm,
                    callDate
                        ? `${formatDateKey(parseMysqlDateTime(callDate))?.replace(/-/g, "/")}/${recNorm}`
                        : recNorm,
                ],
            );
            insertedLinks += Number(linkInsert?.affectedRows || 0);

            insertedGestiones += await ensureGhostGestionForLink(
                connection,
                {
                    cdr_uniqueid: uniqueid,
                    interaction_id: interactionId,
                    gestion_contact_id: contactId,
                    campaign_id: campaignId,
                    category_id: categoryId,
                    menu_item_id: menuItemId,
                    cdr_src: src,
                    cdr_dst: dst,
                    cdr_calldate: callDate,
                    recordingfile: recNorm,
                    recording_path: recNorm,
                },
                { thresholdSeconds: normalizedThreshold },
            );
        }

        const [missingLinkRows] = await connection.query(
            `
            SELECT
                m.gestion_contact_id,
                m.interaction_id,
                m.campaign_id,
                m.cdr_uniqueid,
                m.cdr_calldate,
                m.management_timestamp,
                m.cdr_src,
                m.cdr_dst,
                m.recordingfile,
                m.recording_path,
                m.linked_at
            FROM management_recording_link m
            LEFT JOIN gestionfinal_inbound g
              ON g.interaction_id = m.interaction_id
             AND g.action_order = 1
            WHERE m.agent = 'SYSTEM_DEPURACION'
              AND g.id IS NULL
              AND (
                    (m.cdr_calldate IS NOT NULL AND m.cdr_calldate >= ? AND m.cdr_calldate < DATE_ADD(?, INTERVAL 1 DAY))
                 OR (m.cdr_calldate IS NULL AND m.linked_at >= ? AND m.linked_at < DATE_ADD(?, INTERVAL 1 DAY))
              )
            ORDER BY COALESCE(m.cdr_calldate, m.linked_at) DESC, m.id DESC
            `,
            [range.startDate, range.endDate, range.startDate, range.endDate],
        );

        for (const row of missingLinkRows || []) {
            backfilledGestiones += await ensureGhostGestionForLink(
                connection,
                row,
                { thresholdSeconds: normalizedThreshold },
            );
        }

        repairedLinksFromGestiones = await backfillGhostLinksFromGestiones(
            connection,
            {
                startDate: range.startDate,
                endDate: range.endDate,
                existingLinks,
            },
        );

        await connection.commit();
    } catch (err) {
        await connection.rollback();
        throw err;
    } finally {
        connection.release();
    }

    return {
        ...range,
        thresholdSeconds: normalizedThreshold,
        scanned: cdrRows.length,
        candidates: candidates.length,
        insertedLinks,
        insertedGestiones,
        backfilledGestiones,
        repairedLinksFromGestiones,
        skippedExisting,
        errors: cdrFailures,
    };
}

let schedulerState = {
    timer: null,
    lastRunKey: "",
};

export function startInboundGhostDepurationScheduler() {
    const enabled =
        String(process.env.INBOUND_GHOST_AUTO_ENABLED || "1").trim() !== "0";
    if (!enabled) {
        console.log(
            "[depuracion-inbound-fantasma] Scheduler deshabilitado por INBOUND_GHOST_AUTO_ENABLED=0",
        );
        return;
    }

    const hour = Math.min(
        23,
        Math.max(0, Number(process.env.INBOUND_GHOST_DAILY_HOUR || 2)),
    );
    const minute = Math.min(
        59,
        Math.max(0, Number(process.env.INBOUND_GHOST_DAILY_MINUTE || 20)),
    );
    const checkEveryMs = Math.max(
        60_000,
        Number(process.env.INBOUND_GHOST_CHECK_INTERVAL_MS || 300_000),
    );

    const tick = async () => {
        const now = new Date();
        const runKey = `${formatDateKey(now)}-${hour}-${minute}`;
        const inWindow = now.getHours() === hour && now.getMinutes() >= minute;

        if (!inWindow || schedulerState.lastRunKey === runKey) return;

        schedulerState.lastRunKey = runKey;
        try {
            const result = await runInboundGhostDepuration();
            console.log(
                "[depuracion-inbound-fantasma] OK:",
                JSON.stringify(result),
            );
        } catch (err) {
            console.error(
                "[depuracion-inbound-fantasma] Error ejecutando job diario:",
                err?.message || err,
            );
        }
    };

    schedulerState.timer = setInterval(tick, checkEveryMs);
    console.log(
        `[depuracion-inbound-fantasma] Scheduler activo. Hora diaria ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
    );

    if (
        String(process.env.INBOUND_GHOST_RUN_ON_STARTUP || "0").trim() === "1"
    ) {
        runInboundGhostDepuration()
            .then((result) => {
                console.log(
                    "[depuracion-inbound-fantasma] Run startup OK:",
                    JSON.stringify(result),
                );
            })
            .catch((err) => {
                console.error(
                    "[depuracion-inbound-fantasma] Run startup error:",
                    err?.message || err,
                );
            });
    }
}
