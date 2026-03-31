import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { Alert, Badge, Table } from "../../components/common";
import { obtenerCampaniasDesdeMenu } from "../../services/campaign.service";
import "./CargarBases.css";

export default function VerCampaniasActivas({ categoryId }) {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);
    const [alert, setAlert] = useState(null);

    useEffect(() => {
        const cargarPanorama = async () => {
            try {
                setLoading(true);
                setAlert(null);

                const tree = await obtenerCampaniasDesdeMenu(categoryId);
                const mappedRows = (tree || []).map((item) => {
                    const subcampanias = Array.isArray(item?.subcampanias)
                        ? item.subcampanias.filter(Boolean)
                        : [];

                    return {
                        campania: String(item?.campania || "").trim(),
                        totalSubcampanias: subcampanias.length,
                        subcampaniasTexto:
                            subcampanias.length > 0
                                ? subcampanias.join(", ")
                                : "Sin subcampañas activas",
                    };
                });

                setRows(mappedRows.filter((row) => row.campania));
            } catch (err) {
                setAlert({
                    type: "error",
                    message:
                        err.message || "Error al cargar campañas y subcampañas",
                });
            } finally {
                setLoading(false);
            }
        };

        cargarPanorama();
    }, [categoryId]);

    const columns = [
        {
            key: "campania",
            label: "Campaña activa",
        },
        {
            key: "totalSubcampanias",
            label: "Subcampañas activas",
            render: (value) => (
                <Badge variant={value > 0 ? "success" : "secondary"}>
                    {value}
                </Badge>
            ),
        },
        {
            key: "subcampaniasTexto",
            label: "Detalle subcampañas",
        },
    ];

    return (
        <div className="manage-bases-wrapper ver-campanias-wrapper">
            {alert && <Alert type={alert.type} message={alert.message} />}

            <div className="ver-campanias-table-full">
                <Table
                    columns={columns}
                    data={rows}
                    keyField="campania"
                    loading={loading}
                    noDataMessage="No hay campañas activas disponibles"
                />
            </div>
        </div>
    );
}

VerCampaniasActivas.propTypes = {
    categoryId: PropTypes.string.isRequired,
};
