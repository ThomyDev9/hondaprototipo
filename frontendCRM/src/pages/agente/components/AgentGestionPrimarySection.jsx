import PropTypes from "prop-types";
import Button from "../../../components/common/Button";

export default function AgentGestionPrimarySection({
    levels,
    telefonos,
    telefonoSeleccionado,
    onTelefonoChange,
    level1Seleccionado,
    onLevel1Change,
    level2Seleccionado,
    onLevel2Change,
    estadoTelefonos,
    estadoTelefonoSeleccionado,
    onEstadoTelefonoChange,
    observacion,
    onObservacionChange,
    registro,
    onNoContestaClick,
    onGrabadoraClick,
    onContestaTerceroClick,
}) {
    const level1Options = [
        ...new Set(levels.map((item) => item.level1).filter(Boolean)),
    ];
    const level2Options = levels
        .filter((item) => item.level1 === level1Seleccionado)
        .map((item) => item.level2)
        .filter(Boolean);
    const requiereTelefono = !Boolean(telefonoSeleccionado);

    return (
        <section className="agent-form-card agent-form-card--f1">
            <div className="agent-form-card__header">
                <h4 className="agent-form-card__title">Formulario 1</h4>
                <div className="agent-quick-actions">
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={onNoContestaClick}
                        disabled={requiereTelefono}
                    >
                        No contesta
                    </Button>
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={onGrabadoraClick}
                        disabled={requiereTelefono}
                    >
                        Grabadora
                    </Button>
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={onContestaTerceroClick}
                        disabled={requiereTelefono}
                    >
                        Contesta tercero
                    </Button>
                </div>
            </div>

            <div className="agent-form-card__body">
                <div className="agent-form-field">
                    <label className="agent-label">
                        <span>Telefonos a marcar</span>
                        <select
                            value={telefonoSeleccionado || ""}
                            onChange={(event) => onTelefonoChange(event.target.value)}
                            className="agent-input"
                            required
                        >
                            <option value="">Selecciona...</option>
                            {telefonos.map((phone) => (
                                <option key={phone} value={phone}>
                                    {phone}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>

                <div className="agent-form-field">
                    <label className="agent-label">
                        <span>Resultado gestion - Nivel 1</span>
                        <select
                            value={level1Seleccionado || ""}
                            onChange={(event) => onLevel1Change(event.target.value)}
                            className="agent-input"
                            required
                            disabled={requiereTelefono}
                        >
                            <option value="">Selecciona...</option>
                            {level1Options.map((option) => (
                                <option key={option} value={option}>
                                    {option}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>

                <div className="agent-form-field">
                    <label className="agent-label">
                        <span>Resultado gestion - Nivel 2</span>
                        <select
                            value={level2Seleccionado || ""}
                            onChange={(event) => onLevel2Change(event.target.value)}
                            className="agent-input"
                            required
                            disabled={requiereTelefono}
                        >
                            <option value="">Selecciona...</option>
                            {level2Options.map((option) => (
                                <option key={option} value={option}>
                                    {option}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>

                <div className="agent-form-field">
                    <label className="agent-label">
                        <span>Estados telefonos</span>
                        <select
                            value={estadoTelefonoSeleccionado || ""}
                            onChange={(event) =>
                                onEstadoTelefonoChange(event.target.value)
                            }
                            className="agent-input"
                            required
                            disabled={requiereTelefono}
                        >
                            <option value="">Selecciona...</option>
                            {estadoTelefonos.map((option) => (
                                <option key={option} value={option}>
                                    {option}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>

                <div className="agent-form-field">
                    <label className="agent-label">
                        <span>Observacion</span>
                        <input
                            type="text"
                            placeholder="Ej: Cliente prefiere WhatsApp para confirmacion."
                            value={observacion || ""}
                            onChange={(event) => onObservacionChange(event.target.value)}
                            className="agent-input"
                            required
                            disabled={requiereTelefono}
                        />
                    </label>
                </div>

                <div className="agent-form-field">
                    <label className="agent-label">
                        <span>Intentos</span>
                        <input
                            type="text"
                            value={String(registro?.intentos_totales ?? 0)}
                            className="agent-input"
                            readOnly
                        />
                    </label>
                </div>
            </div>
        </section>
    );
}

AgentGestionPrimarySection.propTypes = {
    levels: PropTypes.arrayOf(PropTypes.object).isRequired,
    telefonos: PropTypes.arrayOf(PropTypes.string).isRequired,
    telefonoSeleccionado: PropTypes.string.isRequired,
    onTelefonoChange: PropTypes.func.isRequired,
    level1Seleccionado: PropTypes.string.isRequired,
    onLevel1Change: PropTypes.func.isRequired,
    level2Seleccionado: PropTypes.string.isRequired,
    onLevel2Change: PropTypes.func.isRequired,
    estadoTelefonos: PropTypes.arrayOf(PropTypes.string).isRequired,
    estadoTelefonoSeleccionado: PropTypes.string.isRequired,
    onEstadoTelefonoChange: PropTypes.func.isRequired,
    observacion: PropTypes.string.isRequired,
    onObservacionChange: PropTypes.func.isRequired,
    registro: PropTypes.object,
    onNoContestaClick: PropTypes.func.isRequired,
    onGrabadoraClick: PropTypes.func.isRequired,
    onContestaTerceroClick: PropTypes.func.isRequired,
};
