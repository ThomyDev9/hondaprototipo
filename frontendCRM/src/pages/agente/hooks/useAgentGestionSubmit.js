import { useCallback } from "react";
import {
    guardarGestion,
    guardarGestionInbound,
    guardarGestionRedes,
    uploadInboundImages,
} from "../../../services/dashboard.service";

const INBOUND_SPECIAL_FIELDS_META = [
    { name: "__inbound_tipo_cliente", label: "Tipo cliente" },
    { name: "__inbound_tipo_identificacion", label: "Tipo de identificación" },
    { name: "__inbound_tipo_canal", label: "Tipo de canal" },
    { name: "__inbound_relacion", label: "Relacion" },
    { name: "__inbound_nombre_cliente", label: "Nombre Cliente" },
    { name: "__redes_nombre_cliente", label: "Nombre Cliente" },
    { name: "__redes_tipo_cliente", label: "Tipo cliente" },
    { name: "__redes_fecha_gestion", label: "Fecha gestión" },
    { name: "__redes_estado_conversacion", label: "Estado conversación" },
    { name: "__redes_tipo_red_social", label: "Tipo red social" },
];
const REDES_PARENT_MENU_ITEM_ID = "b3d8324e-2c69-11f1-b790-000c2904c92f";
const REDES_SHARED_LABEL = "gestion redes";
const MANUAL_DUPLICATE_WINDOW_MS = 15000;
const INBOUND_UPLOAD_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const INBOUND_UPLOAD_ALLOWED_MIME_TYPES = new Set([
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain",
]);
let isManualGestionSubmitInFlight = false;
let lastSuccessfulManualSubmit = {
    signature: "",
    savedAt: 0,
};
let pendingManualImageUpload = null;

function normalizeFlowLabel(value) {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase();
}

function isGestionRedesFlow({ menuItemId = "", campaignId = "" }) {
    return (
        String(menuItemId || "").trim() === REDES_PARENT_MENU_ITEM_ID ||
        normalizeFlowLabel(campaignId) === REDES_SHARED_LABEL
    );
}

function normalizeLookupKey(value) {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9]/g, "")
        .toLowerCase()
        .trim();
}

function getFirstFormValueByKeys(source = {}, candidateKeys = []) {
    const entries = Object.entries(source || {});

    for (const candidateKey of candidateKeys) {
        const directValue = source?.[candidateKey];
        if (
            directValue !== undefined &&
            directValue !== null &&
            String(directValue).trim() !== ""
        ) {
            return String(directValue).trim();
        }
    }

    const normalizedCandidates = candidateKeys.map(normalizeLookupKey);

    for (const [key, value] of entries) {
        if (
            value === undefined ||
            value === null ||
            String(value).trim() === ""
        ) {
            continue;
        }

        if (normalizedCandidates.includes(normalizeLookupKey(key))) {
            return String(value).trim();
        }
    }

    return "";
}

function findDynamicFieldValueByLabel(dynamicRows = [], answers = {}, labels = []) {
    const normalizedLabels = labels.map((label) => normalizeLookupKey(label));

    for (const field of dynamicRows) {
        const normalizedFieldLabel = normalizeLookupKey(field?.label || "");
        if (!normalizedLabels.includes(normalizedFieldLabel)) {
            continue;
        }

        const value = answers?.[field?.key];
        if (value !== undefined && value !== null && String(value).trim() !== "") {
            return String(value).trim();
        }
    }

    return "";
}

function buildStableValue(value) {
    if (Array.isArray(value)) {
        return value.map((item) => buildStableValue(item));
    }

    if (value && typeof value === "object") {
        return Object.keys(value)
            .sort()
            .reduce((accumulator, key) => {
                accumulator[key] = buildStableValue(value[key]);
                return accumulator;
            }, {});
    }

    return value;
}

function buildManualSubmitSignature({
    campaignId,
    categoryId,
    menuItemId,
    formData,
    surveyAnswers,
    interactionDetails,
}) {
    return JSON.stringify(
        buildStableValue({
            campaignId: String(campaignId || "").trim(),
            categoryId: String(categoryId || "").trim(),
            menuItemId: String(menuItemId || "").trim(),
            formData: formData || {},
            surveyAnswers: surveyAnswers || {},
            interactionDetails: interactionDetails || [],
        }),
    );
}

export default function useAgentGestionSubmit({
    manualFlowActivo,
    dynamicFormConfig,
    dynamicFormAnswers,
    observacion,
    campaignIdSeleccionada,
    categoryIdSeleccionada,
    menuItemIdSeleccionado,
    handle403,
    onChangeAgentPage,
    setRegistro,
    setError,
    registro,
    level1Seleccionado,
    level2Seleccionado,
    interactionIdActual,
    telefonoSeleccionado,
    surveyAnswers,
    surveyFieldsToRender,
    dynamicFormDetail,
    estadoAgente,
    fetchSiguienteRegistro,
    inboundChildOptions,
    inboundInteractionDetails,
    inboundImageDrafts,
    setIsSavingGestion,
    resetManualGestionDraft,
}) {
    return useCallback(
        async (event) => {
            event?.preventDefault?.();

            if (isManualGestionSubmitInFlight) {
                return;
            }

            if (manualFlowActivo) {
                try {
                    isManualGestionSubmitInFlight = true;
                    setIsSavingGestion?.(true);
                    setError("");
                    const isRedesManualFlow =
                        isGestionRedesFlow({
                            menuItemId: menuItemIdSeleccionado,
                            campaignId: campaignIdSeleccionada,
                        });

                    const dynamicRows = Array.isArray(dynamicFormConfig?.rows)
                        ? dynamicFormConfig.rows.flat()
                        : [];
                    const fieldsMeta = [
                        ...INBOUND_SPECIAL_FIELDS_META,
                        ...dynamicRows.map((field) => ({
                            name: field?.key || "",
                            label: field?.label || field?.key || "",
                        })),
                    ].filter((field) => field.name);

                    const selectedInboundOption = (inboundChildOptions || []).find(
                        (item) =>
                            String(item?.value || "") ===
                            String(
                                isRedesManualFlow
                                    ? dynamicFormAnswers?.__redes_nombre_cliente || ""
                                    : dynamicFormAnswers?.__inbound_nombre_cliente || "",
                            ),
                    );

                    const normalizedInteractionDetails = (
                        inboundInteractionDetails || []
                    )
                        .map((detail, index) => ({
                            orden: index + 1,
                            categorizacion: String(
                                detail?.categorizacion || "",
                            ).trim(),
                            motivo: String(detail?.motivo || "").trim(),
                            submotivo: String(detail?.submotivo || "").trim(),
                            observaciones: String(
                                detail?.observaciones || "",
                            ).trim(),
                        }))
                        .filter(
                            (detail) =>
                                detail.categorizacion ||
                                detail.motivo ||
                                detail.submotivo ||
                                detail.observaciones,
                        );

                    const latestInteractionDetail =
                        normalizedInteractionDetails[
                            normalizedInteractionDetails.length - 1
                        ] || {};

                    const inboundFormData = {
                        ...dynamicFormAnswers,
                        tipoCliente:
                            isRedesManualFlow
                                ? dynamicFormAnswers?.__redes_tipo_cliente || "Asesor"
                                : dynamicFormAnswers?.__inbound_tipo_cliente || "",
                        tipoIdentificacion:
                            dynamicFormAnswers?.__inbound_tipo_identificacion ||
                            "",
                        tipoCanal:
                            dynamicFormAnswers?.__inbound_tipo_canal || "",
                        relacion: dynamicFormAnswers?.__inbound_relacion || "",
                        nombreCliente:
                            isRedesManualFlow
                                ? String(
                                      selectedInboundOption?.label ||
                                          selectedInboundOption?.campaignId ||
                                          "",
                                  ).trim() ||
                                  dynamicFormAnswers?.__redes_nombre_cliente ||
                                  ""
                                : String(selectedInboundOption?.campaignId || "").trim() ||
                                  dynamicFormAnswers?.__inbound_nombre_cliente ||
                                  "",
                        nombreClienteMenuItemId:
                            String(selectedInboundOption?.menuItemId || "").trim() ||
                            (isRedesManualFlow
                                ? dynamicFormAnswers?.__redes_nombre_cliente
                                : dynamicFormAnswers?.__inbound_nombre_cliente) ||
                            "",
                        fechaGestion:
                            dynamicFormAnswers?.__redes_fecha_gestion || "",
                        estadoConversacion:
                            dynamicFormAnswers?.__redes_estado_conversacion || "",
                        tipoRedSocial:
                            dynamicFormAnswers?.__redes_tipo_red_social || "",
                        categorizacion:
                            latestInteractionDetail.categorizacion || "",
                        motivoInteraccion: latestInteractionDetail.motivo || "",
                        submotivoInteraccion:
                            latestInteractionDetail.submotivo || "",
                        observaciones:
                            latestInteractionDetail.observaciones ||
                            observacion ||
                            "",
                    };

                    if (isRedesManualFlow) {
                        const normalizedFullName =
                            getFirstFormValueByKeys(inboundFormData, [
                                "apellidosNombres",
                                "ApellidosNombres",
                                "apellidosNombre",
                                "nombreCompleto",
                                "nombresApellidos",
                                "NOMBRE_CLIENTE",
                                "NombreCliente",
                            ]) ||
                            findDynamicFieldValueByLabel(
                                dynamicRows,
                                dynamicFormAnswers,
                                ["Apellidos y Nombres", "Nombre Cliente"],
                            );

                        const normalizedCellphone =
                            getFirstFormValueByKeys(inboundFormData, [
                                "celular",
                                "Celular",
                                "telefono",
                                "telefonoCelular",
                                "movil",
                                "CAMPO3",
                            ]) ||
                            findDynamicFieldValueByLabel(
                                dynamicRows,
                                dynamicFormAnswers,
                                ["Celular", "Telefono celular", "Teléfono celular"],
                            );

                        if (normalizedFullName) {
                            inboundFormData.apellidosNombres = normalizedFullName;
                            inboundFormData.ApellidosNombres = normalizedFullName;
                            inboundFormData.nombreCompleto = normalizedFullName;
                        }

                        if (normalizedCellphone) {
                            inboundFormData.celular = normalizedCellphone;
                            inboundFormData.Celular = normalizedCellphone;
                            inboundFormData.CAMPO3 = normalizedCellphone;
                        }
                    }

                    const campaignIdToUse =
                        String(selectedInboundOption?.campaignId || "").trim() ||
                        campaignIdSeleccionada;
                    const menuItemIdToUse =
                        isRedesManualFlow
                            ? menuItemIdSeleccionado
                            : String(selectedInboundOption?.menuItemId || "").trim() ||
                              menuItemIdSeleccionado;
                    const identificationToUse = getFirstFormValueByKeys(
                        inboundFormData,
                        [
                            "identificacion",
                            "Identificacion",
                            "Identificación",
                            "identification",
                            "numeroCedula",
                            "NumeroCedula",
                            "numeroDeCedula",
                            "cedula",
                        ],
                    );

                    if (!campaignIdToUse || !identificationToUse) {
                        setError(
                            "Nombre Cliente e Identificación son requeridos para guardar.",
                        );
                        return;
                    }

                    inboundFormData.identificacion = identificationToUse;

                    if (!isRedesManualFlow) {
                        Object.keys(inboundFormData).forEach((key) => {
                            if (String(key || "").startsWith("__redes_")) {
                                delete inboundFormData[key];
                            }
                        });
                    }

                    const manualSubmitSignature = buildManualSubmitSignature({
                        campaignId: campaignIdToUse,
                        categoryId: categoryIdSeleccionada,
                        menuItemId: menuItemIdToUse,
                        formData: inboundFormData,
                        surveyAnswers: surveyAnswers || {},
                        interactionDetails: normalizedInteractionDetails,
                    });

                    if (
                        manualSubmitSignature &&
                        manualSubmitSignature ===
                            lastSuccessfulManualSubmit.signature &&
                        Date.now() - Number(lastSuccessfulManualSubmit.savedAt || 0) <
                            MANUAL_DUPLICATE_WINDOW_MS
                    ) {
                        setError(
                            "Esta gestión ya fue guardada. Cambia o limpia los datos antes de volver a enviarla.",
                        );
                        return;
                    }

                    if (
                        pendingManualImageUpload &&
                        pendingManualImageUpload.signature !== manualSubmitSignature
                    ) {
                        pendingManualImageUpload = null;
                    }

                    const saveManualGestion = isRedesManualFlow
                        ? guardarGestionRedes
                        : guardarGestionInbound;

                    const imagesToUpload = (inboundImageDrafts || []).filter(
                        (item) => item?.file instanceof File,
                    );

                    const invalidImageType = imagesToUpload.find((item) => {
                        const mimeType = String(
                            item?.file?.type || "",
                        ).toLowerCase();
                        return !INBOUND_UPLOAD_ALLOWED_MIME_TYPES.has(mimeType);
                    });

                    if (invalidImageType) {
                        setError(
                            "Formato de archivo no permitido. Usa PNG, JPG, JPEG, WEBP, PDF, Word, Excel o TXT.",
                        );
                        return;
                    }

                    const oversizedImage = imagesToUpload.find(
                        (item) =>
                            Number(item?.file?.size || 0) >
                            INBOUND_UPLOAD_MAX_FILE_SIZE_BYTES,
                    );

                    if (oversizedImage) {
                        setError(
                            "Uno o más archivos superan el límite de 10MB. Reduce el tamaño antes de guardar.",
                        );
                        return;
                    }

                    const uploadInboundDraftImages = async ({
                        interactionId,
                        contactId,
                        clienteInboundId,
                        gestionInboundId,
                    }) => {
                        const formData = new FormData();
                        formData.append("interactionId", String(interactionId || "").trim());
                        formData.append("contactId", String(contactId || "").trim());
                        formData.append(
                            "clienteInboundId",
                            String(clienteInboundId || "").trim(),
                        );
                        formData.append(
                            "gestionInboundId",
                            String(gestionInboundId || "").trim(),
                        );
                        formData.append("campaignId", campaignIdToUse);
                        formData.append(
                            "categoryId",
                            String(categoryIdSeleccionada || "").trim(),
                        );
                        formData.append(
                            "menuItemId",
                            String(menuItemIdToUse || "").trim(),
                        );
                        formData.append(
                            "nombreClienteRef",
                            String(
                                inboundFormData?.nombreCliente ||
                                    selectedInboundOption?.label ||
                                    "",
                            ).trim(),
                        );
                        for (const item of imagesToUpload) {
                            formData.append("images", item.file);
                        }

                        return uploadInboundImages(formData);
                    };

                    if (
                        pendingManualImageUpload &&
                        pendingManualImageUpload.signature === manualSubmitSignature
                    ) {
                        if (imagesToUpload.length === 0) {
                            setError(
                                "La gestión ya está creada. Adjunta archivos válidos para completar la carga de imágenes.",
                            );
                            return;
                        }

                        const uploadResponse = await uploadInboundDraftImages({
                            interactionId: pendingManualImageUpload.interactionId,
                            contactId: pendingManualImageUpload.contactId,
                            clienteInboundId:
                                pendingManualImageUpload.clienteInboundId,
                            gestionInboundId:
                                pendingManualImageUpload.gestionInboundId,
                        });

                        if (!uploadResponse.ok) {
                            setError(
                                uploadResponse?.json?.detail ||
                                    uploadResponse?.json?.error ||
                                    "No se pudo cargar las imágenes. Corrige los archivos e inténtalo de nuevo.",
                            );
                            return;
                        }

                        pendingManualImageUpload = null;
                        lastSuccessfulManualSubmit = {
                            signature: manualSubmitSignature,
                            savedAt: Date.now(),
                        };
                        resetManualGestionDraft?.();
                        return;
                    }

                    const { status, ok, json } = await saveManualGestion({
                        campaignId: campaignIdToUse,
                        campaign_id: campaignIdToUse,
                        categoryId: categoryIdSeleccionada,
                        menuItemId: menuItemIdToUse,
                        formData: inboundFormData,
                        fieldsMeta,
                        interactionDetails: normalizedInteractionDetails,
                        surveyPayload: surveyAnswers || {},
                        surveyFieldsMeta: surveyFieldsToRender.map((field) => ({
                            key: String(field?.key || "").trim(),
                            label: String(field?.label || "").trim(),
                        })),
                    });

                    if (status === 403) {
                        handle403(json);
                        return;
                    }

                    if (!ok) {
                        setError(
                            json?.detail ||
                                json?.error ||
                                (isRedesManualFlow
                                    ? "No se pudo guardar la gestion redes"
                                    : "No se pudo guardar la gestion inbound"),
                        );
                        return;
                    }

                    if (imagesToUpload.length > 0) {
                        const uploadResponse = await uploadInboundDraftImages({
                            interactionId: json?.interactionId,
                            contactId: json?.contactId,
                            clienteInboundId: json?.clienteInboundId,
                            gestionInboundId: json?.gestionInboundId,
                        });

                        if (!uploadResponse.ok) {
                            pendingManualImageUpload = {
                                signature: manualSubmitSignature,
                                interactionId: String(
                                    json?.interactionId || "",
                                ).trim(),
                                contactId: String(json?.contactId || "").trim(),
                                clienteInboundId: String(
                                    json?.clienteInboundId || "",
                                ).trim(),
                                gestionInboundId: String(
                                    json?.gestionInboundId || "",
                                ).trim(),
                            };
                            setError(
                                uploadResponse?.json?.detail ||
                                    uploadResponse?.json?.error ||
                                    "No se pudo cargar las imágenes. Corrige los archivos y vuelve a guardar; se reintentará solo la carga sin duplicar la gestión.",
                            );
                            return;
                        }
                    }

                    pendingManualImageUpload = null;
                    lastSuccessfulManualSubmit = {
                        signature: manualSubmitSignature,
                        savedAt: Date.now(),
                    };
                    resetManualGestionDraft?.();
                    return;
                } catch (err) {
                    console.error(err);
                    setError("Error de conexion con el servidor");
                    return;
                } finally {
                    isManualGestionSubmitInFlight = false;
                    setIsSavingGestion?.(false);
                }
            }

            if (!registro) return;

            try {
                isManualGestionSubmitInFlight = true;
                setIsSavingGestion?.(true);
                setError("");

                const payload = {
                    registro_id: registro.id,
                    estado_final: level2Seleccionado || level1Seleccionado,
                    level1: level1Seleccionado,
                    level2: level2Seleccionado,
                    campaign_id: registro?.campaign_id || campaignIdSeleccionada,
                    interactionId: interactionIdActual || null,
                    telefono_ad: telefonoSeleccionado || null,
                    comentarios: observacion || null,
                    fecha_agendamiento: surveyAnswers?.respuesta1 || null,
                    encuesta: surveyAnswers,
                    encuestaPreguntas: surveyFieldsToRender.map((field) =>
                        String(field.label || "").trim(),
                    ),
                    encuestaRespuestas: surveyFieldsToRender.map((field) =>
                        String(surveyAnswers?.[field.key] || "").trim(),
                    ),
                    encuestaKeys: surveyFieldsToRender.map((field) =>
                        String(field.key || "").trim(),
                    ),
                    dynamicForm2Payload: dynamicFormDetail || {},
                    dynamicForm3Payload: surveyAnswers || {},
                };

                const { status, ok, json } = await guardarGestion(payload);

                if (status === 403) {
                    handle403(json);
                    return;
                }

                if (!ok) {
                    setError(json?.error || "No se pudo guardar la gestion");
                    return;
                }

                if (estadoAgente === "Disponible") {
                    await fetchSiguienteRegistro();
                } else {
                    setRegistro(null);
                }
            } catch (err) {
                console.error(err);
                setError("Error de conexion con el servidor");
            } finally {
                isManualGestionSubmitInFlight = false;
                setIsSavingGestion?.(false);
            }
        },
        [
            campaignIdSeleccionada,
            categoryIdSeleccionada,
            dynamicFormAnswers,
            dynamicFormConfig,
            dynamicFormDetail,
            estadoAgente,
            fetchSiguienteRegistro,
            handle403,
            inboundChildOptions,
            inboundImageDrafts,
            inboundInteractionDetails,
            interactionIdActual,
            level1Seleccionado,
            level2Seleccionado,
            manualFlowActivo,
            menuItemIdSeleccionado,
            observacion,
            onChangeAgentPage,
            registro,
            resetManualGestionDraft,
            setError,
            setIsSavingGestion,
            setRegistro,
            surveyAnswers,
            surveyFieldsToRender,
            telefonoSeleccionado,
        ],
    );
}
