import CampaignDAO from "./dao/CampaignDAO.js";

const campaignDAO = new CampaignDAO();

/**
 * CAMPAIGN SERVICE
 * Maneja operaciones relacionadas con campanas.
 * Consume CampaignDAO para encapsular el acceso SQL.
 */

export async function obtenerCampanasDistintas() {
    try {
        return await campaignDAO.getDistinct();
    } catch (err) {
        console.error("Error obteniendo campanas distintas:", err);
        throw err;
    }
}

export async function buscarCampanas(searchTerm) {
    try {
        return await campaignDAO.search(searchTerm);
    } catch (err) {
        console.error("Error buscando campanas:", err);
        throw err;
    }
}

export async function obtenerCampanasActivas() {
    try {
        return await campaignDAO.getActive();
    } catch (err) {
        console.error("Error obteniendo campanas activas:", err);
        throw err;
    }
}

export async function validarCampania(id) {
    try {
        return await campaignDAO.exists(id);
    } catch (err) {
        console.error("Error validando campana:", err);
        throw err;
    }
}

export default {
    obtenerCampanasDistintas,
    buscarCampanas,
    obtenerCampanasActivas,
    validarCampania,
};
