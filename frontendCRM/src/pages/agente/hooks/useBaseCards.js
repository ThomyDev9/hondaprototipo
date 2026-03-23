import { useCallback, useState } from "react";
import {
    fetchActiveBasesSummary,
    fetchRegestionBasesSummary,
} from "../../../services/dashboard.service";

export default function useBaseCards() {
    const [activeBaseCards, setActiveBaseCards] = useState([]);
    const [regestionBaseCards, setRegestionBaseCards] = useState([]);
    const [loadingActiveBaseCards, setLoadingActiveBaseCards] = useState(false);
    const [loadingRegestionBaseCards, setLoadingRegestionBaseCards] =
        useState(false);

    const refreshBases = useCallback(async () => {
        setLoadingActiveBaseCards(true);
        setLoadingRegestionBaseCards(true);
        try {
            const [activasResp, regestionResp] = await Promise.all([
                fetchActiveBasesSummary(),
                fetchRegestionBasesSummary(),
            ]);
            setActiveBaseCards(activasResp.json?.data || []);
            setRegestionBaseCards(regestionResp.json?.data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingActiveBaseCards(false);
            setLoadingRegestionBaseCards(false);
        }
    }, []);

    return {
        activeBaseCards,
        regestionBaseCards,
        loadingActiveBaseCards,
        loadingRegestionBaseCards,
        refreshBases,
    };
}
