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
import {
    buildDynamicFormRows,
    buildExtraFields,
} from "./agentGestionForm.helpers";

function AgentGestionForm({
    registro,
    campaignId,
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
    dynamicSurveyConfig,
    surveyFieldsToRender,
    surveyAnswers,
    onSurveyFieldChange,
    onCancelarGestion,
    user,
}) {
    const firstRender = useRef(true);
    const [activeTab, setActiveTab] = useState("gestion");

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
        () => buildDynamicFormRows(dynamicFormConfig, dynamicFormDetail),
        [dynamicFormConfig, dynamicFormDetail],
    );

    const extraFields = useMemo(
        () => buildExtraFields(dynamicFormDetail),
        [dynamicFormDetail],
    );

    const getDynamicFormValue = (key) => dynamicFormDetail?.[key] ?? "";

    const showDynamicForm =
        Boolean(dynamicFormConfig) && dynamicFormRowsWithValues.length > 0;

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
            registro,
            user,
            dynamicFormConfig,
            dynamicFormDetail,
        });

    const gestionContent = (
        <div className="agent-form-stack">
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

            {showDynamicForm && (
                <>
                    <div
                        className="agent-form-stack-divider"
                        aria-hidden="true"
                    />
                    <AgentGestionDynamicSection
                        title={dynamicFormConfig?.title}
                        rows={dynamicFormRowsWithValues}
                        extraFields={extraFields}
                        getFieldValue={getDynamicFormValue}
                    />
                </>
            )}
        </div>
    );

    const tabDefinitions = [
        {
            id: "gestion",
            label: showDynamicForm
                ? `F1 - F2 - ${dynamicFormConfig?.title}`
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
        <form onSubmit={onSubmit} className="agent-gestion-form">
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
                <Button variant="primary" type="submit">
                    Guardar gestion
                </Button>
                <Button
                    variant="secondary"
                    type="button"
                    onClick={onCancelarGestion}
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
    dynamicSurveyConfig: PropTypes.shape({
        title: PropTypes.string,
        fields: PropTypes.arrayOf(PropTypes.object),
    }),
    surveyFieldsToRender: PropTypes.arrayOf(PropTypes.object).isRequired,
    surveyAnswers: PropTypes.object.isRequired,
    onSurveyFieldChange: PropTypes.func.isRequired,
    onCancelarGestion: PropTypes.func.isRequired,
    user: PropTypes.shape({
        full_name: PropTypes.string,
        name: PropTypes.string,
        username: PropTypes.string,
    }),
};
