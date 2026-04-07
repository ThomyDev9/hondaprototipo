import "./AgentGestionForm.css";
import PropTypes from "prop-types";
import { useEffect, useMemo, useRef, useState } from "react";
import Button from "../../../components/common/Button";
import Tabs from "../../../components/common/Tabs";
import useAgentCampaignScript from "../hooks/useAgentCampaignScript";
import AgentScriptTabs from "./AgentScriptTabs";
import AgentGestionPrimarySection from "./AgentGestionPrimarySection";
import AgentGestionDynamicSection from "./AgentGestionDynamicSection";
import AgentGestionSurveySection from "./AgentGestionSurveySection";
import { buildCrmEmailDraft } from "../crmEmailDraft.helpers";
import { isEditableTicketInboundFlow } from "../inboundFlow.helpers";
import {
    buildDynamicFormRows,
    buildExtraFields,
    chunkArray,
    parseAdditionalFields,
} from "./agentGestionForm.helpers";

const INBOUND_MENU_CATEGORY_ID = "fa70b8a1-2c69-11f1-b790-000c2904c92f";
const REDES_PARENT_MENU_ITEM_ID = "b3d8324e-2c69-11f1-b790-000c2904c92f";
const REDES_SHARED_LABEL = "gestion redes";

const INBOUND_FIXED_FIELDS_PRIMARY_ROW = [
    {
        key: "__inbound_tipo_cliente",
        label: "Tipo cliente",
        type: "select",
        required: true,
        options: ["Titular", "Tercera persona"],
    },
    {
        key: "__inbound_tipo_identificacion",
        label: "Tipo de identificación",
        type: "select",
        required: true,
        options: ["Cédula", "Ruc", "Pasaporte"],
    },
    {
        key: "__inbound_tipo_canal",
        label: "Tipo de canal",
        type: "select",
        required: true,
        options: ["Inbound", "Outbound"],
    },
];

const INBOUND_FIXED_FIELDS_SECONDARY_ROW = [
    {
        key: "__inbound_relacion",
        label: "Relacion",
        type: "radio",
        options: ["Socio", "Cliente"],
    },
];

const REDES_FIXED_FIELDS_PRIMARY_ROW = [
    {
        key: "__redes_nombre_cliente",
        label: "Nombre Cliente",
        type: "select",
        required: true,
        options: [],
    },
    {
        key: "__redes_tipo_cliente",
        label: "Tipo cliente",
        type: "text",
        readOnly: true,
        required: true,
    },
    {
        key: "__redes_tipo_red_social",
        label: "Tipo red social",
        type: "select",
        required: true,
        options: ["Whatsapp", "Messenger", "Instagram", "Pagina web"],
    },
];

const REDES_FIXED_FIELDS_SECONDARY_ROW = [
    {
        key: "__redes_fecha_gestion",
        label: "Fecha gestión",
        type: "date",
        readOnly: true,
        required: true,
    },
    {
        key: "__redes_estado_conversacion",
        label: "Estado conversación",
        type: "text",
        readOnly: true,
        required: true,
    },
];

function buildUniqueOptions(values = []) {
    return [
        ...new Set(
            values.map((item) => String(item || "").trim()).filter(Boolean),
        ),
    ].map((item) => ({
        value: item,
        label: item,
    }));
}

function normalizeFlowLabel(value) {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase();
}

function getRedesFieldOrder(field = {}) {
    const normalizedKey = normalizeFlowLabel(field?.key);
    const normalizedLabel = normalizeFlowLabel(field?.label);

    if (
        normalizedKey === "identificacion" ||
        normalizedLabel === "identificacion"
    ) {
        return 1;
    }

    if (
        normalizedKey === "apellidosnombres" ||
        normalizedKey === "nombrecliente" ||
        normalizedKey === "nombre_cliente" ||
        normalizedLabel.includes("apellidos y nombres") ||
        normalizedLabel.includes("nombre cliente")
    ) {
        return 2;
    }

    if (
        normalizedKey === "campo3" ||
        normalizedKey === "celular" ||
        normalizedLabel === "celular"
    ) {
        return 3;
    }

    if (
        normalizedKey === "campo2" ||
        normalizedKey === "cantidadmensajes" ||
        normalizedKey === "cantidad_mensajes" ||
        normalizedLabel.includes("cantidad de mensajes")
    ) {
        return 4;
    }

    return 100;
}

function buildInboundEmailDraft(dynamicFormAnswers = {}, user = {}) {
    const clientName = String(
        dynamicFormAnswers?.NOMBRE_CLIENTE ||
            dynamicFormAnswers?.nombreCliente ||
            dynamicFormAnswers?.__inbound_nombre_cliente_label ||
            "",
    ).trim();
    const destinationEmail = String(
        dynamicFormAnswers?.CAMPO2 ||
            dynamicFormAnswers?.email ||
            dynamicFormAnswers?.correo ||
            "",
    ).trim();
    const city = String(dynamicFormAnswers?.CAMPO1 || "").trim();
    const phone = String(dynamicFormAnswers?.CAMPO3 || "").trim();
    const conventional = String(dynamicFormAnswers?.CAMPO4 || "").trim();
    const ticketId = String(
        dynamicFormAnswers?.CAMPO5 ||
            dynamicFormAnswers?.ticketId ||
            dynamicFormAnswers?.idLlamada ||
            "",
    ).trim();
    const identification = String(
        dynamicFormAnswers?.IDENTIFICACION || "",
    ).trim();
    const advisorName = String(
        user?.full_name || user?.name || user?.username || "",
    ).trim();

    const detailLines = [
        clientName ? `Cliente: ${clientName}` : "",
        identification ? `Identificacion: ${identification}` : "",
        phone ? `Celular: ${phone}` : "",
        conventional ? `Convencional: ${conventional}` : "",
        city ? `Ciudad: ${city}` : "",
        ticketId ? `Ticket / Id llamada: ${ticketId}` : "",
    ].filter(Boolean);

    return buildCrmEmailDraft({
        contextLabel: "Correo Inbound",
        subjectPrefix: "Seguimiento de solicitud inbound",
        greetingName: clientName,
        to: destinationEmail,
        bodyIntro:
            "Le contactamos para dar seguimiento a su solicitud registrada en nuestro canal inbound.",
        detailLines,
        advisorName,
    });
}

function buildRedesEmailDraft(dynamicFormAnswers = {}, user = {}) {
    const clientName = String(
        dynamicFormAnswers?.NOMBRE_CLIENTE ||
            dynamicFormAnswers?.nombreCliente ||
            dynamicFormAnswers?.__redes_nombre_cliente_label ||
            dynamicFormAnswers?.__redes_nombre_cliente ||
            "",
    ).trim();
    const destinationEmail = String(
        dynamicFormAnswers?.CAMPO2 ||
            dynamicFormAnswers?.email ||
            dynamicFormAnswers?.correo ||
            "",
    ).trim();
    const phone = String(dynamicFormAnswers?.CAMPO3 || "").trim();
    const identification = String(
        dynamicFormAnswers?.IDENTIFICACION || "",
    ).trim();
    const advisorName = String(
        user?.full_name || user?.name || user?.username || "",
    ).trim();
    const detailLines = [
        clientName ? `Cliente: ${clientName}` : "",
        identification ? `Identificacion: ${identification}` : "",
        phone ? `Celular: ${phone}` : "",
        dynamicFormAnswers?.__redes_estado_conversacion
            ? `Estado conversacion: ${dynamicFormAnswers.__redes_estado_conversacion}`
            : "",
    ].filter(Boolean);

    return buildCrmEmailDraft({
        contextLabel: "Correo Gestion Redes",
        subjectPrefix: "Seguimiento de gestion redes",
        greetingName: clientName,
        to: destinationEmail,
        bodyIntro:
            "Le contactamos para dar seguimiento a su gestión registrada desde el canal de redes.",
        detailLines,
        advisorName,
    });
}

function InboundInteractionDetailsSection({
    details,
    levels,
    onAdd,
    onRemove,
    onChange,
    mode = "inbound",
}) {
    const isRedesMode = mode === "redes";
    const detailsToRender = isRedesMode
        ? [
              (details && details[0]) || {
                  categorizacion: "",
                  motivo: "",
                  submotivo: "",
                  observaciones: "",
              },
          ]
        : details || [];

    return (
        <section className="agent-form-card agent-form-card--secondary">
            <div className="agent-form-header-row agent-inbound-detail-header">
                <p className="agent-form-card__title">
                    {isRedesMode
                        ? "Clasificación de la gestión"
                        : "Acciones de la llamada"}
                </p>
            </div>

            <div className="agent-inbound-detail-table">
                {detailsToRender.map((detail, index) => {
                    const selectedCategorizacion = String(
                        detail?.categorizacion || "",
                    ).trim();
                    const selectedMotivo = String(detail?.motivo || "").trim();
                    const categorizacionOptions = buildUniqueOptions(
                        (levels || []).map((item) => item.description),
                    );
                    const motivoOptions = buildUniqueOptions(
                        (levels || [])
                            .filter(
                                (item) =>
                                    String(item?.description || "").trim() ===
                                    selectedCategorizacion,
                            )
                            .map((item) => item.level1),
                    );
                    const submotivoOptions = buildUniqueOptions(
                        (levels || [])
                            .filter(
                                (item) =>
                                    String(item?.description || "").trim() ===
                                        selectedCategorizacion &&
                                    String(item?.level1 || "").trim() ===
                                        selectedMotivo,
                            )
                            .map((item) => item.level2),
                    );

                    return (
                        <div
                            key={`inbound-detail-${index}`}
                            className="agent-inbound-detail-row"
                        >
                            <div className="agent-inbound-detail-index">
                                {index + 1}
                            </div>
                            <div className="agent-form-field">
                                <span className="agent-dynamic-label">
                                    Categorización
                                    <span style={{ color: "red" }}> *</span>
                                </span>
                                <select
                                    className="agent-input agent-survey-input"
                                    required
                                    value={detail?.categorizacion || ""}
                                    onChange={(event) =>
                                        onChange(
                                            index,
                                            "categorizacion",
                                            event.target.value,
                                        )
                                    }
                                >
                                    <option value="">Selecciona...</option>
                                    {categorizacionOptions.map((option) => (
                                        <option
                                            key={option.value}
                                            value={option.value}
                                        >
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="agent-form-field">
                                <span className="agent-dynamic-label">
                                    {isRedesMode
                                        ? "Level1"
                                        : "Motivo de la interacción"}
                                    <span style={{ color: "red" }}> *</span>
                                </span>
                                <select
                                    className="agent-input agent-survey-input"
                                    required
                                    value={detail?.motivo || ""}
                                    onChange={(event) =>
                                        onChange(
                                            index,
                                            "motivo",
                                            event.target.value,
                                        )
                                    }
                                >
                                    <option value="">Selecciona...</option>
                                    {motivoOptions.map((option) => (
                                        <option
                                            key={option.value}
                                            value={option.value}
                                        >
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="agent-form-field">
                                <span className="agent-dynamic-label">
                                    {isRedesMode
                                        ? "Level2"
                                        : "Submotivo de la interacción"}
                                    <span style={{ color: "red" }}> *</span>
                                </span>
                                <select
                                    className="agent-input agent-survey-input"
                                    required
                                    value={detail?.submotivo || ""}
                                    onChange={(event) =>
                                        onChange(
                                            index,
                                            "submotivo",
                                            event.target.value,
                                        )
                                    }
                                >
                                    <option value="">Selecciona...</option>
                                    {submotivoOptions.map((option) => (
                                        <option
                                            key={option.value}
                                            value={option.value}
                                        >
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="agent-form-field agent-inbound-detail-observaciones">
                                <span className="agent-dynamic-label">
                                    {isRedesMode
                                        ? "Observación"
                                        : "Observaciones de la interacción"}
                                </span>
                                <textarea
                                    className="agent-input agent-survey-input"
                                    value={detail?.observaciones || ""}
                                    onChange={(event) =>
                                        onChange(
                                            index,
                                            "observaciones",
                                            event.target.value,
                                        )
                                    }
                                />
                            </div>
                            {!isRedesMode && (
                                <div className="agent-inbound-detail-actions">
                                    {index === 0 && (
                                        <Button
                                            variant="secondary"
                                            type="button"
                                            onClick={onAdd}
                                        >
                                            Agregar accion
                                        </Button>
                                    )}
                                    <Button
                                        variant="secondary"
                                        type="button"
                                        onClick={() => onRemove(index)}
                                    >
                                        Quitar
                                    </Button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </section>
    );
}

function InboundImagesSection({
    items,
    onAdd,
    onRemove,
    onChange,
}) {
    return (
        <section className="agent-form-card agent-form-card--tertiary">
            <div className="agent-form-header-row agent-inbound-detail-header">
                <p className="agent-form-card__title">Capturas de soporte</p>
            </div>

            <div className="agent-inbound-image-table">
                {(items || []).map((item, index) => (
                    <div
                        key={`inbound-image-${index}`}
                        className="agent-inbound-image-row"
                    >
                        <div className="agent-inbound-detail-index">
                            {index + 1}
                        </div>
                        <div className="agent-form-field">
                            <span className="agent-dynamic-label">
                                Imagen
                            </span>
                            <input
                                type="file"
                                accept="image/png,image/jpeg,image/jpg,image/webp"
                                className="agent-input agent-survey-input"
                                onChange={(event) =>
                                    onChange(
                                        index,
                                        "file",
                                        event.target.files?.[0] || null,
                                    )
                                }
                            />
                            {item?.file?.name ? (
                                <span className="agent-file-chip">
                                    {item.file.name}
                                </span>
                            ) : null}
                        </div>
                        <div className="agent-inbound-detail-actions">
                            {index === 0 && (
                                <Button
                                    variant="secondary"
                                    type="button"
                                    onClick={onAdd}
                                >
                                    Agregar imagen
                                </Button>
                            )}
                            <Button
                                variant="secondary"
                                type="button"
                                onClick={() => onRemove(index)}
                            >
                                Quitar
                            </Button>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}

function AgentGestionForm({
    registro,
    campaignId,
    campaignLabel,
    manualFlow,
    menuItemId,
    categoryId,
    inboundChildOptions,
    onSubmit,
    levels,
    level1Seleccionado,
    level2Seleccionado,
    onLevel1Change,
    onLevel2Change,
    telefonos,
    telefonoSeleccionado,
    onTelefonoChange,
    estadoTelefonos,
    estadoTelefonoSeleccionado,
    onEstadoTelefonoChange,
    observacion,
    onObservacionChange,
    onNoContestaClick,
    onGrabadoraClick,
    onContestaTerceroClick,
    dynamicFormConfig,
    dynamicFormDetail,
    dynamicFormAnswers,
    onDynamicFormFieldChange,
    dynamicSurveyConfig,
    surveyFieldsToRender,
    surveyAnswers,
    onSurveyFieldChange,
    inboundInteractionDetails,
    inboundImageDrafts,
    onAddInboundInteractionDetail,
    onRemoveInboundInteractionDetail,
    onInboundInteractionDetailChange,
    onAddInboundImageDraft,
    onRemoveInboundImageDraft,
    onInboundImageDraftChange,
    onCancelarGestion,
    user,
    isSaving = false,
    secureInboundManual = false,
}) {
    const firstRender = useRef(true);
    const [activeTab, setActiveTab] = useState("gestion");
    const isInboundManualFlow =
        manualFlow &&
        String(categoryId || "").trim() === INBOUND_MENU_CATEGORY_ID;
    const isEditableTicketInboundManualFlow =
        isInboundManualFlow &&
        (
            secureInboundManual ||
            isEditableTicketInboundFlow(
                campaignLabel,
                campaignId,
                dynamicFormAnswers?.__inbound_nombre_cliente_label,
                dynamicFormConfig?.title,
            )
        );
    const isRedesManualFlow =
        manualFlow &&
        (
            String(menuItemId || "").trim() === REDES_PARENT_MENU_ITEM_ID ||
            normalizeFlowLabel(campaignId) === REDES_SHARED_LABEL ||
            normalizeFlowLabel(dynamicFormConfig?.title) === REDES_SHARED_LABEL
        );
    const dynamicSectionVariant = isRedesManualFlow
        ? "redes"
        : isEditableTicketInboundManualFlow
          ? "inbound-editable-ticket"
        : isInboundManualFlow
          ? "inbound"
          : "standard";
    const manualInboundDisplayTitle = String(
        campaignLabel || dynamicFormConfig?.title || "Gestion Inbound",
    ).trim();
    const dynamicSectionHeaderTitle = isRedesManualFlow
        ? "Gestion Redes"
        : isInboundManualFlow
          ? manualInboundDisplayTitle
          : `Formulario 2 - ${dynamicFormConfig?.title || "Formulario 2"}`;

    const handleOpenEmailComposer = () => {
        const draft = isRedesManualFlow
            ? buildRedesEmailDraft(dynamicFormAnswers, user)
            : buildInboundEmailDraft(dynamicFormAnswers, user);
        const draftId =
            globalThis.crypto?.randomUUID?.() || String(Date.now());

        try {
            localStorage.setItem(
                `inbound-email-draft:${draftId}`,
                JSON.stringify(draft),
            );
        } catch (error) {
            console.error(
                "No se pudo guardar el borrador de correo inbound:",
                error,
            );
        }

        const url = new URL(window.location.href);
        url.searchParams.set("standalone", "inbound-email");
        url.searchParams.set("draftId", draftId);
        window.open(url.toString(), "_blank", "noopener,noreferrer");
    };

    useEffect(() => {
        if (firstRender.current) {
            firstRender.current = false;
            return;
        }

        if (!telefonoSeleccionado) return;

        if (navigator?.clipboard?.writeText) {
            navigator.clipboard.writeText(telefonoSeleccionado).catch(() => {});
            return;
        }

        const tempInput = document.createElement("input");
        tempInput.value = telefonoSeleccionado;
        document.body.appendChild(tempInput);
        tempInput.select();
        document.execCommand("copy");
        document.body.removeChild(tempInput);
    }, [telefonoSeleccionado]);

    const dynamicFormRowsWithValues = useMemo(
        () =>
            manualFlow
                ? dynamicFormConfig?.rows || []
                : buildDynamicFormRows(dynamicFormConfig, dynamicFormDetail),
        [dynamicFormConfig, dynamicFormDetail, manualFlow],
    );

    const inboundDynamicRows = useMemo(() => {
        const baseRows = Array.isArray(dynamicFormRowsWithValues)
            ? dynamicFormRowsWithValues
            : [];

        if (!manualFlow) {
            return baseRows;
        }

        if (
            isRedesManualFlow
        ) {
            const redesFilteredRows = baseRows
                .map((row) =>
                    row.filter((field) => {
                        const normalizedFieldKey = normalizeFlowLabel(
                            field?.key,
                        );
                        const normalizedFieldLabel = normalizeFlowLabel(
                            field?.label,
                        );

                        return (
                            normalizedFieldKey !== "campo6" &&
                            normalizedFieldLabel !==
                                "observaciones de la interaccion"
                        );
                    }),
                )
                .filter((row) => row.length > 0);
            const redesClientOptions = (inboundChildOptions || [])
                .map((item) => ({
                    value: String(item?.menuItemId || item?.value || "").trim(),
                    label: String(item?.label || item?.campaignId || "").trim(),
                }))
                .filter((item) => item.value && item.label);
            const redesReadOnlyFields = [
                REDES_FIXED_FIELDS_PRIMARY_ROW[1],
                REDES_FIXED_FIELDS_SECONDARY_ROW[0],
                REDES_FIXED_FIELDS_SECONDARY_ROW[1],
            ];
            const redesEditableFixedFields = [
                {
                    ...REDES_FIXED_FIELDS_PRIMARY_ROW[0],
                    options: redesClientOptions,
                },
                REDES_FIXED_FIELDS_PRIMARY_ROW[2],
            ];
            const redesBodyFields = [...redesFilteredRows.flat()].sort(
                (leftField, rightField) =>
                    getRedesFieldOrder(leftField) - getRedesFieldOrder(rightField),
            );
            const takeRedesFieldByOrder = (order) => {
                const fieldIndex = redesBodyFields.findIndex(
                    (field) => getRedesFieldOrder(field) === order,
                );

                if (fieldIndex < 0) {
                    return null;
                }

                const [field] = redesBodyFields.splice(fieldIndex, 1);
                return field || null;
            };

            const identificationField = takeRedesFieldByOrder(1);
            const fullNameField = takeRedesFieldByOrder(2);
            const celularField = takeRedesFieldByOrder(3);
            const cantidadMensajesField = takeRedesFieldByOrder(4);
            const redesRows = [
                redesReadOnlyFields,
                [
                    redesEditableFixedFields[0],
                    redesEditableFixedFields[1],
                    ...(identificationField ? [identificationField] : []),
                ].slice(0, 3),
                [
                    ...(fullNameField ? [fullNameField] : []),
                    ...(celularField ? [celularField] : []),
                    ...(cantidadMensajesField ? [cantidadMensajesField] : []),
                ],
                ...chunkArray(redesBodyFields, 3),
            ].filter((row) => row.length > 0);

            return redesRows;
        }

        if (String(categoryId || "").trim() !== INBOUND_MENU_CATEGORY_ID) {
            return baseRows;
        }

        const alreadyIncluded = baseRows.some((row) =>
            row.some((field) => field.key === "__inbound_tipo_cliente"),
        );

        if (alreadyIncluded) {
            return baseRows;
        }

        const inboundFieldMap = new Map(
            baseRows
                .flat()
                .filter(Boolean)
                .filter((field) => field.key !== "CAMPO6")
                .map((field) => [field.key, field]),
        );

        const pickField = (key) => inboundFieldMap.get(key) || null;
        const pickRequiredField = (key) => {
            const field = pickField(key);
            return field ? { ...field, required: true } : null;
        };
        const inboundClientOptions = (inboundChildOptions || [])
            .map((item) => ({
                value: String(item?.menuItemId || item?.value || "").trim(),
                label: String(item?.label || item?.campaignId || "").trim(),
            }))
            .filter((item) => item.value && item.label);

        const compactRows = [
            INBOUND_FIXED_FIELDS_PRIMARY_ROW,
            [
                secureInboundManual
                    ? {
                          key: "__inbound_nombre_cliente",
                          label: "Nombre Cliente",
                          type: "select",
                          required: true,
                          options: inboundClientOptions,
                      }
                    : {
                          key: "__inbound_nombre_cliente_label",
                          label: "Nombre Cliente",
                          type: "text",
                          readOnly: true,
                      },
                ...INBOUND_FIXED_FIELDS_SECONDARY_ROW,
            ],
            [pickField("IDENTIFICACION"), pickField("NOMBRE_CLIENTE")].filter(
                Boolean,
            ),
            [
                pickField("CAMPO1"),
                pickField("CAMPO2"),
                pickRequiredField("CAMPO3"),
                pickField("CAMPO4"),
                pickRequiredField("CAMPO5"),
            ].filter(Boolean),
        ].filter((row) => row.length > 0);

        return compactRows;
    }, [
        categoryId,
        inboundChildOptions,
        isEditableTicketInboundManualFlow,
        isRedesManualFlow,
        dynamicFormRowsWithValues,
        inboundChildOptions,
        manualFlow,
        secureInboundManual,
    ]);

    const extraFields = useMemo(
        () => buildExtraFields(dynamicFormDetail, dynamicFormConfig),
        [dynamicFormConfig, dynamicFormDetail],
    );

    const additionalDynamicValues = useMemo(
        () => parseAdditionalFields(dynamicFormDetail),
        [dynamicFormDetail],
    );

    const getDynamicFormValue = (key) =>
        dynamicFormDetail?.[key] ?? additionalDynamicValues?.[key] ?? "";

    const showDynamicForm =
        Boolean(dynamicFormConfig) && inboundDynamicRows.length > 0;

    const normalizedLevel1 = String(level1Seleccionado || "")
        .trim()
        .toUpperCase();

    const hideSurveyByLevel1 =
        normalizedLevel1.startsWith("NU1") ||
        normalizedLevel1.startsWith("NU2");

    const showSurvey = Boolean(dynamicSurveyConfig) && !hideSurveyByLevel1;

    useEffect(() => {
        const availableTabs = ["gestion"];
        if (showSurvey) availableTabs.push("encuesta");

        if (!availableTabs.includes(activeTab)) {
            setActiveTab(availableTabs[0]);
        }
    }, [activeTab, showSurvey]);

    const { scriptEntries, activeScriptKey, setActiveScriptKey } =
        useAgentCampaignScript({
            campaignId,
            menuItemId,
            categoryId,
            registro,
            user,
            dynamicFormConfig,
            dynamicFormDetail,
        });

    const inboundPrimaryContent = showDynamicForm ? (
        <AgentGestionDynamicSection
            title={dynamicFormConfig?.title}
            headerTitle={dynamicSectionHeaderTitle}
            rows={inboundDynamicRows}
            extraFields={extraFields}
            getFieldValue={getDynamicFormValue}
            editable={manualFlow}
            values={dynamicFormAnswers}
            onFieldChange={onDynamicFormFieldChange}
            variant={dynamicSectionVariant}
        />
    ) : null;

    const gestionContent = (
        <div
            className={`agent-form-stack${
                isInboundManualFlow || isRedesManualFlow
                    ? " agent-form-stack--inbound"
                    : ""
            }`}
        >
            {!manualFlow && (
                <AgentGestionPrimarySection
                    levels={levels}
                    telefonos={telefonos}
                    telefonoSeleccionado={telefonoSeleccionado}
                    onTelefonoChange={onTelefonoChange}
                    level1Seleccionado={level1Seleccionado}
                    onLevel1Change={onLevel1Change}
                    level2Seleccionado={level2Seleccionado}
                    onLevel2Change={onLevel2Change}
                    estadoTelefonos={estadoTelefonos}
                    estadoTelefonoSeleccionado={estadoTelefonoSeleccionado}
                    onEstadoTelefonoChange={onEstadoTelefonoChange}
                    observacion={observacion}
                    onObservacionChange={onObservacionChange}
                    registro={registro}
                    onNoContestaClick={onNoContestaClick}
                    onGrabadoraClick={onGrabadoraClick}
                    onContestaTerceroClick={onContestaTerceroClick}
                />
            )}

            {!isInboundManualFlow && !isRedesManualFlow && showDynamicForm && (
                <>
                    {!manualFlow && (
                        <div
                            className="agent-form-stack-divider"
                            aria-hidden="true"
                        />
                    )}
                    {inboundPrimaryContent}
                </>
            )}

            {(isInboundManualFlow || isRedesManualFlow) && (
                <section
                    className={`agent-form-card agent-form-card--secondary agent-inbound-shell${
                        isRedesManualFlow ? " agent-inbound-shell--redes" : ""
                    }`}
                >
                    <div className="agent-inbound-shell__content">
                        <div className="agent-inbound-shell__column">
                            {inboundPrimaryContent}
                            {isInboundManualFlow && (
                                <InboundImagesSection
                                    items={inboundImageDrafts}
                                    onAdd={onAddInboundImageDraft}
                                    onRemove={onRemoveInboundImageDraft}
                                    onChange={onInboundImageDraftChange}
                                />
                            )}
                        </div>
                        <InboundInteractionDetailsSection
                            details={inboundInteractionDetails}
                            levels={levels}
                            onAdd={onAddInboundInteractionDetail}
                            onRemove={onRemoveInboundInteractionDetail}
                            onChange={onInboundInteractionDetailChange}
                            mode={isRedesManualFlow ? "redes" : "inbound"}
                        />
                    </div>
                </section>
            )}

        </div>
    );

    const tabDefinitions = [
        {
            id: "gestion",
            label: showDynamicForm
                ? manualFlow
                    ? isRedesManualFlow
                        ? "Gestion Redes"
                        : manualInboundDisplayTitle
                    : `F1 - F2 - ${dynamicFormConfig?.title}`
                : "Formulario 1",
            content: gestionContent,
        },
        showSurvey && {
            id: "encuesta",
            label: `Formulario 3 - ${dynamicSurveyConfig?.title}`,
            content: (
                <AgentGestionSurveySection
                    title={dynamicSurveyConfig?.title}
                    fields={surveyFieldsToRender}
                    answers={surveyAnswers}
                    onSurveyFieldChange={onSurveyFieldChange}
                />
            ),
        },
    ].filter(Boolean);

    return (
        <form
            onSubmit={onSubmit}
            className={`agent-gestion-form${
                isInboundManualFlow || isRedesManualFlow
                    ? " agent-gestion-form--inbound"
                    : ""
            }`}
        >
            <AgentScriptTabs
                scriptEntries={scriptEntries}
                activeScriptKey={activeScriptKey}
                onChange={setActiveScriptKey}
            />

            <div className="agent-tabs-wrapper">
                <Tabs
                    tabs={tabDefinitions}
                    activeTab={activeTab}
                    onChange={setActiveTab}
                />
            </div>

            <div className="agent-form-actions">
                {(isInboundManualFlow || isRedesManualFlow) && (
                    <Button
                        variant="secondary"
                        type="button"
                        className="agent-email-button"
                        onClick={handleOpenEmailComposer}
                        disabled={isSaving}
                    >
                        Enviar correo
                    </Button>
                )}
                <Button variant="primary" type="submit" disabled={isSaving}>
                    {isSaving ? "Guardando..." : "Guardar gestion"}
                </Button>
                <Button
                    variant="secondary"
                    type="button"
                    onClick={onCancelarGestion}
                    disabled={isSaving}
                >
                    Cancelar gestion
                </Button>
            </div>
        </form>
    );
}

export default AgentGestionForm;

AgentGestionForm.propTypes = {
    registro: PropTypes.object,
    campaignId: PropTypes.string,
    campaignLabel: PropTypes.string,
    manualFlow: PropTypes.bool,
    menuItemId: PropTypes.string,
    categoryId: PropTypes.string,
    inboundChildOptions: PropTypes.arrayOf(PropTypes.object),
    onSubmit: PropTypes.func.isRequired,
    levels: PropTypes.arrayOf(PropTypes.object).isRequired,
    level1Seleccionado: PropTypes.string.isRequired,
    level2Seleccionado: PropTypes.string.isRequired,
    onLevel1Change: PropTypes.func.isRequired,
    onLevel2Change: PropTypes.func.isRequired,
    telefonos: PropTypes.arrayOf(PropTypes.string).isRequired,
    telefonoSeleccionado: PropTypes.string.isRequired,
    onTelefonoChange: PropTypes.func.isRequired,
    estadoTelefonos: PropTypes.arrayOf(PropTypes.string).isRequired,
    estadoTelefonoSeleccionado: PropTypes.string.isRequired,
    onEstadoTelefonoChange: PropTypes.func.isRequired,
    observacion: PropTypes.string.isRequired,
    onObservacionChange: PropTypes.func.isRequired,
    onNoContestaClick: PropTypes.func.isRequired,
    onGrabadoraClick: PropTypes.func.isRequired,
    onContestaTerceroClick: PropTypes.func.isRequired,
    dynamicFormConfig: PropTypes.shape({
        title: PropTypes.string,
        rows: PropTypes.arrayOf(
            PropTypes.arrayOf(
                PropTypes.shape({
                    key: PropTypes.string,
                    label: PropTypes.string,
                }),
            ),
        ),
    }),
    dynamicFormDetail: PropTypes.object,
    dynamicFormAnswers: PropTypes.object,
    onDynamicFormFieldChange: PropTypes.func,
    dynamicSurveyConfig: PropTypes.shape({
        title: PropTypes.string,
        fields: PropTypes.arrayOf(PropTypes.object),
    }),
    surveyFieldsToRender: PropTypes.arrayOf(PropTypes.object).isRequired,
    surveyAnswers: PropTypes.object.isRequired,
    onSurveyFieldChange: PropTypes.func.isRequired,
    inboundInteractionDetails: PropTypes.arrayOf(PropTypes.object),
    inboundImageDrafts: PropTypes.arrayOf(PropTypes.object),
    onAddInboundInteractionDetail: PropTypes.func,
    onRemoveInboundInteractionDetail: PropTypes.func,
    onInboundInteractionDetailChange: PropTypes.func,
    onAddInboundImageDraft: PropTypes.func,
    onRemoveInboundImageDraft: PropTypes.func,
    onInboundImageDraftChange: PropTypes.func,
    onCancelarGestion: PropTypes.func.isRequired,
    user: PropTypes.shape({
        full_name: PropTypes.string,
        name: PropTypes.string,
        username: PropTypes.string,
    }),
    isSaving: PropTypes.bool,
    secureInboundManual: PropTypes.bool,
};
