import { useCallback, useState } from "react";
import {
    fetchPhoneLastStatus,
    updatePhoneStatus,
} from "../../../services/dashboard.service";
import {
    buildInteractionId,
    formatNowForMysql,
} from "../dashboardAgente.helpers";

export default function usePhoneManagement({ registro, handle403, setError }) {
    const [telefonoSeleccionado, setTelefonoSeleccionado] = useState("");
    const [estadoTelefonoSeleccionado, setEstadoTelefonoSeleccionado] =
        useState("");
    const [interactionIdActual, setInteractionIdActual] = useState("");

    const persistPhoneStatus = useCallback(
        async (telefono, estado, interactionIdValue) => {
            const contactIdToUse = registro?.contact_id || registro?.id;
            const interactionToUse = String(
                interactionIdValue || interactionIdActual || "",
            ).trim();

            if (!telefono || !estado || !contactIdToUse || !interactionToUse) {
                return;
            }

            try {
                const payload = {
                    IDC: contactIdToUse,
                    fonos: telefono,
                    estatusTel: estado,
                    horaInicioLlamada: formatNowForMysql(),
                    interactionId: interactionToUse,
                    identificacionCliente: registro?.identification || "",
                };

                const { status, ok, json } = await updatePhoneStatus(payload);

                if (status === 403) {
                    handle403(json);
                    return;
                }

                if (!ok) {
                    setError(
                        json?.error ||
                            "No se pudo actualizar el estado del teléfono",
                    );
                }
            } catch (err) {
                console.error(err);
                setError("Error actualizando estado de teléfono");
            }
        },
        [registro, interactionIdActual, handle403, setError],
    );

    const handleEstadoTelefonoChange = useCallback(
        async (nuevoEstado) => {
            setEstadoTelefonoSeleccionado(nuevoEstado);

            if (!nuevoEstado) {
                return;
            }

            const newInteractionId = buildInteractionId();
            setInteractionIdActual(newInteractionId);

            if (
                !(registro?.contact_id || registro?.id) ||
                !telefonoSeleccionado
            ) {
                setError("Selecciona un teléfono antes de actualizar estado");
                return;
            }

            await persistPhoneStatus(
                telefonoSeleccionado,
                nuevoEstado,
                newInteractionId,
            );
        },
        [persistPhoneStatus, registro, telefonoSeleccionado, setError],
    );

    const handleTelefonoChange = useCallback(
        async (nuevoTelefono) => {
            setTelefonoSeleccionado(nuevoTelefono);

            const contactIdToUse = registro?.contact_id || registro?.id;

            if (!contactIdToUse || !nuevoTelefono) {
                setEstadoTelefonoSeleccionado("");
                return;
            }

            try {
                const { ok, json } = await fetchPhoneLastStatus(
                    contactIdToUse,
                    nuevoTelefono,
                );

                if (ok) {
                    const ultimoEstado = String(json?.ultimoEstado || "").trim();
                    const interactionId = String(json?.interactionId || "").trim();

                    if (ultimoEstado) {
                        setEstadoTelefonoSeleccionado(ultimoEstado);
                    }

                    if (interactionId) {
                        setInteractionIdActual(interactionId);
                    }
                }
            } catch (err) {
                console.error(err);
            }
        },
        [registro],
    );

    const resetPhoneSelection = useCallback(() => {
        setTelefonoSeleccionado("");
        setEstadoTelefonoSeleccionado("");
        setInteractionIdActual("");
    }, []);

    return {
        telefonoSeleccionado,
        estadoTelefonoSeleccionado,
        interactionIdActual,
        handleTelefonoChange,
        handleEstadoTelefonoChange,
        resetPhoneSelection,
        setTelefonoSeleccionado,
        setEstadoTelefonoSeleccionado,
    };
}
