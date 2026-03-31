import PropTypes from "prop-types";
import { PageContainer } from "../../components/common";
import AgentGestionForm from "./components/AgentGestionForm";
import GestionOutboundDemo from "./GestionOutboundDemo";
import OutMaquitaPage from "./OutMaquitaPage";
import OutHondaPage from "./OutHondaPage";
import useDashboardAgenteState from "./useDashboardAgente";
import BaseCardSection from "./components/BaseCardSection";
import "./DashboardAgente.css";

export default function DashboardAgente({
    user,
    selectedCampaignId,
    selectedCampaignTick,
    selectedMenuItemId,
    selectedCategoryId,
    selectedManualFlow,
    requestedAgentStatus,
    onAgentStatusSync,
    agentPage,
    onChangeAgentPage,
    selectedImportId,
}) {
    const {
        isAgente,
        registro,
        loadingRegistro,
        error,
        observacion,
        setObservacion,
        estadoAgente,
        campaignIdSeleccionada,
        levels,
        level1Seleccionado,
        level2Seleccionado,
        setLevel1Seleccionado,
        setLevel2Seleccionado,
        telefonos,
        telefonoSeleccionado,
        estadoTelefonos,
        estadoTelefonoSeleccionado,
        dynamicFormConfig,
        dynamicFormDetail,
        dynamicFormAnswers,
        dynamicSurveyConfig,
        surveyFieldsToRender,
        surveyAnswers,
        activeBaseCards,
        loadingActiveBaseCards,
        regestionBaseCards,
        loadingRegestionBaseCards,
        hasCampaignSelection,
        manualFlowActivo,
        menuItemIdSeleccionado,
        categoryIdSeleccionada,
        inboundChildOptions,
        shouldShowQueueMessage,
        isHomeView,
        isGestionOutbound,
        handleTelefonoChange,
        handleEstadoTelefonoChange,
        handleNoContestaAutofill,
        handleGrabadoraAutofill,
        handleContestaTerceroAutofill,
        handleSurveyFieldChange,
        handleDynamicFormFieldChange,
        handleGuardarGestion,
        handleCancelarGestion,
        selectBaseCard,
    } = useDashboardAgenteState({
        user,
        selectedCampaignId,
        selectedCampaignTick,
        selectedMenuItemId,
        selectedCategoryId,
        selectedManualFlow,
        requestedAgentStatus,
        onAgentStatusSync,
        agentPage,
        onChangeAgentPage,
        selectedImportId,
    });

    const getBaseCardKey = (card, index) =>
        `${card.campaignId || ""}-${card.importId || card.base || index}`;

    const renderActiveBaseCard = (card) => (
        <article className="agent-base-card agent-base-card--horizontal">
            <div className="agent-base-card__info-horizontal">
                <div className="agent-base-card__campaign-horizontal">
                    {card.campaignId}
                </div>
                <div className="agent-base-card__import-id">
                    {card.importId || card.base}
                </div>
                <div className="agent-base-card__metrics-horizontal">
                    <div className="agent-base-card__metric-horizontal">
                        {card.pendientes}
                        <span className="agent-base-card__metric-label-horizontal">
                            Por gestionar
                        </span>
                    </div>
                    <div className="agent-base-card__metric-horizontal">
                        {card.totalRegistros}
                        <span className="agent-base-card__metric-label-horizontal">
                            Total base
                        </span>
                    </div>
                </div>
            </div>
            <button
                type="button"
                className="agent-base-card__button-horizontal"
                onClick={() => selectBaseCard(card)}
            >
                Ingresar
            </button>
        </article>
    );

    const renderRegestionBaseCard = (card) => (
        <article className="agent-base-card agent-base-card--horizontal">
            <div className="agent-base-card__info-horizontal">
                <div className="agent-base-card__campaign-horizontal">
                    {card.campaignId}
                </div>
                <div className="agent-base-card__metrics-horizontal">
                    <div className="agent-base-card__metric-horizontal">
                        {card.totalReciclables}
                        <span className="agent-base-card__metric-label-horizontal">
                            Reciclables
                        </span>
                    </div>
                </div>
            </div>
            <button
                type="button"
                className="agent-base-card__button-horizontal"
                onClick={() => selectBaseCard(card)}
            >
                Ingresar
            </button>
        </article>
    );

    const showRegestionSection =
        loadingRegestionBaseCards || regestionBaseCards.length > 0;
    const baseCardLayoutClass = `agent-base-card-layout${
        showRegestionSection ? "" : " agent-base-card-layout--single"
    }`;

    if (!isAgente) {
        return (
            <PageContainer fullWidth className="agent-page-container">
                <div className="agent-page">
                    <h1 className="agent-title">Módulo de asesor</h1>
                    <p className="agent-subtitle">
                        <strong>Permiso denegado.</strong> Tu usuario no tiene
                        rol de asesor asignado.
                    </p>
                    <p className="agent-subtitle">
                        Pide a un administrador que te asigne el rol ASESOR
                        desde el módulo de Usuarios.
                    </p>
                </div>
            </PageContainer>
        );
    }

    return (
        <PageContainer fullWidth className="">
            <section className="">
                    {!registro && !manualFlowActivo && isHomeView && (
                        <div className={baseCardLayoutClass}>
                            <BaseCardSection
                                title="Bases activas disponibles"
                                loading={loadingActiveBaseCards}
                                cards={activeBaseCards}
                                emptyMessage="No hay bases activas disponibles."
                                renderCard={renderActiveBaseCard}
                                getKey={getBaseCardKey}
                            />
                            {showRegestionSection && (
                                <BaseCardSection
                                    title="Bases regestion disponibles"
                                    loading={loadingRegestionBaseCards}
                                    cards={regestionBaseCards}
                                    emptyMessage="No hay bases regestion disponibles."
                                    renderCard={renderRegestionBaseCard}
                                    getKey={getBaseCardKey}
                                />
                            )}
                        </div>
                    )}

                    {error && <p className="agent-error">{error}</p>}

                    {loadingRegistro && !isHomeView && !isGestionOutbound && (
                        <p className="agent-info-text">
                            {manualFlowActivo
                                ? "Cargando formulario..."
                                : "Asignando registro..."}
                        </p>
                    )}

                    {shouldShowQueueMessage &&
                        !isHomeView &&
                        !isGestionOutbound && (
                            <p className="agent-info-text">
                                {estadoAgente === "disponible"
                                    ? "No hay registros disponibles en tu cola en este momento."
                                    : 'Estás en estado de pausa. Vuelve a "Disponible" para tomar registros.'}
                            </p>
                        )}

                    {(registro || manualFlowActivo) && !isHomeView && (
                        <AgentGestionForm
                            registro={registro}
                            campaignId={
                                campaignIdSeleccionada ||
                                selectedCampaignId ||
                                ""
                            }
                            manualFlow={manualFlowActivo}
                            menuItemId={menuItemIdSeleccionado}
                            categoryId={categoryIdSeleccionada}
                            inboundChildOptions={inboundChildOptions}
                            onSubmit={handleGuardarGestion}
                            levels={levels}
                            level1Seleccionado={level1Seleccionado}
                            level2Seleccionado={level2Seleccionado}
                            onLevel1Change={setLevel1Seleccionado}
                            onLevel2Change={setLevel2Seleccionado}
                            telefonos={telefonos}
                            telefonoSeleccionado={telefonoSeleccionado}
                            onTelefonoChange={handleTelefonoChange}
                            estadoTelefonos={estadoTelefonos}
                            estadoTelefonoSeleccionado={
                                estadoTelefonoSeleccionado
                            }
                            onEstadoTelefonoChange={handleEstadoTelefonoChange}
                            observacion={observacion}
                            onObservacionChange={setObservacion}
                            onNoContestaClick={handleNoContestaAutofill}
                            onGrabadoraClick={handleGrabadoraAutofill}
                            onContestaTerceroClick={
                                handleContestaTerceroAutofill
                            }
                            dynamicFormConfig={dynamicFormConfig}
                            dynamicFormDetail={dynamicFormDetail}
                            dynamicFormAnswers={dynamicFormAnswers}
                            dynamicSurveyConfig={dynamicSurveyConfig}
                            surveyFieldsToRender={surveyFieldsToRender}
                            surveyAnswers={surveyAnswers}
                            onSurveyFieldChange={handleSurveyFieldChange}
                            onDynamicFormFieldChange={
                                handleDynamicFormFieldChange
                            }
                            onCancelarGestion={handleCancelarGestion}
                            user={user}
                        />
                    )}
                    {isAgente &&
                        !isHomeView &&
                        isGestionOutbound &&
                        (() => {
                            const label = (
                                campaignIdSeleccionada ||
                                selectedCampaignId ||
                                ""
                            ).toLowerCase();
                            const outboundKey = `${
                                campaignIdSeleccionada ||
                                selectedCampaignId ||
                                ""
                            }-${selectedCampaignTick || ""}`;

                            if (
                                [
                                    "out cacpeco",
                                    "out kullki wasi",
                                    "out mutualista imbabura",
                                ].some((l) => label.includes(l))
                            ) {
                                return (
                                    <GestionOutboundDemo
                                        key={outboundKey}
                                        campaignName={
                                            campaignIdSeleccionada ||
                                            selectedCampaignId ||
                                            ""
                                        }
                                    />
                                );
                            }
                            if (label.includes("out maquita cushunchic")) {
                                return <OutMaquitaPage key={outboundKey} />;
                            }
                            if (label.includes("out honda")) {
                                return <OutHondaPage key={outboundKey} />;
                            }
                            return null;
                        })()}   
            </section>
        </PageContainer>
    );
}

DashboardAgente.propTypes = {
    user: PropTypes.shape({
        roles: PropTypes.arrayOf(PropTypes.string),
        bloqueado: PropTypes.bool,
        is_active: PropTypes.bool,
        name: PropTypes.string,
        username: PropTypes.string,
    }),
    selectedCampaignId: PropTypes.string,
    selectedCampaignTick: PropTypes.number,
    selectedMenuItemId: PropTypes.string,
    selectedCategoryId: PropTypes.string,
    selectedManualFlow: PropTypes.bool,
    requestedAgentStatus: PropTypes.string,
    onAgentStatusSync: PropTypes.func,
    agentPage: PropTypes.string,
    onSelectCampaign: PropTypes.func,
    onChangeAgentPage: PropTypes.func,
    selectedImportId: PropTypes.string,
};
